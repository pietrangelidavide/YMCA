// Database finto per la demo: stesse tabelle e funzioni che usa l'app, con i dati di prova di data.ts.
import { addDays, isoDay, parseDay } from '../../src/util';
import { DB, GYM, JOIN_CODE, Row, uid } from './data';

const Q = new URLSearchParams(location.search);
const DEMO_USERS: Record<string, string> = { member: 'u-member', trainer: 'u-trainer', owner: 'u-owner' };
const DEMO_EMAILS: Record<string, string> = { 'socio@demo.it': 'u-member', 'pt@demo.it': 'u-trainer', 'titolare@demo.it': 'u-owner' };

let session: any = null;
const listeners = new Set<(e: string, s: any) => void>();
const userOf = (id: string) => ({ id, email: DB.profiles.find((p) => p.id === id)?.email });
const setSession = (id: string | null, ev: string) => {
  session = id ? { user: userOf(id) } : null;
  listeners.forEach((cb) => cb(ev, session));
};
const login = Q.get('login') || '';
if (DEMO_USERS[login]) session = { user: userOf(DEMO_USERS[login]) };
const me = (): string | null => session?.user?.id ?? null;
const myRole = (): string | null => DB.profiles.find((p) => p.id === me())?.role ?? null;
const isStaff = () => myRole() === 'trainer' || myRole() === 'owner';
const err = (message: string) => { throw { message }; };

// ───────── Query builder ─────────
const get = (r: Row, path: string): any[] => {
  let cur: any[] = [r];
  for (const k of path.split('.')) cur = cur.flatMap((x) => { const v = x?.[k]; return Array.isArray(v) ? v : [v]; });
  return cur;
};
const STAFF_WRITE = new Set(['documents', 'document_members', 'anamnesis', 'courses', 'skinfolds', 'bia_scans', 'activities', 'push_announcements']);
const canRead = (t: string, r: Row): boolean => {
  if (isStaff()) return true;
  switch (t) {
    case 'anamnesis': case 'push_announcements': return false;
    case 'documents': return !!r.visible_to_member && DB.document_members.some((l) => l.document_id === r.id && l.member_id === me());
    case 'document_members': case 'training_prefs': case 'skinfolds': case 'bia_scans': case 'activities': return r.member_id === me();
    default: return true;
  }
};
const fullName = (r: Row) => { if ('first_name' in r || 'last_name' in r) r.full_name = [r.first_name, r.last_name].filter(Boolean).join(' '); };
const now = () => new Date().toISOString();

