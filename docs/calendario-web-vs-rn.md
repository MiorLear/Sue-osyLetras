# Calendario web frente a React Native

## Conclusión

La premisa original de PWA-1.8 quedó obsoleta. La auditoría actual contó 924 líneas en `src/app/calendar.tsx` y 487 antes del trabajo responsive reciente en `web/src/routes/Calendar.tsx`, no 856 frente a 381. La diferencia procede sobre todo del estilo multilínea de React Native, no de una implementación funcional más rica.

No hay una capacidad sustancial presente solo en RN que deba portarse. La web conserva la paridad funcional y tiene defensas offline adicionales que no deben perderse al retirar Expo.

## Capacidades y decisión

| Capacidad | RN | Web | Decisión |
|---|---:|---:|---|
| Vistas día, semana y mes | Sí | Sí | Preservar y probar |
| Crear, editar y eliminar | Sí | Sí | Preservar, también offline |
| Recordatorio como texto | Sí | Sí | Preservar; no promete notificación |
| Cuatro categorías y colores | Sí | Sí | Preservar; web usa tokens compartidos |
| Tareas completables | Sí | Sí | Preservar, incluido coalescing offline |
| Inputs nativos de fecha y hora | Sí | Sí | Preservar y rechazar valores vacíos |
| Validación de título | Sí | Sí | Preservar |
| Validación fin posterior a inicio | No | Sí | Añadida como guarda de formulario |
| Estados de carga, error y vacío | Sí | Sí | Preservar; web centraliza `ContentState` |
| Todo el día | No | No | Descartado de este ticket |
| Recurrencia | No | No | Descartada de este ticket |
| Adjuntos, filtros, agenda y swipe | No | No | Funciones nuevas, fuera de paridad |
| Roles sobre eventos | No | No | La API autoriza por propietario |
| Recordatorios reales | No | No | Requieren scheduler/push y datos normalizados |

## Ventajas de la web que son invariantes

Una reescritura futura del calendario debe preservar estas doce ventajas:

1. `serverEvents` está separado de `draftEvents` y `draftRemoved`; una revalidación no puede borrar trabajo optimista.
2. Los borradores solo se pintan mientras el índice de pendientes confirma que siguen en la bandeja, evitando duplicados tras sincronizar.
3. Las tres vistas muestran el estado pendiente, con texto donde cabe y un indicador ámbar en el mes.
4. Editar, borrar o marcar un id temporal siempre pasa por el outbox; nunca se envía `tmp-*` a la API.
5. Un error de sesión (`isDeadSession`) no se encola como si fuera un fallo de red.
6. Las guardas de reentrancia impiden mutaciones duplicadas por doble pulsación.
7. `useRefetchOnDrain` revalida cuando la bandeja termina de vaciarse.
8. Las tareas publican nombre accesible y estado mediante `aria-label` y `aria-pressed`.
9. `ContentState` distingue carga, error y ausencia de caché offline.
10. `CacheAgeNote` informa cuando se está mostrando una copia antigua.
11. La caché usa `cacheKeys.events()`, con ámbito por usuaria, y no una clave literal compartida.
12. El detalle muestra las horas en formato de 12 horas.

## Capacidades descartadas y dueño futuro

| Capacidad descartada | Razón | Dueño si se retoma |
|---|---|---|
| Todo el día | Nunca existió en RN. Requiere `allDay`, migración, cambios de entidad/DTO/OpenAPI/tipos y revisar horas hoy obligatorias. | Ticket propio de producto + API + datos + clientes |
| Recurrencia | Nunca existió en RN. Requiere regla de recurrencia, expansión de ocurrencias y semántica de editar/borrar una ocurrencia o la serie, también offline. | Epic propia de producto + API + outbox + clientes |
| Adjuntos | No existe tabla ni endpoint de archivos para eventos; offline exigiría persistir bytes. | Ticket propio de medios/API/offline |
| Filtros y búsqueda | RN no los tiene y filtrar una lista cliente limitada sería engañoso. | Ticket posterior a resolver consulta/paginación de API |
| Vista agenda | Sería una vista nueva, no paridad. | Producto/web |
| Swipe y navegación avanzada | RN tampoco los implementa. | Mejora UX separada |
| Permisos por rol | El contrato actual usa `ownerUserId`, no roles. | Ticket de seguridad y autorización |
| Notificaciones reales | `reminder` es texto; no existe offset normalizado, scheduler ni Push API. | Epic de notificaciones/PWA/API |
| Tope de 200 eventos | No se cambia en PWA-1.8. | Issue nuevo de paginación/carga |

El acceptance antiguo mencionaba “all-day and recurring cases if the RN version supports them”. La condición es falsa: RN no soporta ninguno. Implementarlos aquí habría ampliado el modelo y la API, no portado comportamiento existente.
