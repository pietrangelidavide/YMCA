# YMCA Prime Training

App per YMCA Prime Sport Club (nome e marchio si cambiano per altre palestre, vedi «Personalizzazione»): i soci hanno la scheda sempre in tasca e registrano i carichi, i personal trainer (PT) costruiscono e aggiornano le schede, il titolare vede i numeri della palestra. Alternativa a basso costo ai servizi in abbonamento per le schede (Training Program PRO e simili).
Expo / React Native (iPhone, Android, web installabile) + Supabase.

```
App.tsx              punto di partenza: accesso, schede principali di socio e staff
src/screens/         schermate (Oggi, Scheda, Progressi, Allenamento, Soci, Costruttore schede, Palestra...)
src/                 tema, componenti, navigazione, accesso a Supabase
lib/                 collegamento al database e notifiche
assets/              icona e schermata di avvio (scripts/gen-assets.cjs le rigenera)
supabase/setup.sql   schema del database, permessi, funzioni e 73 esercizi di partenza
supabase/test/       prova automatica dei permessi (Postgres locale)
demo/                demo web con dati finti (non fa parte dell'app)
docs/                preventivo: costi di gestione, canone e confronto (xlsx)
app.json, eas.json   configurazione Expo e build
STORE_CHECKLIST.md   pubblicazione negli store
```

## Cosa fa

**Socio** (5 schede): *Oggi* (prossimo allenamento, settimana, avvio con un tocco), *Scheda* (giorni, esercizi, note del PT, messaggi), *Progressi* (carichi per esercizio, record, misure del corpo, storico), *Esercizi* (libreria con descrizione e video), *Profilo* (obiettivo, tema, notifiche, eliminazione account).
Durante l'allenamento: serie una alla volta con i valori dell'ultima volta già compilati, timer di recupero, fatica percepita (RPE) a fine seduta. Funziona anche con la rete debole: l'allenamento resta sul telefono e si invia appena torna la connessione.

**Personal trainer** (4 schede): *Soci* (ricerca, filtri: miei, senza scheda, in scadenza, fermi da due settimane), *Schede* (modelli riutilizzabili e bozze), *Esercizi* (libreria modificabile, link ai video), *Palestra*. Dal socio: scheda attiva, preparare la prossima, progressi, ultimi allenamenti, messaggi, note riservate (il socio non le vede).
**Costruttore schede:** giorni (A, B, C…), esercizi con serie, ripetizioni, recupero, carico, tempo, superserie e note; sposta, duplica, salva come modello, salva come bozza o attiva. Il socio riceve una notifica.

**Titolare:** tutto quello del PT più numeri degli ultimi 30 giorni, nomina dei PT e codice di iscrizione.

## Messa in funzione

