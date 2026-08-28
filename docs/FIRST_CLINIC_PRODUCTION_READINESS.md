# FIRST CLINIC PRODUCTION READINESS

Fecha de corte: 28-08-2026.

## Estado

BLOCKED

El código y los contratos locales pasan, pero no existe acceso local/staging en este checkout para ejecutar migraciones, SQL transaccional, HTTP real, Realtime o carga. Los tests preparados no equivalen a evidencia ejecutada. La instalación queda bloqueada hasta completar ese gate en un entorno no productivo.

## Arquitectura

```text
Landing externa
  -> HTTPS lead-intake (slug + public token + origin + validación + rate limit)
  -> RPC service-role transaccional (revalida form y resuelve clinic_id)
  -> Postgres + FK compuestas + RLS
  -> Realtime filtrado por clinic_id + RLS
  -> CRM React del usuario cuyo profile pertenece a esa clínica
```

La relación form→clínica vive en `clinic_public_forms`. El cliente no envía un `clinic_id` confiable; cualquier routing ID público se rechaza y la RPC deriva la clínica de la fila server-side.

## Seguridad

- cross tenant: arquitectura, FK/RLS y tests A/B/C preparados; ejecución integrada pendiente. No se puede afirmar todavía `CROSS-TENANT DATA LEAKS = 0` con evidencia runtime.
- secrets: scan del árbol y de los 3 commits disponibles sin coincidencias de alto nivel de confianza; faltan revisar el repo externo de landing y configuración Vercel/Supabase reales.
- RLS: habilitado en tablas CRM; `anon` sin grants y RPC privadas revocadas según migraciones. SQL runtime pendiente.
- Edge Function: Deno type-check PASS; doble validación form/slug/token; service role sólo server-side; errores públicos sanitizados.
- bot abuse: rate limit atómico nuevo, 10 min/120 por form/20 por form+IP/3 por form+teléfono; honeypot y 16 KiB. Burst runtime pendiente.
- XSS: sin sinks HTML peligrosos en React; límites/tipos y sanitización; contrato local PASS. Prueba almacenada real pendiente.
- rate limit: la carrera count-then-insert fue reemplazada por reserva transaccional serializada por formulario. Migración pendiente de aplicar/probar en staging.
- dependencies: `npm audit` 0 vulnerabilidades conocidas; no se hicieron upgrades mayores.
- headers: CRM con CSP/HSTS/nosniff/referrer/permissions/frame protections; landing externa no está en este repo y debe verificarse por separado.

## Load

| Escenario | Success | P95 | Errors | Cross tenant |
|---|---:|---:|---:|---:|
| 10 clinics | NO EJECUTADO | — | — | NO VERIFICADO |
| 20 clinics | NO EJECUTADO | — | — | NO VERIFICADO |
| 50 clinics | NO EJECUTADO | — | — | NO VERIFICADO |
| 100 clinics | NO EJECUTADO | — | — | NO VERIFICADO |

Runner: `tests/load/multitenant-load.mjs`. Requiere local/staging explícito y verifica las filas con credencial administrativa sólo en el proceso QA.

## Capacity

Free, según documentación Supabase revisada en la fecha de corte:

- 500 MB de database size, 5 GB egress, 500.000 Edge invocations, 2 M Realtime messages, 200 peak connections, 50.000 Auth MAU y 1 GB Storage.
- Probable primer límite: egress o DB, porque cada evento recarga el workspace completo; a 200 tabs se alcanza además el límite Realtime sin margen.

Pro incluido:

- 8 GB de disk, 250 GB egress, 2 M Edge invocations, 5 M Realtime messages, 500 peak connections, 100.000 MAU y 100 GB Storage.
- Probable siguiente cuello: compute/latencia/egress del refresh completo, no “cantidad de clínicas”.

No se promete una cifra de clínicas. Fuentes y umbrales 60/80/90: `docs/CAPACITY_AND_SCALING.md`.

## Realtime

Inspección estática: una pestaña = un WebSocket, un channel y cuatro bindings; cleanup presente. Polling cada 25 s sólo si Realtime falla, visible y online; se detiene efectivamente al recuperar `SUBSCRIBED`. Refreshes en vuelo se coalescen.

Sesiones 10/25/50/100 y aislamiento de suscripción B: NO EJECUTADO. A 200 tabs, Free quedaría en el límite documentado y no es un objetivo operativo seguro.

## Storage

Estimación real por oportunidad: NO DISPONIBLE. No hay DB/dataset representativo accesible; inventar bytes por lead incumpliría el criterio de datos reales. Ejecutar `tests/capacity/storage-estimate.sql` y el benchmark TEMP 10k/50k/100k, luego calcular un rango usando sólo 60–70% de 500 MB u 8 GB.

## Landing onboarding

Documento actualizado: `docs/FIRST_CLINIC_ONBOARDING.md`.

## First clinic

1. Confirmar plan Supabase, backup vigente y proyecto staging separado.
2. Aplicar migraciones pendientes en staging con dry-run; nunca usar reset remoto.
3. Ejecutar SQL verification, A/B/C cross-tenant e integrity health check.
4. Desplegar `lead-intake` en staging y ejecutar abuso/replay 10/50/100/500.
5. Ejecutar carga 10/20/50/100 y guardar success/P95/errors/cross-tenant.
6. Ejecutar datos 10k/50k/100k y storage estimate con datos representativos.
7. Ejecutar Realtime 10/25/50/100 y suscripción cross-tenant.
8. Corregir cualquier fuga como P0; repetir hasta obtener cero.
9. Crear clínica, owner, receptionist, settings, tratamientos, horarios y mensajes.
10. Crear public form, registrar origin y desplegar la landing con config sólo pública.
11. Ejecutar smoke end-to-end, backup final y checklist de release.
12. Habilitar cliente y monitorear las primeras 72 horas.

## P0

NINGUNO CONOCIDO.

No equivale a “cero demostrado”: falta el gate runtime obligatorio.

## P1

- Ejecutar toda la evidencia SQL/HTTP/Realtime/load en staging y completar la tabla.
- Medir almacenamiento real; hoy no existe base para estimar capacidad de 500 MB/8 GB.
- Resolver con evidencia el workspace completo sin paginación antes de declarar 50k/100k oportunidades soportadas.
- Confirmar plan y backup; Free no ofrece automatic backups según la documentación actual.
- Auditar headers, secretos e historial del repositorio externo de la landing y su deploy real.

## Pruebas finales

| Prueba | Resultado |
|---|---|
| `npm test` (intake contract, XSS, Realtime/polling, score, pendientes/workflows, quotes, owner, WhatsApp, deploy contract) | PASS |
| `npm run build` con configuración pública dummy válida | PASS |
| Deno check `lead-intake` | PASS |
| `npm audit` | PASS, 0 vulnerabilidades |
| `git diff --check` | PASS |
| lint | NO DISPONIBLE: el proyecto no define script de lint |
| SQL verification / cross-tenant / workflows | NO EJECUTADO: sin Postgres/psql |
| Intake HTTP y abuse/replay | NO EJECUTADO: sin endpoint staging/local |
| Realtime runtime | NO EJECUTADO: sin proyecto/usuarios QA |
| Load 10/20/50/100 y 10k/50k/100k | NO EJECUTADO: sin staging/local |

## Decisión

“Yo no instalaría esta versión a la primera clínica.”

No hay un P0 conocido en el código revisado, pero faltan las pruebas runtime obligatorias que demuestran aislamiento, migración, carga, Realtime y capacidad. Tras ejecutarlas en staging con cero fugas y backup confirmado, la decisión puede cambiar sin agregar funcionalidades.
