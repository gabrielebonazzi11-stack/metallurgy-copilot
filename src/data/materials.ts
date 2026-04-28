export interface MaterialInfo {
  key: string;
  name: string;
  en: string;
  uni: string;
  din: string;
  aisi: string;
  jis: string;
  iso: string;
  rm: number;
  re: number;
  hardness: string;
  treatments: string;
  weldability: string;
  machinability: string;
  uses: string;
  notes: string;
}

export const MATERIALS_DB: MaterialInfo[] = [
  {
    key: "c45",
    name: "C45",
    en: "EN 1.0503",
    uni: "C45",
    din: "C45",
    aisi: "AISI/SAE 1045",
    jis: "S45C",
    iso: "C45E / C45R",
    rm: 650,
    re: 370,
    hardness: "170-220 HB indicativi allo stato normalizzato",
    treatments: "Normalizzazione, bonifica, tempra superficiale, induzione",
    weldability: "Media/scarsa",
    machinability: "Buona",
    uses: "Alberi, perni, boccole, leve, organi mediamente sollecitati",
    notes: "Valori indicativi: verificare sempre scheda materiale e stato di fornitura.",
  },
  {
    key: "s235",
    name: "S235JR",
    en: "EN 1.0038",
    uni: "S235JR",
    din: "St37-2 storico indicativo",
    aisi: "Nessun equivalente diretto unico",
    jis: "SS400 indicativo",
    iso: "Acciaio strutturale non legato",
    rm: 360,
    re: 235,
    hardness: "100-140 HB indicativi",
    treatments: "Protezione superficiale; non tipico per trattamenti termici prestazionali",
    weldability: "Buona",
    machinability: "Discreta/buona",
    uses: "Carpenteria, staffe, piastre, telai, supporti saldati",
    notes: "Adatto a strutture semplici; meno indicato per organi molto sollecitati o soggetti a usura.",
  },
  {
    key: "42crmo4",
    name: "42CrMo4",
    en: "EN 1.7225",
    uni: "42CrMo4",
    din: "42CrMo4",
    aisi: "AISI/SAE 4140 indicativo",
    jis: "SCM440 indicativo",
    iso: "Acciaio legato da bonifica",
    rm: 950,
    re: 750,
    hardness: "28-34 HRC indicativi secondo stato",
    treatments: "Bonifica, tempra, rinvenimento, nitrurazione",
    weldability: "Limitata: richiede procedura controllata",
    machinability: "Buona se allo stato lavorabile",
    uses: "Alberi molto sollecitati, perni, ingranaggi, tiranti, organi a fatica",
    notes: "Materiale prestazionale: verificare sempre trattamento e certificato.",
  },
  {
    key: "11smnpb37",
    name: "11SMnPb37",
    en: "EN 1.0737",
    uni: "11SMnPb37",
    din: "11SMnPb37",
    aisi: "12L14 indicativo",
    jis: "SUM24L indicativo",
    iso: "Acciaio automatico al piombo",
    rm: 430,
    re: 245,
    hardness: "120-170 HB indicativi",
    treatments: "Non tipico per alte prestazioni strutturali",
    weldability: "Scarsa",
    machinability: "Molto alta",
    uses: "Minuterie tornite, raccordi, boccole leggere, particolari da barra",
    notes: "Ottimo per lavorabilità, non per saldatura o alte sollecitazioni.",
  },
  {
    key: "aisi304",
    name: "AISI 304",
    en: "EN 1.4301",
    uni: "X5CrNi18-10",
    din: "X5CrNi18-10",
    aisi: "AISI 304",
    jis: "SUS304",
    iso: "Acciaio inox austenitico",
    rm: 520,
    re: 210,
    hardness: "≤ 200 HB indicativi",
    treatments: "Non temprabile classicamente; incrudibile a freddo",
    weldability: "Buona",
    machinability: "Media, tende a incrudire",
    uses: "Ambienti corrosivi moderati, alimentare, carter, staffe inox",
    notes: "Per ambienti più aggressivi valutare AISI 316/316L.",
  },
  {
    key: "al6082",
    name: "Alluminio 6082 T6",
    en: "EN AW-6082 T6",
    uni: "EN AW-6082",
    din: "AlMgSi1 indicativo",
    aisi: "Nessun equivalente diretto",
    jis: "A6082 indicativo",
    iso: "Lega Al-Mg-Si",
    rm: 310,
    re: 260,
    hardness: "90-110 HB indicativi",
    treatments: "T6, anodizzazione, protezioni superficiali",
    weldability: "Discreta/buona con perdita locale in ZTA",
    machinability: "Buona",
    uses: "Piastre leggere, staffe, supporti, strutture leggere, componenti fresati",
    notes: "Modulo elastico circa 70000 MPa: deformazioni maggiori rispetto all'acciaio.",
  },
];
