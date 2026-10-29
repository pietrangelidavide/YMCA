// «Classifica delle tonnellate»: chi ha sollevato di più. Partecipazione facoltativa; si vedono solo nome, iniziale del cognome e tonnellate.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, errText, LeaderRow, useAsync } from '../data';
import { useNav } from '../nav';
import { useSession } from '../session';
import { NUM, useTheme } from '../theme';
import { Avatar, Button, Empty, ErrorState, Group, Icon, Page, SectionTitle, Segmented, Spinner, Txt, useUi } from '../ui';
import { fmtNum } from '../util';

type Period = 'all' | 'year' | 'month' | 'week';
const PERIODS: [string, Period][] = [['Sempre', 'all'], ['Anno', 'year'], ['Mese', 'month'], ['Settimana', 'week']];

// Tonnellate all'italiana: sotto 1 t si mostrano i kg, poi «12,4 t»
export const fmtTons = (kg: number) => (kg < 1000 ? `${fmtNum(Math.round(kg), 0)} kg` : `${fmtNum(kg / 1000, kg >= 100000 ? 0 : 1)} t`);

// Per rendere l'idea: a cosa corrisponde un certo peso (masse approssimative)
const WEIGHTS = [
  { kg: 110, one: 'una Vespa', many: 'Vespe' },
  { kg: 450, one: 'un pianoforte a coda', many: 'pianoforti a coda' },
  { kg: 1000, one: 'un\'utilitaria', many: 'utilitarie' },
  { kg: 6000, one: 'un elefante', many: 'elefanti' },
  { kg: 12000, one: 'un autobus urbano', many: 'autobus urbani' },
  { kg: 42000, one: 'un Airbus A320', many: 'Airbus A320' },
  { kg: 120000, one: 'una balenottera azzurra', many: 'balenottere azzurre' },
  { kg: 10100000, one: 'la Torre Eiffel', many: 'Torri Eiffel' },
];
export function weightLike(kg: number): string | null {
  let u: (typeof WEIGHTS)[number] | null = null;
  for (const w of WEIGHTS) if (kg >= w.kg) u = w;
  if (!u) return null;
  const n = kg / u.kg;
  return n < 1.5 ? `circa ${u.one}` : `${fmtNum(n, n >= 10 ? 0 : 1)} ${u.many}`;
}

// Traguardi personali sul totale di sempre (in tonnellate)
const MILESTONES = [1, 5, 10, 25, 50, 100, 250, 500, 1000];

const MEDAL = ['#E8B004', '#B8BDC7', '#C77D3A'];

