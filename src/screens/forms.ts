// Moduli compilabili dallo staff e dal socio: anamnesi e preferenze di allenamento (testi e scelte).

export type AnField = { key: string; label: string; hint?: string; long?: boolean };
export type AnSection = { key: string; title: string; icon: string; fields: AnField[] };

// Anamnesi: dati sulla salute, visibili solo allo staff. Tutti i campi sono facoltativi.
export const ANAMNESIS: AnSection[] = [
  {
    key: 'generale', title: 'Generale', icon: 'person-outline',
    fields: [
      { key: 'professione', label: 'Professione', hint: 'Per esempio impiegato, muratore, insegnante.' },
      { key: 'sedentarieta', label: 'Ore seduto al giorno', hint: 'Una stima: 2, 6, 10.' },
      { key: 'sonno', label: 'Ore di sonno per notte' },
      { key: 'fumo', label: 'Fumo', hint: 'Non fuma, ex fumatore, 10 sigarette al giorno…' },
      { key: 'stress', label: 'Livello di stress', hint: 'Basso, medio, alto.' },
      { key: 'patologie', label: 'Patologie note', long: true },
      { key: 'interventi', label: 'Interventi chirurgici e traumi', long: true },
      { key: 'farmaci', label: 'Farmaci in uso', long: true },
      { key: 'allergie', label: 'Allergie', long: true },
    ],
  },
  {
    key: 'sportiva', title: 'Sportiva', icon: 'fitness-outline',
    fields: [
      { key: 'sport_attuali', label: 'Sport praticati oggi' },
      { key: 'sport_passati', label: 'Sport praticati in passato' },
      { key: 'esperienza', label: 'Anni di esperienza in palestra' },
      { key: 'frequenza', label: 'Allenamenti a settimana oggi' },
      { key: 'infortuni', label: 'Infortuni sportivi', long: true },
      { key: 'obiettivi', label: 'Obiettivi sportivi', long: true },
    ],
  },
  {
    key: 'alimentare', title: 'Alimentare', icon: 'restaurant-outline',
    fields: [
      { key: 'pasti', label: 'Pasti al giorno' },
      { key: 'colazione', label: 'Colazione abituale' },
      { key: 'acqua', label: 'Acqua al giorno', hint: 'In litri, per esempio 1,5.' },
      { key: 'dieta', label: 'Dieta seguita', hint: 'Nessuna, vegetariana, ipocalorica…' },
      { key: 'intolleranze', label: 'Intolleranze alimentari', long: true },
      { key: 'integratori', label: 'Integratori', long: true },
      { key: 'nutrizionista', label: 'Seguito da un nutrizionista?' },
    ],
  },
  {
    key: 'fisiologica', title: 'Fisiologica', icon: 'heart-outline',
    fields: [
      { key: 'pressione', label: 'Pressione', hint: 'Per esempio 120/80.' },
      { key: 'battito', label: 'Battito a riposo', hint: 'Battiti al minuto.' },
      { key: 'visita', label: 'Visita medico-sportiva', hint: 'Data di scadenza del certificato.' },
      { key: 'cuore', label: 'Problemi cardiaci o respiratori', long: true },
      { key: 'articolazioni', label: 'Dolori, articolazioni e postura', long: true },
      { key: 'limitazioni', label: 'Esercizi da evitare', long: true },
    ],
  },
  {
    key: 'familiare', title: 'Familiare', icon: 'people-outline',
    fields: [
      { key: 'cardio', label: 'Malattie del cuore in famiglia', long: true },
      { key: 'diabete', label: 'Diabete in famiglia' },
      { key: 'pressione_alta', label: 'Pressione alta in famiglia' },
      { key: 'altro', label: 'Altre patologie in famiglia', long: true },
    ],
  },
];

export const anamnesisFilled = (data: Record<string, string> | undefined) => Object.values(data || {}).filter((v) => (v || '').trim()).length;

// Preferenze di allenamento: le può compilare anche il socio
export type Choice = [string, string];
export const PREF_ZONES: Choice[] = [['tutto', 'Tutto il corpo'], ['alto', 'Parte alta'], ['basso', 'Parte bassa'], ['addome', 'Addome'], ['gambe_glutei', 'Gambe e glutei'], ['braccia_spalle', 'Braccia e spalle'], ['schiena', 'Schiena e postura']];
export const PREF_DAYS: Choice[] = [['lun', 'Lun'], ['mar', 'Mar'], ['mer', 'Mer'], ['gio', 'Gio'], ['ven', 'Ven'], ['sab', 'Sab'], ['dom', 'Dom']];
export const PREF_SLOTS: Choice[] = [['', 'Indifferente'], ['mattina', 'Mattina'], ['pranzo', 'Pausa pranzo'], ['pomeriggio', 'Pomeriggio'], ['sera', 'Sera']];
export const PREF_MODES: Choice[] = [['', 'Indifferente'], ['solo', 'Da solo'], ['gruppo', 'In gruppo']];
export const PREF_KINDS: Choice[] = [['pesi', 'Pesi e macchinari'], ['corpo_libero', 'Corpo libero'], ['cardio', 'Cardio'], ['corsi', 'Corsi di gruppo'], ['funzionale', 'Funzionale'], ['stretching', 'Stretching e mobilità']];
export const PREF_OBSTACLES: Choice[] = [['tempo', 'Poco tempo'], ['motivazione', 'Poca motivazione'], ['dolori', 'Dolori o fastidi'], ['stanchezza', 'Stanchezza'], ['costanza', 'Difficoltà a essere costante'], ['lavoro', 'Orari di lavoro']];

export type Prefs = {
  objective?: string; zones?: string[]; days?: string[]; slot?: string; mode?: string; liked?: string[]; disliked?: string[]; obstacles?: string[]; note?: string;
};
export const choiceLabel = (list: Choice[], key: string) => list.find(([k]) => k === key)?.[1] || key;
export const prefsFilled = (p?: Prefs | null) => !!p && !!(p.objective || p.zones?.length || p.days?.length || p.slot || p.mode || p.liked?.length || p.disliked?.length || p.obstacles?.length || (p.note || '').trim());
