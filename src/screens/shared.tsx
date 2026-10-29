// Pezzi usati sia dal socio sia dallo staff: archivio esercizi, scheda dell'esercizio, scelta esercizi, messaggi.
import React, { useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { api, Comment, Exercise, ExerciseLite, errText, useAsync, useExercises } from '../data';
import { Picked, pickImage, publicUrl, removeFile, uploadFile } from '../files';
import { useNav, useVersion } from '../nav';
import { useSession } from '../session';
import { Theme, TYPE, useTheme } from '../theme';
import { Button, Chip, Empty, ErrorState, Field, Group, Icon, Page, Pill, Row, SectionTitle, Segmented, Sheet, Spinner, Txt, BarChart, IconButton, useUi } from '../ui';
import { ago, CATEGORY, CATEGORY_KEYS, fmtDate, fmtNum, MUSCLE, MUSCLE_KEYS, muscleLabel, noEquipment, norm, uuid, youtubeId } from '../util';

export const MUSCLE_ICON: Record<string, string> = {
  petto: 'body', schiena: 'accessibility', spalle: 'barbell', trapezi: 'triangle', bicipiti: 'fitness', tricipiti: 'flash', avambracci: 'hand-left',
  quadricipiti: 'walk', femorali: 'footsteps', glutei: 'radio-button-on', adduttori: 'contract', abduttori: 'expand', polpacci: 'trending-up',
  addome: 'flame', lombari: 'shield', cardio: 'heart', total_body: 'pulse', mobilita: 'leaf',
};
// Tre toni del marchio per zona del corpo: parte alta in rosso, gambe in grafite, il resto in testo
const UPPER = ['petto', 'schiena', 'spalle', 'trapezi', 'bicipiti', 'tricipiti', 'avambracci'];
const LOWER = ['quadricipiti', 'femorali', 'glutei', 'adduttori', 'abduttori', 'polpacci'];
export const groupColor = (g: string, t: Theme) => (UPPER.includes(g) ? t.accentInk : LOWER.includes(g) ? '#7F8693' : t.text);

// Riquadro con l'immagine dell'esercizio, o con l'icona del gruppo muscolare; se c'è un video mostra il tasto play
export function ExerciseTile({ e, size = 48, play }: { e: Pick<ExerciseLite, 'muscle_group' | 'video_url'> & { image_url?: string | null }; size?: number; play?: boolean }) {
  const { t } = useTheme();
  const c = groupColor(e.muscle_group, t);
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.27, backgroundColor: c + '29', alignItems: 'center', justifyContent: 'center' }}>
      {e.image_url ? (
        <Image source={{ uri: e.image_url }} resizeMode="cover" style={{ width: size, height: size, borderRadius: size * 0.27 }} accessibilityLabel="Immagine dell'esercizio" />
      ) : <Icon name={MUSCLE_ICON[e.muscle_group] || 'barbell'} size={size * 0.5} color={c} />}
      {(play ?? !!e.video_url) && e.video_url ? (
        <View style={{ position: 'absolute', right: -3, bottom: -3, width: size * 0.38, height: size * 0.38, borderRadius: size * 0.19, backgroundColor: '#111114', alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="play" size={size * 0.2} color="#fff" style={{ marginLeft: 1 }} />
        </View>
      ) : null}
    </View>
  );
}

export function MuscleChips({ value, onChange, all = true }: { value: string; onChange: (v: string) => void; all?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
      {all ? <Chip label="Tutti" on={value === ''} onPress={() => onChange('')} /> : null}
      {MUSCLE_KEYS.map((k) => <Chip key={k} label={MUSCLE[k]} on={value === k} onPress={() => onChange(value === k && all ? '' : k)} />)}
    </ScrollView>
  );
}

export function CategoryChips({ value, onChange, small }: { value: string; onChange: (v: string) => void; small?: boolean }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }} style={{ flexGrow: 0 }}>
      <Chip small={small} label="Ogni tipo" on={value === ''} onPress={() => onChange('')} />
      {CATEGORY_KEYS.map((k) => <Chip small={small} key={k} label={CATEGORY[k]} on={value === k} onPress={() => onChange(value === k ? '' : k)} />)}
    </ScrollView>
  );
}

