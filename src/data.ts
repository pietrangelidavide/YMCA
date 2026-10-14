// Accesso ai dati: tutte le chiamate a Supabase passano da qui, così le schermate restano semplici.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useVersion } from './nav';

export type Role = 'member' | 'trainer' | 'owner';
export type Profile = {
  id: string; first_name: string | null; last_name: string | null; full_name: string | null; phone: string | null; email: string | null;
  role: Role; trainer_id: string | null; goal: string | null; height_cm: number | null; active: boolean; created_at: string;
};
export type Exercise = {
  id: string; name: string; muscle_group: string; equipment: string | null; description: string | null; video_url: string | null; image_url: string | null; active: boolean;
};
export type ExerciseLite = Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment' | 'description' | 'video_url' | 'image_url'>;
export type Item = {
  id?: string; exercise_id: string; exercise: ExerciseLite; sets: number; reps: string; load_hint: string | null; rest_sec: number;
  tempo: string | null; note: string | null; superset: string | null;
};
export type Day = { id?: string; name: string; focus: string | null; items: Item[] };
export type ProgramStatus = 'draft' | 'active' | 'archived';
export type Program = {
  id: string; name: string; goal: string | null; member_id: string | null; trainer_id: string | null; status: ProgramStatus; is_template: boolean;
  starts_on: string | null; weeks: number; notes: string | null; created_at: string; days: Day[];
};
export type ProgramRow = Omit<Program, 'days'>;
export type WorkoutRow = { id: string; member_id: string; program_id: string | null; day_id: string | null; day_name: string | null; started_at: string; finished_at: string | null; rpe: number | null; note: string | null };
export type SetLog = { id?: string; workout_id?: string; exercise_id: string; item_id: string | null; set_no: number; reps: number | null; weight_kg: number | null };
export type Measurement = {
  id: string; member_id: string; measured_on: string; weight_kg: number | null; body_fat_pct: number | null; waist_cm: number | null; chest_cm: number | null;
  hips_cm: number | null; arm_cm: number | null; thigh_cm: number | null; note: string | null;
};
export type Comment = { id: string; program_id: string; author_id: string | null; body: string; created_at: string };
export type MemberRow = {
  id: string; full_name: string | null; phone: string | null; email: string | null; active: boolean; goal: string | null; trainer_id: string | null; trainer_name: string | null;
  program_id: string | null; program_name: string | null; program_ends_on: string | null; last_workout_at: string | null; workouts_30d: number; created_at: string;
};
export type Progress = {
  exercise_id: string; name: string; muscle_group: string; sessions: number; last_at: string; pr_weight: number; pr_e1rm: number;
  series: { at: string; w: number; reps: number }[];
};
export type Stats = {
  members_active: number; members_new: number; members_training: number; workouts: number; without_program: number; expiring: number;
  weekly: { week: string; workouts: number }[]; trainers: { id: string; name: string; members: number }[];
};
export type DraftWorkout = {
  id: string; program_id: string; day_id: string | null; day_name: string; started_at: string;
  sets: { key: string; item_id: string; exercise_id: string; set_no: number; kg: string; reps: string; done: boolean }[];
  note?: string;
};

// ───────── Errori comprensibili ─────────

const MESSAGES: Record<string, string> = {
  forbidden: 'Operazione non consentita.',
  not_found: 'Elemento non trovato.',
  name_required: 'Scrivi un nome.',
  login_required: 'Accedi per continuare.',
  owner_required: 'Serve almeno un titolare: nomina prima un altro titolare.',
};
export function errText(e: any): string {
  const m = String(e?.message || e || '');
  for (const k of Object.keys(MESSAGES)) if (m.includes(k)) return MESSAGES[k];
  if (/duplicate key|exercises_name_uq/i.test(m)) return 'Esiste già un elemento con questo nome.';
  if (/programs_one_active/i.test(m)) return 'Il socio ha già una scheda attiva.';
  if (/fetch|network|failed to/i.test(m)) return 'Connessione assente. Riprova tra poco.';
  if (/password/i.test(m) && /short|least|weak/i.test(m)) return 'La password è troppo corta (almeno 6 caratteri).';
  return m || 'Qualcosa non ha funzionato.';
}
export const isNetworkError = (e: any) => !!e && (!e.code || /fetch|network/i.test(String(e.message || '')));

function ok<T>(r: { data: T | null; error: any }): T {
  if (r.error) throw r.error;
  return r.data as T;
}

// ───────── Caricamento nelle schermate ─────────

