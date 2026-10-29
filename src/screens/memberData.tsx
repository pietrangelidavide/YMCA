// Dati del socio gestiti dallo staff: anamnesi, preferenze di allenamento, report degli allenamenti.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { api, errText, useAsync, WorkoutReport } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { NUM, useTheme } from '../theme';
import { BarChart, Button, Chip, Empty, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Spinner, Stat, Toggle, Txt, useUi } from '../ui';
import { addDays, fmtDate, fmtDateShortY, fmtMonthShort, fmtNum, isDayStr, isoDay, muscleLabel, OBJECTIVE, OBJECTIVE_KEYS } from '../util';
import {
  ANAMNESIS, anamnesisFilled, Choice, PREF_DAYS, PREF_KINDS, PREF_MODES, PREF_OBSTACLES, PREF_SLOTS, PREF_ZONES, Prefs,
} from './forms';

// ───────── Anamnesi ─────────

export function AnamnesisScreen({ id, name }: { id: string; name?: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast } = useUi();
  const { bump } = useVersion();
  const d = useAsync(() => api.anamnesis(id), [id]);
  const [data, setData] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [sec, setSec] = useState(ANAMNESIS[0].key);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (d.loading) return;
    setData(d.data?.data || {});
    setConsent(d.data?.consent_on ?? null);
    setDirty(false);
  }, [d.data, d.loading]);

  const section = ANAMNESIS.find((s) => s.key === sec)!;
  const filled = (s: typeof section) => s.fields.filter((f) => (data[f.key] || '').trim()).length;
  const set = (k: string, v: string) => { setData((x) => ({ ...x, [k]: v })); setDirty(true); };

  const save = async () => {
    if (!consent) return toast('Segna prima il consenso del socio al trattamento dei dati sulla salute.', 'error');
    setBusy(true);
    try {
      const clean: Record<string, string> = {};
      Object.entries(data).forEach(([k, v]) => { if (v && v.trim()) clean[k] = v.trim(); });
      await api.saveAnamnesis(id, clean, consent, userId!);
      setDirty(false); bump(); toast('Anamnesi salvata.');
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Page onBack={nav.pop} navTitle="Anamnesi" title={name} subtitle="Anamnesi"
      footer={<Button label={dirty ? 'Salva l\'anamnesi' : 'Salvata'} icon={dirty ? 'save-outline' : 'checkmark'} onPress={save} loading={busy} disabled={!dirty} />}>
      {d.loading && !d.data && !d.error ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14 }}>
          <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 14, gap: 12 }}>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Icon name="lock-closed-outline" size={20} color="accentInk" style={{ marginTop: 2 }} />
              <Text style={{ flex: 1, color: t.sub, fontSize: 14, lineHeight: 20 }}>Sono dati sulla salute: li vede solo lo staff, il socio no. Compila solo ciò che serve ad allenarlo in sicurezza.</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Txt style={{ fontWeight: '600' }}>Consenso del socio</Txt>
                <Txt v="sub" c="sub">{consent ? `Raccolto il ${fmtDateShortY(consent)}` : 'Fallo firmare o confermare prima di salvare'}</Txt>
              </View>
              <Toggle label="Consenso raccolto" value={!!consent} onChange={(v) => { setConsent(v ? (consent || isoDay(new Date())) : null); setDirty(true); }} />
            </View>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
            {ANAMNESIS.map((s) => <Chip key={s.key} icon={s.icon} label={filled(s) ? `${s.title} · ${filled(s)}` : s.title} on={sec === s.key} onPress={() => setSec(s.key)} />)}
          </ScrollView>

          <View style={{ gap: 12 }}>
            {section.fields.map((f) => (
              <Field key={f.key} label={f.label} hint={f.hint} value={data[f.key] || ''} onChangeText={(v) => set(f.key, v)} multiline={f.long} maxLength={f.long ? 600 : 120} />
            ))}
          </View>

          <SectionTitle>File allegati</SectionTitle>
          <Group>
            <Row title="Documenti del socio" sub="Certificati, esami, moduli firmati (PDF)" left={<Icon name="attach-outline" size={22} color="accentInk" />} chevron onPress={() => nav.push('documents', { memberId: id, name })} />
          </Group>
          {d.data ? <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>{anamnesisFilled(d.data.data)} campi compilati · ultimo salvataggio {fmtDateShortY(d.data.updated_at)}</Txt> : null}
        </View>
      )}
    </Page>
  );
}

// ───────── Preferenze di allenamento ─────────

