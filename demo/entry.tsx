import { BAR_H, PHONE_H, PHONE_W, dark, login, rememberChoices, themeAsked, view } from './config';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

const css = `
:root{--bg:#f5f5f7;--ink:#1d1d1f;--muted:#6e6e73;--glass:rgba(255,255,255,.78);--seg:rgba(118,118,128,.16);--seg-on:#fff;--seg-ink:#1d1d1f;--line:rgba(0,0,0,.1);color-scheme:light}
:root.dark{--bg:#000;--ink:#f5f5f7;--muted:#98989d;--glass:rgba(22,22,23,.78);--seg:rgba(118,118,128,.28);--seg-on:#636366;--seg-ink:#fff;--line:rgba(255,255,255,.14);color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',system-ui,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
#shell{position:fixed;inset:0;display:flex;flex-direction:column}
#bar{flex:none;height:${BAR_H}px;display:flex;align-items:center;gap:14px;padding:0 16px;background:var(--glass);-webkit-backdrop-filter:saturate(180%) blur(20px);backdrop-filter:saturate(180%) blur(20px);border-bottom:1px solid var(--line);z-index:5}
#bar .brand{display:flex;flex-direction:column;line-height:1.15;flex:none;margin-right:auto}
#bar .brand b{font-size:15px;font-weight:600;letter-spacing:-.01em}
#bar .brand span{font-size:11px;color:var(--muted)}
#bar .brand i{font-style:normal}#bar .brand .short{display:none}
#bar .groups{display:flex;gap:10px;align-items:center;min-width:0;overflow-x:auto;scrollbar-width:none}
#bar .groups::-webkit-scrollbar{display:none}
.seg{display:flex;flex:none;padding:2px;border-radius:9px;background:var(--seg)}
.seg button{font:inherit;font-size:12.5px;font-weight:500;letter-spacing:-.005em;color:var(--ink);background:transparent;border:0;border-radius:7px;padding:6px 12px;cursor:pointer;white-space:nowrap;transition:background .15s,box-shadow .15s}
.seg button:focus-visible{outline:2px solid #0a84ff;outline-offset:1px}
.seg button[aria-pressed=true]{background:var(--seg-on);color:var(--seg-ink);font-weight:600;box-shadow:0 1px 3px rgba(0,0,0,.18)}
#stagewrap{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
#phone{position:relative;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
#phone.v-phone{width:${PHONE_W}px;height:${PHONE_H}px;border-radius:50px;box-shadow:0 0 0 11px #121214,0 0 0 12px #3a3a3c,0 40px 90px rgba(0,0,0,.35);flex:none}
#phone.v-computer{position:absolute;inset:16px;border-radius:14px;box-shadow:0 0 0 1px var(--line),0 24px 60px rgba(0,0,0,.18)}
#phone.v-direct{position:absolute;inset:0}
#note{position:absolute;left:0;right:0;bottom:10px;text-align:center;font-size:11.5px;color:var(--muted);pointer-events:none}
.rn-scroll::-webkit-scrollbar{display:none}.rn-scroll{scrollbar-width:none}.rn-input::placeholder{color:var(--ph)}
@keyframes sp{to{transform:rotate(360deg)}}.rn-spin{animation:sp .8s linear infinite}
@media (max-width:719px){#bar{gap:10px;padding:0 12px}#bar .brand .long{display:none}#bar .brand .short{display:inline}}
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
document.documentElement.classList.toggle('dark', dark);
document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#000000' : '#f5f5f7');

const go = (o: Record<string, string>) => {
  const n = new URLSearchParams(location.search);
  Object.entries(o).forEach(([k, v]) => (v ? n.set(k, v) : n.delete(k)));
  const q = n.toString();
  rememberChoices(o);
  try { history.replaceState(null, '', location.pathname + (q ? '?' + q : '')); } catch { /* pagina incorniciata */ }
  location.reload();
};

function Seg({ label, items, value, onPick }: { label: string; items: [string, string][]; value: string; onPick: (v: string) => void }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {items.map(([l, v]) => (
        <button key={v || 'x'} type="button" aria-pressed={value === v} onClick={() => onPick(v)}>{l}</button>
      ))}
    </div>
  );
}

function Shell() {
  const [k, setK] = useState(1);
  // adatta il telefono finto alla finestra e avvisa l'app quando cambia la misura dello schermo
  useLayoutEffect(() => {
    const fit = () => {
      const wrap = document.getElementById('stagewrap');
      if (wrap && view === 'phone') setK(Math.min(1, (wrap.clientHeight - 70) / PHONE_H, (wrap.clientWidth - 56) / PHONE_W));
    };
    fit();
    window.dispatchEvent(new Event('resize')); // l'app legge le misure dello schermo solo quando arriva questo evento
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const el = document.getElementById('phone');
    if (!el || view === 'phone' || !('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(() => window.dispatchEvent(new Event('resize')));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div id="shell">
      <header id="bar">
        <div className="brand"><b>Schede palestra</b><span><i className="long">Demo con dati di prova</i><i className="short">Demo</i></span></div>
        <div className="groups">
          <Seg label="Chi guarda" value={login} onPick={(v) => go({ login: v })}
            items={[['Benvenuto', ''], ['Socio', 'member'], ['PT', 'trainer'], ['Titolare', 'owner']]} />
          {view !== 'direct' && (
            <Seg label="Dispositivo" value={view} onPick={(v) => go({ view: v === 'phone' ? '' : v })}
              items={[['Telefono', 'phone'], ['Computer', 'computer']]} />
          )}
          <Seg label="Tema" value={themeAsked} onPick={(v) => go({ theme: v })}
            items={[['Auto', ''], ['Chiaro', 'light'], ['Scuro', 'dark']]} />
        </div>
      </header>
      <main id="stagewrap">
        <div id="phone" className={'v-' + view} style={view === 'phone' ? { transform: `scale(${k})` } : undefined}>
          <App />
        </div>
        {view === 'phone' && <div id="note">Dati di prova: nulla viene salvato davvero. Per registrarti usa il codice AURORA.</div>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Shell />);
