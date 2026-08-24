import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { EVENT_COLORS, type CalEvent, type EventType } from '@explorarte/shared';
import { CacheAgeNote, ContentState } from '@/components/ContentState';
import { Icon } from '@/components/Icon';
import { PendingBadge } from '@/components/PendingBadge';
import { toast } from '@/components/toast-store';
import { api } from '@/lib/api';
import { cacheKeys } from '@/lib/cache-keys';
import { isDeadSession } from '@/lib/offline-errors';
import { enqueueEventCreate, enqueueEventRemove, enqueueEventUpdate } from '@/lib/outbox';
import { isTempEventId, newTempEventId } from '@/lib/outbox-ids';
import { usePendingIndex } from '@/lib/use-outbox';
import { useIsOnline } from '@/lib/useNetworkStatus';
import { useOfflineAsync } from '@/lib/useOfflineAsync';
import { useRefetchOnDrain } from '@/lib/useRefetchOnDrain';

type ViewMode = 'día' | 'semana' | 'mes';
type ModalMode = 'create' | 'detail' | 'edit' | 'delete' | null;

const DOW_SHORT = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DOW_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const TYPES: EventType[] = ['sesión', 'tarea', 'recordatorio', 'evento'];
const REMINDERS = ['ninguno', '10 minutos antes', '30 minutos antes', '1 hora antes', '1 día antes'];

const TODAY = new Date();
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
const addDays = (date: Date, n: number) => { const r = new Date(date); r.setDate(r.getDate() + n); return r; };
const startOfWeek = (date: Date) => addDays(date, -date.getDay());
const toISO = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const fromISO = (s: string) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
const fmtTime12 = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); const ap = h >= 12 ? 'PM' : 'AM'; const h12 = h % 12 === 0 ? 12 : h % 12; return `${h12}:${String(m).padStart(2, '0')} ${ap}`; };
const normalizeTime = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(':');
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
};
const timeToMinutes = (hhmm: string) => {
  const [hours, minutes] = hhmm.split(':').map(Number);
  return hours * 60 + minutes;
};

interface Form { title: string; type: EventType; dateStr: string; startTime: string; endTime: string; reminder: string; }
const blankForm = (date: Date): Form => ({ title: '', type: 'sesión', dateStr: toISO(date), startTime: '10:00', endTime: '11:00', reminder: 'ninguno' });

