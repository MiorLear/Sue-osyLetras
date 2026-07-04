# Preguntas Frecuentes — ExplorArte

Módulo de la pantalla **Preguntas Frecuentes** de la app ExplorArte, con acordeón animado y asistente de IA integrado.

## Qué incluye

- 10 preguntas frecuentes específicas de ExplorArte cargadas desde `data/faqs.json`.
- Acordeón animado: al tocar una pregunta se despliega la respuesta con transición suave.
- Asistente de IA (Claude de Anthropic) con contexto de ExplorArte para responder preguntas adicionales.
- Frontend responsive adaptado para web y móvil.

## Cómo correrlo

```bash
cp .env.example .env
# Agregar ANTHROPIC_API_KEY en .env si se quiere usar el asistente
npm start
```

Luego abrí: `http://localhost:3001`

## Cómo probarlo

```bash
npm test
```

## Estructura

```
preguntas-frecuentes/
  server.js                Backend y API REST.
  data/faqs.json           Preguntas y respuestas de ExplorArte.
  public/index.html        Vista principal.
  public/styles.css        Estilos responsive.
  public/app.js            Lógica del frontend.
  tests/smoke-test.js      Prueba básica de endpoints.
  .env.example             Plantilla de variables de entorno.
```

## Endpoints

| Método | Ruta        | Uso |
| ------ | ----------- | --- |
| GET    | `/api/faqs` | Devuelve todas las preguntas frecuentes. |
| POST   | `/api/chat` | Envía una pregunta al asistente de IA. |

## Notas

Sin `ANTHROPIC_API_KEY` configurada, el acordeón de FAQs funciona con normalidad. El asistente mostrará un mensaje indicando que no está disponible. Para conectar a la app móvil, los mismos endpoints se consumen sin cambios en el servidor.
