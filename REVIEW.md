# Instrucciones de revisión

Solo para revisar cambios. No describe cómo se trabaja en el repo —eso es `CLAUDE.md`— ni sustituye
a la spec: el árbitro sigue siendo `openspec/specs/`.

## Qué es un hallazgo grave

Solo estas cinco cosas. Si no encaja en una, no es grave:

1. **Contradice un scenario de `openspec/specs/`.** Se cita el scenario y la entrada que lo rompe.
2. **Fuga de datos de cuenta.** Cualquier campo de `User` que salga en una respuesta sin pasar por un
   transformer que lo recorte: el email es el caso vivo.
3. **Ruta sin la protección que le toca.** Una ruta que debería colgar de `middleware.auth()` y no
   cuelga, o un recurso de un equipo accesible desde otra sesión.
4. **El contrato promete lo que el código no hace.** `docs/api/openapi.json` o el README de la
   capability afirmando un código, un campo o una forma que el controlador no devuelve.
5. **Pérdida o corrupción de datos.** Una migración destructiva, una escritura sin validar, un
   `save()` que pisa lo que otro acaba de escribir.

Todo lo demás es **sugerencia**: nombres, estructura, duplicación, comentarios, orden de
comprobaciones, rendimiento sin medir, cobertura de tests que el cambio no prometía. Una sugerencia
no bloquea; se dice y se sigue.

## Tope de sugerencias

Máximo **cinco** sugerencias detalladas por revisión, las de más valor. El resto **no se enumera**:
una sola línea final con el recuento por categoría —`otras 7: 4 de nombres, 2 de duplicación,
1 de comentarios`— y se acabó. Una lista de veinte apuntes menores entierra el hallazgo grave que
importa; ese es justo el fallo que estas instrucciones existen para evitar.

## Dónde no se reporta

- **Lo que ya vigila otra comprobación**: formato (Prettier), lint (`eslint` en backend, `oxlint` en
  frontend), tipos (`tsc --noEmit` y `npm run build`), y el desfase del documento OpenAPI versionado
  (`npm run openapi:check`, que corre en CI). Si un fallo lo caza un comando del repo, decirlo aquí
  es ruido: el comando ya falla solo.
- **Código generado**: `backend/.adonisjs/`, `backend/database/schema.ts` (se regenera desde las
  migraciones, no se escribe), `frontend/src/components/ui/` (shadcn, no se edita a mano).
- **Ficheros de bloqueo** (`package-lock.json`) y todo lo de `backend/tmp/`.
- **Estilo de la prosa** en `docs/`, `README.md` y mensajes de commit.
- **Deuda que el cambio no ha tocado ni ha empeorado.** Un defecto preexistente solo se menciona si
  el cambio lo agrava o depende de él.

## Cómo se afirma algo

Toda afirmación sobre cómo se comporta el código lleva **`archivo:línea` de donde se ha leído**. Sin
cita, no se afirma.

- No se deduce el comportamiento del nombre de una función, de un validador ni de un fichero:
  `listTasksValidator` suena a que valida la lista de estados y resulta que es `vine.string()`.
- No se da por hecho que un test cubre lo que su título dice: se abre y se mira qué asserta.
- Lo que no se haya podido comprobar se marca como **no verificado**, con lo que faltó por mirar. Una
  duda declarada vale; una certeza inventada, no.
