// Navigazione a pila molto semplice: le schede principali stanno sotto, le schermate aperte da un tocco si sovrappongono.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Platform, View } from 'react-native';

export type Route = { id: number; name: string; params?: any };
type NavApi = {
  stack: Route[];
  push: (name: string, params?: any) => void;
  pop: () => void;
  replace: (name: string, params?: any) => void;
  popToRoot: () => void;
};
const NavCtx = createContext<NavApi>({ stack: [], push() {}, pop() {}, replace() {}, popToRoot() {} });
export const useNav = () => useContext(NavCtx);

// Numero che cresce a ogni modifica dei dati: le schermate lo usano per ricaricarsi.
const VerCtx = createContext<{ ver: number; bump: () => void }>({ ver: 0, bump() {} });
export const useVersion = () => useContext(VerCtx);

// Scheda principale attiva: serve per passare da una scheda all'altra anche dall'interno delle schermate
export const TabCtx = createContext<{ tab: string; setTab: (k: string) => void }>({ tab: '', setTab() {} });
export const useTabs = () => useContext(TabCtx);

let nextId = 1;

export function NavProvider({ children, onRootBack }: { children: (api: NavApi) => React.ReactNode; onRootBack?: () => boolean }) {
  const [stack, setStack] = useState<Route[]>([]);
  const [ver, setVer] = useState(0);
  const bump = useCallback(() => setVer((v) => v + 1), []);
  const api = useMemo<NavApi>(() => ({
    stack,
    push: (name, params) => setStack((s) => [...s, { id: nextId++, name, params }]),
    pop: () => setStack((s) => s.slice(0, -1)),
    replace: (name, params) => setStack((s) => [...s.slice(0, -1), { id: nextId++, name, params }]),
    popToRoot: () => setStack([]),
  }), [stack]);

  // tasto indietro di Android
  const ref = useRef(api); ref.current = api;
  useEffect(() => {
    if (Platform.OS !== 'android' || !BackHandler?.addEventListener) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (ref.current.stack.length) { ref.current.pop(); return true; }
      return onRootBack ? onRootBack() : false;
    });
    return () => sub.remove();
  }, []);

  return (
    <VerCtx.Provider value={{ ver, bump }}>
      <NavCtx.Provider value={api}>{children(api)}</NavCtx.Provider>
    </VerCtx.Provider>
  );
}

// Disegna le schermate della pila una sopra l'altra: resta visibile solo l'ultima, le altre conservano il proprio stato.
export function StackView({ stack, screens }: { stack: Route[]; screens: Record<string, React.ComponentType<any>> }) {
  return (
    <>
      {stack.map((r, i) => {
        const C = screens[r.name];
        const top = i === stack.length - 1;
        return (
          <View key={r.id} pointerEvents={top ? 'auto' : 'none'} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: top ? 'flex' : 'none' }}>
            {C ? <C {...(r.params || {})} /> : null}
          </View>
        );
      })}
    </>
  );
}
