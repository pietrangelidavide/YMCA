# YMCA Prime Training

App per YMCA Prime Sport Club (nome e marchio si cambiano per altre palestre, vedi «Personalizzazione»): i soci hanno la scheda sempre in tasca e registrano i carichi, i personal trainer (PT) costruiscono e aggiornano le schede, il titolare vede i numeri della palestra. Alternativa a basso costo ai servizi in abbonamento per le schede (Training Program PRO e simili).
Expo / React Native (iPhone, Android, web installabile) + Supabase.

```
App.tsx              punto di partenza: accesso, schede principali di socio e staff
src/screens/         schermate (Oggi, Scheda, Progressi, Allenamento, Soci, Costruttore schede, Palestra...)
src/                 tema, componenti, navigazione, accesso a Supabase
lib/                 collegamento al database e notifiche
assets/              icona e schermata di avvio (scripts/gen-assets.cjs le rigenera)
supabase/setup.sql   schema del database, permessi, funzioni e 282 esercizi di partenza (versione 1.1, completo)
supabase/update_1_1.sql  aggiornamento da 1.0 a 1.1 per chi ha già un progetto (base_1_0.sql è la 1.0)
supabase/test/       prova automatica dei permessi (Postgres locale)
demo/                demo web con dati finti (non fa parte dell'app)
docs/                preventivo: costi di gestione, canone e confronto (xlsx)
app.json, eas.json   configurazione Expo e build
STORE_CHECKLIST.md   pubblicazione negli store
```

## Cosa fa

**Socio** (5 schede): *Oggi* (prossimo allenamento, settimana, avvio con un tocco), *Scheda* (giorni, esercizi, note del PT, messaggi), *Progressi* (carichi per esercizio, record, misure del corpo, storico), *Esercizi* (libreria con foto di partenza e arrivo, descrizione e video), *Profilo* (obiettivo, tema, notifiche, crediti delle illustrazioni, eliminazione account).
**Classifica delle tonnellate** (nel riquadro di *Oggi* e di *Progressi*): chi ha sollevato di più (peso × ripetizioni delle serie con un carico), per periodo (sempre, anno, mese, settimana), podio, posizione e distacco dal socio davanti, traguardi personali a tonnellate. **È facoltativa**: ci si entra con un tocco e si esce quando si vuole; agli altri soci compaiono solo nome, iniziale del cognome e tonnellate (mai schede o carichi dei singoli esercizi). Lo staff la vede dal menu *Altro* con i nomi completi e può aprire i progressi del socio.
Durante l'allenamento: serie una alla volta con i valori dell'ultima volta già compilati, timer di recupero, fatica percepita (RPE) a fine seduta. Funziona anche con la rete debole: l'allenamento resta sul telefono e si invia appena torna la connessione.

