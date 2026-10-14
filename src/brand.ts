// Personalizzazione per la palestra: nome, testi e link. Colori e icone: vedi src/theme.tsx e assets/.
const demo = (globalThis as any).__DEMO;

export const BRAND = {
  gymName: (demo?.gym as string) || 'YMCA Prime Sport Club', // il nome della palestra, mostrato in profilo e messaggi
  appName: 'YMCA Prime Training', // nome dell'app negli store (app.json)
  appTitle: 'Prime Training',     // titolo nella schermata di benvenuto, sotto il logo
  tagline: 'Schede di allenamento, registro dei carichi e progressi.',
  privacyUrl: '',      // link all'informativa privacy della palestra (obbligatorio per la pubblicazione sugli store)
  supportWhatsapp: '', // numero della segreteria, es. '393331234567' (facoltativo)
};
