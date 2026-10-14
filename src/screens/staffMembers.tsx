// Schermate dello staff (PT e titolare): elenco soci e scheda del singolo socio.
import React, { createContext, useContext, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { api, errText, MemberRow, Profile, ProgramRow, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { Avatar, Button, Chip, Empty, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Sheet, Spinner, Txt, useUi } from '../ui';
import { ago, daysSince, fmtDate, fmtDateShortY, norm, parseDay, startOfDay } from '../util';
import { SearchBox } from './shared';
import { programWeek } from './Today';

// ───────── Filtro dell'elenco soci (condiviso con la scheda Palestra, che può aprirne uno già impostato) ─────────

export type MFilter = 'all' | 'mine' | 'nop' | 'exp' | 'idle' | 'off';
const FilterCtx = createContext<{ filter: MFilter; setFilter: (f: MFilter) => void }>({ filter: 'all', setFilter() {} });
export const useMemberFilter = () => useContext(FilterCtx);
export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<MFilter>('all');
  const v = useMemo(() => ({ filter, setFilter }), [filter]);
  return <FilterCtx.Provider value={v}>{children}</FilterCtx.Provider>;
}

export function memberFlags(m: Pick<MemberRow, 'program_id' | 'program_ends_on' | 'last_workout_at' | 'active'>, now = new Date()) {
  const left = m.program_ends_on ? Math.round((parseDay(m.program_ends_on).getTime() - startOfDay(now).getTime()) / 86400000) : null;
  const idle = daysSince(m.last_workout_at, now);
  return {
    left, idle,
    noProgram: m.program_id == null,
    expiring: m.program_id != null && left !== null && left <= 7,
    inactive: idle === null || idle >= 14,
  };
}

const WARN_BG = 'rgba(255,178,36,0.18)';

// ───────── Elenco soci ─────────

export function MembersTab() {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { filter, setFilter } = useMemberFilter();
  const d = useAsync(() => api.members(), []);
  const [q, setQ] = useState('');

  const all = d.data || [];
  const flags = useMemo(() => new Map(all.map((m) => [m.id, memberFlags(m)])), [all]);
  const counts = useMemo(() => {
    const act = all.filter((m) => m.active);
    return {
      all: act.length,
      mine: act.filter((m) => m.trainer_id === userId).length,
      nop: act.filter((m) => flags.get(m.id)!.noProgram).length,
      exp: act.filter((m) => flags.get(m.id)!.expiring).length,
      idle: act.filter((m) => !flags.get(m.id)!.noProgram && flags.get(m.id)!.inactive).length,
      off: all.filter((m) => !m.active).length,
    };
  }, [all, flags, userId]);

  const list = useMemo(() => {
    const n = norm(q.trim());
    return all.filter((m) => {
      const f = flags.get(m.id)!;
      if (filter === 'off') { if (m.active) return false; }
      else if (!m.active) return false;
      if (filter === 'mine' && m.trainer_id !== userId) return false;
      if (filter === 'nop' && !f.noProgram) return false;
      if (filter === 'exp' && !f.expiring) return false;
      if (filter === 'idle' && (f.noProgram || !f.inactive)) return false;
      return !n || norm(m.full_name || '').includes(n) || norm(m.email || '').includes(n) || (m.phone || '').replace(/\s/g, '').includes(n.replace(/\s/g, ''));
    });
  }, [all, flags, filter, q, userId]);

  const chips: [MFilter, string][] = [['all', 'Tutti'], ['mine', 'Miei'], ['nop', 'Senza scheda'], ['exp', 'In scadenza'], ['idle', 'Fermi da 2 settimane'], ['off', 'Disattivati']];

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View style={{ paddingHorizontal: 16 }}><SearchBox value={q} onChange={setQ} placeholder="Cerca un socio" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
        {chips.map(([k, label]) => <Chip key={k} label={counts[k] ? `${label} · ${counts[k]}` : label} on={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>
    </View>
  );

  return (
    <Page title="Soci" subtitle={d.data ? `${counts.all} iscritti attivi` : undefined} scroll={false}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <FlatList
          data={list}
          keyExtractor={(m: MemberRow) => m.id}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty icon="people-outline" title={q ? 'Nessun socio trovato' : filter === 'nop' ? 'Tutti hanno una scheda' : filter === 'exp' ? 'Nessuna scheda in scadenza' : 'Nessun socio qui'}
            text={q ? 'Prova con il cognome o con il numero di telefono.' : filter === 'all' ? 'I soci compaiono qui appena si registrano con il codice della palestra.' : undefined} />}
          renderItem={({ item: m }: { item: MemberRow }) => {
            const f = flags.get(m.id)!;
            const pill = !m.active ? <Pill label="Disattivato" />
              : f.noProgram ? <Pill label="Senza scheda" color={WARN_BG} textColor={t.warn} />
              : f.left !== null && f.left < 0 ? <Pill label="Scheda scaduta" color={WARN_BG} textColor={t.warn} />
              : f.expiring ? <Pill label={f.left === 0 ? 'Scade oggi' : `Scade tra ${f.left} gg`} color={WARN_BG} textColor={t.warn} />
              : null;
            return (
              <Pressable accessibilityLabel={m.full_name || 'Socio'} onPress={() => nav.push('member', { id: m.id })}
                style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: pressed ? t.card2 : t.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 8 })}>
                <Avatar name={m.full_name} size={44} />
                <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{m.full_name || 'Senza nome'}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 14 }}>{m.program_name || 'Nessuna scheda'}</Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  {pill}
                  <Text style={{ color: t.faint, fontSize: 12.5 }}>{m.last_workout_at ? `allenato ${ago(m.last_workout_at)}` : 'mai allenato'}</Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </Page>
  );
}

