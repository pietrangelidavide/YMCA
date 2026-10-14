// Schermata principale del socio: il prossimo allenamento, la settimana, i giorni della scheda.
import React, { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, DraftWorkout, Day, loadDraft, Program, saveDraft, useAsync, WorkoutRow } from '../data';
import { useNav, useTabs, useVersion } from '../nav';
import { useSession } from '../session';
import { plate, useTheme } from '../theme';
import { Button, Empty, ErrorState, Group, Icon, Page, Row, SectionTitle, Spinner, Txt, useUi } from '../ui';
import { addDays, ago, fmtDateLong, greeting, isoDay, parseDay, sameDay, startOfWeek, WEEKDAYS_MON } from '../util';

// durata stimata dell'allenamento in minuti (40 s a serie + recuperi), arrotondata a 5
export function estimateMinutes(d: Day) {
  const sec = d.items.reduce((a, i) => a + i.sets * 40 + Math.max(0, i.sets - 1) * i.rest_sec, 0);
  return Math.max(10, Math.round(sec / 300) * 5);
}

export function dayIndexOf(program: Program, w?: Pick<WorkoutRow, 'day_id' | 'day_name'> | null): number {
  if (!w) return -1;
  const byId = program.days.findIndex((d) => d.id && d.id === w.day_id);
  return byId >= 0 ? byId : program.days.findIndex((d) => d.name === w.day_name);
}

export function programWeek(p: Pick<Program, 'starts_on' | 'weeks'>, now = new Date()) {
  if (!p.starts_on) return null;
  const n = Math.floor((now.getTime() - parseDay(p.starts_on).getTime()) / (7 * 86400000)) + 1;
  return { n: Math.max(1, Math.min(p.weeks, n)), total: p.weeks, over: n > p.weeks, endsOn: addDays(parseDay(p.starts_on), p.weeks * 7) };
}

export default function Today() {
  const { t } = useTheme();
  const nav = useNav();
  const tabs = useTabs();
  const { toast, confirm } = useUi();
  const { profile, userId } = useSession();
  const d = useAsync(async () => {
    const [program, workouts, staff, draft] = await Promise.all([api.activeProgram(), api.workouts(userId!, 60), api.staff(), loadDraft()]);
    return { program, workouts, staff, draft };
  }, [userId]);

  const now = new Date();
  const program = d.data?.program ?? null;
  const works = (d.data?.workouts ?? []).filter((w) => program && w.program_id === program.id);
  const nextIdx = program ? ((dayIndexOf(program, works[0]) + 1) % Math.max(1, program.days.length)) : 0;
  const week = startOfWeek(now);
  const doneDays = (d.data?.workouts ?? []).map((w) => new Date(w.started_at)).filter((x) => x >= week);
  const target = program?.days.length || 3;
  const trainer = d.data?.staff.find((s) => s.id === program?.trainer_id)?.full_name;

  const start = async (idx: number) => {
    if (!program) return;
    const draft = d.data?.draft;
    if (draft && (draft.program_id !== program.id || draft.day_name !== program.days[idx].name)) {
      const ok = await confirm({ title: 'C\'è un allenamento in corso', message: `Hai già cominciato «${draft.day_name}». Se ne inizi un altro, quello in corso viene cancellato.`, confirmLabel: 'Cancella e inizia', destructive: true });
      if (!ok) return;
      await saveDraft(null);
    }
    nav.push('workout', { dayIndex: idx });
  };

  return (
    <Page title={profile?.first_name ? `${greeting(now)}, ${profile.first_name}` : greeting(now)} subtitle={fmtDateLong(now)}>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 6 }}>
        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : null}

        {d.data?.draft ? (
          <Pressable accessibilityLabel="Riprendi l'allenamento in corso" onPress={() => { const i = program?.days.findIndex((x) => x.name === d.data!.draft!.day_name) ?? 0; nav.push('workout', { dayIndex: Math.max(0, i) }); }}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: t.accentSoft, borderRadius: 18, padding: 14 }}>
            <Icon name="timer-outline" size={26} color="accentInk" />
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 16, fontWeight: '700' }}>Allenamento in corso</Text>
              <Text style={{ color: t.sub, fontSize: 14 }}>{d.data.draft.day_name} · iniziato {ago(d.data.draft.started_at)}</Text>
            </View>
            <Text style={{ color: t.accentInk, fontSize: 16, fontWeight: '700' }}>Riprendi</Text>
          </Pressable>
        ) : null}

        {d.data && !program ? (
          <View style={{ backgroundColor: t.card, borderRadius: 22 }}>
            <Empty icon="clipboard-outline" title="Nessuna scheda attiva" text="Il tuo personal trainer non ti ha ancora assegnato una scheda. Quando sarà pronta la troverai qui." />
          </View>
        ) : null}

        {program ? (
          <>
            <NextCard program={program} idx={nextIdx} onStart={() => start(nextIdx)} />

            <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Txt v="head">Questa settimana</Txt>
                <Txt v="sub" c="sub" num>{Math.min(doneDays.length, 99)} su {target}</Txt>
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {WEEKDAYS_MON.map((l, i) => {
                  const day = addDays(week, i);
                  const done = doneDays.some((x) => sameDay(x, day));
                  const today = sameDay(day, now);
                  return (
                    <View key={i} style={{ alignItems: 'center', gap: 6 }}>
                      <Text style={{ color: t.faint, fontSize: 12, fontWeight: '600' }}>{l}</Text>
                      <View style={{ width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: done ? t.accent : 'transparent', borderWidth: done ? 0 : today ? 2 : 1, borderColor: today ? t.accentInk : t.line }}>
                        {done ? <Icon name="checkmark" size={20} color={t.onAccent} /> : <Text style={{ color: today ? t.accentInk : t.faint, fontSize: 13.5, fontWeight: '600' }}>{day.getDate()}</Text>}
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <SectionTitle>I giorni della scheda</SectionTitle>
            <Group>
              {program.days.map((day, i) => {
                const last = works.find((w) => dayIndexOf(program, w) === i);
                const p = plate(i);
                return (
                  <Row key={day.id || i} title={day.name} sub={[day.focus, last ? `fatto ${ago(last.started_at)}` : 'da fare'].filter(Boolean).join(' · ')}
                    left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: p.c, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: p.on, fontSize: 18, fontWeight: '800' }}>{String.fromCharCode(65 + i)}</Text></View>}
                    right={<Icon name="play-circle" size={28} color="accentInk" />} onPress={() => start(i)} accessibilityLabel={`Inizia ${day.name}`} />
                );
              })}
            </Group>

            <WeekInfo program={program} trainer={trainer} onOpen={() => tabs.setTab('scheda')} />
          </>
        ) : null}
      </View>
    </Page>
  );
}

