import { useRef, useState } from 'react';
import { MODTAG, type Comment, type MediaItem, type Post } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { PendingBadge } from '@/components/PendingBadge';
import { toast } from '@/components/toast-store';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { isDeadSession } from '@/lib/offline-errors';
import { enqueuePostComment, enqueuePostCreate, enqueuePostLike } from '@/lib/outbox';
import { isTempPostId, newTempPostId } from '@/lib/outbox-ids';
import { usePendingIndex } from '@/lib/use-outbox';
import { useIsOnline } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { useRefetchOnDrain } from '@/lib/useRefetchOnDrain';
import { useAuth } from '@/context/AuthContext';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'alegria', label: '😊 Alegría' },
  { id: 'tristeza', label: '😢 Tristeza' },
  { id: 'enojo', label: '😠 Enojo' },
  { id: 'miedo', label: '😨 Miedo' },
];

const SHARE_BULLETS = [
  'Experiencias y buenas prácticas',
  'Adaptaciones de actividades',
  'Recomendaciones de libros',
  'Evidencias de trabajo',
  'Dudas y preguntas',
  'Ideas para inspirar a otras comunidades educativas',
];

export default function Comunidad() {
  const { user } = useAuth();
  const myInitials = user
    ? ((user.name.charAt(0) || '') + (user.lastname.charAt(0) || '')).toUpperCase()
    : 'MR';
  const [filter, setFilter] = useState('todos');
  const online = useIsOnline();
  const { data, status, ageMs, reload } = useOfflineAsync(
    cacheKeys.posts(filter),
    // `undefined` y no 'todos': el cliente HTTP manda el filtro tal cual, así
    // que "todos" llegaba como `?emotion=todos` y la API real devolvía vacío.
    () => api.posts.list(filter === 'todos' ? undefined : filter),
    [filter],
  );

  // Mirror the loaded feed into local state so like/comment/create mutations can
  // update it in place. Re-sync whenever a fresh list arrives (filter change or
  // reload) using the "adjust state during render" pattern — no flicker, no effect.
  const [posts, setPosts] = useState<Post[]>([]);
  const [syncedData, setSyncedData] = useState<Post[] | undefined>(undefined);
  if (data !== syncedData) {
    setSyncedData(data);
    setPosts(data ?? []);
  }

  // Lo escrito sin conexión vive AL LADO del espejo, nunca dentro.
  //
  // Si un borrador entrara en `posts`, pasaría esto: la docente publica sin
  // red → vuelve el wifi → `useOfflineAsync` revalida por su dependencia
  // `online` → llega una lista del servidor que todavía no trae su publicación
  // porque la bandeja aún no la ha enviado → el espejo se resincroniza → su
  // publicación DESAPARECE de la pantalla estando perfectamente a salvo en la
  // cola. Fuera del espejo, el espejo no puede pisarla porque no la conoce.
  const [draftPosts, setDraftPosts] = useState<Post[]>([]);
  const [draftComments, setDraftComments] = useState<Record<number, Comment[]>>({});
  const [draftLikes, setDraftLikes] = useState<Record<number, { liked: boolean; likes: number }>>({});

  const pending = usePendingIndex();
  useRefetchOnDrain(reload);

  // Un borrador se pinta mientras su alta siga en la cola. En cuanto sale, la
  // publicación de verdad llega en la lista y pintar las dos sería duplicarla:
  // esto es lo que hace que "reconcilia sin duplicar" sea cierto por
  // construcción y no por un temporizador.
  const visibleDrafts = draftPosts.filter(
    (d) => pending.posts.has(d.id) && (filter === 'todos' || d.module === filter),
  );
  const feed = [...visibleDrafts, ...posts];

  const [openThread, setOpenThread] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [likingId, setLikingId] = useState<number | null>(null);
  const [sendingComment, setSendingComment] = useState<number | null>(null);
  const [commentErrors, setCommentErrors] = useState<Record<number, string>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [attachment, setAttachment] = useState<MediaItem | null>(null);
  const [attaching, setAttaching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [composeError, setComposeError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const toggleLike = async (id: number) => {
    if (likingId === id) return;
    setLikingId(id);
    const row = feed.find((p) => p.id === id);
    if (!row) {
      setLikingId(null);
      return;
    }
    const current = pending.likes.has(id) ? draftLikes[id] : undefined;
    const liked = current?.liked ?? row.liked;
    const likes = current?.likes ?? row.likes;
    const encolar = async () => {
      await enqueuePostLike(id);
      setDraftLikes((d) => ({ ...d, [id]: { liked: !liked, likes: likes + (liked ? -1 : 1) } }));
    };

    try {
      // Con red va directa: es el camino normal y deja el contador exacto que
      // devuelve el servidor. La excepción es una publicación creada sin
      // conexión, que todavía no tiene id de servidor: su reacción siempre pasa
      // por la cola, y el outbox la reescribe cuando el alta aterriza.
      if (online && !isTempPostId(id)) {
        const updated = await api.posts.toggleLike(id);
        setPosts((ps) => ps.map((p) => (p.id === id ? updated : p)));
      } else {
        await encolar();
        toast.info('Guardamos tu reacción. Se enviará cuando haya conexión.');
      }
    } catch (e) {
      // Un 403 no se encola: la sesión está muerta, ya se está purgando y
      // sacando a la docente, y la fila solo llegaría a la lista de fallidos.
      if (isDeadSession(e)) return;
      try {
        await encolar();
        toast.info('Guardamos tu reacción. Se enviará cuando haya conexión.');
      } catch {
        toast.error('No se pudo actualizar tu reacción. Inténtalo de nuevo.');
      }
    } finally {
      setLikingId(null);
    }
  };

  const sendComment = async (id: number) => {
    const text = (drafts[id] || '').trim();
    if (!text || sendingComment === id) return;
    setSendingComment(id);
    setCommentErrors((e) => ({ ...e, [id]: '' }));
    // Firmado con su nombre real: la app RN pone "Tú" porque su módulo no
    // conoce a la usuaria, pero aquí `useAuth()` está a mano y así el
    // comentario encolado se parece al que llegará del servidor.
    const local: Comment = {
      user: user ? `${user.name} ${user.lastname}` : 'Tú',
      initials: myInitials,
      avatarBg: '#3DBFB8',
      time: 'ahora',
      text,
    };
    const encolar = async () => {
      await enqueuePostComment(id, { text });
      setDraftComments((d) => ({ ...d, [id]: [...(d[id] ?? []), local] }));
      setDrafts((d) => ({ ...d, [id]: '' }));
      toast.info('Tu comentario se enviará cuando haya conexión.');
    };

    try {
      if (online && !isTempPostId(id)) {
        const comment = await api.posts.addComment(id, { text });
        setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment] } : p)));
        setDrafts((d) => ({ ...d, [id]: '' }));
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        setCommentErrors((e2) => ({ ...e2, [id]: 'No se pudo enviar el comentario. Inténtalo de nuevo.' }));
      }
    } finally {
      setSendingComment(null);
    }
  };

  const submitPost = async () => {
    const text = composeText.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setComposeError(null);
    // tag the post with the active emotion filter (null under "todos")
    const module = filter === 'todos' ? null : filter;
    const input = { text, module, attachments: attachment ? [attachment] : [] };
    const close = () => {
      setComposeOpen(false);
      setComposeText('');
      setAttachment(null);
    };
    const encolar = async () => {
      const tempId = newTempPostId();
      await enqueuePostCreate(tempId, input);
      setDraftPosts((ds) => [
        {
          id: tempId,
          user: user ? `${user.name} ${user.lastname}` : 'Tú',
          handle: user ? `@${user.name.toLowerCase()}` : '@tú',
          verified: false,
          time: 'ahora',
          avatarBg: '#3DBFB8',
          module,
          text: input.text,
          likes: 0,
          liked: false,
          reposts: 0,
          comments: [],
          attachments: input.attachments,
        },
        ...ds,
      ]);
      close();
      toast.info('Tu publicación se enviará cuando vuelva la conexión.', {
        title: 'Guardada sin conexión',
      });
    };

    try {
      if (online) {
        const np = await api.posts.create(input);
        close();
        // the new post always matches the active filter now, so show it immediately
        setPosts((ps) => [np, ...ps]);
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        setComposeError('No se pudo publicar. Inténtalo de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttach = async (file: File) => {
    // Adjuntar sin conexión no se puede resolver encolando: no hay a dónde
    // subir los bytes, y guardar una URL local en la cola sería mandarle al
    // servidor una dirección que solo existe en esta pestaña. Se dice y se
    // ofrece la salida, en vez de deshabilitar el botón y dejarla adivinando.
    if (!online) {
      toast.info(
        'Para adjuntar una imagen o un vídeo necesitas conexión. Puedes publicar solo el texto ahora.',
        { title: 'Sin conexión' },
      );
      return;
    }
    setAttaching(true);
    setComposeError(null);
    try {
      setAttachment(await api.media.upload(file, file.name, 'posts'));
    } catch {
      setComposeError('No se pudo subir el archivo. Inténtalo de nuevo.');
    } finally {
      setAttaching(false);
    }
  };

  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Comunidad ExplorArte"
        title="Crece en"
        accent="comunidad"
        lede="Comparte experiencias, aprendizajes e ideas con otras docentes que promueven el bienestar emocional."
      />

      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {FILTERS.map((f) => {
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{ padding: '8px 15px', borderRadius: 22, fontSize: 12.5, fontWeight: 700, border: `1px solid ${active ? 'var(--brand)' : 'var(--border-warm)'}`, background: active ? 'var(--brand)' : '#fff', color: active ? '#fff' : '#5A6E6A' }}>
              {f.label}
            </button>
          );
        })}
      </div>

      <CacheAgeNote status={status} ageMs={ageMs} />

      {feed.length === 0 ? (
        <ContentState
          status={status}
          onRetry={reload}
          what="la comunidad"
          isEmpty={data?.length === 0}
          emptyLabel="Aún no hay publicaciones. ¡Sé la primera en compartir!"
        />
      ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {feed.map((p) => {
          const tag = p.module ? MODTAG[p.module] : null;
          const initials = p.user.split(' ').map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
          const threadOpen = openThread === p.id;
          // Las capas optimistas se aplican al pintar, no al estado: mientras
          // su cambio siga en la bandeja mandan ellas; cuando sale, desaparecen
          // solas y lo que se ve es lo que dijo el servidor.
          const isDraft = pending.posts.has(p.id);
          const like = pending.likes.has(p.id) ? draftLikes[p.id] : undefined;
          const liked = like?.liked ?? p.liked;
          const likes = like?.likes ?? p.likes;
          const queuedComments = pending.comments.has(p.id) ? (draftComments[p.id] ?? []) : [];
          const comments = [...p.comments, ...queuedComments];
          return (
            <article
              key={p.id}
              className={isDraft ? 'is-pending' : undefined}
              style={{ borderRadius: 20, background: '#fff', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 13 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.avatarBg, color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-dark)' }}>{p.user}</span>
                      {p.verified ? <Icon name="check-circle" size={14} color="var(--brand)" /> : null}
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>
                        {p.handle}{isDraft ? '' : ` · ${p.time}`}
                      </span>
                      {isDraft ? <PendingBadge /> : null}
                    </div>
                    {tag ? (
                      <span style={{ display: 'inline-block', marginTop: 6, background: tag.bg, borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: tag.color }}>
                        {tag.label}
                      </span>
                    ) : null}
                    <p style={{ marginTop: 9, fontSize: 14.5, color: '#3F5450', lineHeight: 1.55 }}>{p.text}</p>
                    {p.attachments.map((a) =>
                      a.mimeType.startsWith('video') ? (
                        <video key={a.id} src={a.url} controls style={{ marginTop: 10, maxWidth: '100%', borderRadius: 12 }} />
                      ) : (
                        <img key={a.id} src={a.url} alt={a.title} style={{ marginTop: 10, maxWidth: '100%', borderRadius: 12 }} />
                      ),
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 14 }}>
                      <ActionBtn
                        icon="message-circle"
                        value={comments.length}
                        label={`Comentarios (${comments.length})`}
                        onClick={() => setOpenThread(threadOpen ? null : p.id)}
                      />
                      <ActionBtn
                        icon="heart"
                        value={likes}
                        active={liked}
                        activeColor="var(--danger)"
                        fill={liked}
                        disabled={likingId === p.id}
                        pressed={liked}
                        // Una insignia por corazón sería ruido, y un "me gusta"
                        // no tiene contenido que perder: el estado pendiente va
                        // en el nombre accesible, no en la pantalla.
                        label={`${liked ? 'Quitar me gusta' : 'Me gusta'}${pending.likes.has(p.id) ? ', pendiente de enviar' : ''}`}
                        onClick={() => toggleLike(p.id)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {threadOpen ? (
                <div style={{ padding: '12px 20px 18px', background: '#FBF7F0', borderTop: '1px solid var(--border)' }}>
                  {comments.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.avatarBg, color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{c.initials}</span>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>{c.user}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>· {c.time}</span>
                          {i >= p.comments.length ? <PendingBadge label="Sin enviar" /> : null}
                        </div>
                        <p style={{ marginTop: 2, fontSize: 12.5, color: 'var(--text-body)', lineHeight: 1.4 }}>{c.text}</p>
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <input
                      value={drafts[p.id] || ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && sendComment(p.id)}
                      placeholder="Escribe un comentario..."
                      style={{ flex: 1, padding: '9px 14px', borderRadius: 20, fontSize: 12.5, color: 'var(--text-dark)', border: '1.5px solid var(--border-input)', background: '#fff', outline: 'none' }}
                    />
                    <button aria-label="Enviar comentario" onClick={() => sendComment(p.id)} disabled={!(drafts[p.id] || '').trim() || sendingComment === p.id} style={{ width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (drafts[p.id] || '').trim() && sendingComment !== p.id ? 'var(--brand)' : 'var(--disabled)' }}>
                      <Icon name="send" size={15} color="#fff" />
                    </button>
                  </div>
                  {commentErrors[p.id] ? (
                    <p style={{ marginTop: 6, fontSize: 11.5, color: 'var(--danger)' }}>{commentErrors[p.id]}</p>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      )}

      {/* FAB */}
      <button onClick={() => setComposeOpen(true)} aria-label="Crear publicación"
        style={{ position: 'fixed', bottom: 30, right: 30, width: 60, height: 60, borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-gradient)', boxShadow: '0 14px 30px -10px rgba(31,126,118,.7)', zIndex: 40 }}>
        <Icon name="plus" size={26} color="#fff" strokeWidth={2.4} />
      </button>

      {composeOpen ? (
        <div className="modal-backdrop" onClick={() => setComposeOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()} style={{ padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 20, fontWeight: 600, color: 'var(--text-dark)' }}>Crear publicación</h3>
              <button onClick={() => setComposeOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F4EEE2' }}>
                <Icon name="x" size={16} color="var(--text-muted)" />
              </button>
            </div>

            <div style={{ marginBottom: 14, padding: 12, borderRadius: 12, background: 'var(--nav-bg)', border: '1px solid #DCEDEA' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6 }}>Puedes compartir:</div>
              {SHARE_BULLETS.map((b) => (
                <div key={b} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                  <span style={{ color: 'var(--brand)', fontSize: 12 }}>•</span>
                  <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text-body)', lineHeight: 1.4 }}>{b}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <span style={{ width: 40, height: 40, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,var(--clay),var(--clay-dark))', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>{myInitials}</span>
              <textarea
                value={composeText}
                onChange={(e) => setComposeText(e.target.value)}
                placeholder="¿Qué quieres compartir con la comunidad?"
                style={{ flex: 1, minHeight: 90, fontSize: 14, color: 'var(--text-dark)', lineHeight: 1.45, border: 'none', outline: 'none', resize: 'vertical', background: 'transparent' }}
              />
            </div>
            {attachment ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--nav-bg)', border: '1px solid #DCEDEA', margin: '10px 0' }}>
                <Icon name={attachment.mimeType.startsWith('video') ? 'video' : 'image'} size={16} color="var(--brand-dark)" />
                <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, color: 'var(--text-dark)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{attachment.title}</span>
                <button onClick={() => setAttachment(null)} aria-label="Quitar adjunto" style={{ width: 26, height: 26, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
                  <Icon name="x" size={13} color="var(--danger)" />
                </button>
              </div>
            ) : null}

            <input ref={imageInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />
            <input ref={videoInputRef} type="file" accept="video/*" style={{ display: 'none' }}
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAttach(f); e.target.value = ''; }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', margin: '12px 0' }}>
              <button onClick={() => imageInputRef.current?.click()} disabled={attaching} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="image" size={18} color="var(--brand)" /><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--brand-dark)' }}>Imagen</span>
              </button>
              <button onClick={() => videoInputRef.current?.click()} disabled={attaching} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Icon name="video" size={18} color="var(--clay)" /><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--clay-dark)' }}>Video</span>
              </button>
              {attaching ? <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Subiendo…</span> : null}
            </div>
            {composeError ? (
              <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--danger)' }}>{composeError}</p>
            ) : null}
            <button className="btn btn-primary" onClick={submitPost} disabled={!composeText.trim() || attaching || submitting} style={{ padding: 13 }}>
              {submitting ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionBtn({ icon, value, active, activeColor, fill, disabled, pressed, label, onClick }: {
  icon: 'message-circle' | 'heart'; value: number; active?: boolean; activeColor?: string; fill?: boolean; disabled?: boolean; pressed?: boolean; label?: string; onClick?: () => void;
}) {
  const color = active ? activeColor! : 'var(--text-muted)';
  return (
    // Sin `aria-label` esto se leía como un número suelto: el icono no tiene
    // texto y el botón tampoco.
    <button onClick={onClick} disabled={disabled} aria-label={label} aria-pressed={pressed} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: active ? 700 : 400, color }}>
      <Icon name={icon} size={15} color={color} fill={fill ? color : 'none'} />
      <span>{value}</span>
    </button>
  );
}
