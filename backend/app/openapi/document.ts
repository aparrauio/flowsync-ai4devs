import { dirname } from 'node:path'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Construcción y escritura del documento OpenAPI como fichero versionado.
 *
 * El documento se sigue construyendo en cada petición desde el router —eso no
 * cambia—, pero `openapi:generate` lo vuelca además a `docs/api/openapi.json`
 * para que exista sin servidor delante, y `openapi:check` compara lo que el
 * código produce hoy con ese fichero. Los dos comandos comparten este módulo
 * para que no haya dos formas distintas de serializar el mismo documento: si
 * la generación y la comprobación no coinciden al carácter, la comprobación no
 * verifica nada.
 */

/**
 * Ruta del documento versionado, relativa a la raíz de la aplicación
 * AdonisJS. `docs/` cuelga de la raíz del monorepo y `app.makePath()` cuelga de
 * `backend/`, de ahí el salto hacia arriba.
 */
export const DOCUMENT_RELATIVE_PATH = '../docs/api/openapi.json'

/**
 * Ruta absoluta del documento versionado.
 */
export function documentPath(app: ApplicationService): string {
  return app.makePath(DOCUMENT_RELATIVE_PATH)
}

/**
 * Construye el documento y lo serializa tal y como se versiona: JSON indentado
 * a dos espacios y con salto de línea final, para que el fichero se lea y se
 * diffee como cualquier otro del repositorio.
 */
export async function buildDocumentContents(app: ApplicationService): Promise<string> {
  /**
   * El documento se construye recorriendo `router.toJSON()`, y el router no
   * publica sus rutas hasta que se le hace `commit()`. En el servidor lo hace
   * el arranque HTTP; en un comando no hay arranque HTTP, así que sin esto el
   * documento saldría con `paths: {}`. Es lo mismo que hace `list:routes`.
   */
  const router = await app.container.make('router')
  router.commit()

  const openapi = await app.container.make('openapi')
  const document = await openapi.buildDocument()

  return `${JSON.stringify(document, null, 2)}\n`
}

/**
 * Escribe el documento en `path`, creando el directorio si hace falta.
 */
export async function writeDocument(path: string, contents: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, contents, 'utf-8')
}

/**
 * Lee el documento versionado. Devuelve `null` si todavía no existe, que es un
 * resultado legítimo —y distinto de un fichero vacío o corrupto— para quien
 * comprueba.
 */
export async function readDocument(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null
    }

    throw error
  }
}
