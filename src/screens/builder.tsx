// Costruttore delle schede: dati della scheda, giorni di allenamento e voci (esercizi, tecniche, lezioni, riposi).
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, Course, Day, errText, Exercise, Item, ItemKind, Program, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { plate, useTheme } from '../theme';
import { Button, Chip, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Sheet, Spinner, Toggle, Txt, useUi } from '../ui';
import { addDays, fmtDateShortY, isoDay, LEVEL, LEVEL_KEYS, OBJECTIVE, OBJECTIVE_KEYS, parseDay, startOfWeek, TARGET, TARGET_KEYS, uuid } from '../util';
import { ExercisePicker, ExerciseTile } from './shared';
import { TECHNIQUES } from './techniques';
import { estimateMinutes } from './Today';

type BItem = Item & { k: string };
type BDay = Omit<Day, 'items'> & { k: string; items: BItem[] };
type Draft = {
  id?: string; name: string; goal: string; weeks: number; starts_on: string; notes: string; trainer_id: string | null;
  objective: string; level: string; target: string; auto_archive: boolean; course_ids: string[];
  member_id: string | null; is_template: boolean; status: 'draft' | 'active' | 'archived'; days: BDay[];
};

const NOTES_MAX = 1500;
const letter = (i: number) => String.fromCharCode(65 + (i % 26));
const newDay = (i: number): BDay => ({ k: uuid(), name: `Allenamento ${letter(i)}`, focus: '', items: [] });
const blank = (memberId: string | null, template: boolean, trainer: string | null): Draft => ({
  name: '', goal: '', weeks: 4, starts_on: '', notes: '', trainer_id: trainer, objective: '', level: '', target: 'tutti', auto_archive: false, course_ids: [],
  member_id: memberId, is_template: template, status: 'draft', days: [newDay(0)],
});
const fromProgram = (p: Program): Draft => ({
  id: p.id, name: p.name, goal: p.goal || '', weeks: p.weeks, starts_on: p.starts_on || '', notes: p.notes || '', trainer_id: p.trainer_id,
  objective: p.objective || '', level: p.level || '', target: p.target || 'tutti', auto_archive: !!p.auto_archive, course_ids: p.course_ids || [],
  member_id: p.member_id, is_template: p.is_template, status: p.status,
  days: p.days.map((d) => ({ ...d, k: d.id || uuid(), focus: d.focus || '', items: d.items.map((it) => ({ ...it, kind: it.kind || 'exercise', k: it.id || uuid() })) })),
});
const payload = (x: Draft) => ({
  id: x.id, name: x.name.trim(), goal: x.goal.trim(), weeks: x.weeks, starts_on: x.starts_on || null, notes: x.notes.trim(), member_id: x.member_id, is_template: x.is_template,
  trainer_id: x.trainer_id, objective: x.objective || null, level: x.level || null, target: x.target || 'tutti', auto_archive: x.auto_archive, course_ids: x.course_ids,
  days: x.days.map((d) => ({
    id: d.id, name: d.name.trim(), focus: (d.focus || '').trim(),
    items: d.items.map((it) => ({
      id: it.id, kind: it.kind, title: it.title?.trim() || null, course_id: it.course_id || null, exercise_id: it.kind === 'exercise' ? it.exercise_id : null,
      sets: it.kind === 'exercise' ? Math.max(1, Math.round(it.sets) || 3) : 1, reps: it.kind === 'exercise' ? it.reps.trim() || '10' : '', load_hint: it.load_hint?.trim() || null,
      rest_sec: Math.max(0, Math.round(it.rest_sec) || 0), tempo: it.tempo?.trim() || null, note: it.note?.trim() || null, superset: it.superset || null,
    })),
  })),
});

