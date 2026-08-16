import type { CalEvent, Post } from '@explorarte/shared';

import type { DeadLetterRecord } from '@/lib/idb';
import { toMutation, type Mutation } from '@/lib/outbox';

// Cómo se le cuenta a una docente que un cambio suyo no llegó.
//
// Módulo puro: recibe la fila y, para los cambios que solo guardan un id, lo
// que hubiera en la caché para poder decir de QUÉ evento o publicación habla.
// Sin eso, "Eliminar el evento e-4f2a" no le dice nada a nadie.

/** Lo que la pantalla trae de la caché para poner nombres a los ids. */
export interface Lookup {
  events?: Pick<CalEvent, 'id' | 'title'>[];
  posts?: Pick<Post, 'id' | 'text'>[];
}

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function shorten(text: string, max = 90): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

function eventTitle(lookup: Lookup, id: string): string | null {
  return lookup.events?.find((e) => e.id === id)?.title ?? null;
}

function postText(lookup: Lookup, id: number): string | null {
  return lookup.posts?.find((p) => p.id === id)?.text ?? null;
}

/** "12 de marzo, 10:00", a partir de la fecha ISO del formulario. */
function whenOf(date?: string, startTime?: string): string | undefined {
  if (!date) return undefined;
  const [y, m, d] = date.split('-').map(Number);
  if (!y || !m || !d) return undefined;
  const día = `${d} de ${MONTHS[m - 1]}`;
  return startTime ? `${día}, ${startTime}` : día;
}

export interface ProblemText {
  /** Qué era, en una línea. */
  title: string;
  /** Detalle opcional: la fecha del evento, el texto de la publicación… */
  detail?: string;
}

/** Qué era el cambio, en español llano. */
export function describeMutation(mutation: Mutation, lookup: Lookup = {}): ProblemText {
  switch (mutation.kind) {
    case 'profile.update': {
      const LABELS: Record<string, string> = {
        name: 'Nombre',
        lastname: 'Apellido',
        email: 'Correo',
        phone: 'Teléfono',
        institucion: 'Institución',
        ubicacion: 'Ubicación',
        photo: 'Foto',
      };
      const campos = Object.keys(mutation.input)
        .map((k) => LABELS[k])
        .filter(Boolean);
      return {
        title: 'Cambios en tu perfil',
        detail: campos.length > 0 ? campos.join(', ') : undefined,
      };
    }
    case 'event.create':
      return {
        title: `Evento nuevo: «${mutation.input.title}»`,
        detail: whenOf(mutation.input.date, mutation.input.startTime),
      };
    case 'event.update': {
      const nombre = eventTitle(lookup, mutation.targetId);
      const soloCompletada =
        Object.keys(mutation.input).length === 1 && 'completed' in mutation.input;
      if (soloCompletada) {
        const acción = mutation.input.completed ? 'completada' : 'pendiente';
        return { title: nombre ? `Marcar «${nombre}» como ${acción}` : `Marcar una tarea como ${acción}` };
      }
      return {
        title: nombre ? `Cambio en el evento «${nombre}»` : 'Cambio en un evento de tu calendario',
        detail: whenOf(mutation.input.date, mutation.input.startTime),
      };
    }
    case 'event.remove': {
      const nombre = eventTitle(lookup, mutation.targetId);
      return {
        title: nombre ? `Eliminar el evento «${nombre}»` : 'Eliminar un evento de tu calendario',
      };
    }
    case 'post.create':
      return { title: 'Publicación en Comunidad', detail: shorten(mutation.input.text) };
    case 'post.like': {
      const texto = postText(lookup, mutation.postId);
      return {
        title: 'Me gusta en una publicación',
        detail: texto ? shorten(texto, 60) : undefined,
      };
    }
    case 'post.comment':
      return { title: `Comentario: «${shorten(mutation.input.text)}»` };
  }
}

/** La misma fila, ya lista para pintar. `null` si no se puede ni leer. */
export function describeRecord(record: DeadLetterRecord, lookup: Lookup = {}): ProblemText {
  const mutation = toMutation(record as never);
  if (!mutation) {
    return { title: 'Un cambio que esta versión de la app ya no reconoce' };
  }
  return describeMutation(mutation, lookup);
}

/**
 * Cuánto hace y cuántas veces se intentó.
 *
 * Los intentos se enseñan a propósito: sin ese número, nadie sabe si tiene
 * sentido volver a pulsar "Reintentar" o si lleva ocho veces sin funcionar.
 */
export function describeAttempts(record: DeadLetterRecord, ageLabel: string | null): string {
  const cuando = ageLabel ? `Falló ${ageLabel}` : 'Falló hace un momento';
  if (record.attempts <= 0) return cuando;
  return `${cuando} · ${record.attempts === 1 ? '1 intento' : `${record.attempts} intentos`}`;
}
