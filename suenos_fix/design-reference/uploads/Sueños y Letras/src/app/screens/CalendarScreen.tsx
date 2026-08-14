import { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Plus,
  Clock,
  Users,
  Edit,
  Trash2,
  Home,
  HelpCircle,
  X,
  Bell,
  CheckCircle2,
  Calendar as CalendarIcon,
} from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, startOfMonth, endOfMonth, getDay } from "date-fns";
import { es } from "date-fns/locale/es";
import { toast } from "sonner";
import { BottomNav } from "../components/BottomNav";

const BRAND = "#3DBFB8";
const BRAND_DARK = "#2A9A95";
const BRAND_LIGHT = "#E6F8F7";
const TEXT_DARK = "#1A3A38";
const TEXT_MED = "#4A6E6B";
const TEXT_MUTED = "#717182";

type EventType = "sesión" | "tarea" | "recordatorio" | "evento";

interface CalendarEvent {
  id: string;
  title: string;
  type: EventType;
  date: Date;
  startTime: string;
  endTime: string;
  reminder?: string;
  completed?: boolean;
}

const EVENT_COLORS: Record<EventType, string> = {
  sesión: BRAND,
  tarea: "#F59E0B",
  recordatorio: "#7C3AED",
  evento: "#3B82F6",
};

const initialEvents: CalendarEvent[] = [
  {
    id: "1",
    title: "Sesión de lectura Grupo 1",
    type: "sesión",
    date: new Date(2026, 5, 4),
    startTime: "10:00",
    endTime: "11:00",
    reminder: "30 minutos antes",
  },
  {
    id: "2",
    title: "Preparar material del módulo",
    type: "tarea",
    date: new Date(2026, 5, 4),
    startTime: "13:00",
    endTime: "13:30",
    reminder: "ninguno",
    completed: false,
  },
  {
    id: "3",
    title: "Actividad Grupo 2",
    type: "sesión",
    date: new Date(2026, 5, 4),
    startTime: "14:00",
    endTime: "15:00",
    reminder: "10 minutos antes",
  },
  {
    id: "4",
    title: "Audiocuento con Grupo 3",
    type: "sesión",
    date: new Date(2026, 5, 4),
    startTime: "16:30",
    endTime: "17:30",
    reminder: "1 hora antes",
  },
];

