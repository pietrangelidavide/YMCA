// Componenti di base dell'app: testo, pulsanti, liste, pannelli, grafici a barre, barra delle schede.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import logoImg from '../assets/logo.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NUM, PLATES, TYPE, useTheme } from './theme';
import { initials } from './util';

// ───────── Testo e icone ─────────

type V = keyof typeof TYPE;
export function Txt({ v = 'body', c, num, style, children, ...p }: { v?: V; c?: string; num?: boolean; style?: any; children?: any; [k: string]: any }) {
  const { t } = useTheme();
  const color = c ? ((t as any)[c] ?? c) : t.text;
  return <Text {...p} style={[TYPE[v], { color }, num && NUM, style]}>{children}</Text>;
}

export function Icon({ name, size = 22, color, style }: { name: string; size?: number; color?: string; style?: any }) {
  const { t } = useTheme();
  return <Ionicons name={name as any} size={size} color={color ? ((t as any)[color] ?? color) : t.text} style={style} />;
}

// ───────── Pulsanti ─────────

export function Button({ label, onPress, kind = 'primary', icon, loading, disabled, small, style, full = true }: {
  label: string; onPress?: () => void; kind?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: string; loading?: boolean; disabled?: boolean; small?: boolean; style?: any; full?: boolean;
}) {
  const { t } = useTheme();
  const bg = kind === 'primary' ? t.accent : kind === 'danger' ? t.danger : kind === 'secondary' ? t.card2 : 'transparent';
  const fg = kind === 'primary' || kind === 'danger' ? t.onAccent : kind === 'ghost' ? t.accentInk : t.text;
  const off = disabled || loading;
  return (
    <Pressable
      accessibilityLabel={label}
      disabled={off}
      onPress={onPress}
      style={({ pressed }: any) => [
        { minHeight: small ? 40 : 52, paddingHorizontal: small ? 16 : 20, borderRadius: small ? 12 : 16, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: off ? 0.45 : pressed ? 0.75 : 1 },
        !full && { alignSelf: 'flex-start' },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={fg} size="small" /> : icon ? <Icon name={icon} size={small ? 18 : 20} color={fg} /> : null}
      <Text style={{ color: kind === 'danger' && !t.dark ? '#fff' : fg, fontSize: small ? 15 : 17, fontWeight: '600' }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ name, onPress, label, color, size = 22, bg }: { name: string; onPress?: () => void; label: string; color?: string; size?: number; bg?: boolean }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} hitSlop={8}
      style={({ pressed }: any) => ({ width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: bg ? t.card2 : 'transparent', opacity: pressed ? 0.6 : 1 })}>
      <Icon name={name} size={size} color={color || 'text'} />
    </Pressable>
  );
}

// ───────── Elementi di scelta ─────────

