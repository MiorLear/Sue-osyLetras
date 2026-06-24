import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { brandGradient, colors } from '@/constants/theme';

interface Comment {
  user: string;
  initials: string;
  avatarBg: string;
  time: string;
  text: string;
}
interface Post {
  id: number;
  user: string;
  handle: string;
  verified: boolean;
  time: string;
  avatarBg: string;
  module: string | null;
  text: string;
  likes: number;
  liked: boolean;
  reposts: number;
  comments: Comment[];
}

const SEED: Post[] = [
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

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'alegria', label: '😊 Alegría' },
  { id: 'tristeza', label: '😢 Tristeza' },
  { id: 'enojo', label: '😠 Enojo' },
  { id: 'miedo', label: '😨 Miedo' },
];

const MODTAG: Record<string, { label: string; color: string; bg: string }> = {
  alegria: { label: 'Alegría', color: '#B7791F', bg: '#FEFCE8' },
  tristeza: { label: 'Tristeza', color: '#2B6CB0', bg: '#EBF8FF' },
  enojo: { label: 'Enojo', color: '#C53030', bg: '#FFF5F5' },
  miedo: { label: 'Miedo', color: '#6B46C1', bg: '#F5F0FF' },
};

const SHARE_BULLETS = [
  'Experiencias y buenas prácticas',
  'Adaptaciones de actividades',
  'Recomendaciones de libros',
  'Evidencias de trabajo',
  'Dudas y preguntas',
  'Ideas para inspirar a otras comunidades educativas',
];

