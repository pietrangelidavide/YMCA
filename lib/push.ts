import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Mostra le notifiche anche con l'app aperta
Notifications.setNotificationHandler({
  handleNotification: async () =>
    ({ shouldShowAlert: true, shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }) as any,
});

export type PushState = 'granted' | 'denied' | 'undetermined' | 'unavailable';

export async function pushState(): Promise<PushState> {
  try {
    if (!Device.isDevice) return 'unavailable';
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted' ? 'granted' : status === 'denied' ? 'denied' : 'undetermined';
  } catch {
    return 'unavailable';
  }
}

// Salva il token del dispositivo per l'utente connesso. Con ask = true chiede anche il permesso (da un tocco dell'utente);
// senza, registra solo se il permesso è già stato dato, così non compaiono richieste a sorpresa.
export async function registerForPush(ask = false): Promise<PushState> {
  try {
    if (!Device.isDevice) return 'unavailable'; // niente push sui simulatori

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Avvisi',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted' && ask) status = (await Notifications.requestPermissionsAsync()).status;
    if (status !== 'granted') return status === 'denied' ? 'denied' : 'undetermined';

    const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await supabase.rpc('register_push_token', { p_token: token, p_platform: Platform.OS });
    return 'granted';
  } catch (e) {
    console.log('Notifiche push non attivate:', e);
    return 'unavailable';
  }
}

// Tocco su una notifica (anche quella che ha aperto l'app da chiusa): passa i dati allegati, es. { type: 'comment', programId }.
// Ogni notifica viene gestita una volta sola. Restituisce la funzione per smettere di ascoltare.
const handled = new Set<string>();
export function onNotificationOpen(cb: (data: any) => void): () => void {
  try {
    const run = (r: Notifications.NotificationResponse | null | undefined) => {
      const id = r?.notification?.request?.identifier;
      if (!r || !id || handled.has(id)) return;
      handled.add(id);
      cb(r.notification.request.content.data ?? {});
    };
    const sub = Notifications.addNotificationResponseReceivedListener(run);
    Promise.resolve(Notifications.getLastNotificationResponseAsync()).then(run).catch(() => {});
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