function Podium({ rows, onOpen }: { rows: LeaderRow[]; onOpen?: (r: LeaderRow) => void }) {
  const { t } = useTheme();
  const top = rows.slice(0, 3);
  if (!top.length) return null;
  // ordine visivo: 2°, 1°, 3°
  const order = [top[1], top[0], top[2]].filter(Boolean) as LeaderRow[];
  const heights: Record<number, number> = { 1: 92, 2: 68, 3: 52 };
  return (
    <View style={{ backgroundColor: t.card, borderRadius: 22, paddingTop: 18, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'flex-end', gap: 8, overflow: 'hidden' }} accessibilityLabel="Podio">
      {order.map((r) => {
        const pos = Math.min(r.rank, 3);
        const col = MEDAL[pos - 1];
        return (
          <Pressable key={`${r.rank}-${r.name}`} accessibilityLabel={`${r.rank}° ${r.name}, ${fmtTons(r.kg)}`} disabled={!onOpen || !r.id} onPress={() => onOpen?.(r)} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: 6 }}>
            {pos === 1 ? <Icon name="trophy" size={24} color={col} /> : null}
            <View style={{ borderWidth: 3, borderColor: col, borderRadius: 40, padding: 2 }}><Avatar name={r.name} size={pos === 1 ? 56 : 46} /></View>
            <Text numberOfLines={1} style={{ color: r.is_me ? t.accentInk : t.text, fontSize: 14, fontWeight: '700', maxWidth: '100%' }}>{r.is_me ? 'Tu' : r.name}</Text>
            <Text style={[{ color: t.sub, fontSize: 13.5, fontWeight: '600' }, NUM]}>{fmtTons(r.kg)}</Text>
            <View style={{ alignSelf: 'stretch', height: heights[pos], backgroundColor: col + '33', borderTopLeftRadius: 12, borderTopRightRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[{ color: col, fontSize: 30, fontWeight: '800' }, NUM]}>{r.rank}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function RankRow({ r, onOpen }: { r: LeaderRow; onOpen?: (r: LeaderRow) => void }) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 11, minHeight: 60, backgroundColor: r.is_me ? t.accentSoft : 'transparent' }}>
      <Text style={[{ width: 26, color: r.is_me ? t.accentInk : t.sub, fontSize: 17, fontWeight: '800', textAlign: 'center' }, NUM]}>{r.rank}</Text>
      <Avatar name={r.name} size={38} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text numberOfLines={1} style={{ color: t.text, fontSize: 16.5, fontWeight: '600' }}>{r.is_me ? `${r.name} (tu)` : r.name}</Text>
        <Text numberOfLines={1} style={{ color: t.sub, fontSize: 13.5 }}>{r.workouts} {r.workouts === 1 ? 'allenamento' : 'allenamenti'} · {r.sets} serie</Text>
      </View>
      <Text style={[{ color: t.text, fontSize: 17, fontWeight: '700' }, NUM]}>{fmtTons(r.kg)}</Text>
    </View>
  );
  return onOpen && r.id ? <Pressable accessibilityLabel={`${r.rank}° ${r.name}`} onPress={() => onOpen(r)}>{body}</Pressable> : body;
}

export function LeaderboardScreen() {
  const { t } = useTheme();
  const nav = useNav();
  const { isStaff } = useSession();
  const { toast, confirm } = useUi();
  const [period, setPeriod] = useState<Period>('all');
  const [busy, setBusy] = useState(false);
  const d = useAsync(() => api.leaderboard(period), [period]);
  const lb = d.data;
  const me = lb?.me;
  const rows = lb?.rows ?? [];
  const open = isStaff ? (r: LeaderRow) => r.id && nav.push('member-progress', { id: r.id, name: r.name }) : undefined;

  const join = async () => {
    setBusy(true);
    try { await api.setLeaderboard(true); d.reload(); toast('Sei in classifica. Buoni allenamenti!'); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const leave = async () => {
    if (!(await confirm({ title: 'Uscire dalla classifica?', message: 'Gli altri non vedranno più il tuo nome. I tuoi allenamenti restano al loro posto e puoi rientrare quando vuoi.', confirmLabel: 'Esci dalla classifica' }))) return;
    setBusy(true);
    try { await api.setLeaderboard(false); d.reload(); toast('Non compari più in classifica.'); } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  const meIdx = me?.rank ? rows.findIndex((r) => r.is_me) : -1;
  const above = meIdx > 0 ? [...rows.slice(0, meIdx)].reverse().find((r) => r.kg > me!.kg) ?? null : null;
  const next = me ? MILESTONES.find((m) => m * 1000 > me.kg_all) : undefined;
  const prev = me ? [...MILESTONES].reverse().find((m) => m * 1000 <= me.kg_all) : undefined;
  const progress = next && me ? Math.min(1, (me.kg_all - (prev ?? 0) * 1000) / ((next - (prev ?? 0)) * 1000)) : 0;
  const like = lb ? weightLike(lb.total_kg) : null;
  const rest = rows.length > 3 ? rows.slice(3) : [];

  return (
    <Page onBack={nav.pop} navTitle="Classifica" title="Classifica" subtitle="Chi ha sollevato più tonnellate">
      <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
        <Segmented items={PERIODS} value={period} onChange={setPeriod} />
        {d.loading && !lb ? <Spinner /> : d.error && !lb ? <ErrorState error={d.error} onRetry={d.reload} /> : lb ? (
          <>
            <View style={{ backgroundColor: t.accent, borderRadius: 24, padding: 20, gap: 4 }}>
              <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, fontWeight: '600' }}>{PERIODS.find((p) => p[1] === period)![0] === 'Sempre' ? 'Sollevate finora da chi partecipa' : `Sollevate da chi partecipa · ${PERIODS.find((p) => p[1] === period)![0].toLowerCase()}`}</Text>
              <Text style={[{ color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: -1 }, NUM]}>{fmtTons(lb.total_kg)}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>{like ? `Come ${like}.` : 'Ogni serie conta: si parte da qui.'}</Text>
              <Text style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13.5, marginTop: 2 }}>{lb.participants} {lb.participants === 1 ? 'partecipante' : 'partecipanti'}</Text>
            </View>

            {!isStaff && me && !me.opt_in ? (
              <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Icon name="trophy-outline" size={24} color="accentInk" />
                  <Txt v="head" style={{ flex: 1 }}>Vuoi entrare in classifica?</Txt>
                </View>
                <Txt c="sub" style={{ lineHeight: 21 }}>Gli altri soci vedranno il tuo nome e l'iniziale del cognome (per esempio «Marco R.») e le tue tonnellate. Nient'altro: né schede, né pesi dei singoli esercizi. Puoi uscire quando vuoi.</Txt>
                <Button label="Partecipa alla classifica" icon="trophy" onPress={join} loading={busy} />
              </View>
            ) : null}

            {!isStaff && me?.opt_in ? (
              <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 6 }}>
                <Txt v="head">{me.rank ? `Sei ${me.rank}° con ${fmtTons(me.kg)}` : 'Sei in classifica'}</Txt>
                {me.rank ? (
                  <Txt c="sub">{above ? `Per superare ${above.name} ti mancano ${fmtTons(above.kg - me.kg + 1)}.` : rows.length > 1 ? 'Sei in testa: difendi il primo posto!' : 'Per ora sei l\'unico in classifica.'}</Txt>
                ) : (
                  <Txt c="sub">{period === 'all' ? 'Registra un allenamento con i carichi per comparire in classifica.' : 'In questo periodo non hai ancora registrato carichi.'}</Txt>
                )}
              </View>
            ) : null}

            {rows.length ? (
              <>
                <Podium rows={rows} onOpen={open} />
                {rest.length ? <Group>{rest.map((r) => <RankRow key={`${r.rank}-${r.name}-${r.id ?? ''}`} r={r} onOpen={open} />)}</Group> : null}
                {lb.ranked > rows.length ? <Txt v="cap" c="faint" style={{ textAlign: 'center' }}>Primi {rows.length} su {lb.ranked}.</Txt> : null}
              </>
            ) : (
              <Empty icon="trophy-outline" title="Ancora nessuno in classifica" text={lb.participants ? 'Chi partecipa non ha ancora registrato allenamenti con i carichi in questo periodo.' : isStaff ? 'I soci possono partecipare dal loro telefono: la classifica è facoltativa.' : 'Sii il primo: partecipa e registra un allenamento con i carichi.'} />
            )}

            {!isStaff && me && me.kg_all > 0 ? (
              <>
                <SectionTitle>I tuoi traguardi</SectionTitle>
                <View style={{ backgroundColor: t.card, borderRadius: 20, padding: 16, gap: 10 }}>
                  <Txt>Finora hai sollevato <Text style={{ fontWeight: '800' }}>{fmtTons(me.kg_all)}</Text>{weightLike(me.kg_all) ? `: come ${weightLike(me.kg_all)}.` : '.'}</Txt>
                  {next ? (
                    <>
                      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.card2, overflow: 'hidden' }}>
                        <View style={{ width: `${Math.max(3, Math.round(progress * 100))}%`, height: 10, backgroundColor: t.accent, borderRadius: 5 }} />
                      </View>
                      <Txt v="sub" c="sub">Prossimo traguardo: {next} {next === 1 ? 'tonnellata' : 'tonnellate'} · mancano {fmtTons(next * 1000 - me.kg_all)}</Txt>
                    </>
                  ) : <Txt v="sub" c="sub">Hai superato tutti i traguardi: leggenda.</Txt>}
                  {prev ? (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                      {MILESTONES.filter((m) => m <= prev).map((m) => (
                        <View key={m} style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.accentSoft, borderRadius: 12, paddingHorizontal: 10, height: 26 }}>
                          <Icon name="ribbon" size={13} color="accentInk" />
                          <Text style={[{ color: t.accentInk, fontSize: 12.5, fontWeight: '700' }, NUM]}>{m} t</Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              </>
            ) : null}

            <Txt v="cap" c="faint" style={{ textAlign: 'center', lineHeight: 18 }}>Si contano peso × ripetizioni delle serie registrate con un carico. Gli esercizi a corpo libero senza zavorra non contano.</Txt>
            {!isStaff && me?.opt_in ? <Button label="Esci dalla classifica" kind="ghost" small onPress={leave} loading={busy} /> : null}
          </>
        ) : null}
      </View>
    </Page>
  );
}

