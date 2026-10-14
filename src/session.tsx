// Utente connesso: sessione di Supabase + profilo (ruolo, PT, obiettivo).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { api, flushPending, Profile, Role } from './data';

type Ctx = {
  ready: boolean;
  userId: string | null;
  profile: Profile | null;
  role: Role | null;
  isStaff: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  patchProfile: (p: Partial<Profile>) => Promise<void>;
};
const SessionCtx = createContext<Ctx>({ ready: false, userId: null, profile: null, role: null, isStaff: false, refresh: async () => {}, signOut: async () => {}, patchProfile: async () => {} });
export const useSession = () => useContext(SessionCtx);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const load = useCallback(async (uid: string | null) => {
    setUserId(uid);
    if (!uid) { setProfile(null); setReady(true); return; }
    try {
      let p = await api.profile(uid);
      if (!p) { await new Promise((r) => setTimeout(r, 700)); p = await api.profile(uid); } // il profilo nasce un attimo dopo la registrazione
      setProfile(p);
      void flushPending(); // invia gli allenamenti rimasti in coda senza rete
    } catch {
      setProfile(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => load(data.session?.user?.id ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, session) => { void load(session?.user?.id ?? null); });
    return () => data.subscription.unsubscribe();
  }, [load]);

  const value = useMemo<Ctx>(() => ({
    ready, userId, profile,
    role: profile?.role ?? null,
    isStaff: profile?.role === 'trainer' || profile?.role === 'owner',
    refresh: async () => { if (userId) setProfile(await api.profile(userId)); },
    signOut: async () => { api.clearStaffCache(); await supabase.auth.signOut(); },
    patchProfile: async (patch) => {
      if (!userId) return;
      await api.updateProfile(userId, patch);
      setProfile((p) => (p ? { ...p, ...patch, full_name: [patch.first_name ?? p.first_name, patch.last_name ?? p.last_name].filter(Boolean).join(' ') } : p));
    },
  }), [ready, userId, profile]);

  return <SessionCtx.Provider value={value}>{children}</SessionCtx.Provider>;
}
