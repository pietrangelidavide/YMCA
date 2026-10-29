// File scelti o registrati dal telefono (PDF e video) e Supabase Storage: carica, apri, elimina.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { uuid } from './util';

export type Picked = { uri: string; name: string; size: number | null; type: string };
export const MAX_PDF = 2 * 1024 * 1024;       // documenti: 2 MB
export const MAX_VIDEO = 50 * 1024 * 1024;    // video degli esercizi: 50 MB (limite del piano gratuito di Supabase)
export const VIDEO_SECONDS = 30;              // durata massima di un video registrato

export async function pickPdf(): Promise<Picked | null> {
  const r: any = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  const a = r.assets?.[0];
  if (r.canceled || !a) return null;
  return { uri: a.uri, name: a.name || 'documento.pdf', size: a.size ?? null, type: 'application/pdf' };
}

// Opzioni comuni: video corto e leggero (su iPhone converte in H.264, che si guarda ovunque)
const videoOptions = (): any => ({
  mediaTypes: ['videos'],
  videoMaxDuration: VIDEO_SECONDS,
  allowsEditing: false,
  videoExportPreset: (ImagePicker as any).VideoExportPreset?.H264_960x540,
});

const asVideo = (r: any): Picked | null => {
  const a = r.assets?.[0];
  if (r.canceled || !a) return null;
  const type = String(a.mimeType || '').startsWith('video/') ? a.mimeType : /\.mov$/i.test(a.uri || '') ? 'video/quicktime' : /\.webm$/i.test(a.uri || '') ? 'video/webm' : 'video/mp4';
  return { uri: a.uri, name: a.fileName || `video.${videoExt(type)}`, size: a.fileSize ?? null, type };
};

// Registra un video con la fotocamera del telefono (chiede il permesso la prima volta)
export async function captureVideo(): Promise<Picked | null> {
  const perm: any = await ImagePicker.requestCameraPermissionsAsync();
  if (perm && perm.granted === false) throw new Error('camera_denied');
  return asVideo(await ImagePicker.launchCameraAsync(videoOptions()));
}

// Sceglie un video già presente nella galleria
export async function pickVideo(): Promise<Picked | null> {
  return asVideo(await ImagePicker.launchImageLibraryAsync(videoOptions()));
}

export const videoExt = (type: string): string => (/quicktime/i.test(type) ? 'mov' : /webm/i.test(type) ? 'webm' : 'mp4');

// Carica il file e restituisce i byte caricati
export async function uploadFile(bucket: 'documents' | 'exercise-videos', path: string, file: Picked): Promise<number> {
  const bytes = await (await fetch(file.uri)).arrayBuffer();
  if (bytes.byteLength > (bucket === 'documents' ? MAX_PDF : MAX_VIDEO)) throw new Error(bucket === 'documents' ? 'payload too large' : 'video_too_large');
  const r = await supabase.storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
  if (r.error) throw r.error;
  return bytes.byteLength;
}

export const publicUrl = (bucket: string, path: string): string => supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl;

export async function signedUrl(bucket: string, path: string, seconds = 300): Promise<string> {
  const r = await supabase.storage.from(bucket).createSignedUrl(path, seconds);
  if (r.error || !r.data?.signedUrl) throw r.error || new Error('Documento non disponibile.');
  return r.data.signedUrl;
}

export async function removeFile(bucket: string, path: string): Promise<void> {
  try { await supabase.storage.from(bucket).remove([path]); } catch { /* il file resta orfano ma non visibile */ }
}

// ───────── Video degli esercizi ─────────

// Un video «dell'app» sta nel contenitore exercise-videos; tutto il resto è un link esterno (YouTube…)
export const isHostedVideo = (url?: string | null): boolean => !!url && url.includes('/exercise-videos/');
const hostedPath = (url?: string | null): string | null => {
  const m = /\/exercise-videos\/([^?#]+)/.exec(url || '');
  return m ? decodeURIComponent(m[1]) : null;
};

// Carica il video e restituisce l'indirizzo da salvare sull'esercizio
export async function storeVideo(p: Picked): Promise<string> {
  const path = `${uuid()}.${videoExt(p.type)}`;
  await uploadFile('exercise-videos', path, p);
  return publicUrl('exercise-videos', path);
}

// Toglie dallo Storage un video sostituito o eliminato (se era un link esterno non fa nulla)
export async function removeHostedVideo(url?: string | null): Promise<void> {
  const path = isHostedVideo(url) ? hostedPath(url) : null;
  if (path) await removeFile('exercise-videos', path);
}
