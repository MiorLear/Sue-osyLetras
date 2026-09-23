import type { ReactNode } from 'react';
import { Masthead } from '@/components/Masthead';

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: 19, fontWeight: 600, color: 'var(--text-dark)', marginBottom: 8 }}>{title}</h3>
      {children}
    </section>
  );
}

const P = { fontSize: 14, color: 'var(--text-body)', lineHeight: 1.65 } as const;

export default function Sobre() {
  return (
    <div className="page page-narrow">
      <Masthead
        eyebrow="Sobre ExplorArte"
        title="Sueños y"
        accent="Letras"
        lede="Conoce la metodología y la organización detrás de ExplorArte."
        showDate={false}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <Section title="¿Qué es ExplorArte?">
          <p style={P}>ExplorArte es una iniciativa desarrollada por Sueños y Letras que promueve la salud mental y el bienestar emocional a través de la lectura, el arte y experiencias participativas de aprendizaje.</p>
        </Section>
        <Section title="Nuestra visión">
          <p style={P}>Construir comunidades educativas donde niñas, niños y adolescentes puedan desarrollarse plenamente, contando con herramientas emocionales que les permitan afrontar los desafíos de la vida y alcanzar su potencial.</p>
        </Section>
        <Section title="Nuestro enfoque">
          <p style={{ ...P, marginBottom: 10 }}>Trabajamos desde tres pilares fundamentales:</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {['Salud mental', 'Desarrollo emocional', 'Desarrollo social'].map((p) => (
              <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: 'var(--brand)' }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-dark)' }}>{p}</span>
              </div>
            ))}
          </div>
          <p style={{ ...P, marginTop: 10 }}>Estos pilares se fortalecen mediante la lectura, la escritura, el arte y la participación activa de las comunidades educativas.</p>
        </Section>
        <Section title="Sueños y Letras">
          <p style={P}>Sueños y Letras acompaña y promueve el bienestar socioemocional, la libertad creativa y el desarrollo de comunidades de aprendizaje a través de la lectura y la escritura.</p>
        </Section>

        <a
          href="https://www.facebook.com/suenosyletrassv"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Sueños y Letras en Facebook"
          style={{ padding: '20px 16px', borderRadius: 16, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#EAF4F3', border: '1.5px solid var(--border-soft)', textDecoration: 'none' }}
        >
          <img src="/logo.jpg" width={120} height={120} style={{ borderRadius: 12 }} alt="Sueños y Letras" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--brand)' }}>Síguenos en Facebook</span>
        </a>
      </div>
    </div>
  );
}