function NextCard({ program, idx, onStart }: { program: Program; idx: number; onStart: () => void }) {
  const day = program.days[idx];
  const p = plate(idx);
  if (!day) return null;
  const dark = p.on === '#FFFFFF';
  const sub = dark ? 'rgba(255,255,255,0.82)' : 'rgba(0,0,0,0.62)';
  return (
    <View style={{ backgroundColor: p.c, borderRadius: 26, padding: 20, gap: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: sub, fontSize: 14, fontWeight: '600' }}>Prossimo allenamento</Text>
          <Text style={{ color: p.on, fontSize: 34, fontWeight: '800', letterSpacing: -0.8 }}>{day.name}</Text>
          {day.focus ? <Text style={{ color: p.on, fontSize: 17, fontWeight: '500', opacity: 0.9 }}>{day.focus}</Text> : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={{ color: p.on, fontSize: 26, fontWeight: '800', fontVariant: ['tabular-nums'] as any }}>{day.items.length}</Text>
          <Text style={{ color: sub, fontSize: 13 }}>esercizi</Text>
          <Text style={{ color: sub, fontSize: 13 }}>~{estimateMinutes(day)} min</Text>
        </View>
      </View>
      <View style={{ gap: 4 }}>
        {day.items.slice(0, 4).map((it, i) => (
          <Text key={i} numberOfLines={1} style={{ color: p.on, fontSize: 15.5, opacity: 0.95 }}>{it.exercise.name}<Text style={{ opacity: 0.7 }}>  {it.sets}×{it.reps}</Text></Text>
        ))}
        {day.items.length > 4 ? <Text style={{ color: sub, fontSize: 14 }}>e altri {day.items.length - 4}</Text> : null}
      </View>
      <Pressable accessibilityLabel={`Inizia ${day.name}`} onPress={onStart} style={({ pressed }: any) => ({ height: 54, borderRadius: 16, backgroundColor: dark ? '#fff' : '#111114', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: pressed ? 0.8 : 1 })}>
        <Icon name="play" size={20} color={dark ? '#111114' : '#fff'} />
        <Text style={{ color: dark ? '#111114' : '#fff', fontSize: 17, fontWeight: '700' }}>Inizia allenamento</Text>
      </Pressable>
    </View>
  );
}

function WeekInfo({ program, trainer, onOpen }: { program: Program; trainer?: string; onOpen: () => void }) {
  const { t } = useTheme();
  const w = programWeek(program);
  return (
    <>
      <SectionTitle>La scheda</SectionTitle>
      <Group>
        <Row title={program.name} sub={w ? (w.over ? 'Scheda terminata: chiedi la prossima al tuo PT' : `Settimana ${w.n} di ${w.total}`) : `${program.weeks} settimane`}
          left={<Icon name="clipboard-outline" size={24} color="accentInk" />} chevron onPress={onOpen} />
        {trainer ? <Row title={trainer} sub="Il tuo personal trainer · scrivigli dalla scheda" left={<Icon name="chatbubble-ellipses-outline" size={24} color="accentInk" />} chevron onPress={onOpen} /> : null}
      </Group>
    </>
  );
}
