// Schermate dello staff (PT e titolare): elenco soci e scheda del singolo socio.
import React, { createContext, useContext, useMemo, useState } from 'react';
import { FlatList, Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { api, errText, MemberRow, Profile, ProgramRow, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { BRAND } from '../brand';
import { shareCsv, shareText } from '../share';
import { Avatar, Button, Chip, Empty, ErrorState, Field, Group, Icon, IconButton, Page, Pill, Row, SectionTitle, Segmented, Sheet, Spinner, Txt, useUi } from '../ui';
import { ageOf, ago, daysSince, fmtDate, fmtDateShortY, isDayStr, norm, parseDay, startOfDay, toCsv } from '../util';
import { SearchBox } from './shared';
import { programWeek } from './Today';

// ───────── Filtro dell'elenco soci (condiviso con la scheda Palestra, che può aprirne uno già impostato) ─────────

export type MFilter = 'all' | 'mine' | 'nop' | 'exp' | 'idle' | 'off';
export type PView = 'assigned' | 'templates';
const FilterCtx = createContext<{ filter: MFilter; setFilter: (f: MFilter) => void; pview: PView; setPview: (v: PView) => void }>({ filter: 'all', setFilter() {}, pview: 'assigned', setPview() {} });
export const useMemberFilter = () => useContext(FilterCtx);
export function StaffProvider({ children }: { children: React.ReactNode }) {
  const [filter, setFilter] = useState<MFilter>('all');
  const [pview, setPview] = useState<PView>('assigned');
  const v = useMemo(() => ({ filter, setFilter, pview, setPview }), [filter, pview]);
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

export function splitName(full?: string | null): [string, string] {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  return parts.length < 2 ? [parts[0] || '', ''] : [parts[0], parts.slice(1).join(' ')];
}
type SortKey = 'cognome' | 'nome' | 'pt' | 'email' | 'ultimo' | 'iscritto';
const SORTS: [SortKey, string][] = [['cognome', 'Cognome'], ['nome', 'Nome'], ['pt', 'Personal trainer'], ['email', 'Email'], ['ultimo', 'Ultimo allenamento'], ['iscritto', 'Data di iscrizione']];
const cmpStr = (a: string, b: string) => a.localeCompare(b, 'it', { sensitivity: 'base' });
function sortMembers(list: MemberRow[], key: SortKey, desc: boolean): MemberRow[] {
  const f = (m: MemberRow): string | number => {
    const [n, c] = splitName(m.full_name);
    switch (key) {
      case 'cognome': return `${c} ${n}`;
      case 'nome': return `${n} ${c}`;
      case 'pt': return m.trainer_name || '￿';
      case 'email': return m.email || '￿';
      case 'ultimo': return m.last_workout_at ? new Date(m.last_workout_at).getTime() : 0;
      default: return new Date(m.created_at).getTime();
    }
  };
  const out = [...list].sort((a, b) => { const x = f(a), y = f(b); return typeof x === 'number' ? x - (y as number) : cmpStr(x, y as string); });
  return desc ? out.reverse() : out;
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress}
      style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18, backgroundColor: pressed ? t.card : t.card2 })}>
      <Icon name={icon} size={16} color="accentInk" />
      <Text style={{ color: t.text, fontSize: 13.5, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

const whatsappNumber = (phone?: string | null) => { const d = (phone || '').replace(/\D/g, ''); return d ? (d.length === 10 ? '39' + d : d) : ''; };

export function MembersTab() {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast } = useUi();
  const { filter, setFilter } = useMemberFilter();
  const d = useAsync(() => api.members(), []);
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<SortKey>('cognome');
  const [desc, setDesc] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

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
    const rows = all.filter((m) => {
      const f = flags.get(m.id)!;
      if (filter === 'off') { if (m.active) return false; }
      else if (!m.active) return false;
      if (filter === 'mine' && m.trainer_id !== userId) return false;
      if (filter === 'nop' && !f.noProgram) return false;
      if (filter === 'exp' && !f.expiring) return false;
      if (filter === 'idle' && (f.noProgram || !f.inactive)) return false;
      return !n || norm(m.full_name || '').includes(n) || norm(m.email || '').includes(n) || (m.phone || '').replace(/\s/g, '').includes(n.replace(/\s/g, ''));
    });
    return sortMembers(rows, sort, desc);
  }, [all, flags, filter, q, userId, sort, desc]);

  const exportCsv = async () => {
    const head = ['Cognome', 'Nome', 'Email', 'Telefono', 'Sesso', 'Data di nascita', 'Personal trainer', 'Scheda attiva', 'Fine scheda', 'Ultimo allenamento', 'Allenamenti negli ultimi 30 giorni', 'Stato', 'Iscritto dal'];
    const body = list.map((m) => { const [n, c] = splitName(m.full_name); return [c, n, m.email, m.phone, m.sex === 'm' ? 'Uomo' : m.sex === 'f' ? 'Donna' : '', m.birth_date, m.trainer_name, m.program_name, m.program_ends_on,
      m.last_workout_at ? m.last_workout_at.slice(0, 10) : '', m.workouts_30d, m.active ? 'Attivo' : 'Disattivato', m.created_at.slice(0, 10)]; });
    try { await shareCsv(filter === 'off' ? 'soci-disattivati.csv' : 'soci.csv', toCsv([head, ...body])); } catch (e) { toast(errText(e), 'error'); }
  };

  const chips: [MFilter, string][] = [['all', 'Attivi'], ['mine', 'Miei'], ['nop', 'Senza scheda'], ['exp', 'In scadenza'], ['idle', 'Fermi da 2 settimane'], ['off', 'Disattivati']];
  const sortLabel = SORTS.find(([k]) => k === sort)![1];

  const header = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View style={{ paddingHorizontal: 16 }}><SearchBox value={q} onChange={setQ} placeholder="Cerca per nome, email o telefono" /></View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
        {chips.map(([k, label]) => <Chip key={k} label={counts[k] ? `${label} · ${counts[k]}` : label} on={filter === k} onPress={() => setFilter(k)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20 }}>
        <Pressable accessibilityLabel={`Ordina per ${sortLabel}`} onPress={() => setSortOpen(true)} hitSlop={8} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Icon name="swap-vertical" size={16} color="accentInk" />
          <Text style={{ color: t.accentInk, fontSize: 14, fontWeight: '600' }}>{sortLabel}{desc ? ' ↓' : ' ↑'}</Text>
        </Pressable>
        <Text style={{ color: t.faint, fontSize: 13.5 }}>{list.length} {list.length === 1 ? 'socio' : 'soci'}</Text>
      </View>
    </View>
  );

  return (
    <Page title="Soci" maxWidth="wide" subtitle={d.data ? `${counts.all} iscritti attivi` : undefined} scroll={false}
      right={<>
        <IconButton name="download-outline" label="Esporta l'elenco" color="accentInk" onPress={exportCsv} />
        <IconButton name="person-add" label="Invita un socio" color="accentInk" onPress={() => setInviteOpen(true)} />
      </>}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <FlatList
          data={list}
          keyExtractor={(m: MemberRow) => m.id}
          extraData={openId}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Empty icon="people-outline" title={q ? 'Nessun socio trovato' : filter === 'nop' ? 'Tutti hanno una scheda' : filter === 'exp' ? 'Nessuna scheda in scadenza' : 'Nessun socio qui'}
            text={q ? 'Prova con il cognome o con il numero di telefono.' : filter === 'all' ? 'I soci compaiono qui appena si registrano con il codice della palestra.' : undefined}
            action={!q && filter === 'all' ? <Button label="Invita un socio" icon="person-add" small full={false} onPress={() => setInviteOpen(true)} /> : undefined} />}
          renderItem={({ item: m }: { item: MemberRow }) => {
            const f = flags.get(m.id)!;
            const open = openId === m.id;
            const pill = !m.active ? <Pill label="Disattivato" />
              : f.noProgram ? <Pill label="Senza scheda" color={WARN_BG} textColor={t.warn} />
              : f.left !== null && f.left < 0 ? <Pill label="Scheda scaduta" color={WARN_BG} textColor={t.warn} />
              : f.expiring ? <Pill label={f.left === 0 ? 'Scade oggi' : `Scade tra ${f.left} gg`} color={WARN_BG} textColor={t.warn} />
              : null;
            const wa = whatsappNumber(m.phone);
            return (
              <View style={{ backgroundColor: t.card, borderRadius: 16, marginHorizontal: 16, marginBottom: 8, overflow: 'hidden' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Pressable accessibilityLabel={m.full_name || 'Socio'} onPress={() => nav.push('member', { id: m.id })}
                    style={({ pressed }: any) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, backgroundColor: pressed ? t.card2 : 'transparent' })}>
                    <Avatar name={m.full_name} size={44} />
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text numberOfLines={1} style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{m.full_name || 'Senza nome'}</Text>
                      <Text numberOfLines={1} style={{ color: t.sub, fontSize: 14 }}>{m.program_name || 'Nessuna scheda'}{m.trainer_name ? ` · ${m.trainer_name}` : ''}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {pill}
                      <Text style={{ color: t.faint, fontSize: 12.5 }}>{m.last_workout_at ? `allenato ${ago(m.last_workout_at)}` : 'mai allenato'}</Text>
                    </View>
                  </Pressable>
                  <Pressable accessibilityLabel={open ? 'Chiudi le azioni rapide' : 'Azioni rapide'} onPress={() => setOpenId(open ? null : m.id)} hitSlop={6}
                    style={{ width: 40, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' }}>
                    <Icon name={open ? 'chevron-up' : 'chevron-down'} size={20} color="faint" />
                  </Pressable>
                </View>
                {open ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 12, paddingBottom: 12 }}>
                    <QuickAction icon="clipboard-outline" label="Scheda" onPress={() => (m.program_id ? nav.push('program', { id: m.program_id, memberName: m.full_name }) : nav.push('builder', { memberId: m.id }))} />
                    <QuickAction icon="stats-chart-outline" label="Report" onPress={() => nav.push('report', { id: m.id, name: m.full_name })} />
                    <QuickAction icon="body-outline" label="Peso e misure" onPress={() => nav.push('body', { id: m.id, name: m.full_name })} />
                    <QuickAction icon="medkit-outline" label="Anamnesi" onPress={() => nav.push('anamnesis', { id: m.id, name: m.full_name })} />
                    <QuickAction icon="options-outline" label="Preferenze" onPress={() => nav.push('prefs', { id: m.id, name: m.full_name })} />
                    <QuickAction icon="document-text-outline" label="Documenti" onPress={() => nav.push('documents', { memberId: m.id, name: m.full_name })} />
                    {m.phone ? <QuickAction icon="call-outline" label="Chiama" onPress={() => Linking.openURL(`tel:${m.phone}`)} /> : null}
                    {wa ? <QuickAction icon="logo-whatsapp" label="WhatsApp" onPress={() => Linking.openURL(`https://wa.me/${wa}`)} /> : null}
                  </View>
                ) : null}
              </View>
            );
          }}
          ListFooterComponent={list.length ? <Text style={{ color: t.faint, fontSize: 13, textAlign: 'center', paddingTop: 8 }}>Totale: {list.length} {list.length === 1 ? 'socio' : 'soci'}</Text> : null}
        />
      )}

      <Sheet visible={sortOpen} onClose={() => setSortOpen(false)} title="Ordina per">
        <Group>
          {SORTS.map(([k, label]) => (
            <Row key={k} title={label} right={sort === k ? <Icon name="checkmark" size={22} color="accentInk" /> : undefined} onPress={() => { setSort(k); setDesc(k === 'ultimo' || k === 'iscritto'); setSortOpen(false); }} />
          ))}
        </Group>
        <Segmented items={[['Crescente', 'asc'], ['Decrescente', 'desc']]} value={desc ? 'desc' : 'asc'} onChange={(v) => setDesc(v === 'desc')} />
      </Sheet>
      <InviteSheet visible={inviteOpen} onClose={() => setInviteOpen(false)} />
    </Page>
  );
}