export function useAsync<T>(fn: () => Promise<T>, deps: any[] = []) {
  const { ver, bump } = useVersion();
  const [st, setSt] = useState<{ data?: T; error?: any; loading: boolean }>({ loading: true });
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = useCallback(() => {
    setSt((s) => ({ ...s, loading: true, error: undefined }));
    fn().then((data) => alive.current && setSt({ data, loading: false })).catch((error) => alive.current && setSt((s) => ({ data: s.data, error, loading: false })));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(run, [run, ver]);
  return { ...st, reload: run, bump };
}

// ───────── Profilo e staff ─────────

let staffCache: { id: string; full_name: string; role: Role }[] | null = null;

export const api = {
  async profile(uid: string): Promise<Profile | null> {
    return ok(await supabase.from('profiles').select('*').eq('id', uid).maybeSingle());
  },
  async updateProfile(id: string, patch: Partial<Profile>) {
    ok(await supabase.from('profiles').update(patch).eq('id', id));
  },
  async staff() {
    if (!staffCache) staffCache = ok(await supabase.rpc('staff_directory')) as any;
    return staffCache!;
  },
  clearStaffCache() { staffCache = null; },
  async deleteAccount() { ok(await supabase.rpc('delete_my_account')); },
  async checkJoinCode(code: string): Promise<boolean> {
    const r = await supabase.rpc('check_join_code', { p_code: code });
    if (r.error) throw r.error;
    return !!r.data;
  },

  // ───── Esercizi ─────
  async exercises(): Promise<Exercise[]> {
    return ok(await supabase.from('exercises').select('*').eq('active', true).order('name')) as Exercise[];
  },
  async allExercises(): Promise<Exercise[]> {
    return ok(await supabase.from('exercises').select('*').order('name')) as Exercise[];
  },
  async saveExercise(e: Partial<Exercise> & { name: string; muscle_group: string }) {
    const row = { name: e.name.trim(), muscle_group: e.muscle_group, equipment: e.equipment?.trim() || null, description: e.description?.trim() || null, video_url: e.video_url?.trim() || null, active: e.active ?? true };
    if (e.id) ok(await supabase.from('exercises').update(row).eq('id', e.id));
    else ok(await supabase.from('exercises').insert(row));
  },

  // ───── Schede ─────
  async activeProgram(): Promise<Program | null> {
    return ok(await supabase.rpc('my_active_program')) as any;
  },
  async program(id: string): Promise<Program | null> {
    return ok(await supabase.rpc('program_json', { p_id: id })) as any;
  },
  async programsOf(memberId: string): Promise<ProgramRow[]> {
    return ok(await supabase.from('programs').select('*').eq('member_id', memberId).order('created_at', { ascending: false })) as ProgramRow[];
  },
  async templates(): Promise<ProgramRow[]> {
    return ok(await supabase.from('programs').select('*').eq('is_template', true).order('name')) as ProgramRow[];
  },
  // bozze dei soci (schede preparate ma non ancora attivate)
  async drafts(): Promise<ProgramRow[]> {
    return ok(await supabase.from('programs').select('*').eq('is_template', false).eq('status', 'draft').order('created_at', { ascending: false }).limit(50)) as ProgramRow[];
  },
  async saveProgram(p: any): Promise<string> {
    return ok(await supabase.rpc('save_program', { p })) as string;
  },
  async copyProgram(source: string, member: string | null, asTemplate: boolean, name?: string): Promise<string> {
    return ok(await supabase.rpc('copy_program', { p_source: source, p_member: member, p_as_template: asTemplate, p_name: name ?? null })) as string;
  },
  async activateProgram(id: string, startsOn?: string | null) {
    ok(await supabase.rpc('activate_program', { p_id: id, p_starts_on: startsOn ?? null }));
  },
  async archiveProgram(id: string) { ok(await supabase.rpc('archive_program', { p_id: id })); },
  async deleteProgram(id: string) { ok(await supabase.from('programs').delete().eq('id', id)); },

  // ───── Messaggi ─────
  async comments(programId: string): Promise<Comment[]> {
    return ok(await supabase.from('program_comments').select('*').eq('program_id', programId).order('created_at')) as Comment[];
  },
  async addComment(programId: string, authorId: string, body: string) {
    ok(await supabase.from('program_comments').insert({ program_id: programId, author_id: authorId, body: body.trim() }));
  },

  // ───── Allenamenti ─────
  async workouts(memberId: string, limit = 60): Promise<WorkoutRow[]> {
    return ok(await supabase.from('workouts').select('*').eq('member_id', memberId).order('started_at', { ascending: false }).limit(limit)) as WorkoutRow[];
  },
  async workoutSets(workoutId: string): Promise<SetLog[]> {
    return ok(await supabase.from('set_logs').select('*').eq('workout_id', workoutId).order('set_no')) as SetLog[];
  },
  async lastSets(exerciseIds: string[]): Promise<{ exercise_id: string; set_no: number; reps: number | null; weight_kg: number | null; at: string }[]> {
    if (!exerciseIds.length) return [];
    return ok(await supabase.rpc('last_sets', { p_exercises: exerciseIds })) as any;
  },
  async progress(memberId?: string): Promise<Progress[]> {
    return ok(await supabase.rpc('progress_summary', { p_member: memberId ?? null })) as any;
  },

  // ───── Misure ─────
  async measurements(memberId: string): Promise<Measurement[]> {
    return ok(await supabase.from('measurements').select('*').eq('member_id', memberId).order('measured_on', { ascending: false })) as Measurement[];
  },
  async saveMeasurement(m: Partial<Measurement> & { member_id: string }, by: string) {
    ok(await supabase.from('measurements').upsert({ ...m, created_by: by }, { onConflict: 'member_id,measured_on' }));
  },
  async deleteMeasurement(id: string) { ok(await supabase.from('measurements').delete().eq('id', id)); },

  // ───── Staff ─────
  async members(): Promise<MemberRow[]> {
    return ok(await supabase.rpc('members_overview')) as MemberRow[];
  },
  async stats(days = 30): Promise<Stats> {
    return ok(await supabase.rpc('gym_stats', { p_days: days })) as Stats;
  },
  async notes(memberId: string): Promise<{ id: string; body: string; author_id: string | null; created_at: string }[]> {
    return ok(await supabase.from('staff_notes').select('*').eq('member_id', memberId).order('created_at', { ascending: false })) as any;
  },
  async addNote(memberId: string, authorId: string, body: string) {
    ok(await supabase.from('staff_notes').insert({ member_id: memberId, author_id: authorId, body: body.trim() }));
  },
  async staffProfiles(): Promise<Profile[]> {
    return ok(await supabase.from('profiles').select('*').in('role', ['trainer', 'owner']).order('first_name')) as Profile[];
  },
  async setRole(id: string, role: Role) { ok(await supabase.from('profiles').update({ role }).eq('id', id)); staffCache = null; },
  async gym(): Promise<{ name: string; join_code: string | null } | null> {
    return ok(await supabase.from('gym_settings').select('*').maybeSingle()) as any;
  },
  async saveGym(patch: { name?: string; join_code?: string | null }) {
    ok(await supabase.from('gym_settings').update(patch).eq('id', 1));
  },
};

// ───────── Invio degli allenamenti: se manca la rete si accodano e partono appena possibile ─────────

const PENDING = 'pending-workouts';
const DRAFT = 'draft-workout';

async function readPending(): Promise<any[]> {
  try { return JSON.parse((await AsyncStorage.getItem(PENDING)) || '[]'); } catch { return []; }
}
export async function pendingCount() { return (await readPending()).length; }

// true = salvato subito, false = in coda
export async function sendWorkout(payload: any): Promise<boolean> {
  const r = await supabase.rpc('save_workout', { p: payload });
  if (!r.error) { void flushPending(); return true; }
  if (isNetworkError(r.error)) {
    const q = await readPending();
    await AsyncStorage.setItem(PENDING, JSON.stringify([...q.filter((x) => x.id !== payload.id), payload]));
    return false;
  }
  throw r.error;
}
let flushing = false;
export async function flushPending(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const q = await readPending();
    const left: any[] = [];
    for (const p of q) {
      const r = await supabase.rpc('save_workout', { p });
      if (!r.error) sent++;
      else if (isNetworkError(r.error)) left.push(p);
      // errore non di rete (dati non validi): l'allenamento si scarta per non bloccare la coda
    }
    await AsyncStorage.setItem(PENDING, JSON.stringify(left));
  } catch {
    /* si riprova alla prossima occasione */
  } finally {
    flushing = false;
  }
  return sent;
}

export async function loadDraft(): Promise<DraftWorkout | null> {
  try { const v = await AsyncStorage.getItem(DRAFT); return v ? JSON.parse(v) : null; } catch { return null; }
}
export async function saveDraft(d: DraftWorkout | null) {
  try { if (d) await AsyncStorage.setItem(DRAFT, JSON.stringify(d)); else await AsyncStorage.removeItem(DRAFT); } catch { /* ignora */ }
}

// ───────── Elenco esercizi condiviso ─────────

export function useExercises() {
  return useAsync(() => api.exercises(), []);
}
