// Schermate del socio: scheda, progressi (carichi, misure, storico), dettaglio allenamento, profilo.
import React, { useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { pushState, registerForPush } from '../../lib/push';
import { BRAND } from '../brand';
import { api, errText, Measurement, Program, ProgramRow, useAsync, useExercises, WorkoutRow } from '../data';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { Mode, NUM, plate, useTheme } from '../theme';
import { Avatar, BarChart, Button, Empty, ErrorState, Field, Group, Icon, IconButton, Page, Pill, Row, SectionTitle, Segmented, Sheet, Spinner, Stat, Txt, useUi } from '../ui';
import { addDays, ago, fmtDate, fmtDateLong, fmtDateShortY, fmtNum, fmtRest, fmtTime, isoDay, LEVEL, MUSCLE, muscleLabel, OBJECTIVE, parseNum, startOfWeek } from '../util';
import { BodyView } from './body';
import { MyDocuments } from './docs';
import { LeaderboardCard } from './leaderboard';
import { CommentsThread, ExerciseTile, ILLUSTRATIONS_CREDIT, ILLUSTRATIONS_URL } from './shared';
import { programWeek } from './Today';

// ───────── Scheda ─────────

export function ProgramView({ program, memberName, actions, showComments = true }: { program: Program; memberName?: string; actions?: React.ReactNode; showComments?: boolean }) {
  const { t } = useTheme();
  const nav = useNav();
  const staff = useAsync(() => api.staff(), []);
  const w = programWeek(program);
  const trainer = staff.data?.find((s) => s.id === program.trainer_id)?.full_name;
  const courses = useAsync(() => (program.course_ids?.length ? api.courses() : Promise.resolve([])), [program.id]);
  const recommended = (courses.data || []).filter((c) => program.course_ids?.includes(c.id));
  return (
    <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
      <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, gap: 10 }}>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {program.is_template ? <Pill label="Modello" icon="copy-outline" /> : null}
          {program.status === 'active' ? <Pill label="Attiva" color={t.accentSoft} textColor={t.accentInk} icon="flash" /> : null}
          {program.status === 'archived' ? <Pill label="Archiviata" icon="archive-outline" /> : null}
          {program.status === 'draft' && !program.is_template ? <Pill label="Bozza" icon="create-outline" /> : null}
          {program.objective ? <Pill label={OBJECTIVE[program.objective] || program.objective} icon="trophy-outline" /> : null}
          {program.level ? <Pill label={`Livello ${(LEVEL[program.level] || program.level).toLowerCase()}`} icon="speedometer-outline" /> : null}
        </View>
        <Text style={{ color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.4 }}>{program.name}</Text>
        {program.goal ? <Txt c="sub">{program.goal}</Txt> : null}
        <Txt v="sub" c="faint">
          {program.weeks} settimane{program.starts_on ? ` · dal ${fmtDateShortY(program.starts_on)}` : ''}{trainer ? ` · ${trainer}` : ''}
        </Txt>
        {w && program.status === 'active' ? (
          <View style={{ gap: 6 }}>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: t.card2 }}><View style={{ height: 6, borderRadius: 3, width: `${Math.min(100, (w.n / w.total) * 100)}%` as any, backgroundColor: t.accent }} /></View>
            <Txt v="cap" c="sub">{w.over ? 'Scheda terminata' : `Settimana ${w.n} di ${w.total}`} · fine {fmtDate(w.endsOn)}</Txt>
          </View>
        ) : null}
        {recommended.length ? (
          <View style={{ gap: 6 }}>
            <Txt v="cap" c="sub">Corsi consigliati</Txt>
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>{recommended.map((c) => <Pill key={c.id} label={c.name} icon="people-outline" color={t.accentSoft} textColor={t.accentInk} />)}</View>
          </View>
        ) : null}
        {program.notes ? (
          <View style={{ backgroundColor: t.card2, borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8 }}>
            <Icon name="chatbubble-outline" size={16} color="sub" style={{ marginTop: 2 }} />
            <Text style={{ flex: 1, color: t.text, fontSize: 15, lineHeight: 21 }}>{program.notes}</Text>
          </View>
        ) : null}
      </View>
      {actions}
      {program.days.map((day, di) => {
        const p = plate(di);
        return (
          <View key={day.id || di} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, marginTop: 8 }}>
              <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: p.c, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.on, fontSize: 16, fontWeight: '800' }}>{String.fromCharCode(65 + di)}</Text></View>
              <View style={{ flex: 1 }}>
                <Txt v="head">{day.name}</Txt>
                {day.focus ? <Txt v="sub" c="sub">{day.focus}</Txt> : null}
              </View>
            </View>
            <Group>
              {day.items.map((it, i) => (it.kind || 'exercise') === 'exercise' && it.exercise ? (
                <Row key={it.id || i} title={it.exercise.name} left={<ExerciseTile e={it.exercise} size={44} />} chevron minHeight={60}
                  sub={`${it.sets} × ${it.reps}${it.load_hint ? ` · ${it.load_hint}` : ''} · rec. ${fmtRest(it.rest_sec)}${it.note ? `\n${it.note}` : ''}`}
                  right={it.superset ? <Pill label={`Superserie ${it.superset}`} /> : undefined}
                  onPress={() => nav.push('exercise', { id: it.exercise_id })} />
              ) : (
                <Row key={it.id || i} minHeight={60} lines={2} title={it.title || it.course?.name || 'Voce della scheda'}
                  left={<View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={it.kind === 'lesson' ? 'people' : it.kind === 'rest' ? 'cafe' : 'flash'} size={22} color="accentInk" /></View>}
                  sub={[it.kind === 'lesson' ? 'Lezione' : it.kind === 'rest' ? `Riposo${it.rest_sec ? ` ${fmtRest(it.rest_sec)}` : ''}` : 'Tecnica di allenamento', it.kind === 'lesson' && it.course?.duration_min ? `${it.course.duration_min} min` : ''].filter(Boolean).join(' · ') + (it.note ? `\n${it.note}` : '')} />
              ))}
              {!day.items.length ? <Row title="Nessun esercizio" /> : null}
            </Group>
          </View>
        );
      })}
      {showComments && !program.is_template && program.status !== 'draft' ? (
        <View style={{ gap: 6 }}>
          <SectionTitle>Messaggi con il PT</SectionTitle>
          <CommentsThread programId={program.id} memberName={memberName} />
        </View>
      ) : null}
    </View>
  );
}

