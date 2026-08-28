# Pruebas no productivas de carga y seguridad

Todos los scripts remotos exigen `*_TARGET=staging`, un host exacto y la confirmación `I_ACKNOWLEDGE_STAGING`. Nunca apuntar variables a producción. Los secretos se suministran sólo como variables del proceso y los scripts no imprimen sus valores.

## Fixtures 100 clínicas

```powershell
psql $env:STAGING_DATABASE_URL -v ON_ERROR_STOP=1 `
  -v confirm_non_production=YES `
  -v load_origin=https://load-staging.example.test `
  -f tests/load/setup-load-fixtures.sql
```

El script crea/actualiza únicamente IDs QA determinísticos y no borra datos. Cada clínica tiene owner, receptionist y public form.

## Intake multi-tenant 10/20/50/100

Configurar en la sesión, sin archivo versionado:

```text
LOAD_EDGE_URL
LOAD_SUPABASE_URL
LOAD_SERVICE_ROLE_KEY
LOAD_ORIGIN
LOAD_ALLOWED_HOST
LOAD_TARGET=staging
LOAD_CONFIRM_NON_PRODUCTION=I_ACKNOWLEDGE_STAGING
LOAD_SCENARIOS=10,20,50,100
LOAD_PER_CLINIC=1
```

Luego ejecutar `node tests/load/multitenant-load.mjs`. El resultado incluye total, success rate, errors, p50/p95/p99, filas DB, cross-tenant y duplicados. Falla si no hay exactamente una oportunidad en la clínica esperada por request.

## Abuso 10/50/100/500 y replay

Usa las fixtures anteriores. Configurar las variables equivalentes con prefijo `ABUSE_` y ejecutar:

```powershell
node tests/security/intake-abuse-load.mjs
```

Prueba tokens/origins inválidos, JSON/tipos/tamaños, XSS/HTML/SQL-like/Unicode/URLs/comillas, routing IDs prohibidos, 10 requests idénticas y bursts hasta 500. Verifica DB con service role sólo desde el runner QA.

## Realtime 10/25/50/100

Configurar `REALTIME_SUPABASE_URL`, anon key, credenciales de un usuario QA de Clinic A, su form, otro form/clinic ID de Clinic B, origins, host/target/confirmación. Ejecutar:

```powershell
node tests/security/realtime-capacity.mjs
```

Cada cliente simula una pestaña con un WebSocket, un channel y cuatro bindings. Se exige un evento por sesión para Clinic A y cero eventos de Clinic B para el usuario A.

## Volumen 10k/50k/100k

```powershell
psql $env:STAGING_DATABASE_URL -v ON_ERROR_STOP=1 `
  -v confirm_non_production=YES -v lead_count=10000 -v clinic_count=10 `
  -f tests/load/data-volume-benchmark.sql
```

Repetir con 50.000 y 100.000. Sólo crea tablas TEMP; reporta EXPLAIN/ANALYZE y un modelo de bytes por oportunidad. Complementar con `tests/capacity/storage-estimate.sql` sobre datos representativos y guardar outputs fechados fuera de Git si contienen información operativa.
