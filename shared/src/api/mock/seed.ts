// Seed data — the app's previously-hardcoded content, lifted verbatim into one
// place. The mock client serves this; the real backend will seed its DB with it.

import type {
  CalEvent,
  Emotion,
  EmotionActivity,
  EmotionContent,
  MediaItem,
  Post,
  Topic,
  ToolBook,
  ToolsContent,
  UserProfile,
} from '../../types/index.js';

/** Fake MediaItem for mock mode — titles/icons render fine without the URL
 * ever actually resolving, since mock mode has no real file storage behind it. */
let fakeMediaCounter = 0;
function fakeMedia(title: string, mimeType = 'application/pdf'): MediaItem {
  fakeMediaCounter += 1;
  return {
    id: 'mock-media-' + fakeMediaCounter,
    title,
    url: 'https://example.com/mock/' + fakeMediaCounter,
    mimeType,
    sizeBytes: 0,
    updatedAt: '2026-01-01T00:00:00.000Z',
    etag: `"mock-media-${fakeMediaCounter}"`,
  };
}

/**
 * Una actividad de la que solo se conoce el nombre — el estado en el que quedó
 * todo el contenido cargado cuando las actividades pasaron de ser una cadena a
 * tener campos. El resto lo escribe Sueños y Letras desde el CMS; aquí no se
 * rellena con valores plausibles porque una docente los leería como reales.
 */
const act = (title: string): EmotionActivity => ({
  title,
  purpose: '',
  duration: '',
  ages: '',
  materials: '',
  steps: [],
  questions: [],
});

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
    activities: [act('Dibuja un momento feliz'), act('Crea un mural de cosas que te alegran'), act('Comparte una buena noticia con el grupo')],
    stories: [fakeMedia('El Principito — Antoine de Saint-Exupéry'), fakeMedia('Pollyanna — Eleanor H. Porter')],
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
    activities: [act('Carta a un amigo que está triste'), act('Rincón de la calma'), act('Dibuja lo que sientes hoy')],
    stories: [fakeMedia('El árbol generoso — Shel Silverstein'), fakeMedia('La vasija agrietada (cuento popular)')],
  },
  enojo: {
    description:
      'El enojo surge cuando sentimos que algo es injusto o cuando algo importante para nosotros es amenazado.',
    classroom: 'Puede verse en tensión muscular, voz elevada, dificultad para escuchar.',
    questions: ['¿Qué te hace enojar?', '¿Qué haces con tu cuerpo cuando te enojas?', '¿Cómo te tranquilizas?'],
    activities: [act('Respiración del globo'), act('El semáforo de las emociones'), act('Botella de la calma')],
    stories: [fakeMedia('¡Fernando Furioso! — Hiawyn Oram'), fakeMedia('Vaya rabieta — Mireille d’Allancé')],
  },
  miedo: {
    description: 'El miedo nos alerta ante situaciones de peligro real o percibido, protegiéndonos.',
    classroom: 'Puede verse en parálisis, llanto, evitar situaciones o buscar refugio.',
    questions: ['¿A qué le tienes miedo?', '¿Qué haces cuando sientes miedo?', '¿Quién te ayuda cuando tienes miedo?'],
    activities: [act('Mapa de mis miedos'), act('El cofre del valor'), act('Dibuja un escudo protector')],
    stories: [fakeMedia('Donde viven los monstruos — Maurice Sendak'), fakeMedia('El monstruo de colores — Anna Llenas')],
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
    activities: [act('El paso a paso para no rendirme'), act('Lista de pequeñas metas'), act('Juego de intentarlo de nuevo')],
    stories: [fakeMedia('La pequeña oruga glotona — Eric Carle'), fakeMedia('Lo que escuchó la mariquita (cuento de constancia)')],
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
    activities: [act('Mis cualidades en un espejo'), act('Círculo de aprecio del grupo'), act('Diario de mis logros')],
    stories: [fakeMedia('Orejas de mariposa — Luisa Aguilar'), fakeMedia('El patito feo — Hans Christian Andersen')],
  },
  decepcion: {
    description: 'La decepción ocurre cuando la realidad no cumple nuestras expectativas.',
    classroom: 'Puede verse en resignación, tristeza tranquila, o pérdida de motivación.',
    questions: ['¿Qué esperabas que pasara?', '¿Cómo te sentiste cuando no fue así?', '¿Qué aprendiste de eso?'],
    activities: [act('De la expectativa al aprendizaje'), act('Caja de los planes B'), act('Conversación sobre intentar otra vez')],
    stories: [fakeMedia('Por cuatro esquinitas de nada — Jérôme Ruillier'), fakeMedia('El jardín curioso — Peter Brown')],
  },
  ansiedad: {
    description: 'La ansiedad es una preocupación intensa ante situaciones futuras o inciertas.',
    classroom: 'Puede verse en dificultad para concentrarse, nerviosismo, quejas físicas.',
    questions: [
      '¿Qué te preocupa mucho?',
      '¿Qué pasa en tu cuerpo cuando te sientes ansioso?',
      '¿Qué te ayuda a calmarte?',
    ],
    activities: [act('Respiración 4-4-4'), act('Frasco de las preocupaciones'), act('Anclaje de los 5 sentidos')],
    stories: [fakeMedia('Tranquilos — Lemniscates'), fakeMedia('Respira — Inês Castel-Branco')],
  },
};