export function Chip({ label, on, onPress, color, textColor, icon, small }: { label: string; on?: boolean; onPress?: () => void; color?: string; textColor?: string; icon?: string; small?: boolean }) {
  const { t } = useTheme();
  const bg = on ? (color || t.accent) : t.card2;
  const fg = on ? (textColor || t.onAccent) : t.text;
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }: any) => ({ height: small ? 32 : 38, paddingHorizontal: small ? 12 : 16, borderRadius: 19, backgroundColor: bg, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: pressed ? 0.7 : 1 })}>
      {icon ? <Icon name={icon} size={16} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: small ? 13.5 : 15, fontWeight: on ? '700' : '500' }}>{label}</Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({ items, value, onChange }: { items: [string, T][]; value: T; onChange: (v: T) => void }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.card2, borderRadius: 12, padding: 3 }}>
      {items.map(([label, v]) => {
        const on = v === value;
        return (
          <Pressable key={v} accessibilityLabel={label} onPress={() => onChange(v)}
            style={{ flex: 1, height: 36, borderRadius: 9, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? t.card : 'transparent' }}>
            <Text style={{ color: t.text, fontSize: 14, fontWeight: on ? '700' : '500' }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Pill({ label, color, textColor, icon }: { label: string; color?: string; textColor?: string; icon?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, height: 22, borderRadius: 11, backgroundColor: color || t.card2 }}>
      {icon ? <Icon name={icon} size={12} color={textColor || 'sub'} /> : null}
      <Text style={{ color: textColor || t.sub, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

// Cerchio con le iniziali; il colore dipende dal nome (toni del marchio)
export function Avatar({ name, size = 44 }: { name?: string | null; size?: number }) {
  const h = (name || '?').split('').reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const p = PLATES[h % 4];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.c, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: p.on, fontSize: size * 0.38, fontWeight: '700' }}>{initials(name)}</Text>
    </View>
  );
}

// ───────── Campi di testo ─────────

export function Field({ label, value, onChangeText, placeholder, secure, multiline, keyboardType, suffix, autoCapitalize, style, inputStyle, align, editable = true, hint, maxLength }: {
  label?: string; value?: string; onChangeText?: (s: string) => void; placeholder?: string; secure?: boolean; multiline?: boolean; keyboardType?: any; suffix?: string; autoCapitalize?: any; style?: any; inputStyle?: any; align?: 'left' | 'center' | 'right'; editable?: boolean; hint?: string; maxLength?: number;
}) {
  const { t } = useTheme();
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? <Text style={{ color: t.sub, fontSize: 13, fontWeight: '500', marginLeft: 4 }}>{label}</Text> : null}
      <View style={{ backgroundColor: t.card2, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, minHeight: multiline ? 92 : 50 }}>
        <TextInput
          accessibilityLabel={label || placeholder}
          value={value ?? ''}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={t.faint}
          secureTextEntry={secure}
          multiline={multiline}
          editable={editable}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize ?? (secure || keyboardType === 'email-address' ? 'none' : 'sentences')}
          autoCorrect={false}
          style={[{ flex: 1, color: t.text, fontSize: 17, paddingVertical: multiline ? 12 : 0, minHeight: multiline ? 92 : 50, textAlign: align || 'left', textAlignVertical: multiline ? 'top' : 'center' } as any, inputStyle]}
        />
        {suffix ? <Text style={{ color: t.sub, fontSize: 15, marginLeft: 6 }}>{suffix}</Text> : null}
      </View>
      {hint ? <Text style={{ color: t.faint, fontSize: 12.5, marginLeft: 4 }}>{hint}</Text> : null}
    </View>
  );
}

// Interruttore sì/no
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { t } = useTheme();
  return (
    <Pressable accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} onPress={() => onChange(!value)} hitSlop={8}
      style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: value ? t.accent : t.card2, justifyContent: 'center', padding: 3 }}>
      <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: value ? t.onAccent : t.faint, alignSelf: value ? 'flex-end' : 'flex-start' }} />
    </Pressable>
  );
}

// ───────── Liste ─────────

export function SectionTitle({ children, right }: { children: any; right?: React.ReactNode }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22, marginBottom: 8, paddingHorizontal: 4 }}>
      <Text style={{ color: t.sub, fontSize: 13.5, fontWeight: '600' }}>{children}</Text>
      {right}
    </View>
  );
}

export function Group({ children, style, pad }: { children: any; style?: any; pad?: boolean }) {
  const { t } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={[{ backgroundColor: t.card, borderRadius: 18, overflow: 'hidden', padding: pad ? 16 : 0 }, style]}>
      {pad ? children : items.map((c, i) => (
        <View key={i}>
          {i > 0 ? <View style={{ height: StyleSheet.hairlineWidth || 1, backgroundColor: t.line, marginLeft: 16 }} /> : null}
          {c}
        </View>
      ))}
    </View>
  );
}

