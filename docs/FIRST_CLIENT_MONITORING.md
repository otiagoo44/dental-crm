# Monitoreo del primer cliente

Durante las primeras 72 horas revisar al inicio, a las 4 h, 12 h, 24 h, 48 h y 72 h:

- Edge Functions > `lead-intake`: 5xx, 429 anómalos, latencia y failed intake.
- Database/Logs: errores Postgres, locks, queries lentas y tamaño.
- Realtime logs: disconnects, joins rechazados y reconexión de una pestaña real.
- `tests/security/integrity-health-check.sql`: todos los contadores en 0.
- duplicados abiertos, leads sin `assigned_to` y sin próxima acción efectiva.
- Organization > Usage: DB, egress, Edge invocations, Realtime messages/connections, Auth MAU y Storage.

Diagnóstico read-only:

```sql
select status, count(*)
from public.form_submission_logs
where created_at >= now() - interval '72 hours'
group by status order by status;

select workflow_name, status, count(*)
from public.automation_jobs
where created_at >= now() - interval '72 hours'
group by workflow_name, status order by workflow_name, status;
```

`rate_check` representa una reserva atómica del cupo antes de intentar el alta; `accepted`
representa la escritura de dominio confirmada. Por eso no deben sumarse ambas categorías
como si fueran leads distintos. Un volumen alto de `rate_limited`, o muchas reservas sin su
correspondiente `accepted`, requiere revisar los logs sanitizados de la Edge Function.

Escalar inmediatamente cualquier fila cross-tenant, cualquier 5xx sostenido, lead válido no creado, duplicado abierto o lead sin encargado sin su alerta `lead_assignment_required`. No reparar automáticamente desde estas queries.
