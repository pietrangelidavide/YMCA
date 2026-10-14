// Mini "react-native" per il browser: abbastanza per disegnare l'app DF Barbershop nella demo online.
// Piattaforma, misure e margini di sicurezza arrivano da demo/config.ts (window.__DEMO).
import React, { createContext, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const Q = new URLSearchParams(location.search);
export const Platform: any = {
  OS: (window as any).__DEMO?.os || Q.get('os') || 'ios',
  select: (o: any) => (o[Platform.OS] !== undefined ? o[Platform.OS] : o.default),
};

const NOUNIT = new Set(['flex', 'flexGrow', 'flexShrink', 'opacity', 'zIndex', 'fontWeight', 'aspectRatio', 'scale', 'order']);
function fontFamily(f: string) {
  if (!f) return undefined;
  if (/bebas/i.test(f)) return "'BebasNeue_400Regular','DejaVu Sans Condensed',sans-serif";
  if (/cormorant|playfair/i.test(f)) return "'CormorantGaramond_500Medium_Italic','FreeSerif',serif";
  return f;
}
function parseColor(c: string): [number, number, number, number] | null {
  if (!c) return null;
  let m = /^#([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(c);
  if (m) return [parseInt(m[1].slice(0, 2), 16), parseInt(m[1].slice(2, 4), 16), parseInt(m[1].slice(4, 6), 16), m[2] ? parseInt(m[2], 16) / 255 : 1];
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return [...m[1].split('').map((x) => parseInt(x + x, 16)), 1] as any;
  m = /^rgba?\(([^)]+)\)$/.exec(c);
  if (m) { const p = m[1].split(',').map((x) => parseFloat(x)); return [p[0], p[1], p[2], p[3] ?? 1]; }
  return null;
}
export function flatten(style: any): any {
  if (!style) return {};
  if (Array.isArray(style)) return style.reduce((a, s) => Object.assign(a, flatten(s)), {});
  return style;
}
const num = (v: any) => (typeof v === 'number' ? `${v}px` : v);
export function toCss(raw: any): React.CSSProperties {
  const st = flatten(raw);
  const o: any = {};
  for (const [k, v0] of Object.entries<any>(st)) {
    if (v0 === undefined || v0 === null) continue;
    let v = v0;
    switch (k) {
      case 'paddingHorizontal': o.paddingLeft = num(v); o.paddingRight = num(v); continue;
      case 'paddingVertical': o.paddingTop = num(v); o.paddingBottom = num(v); continue;
      case 'marginHorizontal': o.marginLeft = num(v); o.marginRight = num(v); continue;
      case 'marginVertical': o.marginTop = num(v); o.marginBottom = num(v); continue;
      case 'borderTopLeftRadius': o.borderTopLeftRadius = num(v); continue;
      case 'shadowColor': case 'shadowOpacity': case 'shadowRadius': case 'shadowOffset': case 'elevation': case 'textAlignVertical': case 'includeFontPadding': case 'resizeMode': case 'tintColor': case 'overlayColor': continue;
      case 'fontVariant': o.fontVariantNumeric = (v as string[]).includes('tabular-nums') ? 'tabular-nums' : 'normal'; continue;
      case 'fontFamily': o.fontFamily = fontFamily(v); if (/bold/i.test(v)) o.fontWeight = 700; if (/italic/i.test(v)) o.fontStyle = 'italic'; continue;
      case 'transform': o.transform = (v as any[]).map((t) => Object.entries(t).map(([n, a]: any) => (n === 'scale' || n === 'scaleX' || n === 'scaleY' ? `${n}(${a})` : n.startsWith('rotate') ? `${n}(${a})` : `${n}(${typeof a === 'number' ? a + 'px' : a})`)).join(' ')).join(' '); continue;
      case 'flex': o.flex = v > 0 ? `${v} ${v} 0%` : v === 0 ? '0 0 auto' : v; continue;
      case 'lineHeight': o.lineHeight = typeof v === 'number' ? `${v}px` : v; continue;
      case 'fontWeight': o.fontWeight = v; continue;
      case 'letterSpacing': o.letterSpacing = num(v); continue;
    }
    o[k] = NOUNIT.has(k) ? v : num(v);
  }
  // ombre
  if (st.shadowColor && (st.shadowOpacity ?? 0) > 0) {
    const c = parseColor(st.shadowColor) || [0, 0, 0, 1];
    const off = st.shadowOffset || { width: 0, height: 0 };
    o.boxShadow = `${off.width}px ${off.height}px ${st.shadowRadius ?? 0}px rgba(${c[0]},${c[1]},${c[2]},${(c[3] * st.shadowOpacity).toFixed(3)})`;
  }
  if (st.borderWidth || st.borderTopWidth || st.borderBottomWidth || st.borderLeftWidth || st.borderRightWidth) {
    o.borderStyle = 'solid';
    if (st.borderColor === undefined) o.borderColor = '#000';
    if (st.borderWidth && !('borderTopWidth' in st)) { /* ok */ }
  }
  return o;
}
const BASE: React.CSSProperties = { display: 'flex', flexDirection: 'column', position: 'relative', boxSizing: 'border-box', minWidth: 0, minHeight: 0, flexShrink: 0, alignItems: 'stretch', borderWidth: 0, borderStyle: 'solid' };

