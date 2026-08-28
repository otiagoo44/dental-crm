# Dental CRM

CRM odontológico multi-clínica separado de cualquier landing comercial.

## Arquitectura

```text
CRM React/Vite
  -> Supabase Auth + Postgres + RLS + Realtime
  -> Edge Functions
  <- Landings externas por lead-intake público
```

Supabase es el único backend. Cada landing usa `clinic_slug`, `landing_token` y un origin registrado; los identificadores de tenant o entidades enviados por el navegador se rechazan y la clínica se resuelve server-side.

## Estructura

```text
dental-crm/
  crm-app/
  supabase/
    functions/lead-intake/
    migrations/
    config.toml
  tests/
  docs/
```

## Desarrollo

```powershell
cd crm-app
npm install
npm run dev
```

Crear `crm-app/.env.local` desde `.env.example`:

```env
VITE_SUPABASE_URL=https://PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_xxx
```

La URL de `lead-intake` se deriva del mismo proyecto. Nunca poner `SUPABASE_SERVICE_ROLE_KEY`, `FORM_HASH_SALT` ni otras claves privadas en Vite o Vercel.

## Verificación

```powershell
cd crm-app
npm test
npm run build
```

## Supabase

```powershell
npx.cmd supabase link --project-ref PROJECT_REF
npx.cmd supabase db push --linked --dry-run
npx.cmd supabase db push --linked
npx.cmd supabase functions deploy lead-intake --no-verify-jwt --project-ref PROJECT_REF
```

Configurar `FORM_HASH_SALT` sólo como secret de Edge Functions. `lead-intake` valida formulario, token, origin, consentimiento, honeypot, estructura/tamaño y un rate limit atómico antes de ejecutar la RPC transaccional.

Para agregar otra landing, registrar una fila activa en `clinic_public_forms` con la clínica, slug, token y origins permitidos. No se modifica la Edge Function.

## Vercel

- Root Directory: `crm-app`
- Framework: `Vite`
- Install Command: `npm install`
- Build Command: `npm run build`
- Output Directory: `dist`
- Variables: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

`crm-app/vercel.json` incluye el fallback SPA y mantiene `build.sourcemap: false`.

Para incorporar una clínica real, usar [docs/FIRST_CLINIC_ONBOARDING.md](docs/FIRST_CLINIC_ONBOARDING.md).

La auditoría final y sus procedimientos están en `docs/SECURITY_ARCHITECTURE_AUDIT.md`, `docs/CAPACITY_AND_SCALING.md`, `docs/BACKUP_AND_RECOVERY.md` y `docs/FIRST_CLIENT_MONITORING.md`.
