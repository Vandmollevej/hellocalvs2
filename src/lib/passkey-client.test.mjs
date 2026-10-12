import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Exercise the actual client with browser/network boundaries replaced. No
// authenticator or user credentials are created by these tests.
const source = ts.transpileModule(readFileSync(new URL("./passkey-client.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function client({ registered = true, fetchError, verifyStatus = 200, verifyCode, registrationError } = {}) {
  const stored = new Map(registered ? [["hc_passkey_on_device", "1"]] : []);
  const requests = [];
  const testModule = { exports: {} };
  runInNewContext(source, {
    exports: testModule.exports,
    Error,
    window: { PublicKeyCredential: function PublicKeyCredential() {} },
    localStorage: {
      getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value),
      removeItem: (key) => stored.delete(key),
    },
    require: () => ({
      startAuthentication: async () => ({ id: "existing-credential" }),
      startRegistration: async () => {
        if (registrationError) throw registrationError;
        return { id: "new-credential" };
      },
    }),
    fetch: async (url) => {
      requests.push(url);
      if (fetchError) throw fetchError;
      const status = url.endsWith("/verify") ? verifyStatus : 200;
      return {
        ok: status === 200,
        json: async () => status === 200 ? {} : { message: "Failed", code: verifyCode },
      };
    },
  });
  return { api: testModule.exports, requests };
}

test("temporary login failures preserve the enabled Face ID button", async () => {
  for (const scenario of [
    { fetchError: new TypeError("Network unavailable") },
    { verifyStatus: 400 }, // expired challenge
    { verifyStatus: 429 }, // rate limit
    { verifyStatus: 500 },
    { verifyStatus: 401 }, // unsuccessful assertion is not a deleted key
  ]) {
    const { api } = client(scenario);
    await assert.rejects(api.loginWithPasskey());
    assert.equal(api.hasPasskeyOnDevice(), true);
  }
});

test("only an explicit unknown credential response disables Face ID", async () => {
  const { api } = client({ verifyStatus: 401, verifyCode: "PASSKEY_NOT_REGISTERED" });
  await assert.rejects(api.loginWithPasskey());
  assert.equal(api.hasPasskeyOnDevice(), false);
});

test("successful passkey login restores the device marker", async () => {
  const { api } = client({ registered: false });
  await api.loginWithPasskey();
  assert.equal(api.hasPasskeyOnDevice(), true);
});

test("an existing registration is enabled only after account reauthentication", async () => {
  const error = Object.assign(new Error("Already registered"), { name: "InvalidStateError" });
  const { api, requests } = client({ registered: false, registrationError: error });
  await api.registerPasskey();
  assert.deepEqual(requests, [
    "/api/auth/passkey/register/options",
    "/api/auth/passkey/reauth/options",
    "/api/auth/passkey/reauth/verify",
  ]);
  assert.equal(api.hasPasskeyOnDevice(), true);
});

test("failed reauthentication never marks an existing registration as enabled", async () => {
  const error = Object.assign(new Error("Already registered"), { name: "InvalidStateError" });
  const { api } = client({ registered: false, registrationError: error, verifyStatus: 401 });
  await assert.rejects(api.registerPasskey());
  assert.equal(api.hasPasskeyOnDevice(), false);
});

test("cancelled enrollment neither verifies nor enables a credential", async () => {
  const error = Object.assign(new Error("Cancelled"), { name: "NotAllowedError" });
  const { api, requests } = client({ registered: false, registrationError: error });
  await assert.rejects(api.registerPasskey());
  assert.deepEqual(requests, ["/api/auth/passkey/register/options"]);
  assert.equal(api.hasPasskeyOnDevice(), false);
});
