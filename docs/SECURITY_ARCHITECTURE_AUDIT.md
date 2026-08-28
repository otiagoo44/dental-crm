# Arquitectura y seguridad auditadas

Estado del código revisado el 28 de agosto de 2026. Este documento describe el flujo real del repositorio, no una arquitectura supuesta.

## Flujo real

```text
Landing externa / formulario embebido
  -> POST HTTPS con clinic_slug + landing_token + datos + consentimiento
  -> Edge Function lead-intake (sin JWT de usuario)
  -> clinic_public_forms: resuelve form_id + clinic_id y valida origin exacto
  -> validación de forma/tamaño/teléfono/honeypot + rate limit atómico
  -> RPC create_public_lead_intake_v2 (sólo service_role)
  -> vuelve a validar form_id + slug + token y toma clinic_id de la fila
  -> transacción Postgres: lead + task + event + audit + automation + log
  -> RLS por auth.uid() -> profiles.clinic_id para usuarios CRM
  -> Realtime filtra clinic_id y vuelve a aplicar RLS al suscriptor
  -> una pestaña de la clínica recibe el cambio y refresca su workspace
```

## Resolución de clínica

La relación pública vive en `public.clinic_public_forms`: `id`, `clinic_id`, `clinic_slug`, `public_token`, `allowed_origins`, `is_active`. `lead-intake` busca una fila activa por `clinic_slug + public_token`; luego exige que el `Origin` del POST esté dentro de `allowed_origins` de esa misma fila. La RPC repite la validación por `form_id + slug + token` y usa exclusivamente `form_record.clinic_id`.

El navegador no puede elegir el tenant. Los campos `clinic_id`, `lead_id`, `appointment`, `appointment_id`, `quote`, `quote_id` y `assigned_to` están prohibidos en el payload público y producen HTTP 400. Aun sin esa validación HTTP, la RPC no recibe `clinic_id`, sólo puede ejecutarla `service_role` y las relaciones de tasks, appointments y quotes tienen claves foráneas compuestas con `clinic_id`.

## CRM, queries y RLS

La CRM obtiene primero `profiles` por el `session.user.id`, toma de ese perfil el `clinic_id` y lo usa como filtro explícito en las queries. Ese filtro mejora intención y rendimiento; no es la frontera de seguridad. RLS resuelve membresía mediante `auth.uid()` y un `profile` activo de la misma clínica. `anon` no tiene privilegios directos en tablas CRM y no puede ejecutar las RPC privadas.

El frontend actual carga en paralelo nueve conjuntos del workspace (`leads`, `appointments`, `tasks`, `quotes`, `lead_events`, `profiles`, `clinic_settings`, `treatment_prices`, `message_templates`). Todos llevan filtro `clinic_id`, excepto el primer lookup de profile por el usuario autenticado, y RLS vuelve a restringirlos.

## Realtime y polling

Cada pestaña autenticada crea un cliente Supabase, un WebSocket y un channel `clinic-workspace:<clinic_id>` con cuatro bindings (`leads`, `appointments`, `tasks`, `quotes`) filtrados por `clinic_id`. Supabase aplica RLS antes de entregar Postgres Changes. El cleanup llama `removeChannel`; `supabase-js` gestiona reconnect.

El fallback consulta cada 25 segundos sólo si Realtime no está `SUBSCRIBED`, la pestaña es visible y el navegador está online. Los refresh concurrentes se coalescen. Cuando Realtime vuelve, el timer permanece pero deja de ejecutar queries. Varias pestañas significan varias conexiones y varios workspaces en memoria.

Riesgo de escala pendiente de medición: cada cambio confirmado provoca la recarga completa de los nueve conjuntos después de 800 ms. No hay paginación ni delta refresh. Es aceptable sólo con datasets pequeños demostrados; 50.000–100.000 oportunidades no pueden declararse soportadas sin ejecutar los benchmarks y reducir esta amplificación si la evidencia lo exige.

## Landing pública

Una landing externa necesita únicamente:

- endpoint HTTPS de `lead-intake`;
- `clinic_slug` y `landing_token` públicos;
- branding y contenido públicos de la clínica.

No necesita `VITE_SUPABASE_ANON_KEY` ni un cliente Supabase si sólo envía el formulario. La CRM sí necesita la URL y la publishable/anon key para Auth, PostgREST y Realtime; esa clave es pública por diseño y su seguridad depende de grants y RLS. `service_role`, password de Postgres, JWT secret, access tokens y secretos administrativos no pertenecen a Vite, Vercel público ni una landing.

El form token es una capacidad limitada de inserción: conocerlo no concede SELECT/UPDATE/DELETE, dashboard, RPC privadas ni acceso a otra clínica. No es un secreto maestro; debe rotarse si se abusa y siempre se combina con origin, validación, rate limit y RLS.

## CORS, abuso y contenido hostil

No se devuelve `Access-Control-Allow-Origin: *`. El preflight sólo refleja un origin presente en al menos un form activo; el POST vuelve a vincular origin con el form exacto. Esto evita cruces accidentales de dominios, pero CORS no autentica clientes no navegador.

El límite es server-side y atómico por formulario: ventana de 10 minutos, máximo 120 submissions válidas por form, 20 por form+IP y 3 por form+teléfono. Una transacción con advisory lock cuenta y reserva el cupo, cerrando la carrera concurrente del mecanismo anterior. IP y teléfono se guardan sólo como hashes con salt privado. Un atacante distribuido todavía puede consumir invocaciones Edge; Turnstile sólo se recomienda si los logs muestran abuso real que atraviesa estos límites.

El cuerpo máximo es 16 KiB UTF-8. Se exige JSON objeto, tipos esperados y longitudes máximas. Arrays, null en campos obligatorios, routing IDs, JSON mal formado y strings sobredimensionados se rechazan antes de escribir dominio. El honeypot y un tiempo opcional de formulario bloquean automatización básica. SQL se envía únicamente como parámetros de RPC; React renderiza texto escapado y no existe `dangerouslySetInnerHTML` en `crm-app/src`.

Las respuestas 500 son genéricas y los logs Edge conservan sólo contexto y código de error, no mensajes SQL. El formulario muestra el mensaje público fijo “No pudimos enviar tus datos. Intentá nuevamente.” ante fallos.

## Evidencia estática

- Secret scan del árbol y los 3 commits disponibles: sin coincidencias de alto nivel de confianza; no se imprimieron valores.
- `npm audit`: 0 vulnerabilidades conocidas (0 critical/high/moderate/low) al 28-08-2026.
- CSP, HSTS, `nosniff`, Referrer Policy, Permissions Policy, `frame-ancestors`/DENY y COOP configurados para la CRM en Vercel.
- Pruebas integradas y carga: requieren staging/local explícito. No se consideran ejecutadas por existir el script.

## Archivos de verificación

- `tests/security/cross-tenant-final.sql`: fixtures A/B/C y aislamiento RLS/RPC, todo con rollback.
- `tests/security/intake-abuse-load.mjs`: payloads hostiles, replay y bursts 10/50/100/500.
- `tests/load/setup-load-fixtures.sql`: 100 clínicas QA sin borrar datos.
- `tests/load/multitenant-load.mjs`: escenarios 10/20/50/100 con verificación DB.
- `tests/security/realtime-capacity.mjs`: 10/25/50/100 sesiones y suscripción cross-tenant.
- `tests/security/integrity-health-check.sql`: health check periódico read-only.
