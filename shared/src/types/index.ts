// Domain models for ExplorArte — the single source of truth shared by the web
// app, the mobile app, the mock client, the HTTP client and (later) the backend
// DTOs. Lifted from the React Native screens so the two apps stay in lockstep.

// ── Media (photos/videos/documents) ─────────────────────────────────────────

/** A real uploaded file (photo, video, or document), stored via Supabase
 * Storage. Used everywhere a piece of content references a file — tools
 * downloadables, emotion stories, learning attachments, forum posts, profile
 * photos, screen intro videos. */
export interface MediaItem {
  /** stable id — used as the offline-cache key on mobile */
  id: string;
  title: string;
  /** publicly fetchable URL */
  url: string;
  mimeType: string;
  sizeBytes: number;
  /** Last known server-side modification time, used for cache validation. */
  updatedAt?: string;
  /** Entity tag supplied by storage, used for cache validation. */
  etag?: string;
}

// ── Emotions ────────────────────────────────────────────────────────────────

/** Summary card shown in the emotions library grid. */
export interface Emotion {
  /** slug used in the route /emociones/:id */
  id: string;
  name: string;
  emoji: string;
  /** accent color (hex) */
  color: string;
  /** soft background color (hex) */
  bg: string;
}

/**
 * Una actividad de la Biblioteca de emociones.
 *
 * Era una sola cadena de texto, y por eso la tarjeta no podía enseñar más que
 * el nombre. El documento de estructura pide que la tarjeta resumida muestre
 * propósito, duración y edades, y que al desplegarla aparezcan objetivo,
 * materiales, paso a paso y preguntas: cada uno de esos es un campo aquí.
 *
 * Todo menos `title` puede venir vacío, y entonces no se dibuja. Nada se
 * rellena con valores por defecto: una docente planifica con la duración y la
 * edad que lee, así que un dato inventado es peor que un dato ausente.
 */
export interface EmotionActivity {
  title: string;
  /** Resumen en la tarjeta, y "Objetivo" al desplegarla. */
  purpose: string;
  /** Texto libre ("20–30 min"): el material no siempre da un número. */
  duration: string;
  /** Rango de edad, también libre ("7–12 años"). */
  ages: string;
  materials: string;
  /** Paso a paso, una entrada por paso. */
  steps: string[];
  /** Preguntas para conversar al cerrar la actividad. */
  questions: string[];
}

/** Full pedagogical content for a single emotion (the detail screen). */
export interface EmotionContent {
  description: string;
  classroom: string;
  questions: string[];
  activities: EmotionActivity[];
  /** real uploaded story files (video/audio/pdf) */
  stories: MediaItem[];
}

/** Emotion summary + its detail content (returned by GET /emotions/:id). */
export interface EmotionDetail extends Emotion {
  content: EmotionContent;
}

// ── Community ─────────────────────────────────────────────────────────────────

export interface Comment {
  /** server id; absent on a comment still waiting in the offline queue */
  id?: number;
  user: string;
  initials: string;
  avatarBg: string;
  time: string;
  text: string;
}

export interface Post {
  id: number;
  user: string;
  handle: string;
  verified: boolean;
  time: string;
  avatarBg: string;
  /** emotion id this post is tagged with, or null */
  module: string | null;
  text: string;
  likes: number;
  liked: boolean;
  reposts: number;
  comments: Comment[];
  /** photo/video attached by the author, if any (practically 0-1 items) */
  attachments: MediaItem[];
}

/** Payload to create a post. */
export interface CreatePostInput {
  text: string;
  module?: string | null;
  attachments?: MediaItem[];
}

/** Payload to add a comment to a post. */
export interface CreateCommentInput {
  text: string;
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export type EventType = 'sesión' | 'tarea' | 'recordatorio' | 'evento';

export interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  /** ISO date string (YYYY-MM-DD) over the wire; the apps parse to Date locally. */
  date: string;
  startTime: string;
  endTime: string;
  reminder: string;
  completed?: boolean;
}

export type CreateEventInput = Omit<CalEvent, 'id'>;
export type UpdateEventInput = Partial<Omit<CalEvent, 'id'>>;

// ── Learning ──────────────────────────────────────────────────────────────────

