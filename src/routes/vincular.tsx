import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { inspectOnboarding, submitOnboarding } from "@/lib/pey/demo.functions";

export const Route = createFileRoute("/vincular")({
  validateSearch: z.object({ token: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Vincular cuenta demo · Pey" },
      { name: "description", content: "Formulario privado para vincular la cuenta ficticia del negocio en la demo de Pey." },
      { property: "og:title", content: "Vincular cuenta demo · Pey" },
      { property: "og:description", content: "Vincula la cuenta ficticia de tu negocio." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Vincular,
});

function Vincular() {
  const { token = "" } = Route.useSearch();
  const navigate = useNavigate();
  const [confirm, setConfirm] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const info = useQuery({ queryKey: ["onboarding", token], queryFn: () => inspectOnboarding({ data: { token } }), enabled: token.length >= 16, retry: false });

  const submit = async () => {
    setSending(true);
    setError("");
    try {
      await submitOnboarding({ data: { token } });
      navigate({ to: "/" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo vincular.");
      setSending(false);
    }
  };

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-7 shadow-sm">
        <p className="text-[10px] font-bold tracking-[0.12em] text-primary">FORMULARIO PRIVADO · DEMO</p>
        <h1 className="font-display text-3xl font-bold">Vincular cuenta demo</h1>
        {token.length < 16 ? (
          <p className="text-sm text-destructive">Enlace incompleto. Regresa al chat y escribe “vincular”.</p>
        ) : info.isLoading ? (
          <p className="text-sm text-muted-foreground">Verificando enlace…</p>
        ) : info.error ? (
          <p className="text-sm text-destructive">{info.error.message}</p>
        ) : info.data ? (
          <>
            <dl className="space-y-2 rounded-xl bg-muted p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Negocio</dt><dd className="font-semibold">{info.data.businessName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Banco</dt><dd className="font-semibold">{info.data.bank}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Cuenta</dt><dd className="font-semibold">•••• {info.data.last4}</dd></div>
            </dl>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" className="mt-1 accent-primary" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
              Confirmo que es una cuenta ficticia para esta demostración.
            </label>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button className="w-full" disabled={!confirm || sending} onClick={submit}>{sending ? "Vinculando…" : "Vincular y volver al chat"}</Button>
          </>
        ) : null}
        <Link to="/" className="block text-center text-sm text-primary underline-offset-4 hover:underline">Volver a los chats</Link>
      </div>
    </main>
  );
}
