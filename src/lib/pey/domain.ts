export class InvalidEvent extends Error {}

export type Actor = "MERCHANT" | "CUSTOMER";
export type Action = { label: string; text?: string; url?: string; kind?: "share" | "bank"; id?: string };
export interface ChargeDraft {
  amountCents: number;
  totalCents: number;
  concept: string;
  kind: "FULL" | "DEPOSIT";
}

export const money = (cents: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(cents / 100);

/** Pesos de $1 a $10,000 con hasta dos decimales; devuelve centavos o null. */
export function parseMoney(text: string): number | null {
  const normalized = text.trim().replace(/^\$\s*/, "");
  if (!/^\d{1,5}(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
  return cents >= 100 && cents <= 1000000 ? cents : null;
}

export function chargeSummary(draft: ChargeDraft) {
  return `Revisa tu cobro:\n${draft.concept}\nA cobrar: ${money(draft.amountCents)}${
    draft.kind === "DEPOSIT"
      ? `\nTotal: ${money(draft.totalCents)} · Saldo: ${money(draft.totalCents - draft.amountCents)}`
      : "\nPago completo"
  }\nCuenta demo •••• 4242. ¿Confirmamos?`;
}
