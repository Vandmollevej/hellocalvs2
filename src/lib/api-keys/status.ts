import { KEY_SERVICES, type KeyGroupId, type KeyKind, type KeyService } from "@/lib/api-keys/catalog";
import { keySource, type KeySource } from "@/lib/api-keys/store";

// Det admin-siden må se om en nøgle. Hemmelige værdier forlader aldrig
// serveren — kun de sidste fire tegn og længden.

export type FieldStatus = {
  key: string;
  label: string;
  kind: KeyKind;
  optional: boolean;
  editable: boolean;
  multiline: boolean;
  hint: string | null;
  display: string | null;
  source: KeySource;
  updatedAt: string | null;
  unreadable: boolean;
};

export type ServiceStatus = {
  id: string;
  name: string;
  group: KeyGroupId;
  purpose: string;
  setupUrl: string | null;
  note: string | null;
  testable: boolean;
  redirectUris: string[];
  fields: FieldStatus[];
};

function displayValue(kind: KeyKind, value: string | undefined) {
  if (!value) return null;
  if (kind !== "secret") return value;
  return value.length >= 16 ? `•••• ${value.slice(-4)} (${value.length} tegn)` : `•••• (${value.length} tegn)`;
}

export function requiredKeys(service: KeyService) {
  return service.fields.filter((f) => !f.optional).map((f) => f.key);
}

export function serviceStatus(service: KeyService): ServiceStatus {
  return {
    id: service.id,
    name: service.name,
    group: service.group,
    purpose: service.purpose,
    setupUrl: service.setupUrl ?? null,
    note: service.note ?? null,
    testable: service.testable,
    redirectUris: service.redirectUris?.() ?? [],
    fields: service.fields.map((field) => {
      const source = keySource(field.key);
      return {
        key: field.key,
        label: field.label,
        kind: field.kind,
        optional: Boolean(field.optional),
        editable: field.editable !== false,
        multiline: Boolean(field.multiline),
        hint: field.hint ?? null,
        display: displayValue(field.kind, process.env[field.key]?.trim()),
        source: source.source,
        updatedAt: source.updatedAt?.toISOString() ?? null,
        unreadable: source.unreadable,
      };
    }),
  };
}

export function allServiceStatuses() {
  return KEY_SERVICES.map(serviceStatus);
}
