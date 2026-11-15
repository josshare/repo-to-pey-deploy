CREATE TABLE public.live_payment_operators (
 user_id uuid PRIMARY KEY,
 bank_account_id text NOT NULL,
 enabled boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.live_payment_operators TO authenticated;
GRANT ALL ON public.live_payment_operators TO service_role;
ALTER TABLE public.live_payment_operators ENABLE ROW LEVEL SECURITY;
CREATE POLICY operator_self_read ON public.live_payment_operators FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE TABLE public.live_orders (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL,
 request_id uuid NOT NULL,
 concept text NOT NULL,
 amount_cents integer NOT NULL DEFAULT 1 CHECK (amount_cents = 1),
 bank_account_id text NOT NULL,
 status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','CREATING','PENDING','READY','REVIEW')),
 provider_qr_id text UNIQUE,
 qr_string text,
 expires_at timestamptz,
 transaction_id text UNIQUE,
 paid_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(owner_id, request_id)
);
GRANT SELECT ON public.live_orders TO authenticated;
GRANT ALL ON public.live_orders TO service_role;
ALTER TABLE public.live_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_orders_read ON public.live_orders FOR SELECT TO authenticated USING (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.live_payment_operators WHERE user_id = auth.uid() AND enabled));
CREATE OR REPLACE FUNCTION public.confirm_live_pey_order(p_qr_id text, p_account_id text, p_amount numeric, p_transaction_id text, p_paid_at timestamptz) RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE o public.live_orders;
BEGIN
 SELECT * INTO o FROM public.live_orders WHERE provider_qr_id = p_qr_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'UNMATCHED'; END IF;
 IF o.transaction_id = p_transaction_id AND o.status IN ('READY','REVIEW') THEN RETURN 'DUPLICATE'; END IF;
 IF o.transaction_id IS NOT NULL THEN RETURN 'CONFLICT'; END IF;
 IF p_account_id IS DISTINCT FROM o.bank_account_id OR p_amount IS DISTINCT FROM 0.01::numeric OR p_transaction_id IS NULL OR p_paid_at IS NULL THEN RETURN 'INVALID'; END IF;
 IF o.status <> 'PENDING' THEN RETURN 'CONFLICT'; END IF;
 IF p_paid_at > o.expires_at OR p_paid_at < o.created_at - interval '1 minute' THEN
 UPDATE public.live_orders SET status='REVIEW', transaction_id=p_transaction_id, paid_at=p_paid_at WHERE id=o.id;
 RETURN 'REVIEW';
 END IF;
 UPDATE public.live_orders SET status='READY', transaction_id=p_transaction_id, paid_at=p_paid_at WHERE id=o.id;
 RETURN 'READY';
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_live_pey_order(text,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_live_pey_order(text,text,numeric,text,timestamptz) TO service_role;