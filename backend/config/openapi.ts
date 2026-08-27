import { defineConfig } from '@foadonis/openapi'

export default defineConfig({
  ui: 'scalar',
  document: {
    info: {
      title: 'FlowSync API',
      /**
       * La única versión que existe en el código es el `v1` del prefijo
       * `/api/v1` de `start/routes.ts`. El `1.0.0` que dejó el configure ya
       * coincide con ella, así que se conserva a propósito: subirlo dejaría al
       * documento anunciando una versión que ninguna ruta sirve.
       */
      version: '1.0.0',
    },
  },
})