export function Row({ title, sub, left, right, onPress, chevron, value, danger, accessibilityLabel, minHeight, lines }: {
  lines?: number; title?: string; sub?: string | null; left?: React.ReactNode; right?: React.ReactNode; onPress?: () => void; chevron?: boolean; value?: string; danger?: boolean; accessibilityLabel?: string; minHeight?: number;
}) {
  const { t } = useTheme();
  const body = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, minHeight: minHeight || 56 }}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={lines || 1} style={{ color: danger ? t.danger : t.text, fontSize: 16.5, fontWeight: '500' }}>{title}</Text>
        {sub ? <Text numberOfLines={2} style={{ color: t.sub, fontSize: 14 }}>{sub}</Text> : null}
      </View>
      {value ? <Text numberOfLines={1} style={[{ color: t.sub, fontSize: 15.5, maxWidth: 160 }, NUM]}>{value}</Text> : null}
      {right}
      {chevron ? <Icon name="chevron-forward" size={18} color="faint" /> : null}
    </View>
  );
  if (!onPress) return body;
  return <Pressable accessibilityLabel={accessibilityLabel || title} onPress={onPress} style={({ pressed }: any) => ({ backgroundColor: pressed ? t.card2 : 'transparent' })}>{body}</Pressable>;
}

// Riquadro con un numero grande e una didascalia
export function Stat({ value, label, tone, style }: { value: string | number; label: string; tone?: string; style?: any }) {
  const { t } = useTheme();
  return (
    <View style={[{ flex: 1, backgroundColor: t.card, borderRadius: 18, padding: 14, gap: 2, minWidth: 0 }, style]}>
      <Text style={[{ color: tone ? ((t as any)[tone] ?? tone) : t.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, NUM]}>{value}</Text>
      <Text style={{ color: t.sub, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

// ───────── Stati ─────────

export function Spinner({ pad = 40 }: { pad?: number }) {
  const { t } = useTheme();
  return <View style={{ padding: pad, alignItems: 'center' }}><ActivityIndicator color={t.sub} /></View>;
}

export function Empty({ icon = 'barbell-outline', title, text, action }: { icon?: string; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <View style={{ alignItems: 'center', gap: 10, paddingVertical: 48, paddingHorizontal: 28 }}>
      <Icon name={icon} size={40} color="faint" />
      <Txt v="head" style={{ textAlign: 'center' }}>{title}</Txt>
      {text ? <Txt v="sub" c="sub" style={{ textAlign: 'center' }}>{text}</Txt> : null}
      {action ? <View style={{ marginTop: 8 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ error, onRetry }: { error: any; onRetry?: () => void }) {
  const msg = (error?.message as string) || 'Qualcosa non ha funzionato.';
  return (
    <Empty icon="cloud-offline-outline" title="Non riesco a caricare" text={/fetch|network|failed/i.test(msg) ? 'Controlla la connessione e riprova.' : msg}
      action={onRetry ? <Button label="Riprova" kind="secondary" small onPress={onRetry} full={false} /> : undefined} />
  );
}

// ───────── Pannello dal basso ─────────

export function Sheet({ visible, onClose, title, children, footer, right }: { visible: boolean; onClose: () => void; title?: string; children?: any; footer?: React.ReactNode; right?: React.ReactNode }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable accessibilityLabel="Chiudi" onPress={onClose} style={{ flex: 1, backgroundColor: t.overlay, justifyContent: 'flex-end' }}>
          <Pressable onPress={() => {}} style={{ backgroundColor: t.card, borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '90%', width: '100%', maxWidth: 560, alignSelf: 'center', paddingBottom: Math.max(insets.bottom, 12) }}>
            <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 38, height: 5, borderRadius: 3, backgroundColor: t.card2 }} /></View>
            {title ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 6, gap: 8 }}>
                <Text style={{ flex: 1, color: t.text, fontSize: 20, fontWeight: '700', letterSpacing: -0.3 }} numberOfLines={1}>{title}</Text>
                {right}
              </View>
            ) : null}
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flexGrow: 0 }} contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 12, gap: 14 }}>{children}</ScrollView>
            {footer ? <View style={{ paddingHorizontal: 20, paddingTop: 8, gap: 10 }}>{footer}</View> : null}
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ───────── Avvisi e conferme ─────────

