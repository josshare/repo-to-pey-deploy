import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Check, Clock3, ScanLine, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { money } from "@/lib/pey/domain";
import { newPaymentIds, remainingSeconds } from "@/lib/pey/experience";

export function PaymentCelebration({ paymentIds }: { paymentIds: string[] }) {
  const seen = useRef<Set<string> | null>(null);
  const audio = useRef<AudioContext | null>(null);
  const [sound, setSound] = useState(false);
  const [celebrating, setCelebrating] = useState(false);
  const key = paymentIds.join(",");

  useEffect(() => {
    const current = key ? key.split(",") : [];
    if (!seen.current) { seen.current = new Set(current); return; }
    const added = newPaymentIds(seen.current, current);
    seen.current = new Set(current);
    if (!added.length) return;
    setCelebrating(true);
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const styles = getComputedStyle(document.documentElement);
      const colors = ["--primary", "--sun", "--chart-1"].map(token => styles.getPropertyValue(token).trim());
      void import("canvas-confetti").then(({ default: confetti }) => confetti({ particleCount: 100, spread: 80, origin: { y: 0.65 }, colors, disableForReducedMotion: true }));
    }
    if (sound && audio.current) {
      const ctx = audio.current;
      void ctx.resume();
      [880, 1174.66, 1567.98].forEach((frequency, i) => {
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        const start = ctx.currentTime + i * 0.09;
        oscillator.type = "sine";
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0.12, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.4);
        oscillator.connect(gain); gain.connect(ctx.destination);
        oscillator.start(start); oscillator.stop(start + 0.4);
      });
    }
    const timer = window.setTimeout(() => setCelebrating(false), 4000);
    return () => window.clearTimeout(timer);
  }, [key, sound]);

  useEffect(() => () => { void audio.current?.close(); }, []);

  const toggleSound = () => {
    if (!sound) {
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch { return; }
    }
    setSound(!sound);
  };

  return <>
    <Button variant="ghost" size="icon" aria-label={sound ? "Silenciar pagos" : "Activar sonido de pagos"} title={sound ? "Silenciar pagos" : "Activar sonido de pagos"} aria-pressed={sound} onClick={toggleSound}>
      {sound ? <Volume2 /> : <VolumeX />}
    </Button>
    {celebrating && <div role="status" className="payment-celebration fixed left-1/2 top-24 z-50 flex -translate-x-1/2 items-center gap-3 rounded-lg border border-primary/30 bg-card px-5 py-4 shadow-lg">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-primary"><Check className="size-5" /></span>
      <div><strong className="block text-sm">¡Pago recibido!</strong><span className="text-xs text-muted-foreground">Confirmación de pago simulado</span></div>
    </div>}
  </>;
}

export function PaymentQR({ attempt, amount, paid, onOpen, busy }: {
  attempt: { id: string; expires_at: string; status: string } | undefined;
  amount: number; paid: boolean; onOpen: () => void; busy: boolean;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const seconds = attempt && now !== null ? remainingSeconds(attempt.expires_at, now) : 0;
  const active = !!attempt && attempt.status === "PENDING" && seconds > 0 && !paid;
  const minutes = String(Math.floor(seconds / 60)).padStart(2, "0");
  const remainder = String(seconds % 60).padStart(2, "0");

  return <div className="border-y border-border py-5 text-center">
    <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground"><span className="flex items-center gap-1.5"><ScanLine className="size-4" /> QR de demostración</span><span>MXN</span></div>
    <div className={`qr-stage mx-auto grid size-44 place-items-center rounded-lg border border-border bg-card ${paid ? "bg-accent" : ""}`}>
      {paid ? <Check className="size-20 text-primary" strokeWidth={1.5} /> : attempt ? <QRCodeSVG className={`demo-qr size-36 ${active ? "" : "opacity-25"}`} value={`PEY-DEMO-NO-PAYMENT:${attempt.id}:${amount}`} title="QR de demostración, no válido para pagos" marginSize={0} /> : <ScanLine className="size-20 text-muted-foreground/30" strokeWidth={1} />}
    </div>
    <p className="mt-3 font-mono text-xs text-primary" aria-label="Vigencia del QR"><Clock3 className="mr-1 inline size-3.5" /> {paid ? "Pago confirmado" : active ? `${minutes}:${remainder}` : attempt ? "Solicitud cerrada" : "Sin solicitud de pago"}</p>
    <p className="mt-1 text-[11px] text-muted-foreground">No válido para CoDi ni pagos reales</p>
    <Button variant="outline" className="mt-4 w-full" disabled={!active || busy} onClick={onOpen}>Abrir banco simulado · {money(amount)}</Button>
  </div>;
}