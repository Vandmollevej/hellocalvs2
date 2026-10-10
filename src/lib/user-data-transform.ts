// Transparent kryptering af User.email / User.displayName / User.phone (docs/DECISIONS.md
// 2026-10-04). Rene funktioner der omskriver Prisma-argumenter og -resultater;
// koblet paa klienten i src/lib/prisma.ts. Relationer foelges via Prisma.dmmf,
// saa ogsaa nested select/include/where/create/update paa andre modeller rammer.
import { Prisma } from "@prisma/client";
import { cryptoConfigured, decryptField, emailHash, encryptField } from "./user-crypto.ts";

type Json = Record<string, unknown>;
type Rel = { type: string };

const relCache = new Map<string, Map<string, Rel>>();
function relations(model: string): Map<string, Rel> {
  let m = relCache.get(model);
  if (!m) {
    m = new Map();
    const def = Prisma.dmmf.datamodel.models.find((x) => x.name === model);
    for (const f of def?.fields ?? []) if (f.kind === "object") m.set(f.name, { type: f.type });
    relCache.set(model, m);
  }
  return m;
}

const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v) && !(v instanceof Date);
const REL_FILTERS = ["is", "isNot", "some", "every", "none"];

function emailCondition(v: unknown): Json | null {
  if (v === undefined) return null;
  const hashAndPlain = (e: string) => (cryptoConfigured() ? [{ emailHash: emailHash(e) }, { email: e }] : [{ email: e }]);
  if (typeof v === "string") return { OR: hashAndPlain(v) };
  if (isObj(v)) {
    const keys = Object.keys(v).filter((k) => k !== "mode");
    if (keys.length === 1 && keys[0] === "equals" && typeof v.equals === "string") return { OR: hashAndPlain(v.equals) };
    if (keys.length === 1 && keys[0] === "in" && Array.isArray(v.in)) {
      const list = v.in as string[];
      return cryptoConfigured()
        ? { OR: [{ emailHash: { in: list.map((e) => emailHash(e)) } }, { email: { in: list } }] }
        : { email: { in: list } };
    }
  }
  throw new Error("User.email er krypteret: kun præcis match (streng, equals, in) kan filtreres.");
}

export function transformWhere(model: string, where: unknown, unique: boolean, keepEmail = false): unknown {
  if (!isObj(where)) return where;
  const out: Json = {};
  const extra: Json[] = [];
  const rels = relations(model);
  for (const [k, v] of Object.entries(where)) {
    if (k === "AND" || k === "OR" || k === "NOT") {
      out[k] = Array.isArray(v) ? v.map((x) => transformWhere(model, x, false)) : transformWhere(model, v, false);
      continue;
    }
    if (model === "User" && k === "email") {
      if (keepEmail) out[k] = v;
      else if (unique && typeof v === "string" && cryptoConfigured()) out.emailHash = emailHash(v);
      else if (unique && typeof v === "string") out[k] = v;
      else {
        const c = emailCondition(v);
        if (c) extra.push(c);
      }
      continue;
    }
    if (model === "User" && (k === "displayName" || k === "phone") && v !== undefined) {
      throw new Error(`User.${k} er krypteret og kan ikke bruges i where.`);
    }
    const rel = rels.get(k);
    if (rel && isObj(v)) {
      out[k] = Object.keys(v).some((x) => REL_FILTERS.includes(x))
        ? Object.fromEntries(Object.entries(v).map(([fk, fv]) => [fk, REL_FILTERS.includes(fk) ? transformWhere(rel.type, fv, false) : fv]))
        : transformWhere(rel.type, v, false);
      continue;
    }
    out[k] = v;
  }
  if (extra.length) {
    const existing = out.AND === undefined ? [] : Array.isArray(out.AND) ? out.AND : [out.AND];
    out.AND = [...existing, ...extra];
  }
  return out;
}

function plainOf(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (isObj(v) && typeof v.set === "string") return v.set;
  return undefined;
}

