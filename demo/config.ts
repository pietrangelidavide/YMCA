// Va importato per primo: decide come mostrare l'app (telefono finto, computer o schermo intero) prima che l'app parta.
// Le scelte stanno nell'indirizzo: ?login=member|trainer|owner  ?view=phone|computer  ?theme=light|dark  ?gym=Nome della palestra
// Dentro una pagina incorniciata (anteprima su claude.ai) l'indirizzo non porta i parametri: le scelte restano nella sessione.
const framed = (() => { try { return self !== top; } catch { return true; } })();
const saved: Record<string, string> = (() => { try { return framed ? JSON.parse(sessionStorage.getItem('demo-q') || '{}') : {}; } catch { return {}; } })();
const Q = { get: (k: string): string | null => new URLSearchParams(location.search).get(k) ?? saved[k] ?? null };
export const rememberChoices = (o: Record<string, string>) => {
  if (!framed) return;
  try { sessionStorage.setItem('demo-q', JSON.stringify({ ...saved, ...o })); } catch { /* senza sessione la scelta non si ricorda */ }
};

export type View = 'phone' | 'computer' | 'direct';
export const PHONE_W = 390;
export const PHONE_H = 844;
export const BAR_H = 0; // la demo non ha più la barra in alto

const wide = innerWidth >= 720;
const asked = Q.get('view');
export const view: View = !wide ? 'direct' : asked === 'computer' ? 'computer' : 'phone';
export const login = Q.get('login') || '';
export const themeAsked = Q.get('theme') === 'light' || Q.get('theme') === 'dark' ? (Q.get('theme') as 'light' | 'dark') : '';
export const dark = themeAsked ? themeAsked === 'dark' : !matchMedia('(prefers-color-scheme: light)').matches;

const stage = () => document.getElementById('phone');
// Sul telefono vero (pagina a tutto schermo) usa i margini di sicurezza reali dello schermo: isola, barra di stato, barra home
function safeInsets() {
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top,0px) 0 env(safe-area-inset-bottom,0px) 0';
  document.body.appendChild(probe);
  const cs = getComputedStyle(probe);
  const top = parseFloat(cs.paddingTop) || 0, bottom = parseFloat(cs.paddingBottom) || 0;
  probe.remove();
  return { top: Math.max(top, 12), bottom: Math.max(bottom, 14) };
}
(window as any).__DEMO = {
  gym: Q.get('gym') || 'YMCA Prime Sport Club',
  os: view === 'computer' ? 'web' : 'ios',
  insets: view === 'phone' ? { top: 47, bottom: 34 } : view === 'direct' ? safeInsets() : { top: 0, bottom: 0 },
  // accessi rapidi del benvenuto (esistono solo nella demo)
  quickLogins: [
    { label: 'Accedi come cliente', email: 'socio@demo.it' },
    { label: 'Accedi come trainer', email: 'pt@demo.it' },
    { label: 'Accedi come titolare', email: 'titolare@demo.it' },
  ],
  dims: () => {
    if (view === 'phone') return { width: PHONE_W, height: PHONE_H };
    const el = stage();
    return { width: el?.clientWidth || innerWidth - (view === 'computer' ? 32 : 0), height: el?.clientHeight || innerHeight - BAR_H - (view === 'computer' ? 32 : 0) };
  },
};

// Orologio della demo: la data è quella di oggi ma l'ora di partenza è sempre le 10:40 (ora di Roma),
// così i saluti e gli orari sono sempre coerenti qualunque sia l'ora in cui si apre la demo.
const RealDate = Date;
const romeMin = (t: number) => {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new RealDate(t));
  const g = (k: string) => Number(p.find((x) => x.type === k)?.value ?? 0);
  return g('hour') * 60 + g('minute');
};
const shift = (10 * 60 + 40 - romeMin(RealDate.now())) * 60000;
class DemoDate extends RealDate {
  constructor(...a: any[]) {
    if (a.length === 0) super(RealDate.now() + shift);
    else super(...(a as [any]));
  }
  static now() { return RealDate.now() + shift; }
}
(window as any).Date = DemoDate;