export function SearchBox({ value, onChange, placeholder = 'Cerca' }: { value: string; onChange: (s: string) => void; placeholder?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.card2, borderRadius: 12, paddingHorizontal: 12, height: 40 }}>
      <Icon name="search" size={18} color="faint" />
      <TextInput accessibilityLabel={placeholder} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={t.faint} autoCorrect={false}
        style={{ flex: 1, color: t.text, fontSize: 16, height: 40 } as any} />
      {value ? <Pressable accessibilityLabel="Cancella ricerca" onPress={() => onChange('')} hitSlop={8}><Icon name="close-circle" size={18} color="faint" /></Pressable> : null}
    </View>
  );
}

export type EquipFilter = '' | 'with' | 'without';
export function filterExercises(list: Exercise[], q: string, group: string, category = '', equip: EquipFilter = '') {
  const n = norm(q.trim());
  return list.filter((e) => (!group || e.muscle_group === group) && (!category || e.category === category)
    && (!equip || (equip === 'without') === noEquipment(e.equipment))
    && (!n || norm(e.name).includes(n) || norm(e.equipment || '').includes(n) || norm(muscleLabel(e.muscle_group)).includes(n)));
}

// Prima frase della descrizione, accorciata
const excerpt = (s?: string | null, max = 110) => { const x = (s || '').replace(/\s+/g, ' ').trim(); return x.length > max ? x.slice(0, max - 1).trimEnd() + '…' : x; };

// ───────── Archivio esercizi (scheda principale) ─────────

const PAGE = 30;

