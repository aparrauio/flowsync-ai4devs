import Task from '#models/task'
import { updateTaskStatusValidator } from '#validators/task'
import type { HttpContext } from '@adonisjs/core/http'
import TaskTransformer from '#transformers/task_transformer'
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse } from '@foadonis/openapi/decorators'

@ApiBearerAuth()
export default class TaskStatusesController {
  /**
   * El estado es lo único mutable de una tarea en este momento, y por eso
   * tiene endpoint propio en vez de colgar de un update genérico: por ese
   * update acabarían colándose el título y el responsable, que son historias
   * que todavía no se han especificado.
   *
   * Cualquier persona con sesión puede cambiar el estado de cualquier tarea,
   * en cualquier dirección. No hay permisos por responsable ni transiciones
   * prohibidas: volver de «hecho» a «pendiente» es justamente lo que arregla
   * un clic dado por error.
   */
  @ApiOperation({
    summary: 'Cambiar el estado de una tarea',
    description:
      'Admite cualquier transición entre los tres estados —incluida la vuelta desde done— a ' +
      'cualquier cuenta con sesión, sea o no la responsable. No toca el título ni el ' +
      'responsable. La respuesta es la tarea de la lista: no informa del vencimiento.',
  })
  @ApiBody({ type: () => updateTaskStatusValidator })
  @ApiResponse({
    status: 200,
    description: 'La tarea con su nuevo estado.',
    // `allOf` con un solo `$ref`, y no el `$ref` a secas: el tipo del campo
    // `schema` en el decorador es SchemaObject, que no admite referencias.
    schema: { allOf: [{ $ref: '#/components/schemas/TaskEnvelope' }] },
  })
  @ApiResponse({
    status: 401,
    description: 'Falta el token o no es válido. El estado no cambia.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 404,
    description: 'No existe ninguna tarea con ese identificador.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  @ApiResponse({
    status: 422,
    description:
      'El estado no es ninguno de los tres del dominio. La tarea conserva el que tenía y el ' +
      'estado inventado no pasa a existir.',
    schema: { allOf: [{ $ref: '#/components/schemas/ApiError' }] },
  })
  async update({ params, request, serialize }: HttpContext) {
    const task = await Task.findOrFail(params.id)
    const { status } = await request.validateUsing(updateTaskStatusValidator)

    task.status = status
    await task.save()
    await task.load('assignee')

    return serialize(TaskTransformer.transform(task))
  }
}
