// Documenti PDF: lo staff li carica e li assegna ai soci; il socio vede quelli che gli sono stati resi visibili.
import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { api, DocumentRow, errText, MemberRow, useAsync } from '../data';
import { MAX_PDF, Picked, pickPdf } from '../files';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { useTheme } from '../theme';
import { Button, Empty, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Sheet, Spinner, Toggle, Txt, useUi } from '../ui';
import { fmtDateShortY, fmtSize, norm } from '../util';
import { MembersMultiPicker } from './staffMembers';

async function openDoc(d: DocumentRow, toast: (m: string, k?: 'ok' | 'error') => void) {
  try { await Linking.openURL(await api.openDocument(d)); } catch (e) { toast(errText(e), 'error'); }
}

const PdfIcon = () => {
  const { t } = useTheme();
  return <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name="document-text" size={22} color="accentInk" /></View>;
};

// ───────── Elenco per lo staff (tutti i documenti, oppure quelli di un socio) ─────────

export function DocumentsScreen({ memberId, name }: { memberId?: string; name?: string }) {
  const { t } = useTheme();
  const nav = useNav();
  const { userId } = useSession();
  const { toast, confirm } = useUi();
  const { bump } = useVersion();
  const d = useAsync(async () => {
    const [docs, members] = await Promise.all([api.documents(), api.members()]);
    return { ...docs, members };
  }, []);
  const [edit, setEdit] = useState<{ doc: DocumentRow | null } | null>(null);
  const [sel, setSel] = useState<DocumentRow | null>(null);
  const [q, setQ] = useState('');

  const names = useMemo(() => new Map((d.data?.members || []).map((m) => [m.id, m.full_name || ''])), [d.data]);
  const assigned = (id: string) => (d.data?.links || []).filter((l) => l.document_id === id).map((l) => l.member_id);
  const list = useMemo(() => {
    const n = norm(q.trim());
    return (d.data?.docs || []).filter((x) => (!memberId || assigned(x.id).includes(memberId)) && (!n || norm(x.name).includes(n)));
  }, [d.data, memberId, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const remove = async (x: DocumentRow) => {
    setSel(null);
    if (!(await confirm({ title: 'Eliminare il documento?', message: `«${x.name}» sparisce per tutti i soci a cui è assegnato.`, confirmLabel: 'Elimina', destructive: true }))) return;
    try { await api.deleteDocument(x); bump(); toast('Documento eliminato.'); } catch (e) { toast(errText(e), 'error'); }
  };
  const who = (id: string) => {
    const ids = assigned(id);
    if (!ids.length) return 'Non assegnato';
    if (ids.length <= 2) return ids.map((i) => names.get(i) || 'Socio').join(', ');
    return `${names.get(ids[0]) || 'Socio'} e altri ${ids.length - 1}`;
  };

  return (
    <Page onBack={nav.pop} navTitle="Documenti" title={memberId ? name : undefined} subtitle={memberId ? 'Documenti' : undefined}
      right={<Pressable accessibilityLabel="Aggiungi un documento" onPress={() => setEdit({ doc: null })} hitSlop={8}><Icon name="add-circle" size={30} color="accentInk" /></Pressable>}>
      {d.loading && !d.data ? <Spinner /> : d.error && !d.data ? <ErrorState error={d.error} onRetry={d.reload} /> : (
        <View style={{ paddingHorizontal: 16, gap: 14, paddingTop: 4 }}>
          {(d.data?.docs.length || 0) > 6 ? <Field value={q} onChangeText={setQ} placeholder="Cerca un documento" /> : null}
          {!list.length ? (
            <Empty icon="document-text-outline" title={memberId ? 'Nessun documento per questo socio' : 'Nessun documento'}
              text="Carica un PDF (massimo 2 MB) e scegli a chi assegnarlo: certificati, schede alimentari, moduli firmati."
              action={<Button label="Aggiungi un documento" icon="add" small full={false} onPress={() => setEdit({ doc: null })} />} />
          ) : (
            <Group>
              {list.map((x) => (
                <Row key={x.id} title={x.name} minHeight={64} left={<PdfIcon />} chevron onPress={() => setSel(x)}
                  sub={[who(x.id), fmtSize(x.size_bytes), fmtDateShortY(x.created_at)].filter(Boolean).join(' · ')}
                  right={!x.visible_to_member ? <Pill label="Solo staff" icon="eye-off-outline" /> : undefined} />
              ))}
            </Group>
          )}
          <Txt v="cap" c="faint" style={{ paddingHorizontal: 4 }}>I documenti con «Solo staff» non compaiono nell'app del socio.</Txt>
        </View>
      )}

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.name}>
        <Group>
          <Row title="Apri il PDF" left={<Icon name="open-outline" size={22} color="accentInk" />} onPress={() => { const x = sel!; setSel(null); void openDoc(x, toast); }} />
          <Row title="Modifica e assegna" left={<Icon name="create-outline" size={22} color="accentInk" />} onPress={() => { const x = sel!; setSel(null); setEdit({ doc: x }); }} />
          <Row title="Elimina" danger left={<Icon name="trash-outline" size={22} color="danger" />} onPress={() => remove(sel!)} />
        </Group>
      </Sheet>

      <DocEditor open={!!edit} doc={edit?.doc || null} initialMembers={edit?.doc ? assigned(edit.doc.id) : memberId ? [memberId] : []} members={d.data?.members || []}
        by={userId!} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); bump(); }} />
    </Page>
  );
}

