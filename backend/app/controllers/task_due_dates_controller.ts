import Task from '#models/task'
import { setTaskDueDateValidator, toCalendarDay } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskDetailTransformer from '#transformers/task_detail_transformer'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@foadonis/openapi/decorators'

@ApiBearerAuth()
export default class TaskDueDatesController {
  /**
   * Fijar, cambiar y retirar la fecha de vencimiento son la misma operación, y
   * por eso comparten endpoint: quitar la fecha no es borrar un recurso, es
   * poner el valor «sin fecha», que es un valor legítimo del campo.
   *
   * Endpoint propio en vez de un update genérico de la tarea, por el mismo
   * motivo que el estado: por ahí se colarían el título y el responsable, que
   * este change no permite tocar.
   *
   * Cualquiera con sesión puede cambiar la fecha de cualquier tarea, igual que
   * el estado. No se comprueba quién es el responsable.
   */
  @ApiOperation({
    summary: 'Fijar, cambiar o retirar la fecha de vencimiento',
    description:
      'Las tres son la misma operación: retirar la fecha es enviar dueDate a null, que es un ' +
      'valor legítimo del campo y no un error. Lleva también el día de referencia porque la ' +
      'respuesta devuelve la condición de vencida ya resuelta, de modo que aplazar una tarea ' +
      'vencida deje de mostrarla vencida en esta misma respuesta.',
  })
  // El esquema va escrito y no sale de `setTaskDueDateValidator`, que es lo
  // que hacen los otros dos endpoints. El JSON Schema que VineJS genera para
  // `vine.date()` sale vacío, y el de `vine.date().nullable()` se queda en
  // `{ type: "null" }` — es decir, describiría un `dueDate` que solo admite
  // nulo, justo al revés de lo que hace el endpoint.
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        today: {
          type: 'string',
          format: 'date',
          description: 'El día de quien pide, en AAAA-MM-DD.',
        },
        dueDate: {
          type: 'string',
          format: 'date',
          nullable: true,
          description:
            'El día de vencimiento, en AAAA-MM-DD. `null` retira la fecha, y es una ' +
            'operación normal: no hay endpoint aparte para borrarla.',
        },
      },
      required: ['today', 'dueDate'],
      additionalProperties: false,
    },
  })
  @ApiResponse({
    status: 200,
    description: 'La tarea con su nueva fecha y su condición de vencida recalculada.',
    // `allOf` con un solo `$ref`, y no el `$ref` a secas: el tipo del campo
    // `schema` en el decorador es SchemaObject, que no admite referencias.
    schema: { allOf: [{ $ref: '#/components/schemas/TaskDetailEnvelope' }] },
  })
  @ApiResponse({
    status: 401,
    description: 'Falta el token o no es válido. La fecha no cambia.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 404,
    description:
      'No existe ninguna tarea con ese identificador. Lo lanza `findOrFail()` y lo atiende ' +
      'el handler genérico, así que es el único error de la capability que no llega con la ' +
      'forma { errors: [...] }.',
    schema: { allOf: [{ $ref: '#/components/schemas/FrameworkError' }] },
  })
  @ApiResponse({
    status: 422,
    description:
      'La fecha o el día de referencia no existen o están mal formados. La tarea conserva ' +
      'intacta la fecha que tuviera.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  async update({ params, request, serialize }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    const { today, dueDate } = await request.validateUsing(setTaskDueDateValidator)

    // El `DateTime` del validador se queda aquí: hacia dentro, una fecha de
    // vencimiento es un día en texto y nunca un instante.
    task.dueDate = dueDate === null ? null : toCalendarDay(dueDate)
    await task.save()
    await task.load('assignee')

    // Se devuelve ya resuelta contra el día de quien pide, para que aplazar una
    // tarea vencida deje de mostrarla vencida en esta misma respuesta.
    return serialize(TaskDetailTransformer.transform(task, toCalendarDay(today)))
  }
}