export const POSTS: Post[] = [
  {
    id: 1, user: 'Maestra Ana', handle: '@ana_maestro', verified: true, time: 'hace 2h', avatarBg: '#7C3AED', module: 'alegria',
    text: '¡Trabajamos la alegría con mi grupo! 🎉 Los niños aprendieron palabras nuevas: alegría, sonrisa, abrazo... ¿Cuál es su favorita? 📚',
    likes: 12, liked: false, reposts: 2, attachments: [],
    comments: [
      { user: 'Coordinadora Lucía', initials: 'CL', avatarBg: '#D97706', time: '1h', text: "¡Qué maravilla! Mi grupo favoritó 'abrazo' 🤗" },
      { user: 'Prof. Roberto', initials: 'PR', avatarBg: '#2B6CB0', time: '45min', text: 'Excelente trabajo Ana, se nota el progreso.' },
    ],
  },
  {
    id: 2, user: 'Coordinadora Lucía', handle: '@lucia_coord', verified: true, time: 'hace 5h', avatarBg: '#D97706', module: null,
    text: 'Recordatorio: lectura grupal mañana a las 10:00 AM. ¡No olviden traer sus libros favoritos! 📖✨',
    likes: 8, liked: false, reposts: 3, attachments: [],
    comments: [{ user: 'Maestra Ana', initials: 'MA', avatarBg: '#7C3AED', time: '3h', text: '¡Ahí estaremos! 🙌' }],
  },
  {
    id: 3, user: 'Prof. Roberto', handle: '@roberto_lee', verified: false, time: 'hace 8h', avatarBg: '#2B6CB0', module: 'enojo',
    text: 'Conversamos sobre el enojo hoy. Es importante que los niños aprendan a reconocer y expresar esta emoción de forma sana. 💙',
    likes: 15, liked: true, reposts: 5, comments: [], attachments: [],
  },
  {
    id: 4, user: 'Mamá de Sofía', handle: '@familia_sofia', verified: false, time: 'hace 1d', avatarBg: '#DD6B20', module: 'alegria',
    text: 'Mi hija no para de hablar de las historias que leyeron en clase. ¡Gracias por inspirar el amor por la lectura! ❤️',
    likes: 24, liked: false, reposts: 7, attachments: [],
    comments: [{ user: 'Maestra Ana', initials: 'MA', avatarBg: '#7C3AED', time: '20h', text: '¡Eso nos llena de alegría! 🥰' }],
  },
  {
    id: 5, user: 'Director Carlos', handle: '@dir_carlos', verified: true, time: 'hace 2d', avatarBg: '#319795', module: null,
    text: 'Orgulloso del equipo de Sueños y Letras. Cada día acercamos más letras a más niños. ¡Más letras, más libres! 🌟',
    likes: 42, liked: false, reposts: 12, comments: [], attachments: [],
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

/**
 * Los tres temas de "Aprendiendo sobre bienestar emocional", con el contenido
 * del documento de Sueños y Letras.
 *
 * Los `id` son los de siempre: el avance que una docente ya tenga guardado
 * apunta a ellos, y a la `key` de cada subtema.
 *
 * Espejo de `V15__learning_content_2026.sql`, que es lo que ve el backend real.
 * Si cambias uno, cambia el otro.
 */
export const TOPICS: Topic[] = [
  {
    id: 'autocuidado',
    emoji: '🧘',
    title: 'Practicar autocuidado',
    layout: 'path',
    intro: [
      { kind: 'paragraph', text: 'Antes de cuidar a otros, también necesitamos aprender a cuidarnos.' },
      {
        kind: 'paragraph',
        text: 'El autocuidado no consiste únicamente en descansar o relajarse. Es un conjunto de acciones cotidianas que fortalecen nuestro bienestar físico, emocional y mental.',
      },
      {
        kind: 'paragraph',
        text: 'Cuando una docente cuida de sí misma, también fortalece su capacidad para acompañar a sus estudiantes con mayor calma, empatía y presencia.',
      },
    ],
    subtopics: [
      {
        key: 'cuidando-mis-emociones',
        emoji: '🌸',
        title: 'Cuidando mis emociones',
        blocks: [
          { kind: 'heading', text: '¿Por qué es importante?' },
          {
            kind: 'paragraph',
            text: 'Las emociones forman parte de nuestra vida diaria. Reconocerlas, nombrarlas y comprenderlas nos permite responder de manera más consciente a los desafíos que enfrentamos.',
          },
          {
            kind: 'paragraph',
            text: 'El autocuidado emocional implica escuchar lo que sentimos sin juzgarnos y desarrollar estrategias saludables para expresar nuestras emociones.',
          },
          { kind: 'paragraph', text: 'No se trata de evitar emociones difíciles, sino de aprender a convivir con ellas.' },
          {
            kind: 'checklist',
            title: 'Algunas prácticas que pueden ayudarte',
            items: [
              'Preguntarte diariamente: «¿Cómo me siento hoy?»',
              'Identificar qué situaciones generan bienestar o malestar.',
              'Hablar con alguien de confianza.',
              'Escribir lo que sientes.',
              'Permitirte descansar cuando lo necesitas.',
              'Reconocer tus logros, incluso los pequeños.',
            ],
          },
          {
            kind: 'callout',
            title: 'Recuerda',
            text: 'Todas las emociones son válidas. Lo importante no es dejar de sentirlas, sino aprender a comprender lo que quieren comunicarnos.',
          },
          {
            kind: 'reflection',
            questions: [
              '¿Qué emoción ha estado más presente en mí durante esta semana?',
              '¿Qué necesito para cuidar mejor de mi bienestar emocional?',
            ],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'cuidando-mi-cuerpo',
        emoji: '🌿',
        title: 'Cuidando mi cuerpo',
        blocks: [
          { kind: 'heading', text: '¿Por qué es importante?' },
          { kind: 'paragraph', text: 'Nuestro cuerpo y nuestras emociones están profundamente conectados.' },
          {
            kind: 'paragraph',
            text: 'Dormir poco, alimentarnos de manera inadecuada o vivir bajo estrés constante puede afectar nuestro bienestar emocional.',
          },
          {
            kind: 'paragraph',
            text: 'De la misma manera, cuando cuidamos nuestro cuerpo también fortalecemos nuestra salud mental.',
          },
          {
            kind: 'checklist',
            title: 'Algunas prácticas que pueden ayudarte',
            items: [
              'Dormir las horas necesarias.',
              'Mantener una alimentación variada.',
              'Mantenerte hidratado.',
              'Realizar actividad física regularmente.',
              'Tomar pausas durante la jornada.',
              'Respirar profundamente varias veces al día.',
              'Escuchar las señales de cansancio de tu cuerpo.',
            ],
          },
          { kind: 'callout', title: 'Recuerda', text: 'Cuidar tu cuerpo también es una forma de cuidar tus emociones.' },
          {
            kind: 'reflection',
            questions: ['¿Qué necesita hoy mi cuerpo?', '¿Qué pequeño hábito puedo fortalecer esta semana?'],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'cuidando-mi-mente',
        emoji: '🧠',
        title: 'Cuidando mi mente',
        blocks: [
          { kind: 'heading', text: '¿Por qué es importante?' },
          { kind: 'paragraph', text: 'Nuestra mente necesita espacios para descansar, aprender y recuperar energía.' },
          {
            kind: 'paragraph',
            text: 'Vivimos rodeados de estímulos constantes. Por eso, es importante crear momentos que favorezcan la concentración, la creatividad y el equilibrio emocional.',
          },
          {
            kind: 'checklist',
            title: 'Algunas prácticas que pueden ayudarte',
            items: [
              'Leer por placer.',
              'Respirar conscientemente.',
              'Reducir el tiempo frente a pantallas.',
              'Practicar ejercicios de atención plena.',
              'Dedicar tiempo a actividades que disfrutes.',
              'Aprender algo nuevo.',
              'Recordar que no necesitamos hacerlo todo perfectamente.',
            ],
          },
          { kind: 'callout', title: 'Recuerda', text: 'Descansar también es parte del aprendizaje.' },
          {
            kind: 'reflection',
            questions: ['¿Qué actividades ayudan a que mi mente descanse?', '¿Qué pensamientos me gustaría aprender a soltar?'],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
    ],
  },
  {
    id: 'salud-mental',
    emoji: '🧠',
    title: '¿Por qué importa la salud mental en la infancia?',
    layout: 'slides',
    intro: [
      {
        kind: 'paragraph',
        text: 'La infancia y la adolescencia son etapas fundamentales para el desarrollo emocional, social y cognitivo.',
      },
      {
        kind: 'paragraph',
        text: 'Las experiencias que viven niñas, niños y adolescentes influyen en la manera en que comprenden el mundo, construyen relaciones y enfrentan los desafíos de la vida.',
      },
      {
        kind: 'paragraph',
        text: 'Promover la salud mental no significa esperar a que aparezcan dificultades. Significa crear entornos donde todas las personas puedan sentirse seguras, escuchadas, respetadas y acompañadas.',
      },
    ],
    subtopics: [
      {
        key: 'que-favorece-el-bienestar-emocional',
        emoji: '🌤️',
        title: '¿Qué favorece el bienestar emocional?',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Los estudios muestran que niñas, niños y adolescentes desarrollan mayor bienestar cuando cuentan con:',
          },
          {
            kind: 'checklist',
            title: 'Lo que sostiene el bienestar',
            items: [
              'Relaciones afectivas seguras.',
              'Personas adultas que escuchan sin juzgar.',
              'Espacios donde puedan expresar lo que sienten.',
              'Rutinas estables.',
              'Oportunidades para jugar, crear y participar.',
              'Sentido de pertenencia dentro de la comunidad educativa.',
            ],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'el-papel-de-la-escuela',
        emoji: '🏫',
        title: '¿Cuál es el papel de la escuela?',
        blocks: [
          {
            kind: 'paragraph',
            text: 'La escuela es uno de los espacios donde niñas, niños y adolescentes pasan gran parte de su tiempo.',
          },
          {
            kind: 'paragraph',
            text: 'Las docentes no reemplazan a profesionales de la salud mental, pero sí pueden convertirse en figuras significativas que promuevan ambientes protectores y favorezcan el desarrollo socioemocional.',
          },
          {
            kind: 'paragraph',
            text: 'Pequeñas acciones, como escuchar con atención, validar emociones o generar espacios de diálogo, pueden marcar una diferencia importante.',
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'que-son-las-emociones',
        emoji: '💛',
        title: '¿Qué son las emociones?',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Las emociones son respuestas naturales que aparecen ante diferentes situaciones de nuestra vida.',
          },
          {
            kind: 'paragraph',
            text: 'Nos ayudan a comprender lo que vivimos, tomar decisiones, protegernos y relacionarnos con otras personas.',
          },
          {
            kind: 'paragraph',
            text: 'Todas las personas experimentamos emociones. No existen emociones buenas o malas; cada una cumple una función importante.',
          },
          {
            kind: 'paragraph',
            text: 'Reconocerlas y expresarlas de manera saludable fortalece nuestro bienestar y nuestras relaciones.',
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'todas-las-emociones-tienen-una-funcion',
        emoji: '🧭',
        title: 'Todas las emociones tienen una función',
        blocks: [
          { kind: 'paragraph', text: 'Cada emoción nos envía un mensaje.' },
          {
            kind: 'definitions',
            title: 'El mensaje de cada emoción',
            items: [
              { term: 'La alegría', text: 'nos invita a compartir aquello que disfrutamos.' },
              { term: 'La tristeza', text: 'nos ayuda a reconocer pérdidas y buscar apoyo.' },
              { term: 'El miedo', text: 'nos protege frente al peligro.' },
              { term: 'El enojo', text: 'nos muestra que algo nos incomoda o que nuestros límites han sido vulnerados.' },
              {
                term: 'La frustración',
                text: 'aparece cuando algo no resulta como esperábamos y nos invita a buscar nuevas estrategias.',
              },
              {
                term: 'La vergüenza',
                text: 'nos ayuda a reflexionar sobre nuestras acciones, aunque cuando aparece de forma intensa puede afectar nuestra autoestima.',
              },
              {
                term: 'La ansiedad',
                text: 'prepara a nuestro cuerpo para responder ante situaciones desafiantes, aunque cuando permanece durante mucho tiempo puede generar malestar.',
              },
            ],
          },
          {
            kind: 'paragraph',
            text: 'Comprender el propósito de cada emoción nos ayuda a responder con mayor empatía hacia nosotros mismos y hacia los demás.',
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
    ],
  },
  {
    id: 'aula',
    emoji: '🏫',
    title: 'Cómo acompañar emociones difíciles en el aula',
    layout: 'slides',
    intro: [
      { kind: 'paragraph', text: 'Las emociones difíciles forman parte de la vida escolar.' },
      {
        kind: 'paragraph',
        text: 'Como docentes, no siempre podremos resolver aquello que viven nuestros estudiantes, pero sí podemos ofrecer un espacio seguro donde se sientan escuchados, comprendidos y acompañados.',
      },
      {
        kind: 'paragraph',
        text: 'Muchas veces, lo que más necesita una niña, niño o adolescente no es una respuesta inmediata, sino la certeza de que no está enfrentando esa emoción en soledad.',
      },
    ],
    subtopics: [
      {
        key: 'estrategias-practicas-para-docentes',
        emoji: '🤝',
        title: 'Estrategias prácticas para docentes',
        blocks: [
          { kind: 'heading', text: 'Escucha antes de intervenir' },
          {
            kind: 'paragraph',
            text: 'Permite que el estudiante exprese lo que siente antes de ofrecer soluciones o consejos.',
          },
          { kind: 'heading', text: 'Valida la emoción' },
          { kind: 'paragraph', text: 'Puedes decir:' },
          { kind: 'quote', text: 'Entiendo que esto ha sido difícil para ti.' },
          { kind: 'quote', text: 'Gracias por contarme cómo te sientes.' },
          {
            kind: 'paragraph',
            text: 'Validar no significa estar de acuerdo con una conducta, sino reconocer la experiencia emocional de la persona.',
          },
          { kind: 'heading', text: 'Ayuda a poner nombre a la emoción' },
          {
            kind: 'paragraph',
            text: 'Muchas veces las niñas y los niños sienten algo, pero no saben cómo expresarlo. Preguntas como:',
          },
          { kind: 'quote', text: '¿Cómo describirías lo que estás sintiendo?' },
          { kind: 'quote', text: '¿Qué crees que necesita esa emoción?' },
          { kind: 'paragraph', text: 'pueden ayudarles a comprender mejor su experiencia.' },
          { kind: 'heading', text: 'Mantén la calma' },
          { kind: 'paragraph', text: 'Las emociones son contagiosas.' },
          {
            kind: 'paragraph',
            text: 'Cuando una persona adulta responde con serenidad, transmite seguridad al grupo.',
          },
          { kind: 'heading', text: 'Ofrece alternativas' },
          { kind: 'paragraph', text: 'En lugar de decir únicamente «cálmate», puedes preguntar:' },
          { kind: 'quote', text: '¿Qué podría ayudarte en este momento?' },
          { kind: 'quote', text: '¿Prefieres respirar un momento, dibujar o conversar?' },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'que-hacer-cuando-expresa-una-emocion-dificil',
        emoji: '✅',
        title: 'Qué hacer cuando un estudiante expresa una emoción difícil',
        blocks: [
          {
            kind: 'checklist',
            title: 'Qué hacer',
            items: [
              'Escuchar con atención.',
              'Agradecer la confianza.',
              'Hablar en un lugar tranquilo cuando sea posible.',
              'Validar la emoción.',
              'Respetar los silencios.',
              'Observar cambios persistentes en el comportamiento.',
              'Buscar apoyo dentro de la institución cuando sea necesario.',
            ],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'que-evitar',
        emoji: '⚠️',
        title: 'Qué evitar',
        blocks: [
          {
            kind: 'avoidlist',
            title: 'Qué evitar',
            items: [
              'Minimizar lo que siente: «No es para tanto».',
              'Comparar su experiencia: «Hay personas que están peor».',
              'Obligarle a hablar.',
              'Ridiculizar o bromear sobre lo que expresa.',
              'Prometer confidencialidad absoluta cuando la seguridad del estudiante pueda estar en riesgo.',
            ],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
      {
        key: 'construyendo-espacios-emocionalmente-seguros',
        emoji: '🌱',
        title: 'Construyendo espacios emocionalmente seguros',
        blocks: [
          {
            kind: 'paragraph',
            text: 'Las comunidades educativas que promueven el bienestar emocional suelen compartir algunas características:',
          },
          {
            kind: 'checklist',
            title: 'Lo que tienen en común',
            items: [
              'Escuchan con respeto.',
              'Reconocen la diversidad de experiencias.',
              'Promueven la participación.',
              'Valoran el error como parte del aprendizaje.',
              'Favorecen relaciones basadas en la empatía y el cuidado mutuo.',
            ],
          },
          {
            kind: 'reflection',
            questions: [
              'Una conversación respetuosa puede convertirse en el primer paso para que una niña, un niño o un adolescente se sienta acompañado. ¿Qué conversación pendiente tengo con alguno de mis estudiantes?',
            ],
          },
        ],
        pdfs: [],
        videos: [],
        audios: [],
      },
    ],
  },
];

/**
 * Los párrafos de introducción de cada pantalla, tal como los verá la docente
 * hasta que la administradora los cambie desde el CMS.
 *
 * Solo `learning` viene del documento de Sueños y Letras; los otros tres son el
 * texto que hasta ahora estaba escrito a mano en el JSX de cada pantalla.
 */
export const SCREEN_INTRO_PARAGRAPHS: Record<string, string[]> = {
  learning: [
    'Acompañar el bienestar emocional también implica seguir aprendiendo.',
    'Esta sección busca fortalecer los conocimientos y herramientas de las docentes para acompañar procesos de bienestar emocional en sus comunidades educativas.',
    'En esta sección encontrarás contenidos breves que te ayudarán a comprender mejor las emociones, fortalecer tu práctica educativa y construir espacios de aprendizaje más seguros, empáticos y respetuosos.',
  ],
};

function fakeBook(title: string, description: string | null = null, mimeType?: string): ToolBook {
  const file = fakeMedia(title, mimeType);
  return { id: file.id, title, author: null, file, cover: null, autoCover: null, description };
}

export const TOOLS: ToolsContent = {
  shelves: [
    {
      id: 'manual',
      title: 'Manual ExplorArte',
      description: 'El documento base de la metodología, para leer antes de empezar.',
      books: [
        fakeBook(
          'Manual ExplorArte',
          'El documento principal de la metodología: sus tres pilares, cómo se organiza cada sesión y cómo acompañar las emociones en el aula.',
        ),
      ],
    },
    {
      id: 'guias',
      title: 'Guías de actividades',
      description: 'Una guía por emoción, con actividades listas para el aula.',
      books: [
        fakeBook('Guía de actividades — Alegría', 'Actividades para reconocer y celebrar la alegría en grupo.'),
        fakeBook('Guía de actividades — Enojo', 'Dinámicas para nombrar el enojo y encontrar formas seguras de expresarlo.'),
      ],
    },
    {
      id: 'recursos',
      title: 'Recursos descargables',
      books: [
        fakeBook('Plantillas'),
        fakeBook(
          'Fichas de trabajo',
          'Fichas editables para imprimir y trabajar en clase.',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
        fakeBook('Materiales de apoyo'),
        fakeBook('Herramientas para facilitación'),
      ],
    },
  ],
  bibliographyItems: [
    { id: 'bib-1', title: 'El cerebro del niño', author: 'Daniel J. Siegel y Tina Payne Bryson', image: null, url: null },
    { id: 'bib-2', title: 'Educar las emociones', author: 'Mireia Cabero', image: null, url: null },
    { id: 'bib-3', title: 'Emocionario', author: 'Cristina Núñez Pereira', image: null, url: null },
    { id: 'bib-4', title: 'La inteligencia emocional', author: 'Daniel Goleman', image: null, url: null },
  ],
};

export const PROFILE: UserProfile = {
  id: 'u-maria',
  name: 'María Reneé',
  lastname: 'García López',
  email: 'maria@ejemplo.com',
  phone: '+503 7000 1234',
  institucion: 'Colegio Americano',
  ubicacion: 'San Salvador',
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
    ubicacion: 'San Salvador',
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
