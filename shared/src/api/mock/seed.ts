// Seed data — the app's previously-hardcoded content, lifted verbatim into one
// place. The mock client serves this; the real backend will seed its DB with it.

import type {
  CalEvent,
  Emotion,
  EmotionContent,
  Post,
  Topic,
  ToolsContent,
  UserProfile,
} from '../../types/index.js';

export const EMOTIONS: Emotion[] = [
  { id: 'alegria', name: 'Alegría', emoji: '😊', color: '#F0B429', bg: '#FFFBEB' },
  { id: 'tristeza', name: 'Tristeza', emoji: '😢', color: '#4299E1', bg: '#EBF8FF' },
  { id: 'enojo', name: 'Enojo', emoji: '😠', color: '#E53E3E', bg: '#FFF5F5' },
  { id: 'miedo', name: 'Miedo', emoji: '😨', color: '#7C3AED', bg: '#F5F0FF' },
  { id: 'frustracion', name: 'Frustración', emoji: '😤', color: '#DD6B20', bg: '#FFFAF0' },
  { id: 'verguenza', name: 'Vergüenza', emoji: '😳', color: '#D53F8C', bg: '#FFF5FA' },
  { id: 'decepcion', name: 'Decepción', emoji: '😞', color: '#718096', bg: '#F7FAFC' },
  { id: 'ansiedad', name: 'Ansiedad', emoji: '😰', color: '#38A169', bg: '#F0FFF4' },
];

export const EMOTION_CONTENT: Record<string, EmotionContent> = {
  alegria: {
    description:
      'La alegría es una emoción positiva que surge cuando algo bueno nos sucede o anticipamos algo agradable.',
    classroom: 'Puede verse en risas, energía elevada, deseos de compartir con otros.',
    questions: [
      '¿Qué cosas te hacen sentir alegría?',
      '¿Cómo compartes tu alegría con los demás?',
      '¿Puedes recordar un momento muy feliz?',
    ],
    activities: [
      'Dibuja un momento feliz',
      'Crea un mural de cosas que te alegran',
      'Comparte una buena noticia con el grupo',
    ],
    stories: ['El Principito — Antoine de Saint-Exupéry', 'Pollyanna — Eleanor H. Porter'],
  },
  tristeza: {
    description:
      'La tristeza aparece ante una pérdida, decepción o cuando algo importante no sale como esperábamos.',
    classroom: 'Puede verse en quietud, llanto, aislamiento o falta de energía.',
    questions: [
      '¿Qué haces cuando te sientes triste?',
      '¿A quién buscas cuando estás triste?',
      '¿Qué te ayuda a sentirte mejor?',
    ],
    activities: ['Carta a un amigo que está triste', 'Rincón de la calma', 'Dibuja lo que sientes hoy'],
    stories: ['El árbol generoso — Shel Silverstein', 'La vasija agrietada (cuento popular)'],
  },
  enojo: {
    description:
      'El enojo surge cuando sentimos que algo es injusto o cuando algo importante para nosotros es amenazado.',
    classroom: 'Puede verse en tensión muscular, voz elevada, dificultad para escuchar.',
    questions: ['¿Qué te hace enojar?', '¿Qué haces con tu cuerpo cuando te enojas?', '¿Cómo te tranquilizas?'],
    activities: ['Respiración del globo', 'El semáforo de las emociones', 'Botella de la calma'],
    stories: ['¡Fernando Furioso! — Hiawyn Oram', 'Vaya rabieta — Mireille d’Allancé'],
  },
  miedo: {
    description: 'El miedo nos alerta ante situaciones de peligro real o percibido, protegiéndonos.',
    classroom: 'Puede verse en parálisis, llanto, evitar situaciones o buscar refugio.',
    questions: ['¿A qué le tienes miedo?', '¿Qué haces cuando sientes miedo?', '¿Quién te ayuda cuando tienes miedo?'],
    activities: ['Mapa de mis miedos', 'El cofre del valor', 'Dibuja un escudo protector'],
    stories: ['Donde viven los monstruos — Maurice Sendak', 'El monstruo de colores — Anna Llenas'],
  },
  frustracion: {
    description:
      'La frustración aparece cuando no podemos lograr algo que queremos o cuando nos bloqueamos.',
    classroom: 'Puede verse en rendirse rápido, reacciones impulsivas o dificultad para pedir ayuda.',
    questions: [
      '¿Cuándo te frustraste recientemente?',
      '¿Qué hiciste?',
      '¿Cómo puedes pedir ayuda cuando algo se te hace difícil?',
    ],
    activities: ['El paso a paso para no rendirme', 'Lista de pequeñas metas', 'Juego de intentarlo de nuevo'],
    stories: ['La pequeña oruga glotona — Eric Carle', 'Lo que escuchó la mariquita (cuento de constancia)'],
  },
  verguenza: {
    description:
      'La vergüenza surge cuando sentimos que hemos fallado ante los demás o que no somos suficientes.',
    classroom: 'Puede verse en evitar hablar, esconderse, no querer participar.',
    questions: [
      '¿Cuándo sentiste vergüenza?',
      '¿Qué piensas de ti mismo en ese momento?',
      '¿Qué te gustaría que los demás supieran?',
    ],
    activities: ['Mis cualidades en un espejo', 'Círculo de aprecio del grupo', 'Diario de mis logros'],
    stories: ['Orejas de mariposa — Luisa Aguilar', 'El patito feo — Hans Christian Andersen'],
  },
  decepcion: {
    description: 'La decepción ocurre cuando la realidad no cumple nuestras expectativas.',
    classroom: 'Puede verse en resignación, tristeza tranquila, o pérdida de motivación.',
    questions: ['¿Qué esperabas que pasara?', '¿Cómo te sentiste cuando no fue así?', '¿Qué aprendiste de eso?'],
    activities: ['De la expectativa al aprendizaje', 'Caja de los planes B', 'Conversación sobre intentar otra vez'],
    stories: ['Por cuatro esquinitas de nada — Jérôme Ruillier', 'El jardín curioso — Peter Brown'],
  },
  ansiedad: {
    description: 'La ansiedad es una preocupación intensa ante situaciones futuras o inciertas.',
    classroom: 'Puede verse en dificultad para concentrarse, nerviosismo, quejas físicas.',
    questions: [
      '¿Qué te preocupa mucho?',
      '¿Qué pasa en tu cuerpo cuando te sientes ansioso?',
      '¿Qué te ayuda a calmarte?',
    ],
    activities: ['Respiración 4-4-4', 'Frasco de las preocupaciones', 'Anclaje de los 5 sentidos'],
    stories: ['Tranquilos — Lemniscates', 'Respira — Inês Castel-Branco'],
  },
};

