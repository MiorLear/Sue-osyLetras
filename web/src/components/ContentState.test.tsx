import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CacheAgeNote, ContentState } from './ContentState';

afterEach(cleanup);

describe('<ContentState />', () => {
  it('no dibuja nada cuando hay contenido que mostrar', () => {
    const { container } = render(<ContentState status="fresh" />);
    expect(container.innerHTML).toBe('');
  });

  // La distinción que motiva el componente: quedarse sin conexión con la
  // pantalla nunca visitada no es un fallo, y decir "algo salió mal" manda a la
  // usuaria a reintentar algo que no se arregla reintentando.
  it('sin conexión y sin caché explica qué hacer, y no ofrece reintentar', () => {
    const onRetry = vi.fn();
    render(<ContentState status="offline-empty" what="las emociones" onRetry={onRetry} />);

    expect(screen.getByText(/todavía no está guardada en este dispositivo/i)).toBeTruthy();
    expect(screen.getByText(/una vez con internet/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
  });

  it('un fallo real sí ofrece reintentar', () => {
    const onRetry = vi.fn();
    render(<ContentState status="error" what="el calendario" onRetry={onRetry} />);

    const retry = screen.getByRole('button', { name: 'Reintentar' });
    retry.click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByText(/no pudimos cargar el calendario/i)).toBeTruthy();
  });

  it('sin onRetry no aparece el botón, para no ofrecer algo que no hace nada', () => {
    render(<ContentState status="error" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Una lista vacía es un dato válido: el hook la reporta como 'fresh', así que
  // el vacío lo declara la pantalla.
  it('una respuesta correcta pero vacía muestra el texto de vacío', () => {
    render(<ContentState status="fresh" isEmpty emptyLabel="Aún no hay publicaciones." />);
    expect(screen.getByText('Aún no hay publicaciones.')).toBeTruthy();
  });

  it('la sesión caída no deja la pantalla en blanco', () => {
    render(<ContentState status="session-expired" />);
    expect(screen.getByText(/tu sesión terminó/i)).toBeTruthy();
  });
});

describe('<CacheAgeNote />', () => {
  it('calla mientras el dato está fresco', () => {
    const { container } = render(<CacheAgeNote status="fresh" ageMs={30 * 60_000} />);
    expect(container.innerHTML).toBe('');
  });

  it('dice la antigüedad cuando el dato ya es viejo (BUG-09)', () => {
    render(<CacheAgeNote status="stale" ageMs={3 * 86_400_000} />);
    expect(screen.getByText(/hace 3 días/i)).toBeTruthy();
  });

  it('sin antigüedad conocida no inventa una', () => {
    const { container } = render(<CacheAgeNote status="stale" />);
    expect(container.innerHTML).toBe('');
  });
});