type Confirm = { title: string; message?: string; confirmLabel?: string; destructive?: boolean };
type UiCtx = { toast: (msg: string, kind?: 'ok' | 'error') => void; confirm: (c: Confirm) => Promise<boolean> };
const UiContext = createContext<UiCtx>({ toast: () => {}, confirm: async () => false });
export const useUi = () => useContext(UiContext);

export function UiProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const [msg, setMsg] = useState<{ text: string; kind: 'ok' | 'error'; k: number } | null>(null);
  const [conf, setConf] = useState<(Confirm & { resolve: (v: boolean) => void }) | null>(null);
  const timer = useRef<any>(null);
  const toast = useCallback((text: string, kind: 'ok' | 'error' = 'ok') => {
    setMsg({ text, kind, k: Date.now() });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), kind === 'error' ? 4200 : 2400);
  }, []);
  const confirm = useCallback((c: Confirm) => new Promise<boolean>((resolve) => setConf({ ...c, resolve })), []);
  const done = (v: boolean) => { conf?.resolve(v); setConf(null); };
  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);
  return (
    <UiContext.Provider value={value}>
      {children}
      {msg ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: 16, right: 16, top: insets.top + 8, alignItems: 'center', zIndex: 100 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: msg.kind === 'error' ? t.danger : t.dark ? '#F5F5F7' : '#111114', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, maxWidth: 420 }}>
            <Icon name={msg.kind === 'error' ? 'alert-circle' : 'checkmark-circle'} size={20} color={msg.kind === 'error' ? '#fff' : t.dark ? '#111114' : '#fff'} />
            <Text style={{ color: msg.kind === 'error' ? '#fff' : t.dark ? '#111114' : '#fff', fontSize: 15, fontWeight: '600', flexShrink: 1 }}>{msg.text}</Text>
          </View>
        </View>
      ) : null}
      <Sheet visible={!!conf} onClose={() => done(false)} title={conf?.title}
        footer={<>
          <Button label={conf?.confirmLabel || 'Conferma'} kind={conf?.destructive ? 'danger' : 'primary'} onPress={() => done(true)} />
          <Button label="Annulla" kind="secondary" onPress={() => done(false)} />
        </>}>
        {conf?.message ? <Txt v="body" c="sub">{conf.message}</Txt> : null}
      </Sheet>
    </UiContext.Provider>
  );
}

// ───────── Struttura delle pagine ─────────

export function NavBar({ title, onBack, right, backLabel }: { title?: string; onBack?: () => void; right?: React.ReactNode; backLabel?: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', height: 48, paddingHorizontal: 8 }}>
      <View style={{ width: 96, alignItems: 'flex-start' }}>
        {onBack ? (
          <Pressable accessibilityLabel="Indietro" onPress={onBack} hitSlop={8} style={({ pressed }: any) => ({ flexDirection: 'row', alignItems: 'center', height: 40, paddingRight: 10, opacity: pressed ? 0.5 : 1 })}>
            <Icon name="chevron-back" size={26} color="accentInk" />
            {backLabel ? <Text style={{ color: t.accentInk, fontSize: 17 }}>{backLabel}</Text> : null}
          </Pressable>
        ) : null}
      </View>
      <Text numberOfLines={1} style={{ flex: 1, textAlign: 'center', color: t.text, fontSize: 17, fontWeight: '600' }}>{title}</Text>
      <View style={{ width: 96, alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'flex-end' }}>{right}</View>
    </View>
  );
}