const BIG = ['quadricipiti', 'femorali', 'schiena', 'petto', 'glutei', 'total_body'];
function defaultsFor(e: Exercise): Pick<Item, 'sets' | 'reps' | 'rest_sec'> {
  if (e.category === 'cardio' || e.muscle_group === 'cardio') return { sets: 1, reps: '10 min', rest_sec: 0 };
  if (e.category === 'stretching' || e.category === 'mobilita' || e.muscle_group === 'mobilita') return { sets: 2, reps: '30 sec', rest_sec: 30 };
  if (e.category === 'pliometria') return { sets: 3, reps: '6', rest_sec: 90 };
  if (e.muscle_group === 'addome') return { sets: 3, reps: '15', rest_sec: 45 };
  return { sets: 3, reps: '10', rest_sec: BIG.includes(e.muscle_group) ? 90 : 60 };
}
const emptyItem = (kind: ItemKind): BItem => ({ k: uuid(), kind, title: null, course_id: null, exercise_id: null, exercise: null, sets: 1, reps: '', load_hint: null, rest_sec: 0, tempo: null, note: null, superset: null });

// Piccolo campo numerico/di testo per i valori in riga
function Mini({ label, value, onChange, placeholder, keyboard, flex = 1, suffix }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; keyboard?: any; flex?: number; suffix?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flex, minWidth: 0, gap: 4 }}>
      <Text numberOfLines={1} style={{ color: t.faint, fontSize: 11.5, fontWeight: '500', marginLeft: 2 }}>{label}</Text>
      <View style={{ height: 42, borderRadius: 10, backgroundColor: t.card2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
        <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.faint} keyboardType={keyboard} autoCorrect={false}
          style={{ flex: 1, minWidth: 0, color: t.text, fontSize: 16, fontWeight: '600', textAlign: 'center', height: 42 } as any} />
        {suffix ? <Text style={{ color: t.faint, fontSize: 12.5, marginRight: 4 }}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function SmallBtn({ name, label, onPress, disabled, danger }: { name: string; label: string; onPress: () => void; disabled?: boolean; danger?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} hitSlop={4}
      style={({ pressed }: any) => ({ width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: pressed ? t.card2 : 'transparent', opacity: disabled ? 0.25 : 1 })}>
      <Icon name={name} size={20} color={danger ? 'danger' : 'sub'} />
    </Pressable>
  );
}

type CardProps = { it: BItem; first: boolean; last: boolean; onChange: (p: Partial<BItem>) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void };

function ItemCard({ it, first, last, onChange, onMove, onRemove }: CardProps) {
  const { t } = useTheme();
  const [more, setMore] = useState(!!(it.tempo || it.note || it.superset));
  const num = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  const ex = it.exercise!;
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ExerciseTile e={ex} size={40} play={false} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{ex.name}</Text>
          {it.superset ? <Text style={{ color: t.accentInk, fontSize: 12.5, fontWeight: '600' }}>Superserie {it.superset}</Text> : null}
        </View>
        <SmallBtn name="chevron-up" label="Sposta su" disabled={first} onPress={() => onMove(-1)} />
        <SmallBtn name="chevron-down" label="Sposta giù" disabled={last} onPress={() => onMove(1)} />
        <SmallBtn name="trash-outline" label="Togli dalla scheda" danger onPress={onRemove} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Mini label="Serie" value={it.sets ? String(it.sets) : ''} onChange={(s) => onChange({ sets: num(s) })} keyboard="number-pad" />
        <Mini label="Ripetizioni" value={it.reps} onChange={(reps) => onChange({ reps })} keyboard="numbers-and-punctuation" flex={1.3} />
        <Mini label="Recupero" value={String(it.rest_sec ?? '')} onChange={(s) => onChange({ rest_sec: num(s) })} keyboard="number-pad" suffix="s" flex={1.2} />
        <Mini label="Carico" value={it.load_hint || ''} onChange={(load_hint) => onChange({ load_hint })} placeholder="kg" flex={1.1} />
      </View>
      <Pressable accessibilityLabel={more ? 'Nascondi i dettagli' : 'Altri dettagli'} onPress={() => setMore(!more)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 }}>
        <Text style={{ color: t.accentInk, fontSize: 14, fontWeight: '600' }}>{more ? 'Meno dettagli' : 'Tempo, superserie e note'}</Text>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} size={15} color="accentInk" />
      </Pressable>
      {more ? (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
            <Mini label="Tempo (es. 3-1-1)" value={it.tempo || ''} onChange={(tempo) => onChange({ tempo })} keyboard="numbers-and-punctuation" flex={1.2} />
            <View style={{ flex: 1.6, gap: 4 }}>
              <Text style={{ color: t.faint, fontSize: 11.5, fontWeight: '500', marginLeft: 2 }}>Superserie</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[null, 'A', 'B', 'C'].map((s) => <Chip key={s || 'no'} small label={s || 'No'} on={(it.superset || null) === s} onPress={() => onChange({ superset: s })} />)}
              </View>
            </View>
          </View>
          <Field value={it.note || ''} onChangeText={(note) => onChange({ note })} placeholder="Nota per il socio (es. fermati un secondo in basso)" style={{ gap: 0 }} />
        </View>
      ) : null}
    </View>
  );
}

