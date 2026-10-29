// expo-video nel browser: un normale <video> con i comandi del sistema
import React from 'react';
import { flatten } from './rn';

export const useVideoPlayer = (src: string, setup?: (p: any) => void) => {
  const p = React.useMemo(() => { const o: any = { src, loop: false }; setup?.(o); return o; }, [src]);
  return p;
};
export function VideoView({ player, style, nativeControls, contentFit, accessibilityLabel }: any) {
  const st = flatten(style);
  return (
    <video src={player?.src} controls={nativeControls !== false} playsInline loop={!!player?.loop} aria-label={accessibilityLabel}
      style={{ display: 'block', width: st.width ?? '100%', height: st.height ?? 'auto', background: '#000', objectFit: contentFit === 'cover' ? 'cover' : 'contain' }} />
  );
}
