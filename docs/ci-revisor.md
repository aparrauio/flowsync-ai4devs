# El revisor en CI: qué falta por hacer y en qué se va el dinero

El trabajo vive en [`.github/workflows/review.yml`](../.github/workflows/review.yml) y lanza la
[acción oficial de Claude Code para GitHub Actions](https://docs.claude.com/en/docs/claude-code/github-actions)
sobre cada pull request. Publica los hallazgos como comentarios en línea en el propio PR, con un
comentario de seguimiento del progreso. No edita ficheros, no commitea y no aprueba ni bloquea el
merge.

El fichero, tal y como está commiteado, **no funciona todavía**: le falta la credencial, y esa es la
parte que nadie puede automatizar por ti.

## Pasos manuales pendientes

### 1. Elegir credencial y guardarla como secreto

Hay dos caminos y **no son intercambiables**. Cada uno usa una entrada distinta de la acción y un
nombre de secreto distinto.

**Camino 1 — suscripción (el que el workflow trae puesto).** Con una suscripción Pro o Max, en local:

```bash
claude setup-token
```

Copia el token que imprime y guárdalo en el repositorio, en **Settings → Secrets and variables →
Actions → New repository secret**, con el nombre exacto:

| | |
|---|---|
| Nombre del secreto | `CLAUDE_CODE_OAUTH_TOKEN` |
| Entrada de la acción | `claude_code_oauth_token` |
| Se paga con | tu suscripción de Claude |

Es lo que el workflow ya referencia. Si eliges este camino, no hay que tocar el YAML.

**Camino 2 — clave de API de la consola.** Crea una clave en
[console.anthropic.com](https://console.anthropic.com/) y guárdala como secreto:

| | |
|---|---|
| Nombre del secreto | `ANTHROPIC_API_KEY` |
| Entrada de la acción | `anthropic_api_key` |
| Se paga con | el saldo de la organización en la consola, por tokens consumidos |

Con este camino **hay que editar el workflow**: sustituir la línea

```yaml
claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}
```

por

```yaml
anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}
```

> **Cruzarlos falla en la primera llamada y el mensaje no explica por qué.** Poner un token de
> `setup-token` en `anthropic_api_key`, o una clave de API en `claude_code_oauth_token`, produce un
> error de autenticación en la primera petición al modelo: la acción arranca, instala, hace el
> checkout y muere ahí, sin decir que el problema es que la credencial está en la entrada
> equivocada. Si el trabajo falla nada más empezar a pensar, es lo primero que hay que mirar.

### 2. Comprobar que el trabajo puede escribir en los PR

El workflow pide `pull-requests: write` a nivel de trabajo, pero un repositorio puede tener el
permiso máximo recortado. En **Settings → Actions → General → Workflow permissions**, el ajuste ha de
permitir escritura; si está en solo lectura, el trabajo no puede elevarse por su cuenta y los
comentarios no se publican.

### 3. Probarlo con un PR de verdad

Abre un pull request pequeño desde una rama **de este repositorio** (ver el apartado de forks) y
comprueba que aparecen el comentario de seguimiento y los hallazgos en línea. Es la única forma de
saber que el secreto está bien puesto.

## Pull requests desde un fork (repositorio público)

**No se revisan, a propósito.** Dos motivos, y el primero es de GitHub, no nuestro:

1. Un `pull_request` disparado desde un fork **no recibe los secretos del repositorio**. El revisor
   se quedaría sin credencial: no es que revise peor, es que no puede arrancar.
2. La acción, además, solo se ejecuta para autores con permiso de escritura en el repositorio.

Por eso el trabajo lleva una condición que lo salta cuando la rama del PR viene de otro repositorio:

```yaml
if: github.event.pull_request.head.repo.full_name == github.repository
```

Así ese caso se lee como «no se ha revisado» y no como una revisión que falla. Hacer que funcione
con forks exige `pull_request_target` o `workflow_run`, que ejecutan con los secretos del repositorio
base sobre código que ha escrito otra persona; eso es un cambio de modelo de amenaza, no un ajuste
de configuración, y no se hace sin leer antes la
[guía de seguridad de la acción](https://github.com/anthropics/claude-code-action/blob/main/docs/security.md).

## En qué se va el dinero

El gasto es el de una conversación de Claude Code por cada PR revisado: se paga por los tokens que el
revisor lee y escribe, no por minuto de runner. Los precios cambian, así que aquí no hay ninguna
cifra: están en la
[página oficial de precios de la API](https://docs.claude.com/en/docs/about-claude/pricing) y, para
las suscripciones, en [claude.com/pricing](https://claude.com/pricing).

Lo que el workflow fija hoy, en `claude_args`:

| Ajuste | Valor | Por qué |
|---|---|---|
| `--model` | `sonnet` | El modelo económico de la familia. Una revisión de diff es lectura y contraste contra una spec, no diseño: es donde mejor sale la cuenta. Es además el modelo que declara el propio `.claude/agents/adversarial-reviewer.md`, así que CI y local revisan con lo mismo. |
| `--effort` | `medium` | Razonamiento intermedio. Menos gasta menos y se le escapan cosas; más encarece cada PR. |
| `--max-turns` | `40` | Tope duro de turnos. Es lo que impide que una revisión se enrede y se coma el presupuesto de la semana. |
| `timeout-minutes` | `10` | Tope de reloj del trabajo, independiente del anterior. Si se cuelga, se corta. |

Dos detalles que **también** son dinero, aunque no lo parezcan:

- `Read`, `Grep` y `Glob` están en la lista de herramientas permitidas porque sin ellas el revisor no
  puede abrir ni su fichero de calibración ni un solo fichero del cambio. Cada intento denegado
  consume uno de los 40 turnos sin producir nada.
- El prompt le prohíbe redirigir salida a ficheros (`> salida.txt`, `| tee`) y le pide leer la salida
  directa: escribir para volver a leer gasta dos turnos donde bastaba uno.

### Cómo cambiarlo

Se toca una sola línea de `.github/workflows/review.yml`, la de `claude_args`:

```yaml
claude_args: >-
  --model sonnet
  --effort medium
  --max-turns 40
  --allowedTools "Read,Grep,Glob,..."
```

- **Más barato**: `--model haiku`, o bajar `--effort` a `low`, o recortar `--max-turns`.
- **Más a fondo**: `--model opus` y `--effort high`. Sube el coste por PR de forma notable; tiene
  sentido reservarlo, si acaso, para un workflow aparte que se dispare a mano o por etiqueta, en vez
  de en cada push a cada rama.
- **Menos ejecuciones**: quitar `synchronize` de los `types` del disparador hace que el revisor corra
  al abrir el PR y no en cada push posterior. Es la palanca que más ahorra si el equipo empuja muchas
  veces por PR.
