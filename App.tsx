// Punto di partenza dell'app: tema, sessione, accesso e le schede principali di socio e staff.
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { onNotificationOpen, registerForPush } from './lib/push';
import { BRAND } from './src/brand';
import { useLayout } from './src/layout';
import { NavProvider, StackView, TabCtx, useNav } from './src/nav';
import { SessionProvider, useSession } from './src/session';
import { ThemeProvider, useTheme } from './src/theme';
import { Button, Empty, Logo, SideNav, TabBar, TabDef, Txt, UiProvider } from './src/ui';
import Auth from './src/screens/Auth';
import ProgramBuilder from './src/screens/builder';
import { BodyScreen } from './src/screens/body';
import { CalendarScreen } from './src/screens/calendar';
import { DocumentsScreen } from './src/screens/docs';
import { GymTab } from './src/screens/gym';
import { LeaderboardScreen } from './src/screens/leaderboard';
import { AnamnesisScreen, PrefsScreen, ReportScreen } from './src/screens/memberData';
import { AccountScreen, CoursesScreen, GymSettingsScreen, MoreTab, StaffScreen } from './src/screens/more';
import { PushScreen } from './src/screens/push';
import { MemberDetail, MembersTab, StaffProvider } from './src/screens/staffMembers';
import { ProgramsTab } from './src/screens/staffPrograms';
import { MemberProgressScreen, ProfileTab, ProgramScreen, ProgramTab, ProgressTab, WorkoutDetail } from './src/screens/member';
import { ExerciseDetail, Library } from './src/screens/shared';
import Today from './src/screens/Today';
import Workout from './src/screens/Workout';

const MEMBER_TABS: TabDef[] = [
  { key: 'oggi', label: 'Oggi', icon: 'flash-outline', iconOn: 'flash' },
  { key: 'scheda', label: 'Scheda', icon: 'clipboard-outline', iconOn: 'clipboard' },
  { key: 'progressi', label: 'Progressi', icon: 'stats-chart-outline', iconOn: 'stats-chart' },
  { key: 'esercizi', label: 'Esercizi', icon: 'barbell-outline', iconOn: 'barbell' },
  { key: 'profilo', label: 'Profilo', icon: 'person-outline', iconOn: 'person' },
];
const STAFF_TABS: TabDef[] = [
  { key: 'bacheca', label: 'Bacheca', icon: 'speedometer-outline', iconOn: 'speedometer' },
  { key: 'soci', label: 'Soci', icon: 'people-outline', iconOn: 'people' },
  { key: 'schede', label: 'Schede', icon: 'albums-outline', iconOn: 'albums' },
  { key: 'esercizi', label: 'Esercizi', icon: 'barbell-outline', iconOn: 'barbell' },
  { key: 'altro', label: 'Altro', icon: 'ellipsis-horizontal-circle-outline', iconOn: 'ellipsis-horizontal-circle' },
];

const ROOTS: Record<string, React.ComponentType> = {
  oggi: Today, scheda: ProgramTab, progressi: ProgressTab, esercizi: Library, profilo: ProfileTab,
  bacheca: GymTab, soci: MembersTab, schede: ProgramsTab, altro: MoreTab,
};

const SCREENS: Record<string, React.ComponentType<any>> = {
  exercise: ExerciseDetail,
  program: ProgramScreen,
  builder: ProgramBuilder,
  workout: Workout,
  'workout-detail': WorkoutDetail,
  member: MemberDetail,
  'member-progress': MemberProgressScreen,
  anamnesis: AnamnesisScreen,
  prefs: PrefsScreen,
  report: ReportScreen,
  body: BodyScreen,
  documents: DocumentsScreen,
  courses: CoursesScreen,
  calendar: CalendarScreen,
  push: PushScreen,
  staff: StaffScreen,
  'gym-settings': GymSettingsScreen,
  account: AccountScreen,
  leaderboard: LeaderboardScreen,
};

function Splash() {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0B', alignItems: 'center', justifyContent: 'center' }}>
      <Logo width={240} />
    </View>
  );
}

// Le notifiche portano alla scheda o ai messaggi; l'app si apre da qualsiasi stato
function PushRouting({ setTab }: { setTab: (k: string) => void }) {
  const nav = useNav();
  const { isStaff } = useSession();
  useEffect(() => {
    void registerForPush(false);
    return onNotificationOpen((data) => {
      if (data?.programId) {
        if (!isStaff && data.type === 'program') { nav.popToRoot(); setTab('scheda'); }
        else nav.push('program', { id: data.programId });
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function Main() {
  const { t } = useTheme();
  const { isStaff, profile } = useSession();
  const L = useLayout();
  const tabs = isStaff ? STAFF_TABS : MEMBER_TABS;
  const [tab, setTab] = useState(tabs[0].key);
  const role = profile?.role === 'owner' ? 'Titolare' : profile?.role === 'trainer' ? 'Personal trainer' : 'Socio';
  return (
    <StaffProvider>
      <NavProvider onRootBack={() => false}>
        {(nav) => (
          <TabCtx.Provider value={{ tab, setTab: (k) => { nav.popToRoot(); setTab(k); } }}>
            <View style={{ flex: 1, flexDirection: L.hasSide ? 'row' : 'column', backgroundColor: t.bg }}>
              {L.hasSide ? (
                <SideNav tabs={tabs} active={tab} onPick={(k) => { nav.popToRoot(); setTab(k); }} name={profile?.full_name} role={role}
                  onProfile={() => (isStaff ? nav.push('account') : (nav.popToRoot(), setTab('profilo')))} />
              ) : null}
              <View style={{ flex: 1, minWidth: 0 }}>
                <View style={{ flex: 1 }}>
                  {tabs.map((tb) => {
                    const Root = ROOTS[tb.key];
                    return (
                      <View key={tb.key} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: tb.key === tab ? 'flex' : 'none' }}>
                        <Root />
                      </View>
                    );
                  })}
                  <StackView stack={nav.stack} screens={SCREENS} />
                </View>
                {!L.hasSide && nav.stack.length === 0 ? <TabBar tabs={tabs} active={tab} onPick={(k) => setTab(k)} /> : null}
              </View>
              <PushRouting setTab={(k) => setTab(k)} />
            </View>
          </TabCtx.Provider>
        )}
      </NavProvider>
    </StaffProvider>
  );
}

function Root() {
  const { t } = useTheme();
  const s = useSession();
  if (!s.ready) return <Splash />;
  if (!s.userId) return <Auth />;
  if (!s.profile) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Empty icon="cloud-offline-outline" title="Non riesco a caricare il tuo profilo" text="Controlla la connessione e riprova." />
        <Button label="Riprova" onPress={s.refresh} />
        <Button label="Esci" kind="ghost" onPress={s.signOut} />
      </View>
    );
  }
  if (s.profile.role === 'member' && !s.profile.active) {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, justifyContent: 'center', padding: 24, gap: 12 }}>
        <Empty icon="lock-closed-outline" title="Iscrizione non attiva" text={`${BRAND.gymName} ha sospeso il tuo profilo. Per riattivarlo rivolgiti alla segreteria.`} />
        <Button label="Esci" kind="secondary" onPress={s.signOut} />
      </View>
    );
  }
  return <Main key={s.userId} />;
}

// Telefono: a tutto schermo con la barra in basso. Tablet e computer: barra laterale e contenuti in colonne centrate (vedi src/layout.ts)
function Themed() {
  const { t } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Root />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <UiProvider>
          <SessionProvider>
            <Themed />
          </SessionProvider>
        </UiProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
