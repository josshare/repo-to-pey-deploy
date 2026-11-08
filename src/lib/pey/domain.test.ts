import { describe, expect, it } from "vitest";
import { parseMoney } from "./domain";

describe("parseMoney", () => {
  it("acepta pesos con hasta dos decimales", () => {
    expect(parseMoney("250.50")).toBe(25050);
    expect(parseMoney("$ 1")).toBe(100);
  });
  it("limita el monto entre $1 y $10,000", () => {
    expect(parseMoney("0.99")).toBeNull();
    expect(parseMoney("10000")).toBe(1000000);
    expect(parseMoney("10000.01")).toBeNull();
  });
  it("rechaza más de dos decimales o texto", () => {
    expect(parseMoney("10.123")).toBeNull();
    expect(parseMoney("diez")).toBeNull();
  });
});
