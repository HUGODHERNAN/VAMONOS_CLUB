# Backend Supabase + PostGIS — Vámonos Club Arequipa

Esta carpeta contiene el esquema SQL listo para producción (PostgreSQL + PostGIS + Auth OTP + RLS).

## Pasos para activar el backend real

1. Crea un proyecto gratuito en [Supabase](https://supabase.com/).
2. Abre **SQL Editor -> New Query**, pega y ejecuta en orden:
   1. `supabase/migrations/001_initial_schema.sql`
   2. `supabase/migrations/002_fase3_realtime_helpers.sql`
   3. `supabase/migrations/003_security_hardening.sql`
   4. `supabase/migrations/004_phone_password_auth.sql`
3. En **Authentication -> Sign In / Providers -> Email**:
   - Mantén activado **Enable Email provider** y **Confirm email**.
   - El sistema usa **Correo + Contraseña** y envía un enlace de confirmación por correo solo al crear cuenta (funciona sin SMTP externo).
4. En **Database -> Replication** (Realtime), activa la publicación en tiempo real para las tablas:
   - `match_requests`
   - `trips`
   - `chat_messages`
5. Copia tu **Project URL** y **anon public key** (Project Settings -> API) en `src/config/supabaseConfig.js`.

Mientras `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén vacíos, la app funcionará automáticamente en **Modo Demo Local** sin errores.

