// Calendario dell'attività: allenamenti dei soci, schede da rinnovare e appuntamenti, in vista giorno, settimana o mese.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Activity, api, CalEvent, errText, MemberRow, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { NUM, PLATES, useTheme } from '../theme';
import { Button, Chip, Empty, ErrorState, Field, Group, Icon, IconButton, Page, Pill, Row, Segmented, Sheet, Spinner, Txt, useUi } from '../ui';
import { addDays, fmtDate, fmtDateLong, fmtMonthLong, fmtTime, isDayStr, isoDay, parseDay, sameDay, startOfWeek, WEEKDAYS_MON } from '../util';
import { MemberPicker } from './staffMembers';

type Mode = 'day' | 'week' | 'month';
type Kind = CalEvent['kind'];
const KIND_LABEL: Record<Kind, string> = { workout: 'Allenamenti', renewal: 'Schede da rinnovare', activity: 'Appuntamenti' };
const ACT_KINDS: [Activity['kind'], string][] = [['appuntamento', 'Appuntamento'], ['lezione', 'Lezione'], ['altro', 'Altro']];

const monthStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
// le settimane intere (lunedì-domenica) che coprono il mese
function monthGrid(d: Date): Date[] {
  const first = startOfWeek(monthStart(d));
  const last = addDays(startOfWeek(new Date(d.getFullYear(), d.getMonth() + 1, 0)), 6);
  const out: Date[] = [];
  for (let x = first; x <= last; x = addDays(x, 1)) out.push(x);
  return out;
}

