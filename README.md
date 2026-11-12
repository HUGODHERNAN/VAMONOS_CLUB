# Vámonos Club — Taxi Compartido en Arequipa (PWA)

Aplicación web progresiva (PWA) *mobile-first* para coordinar taxis compartidos (Uber / InDrive) entre estudiantes universitarios y vecinos verificados en Arequipa.

## Características Principales
- **Verificación Universitaria:** Insignia automática (`@utp.edu.pe`, `@unsa.edu.pe`, `@ucsm.edu.pe`, `@ucsp.edu.pe`, `@ulasalle.edu.pe`) vía OTP de 6 dígitos en Supabase Auth.
- **Mapa Interactivo y Ruteo Real por Calles:** Selección libre escribiendo direcciones (nodos locales + Nominatim Arequipa), tocando el mapa, arrastrando pines A/B o usando GPS con **radio privado de 250 m** y rutas reales vía **OSRM**.
- **Seguridad en Tiempo Real:** Filtro *Solo Mujeres Verificadas*, solicitudes mutuas de 60s, chat efímero de 15 min, tolerancia *No-Show* de 5 min validada en servidor, respaldo por WhatsApp con enlace de viaje + GPS y botón SOS (105 / Serenazgo).
- **Instalable (PWA):** Service Worker offline-ready, alertas sonoras/notificaciones y manifiesto instalable en Android y iOS.

## Probar en Local (Sin Dependencias de Build)
```powershell
python -m http.server 8123 --bind 127.0.0.1 -d "c:\Users\User\Desktop\ANTIYGRAVITY\VAMONOS"
```
- App: `http://127.0.0.1:8123/`
- Pruebas unitarias de dominio: `http://127.0.0.1:8123/tests/index.html`

## Conectar Backend Real (Supabase + PostGIS)
Sigue la guía en [supabase/README.md](supabase/README.md):
1. Ejecuta `supabase/migrations/001_initial_schema.sql` y `supabase/migrations/002_fase3_realtime_helpers.sql` en el SQL Editor de Supabase.
2. Configura `url` y `anonKey` en `src/config/supabaseConfig.js`.

## Despliegue en Producción (HTTPS Obligatorio para PWA y GPS)
Puedes desplegar directamente la carpeta `VAMONOS` como sitio estático en:
- **Vercel:** `vercel --prod` (usa `vercel.json` incluido con cabeceras óptimas para `sw.js` y `manifest.webmanifest`).
- **Cloudflare Pages / Netlify:** Selecciona la raíz `VAMONOS` sin comando de build (`Build command: none`, `Output directory: .`).

