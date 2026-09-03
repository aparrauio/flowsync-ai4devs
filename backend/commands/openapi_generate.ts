import { relative } from 'node:path'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { buildDocumentContents, documentPath, readDocument, writeDocument } from '#openapi/document'

/**
 * Escribe en `docs/api/openapi.json` el mismo documento que la aplicación sirve
 * en `/api.json`.
 *
 * Necesita la aplicación arrancada (`startApp`) porque el documento no es un
 * fichero de configuración: se construye recorriendo el router ya cargado y
 * leyendo los decoradores de los controladores a los que apunta.
 */
export default class OpenapiGenerate extends BaseCommand {
  static commandName = 'openapi:generate'
  static description = 'Genera el documento OpenAPI y lo escribe en docs/api/openapi.json'

  static options: CommandOptions = {
    startApp: true,
  }

  async run() {
    const path = documentPath(this.app)
    const contents = await buildDocumentContents(this.app)
    const previous = await readDocument(path)

    await writeDocument(path, contents)

    const shown = relative(process.cwd(), path)

    if (previous === null) {
      this.logger.success(`documento OpenAPI creado en ${shown}`)
      return
    }

    if (previous === contents) {
      this.logger.info(`documento OpenAPI ya al día en ${shown}`)
      return
    }

    this.logger.success(`documento OpenAPI actualizado en ${shown}`)
  }
}
