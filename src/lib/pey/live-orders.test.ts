import { describe, expect, it } from "vitest";
import { liveOrderInput, peyPaymentEvent, qrRequest } from "./live-orders";

const input = { requestId: "30000000-0000-4000-8000-000000000001", concept: "Pedido", amountCents: 1, consent: true };
const payment = { type: "codi.qr.payment_received", amount: 0.01, bankAccountId: "account", codiQrId: "qr", transactionId: "tx", datePaid: 1794768000 };
describe("authorized real Pey test", () => {
  it("accepts only one cent, not demo amounts or open amounts", () => {
    expect(liveOrderInput.safeParse(input).success).toBe(true);
    for (const amountCents of [0, 2, 100, 35000]) expect(liveOrderInput.safeParse({ ...input, amountCents }).success).toBe(false);
    expect(qrRequest("Pedido", "account", "order").amount).toBe(0.01);
  });
  it("requires explicit consent before creating a real QR", () => {
    expect(liveOrderInput.safeParse({ ...input, consent: false }).success).toBe(false);
  });
  it("accepts only authenticated-event amounts of $0.01 MXN", () => {
    expect(peyPaymentEvent.safeParse(payment).success).toBe(true);
    expect(peyPaymentEvent.safeParse({ ...payment, amount: 1 }).success).toBe(false);
  });
  it("requires matching identifiers to be available for reconciliation", () => {
    expect(peyPaymentEvent.safeParse({ ...payment, bankAccountId: undefined }).success).toBe(false);
    expect(peyPaymentEvent.safeParse({ ...payment, transactionId: "" }).success).toBe(false);
  });
  it("omits the account so Pey uses the one linked to the API key", () => {
    expect("bankAccountId" in qrRequest("Pedido", null, "order")).toBe(false);
    expect(qrRequest("Pedido", "account", "order").bankAccountId).toBe("account");
  });
});
