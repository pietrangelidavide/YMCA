// Peso e misure: misurazioni con statistiche per periodo, plicometria (percentuale di grasso) e BIA.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, BiaScan, errText, Measurement, Skinfold, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { NUM, useTheme } from '../theme';
import { BarChart, Button, Chip, Empty, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Segmented, Sheet, Spinner, Stat, Txt, useUi } from '../ui';
import { addDays, ageOf, bmi, fmtDate, fmtDateShortY, fmtNum, isDayStr, isoDay, jacksonPollock3, parseDay, parseNum, SKINFOLD_SITES } from '../util';

type FieldDef = [key: string, label: string, unit: string];

const M_FIELDS: FieldDef[] = [
  ['weight_kg', 'Peso', 'kg'], ['height_cm', 'Altezza', 'cm'], ['body_fat_pct', 'Massa grassa', '%'], ['neck_cm', 'Collo', 'cm'], ['shoulders_cm', 'Spalle', 'cm'],
  ['chest_cm', 'Petto', 'cm'], ['arm_cm', 'Braccio', 'cm'], ['waist_cm', 'Vita', 'cm'], ['hips_cm', 'Fianchi', 'cm'], ['thigh_cm', 'Coscia', 'cm'], ['calf_cm', 'Polpaccio', 'cm'],
];
const SKIN_FIELDS: FieldDef[] = [
  ['chest_mm', 'Petto', 'mm'], ['abdominal_mm', 'Addome', 'mm'], ['thigh_mm', 'Coscia', 'mm'], ['triceps_mm', 'Tricipite', 'mm'],
  ['subscapular_mm', 'Sottoscapolare', 'mm'], ['suprailiac_mm', 'Soprailiaca', 'mm'], ['midaxillary_mm', 'Ascellare', 'mm'],
];
const BIA_FIELDS: FieldDef[] = [
  ['weight_kg', 'Peso', 'kg'], ['fat_pct', 'Grasso', '%'], ['fat_kg', 'Massa grassa', 'kg'], ['lean_kg', 'Massa magra', 'kg'], ['muscle_kg', 'Massa muscolare', 'kg'],
  ['water_pct', 'Acqua', '%'], ['bone_kg', 'Massa ossea', 'kg'], ['visceral_fat', 'Grasso viscerale', ''], ['bmr_kcal', 'Metabolismo basale', 'kcal'], ['metabolic_age', 'Età metabolica', 'anni'],
];

type Period = 'all' | '1m' | '3m' | '6m' | '1y';
const PERIODS: [Period, string][] = [['1m', '1 mese'], ['3m', '3 mesi'], ['6m', '6 mesi'], ['1y', '1 anno'], ['all', 'Sempre']];
const PDAYS: Record<string, number> = { '1m': 30, '3m': 91, '6m': 182, '1y': 365 };
const since = (p: Period) => (p === 'all' ? '0000-00-00' : isoDay(addDays(new Date(), -PDAYS[p])));

// ───────── Pannello generico per aggiungere / correggere una rilevazione ─────────