class Qb {
  op = 'select'; f: ((r: Row) => boolean)[] = []; ord: [string, boolean] | null = null; lim: number | null = null; patch: any = null; one: string | null = null; conflict: string[] | null = null;
  constructor(public t: string) {}
  select(_c?: string) { return this; }
  eq(c: string, v: any) { this.f.push((r) => get(r, c).some((x) => x === v)); return this; }
  in(c: string, l: any[]) { this.f.push((r) => get(r, c).some((x) => l.includes(x))); return this; }
  order(c: string, o?: any) { this.ord = [c, o?.ascending !== false]; return this; }
  limit(n: number) { this.lim = n; return this; }
  single() { this.one = 'single'; return this; }
  maybeSingle() { this.one = 'maybe'; return this; }
  insert(row: any) { this.op = 'insert'; this.patch = row; return this; }
  upsert(row: any, o?: any) { this.op = 'upsert'; this.patch = row; this.conflict = o?.onConflict ? String(o.onConflict).split(',') : null; return this; }
  update(p: any) { this.op = 'update'; this.patch = p; return this; }
  delete() { this.op = 'delete'; return this; }
  run(): any {
    try {
      const all = (DB[this.t] ??= []);
      // permessi di riga come nel database vero: documenti, anamnesi e avvisi non li legge chiunque
      if (this.op !== 'select' && STAFF_WRITE.has(this.t) && !isStaff()) err(`new row violates row-level security policy for table "${this.t}"`);
      if (this.op !== 'select' && this.t === 'training_prefs' && !isStaff() && (Array.isArray(this.patch) ? this.patch : [this.patch]).some((r: Row) => r?.member_id && r.member_id !== me())) err('new row violates row-level security policy for table "training_prefs"');
      const rows0 = all.filter((r) => canRead(this.t, r) && this.f.every((fn) => fn(r)));
      if (this.op === 'update') {
        if (this.t === 'profiles' && 'role' in this.patch && myRole() !== 'owner') err('forbidden');
        if (this.t === 'profiles' && 'role' in this.patch && this.patch.role !== 'owner' && rows0.some((r) => r.role === 'owner')
          && DB.profiles.filter((p) => p.role === 'owner').length < 2) err('owner_required');
        rows0.forEach((r) => { Object.assign(r, this.patch); fullName(r); });
        return { data: null, error: null };
      }
      if (this.op === 'insert' || this.op === 'upsert') {
        const list = Array.isArray(this.patch) ? this.patch : [this.patch];
        for (const row of list) {
          if (this.t === 'exercises' && all.some((e) => e.name.toLowerCase() === String(row.name).toLowerCase())) err('duplicate key value violates unique constraint "exercises_name_uq"');
          if (this.t === 'courses' && all.some((e) => e.name.toLowerCase() === String(row.name).toLowerCase())) err('duplicate key value violates unique constraint "courses_name_uq"');
          const hit = this.op === 'upsert' && this.conflict ? all.find((r) => this.conflict!.every((k) => r[k] === row[k])) : null;
          if (hit) Object.assign(hit, row);
          else all.push({ id: uid(), created_at: now(), ...(this.t === 'exercises' ? { active: true, image_url: null } : {}), ...row });
        }
        return { data: null, error: null };
      }
      if (this.op === 'delete') {
        DB[this.t] = all.filter((r) => !rows0.includes(r));
        if (this.t === 'documents') DB.document_members = DB.document_members.filter((l) => !rows0.some((d) => d.id === l.document_id));
        if (this.t === 'courses') DB.program_items.forEach((i) => { if (rows0.some((c) => c.id === i.course_id)) i.course_id = null; });
        if (this.t === 'programs') {
          const ids = rows0.map((r) => r.id);
          const dd = DB.program_days.filter((d) => ids.includes(d.program_id)).map((d) => d.id);
          DB.program_items = DB.program_items.filter((i) => !dd.includes(i.day_id));
          DB.program_days = DB.program_days.filter((d) => !ids.includes(d.program_id));
          DB.workouts.forEach((w) => { if (ids.includes(w.program_id)) { w.program_id = null; w.day_id = null; } });
        }
        return { data: null, error: null };
      }
      let rows = rows0;
      if (this.ord) { const [c, asc] = this.ord; rows = [...rows].sort((a, b) => (a[c] > b[c] ? 1 : a[c] < b[c] ? -1 : 0) * (asc ? 1 : -1)); }
      if (this.lim != null) rows = rows.slice(0, this.lim);
      rows = rows.map((r) => ({ ...r }));
      if (this.one) return { data: rows[0] ?? null, error: this.one === 'single' && !rows[0] ? { message: 'no rows' } : null };
      return { data: rows, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
  then(res: any, rej: any) { return new Promise((r) => setTimeout(() => r(this.run()), 15)).then(res, rej); }
}

// ───────── Funzioni (RPC) ─────────
const exLite = (id: string) => {
  const e = DB.exercises.find((x) => x.id === id)!;
  return { id: e.id, name: e.name, muscle_group: e.muscle_group, category: e.category, equipment: e.equipment, description: e.description, video_url: e.video_url, image_url: e.image_url };
};
// riga della scheda: esercizio vero, oppure tecnica / lezione di un corso / recupero (senza esercizio)
const itemOut = (i: Row) => {
  const c = i.course_id ? DB.courses.find((x) => x.id === i.course_id) : null;
  return { ...i, exercise: i.exercise_id ? exLite(i.exercise_id) : null, course: c ? { id: c.id, name: c.name, category: c.category, duration_min: c.duration_min } : null };
};
const canSee = (p: Row) => isStaff() || p.member_id === me();
function programJson(id: string) {
  const p = DB.programs.find((x) => x.id === id);
  if (!p || !canSee(p)) return null;
  const ds = DB.program_days.filter((d) => d.program_id === id).sort((a, b) => a.position - b.position)
    .map((d) => ({ ...d, items: DB.program_items.filter((i) => i.day_id === d.id).sort((a, b) => a.position - b.position).map(itemOut) }));
  return { ...p, days: ds };
}
const nn = (s: any) => { const v = s === null || s === undefined ? '' : String(s).trim(); return v === '' ? null : v; };

function saveProgram(p: any) {
  if (!isStaff()) err('forbidden');
  if (!nn(p.name)) err('name_required');
  let id: string = p.id;
  if (nn(p.notes) && String(p.notes).length > 1500) err('programs_notes_len');
  const meta = () => ({ objective: nn(p.objective), level: nn(p.level), target: nn(p.target) || 'tutti', auto_archive: !!p.auto_archive, course_ids: p.course_ids || [] });
  if (!id) {
    id = uid();
    DB.programs.push({ id, name: nn(p.name), goal: nn(p.goal), member_id: p.member_id || null, trainer_id: nn(p.trainer_id) || me(), status: 'draft', is_template: !!p.is_template, starts_on: p.starts_on || null, weeks: Number(p.weeks) || 4, notes: nn(p.notes), created_at: now(), template_id: null, ...meta() });
  } else {
    const r = DB.programs.find((x) => x.id === id);
    if (!r) err('not_found');
    Object.assign(r, { name: nn(p.name), goal: nn(p.goal), starts_on: p.starts_on || null, weeks: Number(p.weeks) || r!.weeks, notes: nn(p.notes), trainer_id: nn(p.trainer_id) || r!.trainer_id, ...meta() });
  }
  const keepDays: string[] = [], keepItems: string[] = [];
  (p.days || []).forEach((d: any, di: number) => {
    let did: string = d.id;
    const ex = did && DB.program_days.find((x) => x.id === did && x.program_id === id);
    if (ex) Object.assign(ex, { position: di + 1, name: nn(d.name) || `Giorno ${di + 1}`, focus: nn(d.focus) });
    else { did = uid(); DB.program_days.push({ id: did, program_id: id, position: di + 1, name: nn(d.name) || `Giorno ${di + 1}`, focus: nn(d.focus) }); }
    keepDays.push(did);
    (d.items || []).forEach((it: any, ii: number) => {
      let iid: string = it.id;
      const kind = nn(it.kind) || 'exercise';
      if (kind === 'exercise' && !nn(it.exercise_id)) err('exercise_required');
      const row = { day_id: did, position: ii + 1, kind, title: nn(it.title), course_id: nn(it.course_id), exercise_id: kind === 'exercise' ? it.exercise_id : null, sets: Number(it.sets) || (kind === 'exercise' ? 3 : 1), reps: kind === 'exercise' ? nn(it.reps) || '10' : String(it.reps ?? ''), load_hint: nn(it.load_hint), rest_sec: it.rest_sec === null || it.rest_sec === undefined ? 60 : Number(it.rest_sec), tempo: nn(it.tempo), note: nn(it.note), superset: nn(it.superset) };
      const old = iid && DB.program_items.find((x) => x.id === iid);
      if (old) Object.assign(old, row); else { iid = uid(); DB.program_items.push({ id: iid, ...row }); }
      keepItems.push(iid);
    });
  });
  const dayIds = DB.program_days.filter((d) => d.program_id === id).map((d) => d.id);
  DB.program_items = DB.program_items.filter((i) => !dayIds.includes(i.day_id) || keepItems.includes(i.id));
  DB.program_days = DB.program_days.filter((d) => d.program_id !== id || keepDays.includes(d.id));
  return id;
}

function copyProgram(a: any) {
  if (!isStaff()) err('forbidden');
  const src = DB.programs.find((x) => x.id === a.p_source);
  if (!src) err('not_found');
  if (!a.p_member === !a.p_as_template) err('serve un socio oppure is_template');
  const id = uid();
  DB.programs.push({ id, name: nn(a.p_name) || src!.name, goal: src!.goal, member_id: a.p_member || null, trainer_id: me(), status: 'draft', is_template: !!a.p_as_template, starts_on: null, weeks: src!.weeks, notes: src!.notes, created_at: now(),
    objective: src!.objective ?? null, level: src!.level ?? null, target: src!.target ?? 'tutti', auto_archive: !!src!.auto_archive, course_ids: [...(src!.course_ids || [])],
    template_id: a.p_as_template ? null : (src!.is_template ? src!.id : src!.template_id ?? null) });
  DB.program_days.filter((d) => d.program_id === src!.id).sort((x, y) => x.position - y.position).forEach((d) => {
    const nd = uid();
    DB.program_days.push({ id: nd, program_id: id, position: d.position, name: d.name, focus: d.focus });
    DB.program_items.filter((i) => i.day_id === d.id).forEach((i) => DB.program_items.push({ ...i, id: uid(), day_id: nd }));
  });
  return id;
}

function activateProgram(a: any) {
  if (!isStaff()) err('forbidden');
  const p = DB.programs.find((x) => x.id === a.p_id && !x.is_template);
  if (!p || !p.member_id) err('not_found');
  DB.programs.forEach((x) => { if (x.member_id === p!.member_id && x.status === 'active' && x.id !== p!.id) x.status = 'archived'; });
  p!.status = 'active';
  p!.starts_on = a.p_starts_on || p!.starts_on || isoDay(new Date());
}

function saveWorkout(w: any) {
  if (!me()) err('login_required');
  if (DB.workouts.some((x) => x.id === w.id)) return w.id;
  const prog = DB.programs.find((x) => x.id === w.program_id && x.member_id === me());
  DB.workouts.push({ id: w.id, member_id: me(), program_id: prog?.id ?? null, day_id: prog ? w.day_id : null, day_name: nn(w.day_name), started_at: w.started_at, finished_at: w.finished_at || null, note: nn(w.note), rpe: w.rpe ?? null });
  (w.sets || []).forEach((s: any) => DB.set_logs.push({ id: uid(), workout_id: w.id, member_id: me(), exercise_id: s.exercise_id, item_id: s.item_id || null, set_no: s.set_no, reps: s.reps ?? null, weight_kg: s.weight_kg ?? null }));
  return w.id;
}

const wAt = (id: string) => DB.workouts.find((w) => w.id === id)?.started_at as string;
function lastSets(ids: string[]) {
  const out: Row[] = [];
  for (const ex of ids) {
    const mine = DB.set_logs.filter((s) => s.member_id === me() && s.exercise_id === ex);
    if (!mine.length) continue;
    const lastW = [...new Set(mine.map((s) => s.workout_id))].sort((a, b) => (wAt(b) > wAt(a) ? 1 : -1))[0];
    mine.filter((s) => s.workout_id === lastW).sort((a, b) => a.set_no - b.set_no).forEach((s) => out.push({ exercise_id: ex, set_no: s.set_no, reps: s.reps, weight_kg: s.weight_kg, at: wAt(lastW) }));
  }
  return out;
}

function progressSummary(member?: string | null) {
  const m = member || me();
  if (m !== me() && !isStaff()) err('forbidden');
  const per = new Map<string, Map<string, { at: string; w: number; reps: number; e1: number }>>();
  DB.set_logs.filter((s) => s.member_id === m && (s.reps ?? 0) > 0).forEach((s) => {
    const byW = per.get(s.exercise_id) ?? new Map();
    per.set(s.exercise_id, byW);
    const cur = byW.get(s.workout_id) ?? { at: wAt(s.workout_id), w: 0, reps: 0, e1: 0 };
    const w = s.weight_kg || 0;
    if (w > cur.w || (w === cur.w && s.reps > cur.reps)) { cur.w = w; cur.reps = s.reps; }
    cur.e1 = Math.max(cur.e1, w * (1 + s.reps / 30));
    byW.set(s.workout_id, cur);
  });
  const out: Row[] = [];
  per.forEach((byW, exId) => {
    const sess = [...byW.values()].sort((a, b) => (a.at > b.at ? 1 : -1));
    const e = DB.exercises.find((x) => x.id === exId)!;
    out.push({ exercise_id: exId, name: e.name, muscle_group: e.muscle_group, sessions: sess.length, last_at: sess[sess.length - 1].at, pr_weight: Math.max(...sess.map((x) => x.w)), pr_e1rm: Math.round(Math.max(...sess.map((x) => x.e1)) * 10) / 10, series: sess.slice(-12).map((x) => ({ at: x.at, w: x.w, reps: x.reps })) });
  });
  return out.sort((a, b) => (a.last_at < b.last_at ? 1 : -1));
}

const endsOn = (p: Row) => (p.starts_on ? isoDay(addDays(parseDay(p.starts_on), p.weeks * 7)) : null);
const nameOf = (id?: string | null): string | null => DB.profiles.find((x) => x.id === id)?.full_name ?? null;
function membersOverview() {
  if (!isStaff()) return [];
  return DB.profiles.filter((m) => m.role === 'member').map((m) => {
    const t = DB.profiles.find((x) => x.id === m.trainer_id);
    const p = DB.programs.find((x) => x.member_id === m.id && x.status === 'active');
    const ws = DB.workouts.filter((w) => w.member_id === m.id);
    const last = ws.reduce<string | null>((a, w) => (!a || w.started_at > a ? w.started_at : a), null);
    return { id: m.id, full_name: m.full_name, phone: m.phone, email: m.email, active: m.active, goal: m.goal, trainer_id: m.trainer_id, trainer_name: t?.full_name ?? null,
      program_id: p?.id ?? null, program_name: p?.name ?? null, program_ends_on: p ? endsOn(p) : null, last_workout_at: last,
      workouts_30d: ws.filter((w) => Date.now() - +new Date(w.started_at) < 30 * 86400000).length, created_at: m.created_at,
      birth_date: m.birth_date ?? null, sex: m.sex ?? null, has_anamnesis: DB.anamnesis.some((x) => x.member_id === m.id) };
  }).sort((a, b) => String(a.full_name).localeCompare(String(b.full_name)));
}

function gymStats(days: number) {
  if (!isStaff()) err('forbidden');
  const since = Date.now() - days * 86400000;
  const members = DB.profiles.filter((p) => p.role === 'member');
  const ws = DB.workouts.filter((w) => +new Date(w.started_at) > since);
  const today = isoDay(new Date());
  const weekly = new Map<string, number>();
  DB.workouts.filter((w) => +new Date(w.started_at) > Date.now() - 8 * 7 * 86400000).forEach((w) => {
    const d = new Date(w.started_at); const k = isoDay(addDays(d, -((d.getDay() + 6) % 7)));
    weekly.set(k, (weekly.get(k) || 0) + 1);
  });
  return {
    members_active: members.filter((m) => m.active).length,
    members_new: members.filter((m) => +new Date(m.created_at) > since).length,
    members_training: new Set(ws.map((w) => w.member_id)).size,
    workouts: ws.length,
    without_program: members.filter((m) => m.active && !DB.programs.some((p) => p.member_id === m.id && p.status === 'active')).length,
    expiring: DB.programs.filter((p) => p.status === 'active' && p.starts_on && endsOn(p)! <= isoDay(addDays(new Date(), 7))).length,
    weekly: [...weekly.entries()].sort().map(([week, workouts]) => ({ week, workouts })),
    trainers: DB.profiles.filter((p) => p.role === 'trainer' || p.role === 'owner').map((t) => ({ id: t.id, name: t.full_name, members: members.filter((m) => m.trainer_id === t.id && m.active).length })).sort((a, b) => b.members - a.members),
    counts: { members: members.length, programs: DB.programs.filter((p) => !p.is_template).length, exercises: DB.exercises.filter((e) => e.active).length, templates: DB.programs.filter((p) => p.is_template).length, courses: DB.courses.filter((c) => c.active).length },
    latest_members: [...members].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5).map((m) => ({ id: m.id, full_name: m.full_name, birth_date: m.birth_date ?? null, created_at: m.created_at })),
    latest_staff: DB.profiles.filter((p) => p.role !== 'member').sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5).map((m) => ({ id: m.id, full_name: m.full_name, role: m.role, created_at: m.created_at })),
    latest_programs: DB.programs.filter((p) => !p.is_template).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, 5)
      .map((p) => ({ id: p.id, name: p.name, status: p.status, starts_on: p.starts_on, ends_on: endsOn(p), member_name: nameOf(p.member_id), trainer_name: nameOf(p.trainer_id) })),
    _today: today,
  };
}