// ───────── Scelta di un modello / di un socio ─────────

export function TemplatePicker({ visible, onClose, onPick, busy }: { visible: boolean; onClose: () => void; onPick: (t: ProgramRow) => void; busy?: boolean }) {
  const { t } = useTheme();
  const d = useAsync(() => api.templates(), []);
  return (
    <Sheet visible={visible} onClose={onClose} title="Scegli un modello">
      {d.loading && !d.data ? <Spinner pad={20} /> : !d.data?.length ? (
        <Txt c="sub">Non hai ancora modelli. Crea una scheda e salvala come modello dalla scheda «Schede»: la potrai riusare con tutti i soci.</Txt>
      ) : (
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {d.data.map((p, i) => (
            <Pressable key={p.id} accessibilityLabel={p.name} disabled={busy} onPress={() => onPick(p)}
              style={({ pressed }: any) => ({ padding: 14, gap: 2, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.card : 'transparent', opacity: busy ? 0.5 : 1 })}>
              <Text style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{p.name}</Text>
              <Text style={{ color: t.sub, fontSize: 14 }}>{[p.goal, `${p.weeks} settimane`].filter(Boolean).join(' · ')}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Sheet>
  );
}

export function MemberPicker({ visible, onClose, onPick, busy }: { visible: boolean; onClose: () => void; onPick: (m: MemberRow) => void; busy?: boolean }) {
  const { t } = useTheme();
  const d = useAsync(() => api.members(), []);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = norm(q.trim());
    return (d.data || []).filter((m) => m.active && (!n || norm(m.full_name || '').includes(n)));
  }, [d.data, q]);
  return (
    <Sheet visible={visible} onClose={onClose} title="Per quale socio?">
      <SearchBox value={q} onChange={setQ} placeholder="Cerca un socio" />
      {d.loading && !d.data ? <Spinner pad={20} /> : (
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {list.map((m, i) => (
            <Pressable key={m.id} accessibilityLabel={m.full_name || 'Socio'} disabled={busy} onPress={() => onPick(m)}
              style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.card : 'transparent', opacity: busy ? 0.5 : 1 })}>
              <Avatar name={m.full_name} size={36} />
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>{m.full_name}</Text>
                <Text numberOfLines={1} style={{ color: t.sub, fontSize: 13 }}>{m.program_name || 'Nessuna scheda'}</Text>
              </View>
            </Pressable>
          ))}
          {!list.length ? <View style={{ padding: 20 }}><Txt c="sub" style={{ textAlign: 'center' }}>Nessun socio trovato.</Txt></View> : null}
        </View>
      )}
    </Sheet>
  );
}

// ───────── Scheda del socio ─────────

