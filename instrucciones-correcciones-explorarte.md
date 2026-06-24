# Instrucciones de corrección: ExplorArte (React Native)

## Contexto del proyecto

Tienes un proyecto React Native que es un clon de un diseño Figma Make de la app **ExplorArte**, plataforma de acompañamiento socioemocional para docentes creada por Sueños y Letras.

La estructura de archivos actual incluye (al menos):
- `screens/HomeScreen.tsx`
- `screens/ModulesScreen.tsx`
- `screens/ModuleScreen.tsx` (detalle de módulo)
- `screens/ForoScreen.tsx`
- `screens/CalendarScreen.tsx`
- `screens/ProfileScreen.tsx`
- `screens/FAQScreen.tsx`
- `screens/LoginScreen.tsx`
- `screens/RegisterScreen.tsx`
- `screens/ForgotPasswordScreen.tsx`
- `components/BottomNav.tsx`
- `routes.tsx` o equivalente de navegación

El diseño visual actual funciona bien (colores teal/verde, tarjetas con emojis de emociones, tipografía limpia). **No toques los estilos base ni el sistema de colores.** Solo aplica los cambios de contenido, estructura y terminología descritos aquí.

---

## Problema estratégico a corregir

La app actualmente parece una **plataforma de cursos sobre emociones**. El objetivo es que se convierta en una **plataforma de acompañamiento para docentes**.

El cambio más importante es de lenguaje y arquitectura: una docente no piensa "quiero ver el módulo 1", piensa:
- "Tengo un estudiante que está triste"
- "Necesito una actividad rápida para mañana"
- "Quiero trabajar empatía con mi grupo"

Toda la arquitectura debe responder a esas necesidades.

---

## CAMBIO 1: Terminología global (buscar y reemplazar)

En **todos los archivos** del proyecto, reemplaza los siguientes términos en textos visibles para el usuario (labels, títulos, botones, placeholders). **No renombres variables o props de código** a menos que se indique explícitamente.

| Texto actual | Reemplazar con |
|---|---|
| "Mis Módulos" | "Explora según tu necesidad" |
| "Ver Módulos" | "Explorar recursos" |
| "Módulo" / "módulo" | "recurso" (en contexto de navegación principal) |
| "Sesión" / "sesión" | eliminar o reemplazar según contexto |
| "Manual" / "manual" | usar solo en sección "Caja de herramientas" |
| "Foro" | "Comunidad ExplorArte" |
| "Ver Foro" | "Ver comunidad" |

---

## CAMBIO 2: Crear OnboardingScreen (pantalla pre-login)

Esta pantalla se muestra **antes de iniciar sesión**, la primera vez que el usuario abre la app (o si no hay sesión activa). Es una pantalla scrollable con 3 secciones y un CTA al login.

Crea `screens/OnboardingScreen.tsx`:

### Sección 1 — Hero

```
[Fondo teal, logo de Sueños y Letras centrado o en esquina]

Bienvenida a ExplorArte

Lectura, arte y emociones para construir
comunidades de aprendizaje más saludables.

Acompañamos a docentes con recursos prácticos para promover
el bienestar emocional, la creatividad y el desarrollo
socioemocional de niñas, niños y adolescentes.

[Placeholder de video — rectángulo con ícono ▶ y texto:]
"Video de bienvenida del equipo de Sueños y Letras"
```

### Sección 2 — ¿Qué es ExplorArte?

```
¿Qué es ExplorArte?

ExplorArte es una metodología creada por Sueños y Letras para fortalecer
la salud mental y el bienestar emocional en comunidades educativas a través
de la lectura, el arte y experiencias participativas.

Trabajamos desde tres pilares fundamentales:

[3 tarjetas, una por pilar:]

🧠 Salud mental
Promovemos herramientas que fortalecen el bienestar psicológico y emocional.

💚 Desarrollo emocional
Facilitamos espacios para reconocer, comprender y expresar emociones de manera saludable.

🤝 Desarrollo social
Fortalecemos habilidades que favorecen relaciones positivas y comunidades más empáticas.
```

### Sección 3 — ¿Cómo funciona?

