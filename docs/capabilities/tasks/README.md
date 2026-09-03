# Capability `tasks`

La lista de trabajo del equipo: **una sola lista compartida**, la misma para todo el mundo, donde apuntar algo cuesta escribir un título y donde el responsable y el estado de cada tarea se leen sin abrir nada. Una tarea puede además tener fecha de vencimiento, que se pone al abrirla y nunca al crearla.

> **Este README no define el comportamiento: lo indexa.**
> Las reglas viven en **[`openspec/specs/tasks/spec.md`](../../../openspec/specs/tasks/spec.md)** — 32 requisitos y 124 escenarios — y esa spec es la fuente de verdad, según el [ADR 0001](../../adr/0001-openspec-como-fuente-de-verdad.md). Aquí no se copia ni una regla: se dice **dónde está escrita** y **dónde vive en el código**, para que no haya dos textos que puedan contradecirse.
> Los enlaces van al requisito concreto por su ancla. Si un enlace no salta a ningún sitio, el requisito se ha renombrado: el nombre queda escrito al lado para poder buscarlo.

---

## Endpoints

Todos bajo `/api/v1`, declarados en [`backend/start/routes.ts`](../../../backend/start/routes.ts), todos detrás de `middleware.auth()` — requisito [*Las tareas exigen sesión*](../../../openspec/specs/tasks/spec.md#requirement-las-tareas-exigen-sesión).

| Método | Ruta | Controlador | Qué lo gobierna |
|---|---|---|---|
| `GET` | `/tasks` | [`TasksController.index`](../../../backend/app/controllers/tasks_controller.ts) | [*Una sola lista compartida del espacio*](../../../openspec/specs/tasks/spec.md#requirement-una-sola-lista-compartida-del-espacio) · [*Acotar la lista por estado*](../../../openspec/specs/tasks/spec.md#requirement-acotar-la-lista-por-estado) · [*Un filtro válido sin resultados es una lista vacía legítima*](../../../openspec/specs/tasks/spec.md#requirement-un-filtro-válido-sin-resultados-es-una-lista-vacía-legítima) · [*Un estado que no existe se rechaza, no se responde vacío*](../../../openspec/specs/tasks/spec.md#requirement-un-estado-que-no-existe-se-rechaza-no-se-responde-vacío) · [*La lista no lleva el vencimiento*](../../../openspec/specs/tasks/spec.md#requirement-la-lista-no-lleva-el-vencimiento) |
| `POST` | `/tasks` | [`TasksController.store`](../../../backend/app/controllers/tasks_controller.ts) | [*Creación de una tarea con solo el título*](../../../openspec/specs/tasks/spec.md#requirement-creación-de-una-tarea-con-solo-el-título) · [*Ninguna tarea sin título*](../../../openspec/specs/tasks/spec.md#requirement-ninguna-tarea-sin-título) · [*Aviso ante un título demasiado largo*](../../../openspec/specs/tasks/spec.md#requirement-aviso-ante-un-título-demasiado-largo) |
| `GET` | `/tasks/:id` | [`TasksController.show`](../../../backend/app/controllers/tasks_controller.ts) | [*Consulta de una tarea suelta*](../../../openspec/specs/tasks/spec.md#requirement-consulta-de-una-tarea-suelta) · [*Cuándo una tarea está vencida*](../../../openspec/specs/tasks/spec.md#requirement-cuándo-una-tarea-está-vencida) · [*El día de referencia lo pone quien mira*](../../../openspec/specs/tasks/spec.md#requirement-el-día-de-referencia-lo-pone-quien-mira) |
| `PATCH` | `/tasks/:id/status` | [`TaskStatusesController.update`](../../../backend/app/controllers/task_statuses_controller.ts) | [*Cambio de estado de cualquier tarea*](../../../openspec/specs/tasks/spec.md#requirement-cambio-de-estado-de-cualquier-tarea) · [*Tres estados fijos*](../../../openspec/specs/tasks/spec.md#requirement-tres-estados-fijos) |
| `PUT` | `/tasks/:id/due-date` | [`TaskDueDatesController.update`](../../../backend/app/controllers/task_due_dates_controller.ts) | [*Fijar, cambiar y retirar la fecha de vencimiento*](../../../openspec/specs/tasks/spec.md#requirement-fijar-cambiar-y-retirar-la-fecha-de-vencimiento) · [*Fecha de vencimiento opcional*](../../../openspec/specs/tasks/spec.md#requirement-fecha-de-vencimiento-opcional) |

Cada uno tiene endpoint propio en vez de colgar de un `update` genérico: el estado y la fecha son lo único mutable de una tarea hoy, y por un update genérico se colarían el título y el responsable, que ninguna historia ha especificado todavía.

**Los parámetros, cuerpos, códigos y formas exactas no se listan aquí**: los publica la propia API. Con el servidor arrancado, la interfaz está en **<http://localhost:3333/api>** y el documento en `/api.json` y `/api.yaml`. Sale de los decoradores de los tres controladores y de `backend/config/openapi.ts`, así que se mueve con el código.

## Reglas de negocio: dónde está cada una

Ninguna se transcribe. La columna izquierda es el requisito que la define; la derecha, el sitio del código donde vive —y donde hay que ir si se quiere cambiar—.

| Requisito | Dónde está implementada |
|---|---|
| [*Tres estados fijos*](../../../openspec/specs/tasks/spec.md#requirement-tres-estados-fijos) | `TASK_STATUSES` en [`app/models/task.ts`](../../../backend/app/models/task.ts) |
| [*Una sola lista compartida del espacio*](../../../openspec/specs/tasks/spec.md#requirement-una-sola-lista-compartida-del-espacio) (alcance por defecto y orden) | `DEFAULT_LIST_STATUSES` en [`app/models/task.ts`](../../../backend/app/models/task.ts) y el `orderBy` de `index` en [`tasks_controller.ts`](../../../backend/app/controllers/tasks_controller.ts) |
| [*Cuándo una tarea está vencida*](../../../openspec/specs/tasks/spec.md#requirement-cuándo-una-tarea-está-vencida) | `Task.isOverdueOn()` en [`app/models/task.ts`](../../../backend/app/models/task.ts) — **la única definición de «vencida» del sistema**; el frontend no compara fechas |
| [*El día de referencia lo pone quien mira*](../../../openspec/specs/tasks/spec.md#requirement-el-día-de-referencia-lo-pone-quien-mira) | `taskReferenceDayValidator` y `toCalendarDay()` en [`app/validators/task.ts`](../../../backend/app/validators/task.ts); el día lo construye `localToday()` en [`frontend/src/lib/api.ts`](../../../frontend/src/lib/api.ts) |
| [*Ninguna tarea sin título*](../../../openspec/specs/tasks/spec.md#requirement-ninguna-tarea-sin-título) · [*Aviso ante un título demasiado largo*](../../../openspec/specs/tasks/spec.md#requirement-aviso-ante-un-título-demasiado-largo) | `createTaskValidator` en [`app/validators/task.ts`](../../../backend/app/validators/task.ts) |
| [*Creación de una tarea con solo el título*](../../../openspec/specs/tasks/spec.md#requirement-creación-de-una-tarea-con-solo-el-título) (el sistema pone responsable y estado) | `store` en [`tasks_controller.ts`](../../../backend/app/controllers/tasks_controller.ts) |
| [*Lo que cada tarea muestra de su responsable*](../../../openspec/specs/tasks/spec.md#requirement-lo-que-cada-tarea-muestra-de-su-responsable) | [`TaskAssigneeTransformer`](../../../backend/app/transformers/task_assignee_transformer.ts) — deliberadamente **no** reutiliza `UserTransformer`, que trae el email |
| [*La lista no lleva el vencimiento*](../../../openspec/specs/tasks/spec.md#requirement-la-lista-no-lleva-el-vencimiento) | Dos transformers separados: [`TaskTransformer`](../../../backend/app/transformers/task_transformer.ts) para la lista y [`TaskDetailTransformer`](../../../backend/app/transformers/task_detail_transformer.ts) para la tarea suelta. La garantía es estructural: el objeto de la lista no contiene el campo |
| [*Un estado que no existe se rechaza, no se responde vacío*](../../../openspec/specs/tasks/spec.md#requirement-un-estado-que-no-existe-se-rechaza-no-se-responde-vacío) | `listTasksValidator` en [`app/validators/task.ts`](../../../backend/app/validators/task.ts) — ⚠️ **hoy no se cumple**, ver [Divergencias conocidas](#divergencias-conocidas) |
| [*Cambio de estado de cualquier tarea*](../../../openspec/specs/tasks/spec.md#requirement-cambio-de-estado-de-cualquier-tarea) · [*Fijar, cambiar y retirar la fecha*](../../../openspec/specs/tasks/spec.md#requirement-fijar-cambiar-y-retirar-la-fecha-de-vencimiento) (sin permisos por responsable) | La **ausencia** de comprobación en [`task_statuses_controller.ts`](../../../backend/app/controllers/task_statuses_controller.ts) y [`task_due_dates_controller.ts`](../../../backend/app/controllers/task_due_dates_controller.ts). Es intencionada, no un olvido |
| [*El filtro se pide en la dirección de la lista*](../../../openspec/specs/tasks/spec.md#requirement-el-filtro-se-pide-en-la-dirección-de-la-lista) · [*Una lista sin filas no significa siempre lo mismo*](../../../openspec/specs/tasks/spec.md#requirement-una-lista-sin-filas-no-significa-siempre-lo-mismo) | [`frontend/src/pages/tasks-page.tsx`](../../../frontend/src/pages/tasks-page.tsx): el filtro en `useSearchParams`, y los cuatro finales distintos de una lista sin filas |

## Las piezas

**Backend** — datos en la tabla `tasks` ([migración](../../../backend/database/migrations/1786642030284_create_tasks_table.ts) y la que [añade `due_date`](../../../backend/database/migrations/1786644500000_add_due_date_to_tasks_table.ts)); las columnas **no** se declaran en el modelo, se heredan de `database/schema.ts`, que es generado. El modelo solo aporta la relación con `User`, la regla de vencida y los dos conjuntos de estados.

```
app/models/task.ts              TASK_STATUSES, DEFAULT_LIST_STATUSES, isOverdueOn, belongsTo assignee
app/validators/task.ts          create, list, updateStatus, referenceDay, setDueDate
app/controllers/                tasks_controller · task_statuses_controller · task_due_dates_controller
app/transformers/               task_transformer · task_detail_transformer · task_assignee_transformer
```

**Frontend** — `/tasks` y `/tasks/:id` como rutas protegidas en [`routes/app-routes.tsx`](../../../frontend/src/routes/app-routes.tsx).

```
pages/tasks-page.tsx            la lista, el filtro en la URL y el alta
pages/task-page.tsx             la tarea abierta y su fecha
components/task-item.tsx        la fila, con su cambio de estado
components/task-filter.tsx      el control para acotar
lib/api.ts                      listTasks, createTask, getTask, updateTaskStatus, setTaskDueDate
lib/types.ts                    Task y TaskDetail, espejo de los dos transformers
```

## Cómo se prueba en local

### Arrancar

```bash
cd backend  && npm install && npm run dev    # http://localhost:3333
cd frontend && npm install && npm run dev    # http://localhost:5173
```

La primera vez, en `backend/`: `cp .env.example .env`, `node ace generate:key` y `node ace migration:run` (crea `tmp/db.sqlite3` y regenera `database/schema.ts`).

### Tests

```bash
cd backend
npm test                                  # las dos suites
node ace test --files=assignee            # solo el fichero de tareas
node ace test --groups="Tasks | responsable"
```

Hoy la capability tiene **un solo fichero de tests**, [`tests/functional/tasks/assignee.spec.ts`](../../../backend/tests/functional/tasks/assignee.spec.ts), con tres tests que cubren los tres escenarios del requisito [*Lo que cada tarea muestra de su responsable*](../../../openspec/specs/tasks/spec.md#requirement-lo-que-cada-tarea-muestra-de-su-responsable). De los 124 escenarios de la spec, esos tres son los únicos con red. Los tres changes de la capability renunciaron a los tests de forma explícita, y el ADR lo recoge como coste asumido.

**Cuidado con la base de datos.** `config/database.ts` define una sola conexión SQLite sin override por entorno, así que **la suite functional pega contra el mismo fichero que el servidor de desarrollo**. Un test de tareas ve las filas que hayas creado a mano, y la lista es compartida y sin scope. El fichero existente aísla con `testUtils.db().withGlobalTransaction()`, busca la tarea por su identificador en vez de asumir que es la primera, y da sufijo único a los emails para no chocar con cuentas ya committeadas. Cualquier test nuevo que escriba necesita las mismas cautelas.

### A mano, contra la API

Con el servidor arrancado, lo más cómodo es **<http://localhost:3333/api>**, que permite lanzar las peticiones desde la propia interfaz. Con `curl`, el token sale de registrarse o entrar:

```bash
TOKEN=$(curl -s -X POST http://localhost:3333/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tu@email.com","password":"tu-contraseña"}' \
  | node -pe 'JSON.parse(require("fs").readFileSync(0)).data.token')

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3333/api/v1/tasks
curl -s -H "Authorization: Bearer $TOKEN" "http://localhost:3333/api/v1/tasks/1?today=$(date +%F)"
```

`GET /tasks/:id` **exige** `today`; sin él responde `422`, y eso es deliberado.

Si tocas controladores o rutas, arranca el servidor o corre los tests para regenerar `backend/.adonisjs/` y commitea el diff.

## Divergencias conocidas

Lo que la spec exige y el código no hace. Se anota aquí para que este README no afirme algo falso, pero **la spec sigue mandando**: lo de abajo son defectos del código, no matices del contrato.

- **El filtro por un estado inventado no se rechaza.** El requisito [*Un estado que no existe se rechaza, no se responde vacío*](../../../openspec/specs/tasks/spec.md#requirement-un-estado-que-no-existe-se-rechaza-no-se-responde-vacío) exige `422`; `GET /api/v1/tasks?status=archivado` devuelve hoy `200` con una lista vacía. El commit `2ccf2c1` cambió `vine.enum(TASK_STATUSES).optional()` por `vine.string().optional()` en `listTasksValidator` cinco días después de archivar el change que lo especificaba. Efecto colateral: la rama `invalidFilter` de `tasks-page.tsx`, que pinta el mensaje de filtro inválido, es código inalcanzable desde entonces. Está analizado en el [ADR 0001](../../adr/0001-openspec-como-fuente-de-verdad.md#lo-que-nos-cuesta).
