import User from '#models/user'
import { test } from '@japa/runner'
import testUtils from '@adonisjs/core/services/test_utils'

/**
 * Lo que cada tarea muestra de su responsable. Cubre los tres scenarios del
 * requisito homónimo de `openspec/specs/tasks/spec.md`: que el responsable se
 * pueda identificar, que junto a la tarea no viaje ningún otro dato de esa
 * cuenta, y que una cuenta sin nombre siga siendo representable.
 *
 * El aislamiento es una transacción global y no un truncate, por el mismo
 * motivo que en la suite de `auth`: la suite functional pega contra el mismo
 * fichero SQLite que el servidor de desarrollo. Pero aquí eso obliga a dos
 * cautelas más que en `auth`, que solo mira el recurso propio del token recién
 * emitido: la lista de tareas es **compartida y sin scope**, así que ya trae
 * filas de antes, y los emails registrados a mano desde el frontend sí están
 * committeados. De ahí que la tarea se busque por su identificador y que las
 * cuentas lleven sufijo único.
 *
 * El requisito habla de «cualquier tarea, suelta o dentro de la lista», así que
 * los dos caminos que devuelven un responsable se comprueban los dos. Son
 * transformers distintos —`TaskTransformer` y `TaskDetailTransformer`— y probar
 * solo uno dejaría al otro libre de cumplirlo.
 */
