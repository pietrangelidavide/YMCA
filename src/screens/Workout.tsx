// L'allenamento: il socio segna carichi e ripetizioni serie per serie, con il timer di recupero.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { api, DraftWorkout, errText, Item, loadDraft, Progress, saveDraft, sendWorkout, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { NUM, plate, useTheme } from '../theme';
import { Button, Chip, Field, Icon, Page, Pill, Sheet, Spinner, Txt, useUi } from '../ui';
import { fmtClock, fmtNum, fmtRest, firstReps, loadNumber, parseNum, uuid } from '../util';
import { ExerciseTile } from './shared';

type SetRow = DraftWorkout['sets'][number];

const clean = (s: string) => s.replace(/[^\d.,]/g, '').slice(0, 6);

export default function Workout({ dayIndex }: { dayIndex: number }) {
  const { t } = useTheme();
  const nav = useNav();
  const { bump } = useVersion();
  const { toast, confirm } = useUi();
  const { userId } = useSession();

  const init = useAsync(async () => {
    const program = await api.activeProgram();
    if (!program) return null;
    const day = program.days[dayIndex];
    const ids = [...new Set(day.items.map((i) => i.exercise_id))];
    const [last, progress, draft] = await Promise.all([api.lastSets(ids), api.progress(), loadDraft()]);
    return { program, day, last, progress, draft };
  }, [dayIndex]);

  if (init.loading && !init.data) return <Page onBack={nav.pop} navTitle="Allenamento"><Spinner /></Page>;
  if (!init.data) return <Page onBack={nav.pop} navTitle="Allenamento"><View style={{ padding: 24 }}><Txt c="sub" style={{ textAlign: 'center' }}>Scheda non disponibile.</Txt></View></Page>;
  return <Session {...init.data} dayIndex={dayIndex} />;
}

