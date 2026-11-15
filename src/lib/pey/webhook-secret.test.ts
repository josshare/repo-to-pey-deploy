// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { getPeyWebhookSecret } from "./webhook-secret.server";

afterEach(() => vi.unstubAllEnvs());

describe("Pey signing configuration", () => {
  it("uses the owner-confirmed legacy secret name when the Pey name is absent", () => {
    vi.stubEnv("PEY_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "legacy-test-fixture");
    expect(getPeyWebhookSecret() === "legacy-test-fixture").toBe(true);
  });
  it("prefers the dedicated Pey name", () => {
    vi.stubEnv("PEY_WEBHOOK_SECRET", "pey-test-fixture");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "legacy-test-fixture");
    expect(getPeyWebhookSecret() === "pey-test-fixture").toBe(true);
  });
  it("fails closed when neither name is configured", () => {
    vi.stubEnv("PEY_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    expect(Boolean(getPeyWebhookSecret())).toBe(false);
  });
});