import { useEffect, useRef, useState } from 'react';
import { MODTAG, type MediaItem, type Post } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Masthead } from '@/components/Masthead';
import { api } from '@/lib/api';

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
  const [posts, setPosts] = useState<Post[]>([]);
  const [filter, setFilter] = useState('todos');
  const [openThread, setOpenThread] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');
  const [attachment, setAttachment] = useState<MediaItem | null>(null);
  const [attaching, setAttaching] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.posts.list(filter).then(setPosts);
  }, [filter]);

  const toggleLike = async (id: number) => {
    const updated = await api.posts.toggleLike(id);
    setPosts((ps) => ps.map((p) => (p.id === id ? updated : p)));
  };

  const sendComment = async (id: number) => {
    const text = (drafts[id] || '').trim();
    if (!text) return;
    const comment = await api.posts.addComment(id, { text });
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, comments: [...p.comments, comment] } : p)));
    setDrafts((d) => ({ ...d, [id]: '' }));
  };

  const submitPost = async () => {
    const text = composeText.trim();
    if (!text) return;
    const np = await api.posts.create({ text, attachments: attachment ? [attachment] : [] });
    setComposeOpen(false);
    setComposeText('');
    setAttachment(null);
    // re-fetch for current filter (new post has no module so only shows under "todos")
    if (filter === 'todos') setPosts((ps) => [np, ...ps]);
  };

  const handleAttach = async (file: File) => {
    setAttaching(true);
    try {
      setAttachment(await api.media.upload(file, file.name, 'posts'));
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {posts.map((p) => {
          const tag = p.module ? MODTAG[p.module] : null;
          const initials = p.user.split(' ').map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
          const threadOpen = openThread === p.id;
          return (
            <article key={p.id} style={{ borderRadius: 20, background: '#fff', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div style={{ padding: 20 }}>
                <div style={{ display: 'flex', gap: 13 }}>
                  <span style={{ width: 44, height: 44, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: p.avatarBg, color: '#fff', fontSize: 14, fontWeight: 800, flexShrink: 0 }}>{initials}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: 7 }}>
                      <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text-dark)' }}>{p.user}</span>
                      {p.verified ? <Icon name="check-circle" size={14} color="var(--brand)" /> : null}
                      <span style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.handle} · {p.time}</span>
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
                      <ActionBtn icon="message-circle" value={p.comments.length} onClick={() => setOpenThread(threadOpen ? null : p.id)} />
                      <ActionBtn icon="repeat" value={p.reposts} />
                      <ActionBtn icon="heart" value={p.likes} active={p.liked} activeColor="var(--danger)" fill={p.liked} onClick={() => toggleLike(p.id)} />
                      <div style={{ flex: 1 }} />
                      <button style={{ padding: 5 }} aria-label="Guardar">
                        <Icon name="bookmark" size={15} color="var(--text-muted)" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {threadOpen ? (
                <div style={{ padding: '12px 20px 18px', background: '#FBF7F0', borderTop: '1px solid var(--border)' }}>
                  {p.comments.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.avatarBg, color: '#fff', fontSize: 9, fontWeight: 800, flexShrink: 0 }}>{c.initials}</span>
                      <div style={{ flex: 1, background: '#fff', borderRadius: 12, padding: '8px 12px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-dark)' }}>{c.user}</span>
                          <span style={{ fontSize: 10.5, color: 'var(--text-faint)' }}>· {c.time}</span>
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
                    <button onClick={() => sendComment(p.id)} style={{ width: 34, height: 34, borderRadius: 17, display: 'flex', alignItems: 'center', justifyContent: 'center', background: (drafts[p.id] || '').trim() ? 'var(--brand)' : 'var(--disabled)' }}>
                      <Icon name="send" size={15} color="#fff" />
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

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
              <span style={{ width: 40, height: 40, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(150deg,var(--clay),var(--clay-dark))', color: '#fff', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>MR</span>
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
            <button className="btn btn-primary" onClick={submitPost} disabled={!composeText.trim() || attaching} style={{ padding: 13 }}>
              Publicar
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ActionBtn({ icon, value, active, activeColor, fill, onClick }: {
  icon: 'message-circle' | 'repeat' | 'heart'; value: number; active?: boolean; activeColor?: string; fill?: boolean; onClick?: () => void;
}) {
  const color = active ? activeColor! : 'var(--text-muted)';
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: active ? 700 : 400, color }}>
      <Icon name={icon} size={15} color={color} fill={fill ? color : 'none'} />
      <span>{value}</span>
    </button>
  );
}