export function Library() {
  const { t } = useTheme();
  const nav = useNav();
  const { isStaff } = useSession();
  const ex = useExercises();
  const [q, setQ] = useState('');
  const [g, setG] = useState('');
  const [c, setC] = useState('');
  const [eq, setEq] = useState<EquipFilter>('');
  const [shown, setShown] = useState(PAGE);
  const [edit, setEdit] = useState<Partial<Exercise> | null>(null);
  const list = useMemo(() => filterExercises(ex.data || [], q, g, c, eq), [ex.data, q, g, c, eq]);
  const reset = <T,>(set: (v: T) => void) => (v: T) => { set(v); setShown(PAGE); };
  const filtered = !!(q || g || c || eq);
  return (
    <Page title="Esercizi" subtitle={ex.data ? (filtered ? `${list.length} di ${ex.data.length} esercizi` : `${ex.data.length} esercizi`) : undefined}
      right={isStaff ? <IconButton name="add-circle" size={30} color="accentInk" label="Nuovo esercizio" onPress={() => setEdit({ muscle_group: g || 'petto', category: c || 'forza' })} /> : undefined}>
      <View style={{ gap: 10, paddingTop: 4 }}>
        <View style={{ paddingHorizontal: 16 }}><SearchBox value={q} onChange={reset(setQ)} placeholder="Cerca un esercizio" /></View>
        <MuscleChips value={g} onChange={reset(setG)} />
        <CategoryChips value={c} onChange={reset(setC)} small />
        <View style={{ paddingHorizontal: 16 }}>
          <Segmented items={[['Ogni attrezzo', ''], ['Con attrezzo', 'with'], ['Senza attrezzo', 'without']]} value={eq} onChange={reset(setEq)} />
        </View>
      </View>
      <View style={{ paddingHorizontal: 16, paddingTop: 14, gap: 10 }}>
        {ex.loading && !ex.data ? <Spinner /> : ex.error && !ex.data ? <ErrorState error={ex.error} onRetry={ex.reload} /> : list.length === 0 ? (
          <Empty icon="search" title="Nessun esercizio" text="Prova con un'altra parola o togli qualche filtro."
            action={filtered ? <Button label="Togli i filtri" kind="secondary" small full={false} onPress={() => { setQ(''); setG(''); setC(''); setEq(''); }} /> : undefined} />
        ) : (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {list.slice(0, shown).map((e) => (
                <ExerciseCard key={e.id} e={e} onOpen={() => nav.push('exercise', { id: e.id })} onEdit={isStaff ? () => setEdit(e) : undefined} />
              ))}
            </View>
            {list.length > shown ? <Button label={`Mostra altri ${Math.min(PAGE, list.length - shown)} (${list.length - shown} restanti)`} kind="secondary" onPress={() => setShown(shown + PAGE)} /> : null}
          </>
        )}
      </View>
      <ExerciseEditor value={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

// Scheda dell'esercizio nell'elenco: immagine, categoria muscolare, descrizione breve, modifica e dettaglio
function ExerciseCard({ e, onOpen, onEdit }: { e: Exercise; onOpen: () => void; onEdit?: () => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexGrow: 1, flexBasis: 340, minWidth: 0, backgroundColor: t.card, borderRadius: 18, padding: 12, gap: 10 }}>
      <Pressable accessibilityLabel={`Apri ${e.name}`} onPress={onOpen} style={{ flexDirection: 'row', gap: 12 }}>
        <ExerciseTile e={e} size={84} />
        <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
          <Text numberOfLines={2} style={{ color: t.text, fontSize: 16.5, fontWeight: '700' }}>{e.name}</Text>
          <Text numberOfLines={1} style={{ color: t.accentInk, fontSize: 12.5, fontWeight: '600' }}>Categoria muscolare › {muscleLabel(e.muscle_group)}</Text>
          {e.description ? <Text numberOfLines={3} style={{ color: t.sub, fontSize: 13.5, lineHeight: 18 }}>{excerpt(e.description)}</Text> : null}
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <Pill label={CATEGORY[e.category] || 'Forza'} />
        <Pill label={noEquipment(e.equipment) ? 'Senza attrezzo' : e.equipment!} icon={noEquipment(e.equipment) ? 'body-outline' : 'construct-outline'} />
        <View style={{ flex: 1 }} />
        {onEdit ? <Button small kind="secondary" label="Modifica" icon="create-outline" full={false} onPress={onEdit} /> : null}
        <Button small kind="ghost" label="Dettaglio" full={false} onPress={onOpen} />
      </View>
    </View>
  );
}

// ───────── Scheda dell'esercizio ─────────

export function ExerciseDetail({ id }: { id: string }) {
  const nav = useNav();
  const { isStaff, userId } = useSession();
  const ex = useExercises();
  const prog = useAsync(() => (isStaff ? Promise.resolve([]) : api.progress()), [isStaff]);
  const [edit, setEdit] = useState<Partial<Exercise> | null>(null);
  const e = ex.data?.find((x) => x.id === id);
  const mine = (prog.data || []).find((p) => p.exercise_id === id);
  const yt = youtubeId(e?.video_url);
  const { t } = useTheme();
  const gc = e ? groupColor(e.muscle_group, t) : t.text;
  return (
    <Page onBack={nav.pop} navTitle={e?.name || 'Esercizio'}
      right={isStaff && e ? <IconButton name="create-outline" label="Modifica" color="accentInk" onPress={() => setEdit(e)} /> : undefined}>
      {!e ? <Spinner /> : (
        <View style={{ gap: 16, paddingHorizontal: 16, paddingTop: 4 }}>
          <Pressable accessibilityLabel={e.video_url ? 'Guarda il video' : 'Immagine dell\'esercizio'} disabled={!e.video_url} onPress={() => e.video_url && Linking.openURL(e.video_url)}
            style={{ height: 220, borderRadius: 22, overflow: 'hidden', backgroundColor: gc + '29', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={MUSCLE_ICON[e.muscle_group] || 'barbell'} size={84} color={gc} />
            {e.image_url ? <Image source={{ uri: e.image_url }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} resizeMode="cover" /> : null}
            {!e.image_url && yt ? <Image source={{ uri: `https://img.youtube.com/vi/${yt}/hqdefault.jpg` }} style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }} resizeMode="cover" /> : null}
            {e.video_url ? (
              <View style={{ position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.72)', borderRadius: 24, paddingHorizontal: 18, height: 46 }}>
                <Icon name="play" size={20} color="#fff" />
                <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Guarda il video</Text>
              </View>
            ) : null}
          </Pressable>
          <View>
            <Text style={[{ color: t.text }, TYPE.title]}>{e.name}</Text>
            <Text style={{ color: t.accentInk, fontSize: 14, fontWeight: '600', marginTop: 4 }}>Categoria muscolare › {muscleLabel(e.muscle_group)}</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <Pill label={CATEGORY[e.category] || 'Forza'} color={gc + '29'} textColor={t.text} />
              <Pill label={noEquipment(e.equipment) ? 'Senza attrezzo' : e.equipment!} icon="construct-outline" />
            </View>
          </View>
          {e.description ? (
            <View style={{ gap: 6 }}>
              <Txt v="head">Come si esegue</Txt>
              <Txt c="sub" style={{ lineHeight: 23 }}>{e.description}</Txt>
            </View>
          ) : null}
          {isStaff && (!e.video_url || !e.image_url) ? <Txt v="sub" c="faint">{[!e.image_url ? 'Nessuna immagine' : '', !e.video_url ? 'nessun video' : ''].filter(Boolean).join(', ')}: aggiungili da «Modifica» per farli vedere ai soci.</Txt> : null}
          {mine ? (
            <View style={{ gap: 10 }}>
              <Txt v="head">Il tuo andamento</Txt>
              <View style={{ backgroundColor: t.card, borderRadius: 18, padding: 16, gap: 12 }}>
                <BarChart data={mine.series.map((s, i) => ({ label: fmtDate(s.at), value: s.w || s.reps, on: i === mine.series.length - 1 }))} labelEvery={Math.ceil(mine.series.length / 4)} format={(n) => fmtNum(n, 1)} />
                <Txt v="sub" c="sub">{mine.pr_weight ? `Record ${fmtNum(mine.pr_weight, 2)} kg · ` : ''}{mine.sessions} {mine.sessions === 1 ? 'allenamento' : 'allenamenti'} · ultimo {ago(mine.last_at)}</Txt>
              </View>
            </View>
          ) : null}
        </View>
      )}
      <ExerciseEditor value={edit} onClose={() => setEdit(null)} />
    </Page>
  );
}

// ───────── Creazione e modifica di un esercizio (staff) ─────────

export function ExerciseEditor({ value, onClose }: { value: Partial<Exercise> | null; onClose: () => void }) {
  const { t } = useTheme();
  const { bump } = useVersion();
  const { toast } = useUi();
  const [f, setF] = useState<Partial<Exercise>>({});
  const [picked, setPicked] = useState<Picked | null>(null);   // immagine scelta, caricata al salvataggio
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (value) { setF(value); setPicked(null); } }, [value]);
  const preview = picked ? picked.uri : f.image_url;
  const pick = async () => {
    try { const p = await pickImage(); if (p) setPicked(p); } catch (e) { toast(errText(e), 'error'); }
  };
  const save = async () => {
    if (!f.name?.trim()) return toast('Scrivi il nome dell\'esercizio.', 'error');
    setBusy(true);
    let path: string | null = null;
    try {
      let image_url = f.image_url ?? null;
      if (picked) {
        path = `${uuid()}.${/png/i.test(picked.type) ? 'png' : /webp/i.test(picked.type) ? 'webp' : 'jpg'}`;
        await uploadFile('exercise-media', path, picked);
        image_url = publicUrl('exercise-media', path);
      }
      await api.saveExercise({ ...f, name: f.name!, muscle_group: f.muscle_group || 'petto', image_url });
      bump(); toast(f.id ? 'Esercizio aggiornato.' : 'Esercizio creato.'); onClose();
    } catch (e) {
      if (path) await removeFile('exercise-media', path);
      toast(errText(e), 'error');
    } finally { setBusy(false); }
  };
  return (
    <Sheet visible={!!value} onClose={onClose} title={f.id ? 'Modifica esercizio' : 'Nuovo esercizio'}
      footer={<Button label="Salva" onPress={save} loading={busy} />}>
      <Field label="Nome" value={f.name} onChangeText={(name) => setF({ ...f, name })} autoCapitalize="sentences" />
      <View style={{ gap: 6 }}>
        <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>Categoria muscolare</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {MUSCLE_KEYS.map((k) => <Chip key={k} small label={MUSCLE[k]} on={f.muscle_group === k} onPress={() => setF({ ...f, muscle_group: k })} />)}
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>Tipo di esercizio</Txt>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CATEGORY_KEYS.map((k) => <Chip key={k} small label={CATEGORY[k]} on={(f.category || 'forza') === k} onPress={() => setF({ ...f, category: k })} />)}
        </View>
      </View>
      <Field label="Attrezzo" value={f.equipment ?? ''} onChangeText={(equipment) => setF({ ...f, equipment })} placeholder="manubri, cavi, TRX, corpo libero…" />
      <Field label="Come si esegue" value={f.description ?? ''} onChangeText={(description) => setF({ ...f, description })} multiline />
      <View style={{ gap: 6 }}>
        <Txt v="cap" c="sub" style={{ marginLeft: 4, fontSize: 13 }}>Immagine</Txt>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 84, height: 84, borderRadius: 18, backgroundColor: t.card2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
            {preview ? <Image source={{ uri: preview }} resizeMode="cover" style={{ width: 84, height: 84 }} accessibilityLabel="Anteprima dell'immagine" /> : <Icon name="image-outline" size={30} color="faint" />}
          </View>
          <View style={{ flex: 1, gap: 8 }}>
            <Button small kind="secondary" icon="image-outline" label={preview ? 'Cambia immagine' : 'Scegli un\'immagine'} full={false} onPress={pick} />
            {preview ? <Button small kind="ghost" label="Togli l'immagine" full={false} onPress={() => { setPicked(null); setF({ ...f, image_url: null }); }} /> : null}
          </View>
        </View>
        <Txt v="cap" c="faint" style={{ marginLeft: 4 }}>JPG, PNG o WebP fino a 5 MB. Usa foto o disegni tuoi: le immagini di altri programmi hanno diritti d'autore.</Txt>
      </View>
      <Field label="Link al video" value={f.video_url ?? ''} onChangeText={(video_url) => setF({ ...f, video_url })} keyboardType="url" autoCapitalize="none" placeholder="https://youtu.be/…" hint="Un video YouTube «non in elenco» va benissimo: i soci lo aprono con un tocco." />
      {f.id ? (
        <Row title={f.active === false ? 'Nascosto ai soci' : 'Visibile ai soci'} sub="Un esercizio già usato non si cancella: si nasconde." onPress={() => setF({ ...f, active: f.active === false })}
          right={<Icon name={f.active === false ? 'eye-off-outline' : 'eye-outline'} size={22} color="sub" />} />
      ) : null}
    </Sheet>
  );
}

