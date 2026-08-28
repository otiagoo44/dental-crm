# Alta de la primera clínica

No usar datos QA como datos reales. El alta se hace con acceso administrativo a Supabase, sin pegar secretos en tickets, chats, landings o Vercel público. Crear una nueva clínica no requiere copiar Supabase, la base ni la CRM: todas comparten el backend y se aíslan por `clinic_id`, perfiles, RLS y public forms.

# Onboarding técnico

## Checklist de datos y configuración

- [ ] Crear clínica con ID generado por Postgres, nombre, slug, zona horaria y estado activo.
- [ ] Invitar owner mediante Supabase Auth y crear su `profile` dentro de la clínica.
- [ ] Invitar receptionist; crear los demás perfiles/roles autorizados sin compartir contraseñas.
- [ ] Cargar tratamientos principales y nombres consistentes.
- [ ] Cargar precios de referencia aprobados por la clínica, si desea utilizarlos.
- [ ] Configurar horarios, duración habitual de turnos y profesionales.
- [ ] Revisar mensajes de primer contacto, urgencia, no respuesta, confirmación, recordatorio, no-show, presupuesto, seguimiento y reactivación.
- [ ] Crear public form con slug y token aleatorio, activo y ligado al `clinic_id` server-side.
- [ ] Registrar dominio/origin HTTPS exacto de cada landing, sin wildcard y sin slash final.
- [ ] Configurar en la landing sólo endpoint público, slug/token público y branding.
- [ ] Probar formulario válido, inválido, doble submit, origin y asignación.
- [ ] Probar CRM de owner y receptionist, permisos y aislamiento respecto de otra clínica.
- [ ] Probar Realtime con una pestaña visible y recuperación tras desconexión.
- [ ] Probar Agenda: alta, confirmación, asistencia/no-show y reprogramación.
- [ ] Probar presupuesto: creación, seguimiento, aceptación/rechazo y permisos.
- [ ] Probar WhatsApp: link, copia, mensajes aprobados y registro operativo.

## Flujo de alta

1. Confirmar backup, plan/cuotas y staging en PASS; no empezar directamente en producción.
2. Crear la clínica y `clinic_settings`; nunca hardcodear su UUID en frontend o landing.
3. Invitar owner y receptionist, crear perfiles activos y verificar roles.
4. Cargar horarios, tratamientos, precios y mensajes aprobados.
5. Crear `clinic_public_forms` con token largo, landing URL y origins exactos.
6. Entregar a la landing únicamente endpoint, `clinic_slug` y `landing_token`; desplegarla.
7. Ejecutar smoke de intake y comprobar lead, encargado, task, event, audit y Realtime en la clínica correcta.
8. Ejecutar login y flujos de CRM con ambos roles; verificar que otra clínica sea invisible e inmodificable.
9. Ejecutar `tests/security/integrity-health-check.sql`, SQL verification y checklist de release.
10. Habilitar uso real y seguir `docs/FIRST_CLIENT_MONITORING.md` durante 72 horas.

## Varias landings, un backend

La arquitectura soporta:

```text
dental-crm (CRM + Supabase único)
  <- landing-clinic-a
  <- landing-clinic-b
  <- landing-clinic-c
```

Cada alta requiere: clínica, usuarios, public form, origin, configuración pública, deploy y smoke test. No requiere otra base, otra Edge Function ni otra copia de la CRM.

## Landing template recomendado

El repositorio de la landing debe convertirse en template genérico si existe fuera de este repositorio. Este repositorio no contiene esa landing y, por separación arquitectónica, no se agrega aquí contenido o assets de una clínica. El template externo debe separar componentes/layout de un único archivo de configuración pública, por ejemplo:

```js
export const clinicConfig = Object.freeze({
  intakeEndpoint: 'https://PROJECT_REF.supabase.co/functions/v1/lead-intake',
  clinicSlug: 'clinica-ejemplo',
  publicFormToken: 'lf_TOKEN_PUBLICO_DEL_FORM',
  brand: {
    name: 'Nombre público',
    logoUrl: '/logo.svg',
    phone: '+595 ...',
    whatsapp: '+595 ...',
    address: 'Dirección pública',
  },
});
```

Permitido: endpoint público, slug/token de form, dominio y contenido visual público. Prohibido: `clinic_id`, `service_role`, password de DB, JWT secret, access token, claves administrativas o datos privados. Una landing que sólo llama `lead-intake` no necesita `VITE_SUPABASE_ANON_KEY`; la CRM sí usa una publishable/anon key para Auth, queries con RLS y Realtime.

El formulario debe incluir límites HTML equivalentes al backend, honeypot `website`, timestamp `form_started_at`, consentimiento y mensaje público genérico de error. El token puede inspeccionarse y no debe tratarse como secreto maestro.

## Headers de la landing

Configurar HTTPS y, en Vercel, headers equivalentes a:

- CSP con `default-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` y `connect-src` limitado al endpoint Supabase real;
- `X-Content-Type-Options: nosniff`;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- `X-Frame-Options: DENY` si no debe embeberse;
- `Permissions-Policy` sin cámara/micrófono/geolocalización salvo necesidad explícita;
- HSTS después de confirmar que todo el dominio y subdominios funcionan por HTTPS.

No copiar ciegamente una CSP: agregar sólo hosts reales de imágenes, fuentes, WhatsApp y Supabase, y verificar formulario/assets en preview antes de producción.

# Material que pedir a la clínica

Esta sección puede enviarse al cliente.

## Datos

- nombre comercial;
- logo en buena calidad;
- teléfono;
- WhatsApp;
- email;
- dirección;
- enlace de Google Maps;
- horarios;
- Instagram;
- Facebook o web, si existe.

## Servicios

- tratamientos principales;
- tratamientos de alto valor;
- precios de referencia, si desean configurarlos;
- promociones reales, si existen;
- formas de contacto;
- profesionales que desean mostrar.

## Fotos

Idealmente enviar:

1. 2–3 fotos horizontales buenas de la clínica para el Hero.
2. 2–4 fotos de recepción/instalaciones.
3. 2–4 fotos de consultorios.
4. 1 foto profesional de cada odontólogo que quieran mostrar.
5. 1 foto grupal del equipo, si tienen.
6. Fotos de tecnología/equipamiento relevante.
7. Fotos de trabajos/resultados sólo cuando tengan autorización adecuada para utilizarlas.
8. Fotos de fachada/entrada para reconocimiento.
9. Logo transparente PNG/SVG, si disponen.
10. Testimonios/reseñas que tengan autorización para mostrar.

Recomendaciones: buena luz, archivos originales, sin screenshots comprimidos, preferir horizontales para Hero y seleccionar material útil; no enviar 40 fotos innecesarias.

## Copy

- tratamientos prioritarios;
- principal diferenciador;
- años de experiencia sólo si es verificable;
- facilidades de pago, si existen;
- ubicación;
- llamada a la acción deseada;
- cualquier afirmación que quieran mostrar y puedan respaldar.

No inventar claims médicos, resultados garantizados, credenciales, promociones ni años de experiencia.

## Privacidad y autorización de imágenes

Antes/después, pacientes, historias clínicas, casos y testimonios identificables requieren autorización apropiada para ese uso y canal antes de publicación. No asumir consentimiento por haber recibido el archivo o por estar publicado en redes. Registrar quién autorizó, qué material, dónde puede usarse y hasta cuándo; ante duda, no publicar.