export const POSTS: Post[] = [
  {
    id: 1, user: 'Maestra Ana', handle: '@ana_maestro', verified: true, time: 'hace 2h', avatarBg: '#7C3AED', module: 'alegria',
    text: '¡Trabajamos la alegría con mi grupo! 🎉 Los niños aprendieron palabras nuevas: alegría, sonrisa, abrazo... ¿Cuál es su favorita? 📚',
    likes: 12, liked: false, reposts: 2,
    comments: [
      { user: 'Coordinadora Lucía', initials: 'CL', avatarBg: '#D97706', time: '1h', text: "¡Qué maravilla! Mi grupo favoritó 'abrazo' 🤗" },
      { user: 'Prof. Roberto', initials: 'PR', avatarBg: '#2B6CB0', time: '45min', text: 'Excelente trabajo Ana, se nota el progreso.' },
    ],
  },
  {
    id: 2, user: 'Coordinadora Lucía', handle: '@lucia_coord', verified: true, time: 'hace 5h', avatarBg: '#D97706', module: null,
    text: 'Recordatorio: lectura grupal mañana a las 10:00 AM. ¡No olviden traer sus libros favoritos! 📖✨',
    likes: 8, liked: false, reposts: 3,
    comments: [{ user: 'Maestra Ana', initials: 'MA', avatarBg: '#7C3AED', time: '3h', text: '¡Ahí estaremos! 🙌' }],
  },
  {
    id: 3, user: 'Prof. Roberto', handle: '@roberto_lee', verified: false, time: 'hace 8h', avatarBg: '#2B6CB0', module: 'enojo',
    text: 'Conversamos sobre el enojo hoy. Es importante que los niños aprendan a reconocer y expresar esta emoción de forma sana. 💙',
    likes: 15, liked: true, reposts: 5, comments: [],
  },
  {
    id: 4, user: 'Mamá de Sofía', handle: '@familia_sofia', verified: false, time: 'hace 1d', avatarBg: '#DD6B20', module: 'alegria',
    text: 'Mi hija no para de hablar de las historias que leyeron en clase. ¡Gracias por inspirar el amor por la lectura! ❤️',
    likes: 24, liked: false, reposts: 7,
    comments: [{ user: 'Maestra Ana', initials: 'MA', avatarBg: '#7C3AED', time: '20h', text: '¡Eso nos llena de alegría! 🥰' }],
  },
  {
    id: 5, user: 'Director Carlos', handle: '@dir_carlos', verified: true, time: 'hace 2d', avatarBg: '#319795', module: null,
    text: 'Orgulloso del equipo de Sueños y Letras. Cada día acercamos más letras a más niños. ¡Más letras, más libres! 🌟',
    likes: 42, liked: false, reposts: 12, comments: [],
  },
];

export const EVENTS: CalEvent[] = [
  { id: '1', title: 'Sesión de lectura Grupo 1', type: 'sesión', date: '2026-06-04', startTime: '10:00', endTime: '11:00', reminder: '30 minutos antes' },
  { id: '2', title: 'Preparar material del módulo', type: 'tarea', date: '2026-06-04', startTime: '13:00', endTime: '13:30', reminder: 'ninguno', completed: false },
  { id: '3', title: 'Actividad Grupo 2', type: 'sesión', date: '2026-06-04', startTime: '14:00', endTime: '15:00', reminder: '10 minutos antes' },
  { id: '4', title: 'Audiocuento con Grupo 3', type: 'sesión', date: '2026-06-04', startTime: '16:30', endTime: '17:30', reminder: '1 hora antes' },
  { id: '5', title: 'Reunión de coordinación', type: 'evento', date: '2026-06-06', startTime: '09:00', endTime: '10:30', reminder: '1 día antes' },
  { id: '6', title: 'Entregar informe mensual', type: 'tarea', date: '2026-06-09', startTime: '15:00', endTime: '15:30', reminder: 'ninguno', completed: false },
];