export function ProgramTab() {
  const { userId } = useSession();
  const nav = useNav();
  const d = useAsync(async () => {
    const [program, all] = await Promise.all([api.activeProgram(), api.programsOf(userId!)]);
    return { program, past: all.filter((p) => p.status === 'archived') };
  }, [userId]);
  return (
    <Page title="La tua scheda">
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : !d.data?.program ? (
        <View style={{ paddingHorizontal: 16 }}><Empty icon="clipboard-outline" title="Nessuna scheda attiva" text="Appena il tuo PT te ne assegna una, la trovi qui con tutti gli esercizi." /></View>
      ) : <ProgramView program={d.data.program} />}
      {d.data?.past.length ? (
        <View style={{ paddingHorizontal: 16 }}>
          <SectionTitle>Schede precedenti</SectionTitle>
          <Group>
            {d.data.past.map((p) => <Row key={p.id} title={p.name} sub={p.starts_on ? `dal ${fmtDateShortY(p.starts_on)} · ${p.weeks} settimane` : `${p.weeks} settimane`} chevron onPress={() => nav.push('program', { id: p.id })} />)}
          </Group>
        </View>
      ) : null}
    </Page>
  );
}

// Una scheda qualsiasi (archiviata, o del socio visto dallo staff)
export function ProgramScreen({ id, memberName }: { id: string; memberName?: string }) {
  const nav = useNav();
  const { isStaff } = useSession();
  const d = useAsync(() => api.program(id), [id]);
  return (
    <Page onBack={nav.pop} navTitle={d.data?.name || 'Scheda'}
      right={isStaff && d.data ? <IconButton name="create-outline" color="accentInk" label="Modifica la scheda" onPress={() => nav.push('builder', { id })} /> : undefined}>
      {d.loading && !d.data ? <Spinner /> : d.data ? <ProgramView program={d.data} memberName={memberName} /> : <Empty title="Scheda non trovata" />}
    </Page>
  );
}

// ───────── Progressi ─────────

export function ProgressView({ memberId, mine }: { memberId: string; mine: boolean }) {
  const { t } = useTheme();
  const [tab, setTab] = useState<'carichi' | 'corpo' | 'storico'>('carichi');
  return (
    <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
      <Segmented items={[['Carichi', 'carichi'], ['Corpo', 'corpo'], ['Storico', 'storico']]} value={tab} onChange={setTab} />
      {tab === 'carichi' ? <Loads memberId={memberId} /> : tab === 'corpo' ? <BodyView memberId={memberId} /> : <History memberId={memberId} />}
    </View>
  );
}