### 1. Database (Supabase)
1. Crea un progetto Supabase **in regione UE** (i dati dei soci sono dati personali).
2. SQL Editor: incolla tutto `supabase/setup.sql` ed esegui, una volta sola su progetto vuoto.
3. Authentication, *URL Configuration*: imposta *Site URL* sull'indirizzo web dell'app. *Providers > Email*: «Confirm email» acceso (il socio conferma l'indirizzo) o spento (entra subito). Per le email configura un SMTP tuo: il servizio predefinito ha limiti molto bassi.
4. Registrati dall'app con l'email del titolare, poi nel SQL Editor:
   ```sql
   update profiles set role = 'owner' where email = 'EMAIL-TITOLARE';
   update gym_settings set name = 'NOME PALESTRA', join_code = 'CODICE';
   ```
   Con `join_code` compilato si registra solo chi conosce il codice (si cambia anche dall'app, scheda *Palestra*). Da lì il titolare nomina i PT.

### 2. App
```
npx create-expo-app@latest schede-palestra --template blank-typescript
```
Copia nella cartella creata `App.tsx`, `app.json`, `eas.json`, `src/`, `lib/`, `assets/` (sostituendo quelli esistenti), poi:
```
npx expo install @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage expo-notifications expo-device expo-constants expo-status-bar expo-splash-screen expo-system-ui react-native-safe-area-context
npx expo install react-dom react-native-web @expo/metro-runtime
```
Crea il file `.env` (modello in `.env.example`) con URL e chiave *anon* del progetto Supabase. La chiave `service_role` non va mai nell'app né in un file. Avvio: `npx expo start` (`w` per il web, o Expo Go sul telefono).

### 3. Personalizzazione per la palestra
- `src/brand.ts`: nome della palestra, nome dell'app, frase di benvenuto, link all'informativa privacy, WhatsApp della segreteria.
- `src/theme.tsx`: colori. Quelli di partenza sono del marchio YMCA Prime: rosso `#E21D23`, bianco e grafite; i giorni della scheda e gli avatar usano rosso, grafite, bordeaux, rosa e argento.
- `assets/`: `logo.svg` è il logo, vettorializzato da un'immagine piccola (366 px): con il file vettoriale originale del club sostituiscilo e lancia `NODE_PATH=<node_modules con sharp> node scripts/gen-assets.cjs`, che rigenera `logo.png`, icona (triangolo rosso su nero), icona Android, schermata di avvio e favicon.
- `app.json`: `name`, `ios.bundleIdentifier` e `android.package` (**non cambiano più dopo la pubblicazione**: oggi sono segnaposto `it.example.ymcaprimetraining`).
- Video degli esercizi: i 73 esercizi di partenza non hanno video. Il PT incolla un link (YouTube «non in elenco» va benissimo) da *Esercizi > modifica*.

### 4. Notifiche push
Nuova scheda e messaggi arrivano come push. Le invia il database stesso (funzione `send_push`, estensione `pg_net`, servizio Expo): non servono funzioni server. Su iPhone le chiavi le gestisce EAS; su Android serve in più Firebase (`google-services.json` caricato su EAS). Sui simulatori e sul web le push non ci sono e l'app funziona lo stesso.

## Dati e privacy
- Le **note riservate** del PT sono visibili solo allo staff. L'app ricorda di non scrivere diagnosi: se si annotano informazioni sulla salute sono dati particolarmente protetti (GDPR), serve un'informativa adeguata e un consenso esplicito.
- Il socio elimina il proprio account dall'app (richiesto da Apple); l'ultimo titolare non può eliminarsi.
- Serve una **informativa privacy online** con un indirizzo pubblico (da mettere in `src/brand.ts` e negli store). Titolare del trattamento è la palestra; il fornitore dell'app è responsabile del trattamento: serve il relativo accordo.
- Backup: il piano gratuito di Supabase non li include e mette in pausa i progetti inattivi; per una palestra vera usa il piano a pagamento (vedi `docs/Preventivo_Schede_Palestra.xlsx`).

## Prova automatica dei permessi
`supabase/test/run.sh` carica `setup.sql` su un Postgres locale e verifica le regole (un socio vede solo le proprie schede, solo lo staff scrive le note, il ruolo lo cambia solo il titolare, salvataggio schede e allenamenti, doppio invio...). Uso: `PGHOST=... PGPORT=... bash supabase/test/run.sh`. Verifica lo schema su Postgres con un finto Supabase: va comunque ripetuto una volta sul progetto Supabase vero con account di prova.

## Demo online per il cliente (Cloudflare, gratis)
`demo/` costruisce una versione web con **dati finti** (non si collega a Supabase): serve a far vedere l'app senza installare nulla.
- Socio, PT e titolare con i pulsanti in alto; cornice telefono o schermo intero; tema Auto, Chiaro, Scuro.
- Parametri nell'indirizzo: `?login=member|trainer|owner` (salta l'accesso), `&view=phone|computer`, `&theme=light|dark`, `&gym=Nome della palestra`. Per provare la registrazione, il codice palestra è `PRIME`.
- Orologio fisso alle 10:40 (ora di Roma), così «Oggi» è uguale a ogni apertura. I dati finti stanno in `demo/mock/data.ts`.
- Ha `noindex` e `robots.txt`: non compare su Google.
- A mano: `cd demo && npm install && node build.mjs`, poi `npx serve dist`.

Su Cloudflare: *Workers & Pages > Create > Import a repository*, **Build command** `cd demo && npm install && node build.mjs`, **Deploy command** `npx wrangler deploy` (usa `wrangler.jsonc` nella radice). Ogni push aggiorna la demo.

## Limiti noti
- Non provato su un dispositivo: le notifiche push e il comportamento con rete assente vanno verificati su iPhone e Android reali.
- Su Android il tasto «indietro» del telefono dal costruttore schede esce senza chiedere conferma se ci sono modifiche non salvate.
- I link ai video sono aperti nel browser/app del telefono (nessun lettore integrato).