export const TOPICS: Topic[] = [
  {
    id: 'autocuidado',
    emoji: '🧘',
    title: 'Practicar autocuidado',
    subtopics: [
      { title: 'Cuidando mis emociones', body: 'Reconocer lo que sentimos como docentes es el primer paso para acompañar a nuestras y nuestros estudiantes. Date permiso de nombrar tus emociones sin juzgarlas.' },
      { title: 'Cuidando mi cuerpo', body: 'El descanso, la alimentación y el movimiento sostienen tu bienestar. Pequeñas pausas durante la jornada ayudan a regular el estrés.' },
      { title: 'Cuidando mi mente', body: 'Practicar la atención plena, poner límites sanos y buscar apoyo cuando lo necesitas protege tu salud mental a largo plazo.' },
    ],
  },
  {
    id: 'salud-mental',
    emoji: '🧠',
    title: '¿Por qué importa la salud mental en la infancia?',
    subtopics: [
      { title: '¿Qué son las emociones?', body: 'Las emociones son respuestas naturales que nos informan sobre lo que vivimos. No son buenas ni malas: todas tienen algo que decirnos.' },
      { title: 'Todas las emociones tienen una función', body: 'El miedo nos protege, la tristeza nos invita a buscar consuelo, el enojo señala límites. Acompañar emociones es ayudar a comprender su mensaje.' },
    ],
  },
  {
    id: 'aula',
    emoji: '🏫',
    title: 'Cómo acompañar emociones difíciles en el aula',
    subtopics: [
      { title: 'Estrategias prácticas para docentes', body: 'Validar lo que siente el estudiante, ofrecer un espacio seguro y proponer recursos como la respiración o el dibujo ayudan a regular emociones intensas.' },
      { title: 'Qué hacer y qué evitar cuando un estudiante expresa emociones', body: 'Escucha sin minimizar ni apresurar soluciones. Evita frases como "no es para tanto" y acompaña con presencia y calma.' },
      { title: 'Recomendaciones para promover espacios seguros y respetuosos', body: 'Acuerdos de convivencia, rutinas predecibles y un clima de respeto permiten que niñas, niños y adolescentes se sientan en confianza para expresarse.' },
    ],
  },
];

export const TOOLS: ToolsContent = {
  downloadables: ['Plantillas', 'Fichas de trabajo', 'Materiales de apoyo', 'Herramientas para facilitación'],
  bibliography: [
    'El cerebro del niño — Daniel J. Siegel y Tina Payne Bryson',
    'Educar las emociones — Mireia Cabero',
    'Emocionario — Cristina Núñez Pereira',
    'La inteligencia emocional — Daniel Goleman',
  ],
};

export const PROFILE: UserProfile = {
  id: 'u-maria',
  name: 'María Reneé',
  lastname: 'García López',
  email: 'maria@ejemplo.com',
  phone: '+503 7000 1234',
  institucion: 'Colegio Americano',
  ubicacion: 'San Salvador, San Salvador',
  role: 'teacher',
  status: 'approved',
  photo: null,
};

// Demo accounts for mock mode. Login resolves the role/status by email; any
// password is accepted. New registrations are appended as active teachers
// (registration no longer requires approval).
export const USERS: UserProfile[] = [
  {
    id: 'u-admin',
    name: 'Carlos',
    lastname: 'Méndez',
    email: 'admin@explorarte.org',
    phone: '+503 7000 0000',
    institucion: 'Sueños y Letras',
    ubicacion: 'San Salvador, San Salvador',
    role: 'admin',
    status: 'approved',
    photo: null,
  },
  PROFILE,
  {
    id: 'u-ana',
    name: 'Ana',
    lastname: 'Pérez',
    email: 'ana@ejemplo.com',
    phone: '+503 7222 1111',
    institucion: 'Escuela Nacional Primaria',
    ubicacion: 'Santa Tecla, La Libertad',
    role: 'teacher',
    status: 'approved',
    photo: null,
  },
  {
    id: 'u-lucia',
    name: 'Lucía',
    lastname: 'Ramírez',
    email: 'lucia@ejemplo.com',
    phone: '+503 7333 2222',
    institucion: 'Colegio La Salle',
    ubicacion: 'Soyapango, San Salvador',
    role: 'teacher',
    status: 'approved',
    photo: null,
  },
  {
    id: 'u-sofia',
    name: 'Sofía',
    lastname: 'Hernández',
    email: 'sofia@ejemplo.com',
    phone: '+503 7444 3333',
    institucion: 'Instituto Bilingüe',
    ubicacion: 'Antiguo Cuscatlán, La Libertad',
    role: 'teacher',
    status: 'approved',
    photo: null,
  },
];