function Tile({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress}
      style={({ pressed }: any) => ({ flex: 1, minHeight: 64, borderRadius: 14, backgroundColor: pressed ? t.card : t.card2, alignItems: 'center', justifyContent: 'center', gap: 4 })}>
      <Icon name={icon} size={22} color="accentInk" />
      <Text style={{ color: t.text, fontSize: 13, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function MemberDetail({ id }: { id: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const d = useAsync(async () => {
    const [m, programs, workouts, notes, staff] = await Promise.all([api.profile(id), api.programsOf(id), api.workouts(id, 5), api.notes(id), api.staffProfiles()]);
    return { m, programs, workouts, notes, staff };
  }, [id]);
  const [pick, setPick] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState('');
  const [ptOpen, setPtOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const m: Profile | null | undefined = d.data?.m;
  const name = m?.full_name || 'Socio';
  const programs = d.data?.programs || [];
  const active = programs.find((p) => p.status === 'active');
  const drafts = programs.filter((p) => p.status === 'draft' && !p.is_template);
  const past = programs.filter((p) => p.status === 'archived');
  const staffName = (sid?: string | null) => d.data?.staff.find((s) => s.id === sid)?.full_name;
  const w = active ? programWeek(active) : null;

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); bump(); if (ok) toast(ok); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const fromTemplate = (tpl: ProgramRow) => run(async () => {
    const nid = await api.copyProgram(tpl.id, id, false);
    setPick(false);
    nav.push('builder', { id: nid });
  });
  const archive = async () => {
    if (!active || !(await confirm({ title: 'Archiviare la scheda?', message: `${name} non vedrà più la scheda «${active.name}» e non avrà una scheda attiva finché non ne assegni un'altra.`, confirmLabel: 'Archivia' }))) return;
    await run(() => api.archiveProgram(active.id), 'Scheda archiviata.');
  };
  const setActive = async (v: boolean) => {
    if (!v && !(await confirm({ title: 'Disattivare l\'iscrizione?', message: 'Il socio esce dall\'elenco dei soci attivi. Schede e allenamenti restano salvati.', confirmLabel: 'Disattiva' }))) return;
    await run(() => api.updateProfile(id, { active: v }), v ? 'Iscrizione riattivata.' : 'Iscrizione disattivata.');
  };
  const addNote = async () => {
    if (!note.trim() || !userId) return;
    await run(async () => { await api.addNote(id, userId, note); setNote(''); setNoteOpen(false); }, 'Nota salvata.');
  };
  const phoneDigits = (m?.phone || '').replace(/\D/g, '');
  const wa = phoneDigits ? (phoneDigits.length === 10 ? '39' + phoneDigits : phoneDigits) : '';

  return (
    <Page onBack={nav.pop} navTitle={name}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : !m ? <Empty title="Socio non trovato" /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <Avatar name={name} size={64} />
              <View style={{ flex: 1, gap: 4 }}>
                <Txt v="title">{name}</Txt>
                <Txt v="sub" c="sub">Iscritto dal {fmtDateShortY(m.created_at)}</Txt>
                {!m.active ? <Pill label="Disattivato" /> : null}
              </View>
            </View>
            {m.goal ? <View style={{ backgroundColor: t.card2, borderRadius: 14, padding: 12, gap: 2 }}><Txt v="cap" c="sub">Obiettivo</Txt><Txt>{m.goal}</Txt></View> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Tile icon="stats-chart" label="Progressi" onPress={() => nav.push('member-progress', { id, name })} />
              {m.phone ? <Tile icon="call" label="Chiama" onPress={() => Linking.openURL(`tel:${m.phone}`)} /> : null}
              {wa ? <Tile icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} /> : null}
            </View>
          </View>

          <SectionTitle>Scheda attiva</SectionTitle>
          {active ? (
            <>
              <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 8 }}>
                <Txt v="head">{active.name}</Txt>
                {active.goal ? <Txt v="sub" c="sub">{active.goal}</Txt> : null}
                {w ? (
                  <View style={{ gap: 6 }}>
                    <View style={{ height: 6, borderRadius: 3, backgroundColor: t.card2 }}><View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (w.n / w.total) * 100)}%` as any, backgroundColor: w.over ? t.warn : t.accent }} /></View>
                    <Txt v="cap" c="sub">{w.over ? 'Scheda terminata' : `Settimana ${w.n} di ${w.total}`} · fine {fmtDate(w.endsOn)}</Txt>
                  </View>
                ) : null}
              </View>
              <Group>
                <Row title="Apri la scheda" left={<Icon name="clipboard-outline" size={22} color="accentInk" />} chevron onPress={() => nav.push('program', { id: active.id, memberName: name })} />
                <Row title="Modifica la scheda" left={<Icon name="create-outline" size={22} color="accentInk" />} chevron onPress={() => nav.push('builder', { id: active.id })} />
                <Row title="Prepara la prossima scheda" sub="Parte da un modello: la attivi quando è pronta." left={<Icon name="copy-outline" size={22} color="accentInk" />} chevron onPress={() => setPick(true)} />
                <Row title="Archivia" left={<Icon name="archive-outline" size={22} color="sub" />} onPress={archive} />
              </Group>
            </>
          ) : (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
              <Txt c="sub">{name.split(' ')[0]} non ha una scheda attiva.</Txt>
              <Button label="Parti da un modello" icon="copy-outline" onPress={() => setPick(true)} />
              <Button label="Crea da zero" kind="secondary" icon="add" onPress={() => nav.push('builder', { memberId: id })} />
            </View>
          )}

          {drafts.length ? (
            <>
              <SectionTitle>Bozze</SectionTitle>
              <Group>
                {drafts.map((p) => <Row key={p.id} title={p.name} sub="Non ancora visibile al socio" left={<Icon name="create-outline" size={22} color="sub" />} chevron onPress={() => nav.push('builder', { id: p.id })} />)}
              </Group>
            </>
          ) : null}

          {d.data!.workouts.length ? (
            <>
              <SectionTitle right={<Pressable accessibilityLabel="Vedi tutti i progressi" onPress={() => nav.push('member-progress', { id, name })}><Text style={{ color: t.accentInk, fontSize: 14.5, fontWeight: '600' }}>Vedi tutti</Text></Pressable>}>Ultimi allenamenti</SectionTitle>
              <Group>
                {d.data!.workouts.map((x) => (
                  <Row key={x.id} title={x.day_name || 'Allenamento'} sub={ago(x.started_at)} chevron onPress={() => nav.push('workout-detail', { workout: x })}
                    right={x.rpe ? <Pill label={x.rpe >= 10 ? 'Al limite' : x.rpe >= 8 ? 'Duro' : x.rpe >= 7 ? 'Giusto' : 'Facile'} /> : undefined} />
                ))}
              </Group>
            </>
          ) : null}

          {past.length ? (
            <>
              <SectionTitle>Schede precedenti</SectionTitle>
              <Group>
                {past.map((p) => <Row key={p.id} title={p.name} sub={p.starts_on ? `dal ${fmtDateShortY(p.starts_on)} · ${p.weeks} settimane` : `${p.weeks} settimane`} chevron onPress={() => nav.push('program', { id: p.id, memberName: name })} />)}
              </Group>
            </>
          ) : null}

          <SectionTitle right={<Pressable accessibilityLabel="Aggiungi una nota" onPress={() => setNoteOpen(true)} hitSlop={8}><Text style={{ color: t.accentInk, fontSize: 14.5, fontWeight: '600' }}>Aggiungi</Text></Pressable>}>Note riservate</SectionTitle>
          {d.data!.notes.length ? (
            <Group>
              {d.data!.notes.map((n) => <Row key={n.id} title={n.body} lines={6} sub={`${staffName(n.author_id) || 'Staff'} · ${ago(n.created_at)}`} minHeight={64} />)}
            </Group>
          ) : <Txt v="sub" c="faint" style={{ paddingHorizontal: 4 }}>Nessuna nota. Le vede solo lo staff, mai il socio.</Txt>}
          <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>Scrivi solo ciò che serve ad allenarlo meglio. Evita diagnosi e dettagli sanitari: sono dati particolarmente protetti.</Txt>

          <SectionTitle>Gestione</SectionTitle>
          <Group>
            <Row title="Personal trainer" value={staffName(m.trainer_id) || 'Non assegnato'} chevron onPress={() => setPtOpen(true)} />
            <Row title="Telefono" value={m.phone || '–'} />
            <Row title="Email" value={m.email || '–'} />
            <Row title={m.active ? 'Disattiva l\'iscrizione' : 'Riattiva l\'iscrizione'} danger={m.active} onPress={() => setActive(!m.active)} />
          </Group>
        </View>
      )}

      <TemplatePicker visible={pick} onClose={() => setPick(false)} onPick={fromTemplate} busy={busy} />
      <Sheet visible={noteOpen} onClose={() => setNoteOpen(false)} title="Nuova nota" footer={<Button label="Salva la nota" onPress={addNote} loading={busy} disabled={!note.trim()} />}>
        <Field value={note} onChangeText={setNote} multiline placeholder="Per esempio: preferisce allenarsi la mattina, evita gli esercizi sopra la testa." />
      </Sheet>
      <Sheet visible={ptOpen} onClose={() => setPtOpen(false)} title="Personal trainer">
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {[{ id: null as string | null, full_name: 'Nessuno' }, ...(d.data?.staff || [])].map((s, i) => {
            const on = (m?.trainer_id ?? null) === s.id;
            return (
              <Pressable key={s.id ?? 'none'} accessibilityLabel={s.full_name || ''} onPress={async () => { setPtOpen(false); await run(() => api.updateProfile(id, { trainer_id: s.id }), 'PT aggiornato.'); }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderTopWidth: i ? 1 : 0, borderTopColor: t.line }}>
                <Text style={{ flex: 1, color: t.text, fontSize: 16.5 }}>{s.full_name}</Text>
                {on ? <Icon name="checkmark" size={22} color="accentInk" /> : null}
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </Page>
  );
}
