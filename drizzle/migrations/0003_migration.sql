ALTER TABLE public.live_payment_operators ALTER COLUMN bank_account_id DROP NOT NULL;
ALTER TABLE public.live_orders ALTER COLUMN bank_account_id DROP NOT NULL;
CREATE OR REPLACE FUNCTION public.confirm_live_pey_order(p_qr_id text, p_account_id text, p_amount numeric, p_transaction_id text, p_paid_at timestamp with time zone)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE o public.live_orders;
BEGIN
 SELECT * INTO o FROM public.live_orders WHERE provider_qr_id = p_qr_id FOR UPDATE;
 IF NOT FOUND THEN RETURN 'UNMATCHED'; END IF;
 IF o.transaction_id = p_transaction_id AND o.status IN ('READY','REVIEW') THEN RETURN 'DUPLICATE'; END IF;
 IF o.transaction_id IS NOT NULL THEN RETURN 'CONFLICT'; END IF;
 IF (o.bank_account_id IS NOT NULL AND p_account_id IS DISTINCT FROM o.bank_account_id) OR p_amount IS DISTINCT FROM 0.01::numeric OR p_transaction_id IS NULL OR p_paid_at IS NULL THEN RETURN 'INVALID'; END IF;
 IF o.status <> 'PENDING' THEN RETURN 'CONFLICT'; END IF;
 IF p_paid_at > o.expires_at OR p_paid_at < o.created_at - interval '1 minute' THEN
 UPDATE public.live_orders SET status='REVIEW', transaction_id=p_transaction_id, paid_at=p_paid_at WHERE id=o.id;
 RETURN 'REVIEW';
 END IF;
 UPDATE public.live_orders SET status='READY', transaction_id=p_transaction_id, paid_at=p_paid_at WHERE id=o.id;
 RETURN 'READY';
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.confirm_live_pey_order(text,text,numeric,text,timestamptz) FROM PUBLIC, anon, authenticated;