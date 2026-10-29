// Solo per il controllo dei tipi fuori da Expo: i moduli nativi sono trattati come "any".
declare module 'react-native';
declare module 'react-native-safe-area-context';
declare module 'expo-status-bar';
declare module 'expo-notifications' { const x: any; export = x; }
declare module 'expo-device';
declare module 'expo-constants';
declare module '@expo/vector-icons';
declare module '@react-native-async-storage/async-storage';
declare module '@supabase/supabase-js';
declare module 'react-native-url-polyfill/auto';
declare module 'react/jsx-runtime';
declare namespace JSX { interface IntrinsicElements { [k: string]: any } interface IntrinsicAttributes { key?: any } interface ElementChildrenAttribute { children: {} } }
declare const process: any;
declare module 'react' {
  export type ReactNode = any;
  export type ComponentType<P = any> = (props: P) => any;
  export interface Context<T> { Provider: any; Consumer: any; _t?: T }
  export function useState<T>(init?: T | (() => T)): [T, (v: T | ((p: T) => T)) => void];
  export function useRef<T = any>(init?: T): { current: T };
  export function useMemo<T>(fn: () => T, deps?: any[]): T;
  export function useCallback<T extends (...a: any[]) => any>(fn: T, deps?: any[]): T;
  export function useEffect(fn: () => any, deps?: any[]): void;
  export function useLayoutEffect(fn: () => any, deps?: any[]): void;
  export function useContext<T>(c: Context<T>): T;
  export function createContext<T>(v: T): Context<T>;
  const React: any;
  export default React;
}
declare namespace React { type ReactNode = any; type ComponentType<P = any> = (props: P) => any; }
declare namespace Notifications { type NotificationResponse = any }
declare module '*.png' { const src: any; export default src; }
declare module 'expo-document-picker';
declare module 'expo-image-picker';

declare function require(path: string): any;
