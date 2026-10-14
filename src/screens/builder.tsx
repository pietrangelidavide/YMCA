// Costruttore delle schede: nome e durata, giorni di allenamento, esercizi con serie, ripetizioni, recuperi e note.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, Day, errText, Exercise, Item, Program, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { plate, useTheme } from '../theme';
import { Button, Chip, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Sheet, Spinner, Txt, useUi } from '../ui';
import { addDays, isoDay, startOfWeek, uuid } from '../util';
import { ExercisePicker, ExerciseTile } from './shared';
import { estimateMinutes } from './Today';

type BItem = Item & { k: string };
type BDay = Omit<Day, 'items'> & { k: string; items: BItem[] };
type Draft = {
  id?: string; name: string; goal: string; weeks: number; starts_on: string; notes: string;
  member_id: string | null; is_template: boolean; status: 'draft' | 'active' | 'archived'; days: BDay[];
};

const letter = (i: number) => String.fromCharCode(65 + (i % 26));
const newDay = (i: number): BDay => ({ k: uuid(), name: `Allenamento ${letter(i)}`, focus: '', items: [] });
const blank = (memberId: string | null, template: boolean): Draft => ({
  name: '', goal: '', weeks: 4, starts_on: '', notes: '', member_id: memberId, is_template: template, status: 'draft', days: [newDay(0)],
});
const fromProgram = (p: Program): Draft => ({
  id: p.id, name: p.name, goal: p.goal || '', weeks: p.weeks, starts_on: p.starts_on || '', notes: p.notes || '', member_id: p.member_id, is_template: p.is_template, status: p.status,
  days: p.days.map((d) => ({ ...d, k: d.id || uuid(), focus: d.focus || '', items: d.items.map((it) => ({ ...it, k: it.id || uuid() })) })),
});
const payload = (x: Draft) => ({
  id: x.id, name: x.name.trim(), goal: x.goal.trim(), weeks: x.weeks, starts_on: x.starts_on || null, notes: x.notes.trim(), member_id: x.member_id, is_template: x.is_template,
  days: x.days.map((d) => ({
    id: d.id, name: d.name.trim(), focus: (d.focus || '').trim(),
    items: d.items.map((it) => ({
      id: it.id, exercise_id: it.exercise_id, sets: Math.max(1, Math.round(it.sets) || 3), reps: it.reps.trim() || '10', load_hint: it.load_hint?.trim() || null,
      rest_sec: Math.max(0, Math.round(it.rest_sec) || 0), tempo: it.tempo?.trim() || null, note: it.note?.trim() || null, superset: it.superset || null,
    })),
  })),
});

const BIG = ['gambe', 'schiena', 'petto', 'glutei', 'total_body'];
function defaultsFor(e: Exercise): Pick<Item, 'sets' | 'reps' | 'rest_sec'> {
  if (e.muscle_group === 'cardio') return { sets: 1, reps: '10 min', rest_sec: 0 };
  if (e.muscle_group === 'mobilita') return { sets: 2, reps: '30 sec', rest_sec: 30 };
  if (e.muscle_group === 'addome') return { sets: 3, reps: '15', rest_sec: 45 };
  return { sets: 3, reps: '10', rest_sec: BIG.includes(e.muscle_group) ? 90 : 60 };
}

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