function Session({ program, day, last, progress, draft, dayIndex }: { program: any; day: any; last: any[]; progress: Progress[]; draft: DraftWorkout | null; dayIndex: number }) {
  const { t } = useTheme();
  const nav = useNav();
  const { bump } = useVersion();
  const { toast, confirm } = useUi();
  const insets = { b: 0 };
  const p = plate(dayIndex);

  // serie di partenza: valori dell'ultima volta (o il carico indicato dal PT)
  const initial = useMemo<DraftWorkout>(() => {
    if (draft && draft.program_id === program.id && draft.day_name === day.name) return draft;
    const sets: SetRow[] = [];
    (day.items as Item[]).forEach((it) => {
      const prev = last.filter((l) => l.exercise_id === it.exercise_id);
      for (let n = 1; n <= it.sets; n++) {
        const ref = prev.find((l) => l.set_no === n) || prev[prev.length - 1];
        const kg = ref?.weight_kg ?? loadNumber(it.load_hint);
        const reps = ref?.reps ?? firstReps(it.reps);
        sets.push({ key: `${it.id}:${n}`, item_id: it.id!, exercise_id: it.exercise_id, set_no: n, kg: kg ? fmtNum(kg, 2) : '', reps: reps ? String(reps) : '', done: false });
      }
    });
    return { id: uuid(), program_id: program.id, day_id: day.id ?? null, day_name: day.name, started_at: new Date().toISOString(), sets };
  }, []);

  const [w, setW] = useState<DraftWorkout>(initial);
  const [now, setNow] = useState(Date.now());
  const [rest, setRest] = useState<{ until: number; total: number; name: string } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [rpe, setRpe] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | { minutes: number; sets: number; volume: number; records: string[]; queued: boolean }>(null);

  // salva la bozza a ogni modifica: se l'app si chiude si riprende da qui
  const t0 = useRef<any>(null);
  useEffect(() => {
    if (result) return;
    clearTimeout(t0.current);
    t0.current = setTimeout(() => saveDraft(w), 300);
  }, [w, result]);
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(i); }, []);

  const set = (key: string, patch: Partial<SetRow>) => setW((s) => ({ ...s, sets: s.sets.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const addSet = (it: Item) => setW((s) => {
    const mine = s.sets.filter((r) => r.item_id === it.id);
    const lastRow = mine[mine.length - 1];
    const row: SetRow = { key: `${it.id}:${mine.length + 1}:x${Date.now()}`, item_id: it.id!, exercise_id: it.exercise_id, set_no: mine.length + 1, kg: lastRow?.kg ?? '', reps: lastRow?.reps ?? '', done: false };
    const idx = s.sets.lastIndexOf(lastRow);
    const sets = [...s.sets]; sets.splice(idx + 1, 0, row);
    return { ...s, sets };
  });
  const toggle = (it: Item, r: SetRow) => {
    set(r.key, { done: !r.done });
    if (!r.done && it.rest_sec > 0) setRest({ until: Date.now() + it.rest_sec * 1000, total: it.rest_sec, name: it.exercise.name });
    if (r.done) setRest(null);
  };

  const done = w.sets.filter((r) => r.done);
  const elapsed = Math.floor((now - new Date(w.started_at).getTime()) / 1000);
  const left = rest ? Math.ceil((rest.until - now) / 1000) : 0;
  useEffect(() => { if (rest && left <= -4) setRest(null); }, [left, rest]);

  const volume = (rows: SetRow[]) => rows.reduce((a, r) => a + (parseNum(r.kg) || 0) * (parseNum(r.reps) || 0), 0);

  const leave = async () => {
    const ok = await confirm({ title: 'Esci dall\'allenamento?', message: 'Lo trovi nella schermata iniziale con «Riprendi»: serie e pesi restano salvati.', confirmLabel: 'Esci' });
    if (ok) { bump(); nav.pop(); }
  };
  const cancel = async () => {
    const ok = await confirm({ title: 'Annullare l\'allenamento?', message: 'Le serie segnate fin qui verranno cancellate.', confirmLabel: 'Annulla allenamento', destructive: true });
    if (ok) { await saveDraft(null); bump(); nav.pop(); }
  };
  const askFinish = async () => {
    if (!done.length) { toast('Segna almeno una serie con il segno di spunta.', 'error'); return; }
    if (done.length < w.sets.length) {
      const ok = await confirm({ title: 'Terminare adesso?', message: `Hai completato ${done.length} serie su ${w.sets.length}. Le altre non verranno registrate.`, confirmLabel: 'Termina' });
      if (!ok) return;
    }
    setFinishing(true);
  };

  const finish = async () => {
    setBusy(true);
    const finished = new Date();
    const payload = {
      id: w.id, program_id: w.program_id, day_id: w.day_id, day_name: w.day_name, started_at: w.started_at, finished_at: finished.toISOString(), rpe, note: note.trim() || null,
      sets: done.map((r) => ({ exercise_id: r.exercise_id, item_id: r.item_id, set_no: r.set_no, reps: parseNum(r.reps), weight_kg: parseNum(r.kg) })),
    };
    try {
      const saved = await sendWorkout(payload);
      await saveDraft(null);
      // record battuti: carico massimo di oggi oltre il precedente record
      const records: string[] = [];
      const byEx = new Map<string, number>();
      done.forEach((r) => byEx.set(r.exercise_id, Math.max(byEx.get(r.exercise_id) || 0, parseNum(r.kg) || 0)));
      byEx.forEach((kg, ex) => {
        const pr = progress.find((x) => x.exercise_id === ex);
        if (pr && pr.pr_weight > 0 && kg > pr.pr_weight) records.push(`${(day.items as Item[]).find((i) => i.exercise_id === ex)?.exercise.name}: ${fmtNum(kg, 2)} kg`);
      });
      setFinishing(false);
      setResult({ minutes: Math.max(1, Math.round((finished.getTime() - new Date(w.started_at).getTime()) / 60000)), sets: done.length, volume: volume(done), records, queued: !saved });
      bump();
    } catch (e) {
      toast(errText(e), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (result) return <Summary r={result} color={p.c} on={p.on} name={w.day_name} onClose={nav.pop} />;

  const items: Item[] = day.items;
  return (
    <Page onBack={leave} navTitle={day.name}
      right={<Text style={[{ color: t.sub, fontSize: 16, fontWeight: '600', marginRight: 8 }, NUM]}>{fmtClock(elapsed)}</Text>}
      scroll
      bottomSpace={rest ? 150 : 100}
      footer={
        <>
          {rest ? <RestBar rest={rest} left={left} onAdd={(s) => setRest({ ...rest, until: rest.until + s * 1000 })} onSkip={() => setRest(null)} /> : null}
          <Button label={`Termina allenamento · ${done.length}/${w.sets.length} serie`} onPress={askFinish} />
        </>
      }>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        {day.focus ? <Text style={{ color: t.sub, fontSize: 15 }}>{day.focus}</Text> : null}
        {items.map((it) => (
          <ExerciseCard key={it.id} it={it} rows={w.sets.filter((r) => r.item_id === it.id)} last={last.filter((l) => l.exercise_id === it.exercise_id)} color={p.c}
            onSet={set} onToggle={(r) => toggle(it, r)} onAdd={() => addSet(it)} onOpen={() => nav.push('exercise', { id: it.exercise_id })} />
        ))}
        <Button label="Annulla allenamento" kind="ghost" onPress={cancel} />
      </View>
      <Sheet visible={finishing} onClose={() => setFinishing(false)} title="Com'è andata?"
        footer={<Button label="Salva allenamento" onPress={finish} loading={busy} />}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {[['Facile', 5], ['Giusto', 7], ['Duro', 8], ['Al limite', 10]].map(([l, v]) => <Chip key={l as string} label={l as string} on={rpe === v} onPress={() => setRpe(rpe === v ? null : (v as number))} />)}
        </View>
        <Field label="Note (facoltative)" value={note} onChangeText={setNote} multiline placeholder="Dolori, sensazioni, cose da dire al PT…" />
        <Txt v="sub" c="sub">{done.length} serie · {fmtNum(volume(done) / 1000, 2)} t sollevate · {Math.max(1, Math.round(elapsed / 60))} min</Txt>
      </Sheet>
    </Page>
  );
}

// ───────── Esercizio con le sue serie ─────────

function ExerciseCard({ it, rows, last, color, onSet, onToggle, onAdd, onOpen }: {
  it: Item; rows: SetRow[]; last: any[]; color: string; onSet: (k: string, p: Partial<SetRow>) => void; onToggle: (r: SetRow) => void; onAdd: () => void; onOpen: () => void;
}) {
  const { t } = useTheme();
  const allDone = rows.length > 0 && rows.every((r) => r.done);
  const prev = last.length ? last.map((l) => `${l.weight_kg ? fmtNum(l.weight_kg, 2) : '–'}×${l.reps ?? '–'}`).join('  ') : '';
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 14, gap: 12, opacity: allDone ? 0.78 : 1 }}>
      <Pressable accessibilityLabel={`Apri ${it.exercise.name}`} onPress={onOpen} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <ExerciseTile e={it.exercise} size={46} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 17.5, fontWeight: '700', letterSpacing: -0.2 }}>{it.exercise.name}</Text>
          <Text style={{ color: t.sub, fontSize: 14 }}>{it.sets} × {it.reps}{it.load_hint ? ` · ${it.load_hint}` : ''} · rec. {fmtRest(it.rest_sec)}</Text>
        </View>
        {it.superset ? <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: t.accentInk, fontSize: 13, fontWeight: '800' }}>{it.superset}</Text></View> : null}
        {allDone ? <Icon name="checkmark-circle" size={26} color="ok" /> : null}
      </Pressable>
      {it.note ? <View style={{ flexDirection: 'row', gap: 8, backgroundColor: t.card2, borderRadius: 12, padding: 10 }}><Icon name="chatbubble-outline" size={16} color="sub" style={{ marginTop: 2 }} /><Text style={{ flex: 1, color: t.text, fontSize: 14.5, lineHeight: 20 }}>{it.note}</Text></View> : null}
      {it.tempo ? <Text style={{ color: t.sub, fontSize: 13.5 }}>Cadenza {it.tempo}</Text> : null}
      {prev ? <Text style={{ color: t.faint, fontSize: 13.5 }} numberOfLines={2}>Ultima volta (kg × rip.): <Text style={{ color: t.sub, fontWeight: '600' }}>{prev}</Text></Text> : null}

      <View style={{ gap: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4 }}>
          <Text style={{ width: 34, color: t.faint, fontSize: 12, fontWeight: '600' }}>Serie</Text>
          <Text style={{ flex: 1, color: t.faint, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Kg</Text>
          <Text style={{ flex: 1, color: t.faint, fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Ripetizioni</Text>
          <View style={{ width: 52 }} />
        </View>
        {rows.map((r, i) => (
          <View key={r.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: r.done ? t.accentSoft : 'transparent', borderRadius: 14, paddingVertical: 2, paddingHorizontal: 4 }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: r.done ? color : t.card2, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ color: r.done ? '#fff' : t.sub, fontSize: 13, fontWeight: '700' }}>{i + 1}</Text>
            </View>
            <NumInput value={r.kg} onChange={(kg) => onSet(r.key, { kg: clean(kg) })} label={`Chilogrammi serie ${i + 1} ${it.exercise.name}`} placeholder="–" />
            <NumInput value={r.reps} onChange={(reps) => onSet(r.key, { reps: clean(reps).replace(/[.,]/g, '') })} label={`Ripetizioni serie ${i + 1} ${it.exercise.name}`} placeholder="–" />
            <Pressable accessibilityLabel={r.done ? `Serie ${i + 1} fatta, tocca per annullare` : `Segna serie ${i + 1} come fatta`} onPress={() => onToggle(r)}
              style={({ pressed }: any) => ({ width: 52, height: 46, borderRadius: 14, backgroundColor: r.done ? t.ok : t.card2, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
              <Icon name="checkmark" size={26} color={r.done ? '#fff' : 'faint'} />
            </Pressable>
          </View>
        ))}
        <Pressable accessibilityLabel={`Aggiungi una serie a ${it.exercise.name}`} onPress={onAdd} style={{ height: 38, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 }}>
          <Icon name="add" size={18} color="accentInk" /><Text style={{ color: t.accentInk, fontSize: 15, fontWeight: '600' }}>Aggiungi serie</Text>
        </Pressable>
      </View>
    </View>
  );
}

function NumInput({ value, onChange, placeholder, label }: { value: string; onChange: (s: string) => void; placeholder?: string; label: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.card2, borderRadius: 14, height: 46, justifyContent: 'center' }}>
      <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.faint} keyboardType="decimal-pad" selectTextOnFocus
        style={[{ color: t.text, fontSize: 21, fontWeight: '700', textAlign: 'center', height: 46, paddingHorizontal: 4 } as any, NUM]} />
    </View>
  );
}

