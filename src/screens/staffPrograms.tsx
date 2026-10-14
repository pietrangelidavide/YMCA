// Scheda «Schede» dello staff: modelli riutilizzabili e bozze dei soci.
import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { api, errText, MemberRow, ProgramRow, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useTheme } from '../theme';
import { Button, Empty, ErrorState, Group, Icon, IconButton, Page, Row, SectionTitle, Sheet, Spinner, Txt, useUi } from '../ui';
import { ago } from '../util';
import { MemberPicker } from './staffMembers';

export function ProgramsTab() {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const d = useAsync(async () => {
    const [templates, drafts, members] = await Promise.all([api.templates(), api.drafts(), api.members()]);
    return { templates, drafts, members };
  }, []);
  const [sel, setSel] = useState<ProgramRow | null>(null);
  const [assign, setAssign] = useState<ProgramRow | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string | null) => d.data?.members.find((m) => m.id === id)?.full_name || 'Socio';
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
  const duplicate = async (p: ProgramRow) => {
    setSel(null);
    await run(async () => { await api.copyProgram(p.id, null, true, `${p.name} (copia)`); }, 'Modello duplicato.');
  };
  const remove = async (p: ProgramRow) => {
    setSel(null);
    if (!(await confirm({ title: 'Eliminare il modello?', message: `«${p.name}» sparisce dall'elenco. Le schede già assegnate ai soci non cambiano.`, confirmLabel: 'Elimina', destructive: true }))) return;
    await run(() => api.deleteProgram(p.id), 'Modello eliminato.');
  };

  return (
    <Page title="Schede" subtitle={d.data ? `${d.data.templates.length} modelli` : undefined}
      right={<IconButton name="add-circle" size={30} color="accentInk" label="Nuovo modello" onPress={() => nav.push('builder', { template: true })} />}>
      <View style={{ paddingHorizontal: 16, paddingTop: 4 }}>
        {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
          <>
            <Txt v="sub" c="sub" style={{ paddingHorizontal: 4 }}>I modelli sono schede già pronte: le assegni a un socio in pochi tocchi e poi le adatti.</Txt>
            <SectionTitle>Modelli</SectionTitle>
            {d.data!.templates.length ? (
              <Group>
                {d.data!.templates.map((p) => (
                  <Row key={p.id} title={p.name} sub={[p.goal, `${p.weeks} settimane`].filter(Boolean).join(' · ')} minHeight={62}
                    left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="albums" size={22} color="accentInk" /></View>}
                    chevron onPress={() => setSel(p)} />
                ))}
              </Group>
            ) : (
              <Empty icon="albums-outline" title="Nessun modello" text="Crea una scheda tipo (per esempio «Forza 3 giorni») e usala con tutti i soci."
                action={<Button label="Crea il primo modello" icon="add" small full={false} onPress={() => nav.push('builder', { template: true })} />} />
            )}

            {d.data!.drafts.length ? (
              <>
                <SectionTitle>Bozze da attivare</SectionTitle>
                <Group>
                  {d.data!.drafts.map((p) => (
                    <Row key={p.id} title={p.name} sub={`Per ${nameOf(p.member_id)} · ${ago(p.created_at)}`} minHeight={62}
                      left={<View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.card2, alignItems: 'center', justifyContent: 'center' }}><Icon name="create-outline" size={22} color="sub" /></View>}
                      chevron onPress={() => nav.push('builder', { id: p.id })} />
                  ))}
                </Group>
              </>
            ) : null}
          </>
        )}
      </View>

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        <Group>
          <Row title="Assegna a un socio" sub="Crea una bozza da adattare" left={<Icon name="person-add-outline" size={22} color="accentInk" />} chevron onPress={() => { setAssign(sel); setSel(null); }} />
          <Row title="Modifica il modello" left={<Icon name="create-outline" size={22} color="accentInk" />} chevron onPress={() => { const id = sel!.id; setSel(null); nav.push('builder', { id }); }} />
          <Row title="Duplica" left={<Icon name="copy-outline" size={22} color="sub" />} onPress={() => duplicate(sel!)} />
          <Row title="Elimina" danger left={<Icon name="trash-outline" size={22} color="danger" />} onPress={() => remove(sel!)} />
        </Group>
      </Sheet>
      <MemberPicker visible={!!assign} onClose={() => setAssign(null)} onPick={toMember} busy={busy} />
    </Page>
  );
}
