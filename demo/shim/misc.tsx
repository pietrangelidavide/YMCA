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
// Selettore PDF (expo-document-picker): nella demo «sceglie» sempre lo stesso PDF di prova
export const getDocumentAsync = async () => {
  const text = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
    + '4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 60 Td (Documento caricato dalla demo) Tj ET\nendstream endobj\n'
    + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF';
  const blob = new Blob([text], { type: 'application/pdf' });
  return { canceled: false, assets: [{ uri: URL.createObjectURL(blob), name: 'Piano-alimentare.pdf', size: blob.size, mimeType: 'application/pdf' }] };
};
// Selettore immagini: nella demo «sceglie» un'immagine disegnata al volo
export const launchImageLibraryAsync = async (o?: any) => {
  if (JSON.stringify(o?.mediaTypes || '').includes('video')) return { canceled: false, assets: [await sampleVideo()] };
  const c = document.createElement('canvas');
  c.width = 640; c.height = 480;
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 640, 480);
  gr.addColorStop(0, '#2a2a2e'); gr.addColorStop(1, '#E21D23');
  g.fillStyle = gr; g.fillRect(0, 0, 640, 480);
  g.fillStyle = 'rgba(255,255,255,.9)'; g.font = '700 34px sans-serif'; g.textAlign = 'center';
  g.fillText('Immagine di prova', 320, 250);
  const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/jpeg', 0.8));
  return { canceled: false, assets: [{ uri: URL.createObjectURL(blob), fileName: 'foto-esercizio.jpg', fileSize: blob.size, mimeType: 'image/jpeg' }] };
};
export const requestMediaLibraryPermissionsAsync = async () => ({ granted: true });
export const useFonts = () => [true, null];

// Fotocamera: nella demo «registra» un breve video disegnato al volo (con MediaRecorder, se il browser lo ha)
const sampleVideo = async (): Promise<{ uri: string; mimeType: string; fileSize: number; fileName: string }> => {
  const c = document.createElement('canvas');
  c.width = 360; c.height = 640;
  const g = c.getContext('2d')!;
  const draw = (t: number) => {
    const gr = g.createLinearGradient(0, 0, 360, 640);
    gr.addColorStop(0, '#26262A'); gr.addColorStop(1, '#E21D23');
    g.fillStyle = gr; g.fillRect(0, 0, 360, 640);
    g.fillStyle = 'rgba(255,255,255,.92)'; g.textAlign = 'center';
    g.font = '700 26px sans-serif'; g.fillText('Video di prova', 180, 150);
    g.font = '400 18px sans-serif'; g.fillText('registrato dalla demo', 180, 182);
    // un'asta che sale e scende, come un bilanciere
    const y = 330 + Math.sin(t / 350) * 110;
    g.fillStyle = '#fff'; g.fillRect(70, y, 220, 10);
    g.fillRect(52, y - 30, 18, 70); g.fillRect(290, y - 30, 18, 70);
  };
  const stream: MediaStream | undefined = (c as any).captureStream?.(25);
  const MR: any = (window as any).MediaRecorder;
  if (!stream || !MR) return { uri: URL.createObjectURL(new Blob([new Uint8Array(8)], { type: 'video/webm' })), mimeType: 'video/webm', fileSize: 8, fileName: 'video-prova.webm' };
  const chunks: Blob[] = [];
  const rec = new MR(stream, { mimeType: MR.isTypeSupported?.('video/webm;codecs=vp8') ? 'video/webm;codecs=vp8' : 'video/webm' });
  rec.ondataavailable = (e: any) => { if (e.data?.size) chunks.push(e.data); };
  const done = new Promise<void>((r) => { rec.onstop = () => r(); });
  const t0 = performance.now();
  let raf = 0;
  const loop = () => { draw(performance.now() - t0); raf = requestAnimationFrame(loop); };
  loop(); rec.start();
  await new Promise((r) => setTimeout(r, 2200));
  cancelAnimationFrame(raf); rec.stop(); await done;
  const blob = new Blob(chunks, { type: 'video/webm' });
  return { uri: URL.createObjectURL(blob), mimeType: 'video/webm', fileSize: blob.size, fileName: 'video-prova.webm' };
};
export const launchCameraAsync = async () => ({ canceled: false, assets: [await sampleVideo()] });
export const requestCameraPermissionsAsync = async () => ({ granted: true });
export const VideoExportPreset = { H264_960x540: 5 };