const KIND_META: Record<Exclude<ItemKind, 'exercise'>, { label: string; icon: string }> = {
  technique: { label: 'Tecnica di allenamento', icon: 'flash' },
  lesson: { label: 'Lezione', icon: 'people' },
  rest: { label: 'Riposo', icon: 'cafe' },
};

// Tecnica, lezione di un corso o riposo: voci senza serie e ripetizioni
function OtherCard({ it, first, last, onChange, onMove, onRemove }: CardProps) {
  const { t } = useTheme();
  const meta = KIND_META[it.kind as Exclude<ItemKind, 'exercise'>];
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 12, gap: 10, borderLeftWidth: 4, borderLeftColor: t.accent }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 40, height: 40, borderRadius: 11, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={meta.icon} size={21} color="accentInk" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.accentInk, fontSize: 12.5, fontWeight: '700' }}>{meta.label}</Text>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{it.title || '–'}</Text>
        </View>
        <SmallBtn name="chevron-up" label="Sposta su" disabled={first} onPress={() => onMove(-1)} />
        <SmallBtn name="chevron-down" label="Sposta giù" disabled={last} onPress={() => onMove(1)} />
        <SmallBtn name="trash-outline" label="Togli dalla scheda" danger onPress={onRemove} />
      </View>
      {it.kind === 'technique' ? <Field value={it.title || ''} onChangeText={(title) => onChange({ title })} placeholder="Nome della tecnica" style={{ gap: 0 }} /> : null}
      {it.kind === 'rest' ? (
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Mini label="Durata (minuti)" value={it.rest_sec ? String(Math.round(it.rest_sec / 60)) : ''} onChange={(s) => onChange({ rest_sec: (parseInt(s.replace(/\D/g, ''), 10) || 0) * 60 })} keyboard="number-pad" suffix="min" flex={1} />
          <View style={{ flex: 2 }} />
        </View>
      ) : null}
      {it.kind === 'lesson' && it.course ? <Txt v="sub" c="sub">{[it.course.category, it.course.duration_min ? `${it.course.duration_min} minuti` : ''].filter(Boolean).join(' · ') || 'Corso della palestra'}</Txt> : null}
      <Field value={it.note || ''} onChangeText={(note) => onChange({ note })} multiline inputStyle={{ minHeight: 56 }} style={{ gap: 0 }}
        placeholder={it.kind === 'technique' ? 'Come si esegue' : it.kind === 'lesson' ? 'Nota per il socio (orario, sala…)' : 'Nota per il socio'} />
    </View>
  );
}