export function CalendarScreen() {
  const navigate = useNavigate();
  const [view, setView] = useState<"día" | "semana" | "mes">("día");
  const [selectedDate, setSelectedDate] = useState(new Date(2026, 5, 4)); // jun 4, 2026
  const [events, setEvents] = useState<CalendarEvent[]>(initialEvents);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [formData, setFormData] = useState<Partial<CalendarEvent>>({
    title: "",
    type: "sesión",
    date: selectedDate,
    startTime: "10:00",
    endTime: "11:00",
    reminder: "ninguno",
  });

  const eventsForSelectedDate = events.filter((e) => isSameDay(e.date, selectedDate));

  const handleCreateEvent = () => {
    if (!formData.title) {
      toast.error("Por favor ingresa un título");
      return;
    }
    const newEvent: CalendarEvent = {
      id: Date.now().toString(),
      title: formData.title || "",
      type: formData.type || "sesión",
      date: formData.date || selectedDate,
      startTime: formData.startTime || "10:00",
      endTime: formData.endTime || "11:00",
      reminder: formData.reminder,
      completed: false,
    };
    setEvents([...events, newEvent]);
    setShowCreateModal(false);
    resetForm();
    toast.success("Evento creado correctamente");
  };

  const handleUpdateEvent = () => {
    if (!selectedEvent || !formData.title) return;
    const updated = events.map((e) =>
      e.id === selectedEvent.id
        ? {
            ...e,
            title: formData.title || e.title,
            type: formData.type || e.type,
            date: formData.date || e.date,
            startTime: formData.startTime || e.startTime,
            endTime: formData.endTime || e.endTime,
            reminder: formData.reminder,
          }
        : e
    );
    setEvents(updated);
    setIsEditing(false);
    setShowDetailModal(false);
    setSelectedEvent(null);
    resetForm();
    toast.success("Evento actualizado correctamente");
  };

  const handleDeleteEvent = () => {
    if (!selectedEvent) return;
    setEvents(events.filter((e) => e.id !== selectedEvent.id));
    setShowDeleteConfirm(false);
    setShowDetailModal(false);
    setSelectedEvent(null);
    toast.success("Evento eliminado");
  };

  const toggleTaskComplete = (id: string) => {
    setEvents(
      events.map((e) => (e.id === id && e.type === "tarea" ? { ...e, completed: !e.completed } : e))
    );
  };

  const openEventDetail = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setShowDetailModal(true);
    setIsEditing(false);
  };

  const openEditMode = () => {
    if (!selectedEvent) return;
    setFormData({
      title: selectedEvent.title,
      type: selectedEvent.type,
      date: selectedEvent.date,
      startTime: selectedEvent.startTime,
      endTime: selectedEvent.endTime,
      reminder: selectedEvent.reminder,
    });
    setIsEditing(true);
  };

  const resetForm = () => {
    setFormData({
      title: "",
      type: "sesión",
      date: selectedDate,
      startTime: "10:00",
      endTime: "11:00",
      reminder: "ninguno",
    });
  };

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="px-5 pt-10 pb-5 bg-white shrink-0" style={{ borderBottom: "1px solid #E4F4F3" }}>
        <div className="flex items-center justify-between mb-2">
          <button onClick={() => navigate("/")} className="p-1 -ml-1">
            <ArrowLeft size={24} color={TEXT_DARK} />
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowCreateModal(true);
            }}
            className="w-9 h-9 rounded-full flex items-center justify-center"
            style={{ background: BRAND }}
          >
            <Plus size={20} color="white" />
          </button>
        </div>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 800, color: TEXT_DARK }}>Mi Calendario</h1>
        <p style={{ fontSize: "0.75rem", color: TEXT_MUTED, marginTop: "2px" }}>
          Organiza tus sesiones y actividades
        </p>
      </header>

      {/* View Tabs */}
      <div className="px-5 py-4 bg-white shrink-0 flex gap-2" style={{ borderBottom: "1px solid #E4F4F3" }}>
        {(["día", "semana", "mes"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className="flex-1 py-2 rounded-lg transition-all"
            style={{
              background: view === v ? BRAND : "transparent",
              color: view === v ? "white" : TEXT_MED,
              fontSize: "0.8rem",
              fontWeight: 700,
              textTransform: "capitalize",
            }}
          >
            {v}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {view === "día" && <DayView date={selectedDate} events={eventsForSelectedDate} onEventClick={openEventDetail} onToggleTask={toggleTaskComplete} />}
        {view === "semana" && <WeekView selectedDate={selectedDate} onSelectDate={setSelectedDate} events={events} onEventClick={openEventDetail} onToggleTask={toggleTaskComplete} />}
        {view === "mes" && <MonthView selectedDate={selectedDate} onSelectDate={setSelectedDate} events={events} />}
        <div className="h-4" />
      </div>

      {/* Bottom Nav */}
      <BottomNav
        left={{
          icon: <Home size={22} color={BRAND} />,
          label: "Home",
          onClick: () => navigate("/"),
        }}
        right={{
          icon: <HelpCircle size={22} color={BRAND} />,
          label: "Preguntas Frecuentes",
          onClick: () => navigate("/faq"),
        }}
      />

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <Modal title="Nuevo evento" onClose={() => setShowCreateModal(false)}>
          <EventForm
            data={formData}
            onChange={setFormData}
            onSubmit={handleCreateEvent}
            onCancel={() => setShowCreateModal(false)}
          />
        </Modal>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedEvent && (
        <Modal
          title={isEditing ? "Editar evento" : selectedEvent.title}
          onClose={() => {
            setShowDetailModal(false);
            setIsEditing(false);
            setSelectedEvent(null);
          }}
        >
          {isEditing ? (
            <EventForm
              data={formData}
              onChange={setFormData}
              onSubmit={handleUpdateEvent}
              onCancel={() => setIsEditing(false)}
              isEdit
            />
          ) : (
            <EventDetail
              event={selectedEvent}
              onEdit={openEditMode}
              onDelete={() => setShowDeleteConfirm(true)}
              onClose={() => {
                setShowDetailModal(false);
                setSelectedEvent(null);
              }}
            />
          )}
        </Modal>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <Modal title="Eliminar evento" onClose={() => setShowDeleteConfirm(false)}>
          <div className="p-5">
            <p style={{ fontSize: "0.85rem", color: TEXT_MED, marginBottom: "20px" }}>
              ¿Seguro que deseas eliminar este evento?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-2.5 rounded-lg"
                style={{ border: `1.5px solid ${BRAND}`, color: BRAND, fontSize: "0.8rem", fontWeight: 700 }}
              >
                Cancelar
              </button>
              <button
                onClick={handleDeleteEvent}
                className="flex-1 py-2.5 rounded-lg text-white"
                style={{ background: "#E53E3E", fontSize: "0.8rem", fontWeight: 700 }}
              >
                Eliminar
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* Day View */
function DayView({
  date,
  events,
  onEventClick,
  onToggleTask,
}: {
  date: Date;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onToggleTask: (id: string) => void;
}) {
  const hours = Array.from({ length: 13 }, (_, i) => i + 7); // 7 AM - 7 PM

  return (
    <div>
      <p style={{ fontSize: "0.85rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "16px" }}>
        Hoy · {format(date, "EEE d MMM", { locale: es })}
      </p>
      <div className="space-y-3">
        {hours.map((hour) => {
          const hourEvents = events.filter((e) => {
            const [h] = e.startTime.split(":").map(Number);
            return h === hour;
          });
          return (
            <div key={hour} className="flex gap-3">
              <div className="w-16 shrink-0" style={{ fontSize: "0.7rem", color: TEXT_MUTED, paddingTop: "2px" }}>
                {hour === 12 ? "12:00 PM" : hour > 12 ? `${hour - 12}:00 PM` : `${hour}:00 AM`}
              </div>
              <div className="flex-1 space-y-2">
                {hourEvents.length === 0 ? (
                  <div className="h-8 border-b" style={{ borderColor: "#E4F4F3" }} />
                ) : (
                  hourEvents.map((ev) => (
                    <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} onToggleTask={onToggleTask} />
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* Week View */
function WeekView({
  selectedDate,
  onSelectDate,
  events,
  onEventClick,
  onToggleTask,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  events: CalendarEvent[];
  onEventClick: (e: CalendarEvent) => void;
  onToggleTask: (id: string) => void;
}) {
  const weekStart = startOfWeek(selectedDate, { locale: es });
  const weekEnd = endOfWeek(selectedDate, { locale: es });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const eventsForDay = events.filter((e) => isSameDay(e.date, selectedDate)).sort((a, b) => a.startTime.localeCompare(b.startTime));

  return (
    <div>
      <div className="flex gap-2 mb-5">
        {days.map((day) => {
          const isSelected = isSameDay(day, selectedDate);
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className="flex-1 py-2 rounded-lg flex flex-col items-center gap-1 transition-all"
              style={{
                background: isSelected ? BRAND : "white",
                color: isSelected ? "white" : TEXT_MED,
                border: isSelected ? "none" : "1.5px solid #E4F4F3",
              }}
            >
              <span style={{ fontSize: "0.65rem", fontWeight: 600 }}>{format(day, "EEE", { locale: es })}</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700 }}>{format(day, "d")}</span>
            </button>
          );
        })}
      </div>
      <p style={{ fontSize: "0.8rem", fontWeight: 700, color: TEXT_DARK, marginBottom: "12px" }}>
        {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
      </p>
      <div className="space-y-2">
        {eventsForDay.length === 0 ? (
          <p style={{ fontSize: "0.75rem", color: TEXT_MUTED, textAlign: "center", padding: "20px 0" }}>
            No hay eventos para este día
          </p>
        ) : (
          eventsForDay.map((ev) => (
            <EventCard key={ev.id} event={ev} onClick={() => onEventClick(ev)} onToggleTask={onToggleTask} />
          ))
        )}
      </div>
    </div>
  );
}

/* Month View */
function MonthView({
  selectedDate,
  onSelectDate,
  events,
}: {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  events: CalendarEvent[];
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const startDate = startOfWeek(monthStart, { locale: es });
  const endDate = endOfWeek(monthEnd, { locale: es });
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const dayHeaders = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div>
      <p style={{ fontSize: "0.95rem", fontWeight: 800, color: TEXT_DARK, marginBottom: "16px" }}>
        {format(selectedDate, "MMMM yyyy", { locale: es })}
      </p>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayHeaders.map((h) => (
          <div
            key={h}
            className="text-center py-2"
            style={{ fontSize: "0.65rem", fontWeight: 700, color: TEXT_MUTED }}
          >
            {h}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isToday = isSameDay(day, new Date(2026, 5, 4));
          const isCurrentMonth = day.getMonth() === selectedDate.getMonth();
          const dayEvents = events.filter((e) => isSameDay(e.date, day));
          return (
            <button
              key={day.toISOString()}
              onClick={() => onSelectDate(day)}
              className="aspect-square rounded-lg flex flex-col items-center justify-center p-1 relative"
              style={{
                background: isToday ? BRAND_LIGHT : "white",
                border: isToday ? `1.5px solid ${BRAND}` : "1.5px solid #E4F4F3",
                opacity: isCurrentMonth ? 1 : 0.4,
              }}
            >
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: isToday ? 700 : 400,
                  color: isToday ? BRAND : TEXT_DARK,
                }}
              >
                {format(day, "d")}
              </span>
              {dayEvents.length > 0 && (
                <div className="flex gap-0.5 mt-1">
                  {dayEvents.slice(0, 3).map((e, i) => (
                    <div
                      key={i}
                      className="w-1 h-1 rounded-full"
                      style={{ background: EVENT_COLORS[e.type] }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* Event Card */
function EventCard({
  event,
  onClick,
  onToggleTask,
}: {
  event: CalendarEvent;
  onClick: () => void;
  onToggleTask: (id: string) => void;
}) {
  const isTask = event.type === "tarea";

  return (
    <button
      onClick={(e) => {
        if (isTask && (e.target as HTMLElement).tagName === "INPUT") return;
        onClick();
      }}
      className="w-full rounded-xl p-3 flex gap-3 items-start transition-all active:scale-98 text-left"
      style={{
        background: "white",
        border: `1.5px solid ${EVENT_COLORS[event.type]}40`,
        opacity: event.completed ? 0.6 : 1,
      }}
    >
      <div className="w-1 h-12 rounded-full shrink-0" style={{ background: EVENT_COLORS[event.type] }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          {isTask && (
            <input
              type="checkbox"
              checked={event.completed}
              onChange={() => onToggleTask(event.id)}
              onClick={(e) => e.stopPropagation()}
              className="mt-0.5 shrink-0"
              style={{ accentColor: BRAND }}
            />
          )}
          <div className="flex-1">
            <p
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: TEXT_DARK,
                textDecoration: event.completed ? "line-through" : "none",
              }}
            >
              {event.title}
            </p>
            <p style={{ fontSize: "0.7rem", color: TEXT_MUTED, marginTop: "2px" }}>
              {event.startTime} - {event.endTime}
            </p>
          </div>
        </div>
      </div>
    </button>
  );
}

/* Event Detail */
function EventDetail({
  event,
  onEdit,
  onDelete,
  onClose,
}: {
  event: CalendarEvent;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div className="p-5">
      <div className="space-y-4 mb-5">
        <DetailRow icon={<CalendarIcon size={16} />} label="Fecha" value={format(event.date, "d 'de' MMMM, yyyy", { locale: es })} />
        <DetailRow icon={<Clock size={16} />} label="Hora" value={`${event.startTime} - ${event.endTime}`} />
        {event.reminder && event.reminder !== "ninguno" && <DetailRow icon={<Bell size={16} />} label="Recordatorio" value={event.reminder} />}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2"
          style={{ border: `1.5px solid ${BRAND}`, color: BRAND, fontSize: "0.8rem", fontWeight: 700 }}
        >
          <Edit size={14} /> Editar
        </button>
        <button
          onClick={onDelete}
          className="flex-1 py-2.5 rounded-lg flex items-center justify-center gap-2 text-white"
          style={{ background: "#E53E3E", fontSize: "0.8rem", fontWeight: 700 }}
        >
          <Trash2 size={14} /> Eliminar
        </button>
      </div>
      <button
        onClick={onClose}
        className="w-full py-2.5 rounded-lg mt-2"
        style={{ border: "1.5px solid #E4F4F3", color: TEXT_MED, fontSize: "0.8rem", fontWeight: 700 }}
      >
        Cerrar
      </button>
    </div>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <div style={{ color: TEXT_MUTED }}>{icon}</div>
      <div className="flex-1">
        <p style={{ fontSize: "0.7rem", color: TEXT_MUTED, marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "0.8rem", color: TEXT_DARK, fontWeight: 600, textTransform: "capitalize" }}>{value}</p>
      </div>
    </div>
  );
}

/* Event Form */
function EventForm({
  data,
  onChange,
  onSubmit,
  onCancel,
  isEdit = false,
}: {
  data: Partial<CalendarEvent>;
  onChange: (data: Partial<CalendarEvent>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  isEdit?: boolean;
}) {
  return (
    <div className="p-5">
      <div className="space-y-4 mb-5">
        <FormField label="Título">
          <input
            type="text"
            value={data.title || ""}
            onChange={(e) => onChange({ ...data, title: e.target.value })}
            className="w-full px-3 py-2 rounded-lg"
            style={{ border: "1.5px solid #E4F4F3", fontSize: "0.8rem" }}
            placeholder="Nombre del evento"
          />
        </FormField>

        <FormField label="Fecha">
          <input
            type="date"
            value={data.date ? format(data.date, "yyyy-MM-dd") : ""}
            onChange={(e) => onChange({ ...data, date: new Date(e.target.value) })}
            className="w-full px-3 py-2 rounded-lg"
            style={{ border: "1.5px solid #E4F4F3", fontSize: "0.8rem" }}
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Hora de inicio">
            <input
              type="time"
              value={data.startTime || "10:00"}
              onChange={(e) => onChange({ ...data, startTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg"
              style={{ border: "1.5px solid #E4F4F3", fontSize: "0.8rem" }}
            />
          </FormField>

          <FormField label="Hora de fin">
            <input
              type="time"
              value={data.endTime || "11:00"}
              onChange={(e) => onChange({ ...data, endTime: e.target.value })}
              className="w-full px-3 py-2 rounded-lg"
              style={{ border: "1.5px solid #E4F4F3", fontSize: "0.8rem" }}
            />
          </FormField>
        </div>

        <FormField label="Recordatorio">
          <select
            value={data.reminder || "ninguno"}
            onChange={(e) => onChange({ ...data, reminder: e.target.value })}
            className="w-full px-3 py-2 rounded-lg"
            style={{ border: "1.5px solid #E4F4F3", fontSize: "0.8rem" }}
          >
            <option value="ninguno">Ninguno</option>
            <option value="10 minutos antes">10 minutos antes</option>
            <option value="30 minutos antes">30 minutos antes</option>
            <option value="1 hora antes">1 hora antes</option>
            <option value="1 día antes">1 día antes</option>
          </select>
        </FormField>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-lg"
          style={{ border: "1.5px solid #E4F4F3", color: TEXT_MED, fontSize: "0.8rem", fontWeight: 700 }}
        >
          Cancelar
        </button>
        <button
          onClick={onSubmit}
          className="flex-1 py-2.5 rounded-lg text-white"
          style={{ background: BRAND, fontSize: "0.8rem", fontWeight: 700 }}
        >
          {isEdit ? "Guardar cambios" : "Guardar evento"}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: "0.75rem", fontWeight: 700, color: TEXT_DARK, display: "block", marginBottom: "6px" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

/* Modal */
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 flex items-end justify-center z-50"
      style={{ background: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-sm overflow-hidden animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: "90vh" }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: "1px solid #E4F4F3" }}
        >
          <h2 style={{ fontSize: "1.1rem", fontWeight: 800, color: TEXT_DARK }}>{title}</h2>
          <button onClick={onClose} className="p-1">
            <X size={20} color={TEXT_MUTED} />
          </button>
        </div>
        <div className="overflow-y-auto" style={{ maxHeight: "calc(90vh - 60px)" }}>
          {children}
        </div>
      </div>
    </div>
  );
}