export const StyleSheet: any = {
  create: (o: any) => o,
  flatten,
  absoluteFill: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  absoluteFillObject: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  hairlineWidth: 1,
};

// ── Animated ──
class Node { ls = new Set<() => void>(); addListener(f: () => void) { this.ls.add(f); return () => this.ls.delete(f); } emit() { this.ls.forEach((f) => f()); } getValue(): any { return 0; } }
class AValue extends Node {
  constructor(public v: number) { super(); }
  setValue(n: number) { this.v = n; this.emit(); }
  getValue() { return this.v; }
  interpolate(cfg: { inputRange: number[]; outputRange: any[] }) { return new Interp(this, cfg); }
}
class Interp extends Node {
  constructor(public src: Node, public cfg: { inputRange: number[]; outputRange: any[] }) { super(); src.addListener(() => this.emit()); }
  getValue() {
    const x = this.src.getValue(); const { inputRange: ir, outputRange: or } = this.cfg;
    if (x <= ir[0]) return or[0]; if (x >= ir[ir.length - 1]) return or[or.length - 1];
    for (let i = 1; i < ir.length; i++) if (x <= ir[i]) { const t = (x - ir[i - 1]) / (ir[i] - ir[i - 1]); return or[i - 1] + (or[i] - or[i - 1]) * t; }
    return or[0];
  }
}
export const Easing: any = { cubic: (t: number) => t * t * t, exp: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * (t - 1))), out: (f: any) => (t: number) => 1 - f(1 - t), inOut: (f: any) => (t: number) => (t < 0.5 ? f(t * 2) / 2 : 1 - f((1 - t) * 2) / 2), ease: (t: number) => t, quad: (t: number) => t * t };
const timing = (v: AValue, cfg: any) => ({
  start(cb?: () => void) {
    const from = v.v, to = cfg.toValue, d = Math.max(1, (cfg.duration ?? 300) * (Q.get('fast') ? 0.02 : 1)), delay = (cfg.delay ?? 0) * (Q.get('fast') ? 0.02 : 1), ease = cfg.easing || ((t: number) => t);
    let t0 = 0;
    const tick = (now: number) => { if (!t0) t0 = now; const k = Math.min(1, Math.max(0, (now - t0 - delay) / d)); v.setValue(from + (to - from) * ease(k)); if (now - t0 - delay < d) requestAnimationFrame(tick); else cb?.(); };
    requestAnimationFrame(tick);
  },
});
function resolveStyle(raw: any) {
  const st = flatten(raw); const o: any = {};
  for (const [k, v] of Object.entries<any>(st)) {
    if (v instanceof Node) o[k] = v.getValue();
    else if (k === 'transform') o[k] = (v as any[]).map((t) => Object.fromEntries(Object.entries<any>(t).map(([n, a]) => [n, a instanceof Node ? a.getValue() : a])));
    else o[k] = v;
  }
  return o;
}
function collectNodes(raw: any): Node[] {
  const st = flatten(raw); const out: Node[] = [];
  for (const v of Object.values<any>(st)) { if (v instanceof Node) out.push(v); else if (Array.isArray(v)) v.forEach((t: any) => Object.values<any>(t).forEach((a) => a instanceof Node && out.push(a))); }
  return out;
}
function animated(C: any) {
  return React.forwardRef<any, any>(function A({ style, ...p }, ref) {
    const [, bump] = useReducer((n: number) => n + 1, 0);
    const nodes = collectNodes(style);
    useEffect(() => { const offs = nodes.map((n) => n.addListener(bump)); return () => offs.forEach((o) => o()); });
    return <C ref={ref} {...p} style={resolveStyle(style)} />;
  });
}
export const Animated: any = {
  Value: AValue,
  timing,
  parallel: (list: any[]) => ({ start: (cb?: () => void) => { let n = list.length; list.forEach((a) => a.start(() => { if (--n === 0) cb?.(); })); } }),
  sequence: (list: any[]) => ({ start: (cb?: () => void) => { let i = 0; const next = () => (i < list.length ? list[i++].start(next) : cb?.()); next(); } }),
  loop: (a: any) => ({ start: () => { const go = () => a.start(go); go(); }, stop() {} }),
  delay: (ms: number) => ({ start: (cb?: () => void) => setTimeout(() => cb?.(), ms) }),
};