function Multi({ title, items, value, onChange, single }: { title: string; items: Choice[]; value: string[]; onChange: (v: string[]) => void; single?: boolean }) {
  return (
    <View style={{ gap: 8 }}>
      <Txt v="cap" c="sub" style={{ marginLeft: 4 }}>{title}</Txt>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {items.map(([k, label]) => {
          const on = value.includes(k) || (single && !value.length && k === '');
          return <Chip key={k || 'any'} small label={label} on={on} onPress={() => onChange(single ? [k] : on ? value.filter((x) => x !== k) : [...value, k])} />;
        })}
      </View>
    </View>
  );
}

export function PrefsScreen({ id, name, mine }: { id: string; name?: string; mine?: boolean }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast } = useUi();
  const { bump } = useVersion();
  const d = useAsync(() => api.prefs(id), [id]);
  const [p, setP] = useState<Prefs>({});
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (!d.loading) { setP((d.data?.data as Prefs) || {}); setDirty(false); } }, [d.data, d.loading]);
  const up = (patch: Prefs) => { setP((x) => ({ ...x, ...patch })); setDirty(true); };
  const save = async () => {
    setBusy(true);
    try { await api.savePrefs(id, p, userId!); setDirty(false); bump(); toast('Preferenze salvate.'); }
    catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Page onBack={nav.pop} navTitle="Preferenze" title={mine ? 'Come ti piace allenarti' : name} subtitle={mine ? undefined : 'Preferenze di allenamento'}
      footer={<Button label={dirty ? 'Salva le preferenze' : 'Salvate'} icon={dirty ? 'save-outline' : 'checkmark'} onPress={save} loading={busy} disabled={!dirty} />}>
      {d.loading && !d.data && !d.error ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 18 }}>
          {mine ? <Txt c="sub">Il tuo personal trainer le usa per preparare una scheda adatta a te. Puoi cambiarle quando vuoi.</Txt> : null}
          <View style={{ gap: 8 }}>
            <Txt v="cap" c="sub" style={{ marginLeft: 4 }}>Obiettivo</Txt>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {OBJECTIVE_KEYS.map((k) => <Chip key={k} small label={OBJECTIVE[k]} on={p.objective === k} onPress={() => up({ objective: p.objective === k ? '' : k })} />)}
            </View>
          </View>
          <Multi title="Zone del corpo da curare" items={PREF_ZONES} value={p.zones || []} onChange={(v) => up({ zones: v })} />
          <Multi title="Giorni preferiti" items={PREF_DAYS} value={p.days || []} onChange={(v) => up({ days: v })} />
          <Multi title="Fascia oraria" single items={PREF_SLOTS} value={[p.slot || '']} onChange={(v) => up({ slot: v[0] })} />
          <Multi title="Ti alleni meglio" single items={PREF_MODES} value={[p.mode || '']} onChange={(v) => up({ mode: v[0] })} />
          <Multi title="Allenamenti che preferisci" items={PREF_KINDS} value={p.liked || []} onChange={(v) => up({ liked: v })} />
          <Multi title="Allenamenti che non ti piacciono" items={PREF_KINDS} value={p.disliked || []} onChange={(v) => up({ disliked: v })} />
          <Multi title="Cosa ti ostacola" items={PREF_OBSTACLES} value={p.obstacles || []} onChange={(v) => up({ obstacles: v })} />
          <Field label="Altro" value={p.note || ''} onChangeText={(v) => up({ note: v })} multiline maxLength={400} placeholder="Qualsiasi cosa utile per la scheda." />
        </View>
      )}
    </Page>
  );
}

// ───────── Report degli allenamenti ─────────

type Preset = '1m' | '3m' | '6m' | '1y' | 'custom';
const PRESETS: [Preset, string][] = [['1m', '1 mese'], ['3m', '3 mesi'], ['6m', '6 mesi'], ['1y', '1 anno'], ['custom', 'Date']];
const presetDays: Record<string, number> = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };

export function ReportScreen({ id, name }: { id: string; name?: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const [preset, setPreset] = useState<Preset>('3m');
  const [from, setFrom] = useState(isoDay(addDays(new Date(), -90)));
  const [to, setTo] = useState(isoDay(new Date()));
  const [plan, setPlan] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [all, setAll] = useState(false);

  const range = useMemo(() => {
    if (preset === 'custom') return { from: isDayStr(from) ? from : isoDay(addDays(new Date(), -90)), to: isDayStr(to) ? to : isoDay(new Date()) };
    return { from: isoDay(addDays(new Date(), -presetDays[preset])), to: isoDay(new Date()) };
  }, [preset, from, to]);

  const plans = useAsync(() => api.programsOf(id), [id]);
  const rep = useAsync<WorkoutReport>(() => api.workoutReport(id, range.from, range.to, plan), [id, range.from, range.to, plan]);
  const r = rep.data;

  const monthly = (r?.monthly || []).map((m, i, a) => ({ label: fmtMonthShort(m.month), value: m.workouts, on: i === a.length - 1 }));
  const exs = useMemo(() => [...(r?.exercises || [])].sort((a, b) => b.sessions - a.sessions), [r]);
  const shown = all ? exs : exs.slice(0, 8);
  const realPlans = (plans.data || []).filter((p) => !p.is_template);

  return (
    <Page onBack={nav.pop} navTitle="Report" title={name} subtitle="Report allenamenti">
      <View style={{ paddingHorizontal: 16, gap: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
          {PRESETS.map(([k, l]) => <Chip key={k} label={l} on={preset === k} onPress={() => setPreset(k)} />)}
        </ScrollView>
        {preset === 'custom' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Dal" value={from} onChangeText={setFrom} style={{ flex: 1 }} hint="2026-01-31" />
            <Field label="Al" value={to} onChangeText={setTo} style={{ flex: 1 }} hint="2026-10-31" />
          </View>
        ) : <Txt v="sub" c="faint" style={{ paddingHorizontal: 4 }}>Dal {fmtDateShortY(range.from)} al {fmtDateShortY(range.to)}</Txt>}
        {realPlans.length > 1 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
            <Chip small label="Tutte le schede" on={!plan} onPress={() => setPlan(null)} />
            {realPlans.map((p) => <Chip small key={p.id} label={p.name} on={plan === p.id} onPress={() => setPlan(plan === p.id ? null : p.id)} />)}
          </ScrollView>
        ) : null}

        {rep.loading && !r ? <Spinner /> : rep.error && !r ? <ErrorState error={rep.error} onRetry={rep.reload} /> : r ? (
          !r.workouts ? <Empty icon="stats-chart-outline" title="Nessun allenamento nel periodo" text="Prova ad allargare le date o a togliere il filtro sulla scheda." /> : (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Stat value={r.workouts} label="allenamenti" />
                <Stat value={fmtNum(r.avg_exercises, 1)} label="esercizi per allenamento" />
                <Stat value={fmtNum(r.avg_per_week, 1)} label="allenamenti a settimana" tone="accentInk" />
              </View>
              {monthly.length ? (
                <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
                  <Txt v="head">Allenamenti al mese</Txt>
                  <BarChart data={monthly} height={130} />
                </View>
              ) : null}
              <SectionTitle>Progressione dei carichi</SectionTitle>
              {!exs.length ? <Txt c="faint" style={{ paddingHorizontal: 4 }}>Nessun esercizio registrato nel periodo.</Txt> : (
                <Group>
                  {shown.map((e) => {
                    const first = e.series[0], last = e.series[e.series.length - 1];
                    const delta = e.series.length > 1 ? (last.w - first.w) || (last.reps - first.reps) : 0;
                    const unit = last.w ? 'kg' : 'rip.';
                    const isOpen = open === e.exercise_id;
                    return (
                      <View key={e.exercise_id}>
                        <Row title={e.name} sub={`${muscleLabel(e.muscle_group)} · ${e.sessions} ${e.sessions === 1 ? 'volta' : 'volte'} · ultimo ${last.w ? `${fmtNum(last.w, 2)} kg × ${last.reps}` : `${last.reps} rip.`}`}
                          onPress={() => setOpen(isOpen ? null : e.exercise_id)} minHeight={62}
                          right={<View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            {delta ? <Pill label={`${delta > 0 ? '+' : ''}${fmtNum(delta, 1)} ${unit}`} color={delta > 0 ? 'rgba(52,199,89,0.18)' : t.card2} textColor={delta > 0 ? t.ok : t.sub} icon={delta > 0 ? 'trending-up' : 'trending-down'} /> : null}
                            <Icon name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="faint" />
                          </View>} />
                        {isOpen ? (
                          <View style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
                            <BarChart height={110} labelEvery={Math.ceil(e.series.length / 5)}
                              data={e.series.slice(-12).map((s, i, a) => ({ label: fmtDate(s.at), value: s.w || s.reps, on: i === a.length - 1 }))}
                              format={(n) => fmtNum(n, 1)} />
                            <Txt v="cap" c="faint" style={{ marginTop: 4 }}>{last.w ? 'Carico migliore di ogni allenamento (kg).' : 'Ripetizioni migliori di ogni allenamento.'}</Txt>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </Group>
              )}
              {exs.length > 8 ? <Button label={all ? 'Mostra meno' : `Mostra tutti (${exs.length})`} kind="ghost" small full={false} onPress={() => setAll(!all)} /> : null}
            </>
          )
        ) : null}
      </View>
    </Page>
  );
}
