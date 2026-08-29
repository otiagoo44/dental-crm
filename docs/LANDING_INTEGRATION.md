# Integración de landings con `lead-intake`

Todas las landings externas comparten una sola Edge Function. El tenant no se selecciona en el navegador: cada landing usa un public form distinto y el backend resuelve `clinic_id` desde esa fila.

```text
landing-clinica-a ── clinic_slug A + landing_token A ─┐
landing-clinica-b ── clinic_slug B + landing_token B ─┼─> mismo lead-intake
landing-clinica-c ── clinic_slug C + landing_token C ─┘
                                                        │
                                                        ├─ valida token + slug + origin
                                                        ├─ obtiene clinic_public_forms.clinic_id
                                                        └─ crea el lead en la clínica correcta
```

No se despliega una Edge Function por clínica. Tampoco se crea una base por landing. La separación depende de `clinic_public_forms`, la resolución server-side, las FK multi-tenant y RLS.

## Configuración pública de cada landing

Una landing necesita únicamente:

- endpoint HTTPS de `lead-intake`, por ejemplo `https://PROJECT_REF.supabase.co/functions/v1/lead-intake`;
- `clinic_slug` de su public form;
- `landing_token` de su public form;
- origin HTTPS propio, previamente registrado en `allowed_origins`;
- branding y datos de contacto que la clínica autorizó publicar;
- nombres de tratamientos, textos, horarios, redes y contenido público aprobado;
- IDs públicos de analítica/marketing sólo cuando tengan consentimiento y una finalidad documentada.

El `landing_token` es un identificador público limitado al formulario: puede verse en el navegador y no reemplaza Auth, RLS ni validaciones del servidor. Debe ser largo, único, revocable y distinto para cada public form.

Una landing que sólo llama a `lead-intake` no necesita una anon/publishable key de Supabase y nunca debe consultar `/rest/v1/*` directamente.

## Datos que nunca recibe la landing

Nunca agregar a variables, JavaScript, HTML, logs, analytics ni tickets de la landing:

- `service_role` o claves `sb_secret_*`;
- password o connection string de Postgres;
- JWT secret o private JWT;
- access token o refresh token de usuarios;
- credenciales de owner/receptionist;
- `clinic_id` como dato de routing confiable;
- secretos de Vercel, Supabase, correo o automatizaciones.

Si el navegador envía `clinic_id`, `lead_id`, `appointment_id`, `quote_id` o `assigned_to`, `lead-intake` debe rechazar el payload. La landing no decide el tenant ni el responsable.

## Contrato HTTP

Request mínimo:

```json
{
  "clinic_slug": "clinica-a",
  "landing_token": "lf_TOKEN_PUBLICO_DEL_FORM_A",
  "nombre": "Laura",
  "telefono": "+595981000000",
  "tratamiento": "Implante",
  "consentimiento_contacto": true,
  "website": ""
}
```

Campos públicos opcionales aceptados: `urgencia`, `evaluacion_previa`, `situacion`, `consultation_reason`/`motivo_consulta`, `origen`/`source`, `pagina`/`page`, `notes`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `landing_page`, `referrer` y `form_started_at`. `website` y `company` son honeypots y deben permanecer vacíos.

Requisitos del request:

- método `POST` y `Content-Type: application/json`;
- header `Origin` exacto en navegadores;
- body máximo de 16 KiB;
- teléfono paraguayo válido;
- consentimiento booleano `true`;
- texto dentro de los límites publicados;
- no enviar HTML ejecutable ni campos tenant/entidad;
- mostrar al usuario un mensaje genérico ante error y no reintentar en bucle.

Respuesta exitosa: HTTP 200 con `success: true` y `lead_id`. Un doble submit o un teléfono con oportunidad abierta puede devolver el mismo `lead_id`. Una oportunidad terminal conserva su historia y permite crear una nueva oportunidad cuando corresponde.

Errores esperados: 400 para payload/consentimiento/teléfono inválido, 403 para form/origin/honeypot/contenido no autorizado, 415 para content type incorrecto y 429 para rate limit. La landing no debe mostrar detalles internos aunque el servidor fallara.

## Ejemplo de configuración por repositorio externo

```js
export const publicClinicConfig = Object.freeze({
  intakeEndpoint: 'https://PROJECT_REF.supabase.co/functions/v1/lead-intake',
  clinicSlug: 'clinica-a',
  landingToken: 'lf_TOKEN_PUBLICO_DEL_FORM_A',
  brand: {
    name: 'Clínica A',
    phone: '+595 ...',
    address: 'Dirección pública',
  },
});
```

La Clínica B y la Clínica C usan el mismo endpoint con sus propios `clinicSlug` y `landingToken`. Nunca se copia el token de A a B ni se usa una variable global compartida para decidir `clinic_id`.

## Checklist antes de publicar

1. Confirmar que Preview apunta a Supabase staging y Production a Supabase production.
2. Confirmar que el public form está activo y el origin exacto está permitido.
3. Enviar un formulario real desde la landing, no sólo desde curl.
4. Verificar una sola oportunidad, encargada y con próxima acción en la clínica correcta.
5. Repetir con token/origin/consentimiento/payload inválidos, honeypot y doble submit.
6. Intentar enviar el `clinic_id` de otra clínica y exigir rechazo.
7. Mantener la CRM abierta y comprobar Realtime sin F5; luego probar el polling fallback.
8. Ejecutar el health check read-only y exigir 0 problemas críticos.