// ───────── Scelta di più esercizi dal catalogo (costruttore schede) ─────────

export function ExercisePicker({ visible, onClose, onAdd }: { visible: boolean; onClose: () => void; onAdd: (list: Exercise[]) => void }) {
  const ex = useExercises();
  const [q, setQ] = useState('');
  const [g, setG] = useState('');
  const [c, setC] = useState('');
  const [sel, setSel] = useState<string[]>([]);
  const [shown, setShown] = useState(PAGE);
  const { t } = useTheme();
  const list = useMemo(() => filterExercises(ex.data || [], q, g, c), [ex.data, q, g, c]);
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  const close = () => { setSel([]); setQ(''); setShown(PAGE); onClose(); };
  return (
    <Sheet visible={visible} onClose={close} title="Aggiungi esercizi"
      footer={<Button label={sel.length ? `Aggiungi ${sel.length}` : 'Scegli almeno un esercizio'} disabled={!sel.length} onPress={() => { onAdd((ex.data || []).filter((e) => sel.includes(e.id)).sort((a, b) => sel.indexOf(a.id) - sel.indexOf(b.id))); setSel([]); setQ(''); setShown(PAGE); }} />}>
      <SearchBox value={q} onChange={(v) => { setQ(v); setShown(PAGE); }} placeholder="Cerca un esercizio" />
      <View style={{ marginHorizontal: -20, gap: 8 }}>
        <MuscleChips value={g} onChange={(v) => { setG(v); setShown(PAGE); }} />
        <CategoryChips value={c} onChange={(v) => { setC(v); setShown(PAGE); }} small />
      </View>
      {ex.loading && !ex.data ? <Spinner /> : (
        <View style={{ backgroundColor: t.card2, borderRadius: 16, overflow: 'hidden' }}>
          {list.slice(0, shown).map((e, i) => {
            const on = sel.includes(e.id);
            return (
              <Pressable key={e.id} accessibilityLabel={e.name} onPress={() => toggle(e.id)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderTopWidth: i ? 1 : 0, borderTopColor: t.line, backgroundColor: on ? t.accentSoft : 'transparent' }}>
                <ExerciseTile e={e} size={40} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.text, fontSize: 16, fontWeight: '500' }}>{e.name}</Text>
                  <Text numberOfLines={1} style={{ color: t.sub, fontSize: 13 }}>{[muscleLabel(e.muscle_group), e.equipment].filter(Boolean).join(' · ')}</Text>
                </View>
                <Icon name={on ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={on ? 'accentInk' : 'faint'} />
              </Pressable>
            );
          })}
          {!list.length ? <View style={{ padding: 24 }}><Txt c="sub" style={{ textAlign: 'center' }}>Nessun esercizio trovato.</Txt></View> : null}
        </View>
      )}
      {list.length > shown ? <Button small kind="secondary" label={`Mostra altri (${list.length - shown})`} onPress={() => setShown(shown + PAGE)} /> : null}
    </Sheet>
  );
}

