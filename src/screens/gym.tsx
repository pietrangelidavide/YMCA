// Bacheca dello staff: numeri della palestra, ultimi iscritti, collaboratori e schede, cose da seguire.
import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, Stats, useAsync } from '../data';
import { useNav, useTabs } from '../nav';
import { NUM, useTheme } from '../theme';
import { Avatar, BarChart, ErrorState, Group, Icon, Page, Pill, Row, SectionTitle, Spinner, Stat, Txt } from '../ui';
import { addDays, ageOf, fmtDate, fmtDateShortY, isoDay, startOfWeek } from '../util';
import { planState } from './staffPrograms';
import { useMemberFilter } from './staffMembers';

function weeklyFromStats(s: Stats) {
  const by = new Map(s.weekly.map((w) => [w.week.slice(0, 10), w.workouts]));
  const start = startOfWeek(new Date());
  return Array.from({ length: 8 }, (_, i) => {
    const from = addDays(start, -(7 - i) * 7);
    return { label: fmtDate(from), value: by.get(isoDay(from)) || 0, on: i === 7 };
  });
}

function Counter({ icon, value, label, onPress }: { icon: string; value: number; label: string; onPress: () => void }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityLabel={`${label}: ${value}`} onPress={onPress}
      style={({ pressed }: any) => ({ flexGrow: 1, flexBasis: '30%', minWidth: 96, backgroundColor: pressed ? t.card2 : t.card, borderRadius: 18, padding: 14, gap: 6 })}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={19} color="accentInk" /></View>
      <Text style={[{ color: t.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, NUM]}>{value}</Text>
      <Text style={{ color: t.sub, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

export function GymTab() {
  const { t } = useTheme();
  const nav = useNav();
  const tabs = useTabs();
  const { setFilter, setPview } = useMemberFilter();
  const d = useAsync(async () => ({ stats: await api.stats(30), gym: await api.gym() }), []);
  const weekly = useMemo(() => (d.data ? weeklyFromStats(d.data.stats) : []), [d.data]);
  const go = (f: 'nop' | 'exp') => { setFilter(f); tabs.setTab('soci'); };
  const s = d.data?.stats;
  const c = s?.counts;

  return (
    <Page title="Bacheca" subtitle={d.data?.gym?.name || undefined}>
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : s ? (
          <>
            {c ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <Counter icon="people" value={c.members} label="Utenti" onPress={() => { setFilter('all'); tabs.setTab('soci'); }} />
                <Counter icon="clipboard" value={c.programs} label="Schede" onPress={() => { setPview('assigned'); tabs.setTab('schede'); }} />
                <Counter icon="barbell" value={c.exercises} label="Esercizi" onPress={() => tabs.setTab('esercizi')} />
                <Counter icon="albums" value={c.templates} label="Modelli" onPress={() => { setPview('templates'); tabs.setTab('schede'); }} />
                <Counter icon="calendar" value={c.courses} label="Corsi" onPress={() => nav.push('courses')} />
              </View>
            ) : null}

            <SectionTitle>Da seguire</SectionTitle>
            <Group>
              <Row title="Soci senza scheda" value={String(s.without_program)} chevron={s.without_program > 0} onPress={s.without_program ? () => go('nop') : undefined}
                left={<Icon name={s.without_program ? 'alert-circle' : 'checkmark-circle'} size={24} color={s.without_program ? t.warn : t.ok} />} />
              <Row title="Schede in scadenza" sub="Entro 7 giorni o già scadute" value={String(s.expiring)} chevron={s.expiring > 0} onPress={s.expiring ? () => go('exp') : undefined}
                left={<Icon name={s.expiring ? 'time' : 'checkmark-circle'} size={24} color={s.expiring ? t.warn : t.ok} />} />
            </Group>

            <SectionTitle>Ultimi 30 giorni</SectionTitle>
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

            {s.latest_members?.length ? (
              <>
                <SectionTitle>Ultimi utenti</SectionTitle>
                <Group>
                  {s.latest_members.map((m) => {
                    const age = ageOf(m.birth_date);
                    return <Row key={m.id} title={m.full_name || 'Senza nome'} sub={`Iscritto il ${fmtDateShortY(m.created_at)}${age !== null ? ` · ${age} anni` : ''}`} left={<Avatar name={m.full_name} size={40} />} chevron onPress={() => nav.push('member', { id: m.id })} />;
                  })}
                </Group>
              </>
            ) : null}

            {s.latest_staff?.length ? (
              <>
                <SectionTitle>Ultimi collaboratori</SectionTitle>
                <Group>
                  {s.latest_staff.map((m) => (
                    <Row key={m.id} title={m.full_name || 'Senza nome'} sub={`Dal ${fmtDateShortY(m.created_at)}`} left={<Avatar name={m.full_name} size={40} />}
                      right={<Pill label={m.role === 'owner' ? 'Titolare' : 'Personal trainer'} />} onPress={() => nav.push('staff')} />
                  ))}
                </Group>
              </>
            ) : null}

            {s.latest_programs?.length ? (
              <>
                <SectionTitle>Ultime schede</SectionTitle>
                <Group>
                  {s.latest_programs.map((p) => {
                    const st = planState({ status: p.status, ends_on: p.ends_on });
                    return (
                      <Row key={p.id} title={p.name} minHeight={60} chevron onPress={() => nav.push('builder', { id: p.id })}
                        sub={[p.member_name || 'Senza socio', p.trainer_name ? `seguito da ${p.trainer_name}` : ''].filter(Boolean).join(' · ')}
                        right={<Pill label={st.state === 'draft' ? 'Bozza' : st.state === 'archived' ? 'Archiviata' : st.state === 'expired' ? 'Scaduta' : st.state === 'expiring' ? 'In scadenza' : 'Attiva'}
                          color={st.state === 'active' ? t.accentSoft : undefined} textColor={st.state === 'active' ? t.accentInk : undefined} />} />
                    );
                  })}
                </Group>
              </>
            ) : null}
          </>
        ) : null}
      </View>
    </Page>
  );
}
