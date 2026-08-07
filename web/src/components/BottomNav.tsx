import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Icon } from './Icon';
import { ADMIN_NAV, ADMIN_TABS, MAIN_TABS, TEACHER_NAV, isActive } from './nav-items';

/**
 * Phone navigation. Hidden on desktop, where the sidebar stays exactly as it
 * was — below 760px the sidebar used to turn into a horizontal icon scroller,
 * which is a desktop compromise, not a phone pattern.
 *
 * Four tabs plus "Más" for the rest of the sections. Every target is at least
 * 44x44px and the bar pads itself past the iPhone home indicator via
 * `env(safe-area-inset-bottom)` — React Native gave the mobile app that through
 * `useSafeAreaInsets`, which returns 0 on the web.
 */
export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isAdmin } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  const tabs = isAdmin ? ADMIN_TABS : MAIN_TABS;
  const allSections = isAdmin ? ADMIN_NAV : TEACHER_NAV;

  // Close the sheet on navigation so it never survives a route change.
  useEffect(() => setMoreOpen(false), [pathname]);

  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', onKey);
    sheetRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [moreOpen]);

  const go = (href: string) => {
    setMoreOpen(false);
    navigate(href);
  };

  // "Más" counts as active whenever the current screen is not one of the tabs.
  const onATab = tabs.some((t) => isActive(pathname, t.href));

  return (
    <>
      {moreOpen && (
        <div
          className="more-sheet-backdrop"
          role="presentation"
          onClick={() => setMoreOpen(false)}>
          <div
            ref={sheetRef}
            className="more-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Más secciones"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}>
            <div className="more-sheet__grabber" aria-hidden="true" />
            <p className="more-sheet__title">Secciones</p>
            <div className="more-sheet__list">
              {allSections.map((item) => (
                <button
                  key={item.href}
                  type="button"
                  className={isActive(pathname, item.href) ? 'active' : ''}
                  aria-current={isActive(pathname, item.href) ? 'page' : undefined}
                  onClick={() => go(item.href)}>
                  <span className="tile" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span className="label">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <nav className="bottom-nav" aria-label="Navegación principal">
        {tabs.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <button
              key={tab.href}
              type="button"
              className={active ? 'active' : ''}
              aria-current={active ? 'page' : undefined}
              onClick={() => go(tab.href)}>
              <Icon name={tab.icon} size={21} color="currentColor" />
              <span>{tab.label}</span>
            </button>
          );
        })}
        <button
          type="button"
          className={!onATab || moreOpen ? 'active' : ''}
          aria-expanded={moreOpen}
          aria-haspopup="dialog"
          onClick={() => setMoreOpen((v) => !v)}>
          <Icon name="menu" size={21} color="currentColor" />
          <span>Más</span>
        </button>
      </nav>
    </>
  );
}