// Pagina: titolo grande (schede principali) o barra con freccia indietro (schermate aperte da un'altra)
export function Page({ title, onBack, right, children, footer, scroll = true, pad = false, subtitle, navTitle, backLabel, bottomSpace = 24 }: {
  title?: string; onBack?: () => void; right?: React.ReactNode; children?: any; footer?: React.ReactNode; scroll?: boolean; pad?: boolean; subtitle?: string; navTitle?: string; backLabel?: string; bottomSpace?: number;
}) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  const head = onBack ? (
    <NavBar title={navTitle ?? title} onBack={onBack} right={right} backLabel={backLabel} />
  ) : null;
  const large = !onBack && title ? (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        {subtitle ? <Text style={{ color: t.sub, fontSize: 14, fontWeight: '500', marginBottom: 2 }}>{subtitle}</Text> : null}
        <Text numberOfLines={1} style={[{ color: t.text }, TYPE.large]}>{title}</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginBottom: 2 }}>{right}</View>
    </View>
  ) : null;
  const inner = (
    <>
      {onBack && title && navTitle ? (
        <View style={{ paddingHorizontal: 20, paddingTop: 2, paddingBottom: 10 }}>
          {subtitle ? <Text style={{ color: t.sub, fontSize: 14, fontWeight: '500', marginBottom: 2 }}>{subtitle}</Text> : null}
          <Text style={[{ color: t.text }, TYPE.large]}>{title}</Text>
        </View>
      ) : null}
      {children}
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      {head}
      {large}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: pad ? 16 : 0, paddingBottom: bottomSpace }}>{inner}</ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{inner}</View>
      )}
      {footer ? <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 12), backgroundColor: t.bg, borderTopWidth: 1, borderTopColor: t.line, gap: 8 }}>{footer}</View> : null}
    </View>
  );
}

// ───────── Barra delle schede ─────────

export type TabDef = { key: string; label: string; icon: string; iconOn: string; badge?: number };
export function TabBar({ tabs, active, onPick }: { tabs: TabDef[]; active: string; onPick: (k: string) => void }) {
  const { t } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: t.dark ? 'rgba(18,18,20,0.96)' : 'rgba(250,250,252,0.96)', borderTopWidth: 1, borderTopColor: t.line, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8) }}>
      {tabs.map((tb) => {
        const on = tb.key === active;
        return (
          <Pressable key={tb.key} accessibilityLabel={tb.label} onPress={() => onPick(tb.key)} style={{ flex: 1, alignItems: 'center', gap: 2, paddingVertical: 2 }}>
            <View>
              <Icon name={on ? tb.iconOn : tb.icon} size={25} color={on ? 'accentInk' : 'faint'} />
              {tb.badge ? <View style={{ position: 'absolute', right: -8, top: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: t.accent, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Text style={{ color: t.onAccent, fontSize: 10.5, fontWeight: '700' }}>{tb.badge}</Text></View> : null}
            </View>
            <Text style={{ color: on ? t.accentInk : t.faint, fontSize: 10.5, fontWeight: on ? '700' : '500' }}>{tb.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ───────── Grafico a barre ─────────

export function BarChart({ data, height = 120, color, format, labelEvery = 1 }: {
  data: { label: string; value: number; on?: boolean }[]; height?: number; color?: string; format?: (n: number) => string; labelEvery?: number;
}) {
  const { t } = useTheme();
  const max = Math.max(1, ...data.map((d) => d.value));
  const plot = height - 36;
  return (
    <View style={{ height, flexDirection: 'row', alignItems: 'flex-end', gap: 6 }}>
      {data.map((d, i) => (
        <View key={i} style={{ flex: 1, height, alignItems: 'center', justifyContent: 'flex-end', gap: 4, minWidth: 0 }}>
          <Text numberOfLines={1} style={[{ color: d.on ? t.text : t.faint, fontSize: 11, fontWeight: d.on ? '700' : '500', height: 14 }, NUM]}>{d.value ? (format ? format(d.value) : String(d.value)) : ''}</Text>
          <View style={{ width: '100%', maxWidth: 34, height: Math.max(d.value ? 4 : 2, (d.value / max) * plot), borderRadius: 6, backgroundColor: d.on ? (color || t.accent) : t.card2 }} />
          <Text numberOfLines={1} style={{ color: t.faint, fontSize: 11, height: 14 }}>{i % labelEvery === 0 ? d.label : ''}</Text>
        </View>
      ))}
    </View>
  );
}

// ───────── Il bilanciere: simbolo dell'app ─────────

export function Logo({ width = 260 }: { width?: number }) {
  return <Image accessibilityLabel="YMCA Prime Sport Club" source={logoImg} resizeMode="contain" style={{ width, height: width * (316 / 1464) }} />;
}
