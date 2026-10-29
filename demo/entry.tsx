import { PHONE_H, PHONE_W, TABLET_H, TABLET_W, dark, view } from './config';
import React, { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import App from '../App';

const css = `
:root{--bg:#f5f5f7;--ink:#1d1d1f;--muted:#6e6e73;--glass:rgba(255,255,255,.78);--seg:rgba(118,118,128,.16);--seg-on:#fff;--seg-ink:#1d1d1f;--line:rgba(0,0,0,.1);color-scheme:light}
:root.dark{--bg:#000;--ink:#f5f5f7;--muted:#98989d;--glass:rgba(22,22,23,.78);--seg:rgba(118,118,128,.28);--seg-on:#636366;--seg-ink:#fff;--line:rgba(255,255,255,.14);color-scheme:dark}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{margin:0;height:100%;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter',system-ui,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased}
#shell{position:fixed;inset:0;display:flex;flex-direction:column}
#stagewrap{flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;overflow:hidden}
#phone{position:relative;display:flex;flex-direction:column;overflow:hidden;background:var(--bg)}
#phone.v-phone{width:${PHONE_W}px;height:${PHONE_H}px;border-radius:50px;box-shadow:0 0 0 11px #121214,0 0 0 12px #3a3a3c,0 40px 90px rgba(0,0,0,.35);flex:none}
#phone.v-tablet{width:${TABLET_W}px;height:${TABLET_H}px;border-radius:34px;box-shadow:0 0 0 12px #121214,0 0 0 13px #3a3a3c,0 40px 90px rgba(0,0,0,.35);flex:none}
#phone.v-computer{position:absolute;inset:16px;border-radius:14px;box-shadow:0 0 0 1px var(--line),0 24px 60px rgba(0,0,0,.18)}
#phone.v-direct{position:absolute;inset:0}
#note{position:absolute;left:0;right:0;bottom:10px;text-align:center;font-size:11.5px;color:var(--muted);pointer-events:none}
.rn-scroll::-webkit-scrollbar{display:none}.rn-scroll{scrollbar-width:none}.rn-input::placeholder{color:var(--ph)}
@keyframes sp{to{transform:rotate(360deg)}}.rn-spin{animation:sp .8s linear infinite}
`;
document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
document.documentElement.classList.toggle('dark', dark);
document.querySelector('meta[name=theme-color]')?.setAttribute('content', dark ? '#000000' : '#f5f5f7');

function Shell() {
  const [k, setK] = useState(1);
  // adatta il telefono finto alla finestra e avvisa l'app quando cambia la misura dello schermo
  useLayoutEffect(() => {
    const fit = () => {
      const wrap = document.getElementById('stagewrap');
      if (wrap && view === 'phone') setK(Math.min(1, (wrap.clientHeight - 70) / PHONE_H, (wrap.clientWidth - 56) / PHONE_W));
      if (wrap && view === 'tablet') setK(Math.min(1, (wrap.clientHeight - 80) / TABLET_H, (wrap.clientWidth - 64) / TABLET_W));
    };
    fit();
    window.dispatchEvent(new Event('resize')); // l'app legge le misure dello schermo solo quando arriva questo evento
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  useEffect(() => {
    const el = document.getElementById('phone');
    if (!el || view === 'phone' || view === 'tablet' || !('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(() => window.dispatchEvent(new Event('resize')));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div id="shell">
      <main id="stagewrap">
        <div id="phone" className={'v-' + view} style={view === 'phone' || view === 'tablet' ? { transform: `scale(${k})` } : undefined}>
          <App />
        </div>
        {(view === 'phone' || view === 'tablet') && <div id="note">Dati di prova: nulla viene salvato davvero.</div>}
      </main>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<Shell />);