export default function ProgramBuilder({ id, memberId, template }: { id?: string; memberId?: string; template?: boolean }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const src = useAsync(() => (id ? api.program(id) : Promise.resolve(null)), [id]);
  const lists = useAsync(async () => ({ staff: await api.staff(), courses: (await api.courses()).filter((c) => c.active) }), []);
  const [p, setP] = useState<Draft | null>(null);
  const [di, setDi] = useState(0);
  const [picker, setPicker] = useState(false);
  const [sheet, setSheet] = useState<null | 'technique' | 'lesson' | 'courses' | 'trainer'>(null);
  const [busy, setBusy] = useState(false);
  const [tplName, setTplName] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (p) return;
    if (!id) setP(blank(memberId || null, !!template || !memberId, userId));
    else if (src.data) setP(fromProgram(src.data));
  }, [src.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const member = useAsync(() => (p?.member_id ? api.profile(p.member_id) : Promise.resolve(null)), [p?.member_id]);

  const edit = (fn: (x: Draft) => Draft) => { dirty.current = true; setP((x) => (x ? fn(x) : x)); };
  const set = (patch: Partial<Draft>) => edit((x) => ({ ...x, ...patch }));
  const setDay = (i: number, patch: Partial<BDay>) => edit((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const setItem = (i: number, k: string, patch: Partial<BItem>) => edit((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, items: d.items.map((it) => (it.k === k ? { ...it, ...patch } : it)) } : d)) }));
  const moveItem = (i: number, idx: number, dir: -1 | 1) => edit((x) => ({
    ...x, days: x.days.map((d, j) => {
      if (j !== i) return d;
      const items = [...d.items]; const to = idx + dir;
      if (to < 0 || to >= items.length) return d;
      [items[idx], items[to]] = [items[to], items[idx]];
      return { ...d, items };
    }),
  }));
  const removeItem = (i: number, k: string) => edit((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, items: d.items.filter((it) => it.k !== k) } : d)) }));

  if (id && src.error && !src.data) return <Page onBack={nav.pop} navTitle="Scheda"><ErrorState error={src.error} onRetry={src.reload} /></Page>;
  if (!p) return <Page onBack={nav.pop} navTitle="Scheda"><Spinner /></Page>;

  const day = p.days[Math.min(di, p.days.length - 1)];
  const dIdx = p.days.indexOf(day);
  const isMember = !!p.member_id && !p.is_template;
  const w = [4, 6, 8, 12];
  const exCount = (d: BDay) => d.items.filter((i) => i.kind === 'exercise').length;
  const totalEx = p.days.reduce((a, d) => a + exCount(d), 0);
  const totalItems = p.days.reduce((a, d) => a + d.items.length, 0);
  const staffName = lists.data?.staff.find((s) => s.id === p.trainer_id)?.full_name;
  const endsOn = p.starts_on && /^\d{4}-\d{2}-\d{2}$/.test(p.starts_on) ? addDays(parseDay(p.starts_on), p.weeks * 7) : null;
  const picked = (lists.data?.courses || []).filter((c) => p.course_ids.includes(c.id));

  const back = async () => {
    if (dirty.current && !(await confirm({ title: 'Uscire senza salvare?', message: 'Le modifiche a questa scheda andranno perse.', confirmLabel: 'Esci senza salvare', destructive: true }))) return;
    nav.pop();
  };

  const check = (activate: boolean): string | null => {
    if (!p.name.trim()) return 'Dai un nome alla scheda.';
    if (p.starts_on && !/^\d{4}-\d{2}-\d{2}$/.test(p.starts_on)) return 'La data di inizio va scritta così: 2026-10-19.';
    if (p.notes.length > NOTES_MAX) return `Le note sono troppo lunghe: massimo ${NOTES_MAX} caratteri.`;
    if (p.days.some((d) => !d.name.trim())) return 'Ogni giorno ha bisogno di un nome.';
    if (p.days.some((d) => d.items.some((i) => i.kind !== 'exercise' && !i.title?.trim()))) return 'Ogni tecnica, lezione o riposo ha bisogno di un nome.';
    if (activate && !totalItems) return 'Aggiungi almeno una voce prima di attivare la scheda.';
    return null;
  };

  // salva e restituisce l'id (così le azioni successive lavorano sulla scheda appena salvata)
  const persist = async (): Promise<string> => {
    const sid = await api.saveProgram(payload(p));
    dirty.current = false;
    setP((x) => (x ? { ...x, id: sid } : x));
    return sid;
  };

  const save = async (activate = false) => {
    const bad = check(activate);
    if (bad) return toast(bad, 'error');
    setBusy(true);
    try {
      const sid = await persist();
      if (activate) await api.activateProgram(sid, p.starts_on || null);
      bump();
      toast(activate ? 'Scheda attivata: il socio la vede subito.' : p.is_template ? 'Modello salvato.' : 'Scheda salvata.');
      nav.pop();
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  const saveAsTemplate = async () => {
    const name = (tplName || '').trim();
    if (!name) return toast('Scrivi il nome del modello.', 'error');
    const bad = check(false);
    if (bad) return toast(bad, 'error');
    setBusy(true);
    try {
      const sid = await persist();
      await api.copyProgram(sid, null, true, name);
      bump(); setTplName(null);
      toast('Modello creato: lo trovi in «Schede > Modelli».');
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  const archive = async () => {
    if (!p.id || !(await confirm({ title: 'Archiviare la scheda?', message: 'Il socio non la vedrà più tra le schede attive.', confirmLabel: 'Archivia' }))) return;
    setBusy(true);
    try { await api.archiveProgram(p.id); bump(); toast('Scheda archiviata.'); nav.pop(); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!p.id || !(await confirm({ title: p.is_template ? 'Eliminare il modello?' : 'Eliminare la scheda?', message: p.status === 'active' ? 'La scheda è attiva: il socio resterà senza scheda. Gli allenamenti già registrati restano nello storico.' : 'Non si può annullare.', confirmLabel: 'Elimina', destructive: true }))) return;
    setBusy(true);
    try { await api.deleteProgram(p.id); bump(); toast('Eliminata.'); nav.pop(); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  const addItems = (list: BItem[]) => {
    edit((x) => ({ ...x, days: x.days.map((d, j) => (j === dIdx ? { ...d, items: [...d.items, ...list] } : d)) }));
  };
  const addExercises = (list: Exercise[]) => {
    addItems(list.map((e): BItem => ({ ...emptyItem('exercise'), exercise_id: e.id, exercise: e, ...defaultsFor(e) })));
    setPicker(false);
  };
  const addTechnique = (tq: { title: string; note: string } | null) => {
    addItems([{ ...emptyItem('technique'), title: tq?.title || '', note: tq?.note || null }]);
    setSheet(null);
  };
  const addLesson = (c: Course) => {
    addItems([{ ...emptyItem('lesson'), title: c.name, course_id: c.id, course: { id: c.id, name: c.name, category: c.category, duration_min: c.duration_min } }]);
    setSheet(null);
  };
  const addRest = () => addItems([{ ...emptyItem('rest'), title: 'Riposo', rest_sec: 120 }]);

  const addDay = () => { edit((x) => ({ ...x, days: [...x.days, newDay(x.days.length)] })); setDi(p.days.length); };
  const dupDay = () => {
    edit((x) => {
      const src = x.days[dIdx];
      const copy: BDay = { k: uuid(), name: `${src.name} (copia)`, focus: src.focus, items: src.items.map((it) => ({ ...it, id: undefined, k: uuid() })) };
      return { ...x, days: [...x.days.slice(0, dIdx + 1), copy, ...x.days.slice(dIdx + 1)] };
    });
    setDi(dIdx + 1);
  };
  const delDay = async () => {
    if (p.days.length < 2) return;
    if (day.items.length && !(await confirm({ title: `Eliminare «${day.name}»?`, message: `Verranno tolte anche le sue ${day.items.length} voci.`, confirmLabel: 'Elimina il giorno', destructive: true }))) return;
    edit((x) => ({ ...x, days: x.days.filter((_, j) => j !== dIdx) }));
    setDi(Math.max(0, dIdx - 1));
  };

  const nextMonday = isoDay(addDays(startOfWeek(new Date()), 7));
  const today = isoDay(new Date());
  const title = p.id ? (p.is_template ? 'Modello' : 'Scheda') : p.is_template ? 'Nuovo modello' : 'Nuova scheda';

  const footer = p.is_template ? (
    <Button label="Salva il modello" onPress={() => save(false)} loading={busy} />
  ) : p.status === 'active' ? (
    <Button label="Salva le modifiche" onPress={() => save(false)} loading={busy} />
  ) : (
    <>
      <Button label="Salva e attiva" icon="flash" onPress={() => save(true)} loading={busy} />
      <Button label="Salva come bozza" kind="secondary" onPress={() => save(false)} disabled={busy} />
    </>
  );

  const group = (label: string, keys: string[], map: Record<string, string>, value: string, onPick: (v: string) => void, allowNone = true) => (
    <View style={{ gap: 6 }}>
      <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>{label}</Txt>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        {keys.map((k) => <Chip key={k} small label={map[k]} on={value === k} onPress={() => onPick(allowNone && value === k ? '' : k)} />)}
      </View>
    </View>
  );

  return (
    <Page onBack={back} navTitle={title} footer={footer}>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        {isMember ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Icon name="person-circle-outline" size={20} color="accentInk" />
            <Txt c="sub">Per <Text style={{ fontWeight: '700', color: t.text }}>{member.data?.full_name || '…'}</Text></Txt>
            {p.status === 'active' ? <Pill label="Attiva" color={t.accentSoft} textColor={t.accentInk} icon="flash" /> : null}
          </View>
        ) : null}
        {p.status === 'active' ? <Txt v="sub" c="faint">La scheda è attiva: le modifiche si vedono subito sul telefono del socio.</Txt> : null}

        <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 16, gap: 14 }}>
          <Field label="Nome della scheda" value={p.name} onChangeText={(name) => set({ name })} placeholder={p.is_template ? 'Forza 3 giorni, Principianti…' : 'Ipertrofia – fase 1'} autoCapitalize="sentences" />
          {group('Obiettivo', OBJECTIVE_KEYS, OBJECTIVE, p.objective, (objective) => set({ objective }))}
          <Field label="Descrizione breve" value={p.goal} onChangeText={(goal) => set({ goal })} placeholder="Più forza sulle gambe, ripresa dopo uno stop…" />
          {group('Livello', LEVEL_KEYS, LEVEL, p.level, (level) => set({ level }))}
          {group('Adatta a', TARGET_KEYS, TARGET, p.target, (target) => set({ target: target || 'tutti' }), false)}
          <View style={{ gap: 6 }}>
            <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>Durata</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(w.includes(p.weeks) ? w : [...w, p.weeks].sort((a, b) => a - b)).map((n) => <Chip key={n} small label={`${n} settimane`} on={p.weeks === n} onPress={() => set({ weeks: n })} />)}
            </View>
          </View>
          {!p.is_template ? (
            <>
              <View style={{ gap: 6 }}>
                <Field label="Valida dal" value={p.starts_on} onChangeText={(starts_on) => set({ starts_on })} placeholder="2026-10-19" hint={endsOn ? `Anno-mese-giorno. Scade il ${fmtDateShortY(endsOn)}.` : 'Anno-mese-giorno. Se lo lasci vuoto parte il giorno dell\'attivazione.'} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Chip small label="Oggi" on={p.starts_on === today} onPress={() => set({ starts_on: today })} />
                  <Chip small label="Lunedì prossimo" on={p.starts_on === nextMonday} onPress={() => set({ starts_on: nextMonday })} />
                </View>
              </View>
              <Row title="Disattiva alla scadenza" sub={p.auto_archive ? 'Dopo la scadenza il socio non vede più la scheda.' : 'Dopo la scadenza il socio la vede ancora, segnata come scaduta.'}
                right={<Toggle value={p.auto_archive} onChange={(auto_archive) => set({ auto_archive })} label="Disattiva alla scadenza" />} />
            </>
          ) : null}
          <Row title="Seguito da" value={staffName || 'Tu'} chevron onPress={() => setSheet('trainer')} />
          <Row title="Corsi consigliati" sub={picked.length ? picked.map((c) => c.name).join(', ') : 'Nessuno'} value={picked.length ? String(picked.length) : undefined} chevron onPress={() => setSheet('courses')} />
          <Field label="Note per il socio" value={p.notes} onChangeText={(notes) => set({ notes })} multiline maxLength={NOTES_MAX}
            placeholder="Indicazioni generali: riscaldamento, progressione dei carichi…" hint={`${p.notes.length}/${NOTES_MAX} caratteri`} />
        </View>

        <SectionTitle right={<Txt v="cap" c="faint">{totalEx} esercizi in tutto</Txt>}>Giorni di allenamento</SectionTitle>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16, marginTop: -8 }}>
          {p.days.map((d, i) => {
            const pl = plate(i); const on = i === dIdx;
            return (
              <Pressable key={d.k} accessibilityLabel={d.name} onPress={() => setDi(i)}
                style={{ height: 42, paddingLeft: 8, paddingRight: 14, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: on ? pl.c : t.card }}>
                <View style={{ width: 26, height: 26, borderRadius: 9, backgroundColor: on ? 'rgba(0,0,0,0.16)' : pl.c, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: pl.on, fontSize: 14, fontWeight: '800' }}>{letter(i)}</Text>
                </View>
                <Text numberOfLines={1} style={{ maxWidth: 120, color: on ? pl.on : t.text, fontSize: 15, fontWeight: on ? '700' : '500' }}>{d.name}</Text>
              </Pressable>
            );
          })}
          <Pressable accessibilityLabel="Aggiungi un giorno" onPress={addDay} style={{ height: 42, paddingHorizontal: 14, borderRadius: 21, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: t.card2 }}>
            <Icon name="add" size={20} color="accentInk" />
            <Text style={{ color: t.accentInk, fontSize: 15, fontWeight: '600' }}>Giorno</Text>
          </Pressable>
        </ScrollView>

        <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 16, gap: 12 }}>
          <Field label="Nome del giorno" value={day.name} onChangeText={(name) => setDay(dIdx, { name })} />
          <Field label="Cosa si allena (facoltativo)" value={day.focus || ''} onChangeText={(focus) => setDay(dIdx, { focus })} placeholder="Petto, spalle e tricipiti" />
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pill label={`${exCount(day)} ${exCount(day) === 1 ? 'esercizio' : 'esercizi'}`} icon="barbell-outline" />
            <Pill label={day.items.length ? `circa ${estimateMinutes({ ...day, items: day.items })} minuti` : 'durata da calcolare'} icon="time-outline" />
          </View>
        </View>

        {day.items.map((it, i) => {
          const common = { first: i === 0, last: i === day.items.length - 1, onChange: (patch: Partial<BItem>) => setItem(dIdx, it.k, patch), onMove: (dir: -1 | 1) => moveItem(dIdx, i, dir), onRemove: () => removeItem(dIdx, it.k) };
          return it.kind === 'exercise' && it.exercise ? <ItemCard key={it.k} it={it} {...common} /> : <OtherCard key={it.k} it={it} {...common} />;
        })}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button label="Esercizio" icon="add-circle-outline" kind={day.items.length ? 'secondary' : 'primary'} onPress={() => setPicker(true)} style={{ flexGrow: 1, flexBasis: 150 }} />
          <Button label="Tecnica" icon="flash-outline" kind="secondary" onPress={() => setSheet('technique')} style={{ flexGrow: 1, flexBasis: 150 }} />
          <Button label="Lezione" icon="people-outline" kind="secondary" onPress={() => setSheet('lesson')} style={{ flexGrow: 1, flexBasis: 150 }} />
          <Button label="Riposo" icon="cafe-outline" kind="secondary" onPress={addRest} style={{ flexGrow: 1, flexBasis: 150 }} />
        </View>

        <SectionTitle>Questo giorno</SectionTitle>
        <Group>
          <Row title="Duplica il giorno" left={<Icon name="copy-outline" size={22} color="sub" />} onPress={dupDay} />
          {p.days.length > 1 ? <Row title="Elimina il giorno" danger left={<Icon name="trash-outline" size={22} color="danger" />} onPress={delDay} /> : null}
        </Group>

        {p.id ? (
          <>
            <SectionTitle>Scheda</SectionTitle>
            <Group>
              {!p.is_template ? <Row title="Salva come modello" sub="Per riusarla con altri soci" left={<Icon name="albums-outline" size={22} color="accentInk" />} chevron onPress={() => setTplName(p.name)} /> : null}
              {p.status === 'active' ? <Row title="Archivia" left={<Icon name="archive-outline" size={22} color="sub" />} onPress={archive} /> : null}
              <Row title={p.is_template ? 'Elimina il modello' : 'Elimina la scheda'} danger left={<Icon name="trash-outline" size={22} color="danger" />} onPress={remove} />
            </Group>
          </>
        ) : null}
      </View>

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onAdd={addExercises} />

      <Sheet visible={sheet === 'technique'} onClose={() => setSheet(null)} title="Tecnica di allenamento">
        <Txt c="sub">Scegli una tecnica: il testo si può modificare nella scheda.</Txt>
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {TECHNIQUES.map((tq, i) => (
            <Pressable key={tq.title} accessibilityLabel={tq.title} onPress={() => addTechnique(tq)}
              style={({ pressed }: any) => ({ padding: 14, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.card : 'transparent' })}>
              <Text style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{tq.title}</Text>
              <Text numberOfLines={2} style={{ color: t.sub, fontSize: 13.5 }}>{tq.note}</Text>
            </Pressable>
          ))}
        </View>
        <Button kind="secondary" label="Tecnica personalizzata" icon="create-outline" onPress={() => addTechnique(null)} />
      </Sheet>

      <Sheet visible={sheet === 'lesson'} onClose={() => setSheet(null)} title="Lezione di un corso">
        {!lists.data?.courses.length ? <Txt c="sub">Non ci sono corsi attivi. Creali da «Altro, poi Corsi».</Txt> : (
          <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
            {lists.data.courses.map((c, i) => (
              <Pressable key={c.id} accessibilityLabel={c.name} onPress={() => addLesson(c)}
                style={({ pressed }: any) => ({ padding: 14, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.card : 'transparent' })}>
                <Text style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{c.name}</Text>
                <Text style={{ color: t.sub, fontSize: 13.5 }}>{[c.category, c.duration_min ? `${c.duration_min} minuti` : ''].filter(Boolean).join(' · ') || 'Corso'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'courses'} onClose={() => setSheet(null)} title="Corsi consigliati" footer={<Button label="Fatto" onPress={() => setSheet(null)} />}>
        <Txt c="sub">Il socio li vede in cima alla scheda come consiglio.</Txt>
        {!lists.data?.courses.length ? <Txt c="faint">Non ci sono corsi attivi.</Txt> : (
          <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
            {lists.data.courses.map((c, i) => {
              const on = p.course_ids.includes(c.id);
              return (
                <Pressable key={c.id} accessibilityLabel={c.name} onPress={() => set({ course_ids: on ? p.course_ids.filter((x) => x !== c.id) : [...p.course_ids, c.id] })}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: on ? t.accentSoft : 'transparent' }}>
                  <Text style={{ flex: 1, color: t.text, fontSize: 16.5 }}>{c.name}</Text>
                  <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? 'accentInk' : 'faint'} />
                </Pressable>
              );
            })}
          </View>
        )}
      </Sheet>

      <Sheet visible={sheet === 'trainer'} onClose={() => setSheet(null)} title="Seguito da">
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {(lists.data?.staff || []).map((s, i) => (
            <Pressable key={s.id} accessibilityLabel={s.full_name} onPress={() => { set({ trainer_id: s.id }); setSheet(null); }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
              <Text style={{ flex: 1, color: t.text, fontSize: 16.5 }}>{s.full_name}</Text>
              {p.trainer_id === s.id ? <Icon name="checkmark" size={22} color="accentInk" /> : null}
            </Pressable>
          ))}
        </View>
      </Sheet>

      <Sheet visible={tplName !== null} onClose={() => setTplName(null)} title="Salva come modello" footer={<Button label="Crea il modello" onPress={saveAsTemplate} loading={busy} />}>
        <Txt c="sub">Il modello è una copia della scheda senza il socio: lo potrai assegnare a chiunque.</Txt>
        <Field label="Nome del modello" value={tplName || ''} onChangeText={setTplName} />
      </Sheet>
    </Page>
  );
}
