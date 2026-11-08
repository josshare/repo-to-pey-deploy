// @vitest-environment node
import { describe, expect, it, vi, afterEach } from "vitest";
import { receiveLiveWebhook } from "./live-inbox.server";

afterEach(() => vi.unstubAllEnvs());

describe("webhook setup boundary", () => {
  it.each(["pey", "kapso"] as const)("rejects unsigned %s requests even when signing is not configured", async provider => {
    vi.stubEnv("PEY_WEBHOOK_SECRET", "");
    vi.stubEnv("KAPSO_WEBHOOK_SECRET", "");
    const response = await receiveLiveWebhook(new Request("https://example.test", { method: "POST", body: "{}" }), provider);
    expect(response.status).toBe(401);
  });
  it("does not acknowledge signed Kapso requests while its signing secret is missing", async () => {
    vi.stubEnv("KAPSO_WEBHOOK_SECRET", "");
    const response = await receiveLiveWebhook(new Request("https://example.test", {
      method: "POST", body: "{}", headers: { "x-webhook-signature": "0".repeat(64), "x-webhook-event": "whatsapp.message.received" },
    }), "kapso");
    expect(response.status).toBe(503);
  });
});