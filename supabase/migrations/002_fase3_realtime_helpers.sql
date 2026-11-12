-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - FASE 3: REALTIME, INICIO DE VIAJE Y ENCUESTAS CLOUD
-- Ejecutar después de 001_initial_schema.sql en Supabase SQL Editor
-- =============================================================================

-- 1. Habilitar Realtime para match_requests, trips y chat_messages
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'match_requests'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.match_requests;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trips'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
    END IF;
END
$$;

-- 2. RPC: Confirmar encuentro ("¡YA NOS VIMOS!") e imponer encuesta obligatoria a ambos
CREATE OR REPLACE FUNCTION public.start_trip_ride(p_trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip public.trips%ROWTYPE;
BEGIN
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
      AND status IN ('coordinating', 'in_progress')
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Viaje no encontrado o no autorizado';
    END IF;

    IF v_trip.status = 'coordinating' THEN
        UPDATE public.trips
        SET status = 'in_progress',
            started_at = NOW()
        WHERE id = v_trip.id;

        UPDATE public.profiles
        SET pending_survey_trip_id = v_trip.id,
            updated_at = NOW()
        WHERE id IN (v_trip.user_a_id, v_trip.user_b_id);
    END IF;
END;
$$;

-- 3. RPC: Cancelar sala de coordinación activa
CREATE OR REPLACE FUNCTION public.cancel_active_trip(p_trip_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    UPDATE public.trips
    SET status = 'cancelled',
        ended_at = NOW()
    WHERE id = p_trip_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
      AND status = 'coordinating';
END;
$$;

-- 4. RPC: Obtener datos de la encuesta pendiente al recargar la página
CREATE OR REPLACE FUNCTION public.get_pending_survey_details()
RETURNS TABLE (
    trip_id UUID,
    partner_id UUID,
    partner_name TEXT,
    partner_uni TEXT,
    origin_name TEXT,
    dest_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_pending_trip_id UUID;
    v_trip public.trips%ROWTYPE;
    v_partner_id UUID;
BEGIN
    SELECT pending_survey_trip_id INTO v_pending_trip_id
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_pending_trip_id IS NULL THEN
        RETURN;
    END IF;

    SELECT * INTO v_trip FROM public.trips WHERE id = v_pending_trip_id;
    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_partner_id := CASE WHEN v_trip.user_a_id = auth.uid() THEN v_trip.user_b_id ELSE v_trip.user_a_id END;

    RETURN QUERY
    SELECT
        v_trip.id,
        p.id,
        p.short_name,
        p.uni_code,
        v_trip.origin_name,
        v_trip.dest_name
    FROM public.profiles p
    WHERE p.id = v_partner_id;
END;
$$;

-- 5. RPC: Obtener datos públicos de una solicitud entrante para el modal en tiempo real
CREATE OR REPLACE FUNCTION public.get_incoming_request_details(p_request_id UUID)
RETURNS TABLE (
    request_id UUID,
    requester_id UUID,
    requester_name TEXT,
    requester_uni TEXT,
    requester_rating NUMERIC,
    requester_punctuality INTEGER,
    origin_name TEXT,
    dest_name TEXT,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        mr.id,
        p.id,
        p.short_name,
        p.uni_code,
        p.rating_avg,
        p.punctuality_pct,
        ri.origin_name,
        ri.dest_name,
        mr.expires_at
    FROM public.match_requests mr
    JOIN public.profiles p ON p.id = mr.requester_id
    JOIN public.ride_intents ri ON ri.id = mr.requester_intent_id
    WHERE mr.id = p_request_id
      AND mr.target_id = auth.uid()
      AND mr.status = 'pending'
      AND mr.expires_at > NOW();
END;
$$;

