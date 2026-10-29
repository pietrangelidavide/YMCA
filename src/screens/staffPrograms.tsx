// Scheda «Schede» dello staff: schede assegnate ai soci (con filtri) e archivio dei modelli.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, errText, MemberRow, ProgramOverview, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { Button, Chip, Empty, ErrorState, Group, Icon, IconButton, Page, Pill, Row, SectionTitle, Segmented, Sheet, Spinner, Txt, useUi } from '../ui';
import { fmtDateShortY, LEVEL, LEVEL_KEYS, norm, OBJECTIVE, OBJECTIVE_KEYS, parseDay, startOfDay, TARGET, toCsv } from '../util';
import { shareCsv } from '../share';
import { MemberPicker, useMemberFilter } from './staffMembers';
import { SearchBox } from './shared';

const WARN_BG = 'rgba(255,178,36,0.18)';

export type PlanState = 'draft' | 'active' | 'expiring' | 'expired' | 'archived';
// Stato di una scheda assegnata, con i giorni che mancano alla scadenza
export function planState(p: Pick<ProgramOverview, 'status' | 'ends_on'>, now = new Date()): { state: PlanState; left: number | null } {
  const left = p.ends_on ? Math.round((parseDay(p.ends_on).getTime() - startOfDay(now).getTime()) / 86400000) : null;
  if (p.status === 'draft') return { state: 'draft', left };
  if (p.status === 'archived') return { state: 'archived', left };
  if (left !== null && left <= 0) return { state: 'expired', left };
  if (left !== null && left <= 7) return { state: 'expiring', left };
  return { state: 'active', left };
}
const STATE_LABEL: Record<PlanState, string> = { draft: 'Bozza', active: 'Attiva', expiring: 'In scadenza', expired: 'Scaduta', archived: 'Archiviata' };

function StatePill({ s, left }: { s: PlanState; left: number | null }) {
  const { t } = useTheme();
  if (s === 'active') return <Pill label="Attiva" color={t.accentSoft} textColor={t.accentInk} icon="flash" />;
  if (s === 'expiring') return <Pill label={left === 1 ? 'Scade domani' : `Scade tra ${left} gg`} color={WARN_BG} textColor={t.warn} icon="time" />;
  if (s === 'expired') return <Pill label="Scaduta" color={WARN_BG} textColor={t.warn} icon="alert-circle" />;
  return <Pill label={STATE_LABEL[s]} icon={s === 'draft' ? 'create-outline' : 'archive-outline'} />;
}

export function ProgramsTab() {
  const { t } = useTheme();
  const nav = useNav();
  const { pview: view, setPview: setView } = useMemberFilter();
  const [pick, setPick] = useState(false);
  const d = useAsync(async () => {
    const [assigned, templates] = await Promise.all([api.programsOverview(false), api.programsOverview(true)]);
    return { assigned, templates };
  }, []);
  return (
    <Page title="Schede" subtitle={d.data ? `${d.data.assigned.length} schede · ${d.data.templates.length} modelli` : undefined}
      right={<IconButton name="add-circle" size={30} color="accentInk" label={view === 'assigned' ? 'Nuova scheda' : 'Nuovo modello'} onPress={() => (view === 'assigned' ? setPick(true) : nav.push('builder', { template: true }))} />}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4, gap: 12 }}>
        <Segmented items={[['Assegnate', 'assigned'], ['Modelli', 'templates']]} value={view} onChange={setView} />
        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : view === 'assigned'
          ? <Assigned rows={d.data!.assigned} /> : <Templates rows={d.data!.templates} />}
      </View>
      <MemberPicker visible={pick} onClose={() => setPick(false)} onPick={(m) => { setPick(false); nav.push('builder', { memberId: m.id }); }} />
    </Page>
  );
}

// ───────── Schede assegnate ─────────

type PF = 'all' | 'mine' | 'active' | 'expiring' | 'expired' | 'draft' | 'archived';

