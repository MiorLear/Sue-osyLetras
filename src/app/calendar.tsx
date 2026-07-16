import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { CalEvent as ApiCalEvent } from '@explorarte/shared';
import { BottomNav, MAIN_TABS } from '@/components/bottom-nav';
import { Icon } from '@/components/icon';
import { Select } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { enqueueEventCreate, enqueueEventRemove, enqueueEventUpdate, usePendingCount } from '@/lib/mutation-queue';
import { useIsOnline } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';

type ViewMode = 'día' | 'semana' | 'mes';
type EventType = 'sesión' | 'tarea' | 'recordatorio' | 'evento';
type ModalMode = 'create' | 'detail' | 'edit' | 'delete' | null;

interface CalEvent {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  startTime: string;
  endTime: string;
  reminder: string;
  completed?: boolean;
}

const COLORS: Record<EventType, string> = {
  sesión: '#3DBFB8',
  tarea: '#F59E0B',
  recordatorio: '#7C3AED',
  evento: '#3B82F6',
};
const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TYPES: EventType[] = ['sesión', 'tarea', 'recordatorio', 'evento'];
const REMINDERS = ['ninguno', '10 minutos antes', '30 minutos antes', '1 hora antes', '1 día antes'];

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (date: Date, n: number) => {
  const r = new Date(date);
  r.setDate(r.getDate() + n);
  return r;
};
const startOfWeek = (date: Date) => addDays(date, -date.getDay());
const toISO = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => {
  const [y, m, dd] = s.split('-').map(Number);
  return new Date(y, m - 1, dd);
};

// Placeholder id for an event created offline; replaced by the server id once
// the queued create syncs (see the offline mutation queue).
const makeTempId = () => 'tmp-' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

// The API represents dates as "YYYY-MM-DD" strings; the screen's date-math
// helpers above all work with JS Date objects, so convert at the boundary.
const fromApiEvent = (e: ApiCalEvent): CalEvent => ({
  id: e.id,
  title: e.title,
  type: e.type as EventType,
  date: fromISO(e.date),
  startTime: e.startTime,
  endTime: e.endTime,
  reminder: e.reminder,
  completed: e.completed ?? undefined,
});

const TODAY = new Date();

interface Form {
  title: string;
  type: EventType;
  dateStr: string;
  startTime: string;
  endTime: string;
  reminder: string;
}
const blankForm = (date: Date): Form => ({
  title: '',
  type: 'sesión',
  dateStr: toISO(date),
  startTime: '10:00',
  endTime: '11:00',
  reminder: 'ninguno',
});