function programsOverview(templates: boolean) {
  if (!isStaff()) return [];
  return DB.programs.filter((p) => !!p.is_template === !!templates).sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).map((p) => {
    const ds = DB.program_days.filter((d) => d.program_id === p.id);
    return {
      id: p.id, name: p.name, goal: p.goal, objective: p.objective ?? null, level: p.level ?? null, target: p.target ?? 'tutti', status: p.status,
      member_id: p.member_id, member_name: nameOf(p.member_id), trainer_id: p.trainer_id, trainer_name: nameOf(p.trainer_id),
      template_name: DB.programs.find((x) => x.id === p.template_id)?.name ?? null, starts_on: p.starts_on, ends_on: endsOn(p), weeks: p.weeks, auto_archive: !!p.auto_archive,
      days_count: ds.length, items_count: DB.program_items.filter((i) => ds.some((d) => d.id === i.day_id)).length, created_at: p.created_at,
    };
  });
}

function workoutReport(a: any) {
  const m = a.p_member || me();
  if (m !== me() && !isStaff()) err('forbidden');
  const to = a.p_to ? parseDay(a.p_to) : new Date();
  const from = a.p_from ? parseDay(a.p_from) : addDays(to, -90);
  const f0 = +parseDay(isoDay(from)), t1 = +addDays(parseDay(isoDay(to)), 1);
  const ws = DB.workouts.filter((w) => w.member_id === m && +new Date(w.started_at) >= f0 && +new Date(w.started_at) < t1 && (!a.p_program || w.program_id === a.p_program));
  const ids = new Set(ws.map((w) => w.id));
  const nEx = ws.map((w) => new Set(DB.set_logs.filter((s) => s.workout_id === w.id).map((s) => s.exercise_id)).size);
  const days = Math.max(1, Math.round((t1 - f0) / 86400000));
  const monthly = new Map<string, number>();
  ws.forEach((w) => { const d = new Date(w.started_at); const k = isoDay(new Date(d.getFullYear(), d.getMonth(), 1)); monthly.set(k, (monthly.get(k) || 0) + 1); });
  const per = new Map<string, Map<string, { at: string; w: number; reps: number }>>();
  DB.set_logs.filter((s) => ids.has(s.workout_id) && (s.reps ?? 0) > 0).forEach((s) => {
    const byW = per.get(s.exercise_id) ?? new Map();
    per.set(s.exercise_id, byW);
    const cur = byW.get(s.workout_id) ?? { at: wAt(s.workout_id), w: 0, reps: 0 };
    const w = s.weight_kg || 0;
    if (w > cur.w || (w === cur.w && s.reps > cur.reps)) { cur.w = w; cur.reps = s.reps; }
    byW.set(s.workout_id, cur);
  });
  const exercises = [...per.entries()].map(([exId, byW]) => {
    const e = DB.exercises.find((x) => x.id === exId)!;
    const series = [...byW.values()].sort((x, y) => (x.at > y.at ? 1 : -1));
    return { exercise_id: exId, name: e.name, muscle_group: e.muscle_group, sessions: series.length, series };
  }).sort((x, y) => x.name.localeCompare(y.name));
  return {
    workouts: ws.length,
    avg_per_week: Math.round((ws.length / (days / 7)) * 10) / 10,
    avg_exercises: nEx.length ? Math.round((nEx.reduce((x, y) => x + y, 0) / nEx.length) * 10) / 10 : 0,
    monthly: [...monthly.entries()].sort().map(([month, workouts]) => ({ month, workouts })),
    exercises,
  };
}

