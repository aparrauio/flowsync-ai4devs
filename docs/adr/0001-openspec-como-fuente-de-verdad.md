# 1. Las delta-specs de OpenSpec como fuente de verdad viva

## Contexto

FlowSync tenía documentación de sobra sobre **lo que se pidió** y nada sobre **lo que el sistema hace**. La cadena que ya existía en el repositorio va del PRD (`docs/prd/flowsync-mvp.md`, `docs/prd/alcance-mvp.md`) a doce historias con criterios de aceptación (`docs/backlog/`), y de ahí al tablero de Jira, que el propio `docs/backlog/README.md` degrada a seguimiento: «El tablero es seguimiento del trabajo, no la fuente de verdad. Si los dos se contradicen, manda el repositorio».

El problema es que ninguno de esos artefactos envejece bien. Un criterio de aceptación describe lo que se acordó **una vez**; no se corrige cuando el sistema cambia, porque su función es histórica. Entre el backlog y el código no había ningún texto con la obligación de seguir siendo cierto, y la pregunta «¿qué hace hoy la lista de tareas?» solo se contestaba leyendo `tasks_controller.ts`.

`openspec/` entra el 2026-08-13 (commit `5b5cd0a`) para ocupar ese hueco. Hoy contiene:

| | Requisitos | Escenarios | Líneas |
|---|---|---|---|
| `openspec/specs/auth/spec.md` | 19 | 45 | 307 |
| `openspec/specs/tasks/spec.md` | 32 | 124 | 753 |

y tres changes archivados en `openspec/changes/archive/`, ninguno activo. Cada change son cinco artefactos: `.openspec.yaml` (`schema: spec-driven` y la fecha), `proposal.md` (*Why*, *What Changes*, *Capabilities*, *Impact*), `design.md` (*Context*, *Goals / Non-Goals*, *Decisions*, *Risks / Trade-offs*, *Open Questions*), `tasks.md` (la lista de trabajo marcada) y `specs/<capability>/spec.md`, que es **el delta**.

El delta no es una copia de la spec: es lo que ese change le hace, bajo cabeceras `## ADDED Requirements` y `## MODIFIED Requirements`. Un `MODIFIED` **reescribe el requisito entero**, no un fragmento. Al archivar, los deltas se funden en la spec viva, y la suma cuadra exactamente:

```
add-task-list          ADDED 14  MODIFIED  0
add-task-due-date      ADDED 11  MODIFIED  1
add-task-status-filter ADDED  7  MODIFIED  4
                       ─────────
                       32 requisitos = los 32 de openspec/specs/tasks/spec.md
```

La historia real de esos tres changes es lo que hace falta entender, porque no es la ordenada:

- **`5b5cd0a`** siembra `openspec/`, archiva `add-task-list` —cuyo delta de 291 líneas *es* la primera versión de la spec viva de `tasks`— y deja `add-task-due-date` como change **activo**, sin archivar.
- El **filtro por estado se implementó y se dio por terminado sin escribir su spec**. La spec viva quedó afirmando algo falso, y el repositorio lo registró: el `proposal.md` de `add-task-due-date` incluye un riesgo titulado *«Deriva conocida de la spec viva»* que dice que `openspec/specs/tasks/spec.md` describe `GET /api/v1/tasks` como «todas las tareas del espacio», que «dejó de ser cierto cuando se implementó el filtro por estado (FS-142) sin actualizar `openspec/`».
- **`2de0f39`** repara esa deriva a posteriori: escribe `add-task-status-filter` —cuyo `tasks.md` se abre avisando «Todas las tareas están hechas. Este change documenta comportamiento que ya estaba implementado»—, archiva los dos changes pendientes y hace crecer la spec viva de `tasks` de 291 a 753 líneas.

Es decir: la mecánica de deltas ya ha demostrado las dos cosas. Que detecta la contradicción —para documentar el filtro hubo que `MODIFY` explícitamente el requisito que decía «todas» y admitir que era falso— y que no la impide.

## Decisión

**`openspec/specs/` es la fuente de verdad sobre cómo se comporta FlowSync, y se mantiene viva a través de delta-specs.** En concreto:

1. **Lo que un requisito dice en `openspec/specs/<capability>/spec.md` es la referencia.** Cuando el código y la spec discrepan, lo que hay es un defecto: o del código, o de una spec que un change debió actualizar y no lo hizo. No se resuelve leyendo el código y dando por buena su conducta.

2. **Todo cambio de comportamiento entra por un change**, con su delta en `changes/<nombre>/specs/<capability>/spec.md`. Un change que rompa un requisito vigente está obligado a incluirlo bajo `## MODIFIED Requirements` y a reescribirlo entero: no se puede cambiar el sistema y dejar la spec en pie por omisión.

3. **Al archivar, el delta se funde en la spec viva** y el change queda en `changes/archive/<fecha>-<nombre>/` como registro inmutable. El archivo conserva el *porqué* —`design.md` guarda decisiones y trade-offs— que la spec viva, que solo dice qué hace el sistema, no puede guardar.

4. **Cada artefacto conserva su papel y ninguno sustituye a otro**: el PRD y el backlog son el origen —qué se pidió y con qué criterios—, Jira es seguimiento, el código es la implementación, y la spec viva es el comportamiento vigente. Los deltas citan los criterios del backlog por su identificador (CA-9, PA-3, FS-118) para que la trazabilidad no se pierda.