```
¿Cómo funciona?

[4 pasos numerados:]

1. Reconocer
   Comprender emociones, pensamientos y comportamientos.

2. Expresar
   Utilizar la lectura, el arte y el diálogo para expresar experiencias y emociones.

3. Conectar
   Fortalecer la empatía, la convivencia y las relaciones saludables.

4. Crecer
   Desarrollar herramientas para el bienestar personal y comunitario.
```

### CTA al fondo

```
[Botón primario:] "Comenzar"  → navega a LoginScreen
[Botón outline:]  "Ya tengo cuenta — Iniciar sesión"  → navega a LoginScreen
```

> Esta pantalla reemplaza a cualquier pantalla de bienvenida o splash existente. Solo se muestra si no hay sesión activa. Si el usuario ya está autenticado, la app debe navegar directamente a `MainScreen`.

---

## CAMBIO 3 (antes CAMBIO 2): HomeScreen → renombrar a MainScreen

El `HomeScreen.tsx` actual (que muestra "Bienvenida + Mis Módulos + Foro + Calendario") se convierte en la pantalla principal **post-login**. Renómbralo a `MainScreen.tsx` y reemplaza su contenido con:

### Encabezado de bienvenida

```
[Header con fondo teal]

Sueños y Letras

Bienvenida,
[nombre de la usuaria]   ← del contexto de autenticación
```

### Sección — Explora según tu necesidad

```
Explora según tu necesidad

[Cards de navegación — una por sección, con ícono + título + descripción corta + botón:]

📚 Biblioteca de emociones
Recursos para acompañar emociones específicas en el aula.
[Botón:] "Explorar emociones"  → BibliotecaDeEmocioneScreen

🧰 Caja de herramientas docente
Manuales, materiales descargables y herramientas prácticas.
[Botón:] "Ver herramientas"  → CajaDeHerramientasScreen

🌱 Aprendiendo sobre bienestar emocional
Conceptos y estrategias para el acompañamiento socioemocional.
[Botón:] "Explorar contenidos"  → AprendiendoBienestarScreen

💬 Comunidad ExplorArte
Comparte experiencias con otras docentes.
[Botón:] "Ver comunidad"  → ComunidadExplorArteScreen

ℹ️ Sobre ExplorArte
Conoce más sobre la metodología y Sueños y Letras.
[Botón:] "Conocer más"  → SobreExplorArteScreen
```

> El bloque "Mi Calendario" puede mantenerse debajo si ya existe. El bloque "Foro" con posts del home puede eliminarse o convertirse en un preview pequeño de "Comunidad" con los últimos 2 posts.

---

## CAMBIO 4: Renombrar ModulesScreen → BibliotecaDeEmocioneScreen

Renombra el archivo `ModulesScreen.tsx` → `BibliotecaDeEmocioneScreen.tsx` y reemplaza todo su contenido con la siguiente estructura:

### Encabezado de sección

```
[Header con fondo teal]
Biblioteca de emociones

[Texto introductorio:]
Las emociones forman parte de nuestra vida cotidiana. Reconocerlas, nombrarlas
y comprenderlas es el primer paso para desarrollar bienestar emocional y construir
relaciones saludables.

Esta sección reúne recursos para comprender distintas emociones y acompañar
conversaciones significativas dentro del aula.

[Placeholder de video:]
"Video de introducción – ¿Por qué es importante reconocer las emociones?"
(~1 minuto)
```

### Grid de emociones

Muestra **8 tarjetas de emoción** en un grid (2 columnas en móvil), cada una con emoji grande + nombre:

```
😊 Alegría      😢 Tristeza
😠 Enojo        😨 Miedo
😤 Frustración  😳 Vergüenza
😞 Decepción    😰 Ansiedad
```

Cada tarjeta tiene fondo de color suave diferente (puedes usar los colores existentes del proyecto) y al tocarse navega a `EmotionDetailScreen` pasando el nombre de la emoción como parámetro.

---

## CAMBIO 5: Crear EmotionDetailScreen (nueva pantalla)

Crea `screens/EmotionDetailScreen.tsx`. Recibe un parámetro `emotion` con el nombre de la emoción. Estructura:

```
[Header con fondo teal]
[Emoji grande]  [Nombre de la emoción]

─────────────────────────────────
¿Qué es esta emoción?
[Texto descriptivo placeholder — puede ser hardcoded por ahora]

─────────────────────────────────
¿Cómo puede verse en el aula?
[Texto placeholder]

─────────────────────────────────
Preguntas para conversar
• [Pregunta 1]
• [Pregunta 2]
• [Pregunta 3]

─────────────────────────────────
Actividades recomendadas
[Lista de actividades o cards pequeñas]

─────────────────────────────────
Historias sugeridas
[Lista de libros/cuentos relacionados]
```

Por ahora usa contenido placeholder real pero básico para cada emoción. Puedes usar este contenido mínimo:

```js
const emotionData = {
  'Alegría': {
    description: 'La alegría es una emoción positiva que surge cuando algo bueno nos sucede o anticipamos algo agradable.',
    classroom: 'Puede verse en risas, energía elevada, deseos de compartir con otros.',
    questions: ['¿Qué cosas te hacen sentir alegría?', '¿Cómo compartes tu alegría con los demás?', '¿Puedes recordar un momento muy feliz?'],
  },
  'Tristeza': {
    description: 'La tristeza aparece ante una pérdida, decepción o cuando algo importante no sale como esperábamos.',
    classroom: 'Puede verse en quietud, llanto, aislamiento o falta de energía.',
    questions: ['¿Qué haces cuando te sientes triste?', '¿A quién buscas cuando estás triste?', '¿Qué te ayuda a sentirte mejor?'],
  },
  'Enojo': {
    description: 'El enojo surge cuando sentimos que algo es injusto o cuando algo importante para nosotros es amenazado.',
    classroom: 'Puede verse en tensión muscular, voz elevada, dificultad para escuchar.',
    questions: ['¿Qué te hace enojar?', '¿Qué haces con tu cuerpo cuando te enojas?', '¿Cómo te tranquilizas?'],
  },
  'Miedo': {
    description: 'El miedo nos alerta ante situaciones de peligro real o percibido, protegiéndonos.',
    classroom: 'Puede verse en parálisis, llanto, evitar situaciones o buscar refugio.',
    questions: ['¿A qué le tienes miedo?', '¿Qué haces cuando sientes miedo?', '¿Quién te ayuda cuando tienes miedo?'],
  },
  'Frustración': {
    description: 'La frustración aparece cuando no podemos lograr algo que queremos o cuando nos bloqueamos.',
    classroom: 'Puede verse en rendirse rápido, reacciones impulsivas o dificultad para pedir ayuda.',
    questions: ['¿Cuándo te frustraste recientemente?', '¿Qué hiciste?', '¿Cómo puedes pedir ayuda cuando algo se te hace difícil?'],
  },
  'Vergüenza': {
    description: 'La vergüenza surge cuando sentimos que hemos fallado ante los demás o que no somos suficientes.',
    classroom: 'Puede verse en evitar hablar, esconderse, no querer participar.',
    questions: ['¿Cuándo sentiste vergüenza?', '¿Qué piensas de ti mismo en ese momento?', '¿Qué te gustaría que los demás supieran?'],
  },
  'Decepción': {
    description: 'La decepción ocurre cuando la realidad no cumple nuestras expectativas.',
    classroom: 'Puede verse en resignación, tristeza tranquila, o pérdida de motivación.',
    questions: ['¿Qué esperabas que pasara?', '¿Cómo te sentiste cuando no fue así?', '¿Qué aprendiste de eso?'],
  },
  'Ansiedad': {
    description: 'La ansiedad es una preocupación intensa ante situaciones futuras o inciertas.',
    classroom: 'Puede verse en dificultad para concentrarse, nerviosismo, quejas físicas.',
    questions: ['¿Qué te preocupa mucho?', '¿Qué pasa en tu cuerpo cuando te sientes ansioso?', '¿Qué te ayuda a calmarte?'],
  },
};
```

---

## CAMBIO 6: Crear CajaDeHerramientasScreen (nueva pantalla)

Crea `screens/CajaDeHerramientasScreen.tsx`:

```
[Header con fondo teal]
Caja de herramientas docente

[Texto introductorio:]
Encuentra materiales prácticos para implementar la metodología ExplorArte
y fortalecer el bienestar emocional en tu comunidad educativa.

[Placeholder de video:]
"Video de introducción – Cómo usar los recursos disponibles" (~1 minuto)

─────────────────────────────────
📖 Manual ExplorArte
Documento principal de la metodología.
[Botón:] "Descargar"  → link placeholder o toast "Próximamente disponible"

─────────────────────────────────
📋 Guías de actividades
Materiales complementarios para docentes.
[Botón:] "Ver guías"  → lista placeholder

─────────────────────────────────
📥 Recursos descargables
• Plantillas
• Fichas de trabajo
• Materiales de apoyo
• Herramientas para facilitación

[Cada item con botón "Descargar" → placeholder]

─────────────────────────────────
📚 Bibliografía recomendada
Selección de lecturas para profundizar en bienestar emocional,
desarrollo socioemocional y educación.
[Lista placeholder de 3-4 títulos ficticios]
```

---

## CAMBIO 7: Crear AprendiendoBienestarScreen (reemplaza FAQScreen)

Renombra o reemplaza `FAQScreen.tsx` → `AprendiendoBienestarScreen.tsx`:

```
[Header con fondo teal]
Aprendiendo sobre bienestar emocional

[Texto introductorio:]
Esta sección busca fortalecer los conocimientos y herramientas de las docentes
para acompañar procesos de bienestar emocional en sus comunidades educativas.

[Placeholder de video:]
"Video de introducción" (~1 minuto)

─────────────────────────────────
[3 temas como tarjetas expandibles (accordion) o secciones:]

🧘 1. Practicar autocuidado
  → Cuidando mis emociones
  → Cuidando mi cuerpo
  → Cuidando mi mente

🧠 2. ¿Por qué importa la salud mental en la infancia?
  → ¿Qué son las emociones?
  → Todas las emociones tienen una función

🏫 3. Cómo acompañar emociones difíciles en el aula
  → Estrategias prácticas para docentes
  → Qué hacer y qué evitar cuando un estudiante expresa emociones
  → Recomendaciones para promover espacios seguros y respetuosos
```

Cada sub-tema puede ser un item de lista que al tocar muestre un texto placeholder o navegue a una pantalla de detalle (queda a criterio, pero al menos que muestre el sub-tema expandido con un texto mínimo).

---

## CAMBIO 8: Actualizar ForoScreen → ComunidadExplorArteScreen

No rediseñes el componente completo, solo actualiza:

1. **Título** de la pantalla: `"Foro"` → `"Comunidad ExplorArte"`
2. **Texto introductorio** (agrega si no existe, o reemplaza si existe):
   ```
   Comparte experiencias, aprendizajes e ideas con otras docentes que están
   promoviendo el bienestar emocional en sus comunidades educativas.
   ```
3. **Placeholder de nueva publicación** (campo de texto o botón de crear post):
   ```
   Puedes compartir:
   • Experiencias y buenas prácticas
   • Adaptaciones de actividades
   • Recomendaciones de libros
   • Evidencias de trabajo
   • Dudas y preguntas
   • Ideas para inspirar a otras comunidades educativas
   ```
4. **Renombra el archivo** de `ForoScreen.tsx` → `ComunidadExplorArteScreen.tsx` y actualiza las referencias en routes.tsx y BottomNav.

---

## CAMBIO 9: Crear SobreExplorArteScreen (nueva pantalla)

Crea `screens/SobreExplorArteScreen.tsx`:

```
[Header con fondo teal]
Sobre ExplorArte

─────────────────────────────────
¿Qué es ExplorArte?

ExplorArte es una iniciativa desarrollada por Sueños y Letras que promueve
la salud mental y el bienestar emocional a través de la lectura, el arte
y experiencias participativas de aprendizaje.

─────────────────────────────────
Nuestra visión

Construir comunidades educativas donde niñas, niños y adolescentes puedan
desarrollarse plenamente, contando con herramientas emocionales que les
permitan afrontar los desafíos de la vida y alcanzar su potencial.

─────────────────────────────────
Nuestro enfoque

Trabajamos desde tres pilares fundamentales:
• Salud mental
• Desarrollo emocional
• Desarrollo social

Estos pilares se fortalecen mediante la lectura, la escritura, el arte
y la participación activa de las comunidades educativas.

─────────────────────────────────
Sueños y Letras

Sueños y Letras acompaña y promueve el bienestar socioemocional, la libertad
creativa y el desarrollo de comunidades de aprendizaje a través de la lectura
y la escritura.

[Placeholder de imagen/foto de cierre — rectángulo gris con ícono de imagen]
```