function weeklyCounts(ws: WorkoutRow[], weeks = 8) {
  const start = startOfWeek(new Date());
  return Array.from({ length: weeks }, (_, i) => {
    const from = addDays(start, -(weeks - 1 - i) * 7), to = addDays(from, 7);
    return { label: fmtDate(from), value: ws.filter((w) => { const x = new Date(w.started_at); return x >= from && x < to; }).length, on: i === weeks - 1 };
  });
}

function Loads({ memberId }: { memberId: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const d = useAsync(async () => ({ progress: await api.progress(memberId), workouts: await api.workouts(memberId, 120) }), [memberId]);
  if (d.loading && !d.data) return <Spinner />;
  if (d.error && !d.data) return <ErrorState error={d.error} onRetry={d.reload} />;
  const { progress, workouts } = d.data!;
  const weekly = weeklyCounts(workouts);
  const month = workouts.filter((w) => Date.now() - new Date(w.started_at).getTime() < 30 * 86400000).length;
  let streak = 0;
  for (let i = weekly.length - 1; i >= 0; i--) { if (weekly[i].value > 0) streak++; else if (i === weekly.length - 1) continue; else break; }
  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Stat value={month} label="allenamenti in 30 giorni" />
        <Stat value={streak} label={streak === 1 ? 'settimana di fila' : 'settimane di fila'} tone={streak ? 'accentInk' : undefined} />
      </View>
      <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
        <Txt v="head">Allenamenti a settimana</Txt>
        <BarChart data={weekly} height={120} />
      </View>
      <SectionTitle>Esercizi seguiti</SectionTitle>
      {!progress.length ? <Empty icon="stats-chart-outline" title="Ancora nessun dato" text="Dopo il primo allenamento vedrai qui i carichi e i miglioramenti." /> : (
        <Group>
          {progress.map((p) => {
            const first = p.series[0], lastS = p.series[p.series.length - 1];
            const delta = p.series.length > 1 ? (lastS.w - first.w) || (lastS.reps - first.reps) : 0;
            const unit = lastS.w ? 'kg' : 'rip.';
            return (
              <Row key={p.exercise_id} title={p.name} sub={`${lastS.w ? `${fmtNum(lastS.w, 2)} kg × ${lastS.reps}` : `${lastS.reps} ripetizioni`} · ${ago(p.last_at)}`}
                left={<ExerciseTile e={{ muscle_group: p.muscle_group, video_url: null }} size={44} />} chevron minHeight={62}
                right={delta ? <Pill label={`${delta > 0 ? '+' : ''}${fmtNum(delta, 1)} ${unit}`} color={delta > 0 ? 'rgba(52,199,89,0.18)' : t.card2} textColor={delta > 0 ? t.ok : t.sub} icon={delta > 0 ? 'trending-up' : 'trending-down'} /> : undefined}
                onPress={() => nav.push('exercise', { id: p.exercise_id, memberId })} />
            );
          })}
        </Group>
      )}
    </View>
  );
}

function History({ memberId }: { memberId: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const d = useAsync(() => api.workouts(memberId, 80), [memberId]);
  if (d.loading && !d.data) return <Spinner />;
  if (d.error && !d.data) return <ErrorState error={d.error} onRetry={d.reload} />;
  if (!d.data?.length) return <Empty icon="time-outline" title="Nessun allenamento" text="Gli allenamenti che completi compaiono qui." />;
  return (
    <Group>
      {d.data.map((w) => {
        const min = w.finished_at ? Math.max(1, Math.round((new Date(w.finished_at).getTime() - new Date(w.started_at).getTime()) / 60000)) : null;
        return <Row key={w.id} title={w.day_name || 'Allenamento'} sub={`${fmtDateLong(w.started_at)}, ${fmtTime(w.started_at)}${min ? ` · ${min} min` : ''}`} chevron minHeight={60}
          left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}><Icon name="barbell" size={22} color="accentInk" /></View>}
          right={w.rpe ? <Pill label={w.rpe >= 10 ? 'Al limite' : w.rpe >= 8 ? 'Duro' : w.rpe >= 7 ? 'Giusto' : 'Facile'} /> : undefined}
          onPress={() => nav.push('workout-detail', { workout: w })} />;
      })}
    </Group>
  );
}

export function ProgressTab() {
  const { userId } = useSession();
  return (
    <Page title="Progressi">
      <View style={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 14 }}><LeaderboardCard /></View>
      <ProgressView memberId={userId!} mine />
    </Page>
  );
}

export function MemberProgressScreen({ id, name }: { id: string; name?: string }) {
  const nav = useNav();
  return <Page onBack={nav.pop} navTitle={name || 'Progressi'}><ProgressView memberId={id} mine={false} /></Page>;
}

