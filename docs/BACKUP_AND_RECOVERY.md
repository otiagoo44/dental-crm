# Backup y recuperación

El repositorio no permite determinar el plan contratado. Confirmarlo en Supabase Dashboard > Organization > Billing antes del alta.

- Free: la documentación actual no ofrece automatic backups; Supabase recomienda exports regulares y copia off-site.
- Pro: daily backups automáticos con 7 días disponibles en Database > Backups.
- Team: 14 días; Enterprise: hasta 30. PITR es un add-on y no se presume activo.
- Los backups de database no restauran objetos borrados de Storage; esos objetos requieren backup separado.

Fuentes: [Database Backups](https://supabase.com/docs/guides/platform/backups) y [CLI backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore).

## Antes del primer cliente

1. Preferir Pro para tener daily backup administrado; si se continúa en Free, export diario cifrado y off-site es gate operativo.
2. Guardar la DB URL sólo en un secret manager/variable de proceso. Nunca en Git, logs o comandos compartidos.
3. Generar roles, schema y data en un directorio fuera del repositorio:

```powershell
supabase db dump --db-url $env:CRM_BACKUP_DB_URL -f C:\secure-backups\roles.sql --role-only
supabase db dump --db-url $env:CRM_BACKUP_DB_URL -f C:\secure-backups\schema.sql
supabase db dump --db-url $env:CRM_BACKUP_DB_URL -f C:\secure-backups\data.sql --data-only --use-copy
```

4. Cifrar, calcular hash, copiar off-site y registrar fecha/tamaño/hash sin guardar credenciales.
5. Repetir semanalmente un restore drill a un proyecto temporal aislado. Nunca ensayar sobre producción.

## Export de emergencia

Poner la aplicación en ventana de mantenimiento si la consistencia lo requiere, obtener un dump nuevo, copiar por separado assets de Storage si existieran y guardar las migraciones/Edge Functions/configuración de Auth/Realtime. Verificar que los tres archivos no estén vacíos y conservar al menos dos destinos.

## Restauración

1. Crear un proyecto nuevo de recuperación; no sobrescribir producción durante el diagnóstico.
2. Restaurar roles, schema y data siguiendo la guía oficial, con `ON_ERROR_STOP` y transacción cuando corresponda.
3. Volver a configurar Edge secrets, Auth URLs/providers, Realtime publication, SMTP, dominios y Storage; no están todos contenidos en un dump lógico.
4. Ejecutar `tests/sql-verification.sql`, `tests/security/integrity-health-check.sql`, cross-tenant y smoke tests.
5. Comparar conteos e IDs clave, probar login/Realtime/intake y recién entonces planificar el corte DNS.

Un restore desde Dashboard causa indisponibilidad. Nunca ejecutarlo sin backup reciente, ventana aprobada, RTO/RPO acordados y responsable de rollback.