function calendarEvents(a: any) {
  if (!isStaff()) err('forbidden');
  const f = +parseDay(a.p_from), t = +addDays(parseDay(a.p_to), 1);
  const out: Row[] = [];
  DB.workouts.filter((w) => +new Date(w.started_at) >= f && +new Date(w.started_at) < t).forEach((w) =>
    out.push({ kind: 'workout', id: w.id, at: w.started_at, end_at: w.finished_at, member_id: w.member_id, member_name: nameOf(w.member_id), title: w.day_name || 'Allenamento' }));
  DB.programs.filter((p) => p.status === 'active' && !p.is_template && p.starts_on).forEach((p) => {
    const x = parseDay(endsOn(p)!); x.setHours(12, 0, 0, 0);
    if (+x >= f && +x < t) out.push({ kind: 'renewal', id: p.id, at: x.toISOString(), end_at: null, member_id: p.member_id, member_name: nameOf(p.member_id), title: p.name });
  });
  DB.activities.filter((x) => +new Date(x.starts_at) >= f && +new Date(x.starts_at) < t).forEach((x) =>
    out.push({ kind: 'activity', id: x.id, at: x.starts_at, end_at: x.ends_at, member_id: x.member_id, member_name: nameOf(x.member_id), title: x.title, type: x.kind, note: x.note }));
  return out.sort((x, y) => (x.at > y.at ? 1 : -1));
}

