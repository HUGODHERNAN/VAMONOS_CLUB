-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - SOPORTE COMPLETO GOOGLE OAUTH
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- Actualizar función de trigger para extraer nombre completo y avatar de Google OAuth
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
        NULLIF(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
        NULLIF(trim(NEW.raw_user_meta_data ->> 'name'), ''),
        initcap(split_part(coalesce(NEW.email, 'Pasajero'), '@', 1))
    );
    v_gender CHAR(1) := CASE
        WHEN (NEW.raw_user_meta_data ->> 'gender') = 'M' THEN 'M'
        ELSE 'F'
    END;
    v_phone TEXT := public.normalize_peru_phone(NEW.raw_user_meta_data ->> 'phone');
BEGIN
    INSERT INTO public.profiles (id, short_name, gender, phone, email, uni_code, uni_verified)
    VALUES (NEW.id, v_name, v_gender, v_phone, NEW.email, v_uni, v_verified)
    ON CONFLICT (id) DO UPDATE SET
        short_name = coalesce(NULLIF(public.profiles.short_name, ''), EXCLUDED.short_name),
        phone = coalesce(EXCLUDED.phone, public.profiles.phone),
        email = EXCLUDED.email,
        uni_code = EXCLUDED.uni_code,
        uni_verified = EXCLUDED.uni_verified,
        updated_at = NOW();
    RETURN NEW;
END;
$$;
