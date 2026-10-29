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

## Account
- Apple Developer Program (quota annuale; per l'account a nome della palestra servono i dati dell'impresa).
- Google Play Console (quota una tantum). Per i nuovi account personali Google può richiedere un periodo di test chiuso: verifica i requisiti correnti.
- Notifiche push: Apple (chiavi APNs, le gestisce EAS con l'account Apple) e Firebase per Android (`google-services.json`, caricato su EAS).

## Schede degli store
- Privacy policy online con indirizzo pubblico. Dati raccolti: nome, email, telefono, data di nascita e sesso (facoltativi), obiettivo, misure del corpo, plicometria e BIA (facoltative), anamnesi e preferenze di allenamento, documenti PDF assegnati dallo staff, allenamenti e carichi, messaggi con il PT, token per le notifiche. Dati su Supabase, regione UE. L'account si elimina dall'app (richiesto da Apple).
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
- Eseguire `supabase/setup.sql` su progetto vuoto (oppure `supabase/update_1_1.sql` su un progetto 1.0), nominare il titolare e impostare codice e nome palestra (vedi README). Controlla in *Storage* che esistano `documents` (privato) e `exercise-media` (pubblico).
- Ripetere sul progetto vero la prova dei permessi: accedi con un socio di prova e controlla che non veda le schede e le note degli altri, **né l'anamnesi** (nemmeno la propria), né documenti non assegnati a lui o segnati «solo staff».

## Collaudo su dispositivo
- Allenamento con rete assente: avvia, segna qualche serie, termina, riconnetti e verifica che arrivi una sola volta.
- Notifica di nuova scheda, di messaggio e avviso scritto dallo staff (iPhone e Android reali; sui simulatori le push non funzionano).
- Caricamento di un PDF (*Altro > Documenti*) e di un'immagine di esercizio dal telefono, poi apertura del PDF dall'app del socio; il file oltre 2 MB (PDF) o 5 MB (immagine) deve essere rifiutato con un messaggio chiaro.
- Finestre sovrapposte su iPhone: avviso con scelta dei soci, documento con scelta dei soci, nuova attività con scelta del socio.
- Tema chiaro e scuro, testo grande di sistema, tastiera aperta nei campi del costruttore schede.
