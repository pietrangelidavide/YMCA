// Scheda «Palestra»: numeri del mese, PT e (per il titolare) gestione del team e del codice di iscrizione.
import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, errText, MemberRow, Profile, Stats, useAsync } from '../data';
import { useTabs, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { Avatar, BarChart, Button, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Sheet, Spinner, Stat, Txt, useUi } from '../ui';
import { addDays, fmtDate, isoDay, startOfWeek } from '../util';
import { AccountSection } from './member';
import { MemberPicker, useMemberFilter } from './staffMembers';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

function weeklyFromStats(s: Stats) {
  const by = new Map(s.weekly.map((w) => [w.week.slice(0, 10), w.workouts]));
  const start = startOfWeek(new Date());
  return Array.from({ length: 8 }, (_, i) => {
    const from = addDays(start, -(7 - i) * 7);
    return { label: fmtDate(from), value: by.get(isoDay(from)) || 0, on: i === 7 };
  });
}

export function GymTab() {
  const { t } = useTheme();
  const tabs = useTabs();
  const { setFilter } = useMemberFilter();
  const { role } = useSession();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const owner = role === 'owner';
  const d = useAsync(async () => ({ stats: await api.stats(30), gym: await api.gym(), staff: await api.staffProfiles() }), []);
  const [pick, setPick] = useState(false);
  const [edit, setEdit] = useState<{ name: string; code: string } | null>(null);
  const [staffSel, setStaffSel] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  const weekly = useMemo(() => (d.data ? weeklyFromStats(d.data.stats) : []), [d.data]);
  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); bump(); if (ok) toast(ok); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const go = (f: 'nop' | 'exp') => { setFilter(f); tabs.setTab('soci'); };

  const promote = async (m: MemberRow) => {
    setPick(false);
    if (!(await confirm({ title: `Nominare ${m.full_name} personal trainer?`, message: 'Potrà vedere tutti i soci, creare e modificare schede e scrivere note riservate.', confirmLabel: 'Nomina' }))) return;
    await run(() => api.setRole(m.id, 'trainer'), 'Nuovo personal trainer.');
  };
  const demote = async (p: Profile) => {
    setStaffSel(null);
    if (!(await confirm({ title: `Togliere il ruolo a ${p.full_name}?`, message: 'Torna a essere un normale socio: non vedrà più gli altri soci né le note.', confirmLabel: 'Togli il ruolo', destructive: true }))) return;
    await run(() => api.setRole(p.id, 'member'), 'Ruolo rimosso.');
  };
  const saveGym = async () => {
    if (!edit) return;
    if (!edit.name.trim()) return toast('Scrivi il nome della palestra.', 'error');
    const code = edit.code.trim().toUpperCase();
    await run(async () => { await api.saveGym({ name: edit.name.trim(), join_code: code || null }); setEdit(null); }, 'Dati salvati.');
  };

  const s = d.data?.stats;
  return (
    <Page title="Palestra" subtitle={d.data?.gym?.name || undefined}>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : s ? (
          <>
            <Txt v="sub" c="sub" style={{ paddingHorizontal: 4 }}>Ultimi 30 giorni</Txt>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat value={s.members_active} label="soci attivi" />
              <Stat value={s.members_training} label="si sono allenati" tone="accentInk" />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Stat value={s.workouts} label="allenamenti registrati" />
              <Stat value={s.members_new} label="nuovi iscritti" />
            </View>
            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
              <Txt v="head">Allenamenti a settimana</Txt>
              <BarChart data={weekly} height={120} />
            </View>

            <SectionTitle>Da seguire</SectionTitle>
            <Group>
              <Row title="Soci senza scheda" value={String(s.without_program)} chevron={s.without_program > 0} onPress={s.without_program ? () => go('nop') : undefined}
                left={<Icon name={s.without_program ? 'alert-circle' : 'checkmark-circle'} size={24} color={s.without_program ? t.warn : t.ok} />} />
              <Row title="Schede in scadenza" sub="Entro 7 giorni o già scadute" value={String(s.expiring)} chevron={s.expiring > 0} onPress={s.expiring ? () => go('exp') : undefined}
                left={<Icon name={s.expiring ? 'time' : 'checkmark-circle'} size={24} color={s.expiring ? t.warn : t.ok} />} />
            </Group>

            <SectionTitle>Personal trainer</SectionTitle>
            <Group>
              {s.trainers.map((tr) => (
                <Row key={tr.id} title={tr.name} sub={`${tr.members} ${tr.members === 1 ? 'socio seguito' : 'soci seguiti'}`} left={<Avatar name={tr.name} size={40} />}
                  right={d.data!.staff.find((x) => x.id === tr.id)?.role === 'owner' ? <Pill label="Titolare" /> : undefined}
                  onPress={owner && d.data!.staff.find((x) => x.id === tr.id)?.role === 'trainer' ? () => setStaffSel(d.data!.staff.find((x) => x.id === tr.id)!) : undefined} />
              ))}
            </Group>
            {owner ? <Button label="Nomina un personal trainer" icon="person-add-outline" kind="secondary" onPress={() => setPick(true)} /> : null}

            {owner ? (
              <>
                <SectionTitle>Iscrizione dei soci</SectionTitle>
                <Group>
                  <Row title="Nome della palestra" value={d.data!.gym?.name || '–'} chevron onPress={() => setEdit({ name: d.data!.gym?.name || '', code: d.data!.gym?.join_code || '' })} />
                  <Row title="Codice palestra" sub={d.data!.gym?.join_code ? 'Chi si registra deve scriverlo' : 'Nessun codice: chiunque può registrarsi'} value={d.data!.gym?.join_code || 'Libero'} chevron onPress={() => setEdit({ name: d.data!.gym?.name || '', code: d.data!.gym?.join_code || '' })} />
                </Group>
              </>
            ) : null}
          </>
        ) : null}

        <SectionTitle>Il tuo profilo</SectionTitle>
        <AccountSection />
      </View>

      <MemberPicker visible={pick} onClose={() => setPick(false)} onPick={promote} busy={busy} />
      <Sheet visible={!!staffSel} onClose={() => setStaffSel(null)} title={staffSel?.full_name || ''}>
        <Group>
          <Row title="Togli il ruolo di personal trainer" danger onPress={() => demote(staffSel!)} />
        </Group>
      </Sheet>
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title="Iscrizione dei soci" footer={<Button label="Salva" onPress={saveGym} loading={busy} />}>
        <Field label="Nome della palestra" value={edit?.name} onChangeText={(name) => setEdit((e) => (e ? { ...e, name } : e))} />
        <Field label="Codice palestra" value={edit?.code} onChangeText={(code) => setEdit((e) => (e ? { ...e, code } : e))} autoCapitalize="characters"
          hint="Lo dai ai nuovi soci: senza codice non possono registrarsi. Lascialo vuoto per lasciare la registrazione libera." />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small kind="secondary" label="Genera un codice" icon="refresh" full={false} onPress={() => setEdit((e) => (e ? { ...e, code: randomCode() } : e))} />
          <Button small kind="ghost" label="Togli il codice" full={false} onPress={() => setEdit((e) => (e ? { ...e, code: '' } : e))} />
        </View>
      </Sheet>
    </Page>
  );
}
