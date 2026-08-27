import { defineConfig } from '@foadonis/openapi'

export default defineConfig({
  ui: 'scalar',
  document: {
    info: {
      title: 'FlowSync API',
      /**
       * La única versión que existe en el código es el `v1` del prefijo
       * `/api/v1` de `start/routes.ts`. El `1.0.0` que dejó el configure ya
       * coincide con ella, así que se conserva a propósito: subirlo dejaría al
       * documento anunciando una versión que ninguna ruta sirve.
       */
      version: '1.0.0',
    },

    components: {
      /**
       * El nombre `bearer` no es decorativo: es el que usa `@ApiBearerAuth()`
       * al registrar el requisito de seguridad. Si no coincide, las operaciones
       * apuntan a un esquema que no existe.
       */
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          description:
            'Token opaco devuelto por `/auth/signup` y `/auth/login`, en la cabecera `Authorization: Bearer <token>`.',
        },
      },

      /**
       * Las formas compartidas viven aquí, y no repetidas en cada decorador,
       * para que la lista y la tarea suelta no puedan separarse con el tiempo.
       *
       * Se escriben a mano por una razón concreta: `Transformer.schema()`, que
       * sería el camino natural, resuelve el esquema introspeccionando el
       * modelo de Lucid y exige un `@ApiProperty` por columna. Aquí los modelos
       * no declaran columnas —las heredan de `database/schema.ts`, que es
       * generado y no se toca—, así que ese camino no está disponible sin
       * romper esa regla.
       */
      schemas: {
        /**
         * Lo justo para identificar a quien lleva la tarea. No incluye el email
         * a propósito: la tarea no debe filtrar datos de la cuenta.
         */
        TaskAssignee: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            // Nulable: hay cuentas registradas sin nombre, y entonces las
            // iniciales son lo único con lo que representarlas.
            fullName: { type: 'string', nullable: true },
            initials: { type: 'string' },
          },
          required: ['id', 'fullName', 'initials'],
        },

        /**
         * La tarea tal y como la devuelve la lista. No lleva `dueDate` ni
         * `isOverdue`, y esa ausencia es el contrato: ninguna vista construida
         * sobre la lista puede enseñar el vencimiento.
         */
        Task: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            title: { type: 'string', maxLength: 200 },
            // Los tres estados van escritos y no importados de TASK_STATUSES:
            // este fichero es configuración y se carga antes de que el
            // contenedor esté en pie, así que importar un modelo aquí arrastra
            // app/models/user.ts y rompe withAuthFinder(hash) al arrancar.
            // Son fijos por spec —ni se añaden, ni se renombran—, igual que el
            // espejo que ya mantiene el frontend en lib/types.ts.
            status: { type: 'string', enum: ['pending', 'in_progress', 'done'] },
            assignee: { $ref: '#/components/schemas/TaskAssignee' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
          },
          required: ['id', 'title', 'status', 'assignee', 'createdAt', 'updatedAt'],
        },

        /**
         * La tarea suelta: lo mismo que en la lista más su fecha y su condición
         * de vencida. Es un esquema aparte y no `Task` con campos opcionales,
         * igual que en los transformers, para que la lista no pueda prometer lo
         * que no trae.
         */
        TaskDetail: {
          allOf: [
            { $ref: '#/components/schemas/Task' },
            {
              type: 'object',
              properties: {
                // Un día del calendario, sin hora ni huso. `null` es «sin
                // fecha», un valor legítimo y no un dato a medio rellenar.
                dueDate: { type: 'string', format: 'date', nullable: true },
                // Lo resuelve el servidor contra el `today` de quien pregunta.
                // Quien consume no compara fechas: se le da hecho.
                isOverdue: { type: 'boolean' },
              },
              required: ['dueDate', 'isOverdue'],
            },
          ],
        },

        /**
         * El error que devuelve el handler genérico de AdonisJS, que **no** pasa
         * por el serializer de `providers/api_provider.ts` y por eso no tiene la
         * forma `{ errors: [...] }` del resto de la API.
         *
         * Es lo que sale de un `findOrFail()` sin fila. En producción es solo
         * esto; en desarrollo, con el debug del handler activo, la respuesta
         * añade traza y fuente, pero `message` sigue estando.
         */
        FrameworkError: {
          type: 'object',
          properties: { message: { type: 'string' } },
          required: ['message'],
        },

        /**
         * El formato de error de toda la API. `field` y `rule` solo viajan en
         * los errores de validación, que son los que se pintan bajo su campo.
         */
        ApiError: {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message: { type: 'string' },
                  rule: { type: 'string' },
                  field: { type: 'string' },
                },
                required: ['message'],
              },
            },
          },
          required: ['errors'],
        },

        /**
         * Todo lo que sale de la API pasa por el serializer de
         * `providers/api_provider.ts`, que envuelve el payload en `{ data }`.
         * El documento tiene que envolverlo también o describiría una respuesta
         * que nadie recibe.
         */
        TaskEnvelope: {
          type: 'object',
          properties: { data: { $ref: '#/components/schemas/Task' } },
          required: ['data'],
        },
        TaskListEnvelope: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Task' } },
          },
          required: ['data'],
        },
        TaskDetailEnvelope: {
          type: 'object',
          properties: { data: { $ref: '#/components/schemas/TaskDetail' } },
          required: ['data'],
        },
      },
    },
  },
})