function RecordSheet({ visible, title, fields, value, onClose, onSave, onDelete, extra }: {
  visible: boolean; title: string; fields: FieldDef[]; value: Record<string, any> | null; onClose: () => void;
  onSave: (row: Record<string, any>) => Promise<void>; onDelete?: () => Promise<void>;
  extra?: (vals: Record<string, string>) => React.ReactNode;
}) {
  const { toast, confirm } = useUi();
  const [f, setF] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible || !value) return;
    const o: Record<string, string> = { measured_on: value.measured_on || isoDay(new Date()), note: value.note || '' };
    fields.forEach(([k]) => { o[k] = value[k] != null ? fmtNum(Number(value[k]), 2) : ''; });
    setF(o);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    if (!isDayStr(f.measured_on)) return toast('La data va scritta così: 2026-10-14.', 'error');
    const row: Record<string, any> = { measured_on: f.measured_on, note: f.note?.trim() || null };
    let any = false;
    fields.forEach(([k]) => { const n = parseNum(f[k]); row[k] = n; if (n !== null) any = true; });
    if (!any) return toast('Scrivi almeno un valore.', 'error');
    setBusy(true);
    try { await onSave(row); onClose(); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!onDelete) return;
    if (!(await confirm({ title: 'Eliminare questa rilevazione?', confirmLabel: 'Elimina', destructive: true }))) return;
    try { await onDelete(); onClose(); } catch (e) { toast(errText(e), 'error'); }
  };
  return (
    <Sheet visible={visible} onClose={onClose} title={title}
      footer={<><Button label="Salva" onPress={save} loading={busy} />{value?.id && onDelete ? <Button label="Elimina" kind="ghost" onPress={del} /> : null}</>}>
      <Field label="Data" value={f.measured_on} onChangeText={(s) => setF({ ...f, measured_on: s })} hint="Anno-mese-giorno, per esempio 2026-10-14." />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        {fields.map(([k, label, unit]) => (
          <Field key={k} label={label} value={f[k]} onChangeText={(s) => setF({ ...f, [k]: s })} suffix={unit || undefined} keyboardType="decimal-pad" style={{ width: '47.5%' }} />
        ))}
      </View>
      {extra ? extra(f) : null}
      <Field label="Note" value={f.note} onChangeText={(s) => setF({ ...f, note: s })} multiline maxLength={300} />
    </Sheet>
  );
}

const Delta = ({ v, unit, good }: { v: number | null; unit: string; good?: 'down' | 'up' }) => {
  const { t } = useTheme();
  if (v === null || Math.abs(v) < 0.05) return null;
  const better = good ? (good === 'down' ? v < 0 : v > 0) : null;
  return <Pill label={`${v > 0 ? '+' : ''}${fmtNum(v, 1)} ${unit}`.trim()} icon={v > 0 ? 'trending-up' : 'trending-down'}
    color={better === null ? t.card2 : better ? 'rgba(52,199,89,0.18)' : t.card2} textColor={better === null ? t.sub : better ? t.ok : t.sub} />;
};

// ───────── La vista completa ─────────