export default function ComunidadExplorArteScreen() {
  const insets = useSafeAreaInsets();
  const { module } = useLocalSearchParams<{ module?: string }>();

  const [posts, setPosts] = useState<Post[]>(SEED);
  const [filter, setFilter] = useState(module || 'todos');
  const [openThread, setOpenThread] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeText, setComposeText] = useState('');

  const visible = useMemo(
    () => (filter === 'todos' ? posts : posts.filter((p) => p.module === filter)),
    [posts, filter],
  );

  const toggleLike = (id: number) =>
    setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, liked: !p.liked, likes: p.liked ? p.likes - 1 : p.likes + 1 } : p)));

  const sendComment = (id: number) => {
    const text = (drafts[id] || '').trim();
    if (!text) return;
    setPosts((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, comments: [...p.comments, { user: 'María Reneé', initials: 'MR', avatarBg: '#3DBFB8', time: 'ahora', text }] } : p,
      ),
    );
    setDrafts((d) => ({ ...d, [id]: '' }));
  };

  const submitPost = () => {
    const text = composeText.trim();
    if (!text) return;
    const np: Post = {
      id: Date.now(), user: 'María Reneé', handle: '@maria_r', verified: false, time: 'ahora', avatarBg: '#3DBFB8', module: null, text, likes: 0, liked: false, reposts: 0, comments: [],
    };
    setPosts((ps) => [np, ...ps]);
    setComposeOpen(false);
    setComposeText('');
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <LinearGradient
        colors={brandGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ paddingTop: insets.top + 12, paddingBottom: 12, paddingHorizontal: 16, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: -24, right: -24, width: 96, height: 96, borderRadius: 48, opacity: 0.2, backgroundColor: '#fff' }} />
        <View style={{ marginBottom: 12 }}>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>Sueños y Letras</Text>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '800' }}>Comunidad ExplorArte</Text>
          <Text style={{ marginTop: 6, color: 'rgba(255,255,255,0.9)', fontSize: 12, lineHeight: 17 }}>
            Comparte experiencias, aprendizajes e ideas con otras docentes que están promoviendo el
            bienestar emocional en sus comunidades educativas.
          </Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {FILTERS.map((f) => {
            const active = filter === f.id;
            return (
              <Pressable
                key={f.id}
                onPress={() => setFilter(f.id)}
                style={{ paddingVertical: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: active ? '#fff' : 'rgba(255,255,255,0.2)' }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: active ? '#2A9A95' : '#fff' }}>{f.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </LinearGradient>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 12, gap: 10 }} showsVerticalScrollIndicator={false}>
        {visible.map((p) => {
          const tag = p.module ? MODTAG[p.module] : null;
          const initials = p.user.split(' ').map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase();
          const threadOpen = openThread === p.id;
          return (
            <View key={p.id} style={{ borderRadius: 16, backgroundColor: '#fff', overflow: 'hidden', borderWidth: 1.5, borderColor: colors.border }}>
              <View style={{ padding: 14 }}>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: p.avatarBg }}>
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{initials}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: 5 }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textDark }}>{p.user}</Text>
                      {p.verified ? <Icon name="check-circle" size={13} color={colors.brand} /> : null}
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>{p.handle}</Text>
                      <Text style={{ fontSize: 11.5, color: colors.textMuted }}>· {p.time}</Text>
                    </View>
                    {tag ? (
                      <View style={{ alignSelf: 'flex-start', marginTop: 4, backgroundColor: tag.bg, borderRadius: 6, paddingVertical: 2, paddingHorizontal: 8 }}>
                        <Text style={{ fontSize: 10, fontWeight: '700', color: tag.color }}>Emoción: {tag.label}</Text>
                      </View>
                    ) : null}
                    <Text style={{ marginTop: 8, fontSize: 13, color: '#2D4A48', lineHeight: 19 }}>{p.text}</Text>
                  </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingLeft: 48 }}>
                  <ActionBtn icon="message-circle" value={p.comments.length} onPress={() => setOpenThread(threadOpen ? null : p.id)} />
                  <ActionBtn icon="repeat" value={p.reposts} />
                  <ActionBtn icon="heart" value={p.likes} active={p.liked} activeColor={colors.danger} fill={p.liked} onPress={() => toggleLike(p.id)} />
                  <View style={{ flex: 1 }} />
                  <Pressable style={{ padding: 5 }}>
                    <Icon name="bookmark" size={15} color={colors.textMuted} />
                  </Pressable>
                </View>
              </View>

              {threadOpen ? (
                <View style={{ padding: 14, paddingTop: 12, backgroundColor: '#F7FCFC', borderTopWidth: 1, borderTopColor: colors.border }}>
                  {p.comments.map((c, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                      <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: c.avatarBg }}>
                        <Text style={{ color: '#fff', fontSize: 9, fontWeight: '800' }}>{c.initials}</Text>
                      </View>
                      <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#EAF4F3' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 5 }}>
                          <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDark }}>{c.user}</Text>
                          <Text style={{ fontSize: 10.5, color: colors.textMuted }}>· {c.time}</Text>
                        </View>
                        <Text style={{ marginTop: 2, fontSize: 12, color: colors.textBody, lineHeight: 17 }}>{c.text}</Text>
                      </View>
                    </View>
                  ))}
                  <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 6 }}>
                    <TextInput
                      value={drafts[p.id] || ''}
                      onChangeText={(t) => setDrafts((d) => ({ ...d, [p.id]: t }))}
                      placeholder="Escribe un comentario..."
                      placeholderTextColor="#9DB8B5"
                      style={{ flex: 1, paddingVertical: 9, paddingHorizontal: 14, borderRadius: 20, fontSize: 12.5, color: colors.textDark, borderWidth: 1.5, borderColor: colors.borderInput, backgroundColor: '#fff' }}
                    />
                    <Pressable
                      onPress={() => sendComment(p.id)}
                      style={{ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: (drafts[p.id] || '').trim() ? colors.brand : colors.disabled }}>
                      <Icon name="send" size={15} color="#fff" />
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}
        <View style={{ height: 80 }} />
      </ScrollView>

      {/* FAB */}
      <Pressable
        onPress={() => setComposeOpen(true)}
        style={{ position: 'absolute', bottom: insets.bottom + 90, right: 20, width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' }}>
        <LinearGradient
          colors={brandGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 24px rgba(61,191,184,0.45)' }}>
          <Icon name="plus" size={26} color="#fff" strokeWidth={2.4} />
        </LinearGradient>
      </Pressable>

      {/* Compose modal */}
      <Modal visible={composeOpen} transparent animationType="slide" onRequestClose={() => setComposeOpen(false)}>
        <Pressable onPress={() => setComposeOpen(false)} style={{ flex: 1, backgroundColor: 'rgba(20,40,38,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: insets.bottom + 20 }}>
            <View style={{ width: 40, height: 4, borderRadius: 9, backgroundColor: colors.borderInput, alignSelf: 'center', marginBottom: 16 }} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.textDark }}>Crear publicación</Text>
              <Pressable onPress={() => setComposeOpen(false)} style={{ width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0F5F5' }}>
                <Icon name="x" size={16} color={colors.textMuted} />
              </Pressable>
            </View>

            <View style={{ marginBottom: 14, padding: 12, borderRadius: 12, backgroundColor: '#F2FAFA', borderWidth: 1, borderColor: colors.borderSoft }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDark, marginBottom: 6 }}>Puedes compartir:</Text>
              {SHARE_BULLETS.map((b) => (
                <View key={b} style={{ flexDirection: 'row', gap: 6, marginBottom: 2 }}>
                  <Text style={{ color: colors.brand, fontSize: 12 }}>•</Text>
                  <Text style={{ flex: 1, fontSize: 11.5, color: colors.textBody, lineHeight: 17 }}>{b}</Text>
                </View>
              ))}
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
                <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>MR</Text>
              </View>
              <TextInput
                value={composeText}
                onChangeText={setComposeText}
                placeholder="¿Qué quieres compartir con la comunidad?"
                placeholderTextColor="#9DB8B5"
                multiline
                style={{ flex: 1, minHeight: 90, fontSize: 14, color: colors.textDark, lineHeight: 20, textAlignVertical: 'top' }}
              />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F0F5F5', marginVertical: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="image" size={18} color={colors.brand} />
                <Text style={{ fontSize: 12, fontWeight: '600', color: colors.brand }}>Imagen</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="video" size={18} color="#7C3AED" />
                <Text style={{ fontSize: 12, fontWeight: '600', color: '#7C3AED' }}>Video</Text>
              </View>
            </View>
            {composeText.trim() ? (
              <Pressable onPress={submitPost}>
                <LinearGradient colors={brandGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ paddingVertical: 13, borderRadius: 12, alignItems: 'center' }}>
                  <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Publicar</Text>
                </LinearGradient>
              </Pressable>
            ) : (
              <View style={{ paddingVertical: 13, borderRadius: 12, alignItems: 'center', backgroundColor: colors.disabled }}>
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>Publicar</Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <BottomNav items={MAIN_TABS} />
    </View>
  );
}

function ActionBtn({
  icon,
  value,
  active,
  activeColor,
  fill,
  onPress,
}: {
  icon: 'message-circle' | 'repeat' | 'heart';
  value: number;
  active?: boolean;
  activeColor?: string;
  fill?: boolean;
  onPress?: () => void;
}) {
  const color = active ? activeColor! : colors.textMuted;
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 9 }}>
      <Icon name={icon} size={15} color={color} fill={fill ? color : 'none'} />
      <Text style={{ fontSize: 12, fontWeight: '600', color }}>{value}</Text>
    </Pressable>
  );
}
