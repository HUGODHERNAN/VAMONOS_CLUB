-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - MATCHING SIMÉTRICO DE RUTA (IDA Y VUELTA DE PASO)
-- Ejecutar después de 004_phone_password_auth.sql en Supabase SQL Editor
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
    SELECT ri.* INTO v_mine
    FROM public.ride_intents ri
    WHERE ri.id = p_intent_id
      AND ri.user_id = auth.uid();

    IF NOT FOUND OR v_mine.status <> 'searching' OR v_mine.expires_at <= NOW() THEN
        RETURN;
    END IF;

    SELECT p.* INTO v_my_profile FROM public.profiles p WHERE p.id = v_mine.user_id;

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
            WHEN ST_DWithin(v_mine.dest_point, other.dest_point, 1000) THEN 'same'
            ELSE 'route'
        END AS match_type,
        CASE
            WHEN ST_DWithin(v_mine.dest_point, other.dest_point, 1000) THEN 100
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
      -- Origen dentro de radio privado de 1000 m
      AND ST_DWithin(v_mine.origin_point, other.origin_point, 1000)
      -- Mismo destino (1000m) O ruta simétrica (su destino en mi ruta, o mi destino en su ruta dentro de 1000m)
      AND (
          ST_DWithin(v_mine.dest_point, other.dest_point, 1000)
          OR (v_mine.route_polyline IS NOT NULL AND ST_DWithin(v_mine.route_polyline, other.dest_point, 1000))
          OR (other.route_polyline IS NOT NULL AND ST_DWithin(other.route_polyline, v_mine.dest_point, 1000))
      )
      -- Compatibilidad bidireccional de filtro Solo Mujeres
      AND (NOT v_mine.women_only OR p.gender = 'F')
      AND (NOT other.women_only OR v_my_profile.gender = 'F')
    ORDER BY distance_meters ASC
    LIMIT 20;
END;
$$;