function ItemCard({ it, first, last, onChange, onMove, onRemove }: { it: BItem; first: boolean; last: boolean; onChange: (p: Partial<Item>) => void; onMove: (dir: -1 | 1) => void; onRemove: () => void }) {
  const { t } = useTheme();
  const [more, setMore] = useState(!!(it.tempo || it.note || it.superset));
  const num = (s: string) => parseInt(s.replace(/\D/g, ''), 10) || 0;
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <ExerciseTile e={it.exercise} size={40} play={false} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{it.exercise.name}</Text>
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

export default function ProgramBuilder({ id, memberId, template }: { id?: string; memberId?: string; template?: boolean }) {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const src = useAsync(() => (id ? api.program(id) : Promise.resolve(null)), [id]);
  const [p, setP] = useState<Draft | null>(null);
  const [di, setDi] = useState(0);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tplName, setTplName] = useState<string | null>(null);
  const dirty = useRef(false);

  useEffect(() => {
    if (p) return;
    if (!id) setP(blank(memberId || null, !!template || !memberId));
    else if (src.data) setP(fromProgram(src.data));
  }, [src.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const member = useAsync(() => (p?.member_id ? api.profile(p.member_id) : Promise.resolve(null)), [p?.member_id]);

  const edit = (fn: (x: Draft) => Draft) => { dirty.current = true; setP((x) => (x ? fn(x) : x)); };
  const set = (patch: Partial<Draft>) => edit((x) => ({ ...x, ...patch }));
  const setDay = (i: number, patch: Partial<BDay>) => edit((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const setItem = (i: number, k: string, patch: Partial<Item>) => edit((x) => ({ ...x, days: x.days.map((d, j) => (j === i ? { ...d, items: d.items.map((it) => (it.k === k ? { ...it, ...patch } : it)) } : d)) }));
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
  const totalEx = p.days.reduce((a, d) => a + d.items.length, 0);

  const back = async () => {
    if (dirty.current && !(await confirm({ title: 'Uscire senza salvare?', message: 'Le modifiche a questa scheda andranno perse.', confirmLabel: 'Esci senza salvare', destructive: true }))) return;
    nav.pop();
  };

  const check = (activate: boolean): string | null => {
    if (!p.name.trim()) return 'Dai un nome alla scheda.';
    if (p.starts_on && !/^\d{4}-\d{2}-\d{2}$/.test(p.starts_on)) return 'La data di inizio va scritta così: 2026-10-19.';
    if (p.days.some((d) => !d.name.trim())) return 'Ogni giorno ha bisogno di un nome.';
    if (activate && !totalEx) return 'Aggiungi almeno un esercizio prima di attivare la scheda.';
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
      toast('Modello creato: lo trovi nella scheda «Schede».');
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

  const addExercises = (list: Exercise[]) => {
    edit((x) => ({
      ...x, days: x.days.map((d, j) => (j === dIdx ? {
        ...d, items: [...d.items, ...list.map((e): BItem => ({ k: uuid(), exercise_id: e.id, exercise: e, ...defaultsFor(e), load_hint: null, tempo: null, note: null, superset: null }))],
      } : d)),
    }));
    setPicker(false);
  };
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
    if (day.items.length && !(await confirm({ title: `Eliminare «${day.name}»?`, message: `Verranno tolti anche i suoi ${day.items.length} esercizi.`, confirmLabel: 'Elimina il giorno', destructive: true }))) return;
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
          <Field label="Obiettivo" value={p.goal} onChangeText={(goal) => set({ goal })} placeholder="Più forza, tonificazione, ripresa dopo uno stop…" />
          <View style={{ gap: 6 }}>
            <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>Durata</Txt>
            <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
              {(w.includes(p.weeks) ? w : [...w, p.weeks].sort((a, b) => a - b)).map((n) => <Chip key={n} small label={`${n} settimane`} on={p.weeks === n} onPress={() => set({ weeks: n })} />)}
            </View>
          </View>
          {!p.is_template ? (
            <View style={{ gap: 6 }}>
              <Field label="Inizio" value={p.starts_on} onChangeText={(starts_on) => set({ starts_on })} placeholder="2026-10-19" hint="Anno-mese-giorno. Se lo lasci vuoto parte il giorno dell'attivazione." />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Chip small label="Oggi" on={p.starts_on === today} onPress={() => set({ starts_on: today })} />
                <Chip small label="Lunedì prossimo" on={p.starts_on === nextMonday} onPress={() => set({ starts_on: nextMonday })} />
              </View>
            </View>
          ) : null}
          <Field label="Messaggio per il socio" value={p.notes} onChangeText={(notes) => set({ notes })} multiline placeholder="Indicazioni generali: riscaldamento, progressione dei carichi…" />
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
          {day.items.length ? <Txt v="sub" c="faint">{day.items.length} esercizi · circa {estimateMinutes({ ...day, items: day.items })} minuti</Txt> : null}
        </View>

        {day.items.map((it, i) => (
          <ItemCard key={it.k} it={it} first={i === 0} last={i === day.items.length - 1}
            onChange={(patch) => setItem(dIdx, it.k, patch)} onMove={(dir) => moveItem(dIdx, i, dir)} onRemove={() => removeItem(dIdx, it.k)} />
        ))}
        <Button label={day.items.length ? 'Aggiungi altri esercizi' : 'Aggiungi esercizi'} icon="add-circle-outline" kind={day.items.length ? 'secondary' : 'primary'} onPress={() => setPicker(true)} />

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
      <Sheet visible={tplName !== null} onClose={() => setTplName(null)} title="Salva come modello" footer={<Button label="Crea il modello" onPress={saveAsTemplate} loading={busy} />}>
        <Txt c="sub">Il modello è una copia della scheda senza il socio: lo potrai assegnare a chiunque.</Txt>
        <Field label="Nome del modello" value={tplName || ''} onChangeText={setTplName} />
      </Sheet>
    </Page>
  );
}