export function BodyView({ memberId }: { memberId: string }) {
  const { t } = useTheme();
  const { userId, isStaff } = useSession();
  const { toast } = useUi();
  const { bump } = useVersion();
  const d = useAsync(async () => {
    const [profile, ms, sk, bia] = await Promise.all([api.profile(memberId), api.measurements(memberId), api.skinfolds(memberId), api.bia(memberId)]);
    return { profile, ms, sk, bia };
  }, [memberId]);
  const [tab, setTab] = useState<'misure' | 'pliche' | 'bia'>('misure');
  const [period, setPeriod] = useState<Period>('3m');
  const [edit, setEdit] = useState<{ kind: 'm' | 's' | 'b'; v: any } | null>(null);
  const [who, setWho] = useState(false);
  const [sex, setSex] = useState<'m' | 'f' | null>(null);
  const [birth, setBirth] = useState('');

  const p = d.data?.profile;
  useEffect(() => { if (p) { setSex(p.sex); setBirth(p.birth_date || ''); } }, [p?.sex, p?.birth_date]); // eslint-disable-line react-hooks/exhaustive-deps

  if (d.loading && !d.data) return <Spinner />;
  if (d.error && !d.data) return <ErrorState error={d.error} onRetry={d.reload} />;
  const { ms, sk, bia } = d.data!;
  const from = since(period);
  const age = ageOf(p?.birth_date);

  const saveWho = async () => {
    if (birth && !isDayStr(birth)) return toast('La data di nascita va scritta così: 1990-05-17.', 'error');
    try { await api.updateProfile(memberId, { sex, birth_date: birth || null }); setWho(false); bump(); toast('Dati salvati.'); } catch (e) { toast(errText(e), 'error'); }
  };

  return (
    <View style={{ gap: 14 }}>
      <Segmented items={[['Misure', 'misure'], ['Plicometria', 'pliche'], ['BIA', 'bia']]} value={tab} onChange={setTab} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0, marginHorizontal: -16 }}>
        {PERIODS.map(([k, l]) => <Chip key={k} small label={l} on={period === k} onPress={() => setPeriod(k)} />)}
      </ScrollView>

      {tab === 'misure' ? <Measures list={ms} from={from} height={p?.height_cm ?? null} onAdd={() => setEdit({ kind: 'm', v: {} })} onEdit={(v) => setEdit({ kind: 'm', v })} /> : null}
      {tab === 'pliche' ? (
        <Skinfolds list={sk} from={from} sex={p?.sex ?? null} age={age} canEdit={isStaff}
          onAdd={() => setEdit({ kind: 's', v: {} })} onEdit={(v) => setEdit({ kind: 's', v })} onWho={() => setWho(true)} />
      ) : null}
      {tab === 'bia' ? <Bia list={bia} from={from} canEdit={isStaff} onAdd={() => setEdit({ kind: 'b', v: {} })} onEdit={(v) => setEdit({ kind: 'b', v })} /> : null}

      <RecordSheet visible={edit?.kind === 'm'} title={edit?.v?.id ? 'Modifica misure' : 'Nuove misure'} fields={M_FIELDS} value={edit?.kind === 'm' ? edit.v : null} onClose={() => setEdit(null)}
        onSave={async (row) => {
          await api.saveMeasurement({ ...row, member_id: memberId } as any, userId!);
          if (row.height_cm && !p?.height_cm) await api.updateProfile(memberId, { height_cm: row.height_cm });
          bump(); toast('Misure salvate.');
        }}
        onDelete={edit?.v?.id ? async () => { await api.deleteMeasurement(edit!.v.id); bump(); } : undefined} />

      <RecordSheet visible={edit?.kind === 's'} title={edit?.v?.id ? 'Modifica plicometria' : 'Nuova plicometria'} fields={SKIN_FIELDS} value={edit?.kind === 's' ? edit.v : null} onClose={() => setEdit(null)}
        extra={(vals) => {
          const folds: Record<string, number | null> = {}; SKIN_FIELDS.forEach(([k]) => { folds[k] = parseNum(vals[k]); });
          const when = isDayStr(vals.measured_on) ? parseDay(vals.measured_on) : new Date();
          const r = jacksonPollock3(p?.sex, ageOf(p?.birth_date, when), folds);
          const sites = p?.sex ? SKINFOLD_SITES[p.sex].map(([, l]) => l).join(', ') : '';
          return (
            <View style={{ backgroundColor: t.card2, borderRadius: 14, padding: 12, gap: 2 }}>
              <Txt v="cap" c="sub">Grasso stimato (Jackson-Pollock a 3 pliche)</Txt>
              <Txt v="head">{r ? `${fmtNum(r.bf, 1)} %` : '–'}</Txt>
              <Txt v="cap" c="faint">{p?.sex && age !== null ? `Servono ${sites}.` : 'Servono sesso e data di nascita del socio.'}</Txt>
            </View>
          );
        }}
        onSave={async (row) => {
          const when = parseDay(row.measured_on);
          const r = jacksonPollock3(p?.sex, ageOf(p?.birth_date, when), row);
          await api.saveSkinfold({ ...row, member_id: memberId, bf_pct: r?.bf ?? null, method: r ? 'Jackson-Pollock 3 pliche' : null } as any, userId!);
          bump(); toast('Plicometria salvata.');
        }}
        onDelete={edit?.v?.id ? async () => { await api.deleteSkinfold(edit!.v.id); bump(); } : undefined} />

      <RecordSheet visible={edit?.kind === 'b'} title={edit?.v?.id ? 'Modifica BIA' : 'Nuova BIA'} fields={BIA_FIELDS} value={edit?.kind === 'b' ? edit.v : null} onClose={() => setEdit(null)}
        onSave={async (row) => { await api.saveBia({ ...row, member_id: memberId } as any, userId!); bump(); toast('BIA salvata.'); }}
        onDelete={edit?.v?.id ? async () => { await api.deleteBia(edit!.v.id); bump(); } : undefined} />

      <Sheet visible={who} onClose={() => setWho(false)} title="Sesso ed età" footer={<Button label="Salva" onPress={saveWho} />}>
        <Txt c="sub">Servono per calcolare la percentuale di grasso dalle pliche.</Txt>
        <Segmented items={[['Uomo', 'm'], ['Donna', 'f']]} value={(sex || 'm') as 'm' | 'f'} onChange={setSex} />
        <Field label="Data di nascita" value={birth} onChangeText={setBirth} hint="Anno-mese-giorno, per esempio 1990-05-17." />
      </Sheet>
    </View>
  );
}