---

## CAMBIO 10: Actualizar BottomNav

Actualiza `components/BottomNav.tsx` con la nueva navegación. Reemplaza los items actuales con:

```
Inicio         → MainScreen
Explora        → BibliotecaDeEmocioneScreen  (punto de entrada a las secciones de contenido)
Comunidad      → ComunidadExplorArteScreen
Perfil         → ProfileScreen
```

Usa íconos apropiados de la librería que ya tengas (por ejemplo `lucide-react-native` o similar):
- Inicio: `Home`
- Explora: `Compass` o `Search`
- Comunidad: `Users` o `MessageCircle`
- Perfil: `User`

> "Sobre ExplorArte" se accede desde las cards del MainScreen o desde el menú del perfil, no desde el bottom nav.

---

## CAMBIO 11: Actualizar routes.tsx

```
/onboarding         → OnboardingScreen        (nueva — mostrar si no hay sesión activa)
/login              → LoginScreen             (sin cambios)
/registro           → RegisterScreen          (sin cambios)
/recuperar-password → ForgotPasswordScreen    (sin cambios)

/main               → MainScreen              (era /home — post-login)
/emociones          → BibliotecaDeEmocioneScreen  (era /modulos)
/emociones/:id      → EmotionDetailScreen         (era /modulo/:id)
/herramientas       → CajaDeHerramientasScreen    (nueva)
/aprendiendo        → AprendiendoBienestarScreen  (era /faq)
/comunidad          → ComunidadExplorArteScreen   (era /foro)
/sobre              → SobreExplorArteScreen        (nueva)
/perfil             → ProfileScreen               (sin cambios)
```

**Lógica de navegación inicial:**
- Si no hay sesión activa → navegar a `/onboarding`
- Si hay sesión activa → navegar a `/main`

---

## Resumen de archivos a crear o modificar

| Archivo | Acción |
|---|---|
| `screens/OnboardingScreen.tsx` | ✨ Crear nuevo (Hero + ¿Qué es? + ¿Cómo funciona? + CTA login) |
| `screens/HomeScreen.tsx` | 🔄 Renombrar → `MainScreen.tsx` + rediseñar como hub post-login |
| `screens/ModulesScreen.tsx` | 🔄 Renombrar → `BibliotecaDeEmocioneScreen.tsx` + rediseñar |
| `screens/EmotionDetailScreen.tsx` | ✨ Crear nuevo |
| `screens/CajaDeHerramientasScreen.tsx` | ✨ Crear nuevo |
| `screens/FAQScreen.tsx` | 🔄 Renombrar → `AprendiendoBienestarScreen.tsx` + rediseñar |
| `screens/ForoScreen.tsx` | 🔄 Renombrar → `ComunidadExplorArteScreen.tsx` + actualizar textos |
| `screens/SobreExplorArteScreen.tsx` | ✨ Crear nuevo |
| `screens/ModuleScreen.tsx` | 🗑️ Eliminar (reemplazado por EmotionDetailScreen) |
| `components/BottomNav.tsx` | ✏️ Actualizar items (4 tabs: Inicio, Explora, Comunidad, Perfil) |
| `routes.tsx` | ✏️ Agregar /onboarding, renombrar /home → /main, actualizar todo |

---

## Lo que NO debes cambiar

- El sistema de colores (teal, verdes suaves, blancos)
- La tipografía y tamaños de fuente existentes
- El estilo de las tarjetas (bordes redondeados, sombras)
- Las pantallas de Login, Registro y Perfil (sin cambios de fondo)
- La lógica de autenticación existente
- El componente de Calendario (si existe y funciona)
- Las imágenes o logos de Sueños y Letras

---

## Notas finales

- Para los **placeholders de video**, usa un rectángulo con fondo gris claro, un ícono de play centrado y el texto descriptivo abajo. No implementes video real.
- Para los **botones de descarga**, usa un `onPress` que muestre un `Alert` o `Toast` con el mensaje "Próximamente disponible".
- Mantén **datos de ejemplo (mock data)** similares a los que ya tiene el proyecto para posts del foro, nombre de usuario, etc.
- El nombre de la usuaria en el header debe venir del mismo estado/contexto que ya lo provee en la versión actual.
