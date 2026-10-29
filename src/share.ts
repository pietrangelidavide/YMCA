// Condivisione di un elenco in formato CSV (si apre in Excel): su telefono con il pannello di condivisione, sul web come file scaricato.
import { Platform, Share } from 'react-native';

export async function shareCsv(filename: string, csv: string): Promise<void> {
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
  await Share.share({ title: filename, message: csv });
}

// Condivide un testo (invito, messaggio): pannello di condivisione del telefono; sul web la condivisione del browser o, in mancanza, la copia negli appunti.
export async function shareText(message: string): Promise<'shared' | 'copied'> {
  if (Platform.OS === 'web') {
    const nav: any = typeof navigator !== 'undefined' ? navigator : null;
    if (nav?.share) { try { await nav.share({ text: message }); return 'shared'; } catch (e: any) { if (e?.name === 'AbortError') return 'shared'; } }
    if (nav?.clipboard?.writeText) { await nav.clipboard.writeText(message); return 'copied'; }
    throw new Error('Condivisione non disponibile su questo browser.');
  }
  await Share.share({ message });
  return 'shared';
}
