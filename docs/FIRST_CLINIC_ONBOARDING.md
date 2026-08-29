# Alta de la primera clínica

No usar datos QA como datos reales. El alta se hace con acceso administrativo a Supabase, sin pegar secretos en tickets, chats, landings o Vercel público. Crear una nueva clínica no requiere copiar Supabase, la base ni la CRM: todas comparten el backend y se aíslan por `clinic_id`, perfiles, RLS y public forms.

## Procedimiento obligatorio de alta (15 pasos)

1. **Crear la clínica.** Insertar una fila en `clinics` con UUID generado por Postgres, nombre, `slug` único, `timezone`, estado activo y datos públicos aprobados. Crear también su fila en `clinic_settings`. Nunca reutilizar el UUID de otra clínica ni escribirlo en la landing.
2. **Crear el owner.** Crear o invitar el usuario mediante Supabase Auth, confirmar su email por el flujo autorizado y crear un `profile` activo con `role = 'owner'` y el `clinic_id` nuevo. Iniciar sesión y comprobar que ve exactamente una clínica.
3. **Crear la recepcionista.** Crear o invitar un segundo usuario Auth y su `profile` activo con `role = 'receptionist'`. No compartir la cuenta del owner. Confirmar que puede trabajar leads/agenda/tareas/quotes de su clínica, pero no administrar forms, plantillas ni otra clínica.
4. **Cargar tratamientos.** Definir nombres canónicos y consistentes en `clinic_settings.treatments` y/o `treatment_prices`. Evitar variantes que representen el mismo tratamiento con nombres distintos.
5. **Cargar precios de referencia.** Guardar en `treatment_prices` sólo valores aprobados. Son defaults comerciales: un quote individual puede cambiar el monto y ese histórico no debe variar cuando cambie después el precio global.
6. **Configurar horarios.** Completar zona horaria, horario de atención, profesionales y reglas operativas de agenda. Probar un turno válido, doble reserva, confirmación, asistencia y no-show.
7. **Configurar mensajes.** Revisar las nueve plantillas canónicas: primer contacto, urgencia, consulta de precio, no respuesta, recordatorio de cita, no-show, postconsulta, reactivación y confirmación de asistencia. No habilitar mensajes sin aprobación de la clínica.
8. **Crear el public form.** Crear una fila en `clinic_public_forms` ligada al nuevo `clinic_id`, con `clinic_slug`, `public_token` largo y único, `landing_url` e `is_active = true`. El token identifica un formulario público; no es una credencial administrativa.
9. **Registrar el allowed origin.** Agregar el origin HTTPS exacto de la landing a `allowed_origins`, sin wildcard, path ni slash final; por ejemplo, `https://clinica.example`. Preview y producción deben declararse por separado si ambos enviarán formularios.
10. **Preparar la landing.** La landing vive fuera de este repositorio. Debe enviar el formulario al mismo endpoint compartido `lead-intake`, con su propio slug/token, consentimiento, honeypot vacío y campos públicos. No debe conectarse directamente a tablas.
11. **Configurar sólo datos públicos.** Entregar endpoint, `clinic_slug`, `landing_token`, branding, teléfonos, dirección, horarios y textos públicos. Nunca entregar `clinic_id`, `service_role`, password de DB, private JWT, access token ni secretos internos.
12. **Desplegar.** Publicar primero Preview contra Supabase staging y verificar que el ref esperado coincide. Publicar la landing/CRM de producción sólo después del gate staging y con variables de producción separadas; no promover variables por copia ciega.
13. **Enviar un formulario real.** Desde el origin permitido, completar y enviar una consulta QA identificable. Verificar HTTP 200 y un solo `lead_id`; repetir el mismo submit y el mismo teléfono abierto para confirmar idempotencia.
14. **Verificar el tenant.** Comprobar server-side que lead, encargado, tarea, evento, audit y automatización pertenecen al `clinic_id` del public form. Iniciar sesión como otra clínica y confirmar 0 lectura, 0 modificación y 0 eventos Realtime cruzados.
15. **Verificar Realtime.** Mantener Inicio/Pendientes visible, enviar otra consulta desde la landing y comprobar que aparece sin F5, registrando latencia. Interrumpir Realtime de forma segura y comprobar polling, recuperación, ausencia de canales duplicados y cleanup al cerrar/cambiar de clínica.

Después del paso 15 ejecutar el health check read-only. No habilitar el onboarding real si existe una oportunidad abierta sin clínica, encargado o próxima acción, una relación cross-tenant, un public form inconsistente o un duplicado abierto inesperado.

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
