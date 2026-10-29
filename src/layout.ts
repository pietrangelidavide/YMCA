// Misure dello schermo: telefono, tablet o computer. Cambiano la navigazione (barra in basso o laterale) e la larghezza dei contenuti.
import { useWindowDimensions } from 'react-native';

export type LayoutKind = 'phone' | 'tablet' | 'desktop';
export const TABLET_MIN = 700;     // da qui in su: barra laterale a icone
export const DESKTOP_MIN = 1024;   // da qui in su: barra laterale con i nomi
export const SIDE_RAIL = 92;
export const SIDE_FULL = 248;
export const READING_MAX = 760;    // schermate «da leggere»: oggi, scheda, profilo, dettagli
export const WIDE_MAX = 1080;      // elenchi e bacheche

export function layoutOf(width: number, height = 0) {
  const kind: LayoutKind = width >= DESKTOP_MIN ? 'desktop' : width >= TABLET_MIN ? 'tablet' : 'phone';
  const side = kind === 'phone' ? 0 : kind === 'tablet' ? SIDE_RAIL : SIDE_FULL;
  return { kind, width, height, hasSide: kind !== 'phone', side, content: width - side };
}

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return layoutOf(width, height);
}
