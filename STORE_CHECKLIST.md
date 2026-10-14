# Checklist di pubblicazione

## Prima della build
- In `app.json` cambia `name`, `ios.bundleIdentifier` e `android.package` (oggi `it.example.schedepalestra`, segnaposto). L'identificativo non si può cambiare dopo la pubblicazione.
- In `src/brand.ts` scrivi il nome vero della palestra, il link all'informativa privacy e (facoltativo) il WhatsApp della segreteria.
- Il file `.env` non viene caricato nelle build EAS: crea `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY` su EAS (expo.dev, *Environment variables*, oppure `eas env:create`).
- Comandi: `eas login`, `eas init`, `eas build --profile production --platform all`.

## Immagini
- Icona e schermata di avvio sono quelle di partenza (bilanciere con dischi colorati su nero). Con il logo della palestra sostituisci `icon.png` (1024×1024, senza trasparenza), `adaptive-icon.png` (marchio al centro su fondo trasparente), `splash-icon.png`, `favicon.png`; in `app.json` aggiorna `backgroundColor`.
- Screenshot degli store: dalla demo (`demo/`, vista telefono) o dall'app con i dati di prova.

## Account
- Apple Developer Program (quota annuale; per l'account a nome della palestra servono i dati dell'impresa).
- Google Play Console (quota una tantum). Per i nuovi account personali Google può richiedere un periodo di test chiuso: verifica i requisiti correnti.
- Notifiche push: Apple (chiavi APNs, le gestisce EAS con l'account Apple) e Firebase per Android (`google-services.json`, caricato su EAS).

## Schede degli store
- Privacy policy online con indirizzo pubblico. Dati raccolti: nome, email, telefono, obiettivo, misure del corpo (facoltative), allenamenti e carichi, messaggi con il PT, token per le notifiche. Dati su Supabase, regione UE. L'account si elimina dall'app (richiesto da Apple).
- Note riservate dei PT: se contengono informazioni sulla salute sono dati particolari (GDPR, art. 9). Decidi con la palestra se tenerle, con quale consenso e quali istruzioni dare ai PT (l'app invita a non scrivere diagnosi).
- Descrizione, parole chiave, categoria *Salute e fitness*, classificazione per età.
- Apple: nelle note per il revisore inserisci email e password di un account **socio** di prova (e, se utile, di un PT), poi compila «App Privacy». L'app è riservata ai soci: spiega nelle note che l'iscrizione richiede il codice della palestra e dai il codice di prova.
- Google: compila il modulo «Sicurezza dei dati».

## Supabase
- Progetto in **regione UE**. Piano a pagamento (Pro) per backup giornalieri e nessuna pausa per inattività; il piano gratuito va bene solo per la prova.
- Authentication > URL Configuration: *Site URL* sull'indirizzo web dell'app, altrimenti il link nell'email di conferma apre un indirizzo locale.
- Authentication > Email: «Confirm email» acceso o spento a seconda di come vuoi far entrare i soci; SMTP proprio per l'invio affidabile.
- Eseguire `supabase/setup.sql` su progetto vuoto, nominare il titolare e impostare codice e nome palestra (vedi README).
- Ripetere sul progetto vero la prova dei permessi: accedi con un socio di prova e controlla che non veda le schede e le note degli altri.

## Collaudo su dispositivo
- Allenamento con rete assente: avvia, segna qualche serie, termina, riconnetti e verifica che arrivi una sola volta.
- Notifica di nuova scheda e di messaggio (iPhone e Android reali; sui simulatori le push non funzionano).
- Tema chiaro e scuro, testo grande di sistema, tastiera aperta nei campi del costruttore schede.