function Assigned({ rows }: { rows: ProgramOverview[] }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast } = useUi();
  const [q, setQ] = useState('');
  const [f, setF] = useState<PF>('all');
  const st = useMemo(() => new Map(rows.map((r) => [r.id, planState(r)])), [rows]);
  const match = (r: ProgramOverview, k: PF) => {
    const s = st.get(r.id)!.state;
    return k === 'all' ? true : k === 'mine' ? r.trainer_id === userId : k === 'active' ? s === 'active' || s === 'expiring' : s === k;
  };
  const counts = useMemo(() => Object.fromEntries((['all', 'mine', 'active', 'expiring', 'expired', 'draft', 'archived'] as PF[]).map((k) => [k, rows.filter((r) => match(r, k)).length])) as Record<PF, number>, [rows, st, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const list = useMemo(() => {
    const n = norm(q.trim());
    return rows.filter((r) => match(r, f) && (!n || norm(r.name).includes(n) || norm(r.member_name || '').includes(n) || norm(r.trainer_name || '').includes(n)));
  }, [rows, f, q, st, userId]); // eslint-disable-line react-hooks/exhaustive-deps
  const chips: [PF, string][] = [['all', 'Tutte'], ['mine', 'Mie'], ['active', 'Attive'], ['expiring', 'In scadenza'], ['expired', 'Scadute'], ['draft', 'Bozze'], ['archived', 'Archiviate']];

  const exportCsv = async () => {
    const head = ['Scheda', 'Socio', 'Seguito da', 'Stato', 'Obiettivo', 'Livello', 'Inizio', 'Fine', 'Settimane', 'Giorni', 'Voci', 'Modello'];
    const body = list.map((r) => [r.name, r.member_name, r.trainer_name, STATE_LABEL[st.get(r.id)!.state], r.objective ? OBJECTIVE[r.objective] : '', r.level ? LEVEL[r.level] : '',
      r.starts_on, r.ends_on, r.weeks, r.days_count, r.items_count, r.template_name]);
    try { await shareCsv('schede.csv', toCsv([head, ...body])); } catch (e) { toast(errText(e), 'error'); }
  };

  return (
    <View style={{ gap: 12 }}>
      <SearchBox value={q} onChange={setQ} placeholder="Cerca per scheda, socio o PT" />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
        {chips.map(([k, label]) => <Chip key={k} label={counts[k] ? `${label} · ${counts[k]}` : label} on={f === k} onPress={() => setF(k)} />)}
      </ScrollView>
      {!list.length ? (
        <Empty icon="albums-outline" title="Nessuna scheda" text={q || f !== 'all' ? 'Prova a togliere i filtri o a cercare un altro nome.' : 'Crea la prima scheda con il pulsante + in alto.'} />
      ) : (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Txt v="sub" c="sub">{list.length} {list.length === 1 ? 'scheda' : 'schede'}</Txt>
            <Button small kind="ghost" icon="download-outline" label="Esporta (CSV)" full={false} onPress={exportCsv} />
          </View>
          <View style={{ gap: 8 }}>
            {list.map((r) => {
              const s = st.get(r.id)!;
              return (
                <Pressable key={r.id} accessibilityLabel={`${r.name}, ${r.member_name || ''}`} onPress={() => nav.push('builder', { id: r.id })}
                  style={({ pressed }: any) => ({ backgroundColor: pressed ? t.card2 : t.card, borderRadius: 18, padding: 14, gap: 8 })}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                    <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                      <Text numberOfLines={2} style={{ color: t.text, fontSize: 16.5, fontWeight: '700' }}>{r.name}</Text>
                      <Text numberOfLines={1} style={{ color: t.sub, fontSize: 14 }}>{r.member_name || 'Senza socio'}{r.trainer_name ? ` · seguito da ${r.trainer_name}` : ''}</Text>
                    </View>
                    <StatePill s={s.state} left={s.left} />
                  </View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    {r.objective ? <Pill label={OBJECTIVE[r.objective] || r.objective} /> : null}
                    {r.level ? <Pill label={LEVEL[r.level] || r.level} /> : null}
                    <Pill label={`${r.days_count} ${r.days_count === 1 ? 'giorno' : 'giorni'} · ${r.items_count} voci`} />
                  </View>
                  <Text style={{ color: t.faint, fontSize: 13 }}>
                    {r.starts_on ? `Dal ${fmtDateShortY(r.starts_on)}${r.ends_on ? ` al ${fmtDateShortY(r.ends_on)}` : ''}` : `${r.weeks} settimane, non ancora iniziata`}
                    {r.template_name ? ` · da «${r.template_name}»` : ''}{r.auto_archive ? ' · si disattiva alla scadenza' : ''}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

// ───────── Archivio modelli ─────────

function Templates({ rows }: { rows: ProgramOverview[] }) {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const [q, setQ] = useState('');
  const [obj, setObj] = useState('');
  const [lvl, setLvl] = useState('');
  const [tg, setTg] = useState('');
  const [wk, setWk] = useState(0);
  const [more, setMore] = useState(false);
  const [grid, setGrid] = useState(true);
  const [sel, setSel] = useState<ProgramOverview | null>(null);
  const [assign, setAssign] = useState<ProgramOverview | null>(null);
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => {
    const n = norm(q.trim());
    return rows.filter((r) => (!obj || r.objective === obj) && (!lvl || r.level === lvl) && (!tg || r.target === tg || r.target === 'tutti') && (!wk || r.weeks === wk)
      && (!n || norm(r.name).includes(n) || norm(r.goal || '').includes(n)));
  }, [rows, q, obj, lvl, tg, wk]);
  const weeks = useMemo(() => [...new Set(rows.map((r) => r.weeks))].sort((a, b) => a - b), [rows]);
  const filtered = !!(q || obj || lvl || tg || wk);

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); bump(); if (ok) toast(ok); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const toMember = async (m: MemberRow) => {
    if (!assign) return;
    const tpl = assign;
    await run(async () => {
      const nid = await api.copyProgram(tpl.id, m.id, false);
      setAssign(null);
      nav.push('builder', { id: nid });
    });
  };
  const duplicate = async (p: ProgramOverview) => {
    setSel(null);
    await run(async () => { await api.copyProgram(p.id, null, true, `${p.name} (copia)`); }, 'Modello duplicato.');
  };
  const remove = async (p: ProgramOverview) => {
    setSel(null);
    if (!(await confirm({ title: 'Eliminare il modello?', message: `«${p.name}» sparisce dall'elenco. Le schede già assegnate ai soci non cambiano.`, confirmLabel: 'Elimina', destructive: true }))) return;
    await run(() => api.deleteProgram(p.id), 'Modello eliminato.');
  };

  const tags = (r: ProgramOverview) => (
    <>
      {r.objective ? <Pill label={OBJECTIVE[r.objective] || r.objective} color={t.accentSoft} textColor={t.accentInk} /> : null}
      {r.level ? <Pill label={LEVEL[r.level] || r.level} /> : null}
      {r.target !== 'tutti' ? <Pill label={TARGET[r.target]} icon={r.target === 'donna' ? 'woman-outline' : 'man-outline'} /> : null}
    </>
  );

  return (
    <View style={{ gap: 12 }}>
      <Txt v="sub" c="sub" style={{ paddingHorizontal: 4 }}>I modelli sono schede già pronte: le assegni a un socio in pochi tocchi e poi le adatti.</Txt>
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
        <View style={{ flex: 1 }}><SearchBox value={q} onChange={setQ} placeholder="Cerca un modello" /></View>
        <IconButton bg name={grid ? 'list' : 'grid'} label={grid ? 'Vedi come elenco' : 'Vedi come griglia'} onPress={() => setGrid(!grid)} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
        <Chip label="Ogni obiettivo" on={!obj} onPress={() => setObj('')} />
        {OBJECTIVE_KEYS.map((k) => <Chip key={k} label={OBJECTIVE[k]} on={obj === k} onPress={() => setObj(obj === k ? '' : k)} />)}
      </ScrollView>
      <Pressable accessibilityLabel={more ? 'Meno filtri' : 'Altri filtri'} onPress={() => setMore(!more)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingVertical: 2 }}>
        <Text style={{ color: t.accentInk, fontSize: 14, fontWeight: '600' }}>{more ? 'Meno filtri' : 'Livello, destinatario e durata'}</Text>
        <Icon name={more ? 'chevron-up' : 'chevron-down'} size={15} color="accentInk" />
      </Pressable>
      {more ? (
        <View style={{ gap: 10 }}>
          <Segmented items={[['Ogni livello', ''], ...LEVEL_KEYS.map((k): [string, string] => [LEVEL[k], k])]} value={lvl} onChange={setLvl} />
          <Segmented items={[['Tutti', ''], ['Uomo', 'uomo'], ['Donna', 'donna']]} value={tg} onChange={setTg} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
            <Chip small label="Ogni durata" on={!wk} onPress={() => setWk(0)} />
            {weeks.map((n) => <Chip small key={n} label={`${n} settimane`} on={wk === n} onPress={() => setWk(wk === n ? 0 : n)} />)}
          </ScrollView>
        </View>
      ) : null}

      {!list.length ? (
        <Empty icon="albums-outline" title={filtered ? 'Nessun modello con questi filtri' : 'Nessun modello'} text={filtered ? undefined : 'Crea una scheda tipo (per esempio «Forza 3 giorni») e usala con tutti i soci.'}
          action={filtered ? <Button label="Togli i filtri" kind="secondary" small full={false} onPress={() => { setQ(''); setObj(''); setLvl(''); setTg(''); setWk(0); }} />
            : <Button label="Crea il primo modello" icon="add" small full={false} onPress={() => nav.push('builder', { template: true })} />} />
      ) : grid ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {list.map((r) => (
            <Pressable key={r.id} accessibilityLabel={r.name} onPress={() => setSel(r)}
              style={({ pressed }: any) => ({ flexGrow: 1, flexBasis: 220, minWidth: 0, backgroundColor: pressed ? t.card2 : t.card, borderRadius: 18, padding: 14, gap: 10 })}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, minHeight: 22 }}>{tags(r)}</View>
              <Text numberOfLines={2} style={{ color: t.text, fontSize: 16.5, fontWeight: '700', minHeight: 44 }}>{r.name}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="calendar-outline" size={15} color="faint" /><Text style={{ color: t.sub, fontSize: 13.5 }}>{r.weeks} sett.</Text></View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Icon name="albums-outline" size={15} color="faint" /><Text style={{ color: t.sub, fontSize: 13.5 }}>{r.days_count} {r.days_count === 1 ? 'giorno' : 'giorni'}</Text></View>
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <Group>
          {list.map((r) => (
            <Row key={r.id} title={r.name} minHeight={62}
              sub={[r.objective ? OBJECTIVE[r.objective] : '', r.level ? LEVEL[r.level] : '', r.target !== 'tutti' ? TARGET[r.target] : '', `${r.weeks} settimane`, `${r.days_count} giorni`].filter(Boolean).join(' · ')}
              left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="albums" size={22} color="accentInk" /></View>}
              chevron onPress={() => setSel(r)} />
          ))}
        </Group>
      )}

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        {sel?.goal ? <Txt c="sub">{sel.goal}</Txt> : null}
        <Group>
          <Row title="Assegna a un socio" sub="Crea una bozza da adattare" left={<Icon name="person-add-outline" size={22} color="accentInk" />} chevron onPress={() => { setAssign(sel); setSel(null); }} />
          <Row title="Modifica il modello" left={<Icon name="create-outline" size={22} color="accentInk" />} chevron onPress={() => { const id = sel!.id; setSel(null); nav.push('builder', { id }); }} />
          <Row title="Duplica" left={<Icon name="copy-outline" size={22} color="sub" />} onPress={() => duplicate(sel!)} />
          <Row title="Elimina" danger left={<Icon name="trash-outline" size={22} color="danger" />} onPress={() => remove(sel!)} />
        </Group>
      </Sheet>
      <MemberPicker visible={!!assign} onClose={() => setAssign(null)} onPick={toMember} busy={busy} />
    </View>
  );
}