// ───────── Messaggi tra socio e PT ─────────

export function CommentsThread({ programId, memberName }: { programId: string; memberName?: string }) {
  const { t } = useTheme();
  const { userId } = useSession();
  const { toast } = useUi();
  const list = useAsync(async () => ({ comments: await api.comments(programId), staff: await api.staff() }), [programId]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim() || !userId) return;
    setBusy(true);
    try { await api.addComment(programId, userId, text); setText(''); list.bump(); }
    catch (e) { toast(errText(e), 'error'); } finally { setBusy(false); }
  };
  const nameOf = (c: Comment) => (c.author_id === userId ? 'Tu' : list.data?.staff.find((s) => s.id === c.author_id)?.full_name || memberName || 'Socio');
  return (
    <View style={{ gap: 10 }}>
      {list.loading && !list.data ? <Spinner pad={16} /> : null}
      {list.data && !list.data.comments.length ? <Txt v="sub" c="faint" style={{ paddingHorizontal: 4 }}>Nessun messaggio. Scrivi qui per chiedere o segnalare qualcosa sulla scheda.</Txt> : null}
      {list.data?.comments.map((c) => {
        const mine = c.author_id === userId;
        return (
          <View key={c.id} style={{ alignItems: mine ? 'flex-end' : 'flex-start' }}>
            <View style={{ maxWidth: '86%', backgroundColor: mine ? t.accent : t.card, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, gap: 2 }}>
              {!mine ? <Text style={{ color: t.accentInk, fontSize: 12.5, fontWeight: '700' }}>{nameOf(c)}</Text> : null}
              <Text style={{ color: mine ? t.onAccent : t.text, fontSize: 16, lineHeight: 22 }}>{c.body}</Text>
              <Text style={{ color: mine ? 'rgba(255,255,255,0.75)' : t.faint, fontSize: 11.5 }}>{ago(c.created_at)}</Text>
            </View>
          </View>
        );
      })}
      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}><Field value={text} onChangeText={setText} placeholder="Scrivi un messaggio" multiline inputStyle={{ minHeight: 44 }} style={{ gap: 0 }} /></View>
        <Pressable accessibilityLabel="Invia" disabled={busy || !text.trim()} onPress={send}
          style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: text.trim() ? t.accent : t.card2, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name="arrow-up" size={24} color={text.trim() ? t.onAccent : 'faint'} />
        </Pressable>
      </View>
    </View>
  );
}
