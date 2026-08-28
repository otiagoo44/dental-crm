# lead-intake

Endpoint público multi-landing:

```text
https://PROJECT_REF.supabase.co/functions/v1/lead-intake
```

## Deploy

```powershell
npx.cmd supabase secrets set FORM_HASH_SALT=REEMPLAZAR_SALT_LARGO --project-ref PROJECT_REF
npx.cmd supabase functions deploy lead-intake --no-verify-jwt --project-ref PROJECT_REF
```

La invocación sin JWT de usuario se compensa validando `clinic_slug`, `landing_token`, `allowed_origins`, consentimiento, honeypot, objeto/tipos, longitudes, 16 KiB UTF-8, teléfono y rate limits atómicos. La función rechaza identificadores tenant o de entidades enviados por el navegador.

Ventana actual: 10 minutos; 120 requests válidas por formulario, 20 por formulario+IP y 3 por formulario+teléfono. `reserve_public_form_submission` serializa el conteo/reserva por formulario para que la concurrencia no atraviese el límite. Los hashes usan `FORM_HASH_SALT`; no se guardan IPs ni teléfonos crudos en logs.

Payload mínimo:

```json
{
  "clinic_slug": "clinica-demo",
  "landing_token": "lf_xxxxx",
  "nombre": "Laura",
  "telefono": "+595981000000",
  "tratamiento": "Implante dental",
  "consentimiento_contacto": true
}
```

Una landing externa que sólo usa este endpoint no necesita la anon key de Supabase. Puede enviar opcionalmente `form_started_at` y debe incluir un honeypot `website` vacío.

Todas las escrituras de dominio se realizan mediante `create_public_lead_intake_v2` dentro de una transacción PostgreSQL.