export default function CalendarScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState<ViewMode>('día');
  const [selDate, setSelDate] = useState(TODAY);
  const { data: loadedEvents, loading, error, reload } = useOfflineAsync('events', () => api.events.list(), []);
  const online = useIsOnline();
  const pending = usePendingCount();
  const prevPending = useRef(pending);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selEvent, setSelEvent] = useState<CalEvent | null>(null);
  const [form, setForm] = useState<Form>(blankForm(TODAY));
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep a local, mutable copy of the loaded events so create/update/delete/
  // toggle can update the list in place; re-sync whenever a fresh load lands.
  useEffect(() => {
    if (loadedEvents) setEvents(loadedEvents.map(fromApiEvent));
  }, [loadedEvents]);

  // When the offline queue drains (its changes just synced), refetch so the
  // optimistic temp events are replaced by the real server ones.
  useEffect(() => {
    if (prevPending.current > 0 && pending === 0) reload();
    prevPending.current = pending;
  }, [pending, reload]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  };

  const closeModal = () => {
    setModal(null);
    setSelEvent(null);
  };
  const openCreate = () => {
    setForm(blankForm(selDate));
    setSelEvent(null);
    setModal('create');
  };
  const openDetail = (ev: CalEvent) => {
    setSelEvent(ev);
    setModal('detail');
  };
  const startEdit = () => {
    if (!selEvent) return;
    setForm({
      title: selEvent.title,
      type: selEvent.type,
      dateStr: toISO(selEvent.date),
      startTime: selEvent.startTime,
      endTime: selEvent.endTime,
      reminder: selEvent.reminder || 'ninguno',
    });
    setModal('edit');
  };
  const submitForm = async () => {
    if (!form.title.trim()) {
      showToast('Por favor ingresa un título');
      return;
    }
    setSubmitting(true);
    const input = {
      title: form.title,
      type: form.type,
      date: form.dateStr,
      startTime: form.startTime,
      endTime: form.endTime,
      reminder: form.reminder,
    };
    const optimistic = (id: string, completed?: boolean): CalEvent => ({
      id,
      title: form.title,
      type: form.type,
      date: fromISO(form.dateStr),
      startTime: form.startTime,
      endTime: form.endTime,
      reminder: form.reminder,
      completed,
    });
    const isEdit = modal === 'edit' && !!selEvent;
    const queueChange = async () => {
      if (isEdit && selEvent) {
        await enqueueEventUpdate(selEvent.id, input);
        setEvents((es) => es.map((e) => (e.id === selEvent.id ? optimistic(selEvent.id, e.completed) : e)));
      } else {
        const tempId = makeTempId();
        await enqueueEventCreate(tempId, { ...input, completed: false });
        setEvents((es) => [...es, optimistic(tempId, false)]);
      }
    };
    try {
      if (online) {
        if (isEdit && selEvent) {
          const updated = await api.events.update(selEvent.id, input);
          setEvents((es) => es.map((e) => (e.id === selEvent.id ? fromApiEvent(updated) : e)));
          showToast('Evento actualizado correctamente');
        } else {
          const created = await api.events.create({ ...input, completed: false });
          setEvents((es) => [...es, fromApiEvent(created)]);
          showToast('Evento creado correctamente');
        }
      } else {
        await queueChange();
        showToast(isEdit ? 'Se actualizará al reconectar' : 'Se creará al reconectar');
      }
      closeModal();
    } catch {
      // Online attempt failed → keep the change queued so it syncs later.
      try {
        await queueChange();
        showToast('Se guardará al reconectar');
        closeModal();
      } catch {
        Alert.alert('Error', 'No se pudo guardar el evento. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  const confirmDelete = async () => {
    if (!selEvent) {
      closeModal();
      return;
    }
    setDeleting(true);
    const id = selEvent.id;
    try {
      if (online) await api.events.remove(id);
      else await enqueueEventRemove(id);
      setEvents((es) => es.filter((e) => e.id !== id));
      closeModal();
      showToast(online ? 'Evento eliminado' : 'Se eliminará al reconectar');
    } catch {
      try {
        await enqueueEventRemove(id);
        setEvents((es) => es.filter((e) => e.id !== id));
        closeModal();
        showToast('Se eliminará al reconectar');
      } catch {
        Alert.alert('Error', 'No se pudo eliminar el evento. Intenta de nuevo.');
      }
    } finally {
      setDeleting(false);
    }
  };
  const toggleTask = async (id: string) => {
    const current = events.find((e) => e.id === id);
    if (!current || current.type !== 'tarea') return;
    setTogglingId(id);
    const next = !current.completed;
    try {
      if (online) {
        const updated = await api.events.update(id, { completed: next });
        setEvents((es) => es.map((e) => (e.id === id ? fromApiEvent(updated) : e)));
      } else {
        await enqueueEventUpdate(id, { completed: next });
        setEvents((es) => es.map((e) => (e.id === id ? { ...e, completed: next } : e)));
      }
    } catch {
      try {
        await enqueueEventUpdate(id, { completed: next });
        setEvents((es) => es.map((e) => (e.id === id ? { ...e, completed: next } : e)));
      } catch {
        Alert.alert('Error', 'No se pudo actualizar la tarea. Intenta de nuevo.');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const dayEvents = events.filter((e) => sameDay(e.date, selDate));

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Header */}
      <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, paddingBottom: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <Pressable onPress={() => router.push('/main')} style={{ padding: 4 }}>
            <Icon name="arrow-left" size={24} color={colors.textDark} />
          </Pressable>
          <Pressable
            onPress={openCreate}
            style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand }}>
            <Icon name="plus" size={20} color="#fff" strokeWidth={2.4} />
          </Pressable>
        </View>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.textDark }}>Mi Calendario</Text>
        <Text style={{ marginTop: 2, fontSize: 12, color: colors.textMuted }}>Organiza tus sesiones y actividades</Text>
      </View>

      {/* View tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingVertical: 14, paddingHorizontal: 20, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: colors.border }}>
        {(['día', 'semana', 'mes'] as ViewMode[]).map((v) => (
          <Pressable
            key={v}
            onPress={() => setView(v)}
            style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: view === v ? colors.brand : 'transparent' }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: view === v ? '#fff' : colors.textBody, textTransform: 'capitalize' }}>
              {v === 'día' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 32 }} />
        ) : error ? (
          <View style={{ marginTop: 40, alignItems: 'center', gap: 12 }}>
            <Text style={{ fontSize: 13, color: colors.textBody, textAlign: 'center' }}>
              No pudimos cargar tu calendario. Revisa tu conexión.
            </Text>
            <Pressable
              onPress={reload}
              style={{ paddingVertical: 9, paddingHorizontal: 18, borderRadius: 10, backgroundColor: colors.brand }}>
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {events.length === 0 ? (
              <Text style={{ fontSize: 12.5, color: colors.textMuted, marginBottom: 16 }}>
                Aún no tienes eventos. Toca el botón + para crear uno.
              </Text>
            ) : null}
            {view === 'día' ? (
              <DayView selDate={selDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} />
            ) : null}
            {view === 'semana' ? (
              <WeekView selDate={selDate} setSelDate={setSelDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} />
            ) : null}
            {view === 'mes' ? <MonthView selDate={selDate} setSelDate={setSelDate} events={events} /> : null}
          </>
        )}
        <View style={{ height: 16 }} />
      </ScrollView>

      <BottomNav items={MAIN_TABS} />

      {/* Toast */}
      {toast ? (
        <View
          style={{
            position: 'absolute',
            top: insets.top + 8,
            alignSelf: 'center',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingVertical: 10,
            paddingHorizontal: 16,
            borderRadius: 12,
            backgroundColor: '#1A3A38',
            boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
          }}>
          <Icon name="check-circle" size={15} color="#4DD9A6" strokeWidth={2.4} />
          <Text style={{ fontSize: 12.5, fontWeight: '600', color: '#fff' }}>{toast}</Text>
        </View>
      ) : null}

      {/* Modal */}
      <Modal visible={modal !== null} transparent animationType="slide" onRequestClose={closeModal}>
        <Pressable onPress={closeModal} style={{ flex: 1, backgroundColor: 'rgba(20,40,38,0.45)', justifyContent: 'flex-end' }}>
          <Pressable onPress={(e) => e.stopPropagation()} style={{ backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }}>
              <Text style={{ fontSize: 17, fontWeight: '800', color: colors.textDark }}>
                {modal === 'create' ? 'Nuevo evento' : modal === 'edit' ? 'Editar evento' : modal === 'delete' ? 'Eliminar evento' : selEvent?.title}
              </Text>
              <Pressable onPress={closeModal} style={{ padding: 4 }}>
                <Icon name="x" size={20} color={colors.textMuted} />
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
              {modal === 'create' || modal === 'edit' ? (
                <EventForm
                  form={form}
                  setForm={setForm}
                  submitLabel={modal === 'edit' ? 'Guardar cambios' : 'Guardar evento'}
                  onCancel={() => setModal(selEvent ? 'detail' : null)}
                  onSubmit={submitForm}
                  submitting={submitting}
                />
              ) : null}
              {modal === 'detail' && selEvent ? (
                <EventDetail event={selEvent} onEdit={startEdit} onDelete={() => setModal('delete')} onClose={closeModal} />
              ) : null}
              {modal === 'delete' ? (
                <View>
                  <Text style={{ fontSize: 14, color: colors.textBody, marginBottom: 20 }}>
                    ¿Seguro que deseas eliminar este evento?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <ModalBtn label="Cancelar" outline onPress={() => setModal('detail')} disabled={deleting} />
                    <ModalBtn label={deleting ? 'Eliminando…' : 'Eliminar'} danger onPress={confirmDelete} disabled={deleting} />
                  </View>
                </View>
              ) : null}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function EventCard({ event, onEvent, onToggle, toggling }: { event: CalEvent; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; toggling?: boolean }) {
  const color = COLORS[event.type];
  const isTask = event.type === 'tarea';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: 12,
        alignItems: 'flex-start',
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#fff',
        borderWidth: 1.5,
        borderColor: color + '40',
        opacity: event.completed ? 0.6 : 1,
      }}>
      <View style={{ width: 4, height: 44, borderRadius: 9, backgroundColor: color }} />
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        {isTask ? (
          <Pressable
            onPress={() => onToggle(event.id)}
            disabled={toggling}
            style={{
              width: 18,
              height: 18,
              marginTop: 1,
              borderRadius: 5,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: event.completed ? colors.brand : '#fff',
              borderWidth: 2,
              borderColor: event.completed ? colors.brand : '#C0DEDC',
              opacity: toggling ? 0.5 : 1,
            }}>
            {event.completed ? <Icon name="check" size={12} color="#fff" strokeWidth={3} /> : null}
          </Pressable>
        ) : null}
        <Pressable onPress={() => onEvent(event)} style={{ flex: 1 }}>
          <Text
            style={{
              fontSize: 14,
              fontWeight: '700',
              color: colors.textDark,
              textDecorationLine: event.completed ? 'line-through' : 'none',
            }}>
            {event.title}
          </Text>
          <Text style={{ marginTop: 2, fontSize: 11.5, color: colors.textMuted }}>
            {event.startTime} - {event.endTime}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function DayView({
  selDate,
  dayEvents,
  onEvent,
  onToggle,
  togglingId,
}: {
  selDate: Date;
  dayEvents: CalEvent[];
  onEvent: (e: CalEvent) => void;
  onToggle: (id: string) => void;
  togglingId: string | null;
}) {
  const slots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 7;
    const evs = dayEvents.filter((e) => parseInt(e.startTime.split(':')[0], 10) === hour);
    const label = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
    return { label, evs };
  });
  const title = `${DOW_SHORT[selDate.getDay()]} ${selDate.getDate()} ${MONTHS[selDate.getMonth()].slice(0, 3)}`;

  return (
    <View>
      <Text style={{ marginBottom: 16, fontSize: 14, fontWeight: '700', color: colors.textDark }}>Hoy · {title}</Text>
      <View style={{ gap: 12 }}>
        {slots.map((slot) => (
          <View key={slot.label} style={{ flexDirection: 'row', gap: 12 }}>
            <Text style={{ width: 60, fontSize: 11.5, color: colors.textMuted, paddingTop: 2 }}>{slot.label}</Text>
            <View style={{ flex: 1, gap: 8 }}>
              {slot.evs.length === 0 ? (
                <View style={{ height: 32, borderBottomWidth: 1, borderBottomColor: colors.border }} />
              ) : (
                slot.evs.map((ev) => (
                  <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} toggling={togglingId === ev.id} />
                ))
              )}
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

function WeekView({
  selDate,
  setSelDate,
  dayEvents,
  onEvent,
  onToggle,
  togglingId,
}: {
  selDate: Date;
  setSelDate: (d: Date) => void;
  dayEvents: CalEvent[];
  onEvent: (e: CalEvent) => void;
  onToggle: (id: string) => void;
  togglingId: string | null;
}) {
  const ws = startOfWeek(selDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const sorted = dayEvents.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
  const title = `${DOW_LONG[selDate.getDay()]}, ${selDate.getDate()} de ${MONTHS[selDate.getMonth()]}`;

  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 20 }}>
        {weekDays.map((day) => {
          const isSel = sameDay(day, selDate);
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => setSelDate(day)}
              style={{
                flex: 1,
                paddingVertical: 8,
                borderRadius: 10,
                alignItems: 'center',
                gap: 3,
                backgroundColor: isSel ? colors.brand : '#fff',
                borderWidth: isSel ? 0 : 1.5,
                borderColor: colors.border,
              }}>
              <Text style={{ fontSize: 10, fontWeight: '600', color: isSel ? '#fff' : colors.textBody, textTransform: 'capitalize' }}>
                {DOW_SHORT[day.getDay()]}
              </Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: isSel ? '#fff' : colors.textBody }}>{day.getDate()}</Text>
            </Pressable>
          );
        })}
      </View>
      <Text style={{ marginBottom: 12, fontSize: 13, fontWeight: '700', color: colors.textDark, textTransform: 'capitalize' }}>{title}</Text>
      <View style={{ gap: 8 }}>
        {sorted.length === 0 ? (
          <Text style={{ fontSize: 12, color: colors.textMuted, textAlign: 'center', paddingVertical: 20 }}>
            No hay eventos para este día
          </Text>
        ) : (
          sorted.map((ev) => (
            <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} toggling={togglingId === ev.id} />
          ))
        )}
      </View>
    </View>
  );
}