export function CalendarScreen() {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const [mode, setMode] = useState<Mode>('week');
  const [cursor, setCursor] = useState(new Date());
  const [picked, setPicked] = useState(new Date());    // giorno selezionato nella vista mese
  const [kinds, setKinds] = useState<Kind[]>(['workout', 'renewal', 'activity']);
  const [member, setMember] = useState<{ id: string; name: string } | null>(null);
  const [pickMember, setPickMember] = useState(false);
  const [edit, setEdit] = useState<Partial<Activity> & { member_name?: string | null } | null>(null);

  const range = useMemo(() => {
    if (mode === 'day') return { from: cursor, to: cursor };
    if (mode === 'week') { const s = startOfWeek(cursor); return { from: s, to: addDays(s, 6) }; }
    const g = monthGrid(cursor); return { from: g[0], to: g[g.length - 1] };
  }, [mode, cursor]);
  const key = `${isoDay(range.from)}|${isoDay(range.to)}`;
  const d = useAsync(() => api.calendar(isoDay(range.from), isoDay(range.to)), [key]);

  const events = useMemo(() => (d.data || []).filter((e) => kinds.includes(e.kind) && (!member || e.member_id === member.id)), [d.data, kinds, member]);
  const byDay = useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    events.forEach((e) => { const k = isoDay(new Date(e.at)); m.set(k, [...(m.get(k) || []), e]); });
    return m;
  }, [events]);
  const dayEvents = (x: Date) => byDay.get(isoDay(x)) || [];

  const step = (n: number) => setCursor((c) => mode === 'day' ? addDays(c, n) : mode === 'week' ? addDays(c, 7 * n) : new Date(c.getFullYear(), c.getMonth() + n, 1));
  const kindColor = (k: Kind) => (k === 'workout' ? t.accent : k === 'renewal' ? t.warn : PLATES[1].c);
  const raw = mode === 'day' ? fmtDateLong(cursor) : mode === 'month' ? fmtMonthLong(cursor) : `${fmtDate(range.from)} – ${fmtDate(range.to)}`;
  const title = raw.charAt(0).toUpperCase() + raw.slice(1);

  const open = (e: CalEvent) => {
    if (e.kind === 'activity') {
      setEdit({ id: e.id, title: e.title, kind: (e.type as Activity['kind']) || 'appuntamento', member_id: e.member_id, member_name: e.member_name, starts_at: e.at, ends_at: e.end_at || null, note: e.note || null });
    } else if (e.member_id) nav.push('member', { id: e.member_id });
  };

  const Event = ({ e }: { e: CalEvent }) => (
    <Pressable accessibilityLabel={`${e.title}${e.member_name ? ', ' + e.member_name : ''}`} onPress={() => open(e)}
      style={({ pressed }: any) => ({ flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, backgroundColor: pressed ? t.card2 : t.card, borderRadius: 14 })}>
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: 2, backgroundColor: kindColor(e.kind) }} />
      <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 15.5, fontWeight: '600' }}>{e.kind === 'renewal' ? `Rinnovare: ${e.title}` : e.title}</Text>
        <Text numberOfLines={1} style={{ color: t.sub, fontSize: 13.5 }}>{[e.member_name, e.kind === 'workout' ? 'allenamento' : e.kind === 'renewal' ? 'scheda in scadenza' : e.type].filter(Boolean).join(' · ')}</Text>
      </View>
      {e.kind !== 'renewal' ? <Text style={[{ color: t.sub, fontSize: 13.5, fontWeight: '600' }, NUM]}>{fmtTime(e.at)}</Text> : null}
    </Pressable>
  );
  const DayList = ({ day, head }: { day: Date; head?: boolean }) => {
    const list = dayEvents(day);
    return (
      <View style={{ gap: 6 }}>
        {head ? (
          <Pressable accessibilityLabel={`Apri ${fmtDateLong(day)}`} onPress={() => { setCursor(day); setMode('day'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
            <Text style={{ color: sameDay(day, new Date()) ? t.accentInk : t.sub, fontSize: 13.5, fontWeight: '700' }}>{fmtDateLong(day)}</Text>
            {sameDay(day, new Date()) ? <Pill label="Oggi" color={t.accentSoft} textColor={t.accentInk} /> : null}
          </Pressable>
        ) : null}
        {list.length ? list.map((e) => <Event key={`${e.kind}${e.id}`} e={e} />) : <Text style={{ color: t.faint, fontSize: 14, paddingHorizontal: 4, paddingVertical: head ? 0 : 12 }}>{head ? 'Niente in programma' : 'Niente in programma per questo giorno.'}</Text>}
      </View>
    );
  };

  const addActivity = (day: Date) => {
    const s = new Date(day); s.setHours(new Date().getHours() + 1 > 21 ? 9 : new Date().getHours() + 1, 0, 0, 0);
    setEdit({ kind: 'appuntamento', starts_at: s.toISOString() });
  };

  return (
    <Page onBack={nav.pop} navTitle="Calendario" right={<IconButton name="add-circle" size={30} color="accentInk" label="Nuova attività" onPress={() => addActivity(mode === 'month' ? picked : cursor)} />}>
      <View style={{ paddingHorizontal: 16, gap: 12, paddingTop: 4 }}>
        <Segmented items={[['Giorno', 'day'], ['Settimana', 'week'], ['Mese', 'month']]} value={mode} onChange={(m) => { setMode(m); if (m === 'month') setPicked(cursor); }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <IconButton name="chevron-back" label="Periodo precedente" bg onPress={() => step(-1)} />
          <Pressable accessibilityLabel="Torna a oggi" onPress={() => { setCursor(new Date()); setPicked(new Date()); }} style={{ flex: 1, alignItems: 'center' }}>
            <Text numberOfLines={1} style={{ color: t.text, fontSize: 17, fontWeight: '700' }}>{title}</Text>
          </Pressable>
          <IconButton name="chevron-forward" label="Periodo successivo" bg onPress={() => step(1)} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
          {(Object.keys(KIND_LABEL) as Kind[]).map((k) => (
            <Chip key={k} small label={KIND_LABEL[k]} on={kinds.includes(k)} color={kindColor(k)} textColor="#fff"
              onPress={() => setKinds(kinds.includes(k) ? kinds.filter((x) => x !== k) : [...kinds, k])} />
          ))}
          <Chip small icon="person-outline" label={member ? member.name : 'Tutti i soci'} on={!!member} onPress={() => (member ? setMember(null) : setPickMember(true))} />
        </ScrollView>

        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
          <>
            {mode === 'day' ? <DayList day={cursor} /> : null}
            {mode === 'week' ? (
              <View style={{ gap: 14 }}>{Array.from({ length: 7 }, (_, i) => addDays(range.from, i)).map((x) => <DayList key={isoDay(x)} day={x} head />)}</View>
            ) : null}
            {mode === 'month' ? (
              <View style={{ gap: 12 }}>
                <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 10, gap: 4 }}>
                  <View style={{ flexDirection: 'row' }}>
                    {WEEKDAYS_MON.map((w, i) => <Text key={i} style={{ flex: 1, textAlign: 'center', color: t.faint, fontSize: 12, fontWeight: '600' }}>{w}</Text>)}
                  </View>
                  {Array.from({ length: Math.ceil(monthGrid(cursor).length / 7) }, (_, r) => (
                    <View key={r} style={{ flexDirection: 'row' }}>
                      {monthGrid(cursor).slice(r * 7, r * 7 + 7).map((x) => {
                        const inMonth = x.getMonth() === cursor.getMonth();
                        const list = dayEvents(x);
                        const sel = sameDay(x, picked);
                        const today = sameDay(x, new Date());
                        return (
                          <Pressable key={isoDay(x)} accessibilityLabel={`${fmtDateLong(x)}, ${list.length} eventi`} onPress={() => setPicked(x)}
                            style={{ flex: 1, height: 52, alignItems: 'center', justifyContent: 'center', gap: 3, borderRadius: 12, backgroundColor: sel ? t.accentSoft : 'transparent', opacity: inMonth ? 1 : 0.35 }}>
                            <View style={{ minWidth: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: today ? t.accent : 'transparent' }}>
                              <Text style={[{ color: today ? t.onAccent : t.text, fontSize: 15, fontWeight: sel || today ? '700' : '500' }, NUM]}>{x.getDate()}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 3, height: 6 }}>
                              {(['workout', 'renewal', 'activity'] as Kind[]).filter((k) => list.some((e) => e.kind === k)).map((k) => <View key={k} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: kindColor(k) }} />)}
                            </View>
                          </Pressable>
                        );
                      })}
                    </View>
                  ))}
                </View>
                <Text style={{ color: t.sub, fontSize: 13.5, fontWeight: '700', paddingHorizontal: 4 }}>{fmtDateLong(picked)}</Text>
                <DayList day={picked} />
              </View>
            ) : null}
          </>
        )}
      </View>

      <MemberPicker visible={pickMember} onClose={() => setPickMember(false)} onPick={(m: MemberRow) => { setPickMember(false); setMember({ id: m.id, name: m.full_name || 'Socio' }); }} />
      <ActivitySheet value={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); bump(); }} />
    </Page>
  );
}

