import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, LockKeyhole, QrCode, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createLiveOrder, getLiveOrders, getLiveSetup } from "@/lib/pey/live-orders.functions";
import { remainingSeconds } from "@/lib/pey/experience";

export function LiveOrdersPanel() {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [concept, setConcept] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId, setRequestId] = useState<string | null>(null);
  const [now, setNow] = useState(0);
  const qc = useQueryClient();
  const readOrders = useServerFn(getLiveOrders);
  const createOrder = useServerFn(createLiveOrder);
  const setup = useQuery({ queryKey: ["live-setup"], queryFn: () => getLiveSetup(), retry: false });
  const orders = useQuery({ queryKey: ["live-orders"], queryFn: () => readOrders(), enabled: signedIn, retry: false, refetchInterval: signedIn ? 5000 : false });

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => { if (active) setSignedIn(Boolean(data.session)); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      qc.removeQueries({ queryKey: ["live-orders"] });
    });
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { active = false; listener.subscription.unsubscribe(); window.clearInterval(timer); };
  }, [qc]);

  async function login(e: FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw new Error("No se pudo iniciar sesión. Revisa tu correo y contraseña.");
      setPassword("");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo iniciar sesión."); }
    finally { setBusy(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault(); if (busy || !consent) return;
    setBusy(true); setError("");
    const id = requestId ?? crypto.randomUUID();
    setRequestId(id);
    try {
      await createOrder({ data: { requestId: id, concept, amountCents: 1, consent: true } });
      setConcept(""); setConsent(false); setRequestId(null);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el cobro."); }
    finally { await qc.invalidateQueries({ queryKey: ["live-orders"] }); setBusy(false); }
  }

  const ready = Boolean(setup.data?.connected && setup.data?.webhookConfigured && orders.data?.authorized);
  return (
    <section className="mt-8 border-t border-border pt-6" aria-label="Pedidos reales de prueba">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-primary">PEY · PRUEBA REAL CONTROLADA</p>
          <h2 className="mt-1 flex items-center gap-2 font-display text-2xl font-bold"><QrCode className="size-5" /> Pedidos de $0.01 MXN</h2>
        </div>
        {signedIn && <Button variant="ghost" onClick={async () => { await supabase.auth.signOut(); }}>Cerrar sesión</Button>}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <span>Pey: {setup.data?.connected ? "conectado" : "pendiente"}</span>
        <span>Confirmaciones: {setup.data?.webhookConfigured ? "configuradas" : "pendientes"}</span>
        <span>Dueño y cuenta receptora: {orders.data?.authorized ? "habilitados" : "pendientes"}</span>
        <span>WhatsApp real: pendiente de Kapso</span>
      </div>
      {setup.error && <p className="mt-3 text-sm text-destructive">No se pudo comprobar la configuración de Pey.</p>}
      {!signedIn ? (
        <form onSubmit={login} className="mt-5 flex max-w-md flex-col gap-3">
          <h3 className="flex items-center gap-2 font-semibold"><LockKeyhole className="size-4" /> Acceso del dueño</h3>
          <label className="text-sm">Correo<input aria-label="Correo del dueño" type="email" required autoComplete="username" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3" /></label>
          <label className="text-sm">Contraseña<input aria-label="Contraseña del dueño" type="password" required autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3" /></label>
          <Button type="submit" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</Button>
        </form>
      ) : (
        <>
          {orders.isFetching && !orders.data && <p className="mt-4 text-sm text-muted-foreground">Comprobando acceso…</p>}
          {orders.error && <p className="mt-4 text-sm text-destructive">No se pudo consultar el acceso. <Button variant="link" onClick={() => orders.refetch()}>Volver a consultar</Button></p>}
          {orders.data && !orders.data.authorized && <p className="mt-4 text-sm text-muted-foreground">Tu cuenta todavía no está habilitada para solicitar cobros reales.</p>}
          <form onSubmit={submit} className="mt-5 max-w-xl space-y-3">
            <label className="block text-sm font-medium">Pedido<input aria-label="Concepto del pedido real" required maxLength={40} value={concept} onChange={e => { setConcept(e.target.value); setRequestId(null); }} disabled={!ready || busy} className="mt-1 block h-10 w-full rounded-md border border-input bg-background px-3 disabled:opacity-50" /></label>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} disabled={!ready || busy} className="mt-1 accent-primary" />Autorizo un cobro real de $0.01 MXN. El pago de prueba no se devuelve.</label>
            <Button type="submit" disabled={!ready || !consent || !concept.trim() || busy}><QrCode />{busy ? "Solicitando QR…" : "Crear QR real · $0.01"}</Button>
          </form>
          {orders.data?.authorized && <div className="mt-6">
            <div className="flex items-center justify-between"><h3 className="font-display text-lg font-bold">Pedidos</h3><Button variant="ghost" size="icon" aria-label="Actualizar pedidos" onClick={() => orders.refetch()}><RefreshCw /></Button></div>
            {!orders.data.orders.length && <p className="mt-3 text-sm text-muted-foreground">Aún no hay pedidos reales.</p>}
            <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {orders.data.orders.map(order => {
                const seconds = order.expires_at ? remainingSeconds(order.expires_at, now) : 0;
                const expired = order.status === "PENDING" && seconds === 0;
                const label = order.status === "READY" ? "Listo para preparar" : order.status === "REVIEW" ? "Requiere revisión" : expired ? "QR vencido · esperando conciliación" : order.status === "PENDING" ? "Esperando pago" : "Creación en curso · no repetir";
                return <article key={order.id} className="min-w-0 rounded-lg border border-border bg-card p-4">
                  <h4 className="break-words font-semibold">{order.concept}</h4><p className="mt-1 font-mono text-xl">$0.01 MXN</p>
                  <p className={`mt-2 flex items-center gap-2 text-sm ${order.status === "READY" ? "text-primary" : "text-muted-foreground"}`}>{order.status === "READY" && <CheckCircle2 className="size-4 shrink-0" />}{label}</p>
                  {order.status === "PENDING" && !expired && order.qr_string && <><div className="demo-qr mx-auto mt-4 w-fit rounded-md bg-card p-3"><QRCodeSVG value={order.qr_string} size={168} title={`QR real para ${order.concept}`} /></div><p className="mt-2 text-center font-mono text-sm">{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}</p></>}
                  {order.transaction_id && <p className="mt-3 break-all text-xs text-muted-foreground">Transacción: {order.transaction_id}</p>}
                </article>;
              })}
            </div>
          </div>}
        </>
      )}
      {error && <p role="alert" className="mt-4 break-words text-sm text-destructive">{error}</p>}
    </section>
  );
}