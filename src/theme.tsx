import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Theme = {
  dark: boolean;
  bg: string; card: string; card2: string; line: string;
  text: string; sub: string; faint: string;
  accent: string;      // riempimento dei pulsanti
  accentInk: string;   // accento usato su testi e icone
  onAccent: string;    // testo sopra l'accento
  accentSoft: string;  // sfondo tenue dell'accento
  ok: string; warn: string; danger: string;
  overlay: string;
};

// Colore del marchio: cambialo qui (e in app.json / assets) per adattare l'app a un'altra palestra.
export const DARK: Theme = {
  dark: true,
  bg: '#0A0A0B', card: '#1B1B1E', card2: '#26262A', line: 'rgba(255,255,255,0.09)',
  text: '#F5F5F7', sub: '#A5A5AD', faint: '#76767E',
  accent: '#E5392C', accentInk: '#FF6B5E', onAccent: '#FFFFFF', accentSoft: 'rgba(255,107,94,0.16)',
  ok: '#34C759', warn: '#FFB224', danger: '#FF6B5E',
  overlay: 'rgba(0,0,0,0.55)',
};
export const LIGHT: Theme = {
  dark: false,
  bg: '#F2F2F5', card: '#FFFFFF', card2: '#EBEBEF', line: 'rgba(0,0,0,0.09)',
  text: '#111114', sub: '#62626B', faint: '#8E8E96',
  accent: '#D92D20', accentInk: '#C42418', onAccent: '#FFFFFF', accentSoft: 'rgba(217,45,32,0.10)',
  ok: '#1E8E3E', warn: '#B26A00', danger: '#C42418',
  overlay: 'rgba(0,0,0,0.4)',
};

// I giorni della scheda hanno i colori dei dischi da bilanciere: rosso, blu, giallo, verde, bianco.
export const PLATES = [
  { c: '#D92D20', on: '#FFFFFF', name: 'rosso' },
  { c: '#2F6FED', on: '#FFFFFF', name: 'blu' },
  { c: '#F2B705', on: '#241A00', name: 'giallo' },
  { c: '#2FA84F', on: '#FFFFFF', name: 'verde' },
  { c: '#D5D8DE', on: '#15151A', name: 'bianco' },
];
export const plate = (i: number) => PLATES[((i % PLATES.length) + PLATES.length) % PLATES.length];

export type Mode = 'auto' | 'light' | 'dark';
type Ctx = { t: Theme; mode: Mode; setMode: (m: Mode) => void };
const ThemeCtx = createContext<Ctx>({ t: DARK, mode: 'auto', setMode: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [mode, setModeState] = useState<Mode>('auto');
  useEffect(() => {
    AsyncStorage.getItem('theme-mode').then((v) => { if (v === 'light' || v === 'dark' || v === 'auto') setModeState(v); }).catch(() => {});
  }, []);
  const setMode = (m: Mode) => { setModeState(m); AsyncStorage.setItem('theme-mode', m).catch(() => {}); };
  const dark = mode === 'auto' ? system !== 'light' : mode === 'dark';
  const value = useMemo(() => ({ t: dark ? DARK : LIGHT, mode, setMode }), [dark, mode]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}

// Dimensioni del testo
export const TYPE = {
  large: { fontSize: 32, fontWeight: '800' as const, letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700' as const, letterSpacing: -0.3 },
  head: { fontSize: 17, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  sub: { fontSize: 14, fontWeight: '400' as const },
  cap: { fontSize: 12.5, fontWeight: '500' as const },
};
export const NUM = { fontVariant: ['tabular-nums'] as any };
