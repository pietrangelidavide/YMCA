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

// Colori del marchio YMCA Prime Sport Club: rosso #E21D23, bianco e grafite. Per adattare l'app a un'altra palestra cambia qui, in app.json e in assets/.
export const DARK: Theme = {
  dark: true,
  bg: '#0A0A0B', card: '#1B1B1E', card2: '#26262A', line: 'rgba(255,255,255,0.09)',
  text: '#F5F5F7', sub: '#A5A5AD', faint: '#76767E',
  accent: '#E21D23', accentInk: '#FF5A55', onAccent: '#FFFFFF', accentSoft: 'rgba(226,29,35,0.18)',
  ok: '#34C759', warn: '#FFB224', danger: '#FF6B5E',
  overlay: 'rgba(0,0,0,0.55)',
};
export const LIGHT: Theme = {
  dark: false,
  bg: '#F2F2F5', card: '#FFFFFF', card2: '#EBEBEF', line: 'rgba(0,0,0,0.09)',
  text: '#111114', sub: '#62626B', faint: '#8E8E96',
  accent: '#E21D23', accentInk: '#C4161C', onAccent: '#FFFFFF', accentSoft: 'rgba(226,29,35,0.10)',
  ok: '#1E8E3E', warn: '#B26A00', danger: '#C42418',
  overlay: 'rgba(0,0,0,0.4)',
};

// I giorni della scheda (A, B, C...) e gli avatar usano i toni del marchio: rosso, grafite, bordeaux, rosa, argento.
export const PLATES = [
  { c: '#E21D23', on: '#FFFFFF', name: 'rosso' },
  { c: '#6F7683', on: '#FFFFFF', name: 'grafite' },
  { c: '#9B1319', on: '#FFFFFF', name: 'bordeaux' },
  { c: '#F08A86', on: '#2A0A0B', name: 'rosa' },
  { c: '#D4D6DB', on: '#15151A', name: 'argento' },
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