test.group('Tasks | responsable', (group) => {
  group.each.setup(() => testUtils.db().withGlobalTransaction())

  // Día de referencia fijo: `GET /api/v1/tasks/:id` lo exige, pero aquí no se
  // mira el vencimiento. Cualquier día vale mientras sea el mismo siempre.
  const HOY = '2026-08-26'

  /**
   * Lo único que el responsable de una tarea puede traer. Se escribe como lista
   * cerrada y no como «todo menos el email» porque el requisito dice «ningún
   * otro dato de esa cuenta, en particular su email»: el email es el ejemplo más
   * flagrante, no el único prohibido. Un `createdAt` de la cuenta colado aquí
   * incumpliría igual, y comprobar campo a campo lo prohibido no lo vería.
   */
  const CAMPOS_DEL_RESPONSABLE = ['fullName', 'id', 'initials']

  /**
   * Los campos que trae un responsable, ordenados para poder compararlos tal
   * cual. Se compara el conjunto entero y no campo a campo: así el fallo dice
   * qué ha aparecido de más, en vez de callarse ante lo que nadie previó.
   */
  function camposDe(responsable: object) {
    return Object.keys(responsable).sort()
  }

  let cuentasCreadas = 0

  /**
   * Un email que no puede chocar con nada. La transacción del test ve el estado
   * ya committeado del fichero compartido, así que un `ada@example.com` fijo
   * revienta con `UNIQUE constraint failed` en cuanto alguien se registre a mano
   * con ese email — un error de infraestructura opaco en lugar de una aserción
   * legible.
   *
   * El sufijo no altera las iniciales: salen de la primera letra del nombre de
   * usuario y de la del dominio, y ninguna de las dos se toca.
   */
  function emailUnico(base: string) {
    cuentasCreadas += 1

    return `${base}-${Date.now()}-${cuentasCreadas}@example.com`
  }

  /**
   * La tarea de la lista con este identificador. Se busca, no se indexa por
   * posición: la lista es la del espacio entero, sin filtrar por quién la pide,
   * y ya trae lo que haya creado cualquiera antes. Un `data[0]` podría dar una
   * tarea ajena, y entonces el fallo se leería como un incumplimiento del
   * requisito sin serlo.
   *
   * El registro tipado de Tuyau declara la respuesta como «una tarea o un array
   * de tareas» —`TaskTransformer.transform()` admite las dos formas—, así que
   * hay que estrechar el tipo antes de recorrerla.
   */
  function deLaLista<T extends { id: number }>(data: T | T[], id: number): T {
    const tareas = Array.isArray(data) ? data : [data]
    const tarea = tareas.find((candidata) => candidata.id === id)

    if (tarea === undefined) {
      throw new Error(`la tarea ${id} no aparece en la lista`)
    }

    return tarea
  }

  /**
   * El responsable de una tarea. El registro tipado lo declara opcional porque
   * lo pone `whenLoaded()`, pero para este requisito no hay tarea sin
   * responsable: si llegara sin él no habría nada que enseñar, y eso es un fallo
   * del test, no un caso a contemplar.
   */
  function responsableDe<T>(assignee: T | null | undefined): T {
    if (assignee === undefined || assignee === null) {
      throw new Error('la tarea ha llegado sin responsable')
    }

    return assignee
  }

  /**
   * Deja una tarea creada por la cuenta indicada. La tarea se crea por la API y
   * no con el modelo a propósito: así el responsable es el que le pone el
   * sistema, que es de lo que habla el requisito.
   *
   * Cada paso se comprueba aquí mismo. Si el login o la creación fallan por algo
   * ajeno al escenario, el test tiene que caerse en la línea que lo causa, y no
   * más tarde con un `expected 401 to equal 200` que no señala a nada.
   */
  async function tareaDe(
    client: any,
    { fullName, base }: { fullName: string | null; base: string }
  ) {
    const email = emailUnico(base)
    await User.create({ fullName, email, password: 'secreto123' })

    const login = await client.post('/api/v1/auth/login').json({ email, password: 'secreto123' })
    login.assertStatus(200)

    const token = login.body().data.token as string

    const creada = await client
      .post('/api/v1/tasks')
      .header('Authorization', `Bearer ${token}`)
      .json({ title: 'Revisar el informe' })

    creada.assertStatus(201)

    return { token, email, id: creada.body().data.id as number }
  }

  test('el responsable llega con su nombre y sus iniciales', async ({ client, assert }) => {
    const { token, id } = await tareaDe(client, { fullName: 'Ada Lovelace', base: 'ada' })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(deLaLista(lista.body().data, id).assignee)
    assert.equal(enLaLista.fullName, 'Ada Lovelace')
    assert.equal(enLaLista.initials, 'AL')

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = responsableDe(suelta.body().data.assignee)
    assert.equal(enLaTarea.fullName, 'Ada Lovelace')
    assert.equal(enLaTarea.initials, 'AL')
  })

  test('el responsable de una tarea no trae el email ni ningún otro dato de la cuenta', async ({
    client,
    assert,
  }) => {
    const { token, email, id } = await tareaDe(client, { fullName: 'Ada Lovelace', base: 'ada' })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(deLaLista(lista.body().data, id).assignee)
    assert.notProperty(enLaLista, 'email')
    assert.notProperty(enLaLista, 'password')
    assert.notInclude(JSON.stringify(enLaLista), email)
    assert.deepEqual(camposDe(enLaLista), CAMPOS_DEL_RESPONSABLE)

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = responsableDe(suelta.body().data.assignee)
    assert.notProperty(enLaTarea, 'email')
    assert.notProperty(enLaTarea, 'password')
    assert.notInclude(JSON.stringify(enLaTarea), email)
    assert.deepEqual(camposDe(enLaTarea), CAMPOS_DEL_RESPONSABLE)
  })

  test('una cuenta sin nombre llega con el nombre nulo y las iniciales puestas', async ({
    client,
    assert,
  }) => {
    const { token, email, id } = await tareaDe(client, { fullName: null, base: 'anonima' })

    const lista = await client.get('/api/v1/tasks').header('Authorization', `Bearer ${token}`)

    lista.assertStatus(200)
    const enLaLista = responsableDe(deLaLista(lista.body().data, id).assignee)
    assert.isNull(enLaLista.fullName)
    // Las iniciales se derivan del email, pero el email no sale: eso es justo
    // lo que permite a la interfaz representar la cuenta sin recurrir a él.
    assert.equal(enLaLista.initials, 'AE')
    assert.notInclude(JSON.stringify(enLaLista), email)

    const suelta = await client
      .get(`/api/v1/tasks/${id}`)
      .qs({ today: HOY })
      .header('Authorization', `Bearer ${token}`)

    suelta.assertStatus(200)
    const enLaTarea = responsableDe(suelta.body().data.assignee)
    assert.isNull(enLaTarea.fullName)
    assert.equal(enLaTarea.initials, 'AE')
    assert.notInclude(JSON.stringify(enLaTarea), email)
  })
})
