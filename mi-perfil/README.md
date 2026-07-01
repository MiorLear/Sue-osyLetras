# Mi Perfil App

Modulo base para la pantalla **Mi Perfil**, con backend en Node.js y una vista web responsive que tambien ayuda a revisar el flujo pensado para movil.

## Que incluye

- Carga de informacion del perfil.
- Edicion de nombre, correo, telefono, rol, ubicacion y descripcion.
- Guardado de cambios en `data/profile.json`.
- Cambio de imagen de perfil usando una imagen local.
- Cierre de sesion simulado, listo para conectar con autenticacion real despues.
- Frontend web responsive para probarlo desde navegador o desde Visual Studio Code.

## Como correrlo

```bash
npm start
```

Luego abre:

```text
http://localhost:3000
```

El puerto local por defecto es `3000`, pero en un servidor real normalmente la plataforma asigna otro puerto usando la variable de entorno `PORT`. El backend ya esta preparado para eso:

```js
const PORT = Number(process.env.PORT) || 3000;
```

Eso significa que localmente usa `3000`, y en produccion usa el puerto que le entregue el hosting.

Si no tienes `npm`, tambien puedes correr directamente:

```bash
node server.js
```

## Como probarlo

```bash
npm test
```

La prueba levanta el servidor, consulta `/api/profile`, prueba `/api/logout` y cierra el proceso automaticamente.

## Estructura

```text
mi-perfil-app/
  server.js              Backend y API REST.
  data/profile.json      Datos guardados del perfil.
  public/index.html      Vista principal.
  public/styles.css      Estilos responsive.
  public/app.js          Logica del frontend y consumo de API.
```

## Endpoints principales

| Metodo | Ruta | Uso |
| --- | --- | --- |
| GET | `/api/profile` | Carga el perfil actual. |
| PUT | `/api/profile` | Guarda modificaciones del perfil. |
| PATCH | `/api/profile/avatar` | Cambia la imagen de perfil. |
| POST | `/api/logout` | Simula cierre de sesion. |

## Notas para llevarlo a movil

La logica del backend queda separada de la interfaz. Si despues hacen una app movil en React Native, Flutter u otra tecnologia, pueden consumir estos mismos endpoints y reutilizar las validaciones del servidor.

## Datos iniciales

El archivo `data/profile.json` queda limpio para entrega. En una app real, esos datos normalmente vendrian de una base de datos y del usuario autenticado.
