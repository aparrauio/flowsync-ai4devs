/**
 * Diferencias entre el documento versionado y el que el código produce hoy.
 *
 * Existe para que `openapi:check` pueda decir *qué* ha cambiado y no solo que
 * algo ha cambiado: un fallo que solo dice «los ficheros no coinciden» obliga a
 * regenerar para enterarse, y regenerar es justo lo que la comprobación no
 * puede hacer.
 */

export type DocumentDifference = {
  /** Ruta dentro del documento, en notación JavaScript: `paths./api/v1/tasks.get`. */
  path: string
  /** Qué le pasa a esa ruta, redactado desde el punto de vista del fichero versionado. */
  reason: string
}

const MAX_DIFFERENCES = 25

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Renderiza un valor para el mensaje de error. Los objetos y arrays no se
 * imprimen enteros —un `responses` completo no cabe en una línea—: se nombran
 * por su forma.
 */
function describe(value: unknown): string {
  if (isPlainObject(value)) {
    const keys = Object.keys(value)
    return `objeto con ${keys.length} clave(s)${keys.length ? `: ${keys.slice(0, 5).join(', ')}` : ''}`
  }

  if (Array.isArray(value)) {
    return `lista de ${value.length} elemento(s)`
  }

  const rendered = JSON.stringify(value) ?? String(value)
  return rendered.length > 80 ? `${rendered.slice(0, 77)}...` : rendered
}

function join(path: string, key: string | number): string {
  return path ? `${path}.${key}` : String(key)
}

function walk(
  versioned: unknown,
  regenerated: unknown,
  path: string,
  differences: DocumentDifference[]
): void {
  if (differences.length >= MAX_DIFFERENCES) return

  if (isPlainObject(versioned) && isPlainObject(regenerated)) {
    for (const key of Object.keys(versioned)) {
      if (!(key in regenerated)) {
        differences.push({
          path: join(path, key),
          reason: `sobra en el fichero versionado (${describe(versioned[key])}); el código ya no lo produce`,
        })
        continue
      }

      walk(versioned[key], regenerated[key], join(path, key), differences)
    }

    for (const key of Object.keys(regenerated)) {
      if (key in versioned) continue

      differences.push({
        path: join(path, key),
        reason: `falta en el fichero versionado (${describe(regenerated[key])}); el código lo produce y no está recogido`,
      })
    }

    return
  }

  if (Array.isArray(versioned) && Array.isArray(regenerated)) {
    if (versioned.length !== regenerated.length) {
      differences.push({
        path: path || '(raíz)',
        reason: `la lista tiene ${versioned.length} elemento(s) en el fichero versionado y ${regenerated.length} en el regenerado`,
      })
    }

    for (let index = 0; index < Math.min(versioned.length, regenerated.length); index++) {
      walk(versioned[index], regenerated[index], join(path, index), differences)
    }

    return
  }

  if (JSON.stringify(versioned) !== JSON.stringify(regenerated)) {
    differences.push({
      path: path || '(raíz)',
      reason: `versionado ${describe(versioned)}, regenerado ${describe(regenerated)}`,
    })
  }
}

/**
 * Compara los dos documentos ya parseados y devuelve las diferencias, hasta un
 * tope: pasada cierta cantidad la lista deja de informar y solo abruma.
 */
export function diffDocuments(versioned: unknown, regenerated: unknown): DocumentDifference[] {
  const differences: DocumentDifference[] = []
  walk(versioned, regenerated, '', differences)

  return differences
}

/**
 * `true` si la comparación se ha quedado en el tope y puede haber más.
 */
export function isTruncated(differences: DocumentDifference[]): boolean {
  return differences.length >= MAX_DIFFERENCES
}
