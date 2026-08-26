import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Lo que cada tarea muestra de su responsable. Cubre los tres scenarios del
 * requisito homónimo de `openspec/specs/tasks/spec.md`: que el responsable se
 * pueda identificar, que junto a la tarea no viaje ningún dato de acceso de esa
 * cuenta, y que una cuenta sin nombre siga siendo representable.
 *
 * El aislamiento es una transacción global y no un truncate, por el mismo
 * motivo que en la suite de `auth`: la suite functional pega contra el mismo
 * fichero SQLite que el servidor de desarrollo.
 *
 * El requisito habla de «cualquier tarea, suelta o dentro de la lista», así que
 * los dos caminos que devuelven un responsable se comprueban los dos. Son
 * transformers distintos —`TaskTransformer` y `TaskDetailTransformer`— y probar
 * solo uno dejaría el otro libre de cumplirlo.
 */
test.group('Tasks | responsable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // Día de referencia fijo: `GET /api/v1/tasks/:id` lo exige, pero aquí no se
  // mira el vencimiento. Cualquier día vale mientras sea el mismo siempre.
  const HOY = '2026-08-26'

  /**
   * La primera tarea de la lista. El registro tipado de Tuyau declara la
   * respuesta de `GET /api/v1/tasks` como «una tarea o un array de tareas»
   * —`TaskTransformer.transform()` admite las dos formas—, así que hay que
   * estrechar el tipo antes de indexar.
   */
  function primeraTarea<T>(data: T | T[]): T {
    return Array.isArray(data) ? data[0] : data
  }

  /**
   * El responsable de una tarea. El registro tipado lo declara opcional porque
   * lo pone `whenLoaded()`, pero para este requisito no hay tarea sin
   * responsable: si llegara sin él no habría nada que enseñar, y eso es un
   * fallo del test, no un caso a contemplar.
   */
  function responsableDe<T>(tarea: { assignee?: T }): T {
    if (tarea.assignee === undefined) {
      throw new Error('la tarea ha llegado sin responsable')
    }

    return tarea.assignee
  }

  /**
   * Deja una tarea creada por la cuenta indicada y devuelve el token de esa
   * sesión junto con el identificador de la tarea. La tarea se crea por la API
   * y no con el modelo a propósito: así el responsable es el que el sistema le
   * pone, que es de lo que habla el requisito.
   */
  async function tareaDe(
    client: any,
    { fullName, email }: { fullName: string | null; email: string }
  ) {
    await User.create({ fullName, email, password: 'secreto123' })

    const login = await client.post('/api/v1/auth/login').json({ email, password: 'secreto123' })
    const token = login.body().data.token as string

    const creada = await client
      .post('/api/v1/tasks')
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'Revisar el informe' })

    return { token, id: creada.body().data.id as number }
  }

  test('el responsable llega con su nombre y sus iniciales', async ({ client, assert }) => {
    const { token, id } = await tareaDe(client, {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
    })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(primeraTarea(lista.body().data))
    assert.equal(enLaLista.fullName, 'Ada Lovelace')
    assert.equal(enLaLista.initials, 'AL')

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = suelta.body().data.assignee
    assert.equal(enLaTarea.fullName, 'Ada Lovelace')
    assert.equal(enLaTarea.initials, 'AL')
  })

  test('el responsable de una tarea no trae el email ni ningún dato de acceso', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, {
      fullName: 'Ada Lovelace',
      email: 'ada@example.com',
    })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(primeraTarea(lista.body().data))
    assert.notProperty(enLaLista, 'email')
    assert.notProperty(enLaLista, 'password')
    assert.notInclude(JSON.stringify(enLaLista), 'ada@example.com')

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = suelta.body().data.assignee
    assert.notProperty(enLaTarea, 'email')
    assert.notProperty(enLaTarea, 'password')
    assert.notInclude(JSON.stringify(enLaTarea), 'ada@example.com')
  })

  test('una cuenta sin nombre llega con el nombre nulo y las iniciales puestas', async ({
    client,
    assert,
  }) => {
    const { token, id } = await tareaDe(client, {
      fullName: null,
      email: 'anonima@example.com',
    })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(primeraTarea(lista.body().data))
    assert.isNull(enLaLista.fullName)
    // Las iniciales se derivan del email, pero el email no sale: eso es justo
    // lo que permite a la interfaz representar la cuenta sin recurrir a él.
    assert.equal(enLaLista.initials, 'AE')
    assert.notInclude(JSON.stringify(enLaLista), 'anonima@example.com')

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = suelta.body().data.assignee
    assert.isNull(enLaTarea.fullName)
    assert.equal(enLaTarea.initials, 'AE')
    assert.notInclude(JSON.stringify(enLaTarea), 'anonima@example.com')
  })
})