// ───────── Invito di un nuovo socio ─────────

function InviteSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTheme();
  const { toast } = useUi();
  const gym = useAsync(() => api.gym(), []);
  const code = gym.data?.join_code || null;
  const message = `Ciao! Scarica l'app ${BRAND.gymName} e registrati${code ? ` con il codice ${code}` : ''}: avrai la tua scheda di allenamento sempre con te.`;
  return (
    <Sheet visible={visible} onClose={onClose} title="Invita un socio">
      <Txt c="sub">Il socio scarica l'app, si registra con il codice della palestra e compare qui in automatico. Poi gli assegni una scheda.</Txt>
      <View style={{ backgroundColor: t.card2, borderRadius: 16, padding: 16, alignItems: 'center', gap: 4 }}>
        <Txt v="cap" c="sub">Codice della palestra</Txt>
        {gym.loading && !gym.data ? <Spinner pad={6} /> : code ? <Text selectable style={[{ color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: 2 }]}>{code}</Text>
          : <Txt c="faint" style={{ textAlign: 'center' }}>Nessun codice impostato. Lo scegli il titolare in Altro → Iscrizione.</Txt>}
      </View>
      <View style={{ backgroundColor: t.card2, borderRadius: 16, padding: 14 }}><Text selectable style={{ color: t.text, fontSize: 15, lineHeight: 21 }}>{message}</Text></View>
      <Button label="Invia su WhatsApp" icon="logo-whatsapp" onPress={() => Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`)} />
      <Button label="Condividi il messaggio" icon="share-outline" kind="secondary" onPress={async () => { try { if ((await shareText(message)) === 'copied') toast('Messaggio copiato: incollalo dove vuoi.'); } catch (e) { toast(errText(e), 'error'); } }} />
    </Sheet>
  );
}

// ───────── Scelta di più soci (documenti, avvisi) ─────────

export function MembersMultiPicker({ visible, onClose, value, onChange, title = 'Scegli i soci' }: { visible: boolean; onClose: () => void; value: string[]; onChange: (v: string[]) => void; title?: string }) {
  const { t } = useTheme();
  const d = useAsync(() => api.members(), []);
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const n = norm(q.trim());
    return sortMembers((d.data || []).filter((m) => m.active && (!n || norm(m.full_name || '').includes(n))), 'cognome', false);
  }, [d.data, q]);
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title} right={value.length ? <Pill label={`${value.length} ${value.length === 1 ? 'scelto' : 'scelti'}`} color={t.accentSoft} textColor={t.accentInk} /> : undefined}
      footer={<Button label="Fatto" onPress={onClose} />}>
      <SearchBox value={q} onChange={setQ} placeholder="Cerca un socio" />
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Button small kind="secondary" full={false} label="Tutti" onPress={() => onChange((d.data || []).filter((m) => m.active).map((m) => m.id))} />
        <Button small kind="ghost" full={false} label="Nessuno" onPress={() => onChange([])} />
      </View>
      {d.loading && !d.data ? <Spinner pad={20} /> : (
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {list.map((m, i) => {
            const on = value.includes(m.id);
            return (
              <Pressable key={m.id} accessibilityLabel={m.full_name || 'Socio'} accessibilityState={{ selected: on }} onPress={() => toggle(m.id)}
                style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: pressed ? t.card : 'transparent' })}>
                <Avatar name={m.full_name} size={36} />
                <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 16, fontWeight: '500' }}>{m.full_name}</Text>
                <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? 'accentInk' : 'faint'} />
              </Pressable>
            );
          })}
          {!list.length ? <View style={{ padding: 20 }}><Txt c="sub" style={{ textAlign: 'center' }}>Nessun socio trovato.</Txt></View> : null}
        </View>
      )}
    </Sheet>
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
      style={({ pressed }: any) => ({ flexGrow: 1, flexBasis: '30%', minWidth: 84, minHeight: 68, paddingHorizontal: 4, borderRadius: 14, backgroundColor: pressed ? t.card : t.card2, alignItems: 'center', justifyContent: 'center', gap: 4 })}>
      <Icon name={icon} size={22} color="accentInk" />
      <Text numberOfLines={2} style={{ color: t.text, fontSize: 13, fontWeight: '600', textAlign: 'center' }}>{label}</Text>
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
  const [whoOpen, setWhoOpen] = useState(false);
  const [sex, setSex] = useState<'m' | 'f' | ''>('');
  const [birth, setBirth] = useState('');
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
  const wa = whatsappNumber(m?.phone);
  const openWho = () => { setSex(m?.sex || ''); setBirth(m?.birth_date || ''); setWhoOpen(true); };
  const saveWho = async () => {
    if (birth && !isDayStr(birth)) return toast('La data di nascita va scritta così: 1990-05-17.', 'error');
    setWhoOpen(false);
    await run(() => api.updateProfile(id, { sex: sex || null, birth_date: birth || null }), 'Dati salvati.');
  };

  return (
    <Page onBack={nav.pop} navTitle={name} maxWidth="wide">
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
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <Tile icon="stats-chart" label="Progressi" onPress={() => nav.push('member-progress', { id, name })} />
              <Tile icon="analytics-outline" label="Report" onPress={() => nav.push('report', { id, name })} />
              <Tile icon="body-outline" label="Peso e misure" onPress={() => nav.push('body', { id, name })} />
              <Tile icon="medkit-outline" label="Anamnesi" onPress={() => nav.push('anamnesis', { id, name })} />
              <Tile icon="options-outline" label="Preferenze" onPress={() => nav.push('prefs', { id, name })} />
              <Tile icon="document-text-outline" label="Documenti" onPress={() => nav.push('documents', { memberId: id, name })} />
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
            <Row title="Data di nascita" value={m.birth_date ? `${fmtDateShortY(m.birth_date)} · ${ageOf(m.birth_date) ?? ''} anni` : '–'} chevron onPress={openWho} />
            <Row title="Sesso" value={m.sex === 'm' ? 'Uomo' : m.sex === 'f' ? 'Donna' : '–'} chevron onPress={openWho} />
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
      <Sheet visible={whoOpen} onClose={() => setWhoOpen(false)} title="Dati anagrafici" footer={<Button label="Salva" onPress={saveWho} />}>
        <Segmented items={[['Non indicato', ''], ['Uomo', 'm'], ['Donna', 'f']]} value={sex} onChange={setSex} />
        <Field label="Data di nascita" value={birth} onChangeText={setBirth} hint="Anno-mese-giorno, per esempio 1990-05-17." />
        <Txt v="cap" c="faint">Servono per la plicometria e per i grafici del socio.</Txt>
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
