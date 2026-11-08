// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Webhook } from "standardwebhooks";
import { verifyPey, verifyKapso, readBoundedBody } from "./live-webhooks";

describe("real provider boundary", () => {
  const secret = btoa("test-only-signing-key-not-a-credential");
  it("rejects an unsigned simulated payment as a Pey payment", () => {
    expect(() => verifyPey('{"outcome":"PAID"}', new Headers(), secret)).toThrow();
  });
  it("accepts a Pey signature only for its original payload", () => {
    const raw = '{"type":"codi.qr.payment_received","amount":0.01}';
    const now = new Date();
    const headers = new Headers({ "webhook-id": "test-event", "webhook-timestamp": String(Math.floor(now.getTime() / 1000)), "webhook-signature": new Webhook(secret).sign("test-event", now, raw) });
    expect(verifyPey(raw, headers, secret).id).toBe("test-event");
    expect(() => verifyPey(raw.replace("0.01", "100"), headers, secret)).toThrow();
  });
  it("rejects forged Kapso signatures", async () => {
    await expect(verifyKapso("{}", "0".repeat(64), "test-only-secret")).rejects.toThrow();
  });
  it("accepts valid Kapso signatures and rejects modified bodies", async () => {
    const raw = '{"message":{"id":"test-message"}}';
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode("test-only-secret"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw)));
    const signature = Array.from(bytes, v => v.toString(16).padStart(2, "0")).join("");
    await expect(verifyKapso(raw, signature, "test-only-secret")).resolves.toBeUndefined();
    await expect(verifyKapso(raw + " ", signature, "test-only-secret")).rejects.toThrow();
  });
  it("rejects oversized bodies before storing them", async () => {
    await expect(readBoundedBody(new Request("https://example.test", { method: "POST", body: "12345" }), 4)).rejects.toThrow("Body too large");
  });
});