/**
 * Un trozo de contenido de Aprendiendo, con su forma declarada.
 *
 * Era una sola cadena (`SubTopic.body`), y por eso la pantalla no podía enseñar
 * más que un párrafo corrido. El material de las docentes no tiene esa forma:
 * alterna explicaciones con listas de prácticas, cuadros de "Recuerda", frases
 * que se pueden decir en el aula y preguntas para pensar después. Cada una de
 * esas es un `kind` aquí, y el CMS las compone en el orden que quiera.
 *
 * El discriminante es `kind` —no `type`— por dos razones: es el que ya usa la
 * unión cerrada del buzón de salida (`outbox.ts`), y `type` ya significa otra
 * cosa en `CalEvent`.
 *
 * Quien pinte esto debe ignorar en silencio un `kind` que no conozca: el CMS
 * puede ir por delante de la app instalada, y una pantalla en blanco es peor
 * que un bloque de menos.
 */
export type LearningBlock =
  /** Texto corrido. Los saltos de línea se respetan al pintarlo. */
  | { kind: 'paragraph'; text: string }
  /** Título de sección dentro del subtema ("¿Por qué es importante?"). */
  | { kind: 'heading'; text: string }
  /** Lista de cosas que hacer, con viñeta ✔. */
  | { kind: 'checklist'; title: string; items: string[] }
  /** Lista de cosas que evitar, con viñeta ✘. */
  | { kind: 'avoidlist'; title: string; items: string[] }
  /** El cuadro destacado. Sin título, se pinta como "Recuerda". */
  | { kind: 'callout'; title: string; text: string }
  /** Preguntas para pensar al cerrar ("Para reflexionar"). */
  | { kind: 'reflection'; questions: string[] }
  /** Una frase que la docente puede decir tal cual. Se pinta en cursiva. */
  | { kind: 'quote'; text: string }
  /** Término + explicación, en filas. "La alegría nos invita a compartir…". */
  | { kind: 'definitions'; title: string; items: DefinitionItem[] };

export interface DefinitionItem {
  /** lo que va en negrita */
  term: string;
  text: string;
}

/**
 * Cómo se recorre un tema. Lo elige la administradora desde el CMS, así que un
 * tema nuevo no necesita código para presentarse de otra manera.
 *
 *  - `accordion`: subtemas que se despliegan. Es lo que había y sigue siendo el
 *    valor por defecto.
 *  - `path`: mapa de fases. La docente marca cada fase al completarla y el
 *    avance se guarda en el servidor (ver `LearningProgressEntry`).
 *  - `slides`: el contenido se pasa tarjeta a tarjeta.
 */
export type TopicLayout = 'accordion' | 'path' | 'slides';

export interface SubTopic {
  /**
   * Clave estable del subtema dentro de su tema. Es la única ancla del avance
   * guardado: ni la posición ni el id de la fila sirven, porque el PUT del CMS
   * borra y reinserta la colección entera en cada guardado.
   *
   * Se genera del título la primera vez y **no se regenera al renombrar**:
   * hacerlo desconectaría en silencio el avance de todas las docentes.
   * Vacía al crear un subtema nuevo — el servidor la rellena.
   */
  key: string;
  /** Emoji del nodo en el mapa de fases. Vacío en los temas que no lo usan. */
  emoji: string;
  title: string;
  /**
   * Una o dos frases que el mapa de fases enseña bajo el título del nodo, para
   * saber qué hay dentro antes de abrirlo. Opcional: nula o vacía, el nodo se
   * pinta sin ella. Hasta 200 caracteres (el CMS aconseja 160).
   */
  description?: string | null;
  blocks: LearningBlock[];
  pdfs: MediaItem[];
  videos: MediaItem[];
  audios: MediaItem[];
}

export interface Topic {
  id: string;
  emoji: string;
  title: string;
  layout: TopicLayout;
  /** La introducción del tema, antes de sus subtemas. Puede venir vacía. */
  intro: LearningBlock[];
  subtopics: SubTopic[];
}

/** Una fase que una docente ya marcó como completada. */
export interface LearningProgressEntry {
  topicId: string;
  /** el `key` del subtema */
  stepKey: string;
  /** ISO 8601 */
  completedAt: string;
}

/**
 * Payload to create a learning topic (id is assigned by the server).
 *
 * `layout` e `intro` son opcionales: un tema nuevo se crea como acordeon sin
 * introduccion, que es lo que el CMS ofrece por defecto, y se cambia despues.
 */
export type CreateTopicInput = Omit<Topic, 'id' | 'layout' | 'intro'> &
  Partial<Pick<Topic, 'layout' | 'intro'>>;
/** Payload to update a learning topic. */
export type UpdateTopicInput = Partial<Omit<Topic, 'id'>>;

// ── Teacher toolkit ─────────────────────────────────────────────────────────

