// Benvenuto, accesso, registrazione e recupero password.
import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { BRAND } from '../brand';
import { api, errText } from '../data';
import { useTheme } from '../theme';
import { Button, Field, Icon, Logo, Txt, useUi } from '../ui';

type Mode = 'welcome' | 'login' | 'register' | 'forgot' | 'check';

const loginError = (m: string) =>
  /invalid login/i.test(m) ? 'Email o password non corrette.'
  : /not confirmed/i.test(m) ? 'Prima conferma la tua email: ti abbiamo scritto un link.'
  : /rate limit|too many/i.test(m) ? 'Troppi tentativi. Aspetta un minuto e riprova.'
  : errText({ message: m });

export default function Auth() {
  const [mode, setMode] = useState<Mode>('welcome');
  const [email, setEmail] = useState('');
  if (mode === 'welcome') return <Welcome onLogin={() => setMode('login')} onRegister={() => setMode('register')} />;
  return <Form mode={mode} setMode={setMode} email={email} setEmail={setEmail} />;
}

function Welcome({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0B', paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16), paddingHorizontal: 24 }}>
      <View style={{ flex: 1, justifyContent: 'center', gap: 28 }}>
        <Logo width={310} />
        <View style={{ gap: 12 }}>
          <Text style={{ color: '#fff', fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 44 }}>{BRAND.appTitle}</Text>
          <Text style={{ color: '#A5A5AD', fontSize: 18, lineHeight: 25 }}>{BRAND.tagline}</Text>
        </View>
      </View>
      <View style={{ gap: 10 }}>
        <Button label="Accedi" onPress={onLogin} />
        <Button label="Crea il tuo profilo" kind="secondary" onPress={onRegister} style={{ backgroundColor: '#26262A' }} />
        <Text style={{ color: '#76767E', fontSize: 12.5, textAlign: 'center', marginTop: 4 }}>Le tue schede e i tuoi allenamenti, sempre con te.</Text>
      </View>
    </View>
  );
}

function Form({ mode, setMode, email, setEmail }: { mode: Mode; setMode: (m: Mode) => void; email: string; setEmail: (s: string) => void }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useUi();
  const [pw, setPw] = useState('');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [needCode, setNeedCode] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (mode === 'register') api.checkJoinCode('').then((open) => setNeedCode(!open)).catch(() => {});
  }, [mode]);

  const submit = async () => {
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast('Controlla l\'indirizzo email.', 'error');
    setBusy(true);
    try {
      if (mode === 'login') {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password: pw });
        if (error) throw new Error(loginError(error.message));
      } else if (mode === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(e);
        if (error) throw error;
        toast('Ti abbiamo scritto un link per scegliere una nuova password.');
        setMode('login');
      } else if (mode === 'register') {
        if (!first.trim() || !last.trim()) throw new Error('Scrivi nome e cognome.');
        if (pw.length < 6) throw new Error('La password deve avere almeno 6 caratteri.');
        if (needCode && !(await api.checkJoinCode(code))) throw new Error('Il codice palestra non è corretto. Chiedilo in segreteria.');
        const { data, error } = await supabase.auth.signUp({
          email: e, password: pw,
          options: { data: { first_name: first.trim(), last_name: last.trim(), phone: phone.trim(), join_code: code.trim() } },
        });
        if (error) throw new Error(/already/i.test(error.message) ? 'Esiste già un profilo con questa email: prova ad accedere.' : errText(error));
        if (!data.session) setMode('check'); // serve confermare l'email
      }
    } catch (err: any) {
      toast(err?.message || errText(err), 'error');
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea il tuo profilo' : mode === 'forgot' ? 'Password dimenticata' : 'Controlla la posta';

  if (mode === 'check') {
    return (
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 60, paddingHorizontal: 24, gap: 14, alignItems: 'center' }}>
        <Icon name="mail-open-outline" size={52} color="accentInk" />
        <Txt v="title" style={{ textAlign: 'center' }}>Controlla la posta</Txt>
        <Txt c="sub" style={{ textAlign: 'center' }}>Ti abbiamo scritto a {email.trim()}. Tocca il link nel messaggio per confermare l'indirizzo, poi accedi.</Txt>
        <View style={{ height: 8 }} />
        <Button label="Ho confermato, accedi" onPress={() => setMode('login')} />
        <Button label="Rimanda il messaggio" kind="ghost" onPress={async () => { const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() }); toast(error ? errText(error) : 'Messaggio inviato.', error ? 'error' : 'ok'); }} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 24, paddingBottom: Math.max(insets.bottom, 16) + 24, gap: 14 }}>
        <Pressable accessibilityLabel="Indietro" onPress={() => setMode(mode === 'forgot' ? 'login' : 'welcome')} style={{ height: 44, justifyContent: 'center', alignSelf: 'flex-start' }}>
          <Icon name="chevron-back" size={28} color="accentInk" />
        </Pressable>
        <Txt v="large">{title}</Txt>
        {mode === 'forgot' ? <Txt c="sub">Scrivi l'email con cui ti sei registrato: ti mandiamo un link per scegliere una nuova password.</Txt> : null}
        {mode === 'register' ? (
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Field label="Nome" value={first} onChangeText={setFirst} autoCapitalize="words" style={{ flex: 1 }} />
            <Field label="Cognome" value={last} onChangeText={setLast} autoCapitalize="words" style={{ flex: 1 }} />
          </View>
        ) : null}
        <Field label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" placeholder="nome@email.it" />
        {mode !== 'forgot' ? <Field label="Password" value={pw} onChangeText={setPw} secure hint={mode === 'register' ? 'Almeno 6 caratteri.' : undefined} /> : null}
        {mode === 'register' ? <Field label="Telefono (facoltativo)" value={phone} onChangeText={setPhone} keyboardType="phone-pad" /> : null}
        {mode === 'register' && needCode ? <Field label="Codice palestra" value={code} onChangeText={setCode} autoCapitalize="characters" hint="Te lo dà la segreteria." /> : null}
        <View style={{ height: 4 }} />
        <Button label={mode === 'login' ? 'Accedi' : mode === 'register' ? 'Crea profilo' : 'Invia il link'} onPress={submit} loading={busy} />
        {mode === 'login' ? (
          <>
            <Button label="Password dimenticata?" kind="ghost" onPress={() => setMode('forgot')} />
            <Button label="Non hai un profilo? Registrati" kind="ghost" onPress={() => setMode('register')} />
          </>
        ) : null}
        {mode === 'register' ? (
          <>
            <Txt v="cap" c="faint" style={{ textAlign: 'center', lineHeight: 18 }}>
              Registrandoti accetti il trattamento dei tuoi dati da parte di {BRAND.gymName} per gestire le tue schede.
              {BRAND.privacyUrl ? ' ' : ''}
            </Txt>
            {BRAND.privacyUrl ? <Button label="Leggi l'informativa privacy" kind="ghost" small onPress={() => Linking.openURL(BRAND.privacyUrl)} /> : null}
            <Button label="Hai già un profilo? Accedi" kind="ghost" onPress={() => setMode('login')} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