// ── Componenti ──
const TextCtx = createContext(false);
export const View = React.forwardRef<any, any>(function View({ style, children, onLayout, pointerEvents, testID, accessibilityLabel, accessibilityRole, accessible, ...rest }, ref) {
  const el = useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => el.current as any);
  useLayoutEffect(() => {
    if (!onLayout || !el.current) return;
    const f = () => { const e = el.current!; onLayout({ nativeEvent: { layout: { x: e.offsetLeft, y: e.offsetTop, width: e.offsetWidth, height: e.offsetHeight } } }); };
    f(); const ro = new ResizeObserver(f); ro.observe(el.current); return () => ro.disconnect();
  }, [onLayout]);
  const css = { ...BASE, ...toCss(style), ...(pointerEvents === 'none' ? { pointerEvents: 'none' as const } : {}) };
  return <div ref={el} style={css} aria-label={accessibilityLabel} role={accessibilityRole === 'header' ? 'heading' : undefined} data-rn="View">{children}</div>;
});
export const Text = React.forwardRef<any, any>(function Text({ style, children, numberOfLines, ellipsizeMode, selectable, allowFontScaling, accessibilityRole, accessibilityLabel, onPress, ...rest }, ref) {
  const nested = useContext(TextCtx);
  const css: any = { margin: 0, ...toCss(style), display: nested ? 'inline' : 'block', boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: flatten(style).color ?? (nested ? 'inherit' : '#000'), fontFamily: fontFamily(flatten(style).fontFamily) ?? (nested ? 'inherit' : "Inter, system-ui, -apple-system, 'Segoe UI', sans-serif"), fontSize: flatten(style).fontSize ?? (nested ? 'inherit' : 14) };
  if (css.fontSize !== undefined && typeof css.fontSize === 'number') css.fontSize = css.fontSize + 'px';
  if (!nested) css.flexShrink = 1;
  if (numberOfLines) { Object.assign(css, numberOfLines === 1 ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: ellipsizeMode === 'clip' ? 'clip' : 'ellipsis' } : { display: '-webkit-box', WebkitLineClamp: numberOfLines, WebkitBoxOrient: 'vertical', overflow: 'hidden' }); }
  return <TextCtx.Provider value={true}><span ref={ref} style={css} onClick={onPress}>{children}</span></TextCtx.Provider>;
});
export const AnimatedView = animated(View);
export const AnimatedText = animated(Text);
Animated.View = AnimatedView; Animated.Text = AnimatedText; Animated.Image = animated(React.forwardRef((p: any, r: any) => <Image {...p} ref={r} />));