/** A file on a library shelf. The cover shown is `cover ?? autoCover ?? placeholder`. */
export interface ToolBook {
  id: string;
  title: string;
  author?: string | null;
  file: MediaItem;
  /** cover image uploaded by an admin */
  cover: MediaItem | null;
  /** first page of the PDF, rendered in the admin's browser when the file is uploaded */
  autoCover: MediaItem | null;
  /** what the book is about, shown beside the shelf on hover; absent on books saved before it existed */
  description?: string | null;
}

/** An admin-managed category of the library. */
export interface ToolShelf {
  id: string;
  title: string;
  books: ToolBook[];
  /** shown under the shelf title; absent on shelves saved before it existed */
  description?: string | null;
}

/** A recommended book: its cover image and a link to its page elsewhere. */
export interface BibliographyEntry {
  id: string;
  title: string;
  author?: string | null;
  image: MediaItem | null;
  /** the book's page (publisher, store…), http(s) */
  url: string | null;
}

export interface ToolsContent {
  shelves: ToolShelf[];
  bibliographyItems: BibliographyEntry[];
  /**
   * The pre-library shape, derived by the API from the two fields above so a
   * PWA build still cached on a phone keeps rendering. Read-only: never write
   * or render these.
   */
  downloadables?: MediaItem[];
  bibliography?: string[];
  manualDocument?: MediaItem | null;
  activityGuides?: MediaItem[];
}

/** Body of PUT /tools — the whole library at once. */
export type ToolsUpdateInput = Pick<ToolsContent, 'shelves' | 'bibliographyItems'>;

// ── Screen intro videos ──────────────────────────────────────────────────────

export type ScreenKey = 'home' | 'emotions' | 'learning' | 'tools';

/**
 * La cabecera editable de una pantalla: sus párrafos de introducción y el video
 * que los acompaña.
 *
 * Empezó siendo solo el video —de ahí el nombre, que se conserva porque lo
 * importan la PWA, la app de RN, el cliente HTTP y el mock—. El texto estaba
 * escrito a mano en el JSX de cada pantalla, así que cambiar una frase exigía
 * un despliegue. Ahora los dos viven aquí y los edita la administradora.
 *
 * Las dos partes son opcionales por separado: hay pantallas donde el texto es
 * todo lo que hay, y el video puede subirse después.
 */
export interface ScreenIntroVideo {
  screenKey: string;
  video: MediaItem | null;
  paragraphs: string[];
}

/**
 * El cuerpo del PUT. Reemplaza el recurso entero a propósito: cuando el PUT
 * recibía solo el `MediaItem`, quitar el video habría borrado los párrafos.
 */
export interface UpdateScreenIntroInput {
  video: MediaItem | null;
  paragraphs: string[];
}

// ── Profile / auth ────────────────────────────────────────────────────────────

/** Account type. Teachers use the app; admins approve users and manage content. */
export type UserRole = 'teacher' | 'admin';

/** Approval state of a teacher account. Admins are always 'approved'. */
export type UserStatus = 'pending' | 'approved' | 'rejected';

export interface UserProfile {
  /** stable user id (slug or uuid) */
  id: string;
  name: string;
  lastname: string;
  email: string;
  phone: string;
  /** Institución de la docente. Ya no se elige: todo el programa es
   *  "Sueños y Letras" y el selector de colegios se retiró. */
  institucion: string;
  /** location (municipality/zone) used for the admin KPIs */
  ubicacion: string;
  role: UserRole;
  status: UserStatus;
  /** data/object URL of the profile photo, or null */
  photo?: string | null;
  /** Falso mientras una cuenta invitada no haya completado su perfil. Es lo que
   *  enciende el aviso de bienvenida; se apaga al guardar el perfil. */
  profileCompleted?: boolean;
}

export type UpdateProfileInput = Partial<UserProfile>;

export interface AuthResult {
  /** mock token today; real JWT once the backend exists */
  token: string;
  user: UserProfile;
}

export interface LoginInput {
  email: string;
  password: string;
}

/** Estado de una invitación. `expired` no se guarda: lo calcula la API al leer. */
export type InvitationStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

export interface Invitation {
  id: string;
  email: string;
  status: InvitationStatus;
  /** ISO-8601 */
  createdAt: string;
  expiresAt: string;
  acceptedAt?: string | null;
}

/** Lo que /auth/invitations/:token responde. Un token que no sirve llega como
 *  `{ valid: false }` sin decir por qué. */
export interface InvitationCheck {
  valid: boolean;
  email?: string | null;
}

export interface RegisterInput {
  name: string;
  lastname: string;
  ubicacion: string;
  email: string;
  password: string;
  /** Token de invitación, cuando el alta viene de un correo del admin. */
  invitationToken?: string;
}
