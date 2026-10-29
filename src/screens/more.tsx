// Scheda «Altro» dello staff: menu delle funzioni secondarie e le loro schermate (corsi, collaboratori, iscrizione, profilo).
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { api, Course, errText, MemberRow, Profile, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { Avatar, Button, Empty, ErrorState, Field, Group, Icon, IconButton, Page, Pill, Row, SectionTitle, Sheet, Spinner, Toggle, Txt, useUi } from '../ui';
import { fmtDateShortY, norm, parseNum } from '../util';
import { AccountSection } from './member';
import { MemberPicker } from './staffMembers';
import { SearchBox } from './shared';

// ───────── Menu ─────────

function MenuIcon({ name }: { name: string }) {
  const { t } = useTheme();
  return <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={name} size={20} color="accentInk" /></View>;
}

export function MoreTab() {
  const nav = useNav();
  const { role, profile } = useSession();
  const [pickFor, setPickFor] = useState<'body' | 'report' | null>(null);
  return (
    <Page title="Altro">
      <View style={{ paddingHorizontal: 16, gap: 4, paddingTop: 4 }}>
        <SectionTitle>Attività</SectionTitle>
        <Group>
          <Row title="Calendario" sub="Allenamenti, schede da rinnovare, appuntamenti" left={<MenuIcon name="calendar-outline" />} chevron onPress={() => nav.push('calendar')} />
          <Row title="Notifiche push" sub="Manda un avviso ai soci" left={<MenuIcon name="notifications-outline" />} chevron onPress={() => nav.push('push')} />
          <Row title="Corsi" sub="Lezioni di gruppo da consigliare nelle schede" left={<MenuIcon name="people-outline" />} chevron onPress={() => nav.push('courses')} />
          <Row title="Documenti" sub="PDF da assegnare ai soci" left={<MenuIcon name="document-text-outline" />} chevron onPress={() => nav.push('documents')} />
          <Row title="Classifica delle tonnellate" sub="Chi ha sollevato di più (solo chi partecipa)" left={<MenuIcon name="trophy-outline" />} chevron onPress={() => nav.push('leaderboard')} />
        </Group>

        <SectionTitle>Dati dei soci</SectionTitle>
        <Group>
          <Row title="Peso e misure" sub="Misure, plicometria e BIA" left={<MenuIcon name="body-outline" />} chevron onPress={() => setPickFor('body')} />
          <Row title="Report allenamenti" sub="Frequenza e progressione dei carichi" left={<MenuIcon name="analytics-outline" />} chevron onPress={() => setPickFor('report')} />
        </Group>

        <SectionTitle>Palestra</SectionTitle>
        <Group>
          <Row title="Collaboratori" sub="Personal trainer e titolari" left={<MenuIcon name="people-circle-outline" />} chevron onPress={() => nav.push('staff')} />
          {role === 'owner' ? <Row title="Iscrizione dei soci" sub="Nome della palestra e codice" left={<MenuIcon name="key-outline" />} chevron onPress={() => nav.push('gym-settings')} /> : null}
        </Group>

        <SectionTitle>Account</SectionTitle>
        <Group>
          <Row title={profile?.full_name || 'Il tuo profilo'} sub="Dati, aspetto, notifiche, esci" left={<Avatar name={profile?.full_name} size={36} />} chevron onPress={() => nav.push('account')} />
        </Group>
      </View>
      <MemberPicker visible={!!pickFor} onClose={() => setPickFor(null)} onPick={(m: MemberRow) => { const k = pickFor; setPickFor(null); nav.push(k === 'report' ? 'report' : 'body', { id: m.id, name: m.full_name }); }} />
    </Page>
  );
}

export function AccountScreen() {
  const nav = useNav();
  return <Page onBack={nav.pop} navTitle="Il tuo profilo"><View style={{ paddingHorizontal: 16, paddingTop: 4 }}><AccountSection /></View></Page>;
}

// ───────── Corsi ─────────

export function CoursesScreen() {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const d = useAsync(() => api.courses(), []);
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Partial<Course> | null>(null);
  const [f, setF] = useState({ name: '', category: '', duration: '', description: '', active: true });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (edit) setF({ name: edit.name || '', category: edit.category || '', duration: edit.duration_min ? String(edit.duration_min) : '', description: edit.description || '', active: edit.active ?? true });
  }, [edit]);
  const list = useMemo(() => {
    const n = norm(q.trim());
    return (d.data || []).filter((c) => !n || norm(c.name).includes(n) || norm(c.category || '').includes(n));
  }, [d.data, q]);

  const save = async () => {
    if (!f.name.trim()) return toast('Scrivi il nome del corso.', 'error');
    setBusy(true);
    try {
      await api.saveCourse({ id: edit?.id, name: f.name, category: f.category, description: f.description, duration_min: f.duration ? Math.round(parseNum(f.duration) || 0) || null : null, active: f.active });
      bump(); toast('Corso salvato.'); setEdit(null);
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const del = async () => {
    if (!edit?.id) return;
    if (!(await confirm({ title: 'Eliminare il corso?', message: 'Le lezioni già inserite nelle schede restano, ma senza il collegamento al corso.', confirmLabel: 'Elimina', destructive: true }))) return;
    try { await api.deleteCourse(edit.id); bump(); setEdit(null); } catch (e) { toast(errText(e), 'error'); }
  };

  return (
    <Page onBack={nav.pop} navTitle="Corsi" right={<IconButton name="add-circle" size={30} color="accentInk" label="Nuovo corso" onPress={() => setEdit({})} />}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          {(d.data?.length || 0) > 6 ? <SearchBox value={q} onChange={setQ} placeholder="Cerca un corso" /> : null}
          {!list.length ? (
            <Empty icon="people-outline" title={q ? 'Nessun corso trovato' : 'Nessun corso'} text={q ? undefined : 'Aggiungi i corsi della palestra (yoga, pilates, spinning…): poi li consigli nelle schede e li inserisci come lezioni.'}
              action={q ? undefined : <Button label="Aggiungi un corso" icon="add" small full={false} onPress={() => setEdit({})} />} />
          ) : (
            <Group>
              {list.map((c) => (
                <Row key={c.id} title={c.name} sub={[c.category, c.duration_min ? `${c.duration_min} minuti` : ''].filter(Boolean).join(' · ') || undefined} minHeight={60}
                  left={<MenuIcon name="people-outline" />} chevron onPress={() => setEdit(c)} right={!c.active ? <Pill label="Non attivo" /> : undefined} />
              ))}
            </Group>
          )}
        </View>
      )}
      <Sheet visible={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Modifica corso' : 'Nuovo corso'}
        footer={<><Button label="Salva" onPress={save} loading={busy} />{edit?.id ? <Button label="Elimina" kind="ghost" onPress={del} /> : null}</>}>
        <Field label="Nome" value={f.name} onChangeText={(s) => setF({ ...f, name: s })} placeholder="Per esempio Pilates" maxLength={60} />
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Field label="Categoria" value={f.category} onChangeText={(s) => setF({ ...f, category: s })} placeholder="Mente e corpo" style={{ flex: 1.4 }} maxLength={40} />
          <Field label="Durata" value={f.duration} onChangeText={(s) => setF({ ...f, duration: s })} suffix="min" keyboardType="number-pad" style={{ flex: 1 }} />
        </View>
        <Field label="Descrizione" value={f.description} onChangeText={(s) => setF({ ...f, description: s })} multiline maxLength={400} />
        <Group>
          <Row title="Corso attivo" sub={f.active ? 'Si può consigliare nelle schede' : 'Nascosto nelle nuove schede'} right={<Toggle label="Corso attivo" value={f.active} onChange={(v) => setF({ ...f, active: v })} />} />
        </Group>
      </Sheet>
    </Page>
  );
}

