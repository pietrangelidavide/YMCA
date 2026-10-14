// Notifiche finte per la demo: nel browser non arrivano.
export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export async function pushState(): Promise<PushState> { return 'unavailable'; }
export async function registerForPush(_ask = false): Promise<PushState> { return 'unavailable'; }
export function onNotificationOpen(_cb: (data: any) => void): () => void { return () => {}; }