// ───────── Aggiungere o correggere un appuntamento ─────────

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (iso?: string | null) => (iso ? `${pad(new Date(iso).getHours())}:${pad(new Date(iso).getMinutes())}` : '');

function ActivitySheet({ value, onClose, onDone }: { value: (Partial<Activity> & { member_name?: string | null }) | null; onClose: () => void; onDone: () => void }) {
  const { userId } = useSession();
  const { toast, confirm } = useUi();
  const [f, setF] = useState({ title: '', kind: 'appuntamento' as Activity['kind'], day: '', from: '', to: '', note: '' });
  const [who, setWho] = useState<{ id: string; name: string } | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!value) return;
    setF({ title: value.title || '', kind: value.kind || 'appuntamento', day: value.starts_at ? isoDay(new Date(value.starts_at)) : isoDay(new Date()), from: hhmm(value.starts_at), to: hhmm(value.ends_at), note: value.note || '' });
    setWho(value.member_id ? { id: value.member_id, name: value.member_name || 'Socio' } : null);
  }, [value]);

  const at = (day: string, time: string) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!isDayStr(day) || !m || +m[1] > 23 || +m[2] > 59) return null;
    const x = parseDay(day); x.setHours(+m[1], +m[2], 0, 0); return x;
  };
  const save = async () => {
    if (!f.title.trim()) return toast('Scrivi di cosa si tratta.', 'error');
    const start = at(f.day, f.from);
    if (!start) return toast('Controlla data e ora: per esempio 2026-11-03 e 18:30.', 'error');
    let end: Date | null = null;
    if (f.to.trim()) { end = at(f.day, f.to); if (!end) return toast('L\'ora di fine va scritta così: 19:30.', 'error'); if (end < start) return toast('La fine non può essere prima dell\'inizio.', 'error'); }
    setBusy(true);
    try {
      await api.saveActivity({ id: value?.id, title: f.title, kind: f.kind, member_id: who?.id || null, starts_at: start.toISOString(), ends_at: end ? end.toISOString() : null, note: f.note }, userId!);
      toast('Salvato.'); onDone();
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!value?.id) return;
    if (!(await confirm({ title: 'Eliminare l\'appuntamento?', confirmLabel: 'Elimina', destructive: true }))) return;
    try { await api.deleteActivity(value.id); onDone(); } catch (e) { toast(errText(e), 'error'); }
  };
  return (
    <>
      <Sheet visible={!!value && !pick} onClose={onClose} title={value?.id ? 'Modifica attività' : 'Nuova attività'}
        footer={<><Button label="Salva" onPress={save} loading={busy} />{value?.id ? <Button label="Elimina" kind="ghost" onPress={del} /> : null}</>}>
        <Field label="Cosa" value={f.title} onChangeText={(s) => setF({ ...f, title: s })} placeholder="Per esempio Prima valutazione" maxLength={80} />
        <Segmented items={ACT_KINDS.map(([k, l]): [string, Activity['kind']] => [l, k])} value={f.kind} onChange={(k) => setF({ ...f, kind: k })} />
        <Field label="Giorno" value={f.day} onChangeText={(s) => setF({ ...f, day: s })} hint="Anno-mese-giorno, per esempio 2026-11-03." />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Dalle" value={f.from} onChangeText={(s) => setF({ ...f, from: s })} placeholder="18:30" style={{ flex: 1 }} />
          <Field label="Alle (facoltativo)" value={f.to} onChangeText={(s) => setF({ ...f, to: s })} placeholder="19:30" style={{ flex: 1 }} />
        </View>
        <Group>
          <Row title="Socio" value={who?.name || 'Nessuno'} chevron onPress={() => setPick(true)} />
          {who ? <Row title="Togli il socio" onPress={() => setWho(null)} /> : null}
        </Group>
        <Field label="Note" value={f.note} onChangeText={(s) => setF({ ...f, note: s })} multiline maxLength={300} />
      </Sheet>
      <MemberPicker visible={pick} onClose={() => setPick(false)} onPick={(m: MemberRow) => { setPick(false); setWho({ id: m.id, name: m.full_name || 'Socio' }); }} />
    </>
  );
}
