import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import type { Entry } from '../courses/mech430/meta';

export interface NavGroup {
  title: string;
  base: string;
  items: Entry[];
}

function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('theme') ?? 'auto';
    } catch {
      return 'auto';
    }
  });
  useEffect(() => {
    const el = document.documentElement;
    if (theme === 'auto') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const next = theme === 'auto' ? 'light' : theme === 'light' ? 'dark' : 'auto';
  return { theme, cycle: () => setTheme(next) };
}

export function Layout({ nav, courseTitle, courseHome, crumbs, children, wide }: {
  nav?: NavGroup[];
  courseTitle?: string;
  courseHome?: string;
  crumbs?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const { theme, cycle } = useTheme();
  const loc = useLocation();
  useEffect(() => {
    setOpen(false);
    if (!loc.hash) window.scrollTo(0, 0);
    else setTimeout(() => document.getElementById(loc.hash.slice(1))?.scrollIntoView(), 50);
  }, [loc.pathname, loc.hash]);

  return (
    <div className="app">
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <Link to="/" className="brand">
          <span className="logo">∿</span> Engineering Revision
        </Link>
        {courseTitle && courseHome && (
          <NavLink end to={courseHome} className="nav" style={{ fontWeight: 700 }}>
            {courseTitle}
          </NavLink>
        )}
        {nav?.map((g) => (
          <div key={g.title}>
            <h4>{g.title}</h4>
            {g.items.map((it) => (
              <NavLink key={it.slug} to={`${g.base}/${it.slug}`} className="nav">
                {it.num !== undefined && <span className="num">{it.num}</span>}
                <span>{it.title}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <div className="main">
        <div className="topbar">
          <button className="menu-btn" onClick={() => setOpen(!open)} aria-label="Menu">
            ☰
          </button>
          <div className="crumbs">{crumbs}</div>
          <button onClick={cycle} title="Theme">
            {theme === 'auto' ? '◐ Auto' : theme === 'light' ? '☀ Light' : '☾ Dark'}
          </button>
        </div>
        <div className={`content ${wide ? 'wide' : ''}`}>{children}</div>
      </div>
    </div>
  );
}
