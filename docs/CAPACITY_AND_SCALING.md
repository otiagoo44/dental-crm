# Capacidad y escalamiento

Valores verificados contra documentación oficial de Supabase el 28 de agosto de 2026. Las cuotas cambian: validar nuevamente en [About billing](https://supabase.com/docs/guides/platform/billing-on-supabase), [Realtime limits](https://supabase.com/docs/guides/realtime/limits) y la página de [Usage](https://supabase.com/dashboard/org/_/usage) antes de decidir un plan.

## Cuotas de referencia actuales

| Métrica | Free | Pro incluido |
|---|---:|---:|
| Database size/disk por proyecto | 500 MB | 8 GB |
| Egress por organización | 5 GB | 250 GB |
| Edge Function invocations | 500.000 | 2.000.000 |
| Realtime messages | 2.000.000 | 5.000.000 |
| Realtime peak connections | 200 | 500 |
| Auth MAU | 50.000 | 100.000 |
| Storage | 1 GB | 100 GB |

En Free, superar 500 MB de database size puede llevar el proyecto a read-only. En Pro, conexiones Realtime por defecto son 500; el plan sin spend cap documenta límites mayores, pero no deben asumirse sin revisar configuración y costos.

## Dónde mirar

- Organization > Usage: egress, database size, Edge invocations, Realtime messages/peak connections, MAU y Storage. La métrica es de organización y puede incluir proyectos activos durante el ciclo.
- Project > Database > Reports/Database: tamaño, conexiones, queries lentas, índices y compute.
- Project > Edge Functions > `lead-intake` > Logs/Invocations: 4xx, 5xx, duración y bursts.
- Project > Realtime > Logs/Inspector: desconexiones, `too_many_connections`, `too_many_joins` y throughput.
- Project > Authentication > Users: usuarios activos; Usage es la fuente de MAU facturable.
- Project > Storage: objetos y egress. La CRM actual no debe usar Storage para imágenes de landings externas.

Consulta rápida de DB, read-only:

```sql
select pg_database_size(current_database()) as bytes,
       pg_size_pretty(pg_database_size(current_database())) as size;
```

Para detalle por tabla y bytes reales por oportunidad ejecutar `tests/capacity/storage-estimate.sql`. No convertir 500 MB u 8 GB a “cantidad de clínicas”: el resultado depende de oportunidades, historial, índices, logs y uso por clínica.

## Umbrales operativos

| Uso de cuota | Acción |
|---:|---|
| 60% | warning: revisar tendencia semanal, top consumers y crecimiento por oportunidad |
| 80% | warning alto: congelar carga QA, corregir amplificación y decidir upgrade/capacidad |
| 90% | acción: upgrade o reducción validada antes de seguir incorporando clínicas; no esperar read-only/restricción |

Aplicar los umbrales por métrica. A 90% de conexiones Realtime, reducir tabs/sesiones o subir plan; a 90% de DB/Storage, exportar y ampliar capacidad; a 90% de egress/mensajes/invocaciones, revisar refresh completo y bots antes de comprar cuota.

## Modelo de carga actual

Una pestaña crea una conexión WebSocket, un channel y cuatro bindings. Por lo tanto, 10/25/50/100 pestañas equivalen aproximadamente a 10/25/50/100 conexiones. Doscientas pestañas alcanzan el límite documentado de Free sin margen para QA, reconexiones u otras apps. Varias pestañas del mismo usuario cuentan por separado.

Si Realtime falla, 100 pestañas visibles y online disparan aproximadamente 4 refresh de workspace por segundo. Cada refresh son nueve requests: hasta 36 queries HTTP/s, además del payload completo. Hidden y offline no consultan; al recuperar Realtime el polling deja de ejecutar. Este fallback es correcto funcionalmente, pero la carga de cada refresh sigue siendo el riesgo principal.

El probable primer cuello de botella en Free es egress o database size, no el número abstracto de clínicas, porque cada evento recarga datasets completos. En Pro, el siguiente cuello probable es compute/latencia y egress si el patrón continúa. Esto es una inferencia desde el código; se debe confirmar con staging.

## Cómo medir

1. Crear las fixtures únicamente en local/staging con `tests/load/setup-load-fixtures.sql`.
2. Ejecutar `tests/load/multitenant-load.mjs` para 10/20/50/100 clínicas. El script exige host permitido, confirmación no-productiva y service role sólo en el proceso de QA para verificar tenant y duplicados.
3. Ejecutar `tests/security/intake-abuse-load.mjs` para bursts 10/50/100/500.
4. Ejecutar `tests/security/realtime-capacity.mjs` para 10/25/50/100 conexiones.
5. Ejecutar `tests/load/data-volume-benchmark.sql` tres veces con 10.000, 50.000 y 100.000 filas. Usa TEMP tables; mide planner/índices, no egress ni render React.
6. Ejecutar `tests/capacity/storage-estimate.sql` sobre datos representativos para obtener promedio real.

Los índices requeridos por los patrones auditados ya existen: `clinic_id + created_at`, `clinic_id + status`, `clinic_id + assigned_to + next_followup_at`, `clinic_id + next_followup_at`, `clinic_id + appointment_date/time`, y `clinic_id + task status/due_at`. No se agregó un índice comercial nuevo sin EXPLAIN; sólo índices parciales del rate limiter nuevo.

## Estimación de almacenamiento

No hay una estimación honesta por oportunidad en este checkout porque no existe una DB local/staging ni datos representativos accesibles. Informar un número ahora sería precisión falsa. El gate es:

```text
bytes_por_oportunidad = promedio lead
                      + events + tasks + appointments + quotes + audit
                      + factor observado de índices/overhead

capacidad prudente = cuota_utilizable / bytes_por_oportunidad
```

Usar sólo 60–70% de 500 MB u 8 GB para la estimación prudente, dejando margen a Auth, migrations, índices, logs, VACUUM/WAL y crecimiento. Reportar un rango usando percentiles de clínicas reales, no un único promedio global.
