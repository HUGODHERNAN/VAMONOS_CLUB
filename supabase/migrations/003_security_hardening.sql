-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - ENDURECIMIENTO DE SEGURIDAD (RLS + COLUMNAS PROTEGIDAS)
-- Ejecutar después de 002_fase3_realtime_helpers.sql en Supabase SQL Editor
-- =============================================================================

-- 1. Restringir lectura directa de profiles solo al dueño (protege correos electrónicos)
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = id);

-- 2. Impedir que el cliente modifique columnas sensibles desde consola (uni_verified, puntaje, encuestas)
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (short_name) ON public.profiles TO authenticated;

-- 3. Evitar que el cliente altere trips directamente fuera de los RPCs validados
DROP POLICY IF EXISTS "trips_update_participants" ON public.trips;

-- 4. RPC seguro para obtener datos públicos del compañero al abrir un viaje Realtime (sin exponer email)
CREATE OR REPLACE FUNCTION public.get_trip_partner_profile(p_trip_id UUID)
RETURNS TABLE (
    id UUID,
    short_name TEXT,
    uni_code TEXT,
    rating_avg NUMERIC,
    trips_count INTEGER,
    punctuality_pct INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_trip public.trips%ROWTYPE;
    v_partner_id UUID;
BEGIN
    SELECT * INTO v_trip
    FROM public.trips
    WHERE public.trips.id = p_trip_id
      AND auth.uid() IN (user_a_id, user_b_id);

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_partner_id := CASE WHEN v_trip.user_a_id = auth.uid() THEN v_trip.user_b_id ELSE v_trip.user_a_id END;

    RETURN QUERY
    SELECT
        p.id,
        p.short_name,
        p.uni_code,
        p.rating_avg,
        p.trips_count,
        p.punctuality_pct
    FROM public.profiles p
    WHERE p.id = v_partner_id;
END;
$$;

