import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EVENT_COLORS, type CalEvent, type EventType } from '@explorarte/shared';
import { Icon } from '@/components/Icon';
import { Select } from '@/components/ui';
import { api } from '@/lib/api';
import { useAsync } from '@/lib/useAsync';

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

interface Form { title: string; type: EventType; dateStr: string; startTime: string; endTime: string; reminder: string; }
const blankForm = (date: Date): Form => ({ title: '', type: 'sesión', dateStr: toISO(date), startTime: '10:00', endTime: '11:00', reminder: 'ninguno' });

export default function CalendarScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>('día');
  const [selDate, setSelDate] = useState(new Date());
  const { data, loading, error, reload } = useAsync(() => api.events.list(), []);
  const [events, setEvents] = useState<CalEvent[]>([]);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selEvent, setSelEvent] = useState<CalEvent | null>(null);
  const [form, setForm] = useState<Form>(blankForm(new Date()));
  const [toast, setToast] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  useEffect(() => {
    if (data) setEvents(data);
  }, [data]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2200);
  };

  const closeModal = () => { setModal(null); setSelEvent(null); };
  const openCreate = () => { setForm(blankForm(selDate)); setSelEvent(null); setModal('create'); };
  const openDetail = (ev: CalEvent) => { setSelEvent(ev); setModal('detail'); };
  const startEdit = () => {
    if (!selEvent) return;
    setForm({ title: selEvent.title, type: selEvent.type, dateStr: selEvent.date, startTime: selEvent.startTime, endTime: selEvent.endTime, reminder: selEvent.reminder || 'ninguno' });
    setModal('edit');
  };

  const submitForm = async () => {
    if (!form.title.trim()) { showToast('Por favor ingresa un título'); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      if (modal === 'edit' && selEvent) {
        const updated = await api.events.update(selEvent.id, { title: form.title, type: form.type, date: form.dateStr, startTime: form.startTime, endTime: form.endTime, reminder: form.reminder });
        setEvents((es) => es.map((e) => (e.id === updated.id ? updated : e)));
        showToast('Evento actualizado correctamente');
      } else {
        const created = await api.events.create({ title: form.title, type: form.type, date: form.dateStr, startTime: form.startTime, endTime: form.endTime, reminder: form.reminder, completed: false });
        setEvents((es) => [...es, created]);
        showToast('Evento creado correctamente');
      }
      closeModal();
    } catch {
      showToast('No se pudo guardar el evento. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!selEvent) { closeModal(); return; }
    if (submitting) return;
    setSubmitting(true);
    try {
      await api.events.remove(selEvent.id);
      setEvents((es) => es.filter((e) => e.id !== selEvent.id));
      closeModal();
      showToast('Evento eliminado');
    } catch {
      showToast('No se pudo eliminar el evento. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleTask = async (id: string) => {
    const ev = events.find((e) => e.id === id);
    if (!ev || ev.type !== 'tarea') return;
    if (togglingId) return;
    setTogglingId(id);
    try {
      const updated = await api.events.update(id, { completed: !ev.completed });
      setEvents((es) => es.map((e) => (e.id === id ? updated : e)));
    } catch {
      showToast('No se pudo actualizar la tarea. Intenta de nuevo.');
    } finally {
      setTogglingId(null);
    }
  };

  const dayEvents = events.filter((e) => sameDay(fromISO(e.date), selDate));

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18, gap: 16 }}>
        <div className="page-head">
          <h1>Mi Calendario</h1>
          <p>Organiza tus sesiones y actividades</p>
        </div>
        <button onClick={openCreate} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12, background: 'var(--brand)', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0 }}>
          <Icon name="plus" size={18} color="#fff" strokeWidth={2.4} /> Nuevo evento
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, maxWidth: 360 }}>
        {(['día', 'semana', 'mes'] as ViewMode[]).map((v) => (
          <button key={v} onClick={() => setView(v)} style={{ flex: 1, padding: 9, borderRadius: 10, background: view === v ? 'var(--brand)' : '#fff', color: view === v ? '#fff' : 'var(--text-body)', fontSize: 13, fontWeight: 700, border: view === v ? 'none' : '1.5px solid var(--border)' }}>
            {v === 'día' ? 'Día' : v === 'semana' ? 'Semana' : 'Mes'}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 820 }}>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '48px 0', fontSize: 14, color: 'var(--text-muted)' }}>Cargando…</p>
        ) : error ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text-body)', textAlign: 'center' }}>No pudimos cargar tu calendario. Revisa tu conexión.</p>
            <button onClick={reload} style={{ padding: '9px 18px', borderRadius: 10, background: 'var(--brand)', color: '#fff', fontSize: 13, fontWeight: 700 }}>Reintentar</button>
          </div>
        ) : (
          <>
            {events.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Aún no tienes eventos. Crea uno con “Nuevo evento”.</p>
            ) : null}
            {view === 'día' ? <DayView selDate={selDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} /> : null}
            {view === 'semana' ? <WeekView selDate={selDate} setSelDate={setSelDate} dayEvents={dayEvents} onEvent={openDetail} onToggle={toggleTask} togglingId={togglingId} /> : null}
            {view === 'mes' ? <MonthView selDate={selDate} setSelDate={setSelDate} events={events} /> : null}
          </>
        )}
      </div>

      {toast ? (
        <div className="toast">
          <Icon name="check-circle" size={15} color="#4DD9A6" strokeWidth={2.4} /> {toast}
        </div>
      ) : null}

      {modal ? (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 20px 16px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-dark)' }}>
                {modal === 'create' ? 'Nuevo evento' : modal === 'edit' ? 'Editar evento' : modal === 'delete' ? 'Eliminar evento' : selEvent?.title}
              </h3>
              <button onClick={closeModal} style={{ padding: 4 }}><Icon name="x" size={20} color="var(--text-muted)" /></button>
            </div>
            <div style={{ padding: 20, overflowY: 'auto', flex: 1, minHeight: 0 }}>
              {modal === 'create' || modal === 'edit' ? (
                <EventForm form={form} setForm={setForm} submitLabel={modal === 'edit' ? 'Guardar cambios' : 'Guardar evento'} onCancel={() => setModal(selEvent ? 'detail' : null)} onSubmit={submitForm} submitting={submitting} />
              ) : null}
              {modal === 'detail' && selEvent ? (
                <EventDetail event={selEvent} onEdit={startEdit} onDelete={() => setModal('delete')} onClose={closeModal} />
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

function EventCard({ event, onEvent, onToggle, togglingId }: { event: CalEvent; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null }) {
  const color = EVENT_COLORS[event.type];
  const isTask = event.type === 'tarea';
  const toggling = togglingId === event.id;
  return (
    <div style={{ display: 'flex', gap: 12, borderRadius: 12, padding: 12, background: '#fff', border: `1.5px solid ${color}40`, opacity: event.completed ? 0.6 : 1 }}>
      <span style={{ width: 4, height: 44, borderRadius: 9, background: color, flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', gap: 8 }}>
        {isTask ? (
          <button onClick={() => onToggle(event.id)} disabled={toggling} style={{ width: 18, height: 18, marginTop: 1, borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center', background: event.completed ? 'var(--brand)' : '#fff', border: `2px solid ${event.completed ? 'var(--brand)' : '#C0DEDC'}`, flexShrink: 0, opacity: toggling ? 0.5 : 1 }}>
            {event.completed ? <Icon name="check" size={12} color="#fff" strokeWidth={3} /> : null}
          </button>
        ) : null}
        <button onClick={() => onEvent(event)} style={{ flex: 1, textAlign: 'left' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-dark)', textDecoration: event.completed ? 'line-through' : 'none' }}>{event.title}</div>
          <div style={{ marginTop: 2, fontSize: 11.5, color: 'var(--text-muted)' }}>{event.startTime} - {event.endTime}</div>
        </button>
      </div>
    </div>
  );
}

function DayView({ selDate, dayEvents, onEvent, onToggle, togglingId }: { selDate: Date; dayEvents: CalEvent[]; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null }) {
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
              {slot.evs.length === 0 ? <div style={{ height: 32, borderBottom: '1px solid var(--border)' }} /> : slot.evs.map((ev) => <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} togglingId={togglingId} />)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function WeekView({ selDate, setSelDate, dayEvents, onEvent, onToggle, togglingId }: { selDate: Date; setSelDate: (d: Date) => void; dayEvents: CalEvent[]; onEvent: (e: CalEvent) => void; onToggle: (id: string) => void; togglingId: string | null }) {
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
        {sorted.length === 0 ? <p style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No hay eventos para este día</p> : sorted.map((ev) => <EventCard key={ev.id} event={ev} onEvent={onEvent} onToggle={onToggle} togglingId={togglingId} />)}
      </div>
    </div>
  );
}

function MonthView({ selDate, setSelDate, events }: { selDate: Date; setSelDate: (d: Date) => void; events: CalEvent[] }) {
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
          return (
            <button key={day.toISOString()} onClick={() => setSelDate(day)} style={{ aspectRatio: '1', padding: 2 }}>
              <div style={{ height: '100%', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: isToday || isSel ? 'var(--nav-bg)' : '#fff', border: `${isSel ? 2 : 1.5}px solid ${isSel || isToday ? 'var(--brand)' : 'var(--border)'}`, opacity: isCur ? 1 : 0.4 }}>
                <span style={{ fontSize: 12, fontWeight: isToday || isSel ? 700 : 400, color: isToday || isSel ? 'var(--brand)' : 'var(--text-dark)' }}>{day.getDate()}</span>
                {evs.length > 0 ? (
                  <div style={{ display: 'flex', gap: 2, marginTop: 3 }}>
                    {evs.slice(0, 3).map((e, i) => (<span key={i} style={{ width: 4, height: 4, borderRadius: 2, background: EVENT_COLORS[e.type] }} />))}
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

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--text-dark)', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function EventForm({ form, setForm, submitLabel, onCancel, onSubmit, submitting }: { form: Form; setForm: (f: Form) => void; submitLabel: string; onCancel: () => void; onSubmit: () => void; submitting: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <FormField label="Título">
        <input className="input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Nombre del evento" />
      </FormField>
      <FormField label="Tipo">
        <Select value={form.type} options={TYPES} onChange={(v) => setForm({ ...form, type: v as EventType })} />
      </FormField>
      <FormField label="Fecha">
        <input className="input" type="date" value={form.dateStr} onChange={(e) => setForm({ ...form, dateStr: e.target.value })} />
      </FormField>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <FormField label="Inicio"><input className="input" type="time" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })} /></FormField>
        </div>
        <div style={{ flex: 1 }}>
          <FormField label="Fin"><input className="input" type="time" value={form.endTime} onChange={(e) => setForm({ ...form, endTime: e.target.value })} /></FormField>
        </div>
      </div>
      <FormField label="Recordatorio">
        <Select value={form.reminder} options={REMINDERS} onChange={(v) => setForm({ ...form, reminder: v })} />
      </FormField>
      <div style={{ display: 'flex', gap: 8 }}>
        <ModalBtn label="Cancelar" outline onClick={onCancel} disabled={submitting} />
        <ModalBtn label={submitting ? 'Guardando…' : submitLabel} primary onClick={onSubmit} disabled={submitting} />
      </div>
    </div>
  );
}

function EventDetail({ event, onEdit, onDelete, onClose }: { event: CalEvent; onEdit: () => void; onDelete: () => void; onClose: () => void }) {
  const dt = fromISO(event.date);
  const hasReminder = !!(event.reminder && event.reminder !== 'ninguno');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <DetailRow icon="calendar" label="Fecha" value={`${dt.getDate()} de ${MONTHS[dt.getMonth()]}, ${dt.getFullYear()}`} />
      <DetailRow icon="clock" label="Hora" value={`${fmtTime12(event.startTime)} - ${fmtTime12(event.endTime)}`} />
      {hasReminder ? <DetailRow icon="bell" label="Recordatorio" value={event.reminder} /> : null}
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onEdit} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 10, border: '1.5px solid var(--brand)', background: '#fff', color: 'var(--brand)', fontSize: 13, fontWeight: 700 }}>
          <Icon name="edit" size={14} color="var(--brand)" /> Editar
        </button>
        <button onClick={onDelete} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: 11, borderRadius: 10, background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700 }}>
          <Icon name="trash" size={14} color="#fff" /> Eliminar
        </button>
      </div>
      <button onClick={onClose} style={{ padding: 11, borderRadius: 10, border: '1.5px solid var(--border)', background: '#fff', color: 'var(--text-body)', fontSize: 13, fontWeight: 700 }}>Cerrar</button>
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
    <button onClick={onClick} disabled={disabled} style={{ flex: 1, padding: 11, borderRadius: 10, background: bg, color: fg, border: outline ? '1.5px solid var(--brand)' : 'none', fontSize: 13, fontWeight: 700, opacity: disabled ? 0.6 : 1 }}>{label}</button>
  );
}