function sendAnnouncement(a: any) {
  if (!isStaff()) err('forbidden');
  const title = nn(a.p_title), body = nn(a.p_body);
  if (!title || !body) err('message_required');
  if (!['all', 'members', 'staff', 'selected'].includes(a.p_audience)) err('audience_invalid');
  const users = DB.profiles.filter((p) => (a.p_audience === 'all' ? p.active || p.role !== 'member'
    : a.p_audience === 'members' ? p.role === 'member' && p.active
    : a.p_audience === 'staff' ? p.role !== 'member'
    : (a.p_members || []).includes(p.id) && p.active));
  // nella demo le notifiche partono solo per i due terzi circa delle persone (gli altri non le hanno attivate)
  const recipients = users.filter((_u, i) => i % 3 !== 2).length;
  const id = uid();
  DB.push_announcements.push({ id, title, body, audience: a.p_audience, targets: users.length, recipients, sent_by: me(), created_at: now() });
  return { id, targets: users.length, recipients };
}

function rpcImpl(fn: string, a: any): any {
  switch (fn) {
    case 'staff_directory': return DB.profiles.filter((p) => p.role !== 'member').map((p) => ({ id: p.id, full_name: p.full_name, role: p.role }));
    case 'check_join_code': return String(a.p_code || '').trim().toUpperCase() === JOIN_CODE;
    case 'delete_my_account': {
      const id = me();
      DB.profiles = DB.profiles.filter((p) => p.id !== id);
      setSession(null, 'SIGNED_OUT');
      return null;
    }
    case 'my_active_program': {
      const today = isoDay(new Date());
      const p = DB.programs.find((x) => x.member_id === me() && x.status === 'active' && !(x.auto_archive && x.starts_on && endsOn(x)! <= today));
      return p ? programJson(p.id) : null;
    }
    case 'program_json': return programJson(a.p_id);
    case 'save_program': return saveProgram(a.p);
    case 'copy_program': return copyProgram(a);
    case 'activate_program': return activateProgram(a);
    case 'archive_program': {
      if (!isStaff()) err('forbidden');
      const p = DB.programs.find((x) => x.id === a.p_id && !x.is_template);
      if (p) p.status = 'archived';
      return null;
    }
    case 'save_workout': return saveWorkout(a.p);
    case 'last_sets': return lastSets(a.p_exercises || []);
    case 'progress_summary': return progressSummary(a.p_member);
    case 'members_overview': return membersOverview();
    case 'gym_stats': return gymStats(a.p_days || 30);
    case 'programs_overview': return programsOverview(!!a.p_templates);
    case 'workout_report': return workoutReport(a);
    case 'calendar_events': return calendarEvents(a);
    case 'send_announcement': return sendAnnouncement(a);
    case 'register_push_token': return null;
    default: err('Funzione non disponibile nella demo: ' + fn);
  }
}