// ───────── Collaboratori ─────────

export function StaffScreen() {
  const { t } = useTheme();
  const nav = useNav();
  const { role, userId } = useSession();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const owner = role === 'owner';
  const d = useAsync(async () => ({ staff: await api.staffProfiles(), stats: await api.stats(30) }), []);
  const [sel, setSel] = useState<Profile | null>(null);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  const members = (id: string) => d.data?.stats.trainers.find((x) => x.id === id)?.members ?? 0;

  const run = async (fn: () => Promise<void>, ok?: string) => {
    setBusy(true);
    try { await fn(); bump(); if (ok) toast(ok); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const promote = async (m: MemberRow) => {
    setPick(false);
    if (!(await confirm({ title: `Nominare ${m.full_name} personal trainer?`, message: 'Potrà vedere tutti i soci, creare e modificare schede e scrivere note riservate.', confirmLabel: 'Nomina' }))) return;
    await run(() => api.setRole(m.id, 'trainer'), 'Nuovo personal trainer.');
  };
  const demote = async (p: Profile) => {
    setSel(null);
    if (!(await confirm({ title: `Togliere il ruolo a ${p.full_name}?`, message: 'Torna a essere un normale socio: non vedrà più gli altri soci né le note.', confirmLabel: 'Togli il ruolo', destructive: true }))) return;
    await run(() => api.setRole(p.id, 'member'), 'Ruolo rimosso.');
  };
  const wa = (p?: string | null) => { const x = (p || '').replace(/\D/g, ''); return x ? (x.length === 10 ? '39' + x : x) : ''; };

  return (
    <Page onBack={nav.pop} navTitle="Collaboratori" right={owner ? <IconButton name="person-add" label="Nomina un personal trainer" color="accentInk" onPress={() => setPick(true)} /> : undefined}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          <Group>
            {d.data!.staff.map((p) => (
              <Row key={p.id} title={p.full_name || 'Senza nome'} minHeight={62} left={<Avatar name={p.full_name} size={40} />} chevron onPress={() => setSel(p)}
                sub={`${members(p.id)} ${members(p.id) === 1 ? 'socio seguito' : 'soci seguiti'}`} right={<Pill label={p.role === 'owner' ? 'Titolare' : 'Personal trainer'} />} />
            ))}
          </Group>
          {owner ? <Button label="Nomina un personal trainer" icon="person-add-outline" kind="secondary" onPress={() => setPick(true)} /> : null}
          <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>Per diventare collaboratore una persona deve prima registrarsi nell'app con il codice della palestra: poi la nomini da qui.</Txt>
        </View>
      )}
      <MemberPicker visible={pick} onClose={() => setPick(false)} onPick={promote} busy={busy} />
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.full_name || ''}>
        <Group>
          <Row title="Ruolo" value={sel?.role === 'owner' ? 'Titolare' : 'Personal trainer'} />
          <Row title="Registrato dal" value={sel ? fmtDateShortY(sel.created_at) : ''} />
          <Row title="Email" value={sel?.email || '–'} />
          <Row title="Telefono" value={sel?.phone || '–'} />
          {sel?.phone ? <Row title="Chiama" left={<Icon name="call-outline" size={22} color="accentInk" />} onPress={() => Linking.openURL(`tel:${sel.phone}`)} /> : null}
          {wa(sel?.phone) ? <Row title="WhatsApp" left={<Icon name="logo-whatsapp" size={22} color="accentInk" />} onPress={() => Linking.openURL(`https://wa.me/${wa(sel?.phone)}`)} /> : null}
          {owner && sel?.role === 'trainer' && sel.id !== userId ? <Row title="Togli il ruolo di personal trainer" danger onPress={() => demote(sel)} /> : null}
        </Group>
      </Sheet>
    </Page>
  );
}

