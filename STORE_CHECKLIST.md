# Checklist di pubblicazione

## Prima della build
- In `app.json` cambia `name`, `ios.bundleIdentifier` e `android.package` (oggi `it.example.ymcaprimetraining`, segnaposto). L'identificativo non si può cambiare dopo la pubblicazione.
- In `src/brand.ts` scrivi il nome vero della palestra, il link all'informativa privacy e (facoltativo) il WhatsApp della segreteria.
- Il file `.env` non viene caricato nelle build EAS: crea `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` su EAS (expo.dev, *Environment variables*, oppure `eas env:create`).
- Comandi: `eas login`, `eas init`, `eas build --profile production --platform all`.

## Immagini
- Logo, icona (triangolo rosso su nero) e schermata di avvio vengono da `assets/logo.svg`, che è una vettorializzazione di un'immagine piccola: chiedi al club il logo originale (SVG/PDF) e rilancia `scripts/gen-assets.cjs`. L'icona deve essere 1024×1024 senza trasparenza.
- Il marchio YMCA Prime Sport Club e il nome dell'app vanno usati con l'autorizzazione del club: gli account Apple e Google devono essere intestati a loro (o a chi ha il loro consenso scritto).
- Screenshot degli store: dalla demo (`demo/`, vista telefono) o dall'app con i dati di prova.

- Gli esercizi non hanno foto: i video li registra il personal trainer dal proprio dispositivo. Non c'è nessuna attribuzione di licenza da mostrare.

## Account
- Apple Developer Program (quota annuale; per l'account a nome della palestra servono i dati dell'impresa).
- Google Play Console (quota una tantum). Per i nuovi account personali Google può richiedere un periodo di test chiuso: verifica i requisiti correnti.
- Notifiche push: Apple (chiavi APNs, le gestisce EAS con l'account Apple) e Firebase per Android (`google-services.json`, caricato su EAS).

## Schede degli store
- Privacy policy online con indirizzo pubblico. Dati raccolti: nome, email, telefono, data di nascita e sesso (facoltativi), obiettivo, misure del corpo, plicometria e BIA (facoltative), anamnesi e preferenze di allenamento, documenti PDF assegnati dallo staff, allenamenti e carichi, messaggi con il PT, i video degli esercizi registrati dai personal trainer (fotocamera e microfono servono solo per quello; i video sono pubblici per chi ha l'indirizzo, quindi nelle riprese non devono comparire soci riconoscibili senza il loro consenso), token per le notifiche e, solo per chi aderisce, la partecipazione alla classifica (nome, iniziale del cognome e totale dei chili sollevati, visibili agli altri soci). Dati su Supabase, regione UE. L'account si elimina dall'app (richiesto da Apple).
- **Anamnesi, plicometria e BIA sono dati sulla salute** (GDPR, art. 9): dichiarali nella privacy policy e in «App Privacy» / «Sicurezza dei dati» (categoria *Salute e fitness*), tieni la data del consenso (l'app non salva l'anamnesi senza) e decidi con la palestra chi dello staff può leggerli e per quanto tempo si conservano. Apple chiede di spiegare nelle note per il revisore a cosa servono.
- Note riservate dei PT: se contengono informazioni sulla salute sono dati particolari (GDPR, art. 9). Decidi con la palestra se tenerle, con quale consenso e quali istruzioni dare ai PT (l'app invita a non scrivere diagnosi).
- Nome nello store: «YMCA Prime Training» (da `app.json`; i nomi con marchi altrui possono essere contestati da Apple/Google senza l'autorizzazione del titolare).
- Descrizione, parole chiave, categoria *Salute e fitness*, classificazione per età.
- Apple: nelle note per il revisore inserisci email e password di un account **socio** di prova (e, se utile, di un PT), poi compila «App Privacy». L'app è riservata ai soci: spiega nelle note che l'iscrizione richiede il codice della palestra e dai il codice di prova.
- Google: compila il modulo «Sicurezza dei dati».

## Supabase
- Progetto in **regione UE**. Piano a pagamento (Pro) per backup giornalieri e nessuna pausa per inattività; il piano gratuito va bene solo per la prova.
- Authentication > URL Configuration: *Site URL* sull'indirizzo web dell'app, altrimenti il link nell'email di conferma apre un indirizzo locale.
- Authentication > Email: «Confirm email» acceso o spento a seconda di come vuoi far entrare i soci; SMTP proprio per l'invio affidabile.
- Eseguire `supabase/setup.sql` su progetto vuoto (oppure `supabase/update_1_1.sql` su un progetto 1.0 e poi `supabase/update_1_2.sql`; da un progetto 1.1 basta `update_1_2.sql`), nominare il titolare e impostare codice e nome palestra (vedi README). Controlla in *Storage* che esistano `documents` (privato) e `exercise-media` (pubblico).
- Ripetere sul progetto vero la prova dei permessi: accedi con un socio di prova e controlla che non veda le schede e le note degli altri, **né l'anamnesi** (nemmeno la propria), né documenti non assegnati a lui o segnati «solo staff».

## Collaudo su dispositivo
- Allenamento con rete assente: avvia, segna qualche serie, termina, riconnetti e verifica che arrivi una sola volta.
- Notifica di nuova scheda, di messaggio e avviso scritto dallo staff (iPhone e Android reali; sui simulatori le push non funzionano).
- Caricamento di un PDF (*Altro > Documenti*) dal telefono e apertura dall'app del socio; il file oltre 2 MB deve essere rifiutato con un messaggio chiaro.
- Video degli esercizi, con un account PT su iPhone e su Android reali: *Registra un video* (compare la richiesta di permesso per fotocamera e microfono; se si nega, l'app lo spiega), stop automatico a 30 secondi, caricamento, riproduzione dall'account di un socio, sostituzione (il vecchio file sparisce da Storage) e *Togli*; *Scegli dalla galleria*; un video oltre 50 MB viene rifiutato con un messaggio chiaro; prova anche con rete debole.
- Finestre sovrapposte su iPhone: avviso con scelta dei soci, documento con scelta dei soci, nuova attività con scelta del socio.
- Classifica delle tonnellate: con due account socio di prova, entra con uno, registra un allenamento con i carichi e controlla che l'altro lo veda come «Nome C.» e che chi non partecipa non compaia; esci dalla classifica e verifica che sparisca. 
- iPad e schermi grandi: barra laterale (icone in verticale, nomi da 1024 px), Oggi su due colonne, finestre al centro, rotazione dello schermo durante un allenamento (non deve perdere le serie inserite).
- Tema chiaro e scuro, testo grande di sistema, tastiera aperta nei campi del costruttore schede.