export const Pressable = React.forwardRef<any, any>(function Pressable({ style, children, onPress, disabled, onLayout, accessibilityLabel, ...rest }, ref) {
  const [pressed, setP] = useState(false);
  const st = typeof style === 'function' ? style({ pressed }) : style;
  const css = { ...BASE, ...toCss(st), cursor: disabled ? 'default' : 'pointer', userSelect: 'none' as const };
  return (
    <div ref={ref} role="button" aria-label={accessibilityLabel} aria-disabled={disabled || undefined} style={css} data-rn="Pressable"
      onPointerDown={() => setP(true)} onPointerUp={() => setP(false)} onPointerLeave={() => setP(false)}
      onClick={(e) => { if (!disabled && onPress) { e.stopPropagation(); onPress(e); } }}>
      {typeof children === 'function' ? children({ pressed }) : children}
    </div>
  );
});
export const ScrollView = React.forwardRef<any, any>(function ScrollView({ style, contentContainerStyle, horizontal, children, onLayout, ...rest }, ref) {
  const el = useRef<HTMLDivElement>(null);
  React.useImperativeHandle(ref, () => ({ scrollTo: ({ y, x }: any) => el.current?.scrollTo({ top: y ?? 0, left: x ?? 0, behavior: 'smooth' }), scrollToEnd: () => el.current?.scrollTo({ top: 1e6 }) }));
  const css: any = { ...BASE, ...toCss(style), overflowX: horizontal ? 'auto' : 'hidden', overflowY: horizontal ? 'hidden' : 'auto', flexGrow: 1, flexShrink: 1, flexDirection: horizontal ? 'row' : 'column' };
  if (horizontal) { css.flexGrow = 0; }
  return (
    <div ref={el} className="rn-scroll" style={css} data-rn="ScrollView">
      <div style={{ ...BASE, flexDirection: horizontal ? 'row' : 'column', flexShrink: 0, flexGrow: horizontal ? 0 : 1, ...toCss(contentContainerStyle) }}>{children}</div>
    </div>
  );
});
export const Image = React.forwardRef<any, any>(function Image({ source, style, resizeMode, ...rest }, ref) {
  const src = typeof source === 'string' ? source : source?.uri ?? source?.default;
  const st = flatten(style);
  const fit = ({ cover: 'cover', contain: 'contain', stretch: 'fill', center: 'none' } as any)[resizeMode || st.resizeMode || 'cover'];
  return <img ref={ref} src={src} alt="" draggable={false} style={{ ...BASE, display: 'block', objectFit: fit, ...toCss(style) }} />;
});
export function TextInput({ style, value, onChangeText, placeholder, placeholderTextColor, secureTextEntry, multiline, editable, keyboardType, ...rest }: any) {
  const css: any = { ...BASE, ...toCss(style), font: 'inherit', fontFamily: "Inter, system-ui, sans-serif", fontSize: flatten(style).fontSize ?? 14, background: flatten(style).backgroundColor ?? 'transparent', outline: 'none', resize: 'none', color: flatten(style).color ?? '#000', ['--ph' as any]: placeholderTextColor || '#999' };
  const P: any = multiline ? 'textarea' : 'input';
  return <P className="rn-input" style={css} value={value ?? ''} placeholder={placeholder} type={secureTextEntry ? 'password' : 'text'} disabled={editable === false} onChange={(e: any) => onChangeText?.(e.target.value)} />;
}
export function ActivityIndicator({ color = '#888', size, style }: any) {
  const d = size === 'small' ? 18 : 26;
  return <View style={[{ width: d, height: d, alignSelf: 'center' }, style]}><div className="rn-spin" style={{ width: d, height: d, border: `2px solid ${color}33`, borderTopColor: color, borderRadius: '50%' }} /></View>;
}
export const KeyboardAvoidingView = View;
export function Modal({ visible, children, transparent }: any) {
  const host = document.getElementById('phone');
  if (!visible || !host) return null;
  return createPortal(<div style={{ ...BASE, position: 'absolute', inset: 0, zIndex: 50, background: transparent ? 'transparent' : undefined }}>{children}</div>, host);
}
export const Alert: any = { alert: (t: string, m?: string, b?: any[]) => { (window as any).__alerts = [...((window as any).__alerts || []), [t, m]]; console.log('ALERT', t, m); } };
export const Linking: any = { openURL: (u: string) => { (window as any).__opened = [...((window as any).__opened || []), u]; return Promise.resolve(); } };
export const AccessibilityInfo: any = { isReduceMotionEnabled: () => Promise.resolve(false) };
export function useColorScheme() { const t = Q.get('theme'); if (t) return t; return matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'; }
export function useWindowDimensions() { const [d, set] = useState(() => dims()); useEffect(() => { const f = () => set(dims()); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []); return d; }
const dims = () => { const d = (window as any).__DEMO?.dims?.(); return { width: d?.width ?? Number(Q.get('w') || 390), height: d?.height ?? Number(Q.get('h') || 844), scale: 3, fontScale: 1 }; };
export const Dimensions = { get: dims };

export function FlatList({ data, renderItem, keyExtractor, ListHeaderComponent, ListFooterComponent, ListEmptyComponent, contentContainerStyle, style }: any) {
  const el = (C: any) => (C ? (typeof C === 'function' ? <C /> : C) : null);
  const list = data || [];
  return (
    <ScrollView style={style} contentContainerStyle={contentContainerStyle}>
      {el(ListHeaderComponent)}
      {list.length ? list.map((item: any, index: number) => <React.Fragment key={keyExtractor ? keyExtractor(item, index) : index}>{renderItem({ item, index })}</React.Fragment>) : el(ListEmptyComponent)}
      {el(ListFooterComponent)}
    </ScrollView>
  );
}
export const BackHandler: any = { addEventListener: () => ({ remove() {} }) };
export const Keyboard: any = { dismiss() {}, addListener: () => ({ remove() {} }) };
