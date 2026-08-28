# Supabase backend

Backend único del producto: Auth, Postgres, RLS, Realtime y Edge Function `lead-intake`.

## Migraciones

El historial autoritativo está en `migrations/` y se aplica en orden por timestamp:

```powershell
npx.cmd supabase link --project-ref PROJECT_REF
npx.cmd supabase migration list --linked
npx.cmd supabase db push --linked --dry-run
npx.cmd supabase db push --linked
```

Nunca ejecutar `db reset --linked` contra un proyecto con datos.

## Edge Function

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son variables reservadas del runtime. Configurar el salt privado sin guardarlo en Git:

```powershell
npx.cmd supabase secrets set FORM_HASH_SALT=REEMPLAZAR_SALT_LARGO --project-ref PROJECT_REF
npx.cmd supabase functions deploy lead-intake --no-verify-jwt --project-ref PROJECT_REF
```

`verify_jwt=false` es intencional para formularios públicos. La función valida token, origin, consentimiento, honeypot, tipos, longitudes y rate limits atómicos antes de ejecutar una RPC transaccional. La migración `20260828120000_harden_public_intake_rate_limit.sql` debe aplicarse antes de desplegar esta versión de la función.

## Formularios multi-landing

Cada landing se registra en `public.clinic_public_forms`:

```sql
insert into public.clinic_public_forms (
  clinic_id, clinic_slug, public_token, landing_url, allowed_origins, is_active
) values (
  'CLINIC_ID_REAL',
  'clinica-demo',
  'lf_REEMPLAZAR_TOKEN_LARGO_SEGURO_1234567890',
  'https://landing.example.com',
  array['https://landing.example.com', 'http://localhost:5173'],
  true
);
```

La landing envía `clinic_slug`, `landing_token`, datos comerciales y consentimiento. La función resuelve el `clinic_id` real; cualquier `clinic_id`, `lead_id`, appointment, quote o assignee enviado por el navegador se rechaza.

## Seguridad

- RLS permanece activo en tablas expuestas.
- El frontend usa únicamente publishable/anon key.
- `service_role` y `FORM_HASH_SALT` nunca se publican en Vite, Vercel o landings.
- Las RPC autenticadas derivan clínica y rol desde `profiles` y `auth.uid()`.
