import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LearningBlock } from '@explorarte/shared';

import { BlockListEditor } from '@/components/admin/BlockListEditor';

afterEach(cleanup);

/** Envoltorio con estado: el editor es controlado, como en el CMS de verdad. */
function Editor({ inicial = [], minBlocks }: { inicial?: LearningBlock[]; minBlocks?: number }) {
  const [items, setItems] = useState<LearningBlock[]>(inicial);
  return <BlockListEditor label="Contenido" items={items} onChange={setItems} minBlocks={minBlocks} />;
}

describe('<BlockListEditor />', () => {
  it('ofrece un chip por tipo de bloque', () => {
    render(<Editor />);
    for (const nombre of ['Párrafo', 'Título', 'Lista ✔', 'Lista ✘', 'Recuerda', 'Reflexión', 'Cita', 'Definiciones']) {
      expect(screen.getByRole('button', { name: new RegExp(nombre) })).toBeTruthy();
    }
  });

  it('añadir un bloque lo abre ya listo para escribir', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Párrafo/ }));
    expect(screen.getByPlaceholderText('Escribe el párrafo…')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar' })).toBeTruthy();
  });

  it('cada tipo abre sus propios campos', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Lista ✔/ }));
    expect(screen.getByPlaceholderText(/Algunas prácticas/)).toBeTruthy();
    expect(screen.getByText('Puntos')).toBeTruthy();

    cleanup();
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Reflexión/ }));
    expect(screen.getByText('Preguntas')).toBeTruthy();
  });

  it('escribir en un bloque se refleja en su vista previa al cerrarlo', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Párrafo/ }));
    fireEvent.change(screen.getByPlaceholderText('Escribe el párrafo…'), { target: { value: 'Hola mundo.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.getByText('Hola mundo.')).toBeTruthy();
  });

  it('un bloque sin escribir lo dice en vez de dejar la fila muda', () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole('button', { name: /Cita/ }));
    expect(screen.getByText('Sin contenido todavía')).toBeTruthy();
  });

  it('las flechas reordenan, y los extremos están deshabilitados', () => {
    render(
      <Editor
        inicial={[
          { kind: 'paragraph', text: 'Primero' },
          { kind: 'paragraph', text: 'Segundo' },
        ]}
      />,
    );
    const subir = screen.getAllByRole('button', { name: 'Subir bloque' }) as HTMLButtonElement[];
    const bajar = screen.getAllByRole('button', { name: 'Bajar bloque' }) as HTMLButtonElement[];
    expect(subir[0].disabled).toBe(true);
    expect(bajar[1].disabled).toBe(true);

    fireEvent.click(subir[1]);
    const previews = screen.getAllByText(/Primero|Segundo/).map((n) => n.textContent);
    expect(previews[0]).toBe('Segundo');
  });

  it('la papelera quita el bloque', () => {
    render(<Editor inicial={[{ kind: 'paragraph', text: 'Sobra' }]} />);
    fireEvent.click(screen.getByRole('button', { name: /Eliminar Párrafo/ }));
    expect(screen.queryByText('Sobra')).toBeNull();
  });

  it('el aviso de mínimo informa y no bloquea nada', () => {
    render(<Editor minBlocks={3} />);
    expect(screen.getByText(/Faltan 3 bloques\./)).toBeTruthy();
    expect(screen.getByText(/Se guarda igual/)).toBeTruthy();
  });

  // El CMS puede recibir contenido de una versión más nueva del panel. Borrarlo
  // por no saber editarlo sería perder el trabajo de alguien.
  it('un bloque de un tipo desconocido se conserva en vez de desaparecer', () => {
    const futuro = { kind: 'timeline', steps: [] } as unknown as LearningBlock;
    render(<Editor inicial={[futuro]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByText(/versión más reciente del panel/)).toBeTruthy();
  });

  it('las definiciones se añaden y se quitan de una en una', () => {
    const onChange = vi.fn();
    render(
      <BlockListEditor
        label="Contenido"
        items={[{ kind: 'definitions', title: '', items: [{ term: 'A', text: 'b' }] }]}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.click(screen.getByRole('button', { name: /Agregar definición/ }));
    expect(onChange).toHaveBeenCalledWith([
      { kind: 'definitions', title: '', items: [{ term: 'A', text: 'b' }, { term: '', text: '' }] },
    ]);
  });
});
