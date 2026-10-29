// File scelti dal telefono (PDF e immagini) e Supabase Storage: carica, apri, elimina.
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';

export type Picked = { uri: string; name: string; size: number | null; type: string };
export const MAX_PDF = 2 * 1024 * 1024;     // documenti: 2 MB
export const MAX_IMAGE = 5 * 1024 * 1024;   // immagini degli esercizi: 5 MB

export async function pickPdf(): Promise<Picked | null> {
  const r: any = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  const a = r.assets?.[0];
  if (r.canceled || !a) return null;
  return { uri: a.uri, name: a.name || 'documento.pdf', size: a.size ?? null, type: 'application/pdf' };
}

export async function pickImage(): Promise<Picked | null> {
  const r: any = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [4, 3], quality: 0.6 });
  const a = r.assets?.[0];
  if (r.canceled || !a) return null;
  return { uri: a.uri, name: a.fileName || 'immagine.jpg', size: a.fileSize ?? null, type: a.mimeType || 'image/jpeg' };
}

// Carica il file e restituisce i byte caricati
export async function uploadFile(bucket: 'documents' | 'exercise-media', path: string, file: Picked): Promise<number> {
  const bytes = await (await fetch(file.uri)).arrayBuffer();
  if (bytes.byteLength > (bucket === 'documents' ? MAX_PDF : MAX_IMAGE)) throw new Error('payload too large');
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