// ───────── Timer di recupero ─────────

function RestBar({ rest, left, onAdd, onSkip }: { rest: { until: number; total: number; name: string }; left: number; onAdd: (s: number) => void; onSkip: () => void }) {
  const { t } = useTheme();
  const go = left <= 0;
  const pct = Math.max(0, Math.min(1, 1 - left / rest.total));
  return (
    <View style={{ backgroundColor: go ? t.ok : t.card, borderRadius: 18, overflow: 'hidden', borderWidth: go ? 0 : 1, borderColor: t.line }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 10 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: go ? '#fff' : t.sub, fontSize: 12.5, fontWeight: '600' }}>{go ? 'Recupero finito' : 'Recupero'}</Text>
          <Text style={[{ color: go ? '#fff' : t.text, fontSize: 28, fontWeight: '800' }, NUM]}>{go ? 'Via!' : fmtClock(left)}</Text>
        </View>
        {!go ? <Chip small label="+15 s" onPress={() => onAdd(15)} /> : null}
        <Chip small label={go ? 'Chiudi' : 'Salta'} onPress={onSkip} />
      </View>
      {!go ? <View style={{ height: 4, backgroundColor: t.card2 }}><View style={{ height: 4, width: `${pct * 100}%` as any, backgroundColor: t.accent }} /></View> : null}
    </View>
  );
}