// ───────── Misure ─────────

function Measures({ list, from, height, onAdd, onEdit }: { list: Measurement[]; from: string; height: number | null; onAdd: () => void; onEdit: (m: Measurement) => void }) {
  const { t } = useTheme();
  const { userId } = useSession();
  const inP = list.filter((m) => m.measured_on >= from);   // dal più recente
  const withW = inP.filter((m) => m.weight_kg != null);
  const last = withW[0], first = withW[withW.length - 1];
  const change = last && first && last !== first ? last.weight_kg! - first.weight_kg! : null;
  const ws = withW.map((m) => m.weight_kg!);
  const h = list.find((m) => m.height_cm != null)?.height_cm ?? height;
  const imc = last ? bmi(last.weight_kg, h) : null;
  const chart = [...withW].slice(0, 12).reverse().map((m, i, a) => ({ label: fmtDate(m.measured_on), value: m.weight_kg!, on: i === a.length - 1 }));
  const latestOf = (k: keyof Measurement) => inP.find((m) => m[k] != null);
  const oldestOf = (k: keyof Measurement) => [...inP].reverse().find((m) => m[k] != null);
  const imcLabel = imc === null ? '' : imc < 18.5 ? 'sottopeso' : imc < 25 ? 'nella norma' : imc < 30 ? 'sovrappeso' : 'obesità';
  return (
    <View style={{ gap: 14 }}>
      <Button label="Aggiungi misure" icon="add" kind="secondary" onPress={onAdd} />
      {last ? (
        <>
          <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <Txt v="sub" c="sub">Peso · {fmtDate(last.measured_on)}</Txt>
                <Text style={[{ color: t.text, fontSize: 38, fontWeight: '800', letterSpacing: -1 }, NUM]}>{fmtNum(last.weight_kg, 1)}<Text style={{ fontSize: 18, color: t.sub }}> kg</Text></Text>
              </View>
              <Delta v={change} unit="kg" />
            </View>
            {chart.length > 1 ? <BarChart data={chart} height={110} format={(n) => fmtNum(n, 1)} labelEvery={Math.ceil(chart.length / 4)} /> : null}
          </View>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Stat value={ws.length > 1 ? fmtNum(Math.min(...ws), 1) : '–'} label="minimo" />
            <Stat value={ws.length > 1 ? fmtNum(Math.max(...ws), 1) : '–'} label="massimo" />
            <Stat value={ws.length > 1 ? fmtNum(ws.reduce((a, b) => a + b, 0) / ws.length, 1) : '–'} label="media" />
          </View>
          {imc !== null ? (
            <Group>
              <Row title="Indice di massa corporea" sub={`${imcLabel} · altezza ${fmtNum(h, 0)} cm`} value={fmtNum(imc, 1)} />
            </Group>
          ) : <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>Aggiungi l'altezza in una misurazione per vedere l'indice di massa corporea.</Txt>}
        </>
      ) : null}
      {inP.length ? (
        <>
          <SectionTitle>Circonferenze nel periodo</SectionTitle>
          <Group>
            {M_FIELDS.filter(([k]) => !['weight_kg', 'height_cm'].includes(k) && latestOf(k as keyof Measurement)).map(([k, label, unit]) => {
              const cur = latestOf(k as keyof Measurement)!, old = oldestOf(k as keyof Measurement)!;
              const dl = cur !== old ? (cur[k as keyof Measurement] as number) - (old[k as keyof Measurement] as number) : null;
              return <Row key={k} title={label} sub={fmtDate(cur.measured_on)} value={`${fmtNum(cur[k as keyof Measurement] as number, 1)} ${unit}`}
                right={dl !== null ? <Delta v={dl} unit="" good={k === 'waist_cm' || k === 'hips_cm' || k === 'body_fat_pct' ? 'down' : undefined} /> : undefined} />;
            })}
          </Group>
          <SectionTitle>Storico</SectionTitle>
          <Group>
            {inP.map((m) => (
              <Row key={m.id} title={fmtDateShortY(m.measured_on)} minHeight={58} chevron onPress={() => onEdit(m)}
                sub={M_FIELDS.filter(([k]) => m[k as keyof Measurement] != null && k !== 'height_cm').slice(0, 4).map(([k, l, u]) => `${l} ${fmtNum(m[k as keyof Measurement] as number, 1)}${u === '%' ? '%' : ''}`).join(' · ')} />
            ))}
          </Group>
        </>
      ) : <Empty icon="body-outline" title={list.length ? 'Nessuna misura nel periodo' : 'Nessuna misura'} text={list.length ? 'Scegli un periodo più lungo.' : 'Registra peso e circonferenze ogni tanto: vedrai come cambiano nel tempo.'} />}
    </View>
  );
}