function DocEditor({ open, doc, initialMembers, members, by, onClose, onSaved }: {
  open: boolean; doc: DocumentRow | null; initialMembers: string[]; members: MemberRow[]; by: string; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useTheme();
  const { toast } = useUi();
  const [name, setName] = useState('');
  const [file, setFile] = useState<Picked | null>(null);
  const [ids, setIds] = useState<string[]>([]);
  const [visible, setVisible] = useState(true);
  const [pick, setPick] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setName(doc?.name || ''); setFile(null); setIds(initialMembers); setVisible(doc ? doc.visible_to_member : true);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = async () => {
    try {
      const f = await pickPdf();
      if (!f) return;
      if (f.size && f.size > MAX_PDF) return toast('Il PDF supera i 2 MB. Comprimilo e riprova.', 'error');
      setFile(f);
      if (!name.trim()) setName(f.name.replace(/\.pdf$/i, ''));
    } catch (e) { toast(errText(e), 'error'); }
  };
  const save = async () => {
    if (!name.trim()) return toast('Dai un nome al documento.', 'error');
    if (!doc && !file) return toast('Scegli il file PDF.', 'error');
    setBusy(true);
    try {
      if (doc) await api.updateDocument(doc.id, name, ids, visible);
      else await api.addDocument(file!, name, ids, visible, by);
      toast(doc ? 'Documento aggiornato.' : 'Documento caricato.');
      onSaved();
    } catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const label = ids.length === 0 ? 'Nessuno' : ids.length === 1 ? members.find((m) => m.id === ids[0])?.full_name || '1 socio' : `${ids.length} soci`;
  return (
    <>
      <Sheet visible={open && !pick} onClose={onClose} title={doc ? 'Modifica documento' : 'Nuovo documento'}
        footer={<Button label={doc ? 'Salva' : 'Carica il documento'} onPress={save} loading={busy} />}>
        <Field label="Nome" value={name} onChangeText={setName} placeholder="Per esempio Certificato medico" maxLength={80} />
        {!doc ? (
          <Pressable accessibilityLabel="Scegli il PDF" onPress={choose}
            style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, backgroundColor: t.card2, opacity: pressed ? 0.7 : 1 })}>
            <Icon name={file ? 'document-text' : 'cloud-upload-outline'} size={24} color="accentInk" />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '600' }}>{file ? file.name : 'Scegli il file PDF'}</Text>
              <Text style={{ color: t.sub, fontSize: 13 }}>{file?.size ? fmtSize(file.size) : 'Massimo 2 MB'}</Text>
            </View>
          </Pressable>
        ) : null}
        <Group>
          <Row title="Assegna a" value={label} chevron onPress={() => setPick(true)} />
          <Row title="Visibile al socio" sub={visible ? 'Lo vede nell\'app, in Profilo' : 'Lo vede solo lo staff'} right={<Toggle label="Visibile al socio" value={visible} onChange={setVisible} />} />
        </Group>
      </Sheet>
      <MembersMultiPicker visible={pick} onClose={() => setPick(false)} value={ids} onChange={setIds} title="Assegna a" />
    </>
  );
}

// ───────── Per il socio: i propri documenti (in Profilo) ─────────

export function MyDocuments() {
  const { userId } = useSession();
  const { toast } = useUi();
  const d = useAsync(() => api.documentsOf(userId!), [userId]);
  if (d.loading && !d.data) return null;
  if (!d.data?.length) return null;
  return (
    <>
      <SectionTitle>I tuoi documenti</SectionTitle>
      <Group>
        {d.data.map((x) => (
          <Row key={x.id} title={x.name} sub={`${fmtDateShortY(x.created_at)}${x.size_bytes ? ' · ' + fmtSize(x.size_bytes) : ''}`} minHeight={60} left={<PdfIcon />}
            right={<Icon name="open-outline" size={18} color="faint" />} onPress={() => openDoc(x, toast)} />
        ))}
      </Group>
    </>
  );
}