export default function CalendarScreen() {
  const [view, setView] = useState<ViewMode>('día');
  const [selDate, setSelDate] = useState(new Date());
  const online = useIsOnline();
  const { data, status, ageMs, reload } = useOfflineAsync(
    cacheKeys.events(),
    () => api.events.list(),
    [],
  );
  const [serverEvents, setServerEvents] = useState<CalEvent[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selEvent, setSelEvent] = useState<CalEvent | null>(null);
  const [form, setForm] = useState<Form>(blankForm(new Date()));
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const newEventRef = useRef<HTMLButtonElement>(null);
  const editRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (data) setServerEvents(data);
  }, [data]);

  // Lo escrito sin conexión, al lado del espejo y nunca dentro: `serverEvents`
  // lo reemplaza entero cada revalidación, así que un evento optimista metido
  // ahí desaparecería en cuanto volviera la red, estando a salvo en la cola.
  const [draftEvents, setDraftEvents] = useState<Record<string, CalEvent>>({});
  const [draftRemoved, setDraftRemoved] = useState<Record<string, true>>({});

  const pending = usePendingIndex();
  useRefetchOnDrain(reload);

  // `events` sigue llamándose `events`, así que todo lo que hay debajo —las
  // tres vistas, el estado vacío, el filtro del día— no se entera de nada.
  const events = useMemo(() => {
    const base = serverEvents
      .filter((e) => !(draftRemoved[e.id] && pending.eventsRemoved.has(e.id)))
      .map((e) => (draftEvents[e.id] && pending.events.has(e.id) ? draftEvents[e.id] : e));
    const creados = Object.values(draftEvents).filter(
      (e) => isTempEventId(e.id) && pending.events.has(e.id),
    );
    return [...base, ...creados];
  }, [serverEvents, draftEvents, draftRemoved, pending]);

  const isPending = (id: string) => pending.events.has(id) || pending.eventsRemoved.has(id);

  useEffect(() => {
    if (!modal) return;
    if (modal === 'create' || modal === 'edit') titleInputRef.current?.focus();
    else closeButtonRef.current?.focus();
  }, [modal]);

  const closeModal = () => {
    const trigger = triggerRef.current;
    setModal(null);
    setSelEvent(null);
    // El disparador sigue montado al cerrar creación o detalle.
    trigger?.focus();
  };
  const openCreate = () => {
    triggerRef.current = newEventRef.current;
    setForm(blankForm(selDate));
    setSelEvent(null);
    setModal('create');
  };
  const openDetail = (ev: CalEvent) => {
    triggerRef.current = document.activeElement as HTMLElement | null;
    setSelEvent(ev);
    setModal('detail');
  };
  const startEdit = () => {
    if (!selEvent) return;
    setForm({ title: selEvent.title, type: selEvent.type, dateStr: selEvent.date, startTime: normalizeTime(selEvent.startTime), endTime: normalizeTime(selEvent.endTime), reminder: selEvent.reminder || 'ninguno' });
    setModal('edit');
  };

  const dismissModal = () => {
    if (modal === 'edit') {
      setModal('detail');
      // Editar se vuelve a montar al regresar al detalle.
      setTimeout(() => editRef.current?.focus(), 0);
      return;
    }
    closeModal();
  };

  const keepFocusInModal = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      dismissModal();
      return;
    }
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const submitForm = async () => {
    if (!form.title.trim()) { toast.error('Por favor ingresa un título'); return; }
    if (timeToMinutes(form.endTime) <= timeToMinutes(form.startTime)) {
      toast.error('La hora de fin debe ser posterior a la hora de inicio');
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    const input = {
      title: form.title,
      type: form.type,
      date: form.dateStr,
      startTime: form.startTime,
      endTime: form.endTime,
      reminder: form.reminder,
    };
    const isEdit = modal === 'edit' && !!selEvent;
    const encolar = async () => {
      if (isEdit && selEvent) {
        // El id puede ser provisional (un evento creado hace un momento sin
        // conexión). No se distingue aquí a propósito: el outbox reescribe el
        // objetivo cuando el alta aterriza, y así la pantalla no lleva casos
        // especiales.
        await enqueueEventUpdate(selEvent.id, input);
        setDraftEvents((d) => ({ ...d, [selEvent.id]: { ...selEvent, ...input } }));
      } else {
        const tempId = newTempEventId();
        await enqueueEventCreate(tempId, { ...input, completed: false });
        setDraftEvents((d) => ({ ...d, [tempId]: { id: tempId, ...input, completed: false } }));
      }
      closeModal();
      toast.info(isEdit ? 'Se actualizará cuando haya conexión.' : 'Se creará cuando haya conexión.', {
        title: 'Guardado sin conexión',
      });
    };

    try {
      // Un evento creado sin conexión no tiene id de servidor todavía, así que
      // su edición siempre pasa por la cola aunque haya red.
      if (online && !(isEdit && isTempEventId(selEvent!.id))) {
        if (isEdit && selEvent) {
          const updated = await api.events.update(selEvent.id, input);
          setServerEvents((es) => es.map((e) => (e.id === updated.id ? updated : e)));
          toast.success('Evento actualizado correctamente');
        } else {
          const created = await api.events.create({ ...input, completed: false });
          setServerEvents((es) => [...es, created]);
          toast.success('Evento creado correctamente');
        }
        closeModal();
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        toast.error('No se pudo guardar el evento. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!selEvent) { closeModal(); return; }
    if (submitting) return;
    setSubmitting(true);
    const id = selEvent.id;
    const encolar = async () => {
      // Si es un evento creado sin conexión, el outbox cancela su alta en vez
      // de encolar un borrado contra un id que el servidor nunca ha visto.
      await enqueueEventRemove(id);
      setDraftRemoved((d) => ({ ...d, [id]: true }));
      closeModal();
      toast.info('Se eliminará cuando haya conexión.', { title: 'Guardado sin conexión' });
    };

    try {
      if (online && !isTempEventId(id)) {
        await api.events.remove(id);
        setServerEvents((es) => es.filter((e) => e.id !== id));
        closeModal();
        toast.success('Evento eliminado');
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        toast.error('No se pudo eliminar el evento. Intenta de nuevo.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.type !== 'tarea') return;
    if (togglingId) return;
    setTogglingId(id);
    const next = !ev.completed;
    // Marcar y desmarcar sin conexión deja UNA sola actualización con el valor
    // final: el outbox funde las ediciones seguidas del mismo evento. Es lo que
    // hace que la casilla se sienta normal sin red.
    const encolar = async () => {
      await enqueueEventUpdate(id, { completed: next });
      setDraftEvents((d) => ({ ...d, [id]: { ...ev, completed: next } }));
    };

    try {
      if (online && !isTempEventId(id)) {
        const updated = await api.events.update(id, { completed: next });
        setServerEvents((es) => es.map((e) => (e.id === id ? updated : e)));
      } else {
        await encolar();
      }
    } catch (e) {
      if (isDeadSession(e)) return;
      try {
        await encolar();
      } catch {
        toast.error('No se pudo actualizar la tarea. Intenta de nuevo.');
      }
    } finally {
      setTogglingId(null);
    }
  };

  const dayEvents = events.filter((e) => sameDay(fromISO(e.date), selDate));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', marginBottom: 18, columnGap: 16, rowGap: 12 }}>
        <div className="page-head">
          <h1>Mi Calendario</h1>
          <p>Organiza tus sesiones y actividades</p>
        </div>
        <button ref={newEventRef} onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} /> Nuevo evento
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, maxWidth: 360 }}>
        {(['día', 'semana', 'mes'] as ViewMode[]).map((v) => (
          <button className="tap-44" key={v} aria-pressed={view === v} onClick={() => setView(v)} style={{ flex: 1, padding: 9, borderRadius: 10, background: view === v ? 'var(--brand)' : '#fff', color: view === v ? '#fff' : 'var(--text-body)', fontSize: 13, fontWeight: 700, border: view === v ? 'none' : '1.5px solid var(--border)' }}>
            {v === 'día' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 820 }}>
        {status === 'loading' || status === 'error' || status === 'offline-empty' ? (
          <ContentState status={status} onRetry={reload} what="tu calendario" />
        ) : (
          <>
            <CacheAgeNote status={status} ageMs={ageMs} />
            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Aún no tienes eventos. Crea uno con “Nuevo evento”.</p>
            ) : null}
            {view === 'día' ? <DayView selDate={selDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} isPending={isPending} /> : null}
            {view === 'semana' ? <WeekView selDate={selDate} setSelDate={setSelDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} isPending={isPending} /> : null}
            {view === 'mes' ? <MonthView selDate={selDate} setSelDate={setSelDate} events={events} isPending={isPending} /> : null}
          </>
        )}
      </div>

      {modal ? (
        <div className="modal-backdrop" onClick={dismissModal}>
          <div ref={dialogRef} className="modal-card" role="dialog" aria-modal="true" aria-labelledby="calendar-modal-title" onKeyDown={keepFocusInModal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 id="calendar-modal-title" style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-dark)' }}>
                {modal === 'create' ? 'Nuevo evento' : modal === 'edit' ? 'Editar evento' : modal === 'delete' ? 'Eliminar evento' : selEvent?.title}
              </h3>
              <button ref={closeButtonRef} className="tap-44" aria-label="Cerrar modal" onClick={dismissModal}><Icon name="x" size={20} color="var(--text-muted)" /></button>
            </div>
            <div className="modal-body" style={{ padding: 20 }}>
              {modal === 'create' || modal === 'edit' ? (
                <EventForm form={form} setForm={setForm} submitLabel={modal === 'edit' ? 'Guardar cambios' : 'Guardar evento'} onCancel={dismissModal} onSubmit={submitForm} submitting={submitting} titleInputRef={titleInputRef} />
              ) : null}
              {modal === 'detail' && selEvent ? (
                <EventDetail event={selEvent} onEdit={startEdit} onDelete={() => setModal('delete')} onClose={closeModal} editRef={editRef} />
              ) : null}
              {modal === 'delete' ? (
                <div>
                  <p style={{ fontSize: 14, color: 'var(--text-body)', marginBottom: 20 }}>¿Seguro que deseas eliminar este evento?</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <ModalBtn label="Cancelar" outline onClick={() => setModal('detail')} disabled={submitting} />
                    <ModalBtn label="Eliminar" danger onClick={confirmDelete} disabled={submitting} />
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function EventCard({ event, onEvent, onToggle, togglingId, pending }: { event: CalEvent; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null; pending?: boolean }) {
  const color = EVENT_COLORS[event.type];
  const isTask = event.type === 'tarea';
  const toggling = togglingId === event.id;
  return (
    <div className={pending ? 'is-pending' : undefined} style={{ display: 'flex', gap: 12, borderRadius: 12, padding: 12, background: '#fff', border: `1.5px solid ${color}40`, opacity: event.completed ? 0.6 : 1 }}>
      <span style={{ width: 4, height: 44, borderRadius: 9, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', gap: 8 }}>
        {isTask ? (
          <button
            className="tap-44"
            onClick={() => onToggle(event.id)}
            disabled={toggling}
            aria-label={`${event.completed ? 'Marcar como pendiente' : 'Marcar como completada'}: ${event.title}`}
            aria-pressed={!!event.completed}
            style={{ width: 44, height: 44, flexShrink: 0, opacity: toggling ? 0.5 : 1 }}>
            <span style={{ width: 18, height: 18, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: event.completed ? 'var(--brand)' : '#fff', border: `2px solid ${event.completed ? 'var(--brand)' : '#C0DEDC'}` }}>
              {event.completed ? <Icon name="check" size={12} color="#fff" strokeWidth={3} /> : null}
            </span>
          </button>
        ) : null}
        <button onClick={() => onEvent(event)} style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', textDecoration: event.completed ? 'line-through' : 'none' }}>{event.title}</div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-muted)' }}>{event.startTime} - {event.endTime}</div>
          {pending ? <div style={{ marginTop: 4 }}><PendingBadge label="Sin enviar" /></div> : null}
        </button>
      </div>
    </div>
  );
}

function DayView({ selDate, dayEvents, onEvent, onToggle, togglingId, isPending }: { selDate: Date; dayEvents: CalEvent[]; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null; isPending: (id: string) => boolean }) {
  const slots = Array.from({ length: 13 }, (_, i) => {
    const hour = i + 7;
    const evs = dayEvents.filter((e) => parseInt(e.startTime.split(':')[0], 10) === hour);
    const label = hour === 12 ? '12:00 PM' : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`;
    return { label, evs };
  });
  const title = `${DOW_SHORT[selDate.getDay()]} ${selDate.getDate()} ${MONTHS[selDate.getMonth()].slice(0, 3)}`;
  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 14, fontWeight: 700, color: 'var(--text-dark)' }}>Hoy · {title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {slots.map((slot) => (
          <div key={slot.label} style={{ display: 'flex', gap: 12 }}>
            <span style={{ width: 60, fontSize: 11.5, color: 'var(--text-muted)', paddingTop: 2, flexShrink: 0 }}>{slot.label}</span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {slot.evs.length === 0 ? <div style={{ height: 32, borderBottom: '1px solid var(--border)' }} /> : slot.evs.map((ev) => <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} togglingId={togglingId} pending={isPending(ev.id)} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({ selDate, setSelDate, dayEvents, onEvent, onToggle, togglingId, isPending }: { selDate: Date; setSelDate: (d: Date) => void; dayEvents: CalEvent[]; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null; isPending: (id: string) => boolean }) {
  const ws = startOfWeek(selDate);
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const sorted = dayEvents.slice().sort((a, b) => a.startTime.localeCompare(b.startTime));
  const title = `${DOW_LONG[selDate.getDay()]}, ${selDate.getDate()} de ${MONTHS[selDate.getMonth()]}`;
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        {weekDays.map((day) => {
          const isSel = sameDay(day, selDate);
          return (
            <button key={day.toISOString()} onClick={() => setSelDate(day)} style={{ flex: 1, padding: '8px 0', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: isSel ? 'var(--brand)' : '#fff', border: isSel ? 'none' : '1.5px solid var(--border)' }}>
              <span style={{ fontSize: 10, fontWeight: 600, color: isSel ? '#fff' : 'var(--text-body)' }}>{DOW_SHORT[day.getDay()]}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: isSel ? '#fff' : 'var(--text-body)' }}>{day.getDate()}</span>
            </button>
          );
        })}
      </div>
      <div style={{ marginBottom: 12, fontSize: 13, fontWeight: 700, color: 'var(--text-dark)', textTransform: 'capitalize' }}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {sorted.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay eventos para este día</p> : sorted.map((ev) => <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} togglingId={togglingId} pending={isPending(ev.id)} />)}
      </div>
    </div>
  );
}

function MonthView({ selDate, setSelDate, events, isPending }: { selDate: Date; setSelDate: (d: Date) => void; events: CalEvent[]; isPending: (id: string) => boolean }) {
  const monthStart = new Date(selDate.getFullYear(), selDate.getMonth(), 1);
  const gridStart = startOfWeek(monthStart);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const headers = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 16, fontWeight: 800, color: 'var(--text-dark)', textTransform: 'capitalize' }}>{MONTHS[selDate.getMonth()]} {selDate.getFullYear()}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
        {headers.map((h) => (<div key={h} style={{ textAlign: 'center', padding: '6px 0', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>{h}</div>))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((day) => {
          const isCur = day.getMonth() === selDate.getMonth();
          const isToday = sameDay(day, TODAY);
          const isSel = sameDay(day, selDate);
          const evs = events.filter((e) => sameDay(fromISO(e.date), day));
          const pendingCount = evs.filter((e) => isPending(e.id)).length;
          const eventLabel = `${evs.length} ${evs.length === 1 ? 'evento' : 'eventos'}`;
          const pendingLabel = pendingCount > 0
            ? `, ${pendingCount} ${pendingCount === 1 ? 'pendiente de enviar' : 'pendientes de enviar'}`
            : '';
          return (
            <button key={day.toISOString()} aria-label={`${DOW_LONG[day.getDay()]}, ${day.getDate()} de ${MONTHS[day.getMonth()]} de ${day.getFullYear()}. ${eventLabel}${pendingLabel}`} aria-pressed={isSel} aria-current={isToday ? 'date' : undefined} onClick={() => setSelDate(day)} style={{ aspectRatio: '1', padding: 2 }}>
              <div style={{ height: '100%', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isToday || isSel ? 'var(--nav-bg)' : '#fff', border: `${isSel ? 2 : 1.5}px solid ${isSel || isToday ? 'var(--brand)' : 'var(--border)'}`, opacity: isCur ? 1 : 0.4 }}>
                <span aria-hidden="true" style={{ fontSize: 13, fontWeight: isToday || isSel ? 700 : 400, color: isToday || isSel ? 'var(--brand)' : 'var(--text-dark)' }}>{day.getDate()}</span>
                {evs.length > 0 ? (
                  <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                    {/* En una rejilla de mes no cabe texto, así que lo pendiente
                        se dice con el mismo ámbar que la insignia y un punto algo
                        mayor. Hueco no valía: un cuadrado de 4px sin relleno y con
                        un borde pastel es invisible a esta escala. */}
                    {evs.slice(0, 3).map((e, i) => (<span aria-hidden="true" key={i} style={{ width: isPending(e.id) ? 7 : 5, height: isPending(e.id) ? 7 : 5, borderRadius: 4, background: isPending(e.id) ? 'var(--pending-accent)' : EVENT_COLORS[e.type] }} />))}
                  </div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FormField({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function EventSelect({ id, value, options, onChange }: { id: string; value: string; options: readonly string[]; onChange: (value: string) => void }) {
  return (
    <select id={id} className="select-native" value={value} onChange={(event) => onChange(event.target.value)} style={{ paddingLeft: 16, color: 'var(--text-dark)' }}>
      {options.map((option) => <option key={option} value={option}>{option}</option>)}
    </select>
  );
}

function EventForm({ form, setForm, submitLabel, onCancel, onSubmit, submitting, titleInputRef }: { form: Form; setForm: (f: Form) => void; submitLabel: string; onCancel: () => void; onSubmit: () => void; submitting: boolean; titleInputRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormField label="Título" htmlFor="event-title">
        <input ref={titleInputRef} id="event-title" className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del evento" />
      </FormField>
      <FormField label="Tipo" htmlFor="event-type">
        <EventSelect id="event-type" value={form.type} options={TYPES} onChange={(v) => setForm({ ...form, type: v as EventType })} />
      </FormField>
      <FormField label="Fecha" htmlFor="event-date">
        <input id="event-date" className="input" type="date" value={form.dateStr} onChange={(e) => { if (e.target.value) setForm({ ...form, dateStr: e.target.value }); }} />
      </FormField>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Inicio" htmlFor="event-start"><input id="event-start" className="input" type="time" value={form.startTime} onChange={(e) => { if (e.target.value) setForm({ ...form, startTime: e.target.value }); }} /></FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Fin" htmlFor="event-end"><input id="event-end" className="input" type="time" value={form.endTime} onChange={(e) => { if (e.target.value) setForm({ ...form, endTime: e.target.value }); }} /></FormField>
        </div>
      </div>
      <FormField label="Recordatorio" htmlFor="event-reminder">
        <EventSelect id="event-reminder" value={form.reminder} options={REMINDERS} onChange={(v) => setForm({ ...form, reminder: v })} />
      </FormField>
      <div style={{ display: 'flex', gap: 8 }}>
        <ModalBtn label="Cancelar" outline onClick={onCancel} disabled={submitting} />
        <ModalBtn label={submitting ? 'Guardando…' : submitLabel} primary onClick={onSubmit} disabled={submitting} />
      </div>
    </div>
  );
}

function EventDetail({ event, onEdit, onDelete, onClose, editRef }: { event: CalEvent; onEdit: () => void; onDelete: () => void; onClose: () => void; editRef: React.RefObject<HTMLButtonElement | null> }) {
  const dt = fromISO(event.date);
  const hasReminder = !!(event.reminder && event.reminder !== 'ninguno');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DetailRow icon="calendar" label="Fecha" value={`${dt.getDate()} de ${MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`} />
      <DetailRow icon="clock" label="Hora" value={`${fmtTime12(event.startTime)} - ${fmtTime12(event.endTime)}`} />
      {hasReminder ? <DetailRow icon="bell" label="Recordatorio" value={event.reminder} /> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button ref={editRef} className="tap-44" onClick={onEdit} style={{ flex: 1, gap: 6, padding: 11, borderRadius: 10, border: '1.5px solid var(--brand)', background: '#fff', color: 'var(--brand)', fontSize: 13, fontWeight: 700 }}>
          <Icon name="edit" size={14} color="var(--brand)" /> Editar
        </button>
        <button className="tap-44" onClick={onDelete} style={{ flex: 1, gap: 6, padding: 11, borderRadius: 10, background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <Icon name="trash" size={14} color="#fff" /> Eliminar
        </button>
      </div>
      <button className="tap-44" onClick={onClose} style={{ padding: 11, borderRadius: 10, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-body)', fontSize: 13, fontWeight: 700 }}>Cerrar</button>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: 'calendar' | 'clock' | 'bell'; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <span style={{ marginTop: 2 }}><Icon name={icon} size={16} color="var(--text-muted)" /></span>
      <div>
        <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{value}</div>
      </div>
    </div>
  );
}

function ModalBtn({ label, onClick, primary, danger, outline, disabled }: { label: string; onClick: () => void; primary?: boolean; danger?: boolean; outline?: boolean; disabled?: boolean }) {
  const bg = danger ? 'var(--danger)' : primary ? 'var(--brand)' : '#fff';
  const fg = outline ? 'var(--brand)' : '#fff';
  return (
    <button className="tap-44" onClick={onClick} disabled={disabled} style={{ flex: 1, padding: 11, borderRadius: 10, background: bg, color: fg, border: outline ? '1.5px solid var(--brand)' : 'none', fontSize: 13, fontWeight: 700, opacity: disabled ? 0.6 : 1 }}>{label}</button>
  );
}
