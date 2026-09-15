# Reglas de desarrollo del proyecto

Estas instrucciones aplican a futuros cambios realizados por Codex dentro de este repositorio.

## Arquitectura

- Usar React para las nuevas interfaces de la CRM.
- Mantener Vite como herramienta de desarrollo y build del frontend React.
- Mantener Tailwind CSS como sistema principal de estilos de la CRM.
- Usar Motion sólo cuando la animación mejore la comprensión, el feedback o la continuidad de la interfaz.
- Respetar siempre prefers-reduced-motion.
- Crear componentes reutilizables y evitar volver a concentrar páginas, modales y lógica de acceso a datos en un único archivo.
- Mantener separadas las responsabilidades de components, pages, hooks, services, lib, estilos y assets.
- Preferir una migración progresiva sobre una reescritura masiva.

## Backend y seguridad

- Respetar la arquitectura existente: CRM React, backend Supabase y landings externas que consumen `lead-intake`.
- No agregar contenido, assets ni lógica comercial de una landing específica a este repositorio.
- Mantener separados frontend y backend; no migrar Supabase ni la lógica de negocio a Node.js por conveniencia del frontend.
- No romper ni cambiar innecesariamente contratos de APIs, Edge Functions, RPCs, Auth, RLS, roles o multi-clínica.
- No hardcodear clinic_id; derivarlo siempre de la sesión y el perfil autorizados.
- No exponer service_role, secretos ni variables privadas en el frontend.
- No desactivar RLS ni sustituir las restricciones de base de datos por validaciones únicamente visuales.
- No agregar dependencias salvo que resuelvan una necesidad concreta y no exista ya una solución adecuada en el proyecto.

## UX y calidad

- Mantener una interfaz moderna, limpia, intuitiva y orientada a la próxima acción.
- Diseñar y verificar cada cambio para escritorio, tablet y móvil.
- Adaptar navegación, formularios, filtros, cards, tablas y modales al espacio disponible; no limitarse a reducir tamaños.
- Usar estados de carga, vacíos, éxito y error claros.
- Revisar errores de consola, imports, rutas, formularios y llamadas al backend después de cambios importantes.
- Ejecutar como mínimo la instalación necesaria y el build de producción antes de finalizar cambios importantes.
- Ejecutar lint y tests existentes cuando estén disponibles y corregir errores causados por los cambios.
- Mantener build.sourcemap en false salvo una decisión explícita y justificada.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `$graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