export function transformData(model: string, data: unknown): unknown {
  if (Array.isArray(data)) return data.map((d) => transformData(model, d));
  if (!isObj(data)) return data;
  const out: Json = {};
  const rels = relations(model);
  for (const [k, v] of Object.entries(data)) {
    if (model === "User" && k === "email") {
      const plain = plainOf(v);
      if (plain !== undefined && cryptoConfigured()) {
        out.email = encryptField(plain);
        out.emailHash = emailHash(plain);
      } else out[k] = v;
      continue;
    }
    if (model === "User" && (k === "displayName" || k === "phone")) {
      const plain = plainOf(v);
      out[k] = plain !== undefined && cryptoConfigured() ? encryptField(plain) : v;
      continue;
    }
    const rel = rels.get(k);
    if (rel && isObj(v)) {
      out[k] = Object.fromEntries(Object.entries(v).map(([op, ov]) => [op, nestedOp(rel.type, op, ov)]));
      continue;
    }
    out[k] = v;
  }
  return out;
}

function nestedOp(model: string, op: string, v: unknown): unknown {
  const one = (x: unknown): unknown => {
    if (!isObj(x)) return x; // boolean (delete/disconnect) m.m.
    switch (op) {
      case "create":
        return transformData(model, x);
      case "createMany":
        return { ...x, data: transformData(model, x.data) };
      case "connectOrCreate":
        return { ...x, where: transformWhere(model, x.where, true), create: transformData(model, x.create) };
      case "connect":
      case "disconnect":
      case "set":
      case "delete":
        return transformWhere(model, x, true);
      case "deleteMany":
        return transformWhere(model, x, false);
      case "updateMany":
        return { ...x, where: transformWhere(model, x.where, false), data: transformData(model, x.data) };
      case "update":
        return "data" in x
          ? { ...x, ...(x.where ? { where: transformWhere(model, x.where, true) } : {}), data: transformData(model, x.data) }
          : transformData(model, x);
      case "upsert":
        return {
          ...x,
          ...(x.where ? { where: transformWhere(model, x.where, true) } : {}),
          create: transformData(model, x.create),
          update: transformData(model, x.update),
        };
      default:
        return x;
    }
  };
  return Array.isArray(v) ? v.map(one) : one(v);
}

function transformSelect(model: string, sel: unknown): unknown {
  if (!isObj(sel)) return sel;
  const rels = relations(model);
  const out: Json = {};
  for (const [k, v] of Object.entries(sel)) {
    const rel = rels.get(k);
    if (rel && isObj(v)) {
      const nv: Json = { ...v };
      if (nv.where) nv.where = transformWhere(rel.type, nv.where, false);
      if (nv.select) nv.select = transformSelect(rel.type, nv.select);
      if (nv.include) nv.include = transformSelect(rel.type, nv.include);
      out[k] = nv;
    } else out[k] = v;
  }
  return out;
}

const UNIQUE_OPS = new Set(["findUnique", "findUniqueOrThrow", "update", "delete", "upsert"]);

export function transformArgs(model: string, operation: string, args: unknown, keepEmail = false): unknown {
  if (!isObj(args)) return args;
  const out: Json = { ...args };
  if (out.where !== undefined) out.where = transformWhere(model, out.where, UNIQUE_OPS.has(operation), keepEmail);
  if (out.cursor !== undefined) out.cursor = transformWhere(model, out.cursor, true, keepEmail);
  if (out.data !== undefined) out.data = transformData(model, out.data);
  if (out.create !== undefined) out.create = transformData(model, out.create);
  if (out.update !== undefined) out.update = transformData(model, out.update);
  if (out.select !== undefined) out.select = transformSelect(model, out.select);
  if (out.include !== undefined) out.include = transformSelect(model, out.include);
  return out;
}

export function decryptResult(model: string, result: unknown): unknown {
  if (Array.isArray(result)) {
    for (const r of result) decryptResult(model, r);
    return result;
  }
  if (!isObj(result)) return result;
  const rels = relations(model);
  for (const [k, v] of Object.entries(result)) {
    if (model === "User" && (k === "email" || k === "displayName" || k === "phone") && typeof v === "string") {
      result[k] = decryptField(v);
      continue;
    }
    const rel = rels.get(k);
    if (rel && v && typeof v === "object") decryptResult(rel.type, v);
  }
  return result;
}

export function hasTopLevelEmail(args: unknown): string | null {
  if (isObj(args) && isObj(args.where) && typeof args.where.email === "string") return args.where.email;
  return null;
}