// ───────── Plicometria ─────────

function Skinfolds({ list, from, sex, age, canEdit, onAdd, onEdit, onWho }: {
  list: Skinfold[]; from: string; sex: 'm' | 'f' | null; age: number | null; canEdit: boolean; onAdd: () => void; onEdit: (s: Skinfold) => void; onWho: () => void;
}) {
  const { t } = useTheme();
  const inP = list.filter((m) => m.measured_on >= from);
  const withBf = inP.filter((m) => m.bf_pct != null);
  const last = withBf[0], first = withBf[withBf.length - 1];
  const chart = [...withBf].slice(0, 12).reverse().map((m, i, a) => ({ label: fmtDate(m.measured_on), value: Number(m.bf_pct), on: i === a.length - 1 }));
  return (
    <View style={{ gap: 14 }}>
      {canEdit ? <Button label="Aggiungi plicometria" icon="add" kind="secondary" onPress={onAdd} /> : null}
      {canEdit && (!sex || age === null) ? (
        <Group><Row title="Mancano sesso o data di nascita" sub="Servono per calcolare la percentuale di grasso." left={<Icon name="alert-circle-outline" size={22} color="warn" />} chevron onPress={onWho} /></Group>
      ) : null}
      {last ? (
        <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
              <Txt v="sub" c="sub">Grasso corporeo · {fmtDate(last.measured_on)}</Txt>
              <Text style={[{ color: t.text, fontSize: 38, fontWeight: '800', letterSpacing: -1 }, NUM]}>{fmtNum(Number(last.bf_pct), 1)}<Text style={{ fontSize: 18, color: t.sub }}> %</Text></Text>
            </View>
            {first && first !== last ? <Delta v={Number(last.bf_pct) - Number(first.bf_pct)} unit="%" good="down" /> : null}
          </View>
          {chart.length > 1 ? <BarChart data={chart} height={110} format={(n) => fmtNum(n, 1)} labelEvery={Math.ceil(chart.length / 4)} /> : null}
          {last.method ? <Txt v="cap" c="faint">{last.method}. È una stima: serve a confrontare i cambiamenti nel tempo.</Txt> : null}
        </View>
      ) : null}
      {inP.length ? (
        <>
          <SectionTitle>Storico</SectionTitle>
          <Group>
            {inP.map((m) => (
              <Row key={m.id} title={fmtDateShortY(m.measured_on)} minHeight={58} chevron={canEdit} onPress={canEdit ? () => onEdit(m) : undefined}
                value={m.bf_pct != null ? `${fmtNum(Number(m.bf_pct), 1)} %` : undefined}
                sub={SKIN_FIELDS.filter(([k]) => m[k as keyof Skinfold] != null).slice(0, 4).map(([k, l]) => `${l} ${fmtNum(Number(m[k as keyof Skinfold]), 1)}`).join(' · ') + ' mm'} />
            ))}
          </Group>
        </>
      ) : <Empty icon="analytics-outline" title={list.length ? 'Nessuna plicometria nel periodo' : 'Nessuna plicometria'}
        text={canEdit ? 'Misura le pliche con il plicometro: l\'app calcola la percentuale di grasso.' : 'Il tuo trainer inserirà qui le misure con il plicometro.'} />}
    </View>
  );
}

