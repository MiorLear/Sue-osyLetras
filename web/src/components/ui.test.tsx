import { StrictMode, useState } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const places = vi.hoisted(() => ({ searchPlaces: vi.fn<(q: string) => Promise<string[]>>() }));
vi.mock('@explorarte/shared', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@explorarte/shared')>()),
  searchPlaces: places.searchPlaces,
}));

import { LocationAutocomplete } from '@/components/ui';

// El desplegable de ubicación se quedaba abierto encima del botón "Guardar
// cambios" del perfil, sin forma de cerrarlo: se abría solo, sin que el campo
// hubiera tenido el foco, así que su único cierre —el `blur` del input— no
// llegaba nunca. Resultado: el perfil no se podía guardar.

function Host({ initial = 'San Salvador' }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <div>
      <LocationAutocomplete label="Ubicación" value={value} onChange={setValue} />
      <button>Guardar cambios</button>
    </div>
  );
}

// Sin relojes falsos a propósito: el rebote son 300 ms reales y `waitFor` los
// espera de sobra. Falsearlos aquí desestabilizaba OTROS archivos de la suite.
const DEBOUNCE_MS = 300;
const settle = () => new Promise((r) => setTimeout(r, DEBOUNCE_MS + 150));

beforeEach(() => {
  vi.clearAllMocks();
  places.searchPlaces.mockResolvedValue(['San Salvador', 'San Salvador Volcano']);
});

afterEach(cleanup);

describe('<LocationAutocomplete />', () => {
  it('no se abre solo al montar, ni con StrictMode montando los efectos dos veces', async () => {
    // Este es el caso que rompía el perfil: en desarrollo el efecto corre dos
    // veces, y la segunda ya no encontraba el guard puesto.
    render(
      <StrictMode>
        <Host />
      </StrictMode>,
    );

    await settle();

    expect(places.searchPlaces).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'San Salvador Volcano' })).toBeNull();
  });

  it('cargar un valor desde fuera tampoco dispara una búsqueda', async () => {
    const { rerender } = render(<Host initial="" />);
    rerender(<Host initial="Santa Ana" />);

    await settle();

    expect(places.searchPlaces).not.toHaveBeenCalled();
  });

  it('busca y abre cuando la usuaria escribe', async () => {
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });

    expect(await screen.findByRole('button', { name: 'San Salvador Volcano' })).toBeTruthy();
  });

  it('no abre nada si el foco se fue mientras se buscaba', async () => {
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });
    fireEvent.blur(input);

    await settle();

    expect(screen.queryByRole('button', { name: 'San Salvador Volcano' })).toBeNull();
  });

  it('se cierra con Escape', async () => {
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });
    await screen.findByRole('button', { name: 'San Salvador Volcano' });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByRole('button', { name: 'San Salvador Volcano' })).toBeNull();
  });

  it('se cierra al tocar fuera, y el botón de debajo vuelve a ser alcanzable', async () => {
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });
    await screen.findByRole('button', { name: 'San Salvador Volcano' });

    fireEvent.pointerDown(screen.getByRole('button', { name: 'Guardar cambios' }));

    // Con waitFor: el cierre ocurre en un listener nativo de document, fuera
    // del sistema de eventos de React, así que el re-render no es síncrono.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'San Salvador Volcano' })).toBeNull(),
    );
  });

  it('elegir una sugerencia la fija y no vuelve a buscar', async () => {
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });

    fireEvent.click(await screen.findByRole('button', { name: 'San Salvador Volcano' }));
    places.searchPlaces.mockClear();
    await settle();

    expect((input as HTMLInputElement).value).toBe('San Salvador Volcano');
    expect(places.searchPlaces).not.toHaveBeenCalled();
  });
});

describe('<LocationAutocomplete /> · el panel no se dibuja sobre lo de abajo', () => {
  it('ocupa espacio en el flujo en vez de flotar', async () => {
    // Flotando tapaba el botón "Guardar cambios" del perfil al 100%: quien
    // escribía su ciudad e iba directa a guardar pulsaba la primera sugerencia
    // sin querer. jsdom no calcula layout, así que se comprueba la causa —el
    // posicionamiento— y no el solape, que es su consecuencia.
    render(<Host initial="" />);
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'San Sal' } });

    const opcion = await screen.findByRole('button', { name: 'San Salvador Volcano' });
    const panel = opcion.parentElement as HTMLElement;

    expect(panel.style.position).not.toBe('absolute');
    expect(panel.style.position).not.toBe('fixed');
    // Y con muchas coincidencias no puede empujar el botón fuera de la pantalla.
    expect(panel.style.maxHeight).toBe('200px');
    expect(panel.style.overflowY).toBe('auto');
  });
});
