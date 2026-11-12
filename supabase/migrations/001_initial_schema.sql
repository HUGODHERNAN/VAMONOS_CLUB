-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - ESQUEMA INICIAL SUPABASE + POSTGIS
-- Ejecutar en Supabase SQL Editor (Project -> SQL Editor -> New Query)
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. TABLA DE PERFILES (Sincronizada con auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    short_name TEXT NOT NULL CHECK (char_length(trim(short_name)) >= 2),
    gender CHAR(1) NOT NULL CHECK (gender IN ('M', 'F')),
    email TEXT UNIQUE,
    uni_code TEXT NOT NULL DEFAULT 'AQP',
    uni_verified BOOLEAN NOT NULL DEFAULT FALSE,
    rating_avg NUMERIC(3, 2) NOT NULL DEFAULT 5.00,
    punctuality_pct INTEGER NOT NULL DEFAULT 100 CHECK (punctuality_pct BETWEEN 0 AND 100),
    trips_count INTEGER NOT NULL DEFAULT 0 CHECK (trips_count >= 0),
    pending_survey_trip_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. INTENCIONES DE VIAJE (RADAR ACTIVO CON PRIVACIDAD 250M)
CREATE TABLE IF NOT EXISTS public.ride_intents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    origin_key TEXT NOT NULL,
    dest_key TEXT NOT NULL,
    origin_name TEXT NOT NULL,
    dest_name TEXT NOT NULL,
    origin_point GEOGRAPHY(Point, 4326) NOT NULL,
    dest_point GEOGRAPHY(Point, 4326) NOT NULL,
    route_polyline GEOGRAPHY(LineString, 4326),
    departure_window TEXT NOT NULL CHECK (departure_window IN ('AHORA', '10 MIN', '20 MIN')),
    payment_method TEXT NOT NULL CHECK (payment_method IN ('YAPE / PLIN', 'EFECTIVO')),
    women_only BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'searching' CHECK (status IN ('searching', 'matched', 'cancelled', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '25 minutes'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ride_intents_origin_geo ON public.ride_intents USING GIST (origin_point);
CREATE INDEX IF NOT EXISTS idx_ride_intents_dest_geo ON public.ride_intents USING GIST (dest_point);
CREATE INDEX IF NOT EXISTS idx_ride_intents_route_geo ON public.ride_intents USING GIST (route_polyline);
CREATE INDEX IF NOT EXISTS idx_ride_intents_active ON public.ride_intents (status, expires_at);

-- 3. SOLICITUDES DE MATCH (VENTANA DE 60 SEGUNDOS)
CREATE TABLE IF NOT EXISTS public.match_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    requester_intent_id UUID NOT NULL REFERENCES public.ride_intents(id) ON DELETE CASCADE,
    target_intent_id UUID NOT NULL REFERENCES public.ride_intents(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '60 seconds'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CHECK (requester_id <> target_id)
);

-- 4. VIAJES Y SALAS DE COORDINACIÓN EFÍMERAS (15 MIN CHAT / 5 MIN NO-SHOW)
CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_b_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    origin_name TEXT NOT NULL,
    dest_name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'coordinating' CHECK (status IN ('coordinating', 'in_progress', 'completed', 'cancelled', 'no_show')),
    chat_expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
    noshow_unlock_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK diferida para encuesta pendiente obligatoria
ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS fk_profiles_pending_trip;
ALTER TABLE public.profiles
    ADD CONSTRAINT fk_profiles_pending_trip
    FOREIGN KEY (pending_survey_trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;

-- 5. MENSAJES DEL CHAT EFÍMERO
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_trip ON public.chat_messages (trip_id, created_at);

-- 6. ENCUESTAS / RESEÑAS POST-VIAJE
CREATE TABLE IF NOT EXISTS public.trip_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    stars INTEGER NOT NULL CHECK (stars BETWEEN 1 AND 5),
    comment TEXT DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (trip_id, reviewer_id)
);

-- =============================================================================
-- FUNCIONES Y TRIGGERS DE SEGURIDAD EN SERVIDOR
-- =============================================================================

CREATE OR REPLACE FUNCTION public.resolve_arequipa_uni(p_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_lower TEXT := lower(trim(coalesce(p_email, '')));
BEGIN
    IF v_lower LIKE '%@utp.edu.pe' THEN RETURN 'UTP'; END IF;
    IF v_lower LIKE '%@unsa.edu.pe' THEN RETURN 'UNSA'; END IF;
    IF v_lower LIKE '%@ucsm.edu.pe' THEN RETURN 'UCSM'; END IF;
    IF v_lower LIKE '%@ucsp.edu.pe' THEN RETURN 'UCSP'; END IF;
    IF v_lower LIKE '%@ulasalle.edu.pe' THEN RETURN 'ULASALLE'; END IF;
    IF v_lower LIKE '%@senati.pe' THEN RETURN 'SENATI'; END IF;
    IF v_lower LIKE '%@tecsup.edu.pe' THEN RETURN 'TECSUP'; END IF;
    IF v_lower LIKE '%@usmp.pe' THEN RETURN 'USMP'; END IF;
    RETURN 'AQP';
END;
$$;

-- Crear/actualizar perfil automáticamente cuando auth.users verifica su correo OTP
CREATE OR REPLACE FUNCTION public.handle_auth_user_verified()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_uni TEXT := public.resolve_arequipa_uni(NEW.email);
    v_verified BOOLEAN := (NEW.email_confirmed_at IS NOT NULL AND v_uni <> 'AQP');
    v_name TEXT := coalesce(
        NULLIF(trim(NEW.raw_user_meta_data ->> 'short_name'), ''),
        initcap(split_part(coalesce(NEW.email, 'Pasajero'), '@', 1))
    );
    v_gender CHAR(1) := CASE
        WHEN (NEW.raw_user_meta_data ->> 'gender') = 'M' THEN 'M'
        ELSE 'F'
    END;
BEGIN
    INSERT INTO public.profiles (id, short_name, gender, email, uni_code, uni_verified)
    VALUES (NEW.id, v_name, v_gender, NEW.email, v_uni, v_verified)
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        uni_code = EXCLUDED.uni_code,
        uni_verified = EXCLUDED.uni_verified,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_verified ON auth.users;
CREATE TRIGGER trg_auth_user_verified
    AFTER INSERT OR UPDATE OF email, email_confirmed_at ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_auth_user_verified();

-- Regla: bloquear búsqueda si hay encuesta pendiente y restringir women_only a género F
CREATE OR REPLACE FUNCTION public.enforce_ride_intent_rules()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_profile public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_profile FROM public.profiles WHERE id = NEW.user_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Perfil no encontrado';
    END IF;

    IF v_profile.pending_survey_trip_id IS NOT NULL THEN
        RAISE EXCEPTION 'Debes completar la encuesta de tu viaje pendiente antes de buscar otro';
    END IF;

    IF NEW.women_only AND v_profile.gender <> 'F' THEN
        RAISE EXCEPTION 'El filtro Solo Mujeres es exclusivo para pasajeras registradas como Femenino';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_ride_intent_rules ON public.ride_intents;
CREATE TRIGGER trg_enforce_ride_intent_rules
    BEFORE INSERT ON public.ride_intents
    FOR EACH ROW EXECUTE FUNCTION public.enforce_ride_intent_rules();

-- Recalcular reputación y liberar encuesta pendiente al enviar reseña
CREATE OR REPLACE FUNCTION public.handle_trip_review_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_avg NUMERIC(3, 2);
BEGIN
    SELECT round(avg(stars)::numeric, 2) INTO v_avg
    FROM public.trip_reviews
    WHERE reviewed_id = NEW.reviewed_id;

    UPDATE public.profiles
    SET rating_avg = coalesce(v_avg, 5.00),
        trips_count = trips_count + 1,
        updated_at = NOW()
    WHERE id = NEW.reviewed_id;

    UPDATE public.profiles
    SET pending_survey_trip_id = NULL,
        updated_at = NOW()
    WHERE id = NEW.reviewer_id
      AND pending_survey_trip_id = NEW.trip_id;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_trip_review_inserted ON public.trip_reviews;
CREATE TRIGGER trg_trip_review_inserted
    AFTER INSERT ON public.trip_reviews
    FOR EACH ROW EXECUTE FUNCTION public.handle_trip_review_inserted();

-- =============================================================================
-- RPC: MOTOR DE MATCHING GEOESPACIAL (PRIVACIDAD 250M + RUTA EN TU CAMINO)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.find_matching_rides(p_intent_id UUID)
RETURNS TABLE (
    intent_id UUID,
    user_id UUID,
    short_name TEXT,
    gender CHAR(1),
    uni_code TEXT,
    uni_verified BOOLEAN,
    rating_avg NUMERIC,
    punctuality_pct INTEGER,
    trips_count INTEGER,
    distance_meters INTEGER,
    match_type TEXT,
    shared_percent INTEGER,
    dest_name TEXT,
    departure_window TEXT,
    payment_method TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_mine public.ride_intents%ROWTYPE;
    v_my_profile public.profiles%ROWTYPE;
BEGIN
    SELECT * INTO v_mine FROM public.ride_intents WHERE id = p_intent_id;
    IF NOT FOUND THEN RETURN; END IF;

    SELECT * INTO v_my_profile FROM public.profiles WHERE id = v_mine.user_id;

    RETURN QUERY
    SELECT
        other.id AS intent_id,
        p.id AS user_id,
        p.short_name,
        p.gender,
        p.uni_code,
        p.uni_verified,
        p.rating_avg,
        p.punctuality_pct,
        p.trips_count,
        -- Redondeado a múltiplos de 10m para proteger privacidad exacta
        (round(ST_Distance(v_mine.origin_point, other.origin_point) / 10.0) * 10)::INTEGER AS distance_meters,
        CASE
            WHEN ST_DWithin(v_mine.dest_point, other.dest_point, 450) THEN 'same'
            ELSE 'route'
        END AS match_type,
        CASE
            WHEN ST_DWithin(v_mine.dest_point, other.dest_point, 450) THEN 100
            ELSE 65
        END AS shared_percent,
        other.dest_name,
        other.departure_window,
        other.payment_method
    FROM public.ride_intents other
    JOIN public.profiles p ON p.id = other.user_id
    WHERE other.id <> v_mine.id
      AND other.user_id <> v_mine.user_id
      AND other.status = 'searching'
      AND other.expires_at > NOW()
      -- Origen dentro de radio privado de 250 m
      AND ST_DWithin(v_mine.origin_point, other.origin_point, 250)
      -- Mismo destino (450m) O destino del compañero cercano a mi polilínea vial (350m)
      AND (
          ST_DWithin(v_mine.dest_point, other.dest_point, 450)
          OR (v_mine.route_polyline IS NOT NULL AND ST_DWithin(v_mine.route_polyline, other.dest_point, 350))
      )
      -- Compatibilidad bidireccional de filtro Solo Mujeres
      AND (NOT v_mine.women_only OR p.gender = 'F')
      AND (NOT other.women_only OR v_my_profile.gender = 'F')
    ORDER BY distance_meters ASC
    LIMIT 20;
END;
$$;

-- RPC: Aceptar solicitud de match atómicamente y abrir sala de chat de 15m
CREATE OR REPLACE FUNCTION public.accept_match_request(p_request_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_req public.match_requests%ROWTYPE;
    v_intent_a public.ride_intents%ROWTYPE;
    v_trip_id UUID;
BEGIN
    SELECT * INTO v_req
    FROM public.match_requests
    WHERE id = p_request_id
      AND target_id = auth.uid()
      AND status = 'pending'
      AND expires_at > NOW()
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'La solicitud expiró o no está disponible';
    END IF;

    SELECT * INTO v_intent_a FROM public.ride_intents WHERE id = v_req.requester_intent_id;

    UPDATE public.match_requests SET status = 'accepted' WHERE id = v_req.id;
    UPDATE public.ride_intents
    SET status = 'matched'
    WHERE id IN (v_req.requester_intent_id, v_req.target_intent_id);

    INSERT INTO public.trips (user_a_id, user_b_id, origin_name, dest_name)
    VALUES (v_req.requester_id, v_req.target_id, v_intent_a.origin_name, v_intent_a.dest_name)
    RETURNING id INTO v_trip_id;

    RETURN v_trip_id;
END;
$$;

-- RPC: Reportar No-Show validando los 5 minutos en reloj del servidor
CREATE OR REPLACE FUNCTION public.report_trip_noshow(p_trip_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip public.trips%ROWTYPE;
    v_offender_id UUID;
    v_new_pct INTEGER;
BEGIN
    SELECT * INTO v_trip
    FROM public.trips
    WHERE id = p_trip_id
      AND (user_a_id = auth.uid() OR user_b_id = auth.uid())
      AND status = 'coordinating'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Viaje no encontrado o ya cerrado';
    END IF;

    IF NOW() < v_trip.noshow_unlock_at THEN
        RAISE EXCEPTION 'Debes esperar 5 minutos de tolerancia antes de reportar No-Show';
    END IF;

    v_offender_id := CASE WHEN v_trip.user_a_id = auth.uid() THEN v_trip.user_b_id ELSE v_trip.user_a_id END;

    UPDATE public.trips
    SET status = 'no_show', ended_at = NOW()
    WHERE id = v_trip.id;

    UPDATE public.profiles
    SET punctuality_pct = GREATEST(0, punctuality_pct - 15),
        updated_at = NOW()
    WHERE id = v_offender_id
    RETURNING punctuality_pct INTO v_new_pct;

    RETURN v_new_pct;
END;
$$;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ride_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trip_reviews ENABLE ROW LEVEL SECURITY;

-- Perfiles: lectura pública mínima para usuarios autenticados, edición solo propia (sin alterar uni_verified)
CREATE POLICY "profiles_select_authenticated" ON public.profiles
    FOR SELECT TO authenticated USING (true);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Intenciones de viaje: cada usuario gestiona las suyas; el radar consulta vía RPC segura
CREATE POLICY "ride_intents_own_all" ON public.ride_intents
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Solicitudes de match: visibles para solicitante y destinatario
CREATE POLICY "match_requests_participants" ON public.match_requests
    FOR SELECT TO authenticated
    USING (auth.uid() IN (requester_id, target_id));

CREATE POLICY "match_requests_insert_own" ON public.match_requests
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "match_requests_update_participants" ON public.match_requests
    FOR UPDATE TO authenticated
    USING (auth.uid() IN (requester_id, target_id));

-- Viajes: solo participantes
CREATE POLICY "trips_participants" ON public.trips
    FOR SELECT TO authenticated
    USING (auth.uid() IN (user_a_id, user_b_id));

CREATE POLICY "trips_update_participants" ON public.trips
    FOR UPDATE TO authenticated
    USING (auth.uid() IN (user_a_id, user_b_id));

-- Mensajes de chat: solo participantes del viaje mientras no haya expirado
CREATE POLICY "chat_messages_participants" ON public.chat_messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = trip_id AND auth.uid() IN (t.user_a_id, t.user_b_id)
        )
    );

CREATE POLICY "chat_messages_insert_participants" ON public.chat_messages
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = sender_id
        AND EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = trip_id
              AND auth.uid() IN (t.user_a_id, t.user_b_id)
              AND t.status = 'coordinating'
              AND t.chat_expires_at > NOW()
        )
    );

-- Reseñas: solo participantes del viaje
CREATE POLICY "trip_reviews_insert_own" ON public.trip_reviews
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = reviewer_id
        AND EXISTS (
            SELECT 1 FROM public.trips t
            WHERE t.id = trip_id AND auth.uid() IN (t.user_a_id, t.user_b_id)
        )
    );