// Contenitori di file (PDF dei documenti, immagini degli esercizi): nella demo restano in memoria finché la pagina è aperta
const SAMPLE_PDF_TEXT = '%PDF-1.1\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
  + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 320 120]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n'
  + '4 0 obj<</Length 60>>stream\nBT /F1 14 Tf 20 60 Td (Documento di prova della demo) Tj ET\nendstream endobj\n'
  + '5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF';
let samplePdf = '';
const samplePdfUrl = () => (samplePdf ||= URL.createObjectURL(new Blob([SAMPLE_PDF_TEXT], { type: 'application/pdf' })));
const files = new Map<string, string>();
const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, bytes: ArrayBuffer, o?: { contentType?: string; upsert?: boolean }) => {
      const key = `${bucket}/${path}`;
      if (files.has(key) && !o?.upsert) return { data: null, error: { message: 'The resource already exists' } };
      files.set(key, URL.createObjectURL(new Blob([bytes], { type: o?.contentType || 'application/octet-stream' })));
      return { data: { path }, error: null };
    },
    getPublicUrl: (path: string) => ({ data: { publicUrl: files.get(`${bucket}/${path}`) || '' } }),
    createSignedUrl: async (path: string) => ({ data: { signedUrl: files.get(`${bucket}/${path}`) || samplePdfUrl() }, error: null }),
    remove: async (paths: string[]) => { paths.forEach((p) => files.delete(`${bucket}/${p}`)); return { data: null, error: null }; },
  }),
};

