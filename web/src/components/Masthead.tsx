// Editorial masthead used at the top of each post-login screen:
// eyebrow rule + kicker, a serif headline with an italic accent word, a lede,
// and a date chip on the right. Replaces the old gradient header.

interface Props {
  /** small uppercase kicker above the title */
  eyebrow: string;
  /** headline; rendered in serif */
  title: string;
  /** optional italic teal accent word appended to the title */
  accent?: string;
  /** supporting paragraph under the title */
  lede?: string;
  /** show the "Hoy / <date>" chip (defaults to true) */
  showDate?: boolean;
}

const fmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'short' });

export function Masthead({ eyebrow, title, accent, lede, showDate = true }: Props) {
  const today = fmt.format(new Date()).replace(/\./g, '');

  return (
    <header className="masthead">
      <div className="mast-body">
        <div className="eyebrow">
          <span className="rule" />
          <span className="kicker">{eyebrow}</span>
        </div>
        <h1>
          {title} {accent ? <span className="accent">{accent}</span> : null}
        </h1>
        {lede ? <p className="lede">{lede}</p> : null}
      </div>
      {showDate ? (
        <div className="datechip">
          <div className="when">
            <div className="lbl">Hoy</div>
            <div className="val">{today}</div>
          </div>
          <span className="ico">🗓️</span>
        </div>
      ) : null}
    </header>
  );
}
