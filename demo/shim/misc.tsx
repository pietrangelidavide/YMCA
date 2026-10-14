import React from 'react';
import { View, flatten, toCss } from './rn';

// margini di sicurezza: sul telefono finto simulano l'isola e la barra home, sul computer sono zero
const INS = { top: 47, bottom: 34, left: 0, right: 0, ...((window as any).__DEMO?.insets || {}) };
export const SafeAreaProvider = ({ children }: any) => <>{children}</>;
export const SafeAreaView = ({ style, children }: any) => <View style={[style, { paddingTop: INS.top, paddingBottom: INS.bottom }]}>{children}</View>;
export const useSafeAreaInsets = () => INS;

export const StatusBar = () => null;

// icone: Ionicons -> react-icons/io5
import * as io from 'react-icons/io5';
const miss = new Set<string>();
export const Ionicons = ({ name, size = 24, color = '#000', style }: any) => {
  const key = 'Io' + String(name).split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
  const Cmp = (io as any)[key];
  if (!Cmp) { if (!miss.has(name)) { miss.add(name); console.warn('ICONA MANCANTE', name); } return <View style={[{ width: size, height: size, backgroundColor: '#f0f' }, style]} />; }
  return <Cmp size={size} color={color} style={{ flexShrink: 0, ...flatten(style) }} />;
};

export function LinearGradient({ colors, start, end, locations, style, children }: any) {
  const s = start || { x: 0.5, y: 0 }, e = end || { x: 0.5, y: 1 };
  const ang = (Math.atan2(e.x - s.x, -(e.y - s.y)) * 180) / Math.PI;
  const stops = colors.map((c: string, i: number) => `${c} ${Math.round(((locations?.[i] ?? i / (colors.length - 1)) * 100))}%`).join(',');
  return <View style={[style, { backgroundImage: `linear-gradient(${ang}deg, ${stops})` } as any]}>{children}</View>;
}
export function BlurView({ intensity = 50, tint = 'dark', style, children }: any) {
  return <View style={[style, { backdropFilter: `blur(${intensity / 3}px)`, backgroundColor: tint === 'dark' ? 'rgba(20,20,20,.45)' : 'rgba(255,255,255,.55)' } as any]}>{children}</View>;
}
export const launchImageLibraryAsync = async () => ({ canceled: true, assets: [] });
export const requestMediaLibraryPermissionsAsync = async () => ({ granted: true });
export const useFonts = () => [true, null];