// ───────── Riepilogo finale ─────────

function Summary({ r, color, on, name, onClose }: { r: { minutes: number; sets: number; volume: number; records: string[]; queued: boolean }; color: string; on: string; name: string; onClose: () => void }) {
  const { t } = useTheme();
  const stat = (v: string, l: string) => (
    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.16)', borderRadius: 16, padding: 12, gap: 2 }}>
      <Text style={[{ color: on, fontSize: 26, fontWeight: '800' }, NUM]}>{v}</Text>
      <Text style={{ color: on, fontSize: 13, opacity: 0.8 }}>{l}</Text>
    </View>
  );
  return (
    <Page scroll={false}>
      <View style={{ flex: 1, padding: 16, gap: 16, justifyContent: 'center' }}>
        <View style={{ backgroundColor: color, borderRadius: 30, padding: 24, gap: 18 }}>
          <Icon name="checkmark-circle" size={48} color={on} />
          <View>
            <Text style={{ color: on, fontSize: 32, fontWeight: '800', letterSpacing: -0.6 }}>Allenamento completato</Text>
            <Text style={{ color: on, fontSize: 17, opacity: 0.85 }}>{name}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {stat(`${r.minutes}'`, 'durata')}
            {stat(String(r.sets), 'serie')}
            {stat(r.volume >= 1000 ? `${fmtNum(r.volume / 1000, 1)} t` : `${Math.round(r.volume)} kg`, 'sollevati')}
          </View>
        </View>
        {r.records.length ? (
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Icon name="trophy" size={20} color="warn" /><Txt v="head">Nuovi record</Txt></View>
            {r.records.map((x, i) => <Txt key={i} c="sub">{x}</Txt>)}
          </View>
        ) : null}
        {r.queued ? <Txt v="sub" c="sub" style={{ textAlign: 'center' }}>Non c'è connessione: l'allenamento è salvato sul telefono e parte da solo appena torna la rete.</Txt> : null}
        <Button label="Fatto" onPress={onClose} />
      </View>
    </Page>
  );
}
