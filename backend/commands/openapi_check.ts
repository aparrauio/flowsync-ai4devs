import { join, relative } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdtemp, rm } from 'node:fs/promises'
import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'
import { buildDocumentContents, documentPath, readDocument, writeDocument } from '#openapi/document'
import { diffDocuments, isTruncated, type DocumentDifference } from '#openapi/diff'

/**
 * Comprueba que `docs/api/openapi.json` sigue siendo el documento que el código
 * produce hoy.
 *
 * Regenera el documento en un directorio temporal fuera del repositorio, lo
 * compara con el versionado y termina con código distinto de cero si no
 * coinciden. **Solo compara**: no toca las rutas ni reescribe el fichero
 * versionado, porque una comprobación que arregla lo que encuentra deja de ser
 * una comprobación —siempre pasaría—. Arreglarlo es trabajo de
 * `openapi:generate`.
 */
export default class OpenapiCheck extends BaseCommand {
  static commandName = 'openapi:check'
  static description =
    'Comprueba que docs/api/openapi.json coincide con el documento que genera el código'

  static options: CommandOptions = {
    startApp: true,
  }

  /**
   * Imprime las diferencias y deja dicho cómo se arreglan.
   */
  #reportDifferences(differences: DocumentDifference[], temporaryPath: string) {
    this.logger.error('el documento versionado no coincide con el que genera el código')

    for (const difference of differences) {
      this.logger.log(`  ${this.colors.yellow(difference.path)}: ${difference.reason}`)
    }

    if (isTruncated(differences)) {
      this.logger.log(this.colors.dim('  (lista recortada: puede haber más diferencias)'))
    }

    this.logger.log('')
    this.logger.log(`documento regenerado para la comparación: ${temporaryPath}`)
    this.logger.log('para ponerlo al día: npm run openapi:generate')
  }

  async run() {
    const path = documentPath(this.app)
    const shown = relative(process.cwd(), path)

    const versioned = await readDocument(path)
    const regenerated = await buildDocumentContents(this.app)

    /**
     * El documento regenerado se escribe siempre en una ubicación temporal, no
     * sobre el versionado. Si la comprobación falla el fichero se conserva y su
     * ruta se imprime, que es la forma de poder mirarlo entero —o diffearlo con
     * otra herramienta— sin haber tocado el repositorio.
     */
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'flowsync-openapi-'))
    const temporaryPath = join(temporaryDirectory, 'openapi.json')
    await writeDocument(temporaryPath, regenerated)

    if (versioned === null) {
      this.logger.error(`no existe ${shown}`)
      this.logger.log('')
      this.logger.log(`documento regenerado para la comparación: ${temporaryPath}`)
      this.logger.log('para crearlo: npm run openapi:generate')
      this.exitCode = 1
      return
    }

    if (versioned === regenerated) {
      await rm(temporaryDirectory, { recursive: true, force: true })
      this.logger.success(`${shown} está al día`)
      return
    }

    /**
     * Los dos son JSON generados por el mismo serializador, así que una
     * diferencia de texto es casi siempre una diferencia de contenido; pero el
     * versionado lo edita gente, y si lo han dejado ilegible hay que decir eso
     * y no fingir una comparación estructural.
     */
    let parsedVersioned: unknown
    try {
      parsedVersioned = JSON.parse(versioned)
    } catch (error) {
      this.logger.error(`${shown} no es JSON válido: ${(error as Error).message}`)
      this.logger.log('')
      this.logger.log(`documento regenerado para la comparación: ${temporaryPath}`)
      this.logger.log('para regenerarlo: npm run openapi:generate')
      this.exitCode = 1
      return
    }

    const differences = diffDocuments(parsedVersioned, JSON.parse(regenerated))

    if (differences.length === 0) {
      /**
       * Mismo contenido y distinto texto: indentación, orden de claves o el
       * salto de línea final. Sigue siendo un fallo —el fichero versionado ha
       * de ser byte a byte el que genera el comando— pero conviene nombrarlo
       * por lo que es, o quien lo lea buscará un cambio de contrato que no
       * existe.
       */
      this.logger.error(
        `${shown} tiene el mismo contenido pero distinto formato que el documento generado`
      )
      this.logger.log('')
      this.logger.log(`documento regenerado para la comparación: ${temporaryPath}`)
      this.logger.log('para ponerlo al día: npm run openapi:generate')
      this.exitCode = 1
      return
    }

    this.#reportDifferences(differences, temporaryPath)
    this.exitCode = 1
  }
}
