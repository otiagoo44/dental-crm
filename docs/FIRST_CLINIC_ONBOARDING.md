# Alta de la primera clínica

No usar datos QA como datos reales. El alta debe ejecutarse con acceso administrativo a Supabase y verificarse con owner y recepción.

## Datos a solicitar

- Clínica: nombre comercial, slug público deseado, profesional principal, WhatsApp, email, enlace de ubicación, enlace de agenda y color principal.
- Operación: zona horaria, días y horarios de atención, duración habitual de turnos y profesionales que atienden.
- Equipo: nombre completo, email y rol de cada usuario (`owner`, `admin`, `receptionist` o `doctor`). Las contraseñas no se solicitan: cada persona recibe su invitación de Supabase Auth.
- Tratamientos: nombre y precio de referencia en guaraníes de cada tratamiento.
- WhatsApp: textos aprobados para primer contacto, urgencia, sin respuesta, confirmación, recordatorio, no-show, presupuesto, seguimiento y reactivación. Se pueden aceptar inicialmente las nueve plantillas predeterminadas.
- Captación: URL final de cada landing, origins HTTPS exactos, texto de consentimiento y enlace a la política de privacidad.
- Dominio: dominio o subdominio deseado para la CRM, si se usará uno propio.
- Migración opcional: contactos abiertos que deban cargarse al iniciar, con nombre, teléfono, tratamiento, estado, responsable, próxima acción y constancia de consentimiento.

## Procedimiento

1. Crear la clínica y su configuración con un identificador interno generado por la base.
2. Invitar al owner en Supabase Auth y asociar su `profile` a la clínica; repetir para el equipo.
3. Cargar horarios, tratamientos, precios y plantillas aprobadas.
4. Registrar cada landing en `clinic_public_forms` con un token aleatorio y sus origins exactos. La landing nunca recibe `clinic_id` ni secretos.
5. Probar login de owner y recepción, aislamiento RLS y permisos por rol.
6. Enviar un lead QA por la landing, recorrer cita/presupuesto/seguimiento y archivarlo al terminar.
7. Confirmar que Agenda, Pendientes, WhatsApp, Realtime y métricas muestran sólo la nueva clínica.