// ───────── BIA (bioimpedenziometria) ─────────

function Bia({ list, from, canEdit, onAdd, onEdit }: { list: BiaScan[]; from: string; canEdit: boolean; onAdd: () => void; onEdit: (b: BiaScan) => void }) {
  const { t } = useTheme();
  const inP = list.filter((m) => m.measured_on >= from);
  const last = inP[0], first = inP[inP.length - 1];
  const withF = inP.filter((m) => m.fat_pct != null);
  const chart = [...withF].slice(0, 12).reverse().map((m, i, a) => ({ label: fmtDate(m.measured_on), value: Number(m.fat_pct), on: i === a.length - 1 }));
  const diff = (k: keyof BiaScan) => (last && first && last !== first && last[k] != null && first[k] != null ? Number(last[k]) - Number(first[k]) : null);
  return (
    <View style={{ gap: 14 }}>
      {canEdit ? <Button label="Aggiungi una BIA" icon="add" kind="secondary" onPress={onAdd} /> : null}
      {last ? (
        <>
          {chart.length > 1 ? (
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
              <Txt v="head">Grasso corporeo (%)</Txt>
              <BarChart data={chart} height={110} format={(n) => fmtNum(n, 1)} labelEvery={Math.ceil(chart.length / 4)} />
            </View>
          ) : null}
          <SectionTitle>Ultima rilevazione · {fmtDate(last.measured_on)}</SectionTitle>
          <Group>
            {BIA_FIELDS.filter(([k]) => last[k as keyof BiaScan] != null).map(([k, label, unit]) => (
              <Row key={k} title={label} value={`${fmtNum(Number(last[k as keyof BiaScan]), 1)}${unit ? ' ' + unit : ''}`}
                right={<Delta v={diff(k as keyof BiaScan)} unit="" good={k === 'fat_pct' || k === 'fat_kg' || k === 'visceral_fat' ? 'down' : k === 'muscle_kg' || k === 'lean_kg' ? 'up' : undefined} />} />
            ))}
          </Group>
          <SectionTitle>Storico</SectionTitle>
          <Group>
            {inP.map((m) => (
              <Row key={m.id} title={fmtDateShortY(m.measured_on)} minHeight={58} chevron={canEdit} onPress={canEdit ? () => onEdit(m) : undefined}
                sub={[m.weight_kg != null ? `Peso ${fmtNum(Number(m.weight_kg), 1)} kg` : '', m.fat_pct != null ? `Grasso ${fmtNum(Number(m.fat_pct), 1)}%` : '', m.muscle_kg != null ? `Muscoli ${fmtNum(Number(m.muscle_kg), 1)} kg` : ''].filter(Boolean).join(' · ')} />
            ))}
          </Group>
        </>
      ) : <Empty icon="pulse-outline" title={list.length ? 'Nessuna BIA nel periodo' : 'Nessuna BIA'}
        text={canEdit ? 'Copia qui i valori della bilancia impedenziometrica per seguire grasso, muscoli e acqua.' : 'Il tuo trainer inserirà qui i valori della bilancia impedenziometrica.'} />}
    </View>
  );
}

// ───────── Schermata aperta dalla scheda del socio ─────────

export function BodyScreen({ id, name }: { id: string; name?: string }) {
  const nav = useNav();
  return (
    <Page onBack={nav.pop} navTitle="Peso e misure" title={name} subtitle="Peso e misure">
      <View style={{ paddingHorizontal: 16 }}><BodyView memberId={id} /></View>
    </Page>
  );
}
