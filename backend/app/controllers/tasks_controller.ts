import Task, { DEFAULT_LIST_STATUSES, TASK_STATUSES } from '#models/task'
import {
  createTaskValidator,
  listTasksValidator,
  taskReferenceDayValidator,
  toCalendarDay,
} from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskTransformer from '#transformers/task_transformer'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiQuery,
  ApiResponse,
} from '@foadonis/openapi/decorators'

@ApiBearerAuth()
export default class TasksController {
  /**
   * La lista del espacio: una sola, la misma para todo el mundo, sin filtrar
   * por quién la pide. El responsable va precargado en la misma consulta —
   * es el 100 % de los accesos y resolverlo tarea a tarea sería el error caro
   * y evidente aquí.
   *
   * Admite acotarse por estado, y aquí hay tres caminos que no se cruzan:
   * un estado válido devuelve solo el suyo (aunque no haya ninguna, y eso es
   * una lista vacía legítima, no un error); no pedir nada devuelve lo que
   * sigue abierto; y un estado que no existe ni siquiera llega, porque el
   * validador lo corta antes con un 422. Devolverlo vacío sería el fallo
   * silencioso que esta lista no se puede permitir.
   *
   * Acotar es solo lectura: ninguna tarea cambia por consultarla.
   */
  @ApiOperation({
    summary: 'La lista compartida del espacio',
    description:
      'Devuelve el mismo conjunto para cualquier cuenta: la lista no se filtra por quién la ' +
      'pide. Sin acotar no es «todas» — lo hecho se queda fuera. Cada tarea llega con su ' +
      'responsable, y nunca con su fecha de vencimiento: para eso está la consulta de una ' +
      'tarea suelta.',
  })
  @ApiQuery({
    name: 'status',
    required: false,
    enum: [...TASK_STATUSES],
    description:
      'Acota la lista a un único estado. Su ausencia es la vista por defecto —pendientes y ' +
      'en curso—, que no es lo mismo que pedir todas.',
  })
  @ApiResponse({
    status: 200,
    description:
      'La lista del alcance pedido, entera y sin paginar, de la más reciente a la más ' +
      'antigua. Una lista vacía es una respuesta legítima y tiene la misma forma que una ' +
      'con contenido.',
    // `allOf` con un solo `$ref`, y no el `$ref` a secas: el tipo del campo
    // `schema` en el decorador es SchemaObject, que no admite referencias.
    schema: { allOf: [{ $ref: '#/components/schemas/TaskListEnvelope' }] },
  })
  @ApiResponse({
    status: 401,
    description: 'Falta el token o no es válido. No se devuelve ninguna tarea.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  async index({ request, serialize }: HttpContext) {
    const { status } = await request.validateUsing(listTasksValidator)

    const query = Task.query().preload('assignee')

    if (status) {
      query.where('status', status)
    } else {
      // Sin filtro no es «todas»: lo hecho se queda fuera.
      query.whereIn('status', [...DEFAULT_LIST_STATUSES])
    }

    const tasks = await query
      .orderBy('createdAt', 'desc')
      // Desempate estable: dos tareas creadas en el mismo milisegundo tienen
      // la misma marca de tiempo, y sin esto su orden relativo sería el que
      // quisiera la base de datos.
      .orderBy('id', 'desc')

    return serialize(TaskTransformer.transform(tasks))
  }

  /**
   * Una tarea suelta, con todo lo que tiene: es la única lectura que informa
   * del vencimiento, y por eso es la única que exige el día de quien mira.
   */
  @ApiOperation({
    summary: 'Una tarea suelta, con su vencimiento',
    description:
      'La única lectura que informa del vencimiento, y por eso la única que exige el día de ' +
      'quien mira. No comprueba quién es el responsable: cualquier cuenta con sesión la ' +
      'recibe entera.',
  })
  @ApiQuery({
    name: 'today',
    required: true,
    schema: { type: 'string', format: 'date' },
    description:
      'El día de quien consulta, en formato AAAA-MM-DD. Es obligatorio y no tiene valor por ' +
      'defecto a propósito: sustituirlo por el día del servidor daría la lectura equivocada ' +
      'a quien mire desde otro huso.',
  })
  @ApiResponse({
    status: 200,
    description:
      'La tarea con su fecha de vencimiento —o su ausencia— y su condición de vencida ya ' +
      'resuelta contra el día indicado.',
    schema: { allOf: [{ $ref: '#/components/schemas/TaskDetailEnvelope' }] },
  })
  @ApiResponse({
    status: 401,
    description: 'Falta el token o no es válido. No se devuelve ninguna tarea.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 404,
    description: 'No existe ninguna tarea con ese identificador.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 422,
    description: 'Falta el día de referencia, o no es una fecha que exista.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  async show({ params, request, serialize }: HttpContext) {
    const { today } = await request.validateUsing(taskReferenceDayValidator)
    const task = await Task.findOrFail(params.id)
    await task.load('assignee')

    return serialize(TaskDetailTransformer.transform(task, toCalendarDay(today)))
  }

  /**
   * Crear cuesta un título. El responsable y el estado no se leen de la
   * petición ni aunque vengan: los pone el sistema.
   */
  @ApiOperation({
    summary: 'Crear una tarea',
    description:
      'Crear cuesta un título. El responsable y el estado los pone el sistema y no se leen ' +
      'de la petición ni aunque vengan: la tarea nace a nombre de quien la envía, pendiente ' +
      'y sin fecha.',
  })
  @ApiBody({ type: () => createTaskValidator })
  @ApiResponse({
    status: 201,
    description: 'La tarea ya creada, a nombre de quien la envió y en estado pending.',
    schema: { allOf: [{ $ref: '#/components/schemas/TaskEnvelope' }] },
  })
  @ApiResponse({
    status: 401,
    description: 'Falta el token o no es válido. No se crea ninguna tarea.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 422,
    description:
      'El título falta, está vacío, es solo espacios o supera los 200 caracteres. No se ' +
      'crea ninguna tarea ni se guarda una versión recortada.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  async store({ request, response, auth, serialize }: HttpContext) {
    const { title } = await request.validateUsing(createTaskValidator)
    const user = auth.getUserOrFail()

    // El estado va explícito y no se deja al valor por defecto de la columna:
    // el modelo recién creado no vuelve a leerse de la base de datos, así que
    // ese defecto no llegaría a la respuesta.
    const task = await Task.create({ title, status: 'pending', assigneeId: user.id })
    await task.load('assignee')

    // El estado se marca aparte y el cuerpo se devuelve: `serialize()` entrega
    // una promesa que resuelve el pipeline al devolverla, y pasársela a
    // `response.created()` deja la respuesta con el cuerpo vacío.
    response.status(201)
    return serialize(TaskTransformer.transform(task))
  }
}
