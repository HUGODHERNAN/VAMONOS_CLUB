-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - TELÉFONO PRIVADO EN PERFIL + AUTH CON CONTRASEÑA
-- Ejecutar después de 003_security_hardening.sql en Supabase SQL Editor
-- =============================================================================

-- 1. Agregar columna privada de teléfono/WhatsApp en profiles (nunca expuesta en RPCs públicos)
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS phone TEXT;

-- Función auxiliar para normalizar celulares peruanos (acepta 9 dígitos o +51 9 dígitos)
CREATE OR REPLACE FUNCTION public.normalize_peru_phone(p_raw TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
    v_digits TEXT := regexp_replace(coalesce(p_raw, ''), '[^0-9]', '', 'g');
BEGIN
    IF v_digits = '' THEN
        RETURN NULL;
    END IF;
    IF length(v_digits) = 11 AND left(v_digits, 3) = '519' THEN
        v_digits := substr(v_digits, 3);
    END IF;
    RETURN v_digits;
END;
$$;

ALTER TABLE public.profiles
    DROP CONSTRAINT IF EXISTS profiles_phone_format_check;

ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_phone_format_check
    CHECK (phone IS NULL OR phone ~ '^9[0-9]{8}$');

-- 2. Actualizar trigger de auth.users para guardar teléfono privado en el registro
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
    v_phone TEXT := public.normalize_peru_phone(NEW.raw_user_meta_data ->> 'phone');
BEGIN
    INSERT INTO public.profiles (id, short_name, gender, phone, email, uni_code, uni_verified)
    VALUES (NEW.id, v_name, v_gender, v_phone, NEW.email, v_uni, v_verified)
    ON CONFLICT (id) DO UPDATE SET
        phone = coalesce(EXCLUDED.phone, public.profiles.phone),
        email = EXCLUDED.email,
        uni_code = EXCLUDED.uni_code,
        uni_verified = EXCLUDED.uni_verified,
        updated_at = NOW();
    RETURN NEW;
END;
$$;

