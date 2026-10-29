// Notifiche push: l'elenco degli avvisi mandati e la scrittura di uno nuovo (a tutti, ai soli soci, allo staff o a soci scelti).
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Announcement, api, errText, useAsync } from '../data';
import { useNav, useVersion } from '../nav';
import { useTheme } from '../theme';
import { Button, Empty, ErrorState, Field, Group, Icon, IconButton, Page, Pill, Row, SectionTitle, Sheet, Spinner, Txt, useUi } from '../ui';
import { ago, fmtDateShortY, fmtTime } from '../util';
import { MembersMultiPicker } from './staffMembers';

type Aud = Announcement['audience'];
const AUD: [Aud, string, string][] = [
  ['members', 'Tutti i soci attivi', 'people-outline'],
  ['all', 'Soci e staff', 'globe-outline'],
  ['staff', 'Solo staff', 'shield-outline'],
  ['selected', 'Soci scelti da me', 'checkmark-circle-outline'],
];
const audLabel = (a: Aud) => AUD.find(([k]) => k === a)?.[1] || a;

export function PushScreen() {
  const { t } = useTheme();
  const nav = useNav();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const d = useAsync(() => api.announcements(), []);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [aud, setAud] = useState<Aud>('members');
  const [ids, setIds] = useState<string[]>([]);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);

  const compose = () => { setTitle(''); setBody(''); setAud('members'); setIds([]); setOpen(true); };
  const send = async () => {
    if (!title.trim() || !body.trim()) return toast('Scrivi il titolo e il testo dell\'avviso.', 'error');
    if (aud === 'selected' && !ids.length) return toast('Scegli almeno un socio.', 'error');
    if (!(await confirm({ title: 'Mandare l\'avviso?', message: `«${title.trim()}» arriverà a: ${audLabel(aud).toLowerCase()}${aud === 'selected' ? ` (${ids.length})` : ''}. Non si può annullare.`, confirmLabel: 'Invia' }))) return;
    setBusy(true);
    try {
      const r = await api.sendAnnouncement(title, body, aud, aud === 'selected' ? ids : []);
      bump(); setOpen(false);
      toast(r.recipients ? `Inviato a ${r.recipients} ${r.recipients === 1 ? 'telefono' : 'telefoni'} su ${r.targets} ${r.targets === 1 ? 'persona' : 'persone'}.` : `Salvato, ma nessuno dei ${r.targets} destinatari ha attivato le notifiche.`);
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };

  return (
    <Page onBack={nav.pop} navTitle="Notifiche push" right={<IconButton name="add-circle" size={30} color="accentInk" label="Nuovo avviso" onPress={compose} />}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          <Button label="Scrivi un avviso" icon="megaphone-outline" onPress={compose} />
          <SectionTitle>Avvisi mandati</SectionTitle>
          {!d.data?.length ? <Empty icon="notifications-outline" title="Nessun avviso" text="Per esempio: «Domani la palestra chiude alle 20», «Nuovo corso di yoga il martedì»." /> : (
            <View style={{ gap: 8 }}>
              {d.data.map((a) => (
                <View key={a.id} style={{ backgroundColor: t.card, borderRadius: 18, padding: 14, gap: 6 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                    <Text style={{ flex: 1, color: t.text, fontSize: 16.5, fontWeight: '700' }}>{a.title}</Text>
                    <Text style={{ color: t.faint, fontSize: 12.5, marginTop: 3 }}>{ago(a.created_at)}</Text>
                  </View>
                  <Text style={{ color: t.sub, fontSize: 14.5, lineHeight: 20 }}>{a.body}</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                    <Pill label={audLabel(a.audience)} icon="people-outline" />
                    <Pill label={a.recipients === a.targets ? `Arrivato a ${a.recipients}` : `${a.recipients} su ${a.targets} hanno le notifiche`} icon={a.recipients ? 'checkmark' : 'alert-circle-outline'}
                      color={a.recipients ? t.accentSoft : undefined} textColor={a.recipients ? t.accentInk : undefined} />
                  </View>
                  <Text style={{ color: t.faint, fontSize: 12.5 }}>{fmtDateShortY(a.created_at)}, {fmtTime(a.created_at)}</Text>
                </View>
              ))}
            </View>
          )}
          <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>L'avviso arriva solo a chi ha attivato le notifiche dal proprio profilo. Sul web e sui simulatori le notifiche non partono.</Txt>
        </View>
      )}

      <Sheet visible={open && !pick} onClose={() => setOpen(false)} title="Nuovo avviso" footer={<Button label="Invia l'avviso" icon="paper-plane-outline" onPress={send} loading={busy} disabled={!title.trim() || !body.trim()} />}>
        <Field label="Titolo" value={title} onChangeText={setTitle} maxLength={80} placeholder="Palestra chiusa domani" />
        <Field label="Testo" value={body} onChangeText={setBody} multiline maxLength={300} hint={`${body.length}/300 caratteri`} placeholder="Scrivi in modo breve: si legge dalla schermata di blocco." />
        <View style={{ gap: 6 }}>
          <Txt v="cap" c="sub" style={{ marginLeft: 4 }}>A chi</Txt>
          <Group>
            {AUD.map(([k, label, icon]) => (
              <Row key={k} title={label} left={<Icon name={icon} size={22} color="accentInk" />} right={aud === k ? <Icon name="checkmark" size={22} color="accentInk" /> : undefined}
                value={k === 'selected' && ids.length ? `${ids.length} scelti` : undefined} onPress={() => { setAud(k); if (k === 'selected') setPick(true); }} />
            ))}
          </Group>
        </View>
      </Sheet>
      <MembersMultiPicker visible={pick} onClose={() => setPick(false)} value={ids} onChange={setIds} title="Soci a cui scrivere" />
    </Page>
  );
}