5. **Las operaciones de delta disponibles son `ADDED`, `MODIFIED`, `REMOVED` y `RENAMED`.** Hasta hoy solo se han usado las dos primeras.

## Estado

**Aceptada**, en vigor desde el 2026-08-13 (`5b5cd0a`). Tres changes archivados, ninguno activo.

Esta decisión no está validada por el paso del tiempo: los tres changes se escribieron el mismo día, y la primera prueba real de si la disciplina aguanta —un cambio de código posterior al archivado— **la falló**. Está documentado en las consecuencias.

## Consecuencias

### Lo que ganamos

- **Hay un sitio donde se contesta «¿qué hace hoy el sistema?» sin leer código.** Para `tasks` son 32 requisitos y 124 escenarios; para `auth`, 19 y 45.
- **Los escenarios están escritos en `WHEN` / `THEN` y se convierten en tests casi literalmente.** Ya ha pasado: `backend/tests/functional/tasks/assignee.spec.ts` cubre los tres escenarios del requisito *Lo que cada tarea muestra de su responsable*, con los mismos nombres.
- **Sirve de patrón de medida contra el que contrastar otros artefactos.** El contraste del documento OpenAPI contra la spec de `tasks` fue posible porque existía algo con lo que comparar.
- **El archivo conserva el razonamiento, no solo el resultado.** El `design.md` de `add-task-status-filter` registra por qué la vista por defecto se escribe explícita y no como «`TASK_STATUSES` menos `done`», y por qué la incompatibilidad entre CA-9 y CA-17 se resolvió a favor del filtro direccionable. Eso no cabe en la spec viva ni en el código.
- **Obliga a mirar de frente la contradicción.** Un `MODIFIED` es una admisión escrita de que algo que se afirmaba ha dejado de ser cierto.

### Lo que nos cuesta

- **Nada lo comprueba. La spec puede mentir, y hoy miente.** El requisito *Un estado que no existe se rechaza, no se responde vacío* exige `422` para `GET /api/v1/tasks?status=archivado`; el servidor devuelve hoy `200` con una lista vacía. La cadena es completamente trazable: el change se archivó el 13 de agosto con su `tasks.md` marcando «2.4 Verificar que un estado inventado devuelve 422 … y no una lista vacía», y el 18 de agosto el commit `2ccf2c1` cambió `vine.enum(TASK_STATUSES).optional()` por `vine.string().optional()` en el validador. Cinco días. Ningún change, ningún test y ninguna comprobación registraron que un requisito acababa de dejar de cumplirse; el comentario del controlador sigue afirmando lo contrario y la rama `invalidFilter` de `tasks-page.tsx` es código muerto desde entonces.
- **La deriva es el estado por defecto, no la excepción.** Ya se produjo una vez antes de esa (el filtro implementado sin spec) y hubo que repararla con un change retroactivo. Mantener la spec viva no es gratis: es trabajo que se hace o no se hace, y cuando no se hace nada avisa.
- **Reescribir el requisito entero en cada `MODIFIED` es caro y silenciosamente frágil.** El mismo requisito *Una sola vista de tareas, sin señales de presencia* aparece con **cuatro** escenarios en el delta de `add-task-due-date` y con **seis** en el de `add-task-status-filter`. La spec viva conserva los seis solo porque ese change se archivó después. Con el orden inverso, dos escenarios habrían desaparecido sin que ningún diff los señalara como una pérdida.
- **El volumen ya pesa.** 753 líneas para una sola capability, con requisitos de API y de interfaz mezclados en el mismo fichero. Leerla entera antes de tocar nada deja de ser realista pronto, y una spec que no se lee no gobierna nada.
- **Duplicamos texto con el backlog.** El mismo comportamiento está descrito en los criterios de aceptación y en la spec, con redacciones distintas y ninguna comprobación de que sigan diciendo lo mismo. Leer un delta suele exigir el backlog abierto al lado para resolver los CA-x y PA-x que cita.
- **La ceremonia no escala hacia abajo.** `add-task-status-filter` no tocó una línea de código y aun así costó cuatro artefactos y 469 líneas. Para un cambio pequeño, el coste del ritual puede superar al del cambio.
- **Los escenarios no son ejecutables, y los tres changes renunciaron a los tests explícitamente.** Los `proposal.md` lo dicen sin adornos: «Sin tests», «Es decisión explícita de quien encarga el trabajo, no un descuido». De 124 escenarios de `tasks`, hoy hay tests para tres. La autoridad de la spec descansa entera sobre la disciplina de quien la mantiene.
- **El archivo es inmutable, y eso corta en los dos sentidos.** Corregir el pasado no es editar un change archivado, sino escribir uno nuevo. Es lo correcto para la trazabilidad y es un rodeo cuando lo que había era una errata.

### Lo que esto nos obliga a hacer si la decisión va en serio

Nada de lo anterior se arregla solo. Que la spec siga siendo verdad exige, como mínimo, que un cambio de comportamiento no pueda entrar sin su delta, y que los escenarios que protegen las reglas caras —la distinción entre filtro inválido y filtro sin resultados, el `<` estricto del vencimiento, el día de referencia obligatorio— dejen de estar solo escritos y pasen a estar cubiertos por tests. Mientras eso no ocurra, esta decisión describe una intención, no una garantía.