**Personal trainer** (5 schede):
- *Bacheca*: numero di utenti, schede, esercizi, modelli e corsi (ogni numero apre l'elenco), soci senza scheda o con scheda in scadenza, ultimi 30 giorni, ultimi iscritti, collaboratori e schede.
- *Soci*: ricerca, filtri (miei, senza scheda, in scadenza, fermi da due settimane, disattivati), ordinamento (cognome, nome, PT, ultimo allenamento, data di iscrizione), esportazione in CSV (si apre in Excel), invito di un nuovo socio (codice palestra e messaggio pronto per WhatsApp). Ogni riga si apre in azioni rapide: scheda, report, peso e misure, anamnesi, preferenze, documenti, chiama, WhatsApp.
- *Schede*: «Assegnate» (filtri per stato, ricerca, CSV) e «Modelli» (archivio con obiettivo, livello, destinatario e durata; si assegna a un socio in pochi tocchi, si duplica, si modifica).
- *Esercizi*: archivio di 646 esercizi (18 gruppi muscolari, tipo, attrezzo), ricerca e filtri; 264 hanno già due illustrazioni (partenza e arrivo); ogni esercizio può avere descrizione, immagine propria e link a un video.
- *Altro*: Calendario (giorno, settimana, mese: allenamenti dei soci, schede da rinnovare, appuntamenti e lezioni da aggiungere), Notifiche push (avviso a tutti i soci, solo staff o soci scelti), Corsi, Documenti (PDF fino a 2 MB da assegnare ai soci), Peso e misure, Report allenamenti, Collaboratori.

Dal socio: scheda attiva, preparare la prossima, progressi, ultimi allenamenti, messaggi, note riservate (il socio non le vede) e, riservati allo staff, **anamnesi** (generale, sportiva, alimentare, fisiologica, familiare, con consenso e data) e **preferenze di allenamento** (obiettivo, zone, giorni, orari, cosa piace e cosa no; le compila anche il socio da Profilo). Peso e misure: misure del corpo, **plicometria** (stima del grasso con Jackson-Pollock a 3 pliche) e **BIA**, con grafici per periodo. Report: allenamenti al mese, esercizi per seduta, frequenza e progressione dei carichi per esercizio, per periodo e per scheda.
**Costruttore schede:** giorni (A, B, C…), esercizi con serie, ripetizioni, recupero, carico, tempo, superserie e note; in più **tecniche di allenamento** (serie a piramide, drop set…), **lezioni** di un corso e **riposo**; obiettivo, livello, destinatario, durata, «disattiva alla scadenza» e corsi consigliati; sposta, duplica, salva come modello, salva come bozza o attiva. Il socio riceve una notifica.

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
   Con `join_code` compilato si registra solo chi conosce il codice (si cambia anche dall'app, *Altro > Iscrizione dei soci*). Da lì il titolare nomina i PT.

**Hai già la versione 1.0?** Non rifare tutto: incolla `supabase/update_1_1.sql` nel SQL Editor ed eseguilo **una volta sola**. Aggiunge anamnesi, preferenze, documenti, corsi, plicometria, BIA, calendario, avvisi, i nuovi campi delle schede e i 282 esercizi (i tuoi esercizi, i video e le schede già fatte restano).

**Hai già la 1.1?** Incolla `supabase/update_1_2.sql` ed eseguilo **una volta sola** (si può rilanciare senza danni): porta gli esercizi a 646, aggiunge il collegamento alle illustrazioni (`library_image`) e la classifica delle tonnellate (partecipazione facoltativa, disattivata per tutti finché il socio non entra). Per un progetto nuovo basta `setup.sql`, che le contiene già. Poi pubblica una nuova versione dell'app: le immagini sono dentro l'app (6 MB circa in più). I contenitori di file (`documents`, privato, e `exercise-media`, pubblico) si creano da soli; se il tuo progetto non ha l'area *Storage* attiva, abilitala prima.

### 2. App
```
npx create-expo-app@latest schede-palestra --template blank-typescript
```
Copia nella cartella creata `App.tsx`, `app.json`, `eas.json`, `src/`, `lib/`, `assets/` (sostituendo quelli esistenti), poi:
```
npx expo install @supabase/supabase-js react-native-url-polyfill @react-native-async-storage/async-storage expo-notifications expo-device expo-constants expo-status-bar expo-splash-screen expo-system-ui react-native-safe-area-context expo-document-picker expo-image-picker
npx expo install react-dom react-native-web @expo/metro-runtime
```
Crea il file `.env` (modello in `.env.example`) con URL e chiave *anon* del progetto Supabase. La chiave `service_role` non va mai nell'app né in un file. Avvio: `npx expo start` (`w` per il web, o Expo Go sul telefono).

### 3. Personalizzazione per la palestra
- `src/brand.ts`: nome della palestra, nome dell'app, frase di benvenuto, link all'informativa privacy, WhatsApp della segreteria.
- `src/theme.tsx`: colori. Quelli di partenza sono del marchio YMCA Prime: rosso `#E21D23`, bianco e grafite; i giorni della scheda e gli avatar usano rosso, grafite, bordeaux, rosa e argento.
- `assets/`: `logo.svg` è il logo, vettorializzato da un'immagine piccola (366 px): con il file vettoriale originale del club sostituiscilo e lancia `NODE_PATH=<node_modules con sharp> node scripts/gen-assets.cjs`, che rigenera `logo.png`, icona (triangolo rosso su nero), icona Android, schermata di avvio e favicon.
- `app.json`: `name`, `ios.bundleIdentifier` e `android.package` (**non cambiano più dopo la pubblicazione**: oggi sono segnaposto `it.example.ymcaprimetraining`).
- Immagini e video degli esercizi: 264 esercizi hanno due illustrazioni (partenza e arrivo) già dentro l'app, prese dal progetto **Everkinetic** con licenza **CC BY-SA** (ridimensionate; l'attribuzione è nel dettaglio dell'esercizio e in *Profilo > Crediti delle illustrazioni*: non toglierla, vedi `assets/exercises/LICENSE.md`). Gli altri 382 hanno nome, gruppo, tipo, attrezzo e descrizione scritta per questa app, senza illustrazione. Il PT può aggiungere da *Esercizi > Modifica* un'immagine propria (JPG, PNG o WebP fino a 5 MB), che ha sempre la precedenza, e/o un link a un video (YouTube «non in elenco» va benissimo). Altre raccolte trovate in rete (copiate da siti commerciali) non sono state usate perché il diritto d'autore non è chiaro.
- Rigenerare le illustrazioni: `EVERKINETIC_DIR=<cartella dati> python3 scripts/build-exercise-images.py`; elenco esercizi in `supabase/seed/exercises.json`, poi `node scripts/gen-seed-sql.cjs && node scripts/build-setup.cjs`.

### 4. Notifiche push
Nuova scheda, messaggi e gli avvisi scritti dallo staff (*Altro > Notifiche push*) arrivano come push. Le invia il database stesso (funzione `send_push`, estensione `pg_net`, servizio Expo): non servono funzioni server. Su iPhone le chiavi le gestisce EAS; su Android serve in più Firebase (`google-services.json` caricato su EAS). Sui simulatori e sul web le push non ci sono e l'app funziona lo stesso.

## Dati e privacy
- Le **note riservate** del PT sono visibili solo allo staff. L'app ricorda di non scrivere diagnosi: se si annotano informazioni sulla salute sono dati particolarmente protetti (GDPR), serve un'informativa adeguata e un consenso esplicito.
- **Anamnesi, BIA e plicometria sono dati sulla salute** (GDPR, art. 9). L'anamnesi la vede e la scrive solo lo staff (permessi di riga nel database, provati dai test); non si salva senza la data del consenso del socio. Il socio vede le proprie misure, plicometria e BIA, ma non l'anamnesi. Prima di usarle servono: informativa che le nomina, consenso esplicito, un elenco di chi tra lo staff può accedervi e un periodo di conservazione deciso dalla palestra. Le preferenze di allenamento non sono dati sulla salute.
- La **classifica delle tonnellate** è a partecipazione volontaria (`profiles.leaderboard_opt_in`, falso di default): chi non entra non compare e non vede il proprio nome nell'elenco. Gli altri soci vedono solo nome, iniziale del cognome e totale; lo staff i nomi completi. I dati sono quelli degli allenamenti già registrati, che non vengono mai mostrati. Nell'informativa privacy va citata questa finalità facoltativa; il socio può uscire in ogni momento dalla schermata stessa.
- I **documenti** (PDF fino a 2 MB) stanno in un contenitore privato: il socio apre solo quelli che gli sono assegnati e che lo staff ha reso «visibili». Non caricare referti medici se la palestra non ha una base giuridica per trattarli.
- Il socio elimina il proprio account dall'app (richiesto da Apple); l'ultimo titolare non può eliminarsi.
- Serve una **informativa privacy online** con un indirizzo pubblico (da mettere in `src/brand.ts` e negli store). Titolare del trattamento è la palestra; il fornitore dell'app è responsabile del trattamento: serve il relativo accordo.
- Backup: il piano gratuito di Supabase non li include e mette in pausa i progetti inattivi; per una palestra vera usa il piano a pagamento (vedi `docs/Preventivo_Schede_Palestra.xlsx`).

## Prova automatica dei permessi
`supabase/test/run.sh` carica `setup.sql` su un Postgres locale e verifica le regole (un socio vede solo le proprie schede, solo lo staff scrive le note, il ruolo lo cambia solo il titolare, salvataggio schede e allenamenti, doppio invio, anamnesi riservata allo staff, documenti visibili solo a chi sono assegnati, avvisi, calendario, report...). Uso: `PGHOST=... PGPORT=... bash supabase/test/run.sh`; con `run.sh migrate` parte dalla 1.0 e applica `update_1_1.sql`, per provare l'aggiornamento di un database già in uso. Verifica lo schema su Postgres con un finto Supabase: va comunque ripetuto una volta sul progetto Supabase vero con account di prova.

## Demo online per il cliente (Cloudflare, gratis)
`demo/` costruisce una versione web con **dati finti** (non si collega a Supabase): serve a far vedere l'app senza installare nulla.
- Dalla schermata di benvenuto: **Accedi come cliente / trainer / titolare**; cornice telefono o schermo intero; tema Auto, Chiaro, Scuro.
- Parametri nell'indirizzo: `?login=member|trainer|owner` (salta l'accesso), `&view=phone|computer`, `&theme=light|dark`, `&gym=Nome della palestra`. Per provare la registrazione, il codice palestra è `PRIME`.
- Orologio fisso alle 10:40 (ora di Roma), così «Oggi» è uguale a ogni apertura. I dati finti (soci, schede, modelli, corsi, anamnesi, documenti, calendario, avvisi) stanno in `demo/mock/data.ts`. Nella demo i file «caricati» (PDF, immagini) restano in memoria finché la pagina è aperta e gli avvisi non partono davvero.
- Ha `noindex` e `robots.txt`: non compare su Google.
- A mano: `cd demo && npm install && node build.mjs`, poi `npx serve dist`.

Su Cloudflare: *Workers & Pages > Create > Import a repository*, **Build command** `cd demo && npm install && node build.mjs`, **Deploy command** `npx wrangler deploy` (usa `wrangler.jsonc` nella radice). Ogni push aggiorna la demo.

## Limiti noti
- Non provato su un dispositivo: le notifiche push (anche gli avvisi dello staff), la scelta di PDF e immagini dal telefono e il comportamento con rete assente vanno verificati su iPhone e Android reali. Caricamento e apertura dei file su Supabase Storage sono provati solo come regole del database, non con un progetto vero.
- Non c'è la creazione di un account socio da parte dello staff (serve una funzione sul server con chiave riservata): il socio si registra da solo con il codice palestra e lo staff lo invita da *Soci > Invita*.
- Non ci sono abbonamenti e prezzi, negozio, chat di assistenza né cambio lingua (solo italiano).
- La classifica conta solo gli allenamenti registrati con un carico: chi si allena a corpo libero o non segna i pesi non sale. Pesi inseriti a mano (anche sbagliati) contano come inseriti: non c'è un controllo antibarare, è pensata per divertirsi tra soci.
- Il PT o il titolare che apre da telefono con la tastiera aperta dentro due finestre sovrapposte (per esempio un avviso con scelta dei soci) va provato su iPhone: la sovrapposizione di finestre cambia da un sistema all'altro.
- Su Android il tasto «indietro» del telefono dal costruttore schede esce senza chiedere conferma se ci sono modifiche non salvate.
- I link ai video sono aperti nel browser/app del telefono (nessun lettore integrato).