// ───────── Iscrizione dei soci (solo titolare) ─────────

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const randomCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export function GymSettingsScreen() {
  const nav = useNav();
  const { toast } = useUi();
  const { bump } = useVersion();
  const d = useAsync(() => api.gym(), []);
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (d.data) { setName(d.data.name || ''); setCode(d.data.join_code || ''); } }, [d.data]);
  const dirty = !!d.data && (name !== (d.data.name || '') || code.trim().toUpperCase() !== (d.data.join_code || ''));
  const save = async () => {
    if (!name.trim()) return toast('Scrivi il nome della palestra.', 'error');
    setBusy(true);
    try { await api.saveGym({ name: name.trim(), join_code: code.trim().toUpperCase() || null }); bump(); toast('Dati salvati.'); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Page onBack={nav.pop} navTitle="Iscrizione dei soci" footer={<Button label="Salva" onPress={save} loading={busy} disabled={!dirty} />}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          <Field label="Nome della palestra" value={name} onChangeText={setName} />
          <Field label="Codice palestra" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={12}
            hint="Lo dai ai nuovi soci: senza codice non possono registrarsi. Lascialo vuoto per lasciare la registrazione libera." />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Button small kind="secondary" label="Genera un codice" icon="refresh" full={false} onPress={() => setCode(randomCode())} />
            <Button small kind="ghost" label="Togli il codice" full={false} onPress={() => setCode('')} />
          </View>
        </View>
      )}
    </Page>
  );
}
