import { Icon } from '@/components/Icon';

/**
 * Marca "esto todavía no está en el servidor".
 *
 * Lleva texto y no solo color por dos razones: el color por sí solo no lo ve
 * quien no distingue tonos, y en una tablet de aula compartida la pregunta que
 * hay que despejar es literalmente "¿se guardó o no?". Un matiz en el borde no
 * la responde.
 */
export function PendingBadge({ label = 'Pendiente de enviar' }: { label?: string }) {
  return (
    <span className="pending-badge">
      <Icon name="clock" size={12} color="currentColor" />
      {label}
    </span>
  );
}
