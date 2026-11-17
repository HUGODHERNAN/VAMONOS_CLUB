-- =============================================================================
-- VÁMONOS CLUB AREQUIPA - HABILITAR REALTIME EN RIDE_INTENTS PARA DETECCIÓN INMEDIATA
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'ride_intents'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.ride_intents;
    END IF;
END
$$;