// Riquadro per la schermata iniziale: primi tre e accesso alla classifica completa
export function LeaderboardCard() {
  const { t } = useTheme();
  const nav = useNav();
  const d = useAsync(() => api.leaderboard('all'), []);
  const rows = d.data?.rows.slice(0, 3) ?? [];
  const me = d.data?.me;
  return (
    <Pressable accessibilityLabel="Classifica delle tonnellate" onPress={() => nav.push('leaderboard')}
      style={({ pressed }: any) => ({ backgroundColor: pressed ? t.card2 : t.card, borderRadius: 20, padding: 16, gap: 10 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <View style={{ width: 40, height: 40, borderRadius: 13, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="trophy" size={22} color="accentInk" /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: t.text, fontSize: 16.5, fontWeight: '700' }}>Classifica delle tonnellate</Text>
          <Text numberOfLines={1} style={{ color: t.sub, fontSize: 13.5 }}>
            {d.data ? (rows.length ? `Chi ha sollevato di più finora${me?.rank ? ` · tu sei ${me.rank}°` : ''}` : 'Chi ha sollevato di più? Entra e sfida gli altri') : 'Chi ha sollevato di più?'}
          </Text>
        </View>
        <Icon name="chevron-forward" size={18} color="faint" />
      </View>
      {rows.length ? (
        <View style={{ gap: 6 }}>
          {rows.map((r) => (
            <View key={`${r.rank}-${r.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Text style={[{ width: 20, color: MEDAL[Math.min(r.rank, 3) - 1], fontSize: 15, fontWeight: '800', textAlign: 'center' }, NUM]}>{r.rank}</Text>
              <Text numberOfLines={1} style={{ flex: 1, color: r.is_me ? t.accentInk : t.text, fontSize: 15, fontWeight: r.is_me ? '700' : '500' }}>{r.is_me ? `${r.name} (tu)` : r.name}</Text>
              <Text style={[{ color: t.sub, fontSize: 14.5, fontWeight: '600' }, NUM]}>{fmtTons(r.kg)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}
