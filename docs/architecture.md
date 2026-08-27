# Arquitectura de FlowSync

Este es un diagrama de contenedores (C4 nivel 2) del sistema tal y como está hoy en el
repositorio: una SPA de React que se sirve por Vite, una API HTTP de AdonisJS y un fichero
SQLite. Dentro de cada contenedor se dibujan solo las piezas que existen como ficheros y el
camino real que recorre una petición: del enrutado del navegador a `lib/api.ts`, de ahí al
stack de middleware de la API, a los controladores, sus validadores de VineJS, los modelos
de Lucid y los transformers que envuelven toda respuesta en `{ data }`. Las flechas
discontinuas son relaciones de tiempo de build, no de ejecución: las migraciones generan
`database/schema.ts`, del que heredan los modelos. Todo lo dibujado sale de leer el código;
lo que no se ha podido verificar en un fichero no aparece.

```mermaid
flowchart TB
    user(["<b>Miembro del equipo</b><br/>Navegador web"])

    subgraph spa["SPA FlowSync — React 19 + Vite 8 + Tailwind v4 · :5173"]
        direction TB
        feroutes["<b>routes/app-routes.tsx</b><br/>react-router · /login, /register,<br/>/tasks, /tasks/:id, /profile<br/>guards: protected-route, public-only-route"]
        pages["<b>pages/ + components/</b><br/>login, register, tasks, task, profile<br/>task-item, task-filter, field-error<br/>components/ui — shadcn/ui"]
        authprov["<b>auth/auth-provider.tsx</b><br/>token en localStorage 'flowsync.token'<br/>rehidrata la sesión al arrancar<br/>expuesto vía auth-context + use-auth"]
        apilib["<b>lib/api.ts</b> — único punto de contacto<br/>fetch, cabecera Bearer, desenvuelve { data }<br/>y traduce los errores a ApiError<br/><b>lib/types.ts</b> espeja los transformers a mano"]
    end

    subgraph api["API FlowSync — AdonisJS 7 + Lucid 22 + VineJS 4 · :3333"]
        direction TB
        kernel["<b>start/kernel.ts</b><br/>force_json_response, container_bindings, cors<br/>bodyparser, session, shield, initialize_auth,<br/>silent_auth · named: auth"]
        beroutes["<b>start/routes.ts</b> · prefijo /api/v1<br/>referencia #generated/controllers<br/>auth/* público · account/* y tasks/* con middleware.auth"]
        ctrls["<b>app/controllers/</b><br/>NewAccount · AccessTokens · Profile<br/>Tasks · TaskStatuses · TaskDueDates"]
        validators["<b>app/validators/</b><br/>user.ts: signup, login<br/>task.ts: create, list, updateStatus,<br/>referenceDay, setDueDate"]
        models["<b>app/models/</b><br/>User — withAuthFinder + DbAccessTokensProvider,<br/>getter initials<br/>Task — belongsTo assignee, isOverdueOn,<br/>TASK_STATUSES, DEFAULT_LIST_STATUSES"]
        transformers["<b>app/transformers/</b><br/>UserTransformer · TaskTransformer<br/>TaskDetailTransformer · TaskAssigneeTransformer"]
        serializer["<b>providers/api_provider.ts</b><br/>ApiSerializer inyecta ctx.serialize<br/>y envuelve el payload en { data }"]
        schema["<b>database/schema.ts</b> — autogenerado<br/>UserSchema · TaskSchema · AuthAccessTokenSchema"]
        migrations["<b>database/migrations/</b><br/>users · auth_access_tokens<br/>tasks · add_due_date_to_tasks"]
    end

    db[("<b>SQLite</b> — tmp/db.sqlite3<br/>better-sqlite3<br/>tablas: users, auth_access_tokens,<br/>tasks — assignee_id FK → users")]

    user -->|"usa · http://localhost:5173"| feroutes
    feroutes --> pages
    pages -->|"login, signup, logout,<br/>user, token, status"| authprov
    authprov -->|"getProfile, login,<br/>signup, logout"| apilib
    pages -->|"listTasks, createTask, getTask,<br/>updateTaskStatus, setTaskDueDate"| apilib

    apilib -->|"JSON sobre HTTP · VITE_API_URL, por defecto :3333<br/>Authorization: Bearer &lt;token&gt;<br/>POST /auth/signup · POST /auth/login<br/>GET /account/profile · POST /account/logout<br/>GET y POST /tasks · GET /tasks/:id<br/>PATCH /tasks/:id/status · PUT /tasks/:id/due-date"| kernel

    kernel --> beroutes
    beroutes -->|"despacha [controllers.X, 'metodo']"| ctrls
    ctrls -->|"request.validateUsing"| validators
    ctrls -->|"query, preload assignee,<br/>create, findOrFail, save"| models
    ctrls -->|"Transformer.transform"| transformers
    transformers --> serializer
    serializer -->|"{ data: ... }"| apilib
    models -->|"SQL vía Lucid/Knex"| db

    migrations -.->|"node ace migration:run<br/>crea las tablas y regenera"| schema
    migrations -.-> db
    schema -.->|"los modelos extienden la clase generada"| models

    classDef person fill:#08427b,stroke:#052e56,color:#ffffff
    classDef container fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef store fill:#438dd5,stroke:#2e6295,color:#ffffff
    classDef generated fill:#85bbf0,stroke:#5d82a8,color:#000000

    class user person
    class feroutes,pages,authprov,apilib,kernel,beroutes,ctrls,validators,models,transformers,serializer container
    class db store
    class schema,migrations generated
```

**Qué no está dibujado, y por qué:** el guard `web` de sesión existe en `config/auth.ts` pero
ninguna ruta lo usa; el registro Tuyau de `.adonisjs/client/registry/` solo lo consume
`tests/bootstrap.ts` para tipar el cliente de Japa — el frontend no lo importa, sus tipos
en `lib/types.ts` están escritos a mano. No hay caché, ni cola, ni servicios externos.
