# Foro Comunitario — ExplorArte

Módulo del Foro de la app ExplorArte para maestras. Permite publicar hilos, comentar, reaccionar y recibir notificaciones, con soporte completo para modo sin conexión.

## Qué incluye

- Publicación de hilos y comentarios por cualquier maestra o admin.
- 5 tipos de reacciones positivas: 👍 Me gusta, ❤️ Me encanta, 👏 Aplauso, ✅ De acuerdo, 😊 Feliz.
- Toggle de reacciones — reaccionar dos veces quita la reacción.
- Eliminación de propios posts/comentarios; el admin puede eliminar cualquiera.
- Notificaciones en app y push nativas (Android/iOS/web) cuando alguien comenta o reacciona.
- **Modo offline completo**: las publicaciones, comentarios y reacciones se guardan localmente y se sincronizan automáticamente en segundo plano cuando vuelve el internet.
- CSS optimizado para iOS (safe-area, no-zoom en inputs), Android y desktop. Dark mode automático.

## Cómo correrlo

```bash
npm start
```

Abrí: `http://localhost:3002`

## Cómo probarlo

```bash
npm test
```

El smoke test cubre: listar hilos, crear hilo, comentar, reaccionar, notificaciones, sync offline y eliminación.

## Estructura

```
foro/
  server.js                  Backend — API REST completa
  data/foro.json             Hilos y comentarios
  data/notificaciones.json   Notificaciones por usuario
  public/index.html          Vista principal
  public/css/foro.css        Estilos (iOS + Android + web + dark mode)
  public/js/foro.js          Lógica del foro
  public/js/offline.js       Cola offline y notificaciones push
  tests/smoke-test.js        Prueba de todos los endpoints
```

## Endpoints

| Método | Ruta | Uso |
|--------|------|-----|
| GET | `/api/foro/hilos` | Listar hilos |
| POST | `/api/foro/hilos` | Crear hilo |
| DELETE | `/api/foro/hilos/:id` | Eliminar hilo |
| POST | `/api/foro/hilos/:id/comentarios` | Comentar |
| DELETE | `/api/foro/hilos/:hiloId/comentarios/:comId` | Eliminar comentario |
| POST | `/api/foro/hilos/:id/reacciones` | Reaccionar a hilo |
| POST | `/api/foro/hilos/:hiloId/comentarios/:comId/reacciones` | Reaccionar a comentario |
| GET | `/api/foro/notificaciones/:uid` | Ver notificaciones |
| POST | `/api/foro/notificaciones/:uid/leer` | Marcar como leídas |
| POST | `/api/foro/sync` | Sincronizar acciones offline |

## Headers de autenticación

Cada request debe incluir:
```
X-User-Uid: uid-del-usuario
X-User-Nombre: Nombre Apellido
X-User-Rol: maestra | admin
```

En producción estos vienen del token de auth verificado en el servidor.

## Cómo funciona el modo offline

1. `offline.js` detecta la conexión con los eventos `online`/`offline` del navegador.
2. Cuando no hay internet, las acciones se guardan en `localStorage` con timestamp.
3. Al recuperar conexión, se llama automáticamente a `POST /api/foro/sync` con todas las acciones pendientes.
4. El servidor las procesa en orden y responde cuáles tuvieron éxito.
5. El frontend recarga los hilos para mostrar el contenido actualizado.