export function WorkoutDetail({ workout }: { workout: WorkoutRow }) {
  const { t } = useTheme();
  const nav = useNav();
  const ex = useExercises();
  const d = useAsync(() => api.workoutSets(workout.id), [workout.id]);
  const groups = useMemo(() => {
    const m = new Map<string, typeof d.data>();
    (d.data || []).forEach((s) => { m.set(s.exercise_id, [...(m.get(s.exercise_id) || []), s]); });
    return [...m.entries()];
  }, [d.data]);
  const min = workout.finished_at ? Math.max(1, Math.round((new Date(workout.finished_at).getTime() - new Date(workout.started_at).getTime()) / 60000)) : null;
  const volume = (d.data || []).reduce((a, s) => a + (s.weight_kg || 0) * (s.reps || 0), 0);
  return (
    <Page onBack={nav.pop} navTitle={workout.day_name || 'Allenamento'}>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        <Txt c="sub">{fmtDateLong(workout.started_at)}, {fmtTime(workout.started_at)}</Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Stat value={min ? `${min}'` : '–'} label="durata" />
          <Stat value={d.data?.length ?? '–'} label="serie" />
          <Stat value={volume >= 1000 ? `${fmtNum(volume / 1000, 1)} t` : `${Math.round(volume)}`} label={volume >= 1000 ? 'sollevate' : 'kg totali'} />
        </View>
        {workout.note ? <View style={{ backgroundColor: t.card, borderRadius: 16, padding: 14 }}><Txt c="sub">{workout.note}</Txt></View> : null}
        {d.loading && !d.data ? <Spinner /> : groups.map(([exId, sets]) => {
          const e = ex.data?.find((x) => x.id === exId);
          return (
            <View key={exId} style={{ backgroundColor: t.card, borderRadius: 18, padding: 14, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                {e ? <ExerciseTile e={e} size={36} /> : null}
                <Txt v="head" style={{ flex: 1 }}>{e?.name || 'Esercizio'}</Txt>
              </View>
              {sets!.map((s, i) => (
                <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Txt c="sub">Serie {s.set_no}</Txt>
                  <Txt num style={{ fontWeight: '600' }}>{s.weight_kg ? `${fmtNum(s.weight_kg, 2)} kg` : 'corpo libero'} × {s.reps ?? '–'}</Txt>
                </View>
              ))}
            </View>
          );
        })}
      </View>
    </Page>
  );
}

// ───────── Profilo e impostazioni (socio e staff) ─────────

export function AccountSection() {
  const { t, mode, setMode } = useTheme();
  const { profile, signOut, patchProfile, role } = useSession();
  const { toast, confirm } = useUi();
  const [push, setPush] = useState<string>('…');
  const [edit, setEdit] = useState(false);
  React.useEffect(() => { pushState().then(setPush); }, []);
  const enable = async () => { const s = await registerForPush(true); setPush(s); toast(s === 'granted' ? 'Notifiche attivate.' : s === 'denied' ? 'Hai negato il permesso: puoi cambiarlo dalle impostazioni del telefono.' : 'Notifiche non disponibili su questo dispositivo.', s === 'granted' ? 'ok' : 'error'); };
  const del = async () => {
    if (!(await confirm({ title: 'Eliminare il tuo account?', message: 'Verranno cancellati il tuo profilo, le schede, gli allenamenti e le misure. Non si può annullare.', confirmLabel: 'Elimina tutto', destructive: true }))) return;
    try { await api.deleteAccount(); await signOut(); } catch (e) { toast(errText(e), 'error'); }
  };
  return (
    <View style={{ gap: 14 }}>
      <View style={{ backgroundColor: t.card, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={profile?.full_name} size={60} />
        <View style={{ flex: 1 }}>
          <Txt v="title">{profile?.full_name || 'Il tuo profilo'}</Txt>
          <Txt v="sub" c="sub">{profile?.email}</Txt>
          {role !== 'member' ? <View style={{ marginTop: 6 }}><Pill label={role === 'owner' ? 'Titolare' : 'Personal trainer'} /></View> : null}
        </View>
        <IconButton name="create-outline" label="Modifica i tuoi dati" color="accentInk" onPress={() => setEdit(true)} />
      </View>
      {profile?.goal ? <Group pad><Txt v="sub" c="sub">Il tuo obiettivo</Txt><Txt>{profile.goal}</Txt></Group> : null}
      <SectionTitle>Aspetto</SectionTitle>
      <Segmented items={[['Automatico', 'auto'], ['Chiaro', 'light'], ['Scuro', 'dark']]} value={mode} onChange={(m) => setMode(m as Mode)} />
      <SectionTitle>Notifiche</SectionTitle>
      <Group>
        <Row title="Avvisi sul telefono" sub={role === 'member' ? 'Nuova scheda e messaggi del PT' : 'Messaggi dei soci'} value={push === 'granted' ? 'Attivi' : push === 'unavailable' ? 'Non disponibili' : push === 'denied' ? 'Negati' : ''}
          right={push === 'undetermined' ? <Text style={{ color: t.accentInk, fontSize: 16, fontWeight: '600' }}>Attiva</Text> : undefined} onPress={push === 'undetermined' ? enable : undefined} />
      </Group>
      <SectionTitle>Account</SectionTitle>
      <Group>
        {BRAND.privacyUrl ? <Row title="Informativa privacy" chevron onPress={() => Linking.openURL(BRAND.privacyUrl)} /> : null}
        {BRAND.supportWhatsapp ? <Row title="Scrivi alla segreteria" sub="WhatsApp" chevron onPress={() => Linking.openURL(`https://wa.me/${BRAND.supportWhatsapp}`)} /> : null}
        <Row title="Crediti delle illustrazioni" sub={ILLUSTRATIONS_CREDIT} chevron onPress={() => Linking.openURL(ILLUSTRATIONS_URL)} />
        <Row title="Esci" onPress={signOut} />
        <Row title="Elimina il mio account" danger onPress={del} />
      </Group>
      <Txt v="cap" c="faint" style={{ textAlign: 'center' }}>{BRAND.gymName}</Txt>
      <EditProfile open={edit} onClose={() => setEdit(false)} />
    </View>
  );
}

function EditProfile({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, patchProfile } = useSession();
  const { toast } = useUi();
  const [f, setF] = useState({ first_name: '', last_name: '', phone: '', goal: '', height_cm: '' });
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (open && profile) setF({ first_name: profile.first_name || '', last_name: profile.last_name || '', phone: profile.phone || '', goal: profile.goal || '', height_cm: profile.height_cm ? String(profile.height_cm) : '' }); }, [open]);
  const save = async () => {
    if (!f.first_name.trim()) return toast('Scrivi il nome.', 'error');
    setBusy(true);
    try {
      await patchProfile({ first_name: f.first_name.trim(), last_name: f.last_name.trim() || null, phone: f.phone.trim() || null, goal: f.goal.trim() || null, height_cm: f.height_cm ? Math.round(parseNum(f.height_cm) || 0) || null : null });
      toast('Dati aggiornati.'); onClose();
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  return (
    <Sheet visible={open} onClose={onClose} title="I tuoi dati" footer={<Button label="Salva" onPress={save} loading={busy} />}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Field label="Nome" value={f.first_name} onChangeText={(s) => setF({ ...f, first_name: s })} autoCapitalize="words" style={{ flex: 1 }} />
        <Field label="Cognome" value={f.last_name} onChangeText={(s) => setF({ ...f, last_name: s })} autoCapitalize="words" style={{ flex: 1 }} />
      </View>
      <Field label="Telefono" value={f.phone} onChangeText={(s) => setF({ ...f, phone: s })} keyboardType="phone-pad" />
      <Field label="Il tuo obiettivo" value={f.goal} onChangeText={(s) => setF({ ...f, goal: s })} placeholder="Più forza, perdere peso, tornare in forma…" multiline />
      <Field label="Altezza" value={f.height_cm} onChangeText={(s) => setF({ ...f, height_cm: s })} suffix="cm" keyboardType="number-pad" />
    </Sheet>
  );
}

export function ProfileTab() {
  const { profile } = useSession();
  const nav = useNav();
  const staff = useAsync(() => api.staff(), []);
  const trainer = staff.data?.find((s) => s.id === profile?.trainer_id)?.full_name;
  return (
    <Page title="Profilo">
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        <AccountSection />
        {trainer ? <Group><Row title={trainer} sub="Il tuo personal trainer" left={<Icon name="person-circle-outline" size={26} color="accentInk" />} /></Group> : null}
        {profile?.role === 'member' ? (
          <>
            <Group>
              <Row title="Come ti piace allenarti" sub="Obiettivo, giorni e orari preferiti" left={<Icon name="options-outline" size={24} color="accentInk" />} chevron onPress={() => nav.push('prefs', { id: profile.id, mine: true })} />
            </Group>
            <MyDocuments />
          </>
        ) : null}
      </View>
    </Page>
  );
}
