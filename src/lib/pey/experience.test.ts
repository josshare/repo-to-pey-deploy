import { describe, expect, it } from "vitest";
import { remainingSeconds, newPaymentIds } from "./experience";

describe("payment presentation", () => {
  it("counts down to the supplied expiry without going negative", () => {
    expect(remainingSeconds("2026-11-08T02:17:00Z", Date.parse("2026-11-08T02:16:00Z"))).toBe(60);
    expect(remainingSeconds("2026-11-08T02:17:00Z", Date.parse("2026-11-08T02:18:00Z"))).toBe(0);
  });
  it("does not celebrate a replayed payment", () => {
    expect(newPaymentIds(new Set(["paid-1"]), ["paid-1", "paid-2"])).toEqual(["paid-2"]);
    expect(newPaymentIds(new Set(["paid-1"]), ["paid-1"])).toEqual([]);
  });
});