export const supabase = {
  from: (t: string) => new Qb(t),
  storage,
  rpc: (fn: string, a: any = {}) => new Promise<any>((res) => setTimeout(() => {
    try { res({ data: rpcImpl(fn, a), error: null }); } catch (e: any) { res({ data: null, error: e }); }
  }, 15)),
  auth: {
    getSession: async () => ({ data: { session } }),
    onAuthStateChange: (cb: (e: string, s: any) => void) => {
      listeners.add(cb);
      return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
    },
    signInWithPassword: async ({ email }: { email: string; password: string }) => {
      const id = DEMO_EMAILS[email.trim().toLowerCase()] || DB.profiles.find((p) => p.email === email.trim().toLowerCase())?.id;
      if (!id) return { data: null, error: { message: 'Invalid login credentials' } };
      setSession(id, 'SIGNED_IN');
      return { data: { session }, error: null };
    },
    signUp: async ({ email, options }: { email: string; password: string; options?: { data?: Row } }) => {
      if (DB.profiles.some((p) => p.email === email.trim().toLowerCase())) return { data: null, error: { message: 'User already registered' } };
      const d = options?.data || {};
      if (String(d.join_code || '').trim().toUpperCase() !== JOIN_CODE) return { data: null, error: { message: 'Codice palestra non valido' } };
      const id = uid();
      DB.profiles.push({ id, first_name: d.first_name, last_name: d.last_name || null, full_name: [d.first_name, d.last_name].filter(Boolean).join(' '), phone: d.phone || null, email: email.trim().toLowerCase(), role: 'member', trainer_id: null, goal: null, height_cm: null, active: true, created_at: now() });
      setSession(id, 'SIGNED_IN');
      return { data: { session }, error: null };
    },
    signOut: async () => { setSession(null, 'SIGNED_OUT'); return { error: null }; },
    resetPasswordForEmail: async () => ({ error: null }),
    resend: async () => ({ error: null }),
  },
};
export const demoGym = GYM;