function MonthView({ selDate, setSelDate, events }: { selDate: Date; setSelDate: (d: Date) => void; events: CalEvent[] }) {
  const monthStart = new Date(selDate.getFullYear(), selDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const headers = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  return (
    <View>
      <Text style={{ marginBottom: 16, fontSize: 16, fontWeight: '800', color: colors.textDark, textTransform: 'capitalize' }}>
        {MONTHS[selDate.getMonth()]} {selDate.getFullYear()}
      </Text>
      <View style={{ flexDirection: 'row', marginBottom: 4 }}>
        {headers.map((h) => (
          <View key={h} style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>{h}</Text>
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((day) => {
          const isCur = day.getMonth() === selDate.getMonth();
          const isToday = sameDay(day, TODAY);
          const isSel = sameDay(day, selDate);
          const evs = events.filter((e) => sameDay(e.date, day));
          return (
            <Pressable
              key={day.toISOString()}
              onPress={() => setSelDate(day)}
              style={{
                width: `${100 / 7}%`,
                aspectRatio: 1,
                padding: 2,
              }}>
              <View
                style={{
                  flex: 1,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: isToday || isSel ? colors.navBg : '#fff',
                  borderWidth: isSel ? 2 : 1.5,
                  borderColor: isSel || isToday ? colors.brand : colors.border,
                  opacity: isCur ? 1 : 0.4,
                }}>
                <Text style={{ fontSize: 12, fontWeight: isToday || isSel ? '700' : '400', color: isToday || isSel ? colors.brand : colors.textDark }}>
                  {day.getDate()}
                </Text>
                {evs.length > 0 ? (
                  <View style={{ flexDirection: 'row', gap: 2, marginTop: 3 }}>
                    {evs.slice(0, 3).map((e, i) => (
                      <View key={i} style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: COLORS[e.type] }} />
                    ))}
                  </View>
                ) : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.textDark, marginBottom: 6 }}>{label}</Text>
      {children}
    </View>
  );
}

function PlainInput(props: React.ComponentProps<typeof TextInput>) {
  return (
    <TextInput
      placeholderTextColor="#9DB8B5"
      {...props}
      style={[
        { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10, fontSize: 13, color: colors.textDark, borderWidth: 1.5, borderColor: colors.borderInput, backgroundColor: '#fff' },
        props.style,
      ]}
    />
  );
}

const fmtTime12 = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const ap = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ap}`;
};
const fmtDateLong = (iso: string) => {
  const dt = fromISO(iso);
  return `${dt.getDate()} de ${MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`;
};

// Campo de fecha con selector nativo.
function DateField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  const [show, setShow] = useState(false);
  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && date) onChange(toISO(date));
  };
  return (
    <FormField label={label}>
      <PickerTrigger icon="calendar" text={fmtDateLong(value)} onPress={() => setShow(true)} />
      {show ? <DateTimePicker value={fromISO(value)} mode="date" display="default" onChange={handle} /> : null}
    </FormField>
  );
}

// Campo de hora con selector nativo.
function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (hhmm: string) => void }) {
  const [show, setShow] = useState(false);
  const [h, m] = value.split(':').map(Number);
  const base = new Date(2026, 0, 1, h || 0, m || 0);
  const handle = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS !== 'ios') setShow(false);
    if (event.type === 'set' && date) {
      onChange(`${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`);
    }
  };
  return (
    <FormField label={label}>
      <PickerTrigger icon="clock" text={fmtTime12(value)} onPress={() => setShow(true)} />
      {show ? <DateTimePicker value={base} mode="time" display="default" onChange={handle} /> : null}
    </FormField>
  );
}

function PickerTrigger({ icon, text, onPress }: { icon: 'calendar' | 'clock'; text: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: colors.borderInput,
        backgroundColor: '#fff',
      }}>
      <Icon name={icon} size={15} color={colors.textMuted} />
      <Text style={{ flex: 1, fontSize: 13, color: colors.textDark }}>{text}</Text>
    </Pressable>
  );
}

function EventForm({
  form,
  setForm,
  submitLabel,
  onCancel,
  onSubmit,
  submitting,
}: {
  form: Form;
  setForm: (f: Form) => void;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  return (
    <View style={{ gap: 16 }}>
      <FormField label="Título">
        <PlainInput value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder="Nombre del evento" />
      </FormField>
      <FormField label="Tipo">
        <Select value={form.type} options={TYPES} onChange={(v) => setForm({ ...form, type: v as EventType })} />
      </FormField>
      <DateField label="Fecha" value={form.dateStr} onChange={(iso) => setForm({ ...form, dateStr: iso })} />
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <TimeField label="Inicio" value={form.startTime} onChange={(t) => setForm({ ...form, startTime: t })} />
        </View>
        <View style={{ flex: 1 }}>
          <TimeField label="Fin" value={form.endTime} onChange={(t) => setForm({ ...form, endTime: t })} />
        </View>
      </View>
      <FormField label="Recordatorio">
        <Select value={form.reminder} options={REMINDERS} onChange={(v) => setForm({ ...form, reminder: v })} />
      </FormField>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <ModalBtn label="Cancelar" outline onPress={onCancel} disabled={submitting} />
        <ModalBtn label={submitting ? 'Guardando…' : submitLabel} primary onPress={onSubmit} disabled={submitting} />
      </View>
    </View>
  );
}

function EventDetail({
  event,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalEvent;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const hasReminder = !!(event.reminder && event.reminder !== 'ninguno');
  return (
    <View style={{ gap: 16 }}>
      <DetailRow icon="calendar" label="Fecha" value={`${event.date.getDate()} de ${MONTHS[event.date.getMonth()]}, ${event.date.getFullYear()}`} />
      <DetailRow icon="clock" label="Hora" value={`${event.startTime} - ${event.endTime}`} />
      {hasReminder ? <DetailRow icon="bell" label="Recordatorio" value={event.reminder} /> : null}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable
          onPress={onEdit}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, borderWidth: 1.5, borderColor: colors.brand, backgroundColor: '#fff' }}>
          <Icon name="edit" size={14} color={colors.brand} />
          <Text style={{ color: colors.brand, fontSize: 13, fontWeight: '700' }}>Editar</Text>
        </Pressable>
        <Pressable
          onPress={onDelete}
          style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.danger }}>
          <Icon name="trash" size={14} color="#fff" />
          <Text style={{ color: '#fff', fontSize: 13, fontWeight: '700' }}>Eliminar</Text>
        </Pressable>
      </View>
      <Pressable onPress={onClose} style={{ paddingVertical: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: '#fff' }}>
        <Text style={{ color: colors.textBody, fontSize: 13, fontWeight: '700' }}>Cerrar</Text>
      </Pressable>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: 'calendar' | 'clock' | 'bell'; label: string; value: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ marginTop: 2 }}>
        <Icon name={icon} size={16} color={colors.textMuted} />
      </View>
      <View>
        <Text style={{ fontSize: 11.5, color: colors.textMuted, marginBottom: 2 }}>{label}</Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textDark }}>{value}</Text>
      </View>
    </View>
  );
}

function ModalBtn({
  label,
  onPress,
  primary,
  danger,
  outline,
  disabled,
}: {
  label: string;
  onPress: () => void;
  primary?: boolean;
  danger?: boolean;
  outline?: boolean;
  disabled?: boolean;
}) {
  const bg = danger ? colors.danger : primary ? colors.brand : '#fff';
  const fg = outline ? colors.brand : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        alignItems: 'center',
        backgroundColor: bg,
        borderWidth: outline ? 1.5 : 0,
        borderColor: colors.brand,
        opacity: disabled ? 0.6 : 1,
      }}>
      <Text style={{ color: fg, fontSize: 13, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}
