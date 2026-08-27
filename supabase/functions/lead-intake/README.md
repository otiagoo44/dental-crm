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

La invocación sin JWT de usuario se compensa validando `clinic_slug`, `landing_token`, `allowed_origins`, consentimiento, honeypot, tamaño, teléfono y rate limits. La función nunca confía en `clinic_id` enviado por el navegador.

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

Todas las escrituras de dominio se realizan mediante `create_public_lead_intake_v2` dentro de una transacción PostgreSQL.
