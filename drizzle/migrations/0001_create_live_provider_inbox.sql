CREATE TABLE public.live_provider_events (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 provider text NOT NULL CHECK (provider IN ('pey','kapso')),
 delivery_id text NOT NULL,
 event_type text NOT NULL,
 payload jsonb NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),
 processed_at timestamptz,
 processing_error text,
 UNIQUE(provider, delivery_id)
);
GRANT ALL ON public.live_provider_events TO service_role;
ALTER TABLE public.live_provider_events ENABLE ROW LEVEL SECURITY;
COMMENT ON TABLE public.live_provider_events IS 'Verified real-provider inbox; deliberately isolated from anonymous demo. Only service_role access. Processing not activated until live setup is complete.';
CREATE INDEX live_provider_events_pending ON public.live_provider_events(received_at) WHERE processed_at IS NULL;