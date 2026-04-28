import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

type Role = "utente" | "AI";

interface Message {
  role: Role;
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface UserProfile {
  name: string;
  email: string;
}

interface SavedLogin {
  email: string;
  lastAccess: string;
}

interface ChecklistForm {
  componentType: string;
  material: string;
  load: string;
  environment: string;
  machining: string;
  safetyFactor: string;
  tolerances: string;
  roughness: string;
  notes: string;
}

type ChecklistStatus = "✅ Conforme" | "⚠️ Da verificare" | "❌ Errore critico";

interface ChecklistResult {
  area: string;
  status: ChecklistStatus;
  detail: string;
  suggestion: string;
}

interface MaterialInfo {
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

interface QuickCalcForm {
  componentType: string;
  stressType: string;
  material: string;
  load: string;
  distance: string;
  diameter: string;
  safetyFactorRequired: string;
}

interface QuickCalcResult {
  title: string;
  scheme: string;
  formulas: string[];
  values: string[];
  sigma: number;
  deflection: number;
  safetyFactor: number;
  outcome: "OK" | "NON OK";
  notes: string[];
}

interface DrawingForm {
  partName: string;
  partType: string;
  material: string;
  manufacturing: string;
  mainFeatures: string;
  functionalSurfaces: string;
  holesThreads: string;
  fits: string;
  tolerances: string;
  roughness: string;
  assemblyFunction: string;
  productionQuantity: string;
}

type DrawingStatus = "✅ Necessaria" | "🟦 Consigliata" | "⚠️ Da verificare" | "❌ Mancante" | "ℹ️ Informativa";

interface DrawingResult {
  category: string;
  status: DrawingStatus;
  item: string;
  reason: string;
  suggestion: string;
}

const defaultUser: UserProfile = {
  name: "Mario Rossi",
  email: "mario.rossi@tech.it",
};

const STORAGE_KEY = "techai_ultimate_v6_login_sidebar";
const BS = String.fromCharCode(92);

const MATERIALS_DB: MaterialInfo[] = [
  { key: "c45", name: "C45", en: "EN 1.0503", uni: "C45", din: "C45", aisi: "AISI/SAE 1045", jis: "S45C", iso: "C45E / C45R", rm: 650, re: 370, hardness: "170-220 HB indicativi allo stato normalizzato", treatments: "Normalizzazione, bonifica, tempra superficiale, induzione", weldability: "Media/scarsa: richiede attenzione a preriscaldo e procedimento", machinability: "Buona", uses: "Alberi, perni, boccole, leve, organi mediamente sollecitati", notes: "Valori indicativi: verificare sempre scheda materiale e stato di fornitura." },
  { key: "s235", name: "S235JR", en: "EN 1.0038", uni: "S235JR", din: "St37-2 storico indicativo", aisi: "Nessun equivalente diretto unico", jis: "SS400 indicativo", iso: "Acciaio strutturale non legato", rm: 360, re: 235, hardness: "100-140 HB indicativi", treatments: "Protezione superficiale; non tipico per trattamenti termici prestazionali", weldability: "Buona", machinability: "Discreta/buona", uses: "Carpenteria, staffe, piastre, telai, supporti saldati", notes: "Adatto a strutture semplici; meno indicato per organi molto sollecitati o soggetti a usura." },
  { key: "42crmo4", name: "42CrMo4", en: "EN 1.7225", uni: "42CrMo4", din: "42CrMo4", aisi: "AISI/SAE 4140 indicativo", jis: "SCM440 indicativo", iso: "Acciaio legato da bonifica", rm: 950, re: 750, hardness: "28-34 HRC indicativi secondo stato", treatments: "Bonifica, tempra, rinvenimento, nitrurazione", weldability: "Limitata: richiede procedura controllata", machinability: "Buona se allo stato lavorabile", uses: "Alberi molto sollecitati, perni, ingranaggi, tiranti, organi a fatica", notes: "Materiale prestazionale: verificare sempre trattamento e certificato." },
  { key: "11smnpb37", name: "11SMnPb37", en: "EN 1.0737", uni: "11SMnPb37", din: "11SMnPb37", aisi: "12L14 indicativo", jis: "SUM24L indicativo", iso: "Acciaio automatico al piombo", rm: 430, re: 245, hardness: "120-170 HB indicativi", treatments: "Non tipico per alte prestazioni strutturali", weldability: "Scarsa", machinability: "Molto alta", uses: "Minuterie tornite, raccordi, boccole leggere, particolari da barra", notes: "Ottimo per lavorabilità, non per saldatura o alte sollecitazioni." },
  { key: "aisi304", name: "AISI 304", en: "EN 1.4301", uni: "X5CrNi18-10", din: "X5CrNi18-10", aisi: "AISI 304", jis: "SUS304", iso: "Acciaio inox austenitico", rm: 520, re: 210, hardness: "≤ 200 HB indicativi", treatments: "Non temprabile classicamente; incrudibile a freddo", weldability: "Buona", machinability: "Media, tende a incrudire", uses: "Ambienti corrosivi moderati, alimentare, carter, staffe inox", notes: "Per ambienti aggressivi valutare AISI 316/316L." },
  { key: "al6082", name: "Alluminio 6082 T6", en: "EN AW-6082 T6", uni: "EN AW-6082", din: "AlMgSi1 indicativo", aisi: "Nessun equivalente diretto", jis: "A6082 indicativo", iso: "Lega Al-Mg-Si", rm: 310, re: 260, hardness: "90-110 HB indicativi", treatments: "T6, anodizzazione, protezioni superficiali", weldability: "Discreta/buona con perdita locale in ZTA", machinability: "Buona", uses: "Piastre leggere, staffe, supporti, strutture leggere, componenti fresati", notes: "Modulo elastico circa 70000 MPa: deformazioni maggiori rispetto all'acciaio." },
  { key: "aisi316l", name: "AISI 316L", en: "EN 1.4404", uni: "X2CrNiMo17-12-2", din: "X2CrNiMo17-12-2", aisi: "AISI 316L", jis: "SUS316L", iso: "Acciaio inox austenitico al molibdeno", rm: 500, re: 200, hardness: "≤ 200 HB indicativi", treatments: "Non temprabile classicamente; incrudibile a freddo", weldability: "Molto buona", machinability: "Media, tende a incrudire", uses: "Ambienti corrosivi, chimico, alimentare, marino leggero, componenti inox saldati", notes: "Più resistente alla corrosione del 304 grazie al molibdeno. Valori indicativi." },
  { key: "aisi303", name: "AISI 303", en: "EN 1.4305", uni: "X8CrNiS18-9", din: "X8CrNiS18-9", aisi: "AISI 303", jis: "SUS303", iso: "Acciaio inox austenitico automatico", rm: 500, re: 190, hardness: "≤ 230 HB indicativi", treatments: "Non temprabile classicamente", weldability: "Scarsa rispetto ad AISI 304", machinability: "Molto buona per inox", uses: "Minuterie inox tornite, alberini, raccordi, componenti da barra", notes: "Ottimo per lavorabilità, meno adatto a saldatura e corrosione severa." },
  { key: "aisi420", name: "AISI 420", en: "EN 1.4021 / 1.4028", uni: "X20Cr13 / X30Cr13", din: "X20Cr13 / X30Cr13", aisi: "AISI 420", jis: "SUS420J1 / SUS420J2", iso: "Acciaio inox martensitico", rm: 700, re: 450, hardness: "Può superare 45 HRC dopo tempra", treatments: "Tempra e rinvenimento", weldability: "Limitata", machinability: "Discreta allo stato ricotto", uses: "Alberi inox, utensili, perni, componenti resistenti a usura moderata", notes: "Temprabile, ma meno resistente alla corrosione degli inox austenitici." },
  { key: "aisi440c", name: "AISI 440C", en: "EN 1.4125", uni: "X105CrMo17", din: "X105CrMo17", aisi: "AISI 440C", jis: "SUS440C", iso: "Acciaio inox martensitico alto carbonio", rm: 760, re: 450, hardness: "Fino a circa 58-60 HRC dopo tempra", treatments: "Tempra e rinvenimento", weldability: "Scarsa", machinability: "Difficile dopo tempra, discreta da ricotto", uses: "Cuscinetti inox, sfere, lame, componenti antiusura", notes: "Alta durezza e usura, corrosione inferiore rispetto a 304/316." },
  { key: "16mncr5", name: "16MnCr5", en: "EN 1.7131", uni: "16MnCr5", din: "16MnCr5", aisi: "AISI/SAE 5115 indicativo", jis: "SCr415 indicativo", iso: "Acciaio da cementazione", rm: 700, re: 450, hardness: "Alta durezza superficiale dopo cementazione", treatments: "Cementazione, tempra, rinvenimento", weldability: "Limitata", machinability: "Buona prima del trattamento", uses: "Ingranaggi, alberi scanalati, perni cementati, organi soggetti a usura", notes: "Usato quando serve superficie dura e cuore tenace." },
  { key: "39nicrmo3", name: "39NiCrMo3", en: "EN 1.6510", uni: "39NiCrMo3", din: "39NiCrMo3", aisi: "AISI 9840 indicativo", jis: "SNCM439 indicativo", iso: "Acciaio legato da bonifica", rm: 900, re: 700, hardness: "260-320 HB indicativi dopo bonifica", treatments: "Bonifica, tempra, rinvenimento", weldability: "Limitata", machinability: "Buona allo stato lavorabile", uses: "Alberi, perni, bielle, organi fortemente sollecitati", notes: "Buona tenacità e resistenza per organi meccanici importanti." },
  { key: "c40", name: "C40", en: "EN 1.0511", uni: "C40", din: "C40", aisi: "AISI/SAE 1040", jis: "S40C", iso: "Acciaio al carbonio da bonifica", rm: 600, re: 340, hardness: "160-210 HB indicativi", treatments: "Normalizzazione, bonifica, tempra superficiale", weldability: "Media", machinability: "Buona", uses: "Alberi, perni, leve, componenti meccanici generici", notes: "Simile al C45 ma leggermente meno resistente." },
  { key: "c60", name: "C60", en: "EN 1.0601", uni: "C60", din: "C60", aisi: "AISI/SAE 1060", jis: "S58C / S60C indicativo", iso: "Acciaio alto carbonio", rm: 750, re: 450, hardness: "Può raggiungere durezza elevata dopo tempra", treatments: "Tempra, rinvenimento, normalizzazione", weldability: "Scarsa", machinability: "Discreta", uses: "Molle semplici, lame, componenti elastici, parti antiusura", notes: "Più duro e meno saldabile degli acciai medio carbonio." },
  { key: "fe510", name: "Fe510 / S355", en: "EN 1.0577 indicativo per S355J2", uni: "Fe510 storico", din: "St52 storico", aisi: "Nessun equivalente diretto unico", jis: "SM490 indicativo", iso: "Acciaio strutturale ad alto snervamento", rm: 510, re: 355, hardness: "140-180 HB indicativi", treatments: "Zincatura, verniciatura, protezioni superficiali", weldability: "Buona", machinability: "Discreta/buona", uses: "Strutture saldate, staffe robuste, telai, supporti caricati", notes: "Più resistente di S235, molto usato in carpenteria strutturale." },
  { key: "100cr6", name: "100Cr6", en: "EN 1.3505", uni: "100Cr6", din: "100Cr6", aisi: "AISI/SAE 52100", jis: "SUJ2", iso: "Acciaio da cuscinetti", rm: 900, re: 600, hardness: "Fino a circa 60-64 HRC dopo tempra", treatments: "Tempra e rinvenimento", weldability: "Scarsa", machinability: "Discreta da ricotto, difficile temprato", uses: "Cuscinetti, rulli, sfere, piste, componenti antiusura", notes: "Ottimo per durezza e usura, non adatto a saldatura." },
  { key: "7075t6", name: "Alluminio 7075 T6", en: "EN AW-7075 T6", uni: "EN AW-7075", din: "AlZnMgCu1.5", aisi: "Nessun equivalente diretto", jis: "A7075", iso: "Lega Al-Zn-Mg-Cu", rm: 540, re: 480, hardness: "Circa 150 HB indicativi", treatments: "T6, anodizzazione controllata", weldability: "Scarsa", machinability: "Buona", uses: "Componenti leggeri ad alta resistenza, staffe speciali, parti CNC", notes: "Molto resistente ma meno saldabile e più costoso del 6082." },
  { key: "6061t6", name: "Alluminio 6061 T6", en: "EN AW-6061 T6", uni: "EN AW-6061", din: "AlMg1SiCu indicativo", aisi: "Nessun equivalente diretto", jis: "A6061", iso: "Lega Al-Mg-Si-Cu", rm: 290, re: 240, hardness: "Circa 95 HB indicativi", treatments: "T6, anodizzazione", weldability: "Buona", machinability: "Buona", uses: "Strutture leggere, supporti, piastre, telai, componenti generici", notes: "Molto comune, buon equilibrio generale." },
  { key: "ottonecw614n", name: "Ottone CW614N", en: "CW614N", uni: "CuZn39Pb3", din: "CuZn39Pb3", aisi: "Nessun equivalente AISI", jis: "C3604 indicativo", iso: "Ottone da lavorazione meccanica", rm: 430, re: 250, hardness: "100-160 HB indicativi", treatments: "Nessun trattamento termico strutturale tipico", weldability: "Scarsa", machinability: "Molto alta", uses: "Raccordi, boccole, minuterie tornite, componenti idraulici leggeri", notes: "Ottimo per tornitura, attenzione alla presenza di piombo." },
  { key: "ghisa250", name: "Ghisa EN-GJL-250", en: "EN-GJL-250", uni: "GJL-250", din: "GG25 storico", aisi: "Class 35 indicativo ASTM", jis: "FC250", iso: "Ghisa grigia lamellare", rm: 250, re: 120, hardness: "180-240 HB indicativi", treatments: "Distensione, trattamenti superficiali specifici", weldability: "Scarsa/difficile", machinability: "Buona", uses: "Basamenti, carter, supporti, corpi macchina, pulegge", notes: "Ottimo smorzamento vibrazioni, fragile rispetto agli acciai." },
  { key: "11smn37", name: "11SMn37", en: "EN 1.0736", uni: "11SMn37 - UNI EN 10087", din: "11SMn37", aisi: "1215 indicativo", jis: "SUM22/SUM23 indicativo", iso: "Acciaio automatico senza piombo", rm: 430, re: 245, hardness: "120-170 HB indicativi", treatments: "Non tipico per trattamenti strutturali elevati", weldability: "Scarsa/discreta", machinability: "Molto alta", uses: "Minuterie tornite, boccole leggere, raccordi, particolari da barra", notes: "Acciaio automatico, ottimo per lavorazione ma non per alte sollecitazioni." },
  { key: "16nicr4pb", name: "16NiCr4Pb", en: "UNI EN 10084", uni: "16NiCr4Pb", din: "16NiCr4 indicativo", aisi: "AISI 3115/3310 indicativo", jis: "SNC415 indicativo", iso: "Acciaio da cementazione al Ni-Cr con Pb", rm: 760, re: 520, hardness: "Alta dopo cementazione", treatments: "Cementazione, tempra, rinvenimento", weldability: "Limitata", machinability: "Buona grazie al piombo", uses: "Ingranaggi, perni cementati, alberi, componenti antiusura", notes: "Valori indicativi: verificare stato di fornitura e trattamento." },
  { key: "36smnpb14", name: "36SMnPb14", en: "UNI EN 10087", uni: "36SMnPb14", din: "36SMnPb14", aisi: "1144/12L14 indicativo", jis: "SUM indicativo", iso: "Acciaio automatico risolforato al piombo", rm: 650, re: 420, hardness: "170-230 HB indicativi", treatments: "Possibile bonifica leggera secondo fornitura", weldability: "Scarsa", machinability: "Molto alta", uses: "Particolari torniti, alberini, perni non saldati, minuterie meccaniche", notes: "Ottima lavorabilità; attenzione a saldabilità e fatica." },
  { key: "39nicrmo3pb", name: "39NiCrMo3Pb", en: "UNI EN 10083-3", uni: "39NiCrMo3Pb", din: "39NiCrMo3 indicativo", aisi: "9840 indicativo", jis: "SNCM439 indicativo", iso: "Acciaio legato da bonifica con Pb", rm: 900, re: 700, hardness: "260-320 HB indicativi dopo bonifica", treatments: "Bonifica, tempra, rinvenimento", weldability: "Limitata", machinability: "Buona grazie al piombo", uses: "Alberi, perni, organi fortemente sollecitati lavorati da barra", notes: "Versione con Pb orientata alla lavorabilità." },
  { key: "42crmos4", name: "42CrMoS4", en: "EN 1.7227 indicativo", uni: "42CrMoS4 - UNI EN 10083-1", din: "42CrMoS4", aisi: "4140 modificato indicativo", jis: "SCM440 indicativo", iso: "Acciaio legato da bonifica risolforato", rm: 950, re: 750, hardness: "28-34 HRC indicativi dopo bonifica", treatments: "Bonifica, tempra, rinvenimento, nitrurazione", weldability: "Limitata", machinability: "Migliorata rispetto a 42CrMo4", uses: "Alberi, perni, tiranti, componenti caricati lavorati a macchina", notes: "Buona resistenza e migliore lavorabilità per presenza di zolfo." },
  { key: "acciaio109", name: "Acciaio 10.9", en: "ISO 898-1 classe 10.9", uni: "UNI EN ISO 898-1", din: "DIN ISO 898-1", aisi: "Acciaio legato/bonificato per viti", jis: "Classe 10.9 indicativa", iso: "Classe vite 10.9", rm: 1000, re: 900, hardness: "Circa 32-39 HRC", treatments: "Bonifica", weldability: "Non consigliata", machinability: "Non rilevante come materiale generico", uses: "Viti e bulloni ad alta resistenza", notes: "Proprietà riferite alla classe di resistenza della vite, non a una sigla materiale specifica." },
  { key: "acciaio58", name: "Acciaio 5.8", en: "ISO 898-1 classe 5.8", uni: "UNI EN ISO 898-1", din: "DIN ISO 898-1", aisi: "Acciaio per viti", jis: "Classe 5.8 indicativa", iso: "Classe vite 5.8", rm: 500, re: 400, hardness: "Indicativa secondo norma vite", treatments: "Secondo produzione vite", weldability: "Non tipica", machinability: "Non rilevante come materiale generico", uses: "Viti e bulloni a media resistenza", notes: "Proprietà riferite alla classe di resistenza della vite." },
  { key: "c67ricotto", name: "Acciaio C67 ricotto", en: "EN 1.1231 indicativo", uni: "C67 ricotto - UNI EN 10132-4", din: "C67", aisi: "AISI 1065/1070 indicativo", jis: "S65C/S70C indicativo", iso: "Acciaio alto carbonio per molle/nastri", rm: 650, re: 400, hardness: "Ricotto circa 180-220 HB indicativi", treatments: "Tempra e rinvenimento", weldability: "Scarsa", machinability: "Discreta", uses: "Molle, lame, particolari elastici, nastri", notes: "Allo stato temprato può raggiungere elevata durezza." },
  { key: "dc04", name: "DC04", en: "EN 1.0338", uni: "DC04 - UNI EN 10130", din: "DC04", aisi: "Acciaio dolce da imbutitura", jis: "SPCE indicativo", iso: "Lamiera da imbutitura profonda", rm: 320, re: 170, hardness: "Bassa, tipica lamiera dolce", treatments: "Zincatura, verniciatura", weldability: "Buona", machinability: "Buona per deformazione plastica", uses: "Lamiere stampate, imbutitura, carter, componenti sottili", notes: "Materiale da formatura, non per organi molto sollecitati." },
  { key: "dd13", name: "DD13", en: "EN 1.0335", uni: "DD13 - UNI EN 10111", din: "DD13", aisi: "Acciaio dolce laminato a caldo", jis: "SPHC/SPHD indicativo", iso: "Lamiera laminata a caldo per formatura", rm: 330, re: 170, hardness: "Bassa/media", treatments: "Zincatura, verniciatura", weldability: "Buona", machinability: "Buona per piega e formatura", uses: "Lamiere piegate, carter, staffe, componenti formati", notes: "Valori indicativi dipendenti da spessore e fornitura." },
  { key: "en102702fdc", name: "EN 10270-2 FDC", en: "EN 10270-2", uni: "FDC", din: "FDC", aisi: "Acciaio per molle", jis: "SW indicativo", iso: "Filo per molle pretemprato/bonificato", rm: 1600, re: 1200, hardness: "Alta, variabile secondo diametro", treatments: "Bonifica, distensione dopo avvolgimento", weldability: "Non consigliata", machinability: "Non tipica", uses: "Molle elicoidali, molle tecniche", notes: "Proprietà fortemente dipendenti dal diametro filo." },
  { key: "2011", name: "EN AW-2011", en: "EN AW-AlCu6BiPb 2011", uni: "UNI EN 573-3", din: "AlCuBiPb", aisi: "AA 2011", jis: "A2011", iso: "Lega alluminio da lavorazione meccanica", rm: 370, re: 250, hardness: "95-120 HB indicativi", treatments: "T3/T6 secondo fornitura", weldability: "Scarsa", machinability: "Eccellente", uses: "Minuterie tornite in alluminio, componenti CNC, raccordi leggeri", notes: "Ottima lavorabilità, non ideale per saldatura." },
  { key: "7020", name: "EN AW-7020", en: "EN AW-AlZn4,5Mg1 7020", uni: "UNI EN 573-1", din: "AlZn4.5Mg1", aisi: "AA 7020", jis: "A7020 indicativo", iso: "Lega alluminio Al-Zn-Mg", rm: 360, re: 290, hardness: "100-130 HB indicativi", treatments: "T6, invecchiamento", weldability: "Buona per lega 7xxx rispetto a 7075", machinability: "Buona", uses: "Strutture saldate leggere, telai, componenti ad alta resistenza", notes: "Buona resistenza e saldabilità relativa." },
  { key: "gjl300", name: "EN-GJL-300", en: "EN-GJL-300", uni: "UNI EN 1561", din: "GG30 storico", aisi: "ASTM Class 45 indicativo", jis: "FC300", iso: "Ghisa grigia lamellare", rm: 300, re: 140, hardness: "190-250 HB indicativi", treatments: "Distensione", weldability: "Scarsa/difficile", machinability: "Buona", uses: "Basamenti, corpi macchina, pulegge, supporti", notes: "Buon smorzamento vibrazioni, fragile." },
  { key: "gjl350", name: "EN-GJL-350", en: "EN-GJL-350", uni: "UNI EN 1561", din: "GG35 storico", aisi: "ASTM Class 50 indicativo", jis: "FC350", iso: "Ghisa grigia lamellare", rm: 350, re: 160, hardness: "210-270 HB indicativi", treatments: "Distensione", weldability: "Scarsa/difficile", machinability: "Buona/discreta", uses: "Corpi macchina robusti, basamenti, supporti", notes: "Maggiore resistenza rispetto a GJL-250." },
  { key: "gjs40015", name: "EN-GJS-400-15", en: "EN-GJS-400-15", uni: "UNI EN 1563", din: "GGG40 storico", aisi: "ASTM 60-40-18 indicativo", jis: "FCD400", iso: "Ghisa sferoidale", rm: 400, re: 250, hardness: "130-180 HB indicativi", treatments: "Distensione, normalizzazione", weldability: "Limitata", machinability: "Buona", uses: "Supporti, leve, mozzi, corpi macchina, fusioni tenaci", notes: "Più tenace della ghisa grigia." },
  { key: "gjs5007", name: "EN-GJS-500-7", en: "EN-GJS-500-7", uni: "UNI EN 1563", din: "GGG50 storico", aisi: "ASTM 80-55-06 indicativo", jis: "FCD500", iso: "Ghisa sferoidale", rm: 500, re: 320, hardness: "170-230 HB indicativi", treatments: "Distensione, normalizzazione", weldability: "Limitata", machinability: "Buona/discreta", uses: "Mozzi, supporti caricati, leve, componenti fusi robusti", notes: "Maggiore resistenza, minore allungamento rispetto a GJS-400-15." },
  { key: "etg100", name: "ETG100 / 44SMn28", en: "UNI EN 10087", uni: "ETG100 (44SMn28)", din: "44SMn28", aisi: "1144 indicativo", jis: "SUM indicativo", iso: "Acciaio automatico ad alta resistenza", rm: 900, re: 700, hardness: "250-300 HB indicativi", treatments: "Stato trafilato/bonificato secondo fornitura", weldability: "Scarsa", machinability: "Molto buona", uses: "Alberi, perni, aste, particolari torniti ad alta resistenza", notes: "Usato per evitare trattamenti successivi in molti particolari da barra." },
  { key: "etg88", name: "ETG88 / 44SMn28", en: "UNI EN 10087", uni: "ETG88 (44SMn28)", din: "44SMn28", aisi: "1144 indicativo", jis: "SUM indicativo", iso: "Acciaio automatico ad alta lavorabilità", rm: 800, re: 580, hardness: "220-280 HB indicativi", treatments: "Stato trafilato/bonificato secondo fornitura", weldability: "Scarsa", machinability: "Molto buona", uses: "Alberi, perni, minuterie meccaniche resistenti", notes: "Simile a ETG100 ma con proprietà inferiori." },
  { key: "acqua", name: "Acqua", en: "H2O", uni: "Fluido", din: "Fluido", aisi: "Non applicabile", jis: "Non applicabile", iso: "Fluido", rm: 0, re: 0, hardness: "Non applicabile", treatments: "Non applicabile", weldability: "Non applicabile", machinability: "Non applicabile", uses: "Fluido di processo, raffreddamento, prove idrauliche", notes: "Materiale fluido: non usare per verifiche strutturali." },
  { key: "argento", name: "Argento", en: "Ag", uni: "Argento", din: "Argento", aisi: "Non applicabile", jis: "Argento", iso: "Metallo prezioso", rm: 170, re: 55, hardness: "25-90 HB indicativi", treatments: "Incrudimento a freddo", weldability: "Buona brasabilità", machinability: "Buona", uses: "Contatti elettrici, rivestimenti, applicazioni speciali", notes: "Valori molto variabili secondo purezza e stato." },
  { key: "oro", name: "Oro", en: "Au", uni: "Oro", din: "Oro", aisi: "Non applicabile", jis: "Oro", iso: "Metallo prezioso", rm: 120, re: 40, hardness: "Bassa, variabile con lega", treatments: "Incrudimento a freddo", weldability: "Buona", machinability: "Buona", uses: "Contatti, rivestimenti, applicazioni speciali", notes: "Valori dipendenti da purezza/lega." },
  { key: "piombo", name: "Piombo", en: "Pb", uni: "Piombo", din: "Piombo", aisi: "Non applicabile", jis: "Piombo", iso: "Metallo non ferroso", rm: 18, re: 10, hardness: "Molto bassa", treatments: "Non tipici", weldability: "Saldabile con procedimenti specifici", machinability: "Buona ma tenero", uses: "Zavorre, schermature, applicazioni speciali", notes: "Materiale tenero e pesante, non strutturale." },
  { key: "titanio", name: "Titanio puro", en: "Titanio grado 2 indicativo", uni: "Titanio puro", din: "Titanio", aisi: "Non applicabile", jis: "Titanio", iso: "Titanio puro bassa resistenza", rm: 345, re: 275, hardness: "160-200 HB indicativi", treatments: "Ricottura", weldability: "Buona in atmosfera protetta", machinability: "Difficile/media", uses: "Chimico, medicale, componenti leggeri anticorrosione", notes: "Ottima resistenza a corrosione, modulo più basso dell'acciaio." },
  { key: "ti6al4v", name: "Titanio Ti-6Al-4V", en: "Grade 5 / Ti-6Al-4V", uni: "Lega titanio alta resistenza", din: "3.7165 indicativo", aisi: "Non applicabile", jis: "Ti-6Al-4V", iso: "Titanio lega alta resistenza", rm: 900, re: 830, hardness: "Circa 30-36 HRC indicativi", treatments: "Ricottura, trattamenti specifici", weldability: "Buona in atmosfera protetta", machinability: "Difficile", uses: "Aeronautica, racing, medicale, componenti leggeri ad alta resistenza", notes: "Alta resistenza specifica, costo elevato." },
  { key: "ptfe", name: "PTFE modificato", en: "PTFE", uni: "PTFE", din: "PTFE", aisi: "Non applicabile", jis: "PTFE", iso: "Polimero fluorurato", rm: 25, re: 10, hardness: "50-65 Shore D indicativi", treatments: "Non applicabile", weldability: "Non tipica", machinability: "Buona", uses: "Guarnizioni, boccole, scorrimenti, tenute chimiche", notes: "Basso attrito, bassa resistenza meccanica rispetto ai metalli." },
  { key: "nylon66", name: "Nylon 6/6", en: "PA66", uni: "PA66", din: "PA66", aisi: "Non applicabile", jis: "PA66", iso: "Poliammide", rm: 80, re: 55, hardness: "Shore D 80-85 indicativo", treatments: "Non applicabile", weldability: "Non tipica", machinability: "Buona", uses: "Boccole, ingranaggi plastici, guide, particolari tecnici", notes: "Assorbe umidità, proprietà variabili con temperatura e condizionamento." },
  { key: "poliuretano", name: "Poliuretano", en: "PU", uni: "PU", din: "PU", aisi: "Non applicabile", jis: "PU", iso: "Elastomero poliuretanico", rm: 35, re: 10, hardness: "Variabile, Shore A/D", treatments: "Non applicabile", weldability: "Non tipica", machinability: "Limitata", uses: "Ruote, rivestimenti, tamponi, elementi elastici", notes: "Proprietà dipendenti dalla mescola e durezza." },
  { key: "gomma", name: "Gomma generica", en: "Rubber", uni: "Gomma", din: "Gomma", aisi: "Non applicabile", jis: "Gomma", iso: "Elastomero", rm: 15, re: 0, hardness: "Shore A variabile", treatments: "Vulcanizzazione", weldability: "Non applicabile", machinability: "Limitata", uses: "Guarnizioni, antivibranti, tamponi, tenute", notes: "Non usare come materiale strutturale rigido nei calcoli." },
  { key: "viton75", name: "VITON 75Sh", en: "FKM 75 Shore A", uni: "VITON 75Sh", din: "FKM", aisi: "Non applicabile", jis: "FKM", iso: "Elastomero fluorurato", rm: 12, re: 0, hardness: "75 Shore A", treatments: "Vulcanizzazione", weldability: "Non applicabile", machinability: "Limitata", uses: "O-ring, tenute resistenti a oli e temperatura", notes: "Ottima resistenza chimica; non strutturale." },
  { key: "viton90", name: "VITON 90Sh", en: "FKM 90 Shore A", uni: "VITON 90Sh", din: "FKM", aisi: "Non applicabile", jis: "FKM", iso: "Elastomero fluorurato", rm: 14, re: 0, hardness: "90 Shore A", treatments: "Vulcanizzazione", weldability: "Non applicabile", machinability: "Limitata", uses: "O-ring duri, tenute ad alta pressione", notes: "Più duro del 75Sh, non strutturale." },
  { key: "hnbr70", name: "HNBR 70Sh", en: "HNBR 70 Shore A", uni: "HNBR 70Sh", din: "HNBR", aisi: "Non applicabile", jis: "HNBR", iso: "Elastomero idrogenato", rm: 18, re: 0, hardness: "70 Shore A", treatments: "Vulcanizzazione", weldability: "Non applicabile", machinability: "Limitata", uses: "Tenute idrauliche, O-ring, guarnizioni resistenti a oli", notes: "Buona resistenza a oli e temperatura." },
  { key: "hnbr90", name: "HNBR 90Sh", en: "HNBR 90 Shore A", uni: "HNBR 90Sh", din: "HNBR", aisi: "Non applicabile", jis: "HNBR", iso: "Elastomero idrogenato", rm: 20, re: 0, hardness: "90 Shore A", treatments: "Vulcanizzazione", weldability: "Non applicabile", machinability: "Limitata", uses: "Tenute rigide, O-ring alta pressione", notes: "Maggiore durezza rispetto a HNBR 70." },
  { key: "pvc", name: "PVC non plastificato", en: "PVC-U", uni: "PVC-U", din: "PVC-U", aisi: "Non applicabile", jis: "PVC-U", iso: "Polimero termoplastico", rm: 50, re: 35, hardness: "Shore D 75-85 indicativo", treatments: "Non applicabile", weldability: "Saldabile/incollabile con tecniche specifiche", machinability: "Buona", uses: "Tubazioni, carter, piastre plastiche, componenti chimici", notes: "Fragilità e temperatura limitano l'uso strutturale." },
  { key: "uhmw", name: "UHMW PE", en: "UHMWPE", uni: "UHMW", din: "PE-UHMW", aisi: "Non applicabile", jis: "UHMWPE", iso: "Polietilene ad altissimo peso molecolare", rm: 40, re: 20, hardness: "Shore D 60-70 indicativo", treatments: "Non applicabile", weldability: "Possibile con tecniche plastiche", machinability: "Buona", uses: "Guide, pattini, scorrimenti, antiusura, alimentare", notes: "Basso attrito e buona resistenza a usura." },
  { key: "pmma", name: "Plastica PMMA", en: "PMMA", uni: "PMMA", din: "PMMA", aisi: "Non applicabile", jis: "PMMA", iso: "Polimetilmetacrilato", rm: 70, re: 45, hardness: "Dura ma fragile", treatments: "Non applicabile", weldability: "Incollaggio/saldatura plastica specifica", machinability: "Buona", uses: "Pannelli trasparenti, protezioni, display", notes: "Trasparente ma fragile agli urti." },
  { key: "pcabs", name: "Plastica PC/ABS", en: "PC/ABS", uni: "PC/ABS", din: "PC/ABS", aisi: "Non applicabile", jis: "PC/ABS", iso: "Blend policarbonato/ABS", rm: 55, re: 35, hardness: "Shore D indicativa", treatments: "Stampaggio a iniezione", weldability: "Saldatura plastica possibile", machinability: "Discreta", uses: "Carter, scocche, componenti tecnici stampati", notes: "Buon compromesso tra tenacità e stampabilità." },
  { key: "pom", name: "Resina acetalica POM", en: "POM", uni: "Resina acetalica", din: "POM", aisi: "Non applicabile", jis: "POM", iso: "Poliossimetilene", rm: 65, re: 50, hardness: "Shore D 80-85 indicativo", treatments: "Non applicabile", weldability: "Limitata", machinability: "Molto buona", uses: "Ingranaggi plastici, boccole, guide, particolari di precisione", notes: "Buona stabilità dimensionale e basso attrito." },
  { key: "cfrp", name: "CFRP", en: "Carbon Fiber Reinforced Polymer", uni: "Composito fibra di carbonio", din: "CFRP", aisi: "Non applicabile", jis: "CFRP", iso: "Composito a matrice polimerica", rm: 600, re: 0, hardness: "Non equivalente ai metalli", treatments: "Laminazione/autoclave/infusione", weldability: "Non saldabile", machinability: "Richiede utensili e aspirazione specifici", uses: "Strutture leggere ad alta rigidezza, automotive, aeronautica", notes: "Materiale anisotropo: servono dati del laminato e orientamento fibre." },
  { key: "vetro", name: "Vetro", en: "Glass", uni: "Vetro", din: "Vetro", aisi: "Non applicabile", jis: "Vetro", iso: "Materiale ceramico amorfo", rm: 45, re: 0, hardness: "Alta durezza, fragile", treatments: "Tempra vetro, stratificazione", weldability: "Non applicabile", machinability: "Difficile/specifica", uses: "Finestre, protezioni, componenti ottici", notes: "Fragile: non trattare come metallo duttile." },
  { key: "nitrurosilicio", name: "Nitruro di silicio", en: "Si3N4", uni: "Nitruro di silicio", din: "Si3N4", aisi: "Non applicabile", jis: "Si3N4", iso: "Ceramico tecnico", rm: 700, re: 0, hardness: "Molto alta", treatments: "Sinterizzazione", weldability: "Non saldabile", machinability: "Molto difficile, rettifica diamantata", uses: "Cuscinetti ceramici, utensili, componenti alta temperatura", notes: "Materiale fragile, serve progettazione ceramica dedicata." },
];

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDrawingGenerator, setShowDrawingGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState(defaultUser.email);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedLogin[]>([]);

  const [checklistForm, setChecklistForm] = useState<ChecklistForm>({
    componentType: "",
    material: "",
    load: "",
    environment: "",
    machining: "",
    safetyFactor: "",
    tolerances: "",
    roughness: "",
    notes: "",
  });
  const [checklistResults, setChecklistResults] = useState<ChecklistResult[]>([]);

  const [quickCalcForm, setQuickCalcForm] = useState<QuickCalcForm>({
    componentType: "perno",
    stressType: "flessione",
    material: "C45",
    load: "2500",
    distance: "120",
    diameter: "20",
    safetyFactorRequired: "2",
  });
  const [quickCalcResult, setQuickCalcResult] = useState<QuickCalcResult | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [drawingForm, setDrawingForm] = useState<DrawingForm>({
    partName: "",
    partType: "",
    material: "",
    manufacturing: "",
    mainFeatures: "",
    functionalSurfaces: "",
    holesThreads: "",
    fits: "",
    tolerances: "",
    roughness: "",
    assemblyFunction: "",
    productionQuantity: "",
  });
  const [drawingResults, setDrawingResults] = useState<DrawingResult[]>([]);
  const [customMaterials, setCustomMaterials] = useState<MaterialInfo[]>([]);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState<MaterialInfo>({
    key: "",
    name: "",
    en: "",
    uni: "",
    din: "",
    aisi: "",
    jis: "",
    iso: "",
    rm: 0,
    re: 0,
    hardness: "",
    treatments: "",
    weldability: "",
    machinability: "",
    uses: "",
    notes: "Materiale aggiunto dall'utente. Verificare sempre i dati prima di usarlo in calcoli reali.",
  });

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentMessages = activeChat?.messages || [];
  const isDark = theme.name === "Dark Black";
  const allMaterials = [...MATERIALS_DB, ...customMaterials];

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const p = JSON.parse(saved);
      const savedUser = p.user || defaultUser;

      setTheme(THEMES.find(t => t.name === p.themeName) || THEMES[0]);
      setInterest(p.interest || "Ingegneria Meccanica");
      setUser(savedUser);
      setLoginEmail(savedUser.email || defaultUser.email);
      setChats(p.chats || []);
      setActiveChatId(p.activeChatId || null);
      setSidebarOpen(p.sidebarOpen ?? true);
      setIsLoggedIn(p.isLoggedIn ?? false);
      setSavedLogins(p.savedLogins || []);
      setCustomMaterials(p.customMaterials || []);
    } catch {
      console.warn("Impossibile leggere il salvataggio locale.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        savedLogins,
        customMaterials,
      })
    );
  }, [theme, interest, user, chats, activeChatId, sidebarOpen, isLoggedIn, savedLogins, customMaterials]);

  useEffect(() => {
    const existingScript = document.getElementById("mathjax-script");

    if (!existingScript) {
      (window as any).MathJax = {
        tex: {
          inlineMath: [["\(", "\)"], ["$", "$"]],
          displayMath: [["\[", "\]"], ["$$", "$$"]],
        },
        svg: { fontCache: "global" },
      };

      const script = document.createElement("script");
      script.id = "mathjax-script";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => {
      const mathJax = (window as any).MathJax;
      if (mathJax?.typesetPromise) {
        mathJax.typesetPromise().catch(() => console.warn("MathJax non è riuscito a renderizzare una formula."));
      }
    }, 80);
  }, [currentMessages, loading, fileLoading, checklistResults, quickCalcResult]);

  const createChatObject = (title = "Nuova chat"): ChatSession => ({
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  });

  const createNewChat = () => {
    const newChat = createChatObject();
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setQuery("");
    setSidebarOpen(true);
  };

  const ensureActiveChat = (title = "Nuova chat") => {
    if (activeChatId) return activeChatId;

    const newChat = createChatObject(title);
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const addMessageToChat = (chatId: string, message: Message) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;

        const messages = [...chat.messages, message];
        const shouldRename = chat.title === "Nuova chat" && messages.length > 0;

        return {
          ...chat,
          messages,
          title: shouldRename ? messages[0].text.slice(0, 32) + "..." : chat.title,
        };
      })
    );
  };

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev =>
      prev.map(chat => (chat.id === chatId ? { ...chat, messages } : chat))
    );
  };

  const handleLogin = () => {
    const cleanedEmail = loginEmail.trim();
    const cleanedPassword = loginPassword.trim();

    if (!cleanedEmail || !cleanedPassword) {
      setLoginError("Inserisci email e password per accedere.");
      return;
    }

    if (!cleanedEmail.includes("@")) {
      setLoginError("Inserisci un indirizzo email valido.");
      return;
    }

    setUser(prev => ({ ...prev, email: cleanedEmail }));
    setSavedLogins(prev => {
      const withoutDuplicate = prev.filter(item => item.email !== cleanedEmail);
      return [{ email: cleanedEmail, lastAccess: new Date().toISOString() }, ...withoutDuplicate].slice(0, 5);
    });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
    setLoginPassword("");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLoginPanel(true);
  };

  const handleGuestLogin = () => {
    setUser({ name: "Ospite", email: "ospite@techai.local" });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
    setLoginPassword("");
  };

  const handleProviderLogin = (provider: "Google" | "telefono") => {
    const providerEmail = provider === "Google" ? "google.user@techai.local" : "telefono@techai.local";
    setUser({ name: provider === "Google" ? "Utente Google" : "Utente Telefono", email: providerEmail });
    setSavedLogins(prev => {
      const withoutDuplicate = prev.filter(item => item.email !== providerEmail);
      return [{ email: providerEmail, lastAccess: new Date().toISOString() }, ...withoutDuplicate].slice(0, 5);
    });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
  };

  const useSavedLogin = (email: string) => {
    setLoginEmail(email);
    setLoginPassword("demo123");
    setLoginError("");
  };

  const openLoginInsideApp = () => {
    setShowLoginPanel(true);
    setShowSettings(false);
    setShowChecklist(false);
    setShowQuickCalc(false);
    setShowMaterials(false);
    setShowDrawingGenerator(false);
    setLoginError("");
  };

  const updateChecklistField = (field: keyof ChecklistForm, value: string) => {
    setChecklistForm(prev => ({ ...prev, [field]: value }));
  };

  const updateQuickCalcField = (field: keyof QuickCalcForm, value: string) => {
    setQuickCalcForm(prev => ({ ...prev, [field]: value }));
  };

  const updateDrawingField = (field: keyof DrawingForm, value: string) => {
    setDrawingForm(prev => ({ ...prev, [field]: value }));
  };

  const runDrawingGenerator = () => {
    const f = drawingForm;
    const text = `${f.partName} ${f.partType} ${f.material} ${f.manufacturing} ${f.mainFeatures} ${f.functionalSurfaces} ${f.holesThreads} ${f.fits} ${f.tolerances} ${f.roughness} ${f.assemblyFunction}`.toLowerCase();
    const partType = f.partType.toLowerCase();
    const features = f.mainFeatures.toLowerCase();
    const holes = f.holesThreads.toLowerCase();
    const fits = f.fits.toLowerCase();
    const tolerances = f.tolerances.toLowerCase();
    const roughness = f.roughness.toLowerCase();
    const manufacturing = f.manufacturing.toLowerCase();

    const hasHoles = holes.includes("foro") || holes.includes("m") || holes.includes("filett") || text.includes("lamatura") || text.includes("svasatura");
    const hasShaft = partType.includes("albero") || partType.includes("perno") || text.includes("sede cuscinetto") || text.includes("linguetta");
    const hasPlate = partType.includes("piastra") || partType.includes("staffa") || partType.includes("flangia");
    const hasWeld = manufacturing.includes("sald") || text.includes("sald");
    const hasBearing = text.includes("cuscinetto");
    const hasThread = holes.includes("m") || holes.includes("filett");
    const hasSlot = text.includes("asola") || text.includes("cava") || text.includes("linguetta");

    const results: DrawingResult[] = [];

    results.push({
      category: "Viste",
      status: "✅ Necessaria",
      item: "Vista principale/frontale",
      reason: "Serve per rappresentare la forma più riconoscibile e la maggior parte delle quote principali del pezzo.",
      suggestion: "Scegli come vista frontale quella che mostra meglio funzione, fori principali, ingombri e simmetrie.",
    });

    results.push({
      category: "Viste",
      status: hasShaft ? "✅ Necessaria" : "🟦 Consigliata",
      item: hasShaft ? "Vista longitudinale dell'albero/perno" : "Vista laterale o superiore",
      reason: hasShaft ? "Per alberi e perni è essenziale mostrare diametri, spallamenti, gole, smussi e lunghezze." : "Una seconda vista evita ambiguità su spessori, profondità e posizione dei dettagli.",
      suggestion: hasShaft ? "Quota diametri e lunghezze in sequenza, aggiungendo assi tratto-punto e dettagli su gole/cave." : "Aggiungi una vista laterale/superiore se la geometria non è completamente definita dalla vista frontale.",
    });

    results.push({
      category: "Sezioni",
      status: hasHoles || hasBearing || hasSlot ? "🟦 Consigliata" : "ℹ️ Informativa",
      item: hasHoles || hasBearing || hasSlot ? "Sezione A-A" : "Sezione non obbligatoria salvo geometrie interne",
      reason: hasHoles || hasBearing || hasSlot ? "Fori, sedi, cave, lamature o geometrie interne sono più chiare in sezione." : "Se il pezzo è pieno e semplice, la sezione può non essere necessaria.",
      suggestion: hasBearing ? "Usa una sezione passante per la sede cuscinetto e quota diametro, profondità, smusso e rugosità." : hasHoles ? "Usa una sezione passante per fori ciechi, filetti, lamature o svasature." : "Valuta una sezione solo se ci sono dettagli nascosti importanti.",
    });

    results.push({
      category: "Quote funzionali",
      status: f.functionalSurfaces.trim() ? "⚠️ Da verificare" : "❌ Mancante",
      item: "Superfici funzionali e quote critiche",
      reason: f.functionalSurfaces.trim() ? `Superfici indicate: ${f.functionalSurfaces}.` : "Non sono state indicate superfici funzionali: rischio di quotare solo gli ingombri.",
      suggestion: f.functionalSurfaces.trim() ? "Assicurati che ogni superficie funzionale abbia quota, tolleranza e rugosità adeguata." : "Indica sedi, appoggi, superfici di scorrimento, battute, fori di centraggio e riferimenti di montaggio.",
    });

    results.push({
      category: "Fori e filetti",
      status: hasHoles ? "⚠️ Da verificare" : "ℹ️ Informativa",
      item: hasThread ? "Filetti e maschiature" : "Fori, lamature e svasature",
      reason: hasHoles ? `Dettagli indicati: ${f.holesThreads}.` : "Non sono stati indicati fori o filetti.",
      suggestion: hasThread ? "Per ogni filetto indica M, passo se non standard, profondità utile, eventuale preforo e tolleranza se richiesta." : hasHoles ? "Per ogni foro indica diametro, profondità, posizione, eventuale tolleranza H7/H13, lamatura o svasatura." : "Nessuna azione se il pezzo non contiene fori.",
    });

    results.push({
      category: "Tolleranze",
      status: tolerances || fits ? "⚠️ Da verificare" : "❌ Mancante",
      item: "Tolleranze dimensionali/geometriche",
      reason: tolerances || fits ? `Tolleranze/accoppiamenti indicati: ${f.tolerances || f.fits}.` : "Non risultano tolleranze specifiche: rischio tavola non producibile o non controllabile.",
      suggestion: hasBearing ? "Per sedi cuscinetto valuta tolleranze tipo H7, h6, k6, m6 secondo montaggio. Aggiungi concentricità/coassialità se necessaria." : hasSlot ? "Per cave e asole valuta larghezza tollerata, posizione e rugosità se sono funzionali." : "Aggiungi tolleranze sulle quote funzionali; lascia le quote non critiche alla tolleranza generale del cartiglio.",
    });

    results.push({
      category: "Rugosità",
      status: roughness ? "⚠️ Da verificare" : "❌ Mancante",
      item: "Rugosità generale e specifica",
      reason: roughness ? `Rugosità indicata: ${f.roughness}.` : "Non è stata indicata rugosità generale o specifica.",
      suggestion: hasBearing ? "Per sede cuscinetto consiglia Ra 1.6 o migliore secondo applicazione; per superfici generiche Ra 3.2/6.3." : text.includes("scorr") ? "Per superfici di scorrimento valuta Ra 0.8–1.6; per superfici non funzionali usa rugosità generale." : "Inserisci rugosità generale nel cartiglio e rugosità specifiche sulle superfici funzionali.",
    });

    results.push({
      category: "Quote ridondanti",
      status: "⚠️ Da verificare",
      item: "Controllo quote sovrabbondanti",
      reason: "La checklist non vede la tavola grafica, ma segnala il rischio tipico di quote duplicate o chiuse in catena.",
      suggestion: "Evita catene di quote chiuse. Usa quote funzionali da riferimenti/datum e lascia le quote derivate non quotate.",
    });

    results.push({
      category: "Cartiglio e note",
      status: f.material.trim() && f.manufacturing.trim() ? "⚠️ Da verificare" : "❌ Mancante",
      item: "Note generali di tavola",
      reason: f.material.trim() && f.manufacturing.trim() ? "Materiale e lavorazione sono presenti, ma vanno riportati in modo coerente in tavola." : "Mancano informazioni base per il cartiglio o le note di lavorazione.",
      suggestion: `Metti in cartiglio/materiale: ${f.material || "materiale da definire"}. Note consigliate: sbavare gli spigoli, smussi non quotati, trattamento superficiale, tolleranze generali ISO 2768 se applicabile.`,
    });

    results.push({
      category: "Produzione",
      status: manufacturing ? "⚠️ Da verificare" : "❌ Mancante",
      item: "Metodo produttivo e quantità",
      reason: manufacturing ? `Lavorazione indicata: ${f.manufacturing}. Quantità: ${f.productionQuantity || "non indicata"}.` : "Metodo produttivo non indicato.",
      suggestion: hasWeld ? "Per pezzi saldati aggiungi simboli di saldatura, preparazioni lembi, controlli e distensione se richiesta." : manufacturing.includes("rett") ? "Se è prevista rettifica, quota tolleranze e rugosità coerenti sulle superfici rettificate." : "Specifica se il pezzo è tornito, fresato, tagliato laser, piegato, saldato, fuso o stampato.",
    });

    if (hasPlate) {
      results.push({
        category: "Riferimenti",
        status: "🟦 Consigliata",
        item: "Datum su superficie di appoggio",
        reason: "Per piastre, staffe e flange conviene definire una superficie base per posizione fori e controlli geometrici.",
        suggestion: "Imposta datum A sulla superficie di appoggio principale; datum B/C su lati o fori di riferimento.",
      });
    }

    setDrawingResults(results);
  };

  const normalizeMaterialKey = (value: string) => value.toLowerCase().replaceAll(" ", "").replaceAll("-", "");

  const findMaterial = (value: string) => {
    const key = normalizeMaterialKey(value);
    return allMaterials.find(m =>
      normalizeMaterialKey(m.key) === key ||
      normalizeMaterialKey(m.name) === key ||
      normalizeMaterialKey(m.en) === key ||
      normalizeMaterialKey(m.din) === key ||
      normalizeMaterialKey(m.aisi) === key ||
      normalizeMaterialKey(m.jis) === key
    );
  };

  const updateNewMaterialField = (field: keyof MaterialInfo, value: string) => {
    setNewMaterial(prev => ({
      ...prev,
      [field]: field === "rm" || field === "re" ? Number(value.replace(",", ".")) || 0 : value,
    }));
  };

  const addCustomMaterial = () => {
    const materialName = newMaterial.name.trim();

    if (!materialName) {
      alert("Inserisci almeno il nome del materiale.");
      return;
    }

    const generatedKey = normalizeMaterialKey(newMaterial.key || materialName);
    const exists = allMaterials.some(m => normalizeMaterialKey(m.key) === generatedKey || normalizeMaterialKey(m.name) === normalizeMaterialKey(materialName));

    if (exists) {
      alert("Questo materiale sembra già presente nella libreria.");
      return;
    }

    const materialToSave: MaterialInfo = {
      ...newMaterial,
      key: generatedKey,
      name: materialName,
      en: newMaterial.en || "Non specificato",
      uni: newMaterial.uni || "Non specificato",
      din: newMaterial.din || "Non specificato",
      aisi: newMaterial.aisi || "Non specificato",
      jis: newMaterial.jis || "Non specificato",
      iso: newMaterial.iso || "Non specificato",
      hardness: newMaterial.hardness || "Non specificato",
      treatments: newMaterial.treatments || "Non specificato",
      weldability: newMaterial.weldability || "Non specificato",
      machinability: newMaterial.machinability || "Non specificato",
      uses: newMaterial.uses || "Non specificato",
      notes: newMaterial.notes || "Materiale aggiunto dall'utente. Verificare sempre i dati prima di usarlo in calcoli reali.",
    };

    setCustomMaterials(prev => [...prev, materialToSave]);
    setNewMaterial({ key: "", name: "", en: "", uni: "", din: "", aisi: "", jis: "", iso: "", rm: 0, re: 0, hardness: "", treatments: "", weldability: "", machinability: "", uses: "", notes: "Materiale aggiunto dall'utente. Verificare sempre i dati prima di usarlo in calcoli reali." });
    setShowAddMaterial(false);
    setMaterialSearch(materialName);
  };

  const deleteCustomMaterial = (key: string) => {
    setCustomMaterials(prev => prev.filter(material => material.key !== key));
  };

  const getYoungModulus = (material?: MaterialInfo) => {
    if (!material) return 210000;
    if (material.name.toLowerCase().includes("alluminio")) return 70000;
    return 210000;
  };

  const runQuickCalc = () => {
    const F = Number(quickCalcForm.load.replace(",", "."));
    const L = Number(quickCalcForm.distance.replace(",", "."));
    const d = Number(quickCalcForm.diameter.replace(",", "."));
    const nRequired = Number(quickCalcForm.safetyFactorRequired.replace(",", ".")) || 2;
    const material = findMaterial(quickCalcForm.material);
    const Re = material?.re || 300;
    const E = getYoungModulus(material);

    if (!F || !L || !d || F <= 0 || L <= 0 || d <= 0) {
      setQuickCalcResult({
        title: "Dati insufficienti",
        scheme: "Inserisci carico, distanza e diametro numerici e maggiori di zero.",
        formulas: [],
        values: [],
        sigma: 0,
        deflection: 0,
        safetyFactor: 0,
        outcome: "NON OK",
        notes: ["Controlla i dati di input: usa N per il carico, mm per lunghezza e diametro."],
      });
      return;
    }

    const A = Math.PI * d * d / 4;
    const I = Math.PI * Math.pow(d, 4) / 64;
    const Wf = Math.PI * Math.pow(d, 3) / 32;
    const Wt = Math.PI * Math.pow(d, 3) / 16;
    const M = F * L;

    let sigma = 0;
    let deflection = 0;
    let formulas: string[] = [];
    let scheme = "";
    let title = "";
    let notes: string[] = [];

    if (quickCalcForm.stressType === "flessione") {
      sigma = M / Wf;
      deflection = F * Math.pow(L, 3) / (3 * E * I);
      title = "Verifica rapida a flessione";
      scheme = "Schema statico semplificato: perno/albero assimilato a mensola con carico concentrato all'estremità.";
      formulas = [
        "$$ M_f = F " + BS + "cdot L $$",
        "$$ W_f = " + BS + "frac{" + BS + "pi " + BS + "cdot d^3}{32} $$",
        "$$ " + BS + "sigma_f = " + BS + "frac{M_f}{W_f} $$",
        "$$ f = " + BS + "frac{F " + BS + "cdot L^3}{3 " + BS + "cdot E " + BS + "cdot I} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "sigma_f} $$",
      ];
      notes = ["Modello conservativo per mensola semplice.", "Per un perno reale controllare anche taglio, pressione specifica e condizioni di vincolo."];
    } else if (quickCalcForm.stressType === "taglio") {
      sigma = (4 * F) / (3 * A);
      title = "Verifica rapida a taglio";
      scheme = "Schema statico semplificato: sezione circolare soggetta a taglio trasversale.";
      formulas = [
        "$$ A = " + BS + "frac{" + BS + "pi " + BS + "cdot d^2}{4} $$",
        "$$ " + BS + "tau_{max} " + BS + "approx " + BS + "frac{4F}{3A} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "tau_{max}} $$",
      ];
      notes = ["Per taglio su spine o perni verificare se il taglio è singolo o doppio.", "Per criteri più corretti usare tensione ammissibile a taglio o Von Mises."];
    } else if (quickCalcForm.stressType === "torsione") {
      sigma = M / Wt;
      title = "Verifica rapida a torsione";
      scheme = "Schema statico semplificato: albero circolare pieno soggetto a momento torcente.";
      formulas = [
        "$$ M_t = F " + BS + "cdot L $$",
        "$$ W_t = " + BS + "frac{" + BS + "pi " + BS + "cdot d^3}{16} $$",
        "$$ " + BS + "tau_t = " + BS + "frac{M_t}{W_t} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "tau_t} $$",
      ];
      notes = ["Il braccio inserito viene usato come leva per generare il momento torcente.", "Per alberi reali verificare anche fatica, cave linguetta e concentrazioni di tensione."];
    } else {
      sigma = F / A;
      deflection = F * L / (E * A);
      title = "Verifica rapida a trazione/compressione";
      scheme = "Schema statico semplificato: barra circolare caricata assialmente.";
      formulas = [
        "$$ A = " + BS + "frac{" + BS + "pi " + BS + "cdot d^2}{4} $$",
        "$$ " + BS + "sigma = " + BS + "frac{F}{A} $$",
        "$$ " + BS + "Delta L = " + BS + "frac{F " + BS + "cdot L}{E " + BS + "cdot A} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "sigma} $$",
      ];
      notes = ["Per compressione controllare anche instabilità di punta se il pezzo è snello."];
    }

    const n = Re / sigma;
    const outcome = n >= nRequired ? "OK" : "NON OK";
    const values = [
      `Materiale usato: ${material ? `${material.name} (${material.en})` : `${quickCalcForm.material} non trovato: usato Re indicativo = ${Re} MPa`}`,
      `Carico: F = ${F.toFixed(2)} N`,
      `Distanza/braccio: L = ${L.toFixed(2)} mm`,
      `Diametro: d = ${d.toFixed(2)} mm`,
      `Momento indicativo: M = ${M.toFixed(2)} Nmm`,
      `Tensione calcolata: ${sigma.toFixed(2)} MPa`,
      `Deformazione indicativa: ${deflection > 0 ? deflection.toFixed(4) + " mm" : "non calcolata per questo modello"}`,
      `Coefficiente di sicurezza: n = ${n.toFixed(2)}`,
      `Re materiale indicativo: ${Re} MPa`,
    ];

    setQuickCalcResult({ title, scheme, formulas, values, sigma, deflection, safetyFactor: n, outcome, notes });
  };

  const runProjectChecklist = () => {
    const f = checklistForm;
    const material = f.material.trim().toLowerCase();
    const loadValue = Number(String(f.load).replace(",", "."));
    const safetyValue = Number(String(f.safetyFactor).replace(",", "."));
    const environment = f.environment.trim().toLowerCase();
    const tolerances = f.tolerances.trim().toLowerCase();
    const roughness = f.roughness.trim().toLowerCase();
    const machining = f.machining.trim().toLowerCase();

    const results: ChecklistResult[] = [];

    results.push({
      area: "Materiale selezionato",
      status: material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: material
        ? `Materiale indicato: ${f.material}. Va confrontato con carico, ambiente e lavorazione.`
        : "Materiale non indicato: non è possibile valutare resistenza, trattamenti e lavorabilità.",
      suggestion: material
        ? "Controlla Rm, Re/Rp0.2, durezza, saldabilità e disponibilità commerciale. Per acciai comuni verifica anche la sigla EN/UNI/DIN."
        : "Inserisci una sigla materiale, ad esempio C45, S235, 42CrMo4, 11SMnPb37, AISI 304.",
    });

    results.push({
      area: "Coerenza carico/materiale",
      status: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0 ? "❌ Errore critico" : material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0
        ? "Carico non indicato o non numerico."
        : `Carico indicativo inserito: ${f.load} N. La sola checklist non sostituisce la verifica tensionale.`,
      suggestion: "Esegui almeno una verifica rapida a trazione/flessione/taglio/torsione in base al componente. Indica anche braccio, sezione resistente e tipo di sollecitazione.",
    });

    results.push({
      area: "Ambiente d'uso",
      status: environment ? "⚠️ Da verificare" : "⚠️ Da verificare",
      detail: environment
        ? `Ambiente indicato: ${f.environment}.`
        : "Ambiente non specificato: corrosione, temperatura, umidità e polveri possono cambiare la scelta del materiale.",
      suggestion: environment.includes("corros") || environment.includes("umid") || environment.includes("esterno")
        ? "Valuta inox, zincatura, brunitura, verniciatura o trattamento superficiale. Specifica sempre la protezione in tavola."
        : "Specifica se il pezzo lavora a secco, in esterno, in olio, in ambiente corrosivo o ad alta temperatura.",
    });

    results.push({
      area: "Trattamenti termici/superficiali",
      status: material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: material
        ? "La necessità di trattamenti dipende da usura, fatica, durezza superficiale e accoppiamenti."
        : "Senza materiale non si possono proporre trattamenti compatibili.",
      suggestion: material.includes("c45")
        ? "Per C45 valuta bonifica o tempra superficiale se servono resistenza e durezza."
        : material.includes("42crmo4")
          ? "Per 42CrMo4 valuta bonifica se servono alte prestazioni meccaniche."
          : "Aggiungi una nota se sono richiesti bonifica, cementazione, nitrurazione, tempra, zincatura o anodizzazione.",
    });

    results.push({
      area: "Tensioni ammissibili",
      status: material && f.load.trim() ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: "La tensione ammissibile non è stata calcolata automaticamente in questa prima checklist.",
      suggestion: "Ricava σamm = Re/n oppure usa criteri a fatica se il carico è variabile. Inserisci sempre il coefficiente di sicurezza usato.",
    });

    results.push({
      area: "Coefficiente di sicurezza",
      status: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "❌ Errore critico" : safetyValue < 1.5 ? "❌ Errore critico" : safetyValue < 2 ? "⚠️ Da verificare" : "✅ Conforme",
      detail: !f.safetyFactor.trim() || Number.isNaN(safetyValue)
        ? "Coefficiente di sicurezza non indicato."
        : `Coefficiente di sicurezza indicato: n = ${f.safetyFactor}.`,
      suggestion: !f.safetyFactor.trim() || Number.isNaN(safetyValue)
        ? "Inserisci n. Per componenti statici spesso si parte da valori indicativi ≥ 2, salvo norme specifiche."
        : safetyValue < 1.5
          ? "Valore molto basso: giustificalo con norma, prove o calcolo accurato."
          : "Verifica che il coefficiente sia coerente con incertezza del carico, conseguenze del cedimento e materiale.",
    });

    results.push({
      area: "Tolleranze dimensionali",
      status: tolerances ? "✅ Conforme" : "⚠️ Da verificare",
      detail: tolerances ? `Tolleranze indicate: ${f.tolerances}.` : "Non risultano tolleranze o accoppiamenti indicati.",
      suggestion: tolerances
        ? "Controlla che siano presenti soprattutto sulle quote funzionali, sedi cuscinetto, fori di centraggio, spine, alberi e accoppiamenti."
        : "Aggiungi tolleranze sulle quote funzionali. Esempi: Ø10 H7, Ø20 h6, posizione fori, planarità superfici di appoggio.",
    });

    results.push({
      area: "Raggi e smussi",
      status: f.notes.toLowerCase().includes("smus") || f.notes.toLowerCase().includes("raggio") || f.notes.toLowerCase().includes("raccord") ? "✅ Conforme" : "⚠️ Da verificare",
      detail: "La checklist cerca indicazioni testuali su smussi/raccordi nelle note.",
      suggestion: "Specifica smussi generali, ad esempio 'Smussi non quotati 0.5x45°', e raggi di raccordo dove servono per fatica o lavorazione.",
    });

    results.push({
      area: "Fori e filetti normalizzati",
      status: f.notes.toLowerCase().includes("m") || f.notes.toLowerCase().includes("foro") || f.notes.toLowerCase().includes("filett") ? "⚠️ Da verificare" : "⚠️ Da verificare",
      detail: "Controllare sempre che fori, maschiature e lamature siano quotati secondo norma.",
      suggestion: "Per viti indica M, passo se non grosso, profondità utile, lamatura/svasatura e classe vite se presente in distinta.",
    });

    results.push({
      area: "Rugosità",
      status: roughness ? "✅ Conforme" : "⚠️ Da verificare",
      detail: roughness ? `Rugosità indicata: ${f.roughness}.` : "Rugosità non indicata.",
      suggestion: roughness
        ? "Verifica che la rugosità sia assegnata alle superfici funzionali e non solo come valore generale."
        : "Aggiungi rugosità generale e rugosità specifiche per sedi, scorrimenti, appoggi, tenute e accoppiamenti.",
    });

    results.push({
      area: "Note di lavorazione",
      status: machining || f.notes.trim() ? "⚠️ Da verificare" : "⚠️ Da verificare",
      detail: machining ? `Lavorazione indicata: ${f.machining}.` : "Lavorazione non specificata.",
      suggestion: "Indica se il pezzo è tornito, fresato, saldato, piegato, tagliato laser, rettificato o trattato. Aggiungi note per sbavatura e protezione superficiale.",
    });

    setChecklistResults(results);
  };

  const isSupportedTextFile = (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type;

    return (
      type.startsWith("text/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".json") ||
      name.endsWith(".xml") ||
      name.endsWith(".html") ||
      name.endsWith(".css") ||
      name.endsWith(".js") ||
      name.endsWith(".jsx") ||
      name.endsWith(".ts") ||
      name.endsWith(".tsx") ||
      name.endsWith(".py") ||
      name.endsWith(".java") ||
      name.endsWith(".cpp") ||
      name.endsWith(".c") ||
      name.endsWith(".h") ||
      name.endsWith(".sql") ||
      name.endsWith(".yaml") ||
      name.endsWith(".yml")
    );
  };

  const readTextFile = async (file: File) => {
    if (!isSupportedTextFile(file)) {
      throw new Error(
        "Formato non leggibile senza librerie. Questa versione supporta solo file testuali: TXT, CSV, JSON, MD, XML, HTML, CSS, JS, TS, TSX e simili."
      );
    }

    return await file.text();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || fileLoading) return;

    const chatId = ensureActiveChat(`File: ${file.name}`);
    setFileLoading(true);

    try {
      const extractedText = await readTextFile(file);
      const cleanedText = extractedText.trim();

      addMessageToChat(chatId, {
        role: "utente",
        text:
          `📎 File caricato: ${file.name}\n` +
          `Tipo: ${file.type || "sconosciuto"}\n` +
          `Dimensione: ${(file.size / 1024).toFixed(1)} KB\n\n` +
          `CONTENUTO DEL FILE:\n${cleanedText || "Il file risulta vuoto."}`,
      });

      setQuery(`Analizza il file "${file.name}" e fammi un riassunto chiaro dei punti principali.`);
    } catch (error: any) {
      addMessageToChat(chatId, {
        role: "AI",
        text: error?.message || "Non sono riuscito a leggere il file.",
      });
    } finally {
      setFileLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  const callAI = async () => {
    if (!query.trim() || loading) return;

    if (!isLoggedIn) {
      setShowLoginPanel(true);
      setLoginError("Effettua il login prima di usare TechAI.");
      return;
    }

    const text = query;
    const chatId = ensureActiveChat(text.slice(0, 32) + "...");
    setQuery("");
    setLoading(true);

    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    const updatedMessages: Message[] = [...oldMessages, { role: "utente", text }];

    replaceMessagesInChat(chatId, updatedMessages);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content:
                `Sei TechAI. Utente: ${user.name}. Focus: ${interest}. ` +
                "Rispondi in modo chiaro, tecnico e ordinato. Quando scrivi formule, calcoli o passaggi matematici usa LaTeX leggibile: frazioni con \frac{}, moltiplicazioni con \cdot, radici con \sqrt{}, potenze con ^{}. Per formule importanti usa blocchi \[ ... \]. Evita formule brutte scritte con / e * quando puoi. Se l'utente carica un file, analizza il contenuto testuale presente in chat.",
            },
            ...updatedMessages.map(m => ({
              role: m.role === "utente" ? "user" : "assistant",
              content: m.text,
            })),
          ],
        }),
      });

      const data = await res.json();
      const aiText = data?.choices?.[0]?.message?.content || "Errore nella risposta AI.";

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
    } catch {
      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        { role: "AI", text: "Errore API. Controlla chiave API, connessione o limiti del modello." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        savedLogins,
        customMaterials,
      })
    );
    setShowSettings(false);
  };

  const iconBtn = (icon: string, label: string, onClick: () => void, active = false) => (
    <button
      style={{
        ...s.iconBtn,
        width: sidebarOpen ? "100%" : 44,
        height: 44,
        justifyContent: sidebarOpen ? "flex-start" : "center",
        padding: sidebarOpen ? "0 12px" : 0,
        backgroundColor: active ? theme.surface : "transparent",
        color: active ? theme.primary : theme.text,
        border: `1px solid ${active ? theme.border || theme.surface : "transparent"}`,
      }}
      onClick={onClick}
      title={label}
    >
      <span style={s.icon}>{icon}</span>
      {sidebarOpen && <span style={s.iconLabel}>{label}</span>}
    </button>
  );

  const formatText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, partIndex) => {
      if (!part) return null;

      const trimmedPart = part.trim();

      if (trimmedPart.startsWith("**") && trimmedPart.endsWith("**")) {
        return (
          <div
            key={`title-${partIndex}`}
            style={{
              ...s.messageTitle,
              color: theme.primary,
              borderBottom: `1px solid ${theme.border || theme.surface}`,
            }}
          >
            {trimmedPart.replace(/\*\*/g, "")}
          </div>
        );
      }

      return part.split("\n").map((line, i) => {
        const trimmed = line.trim();
        const key = `line-${partIndex}-${i}`;

        if (!trimmed) {
          return <div key={key} style={{ height: 8 }} />;
        }

        if (trimmed.startsWith("* ") || trimmed.startsWith("+ ") || trimmed.startsWith("- ")) {
          return (
            <div key={key} style={s.messageListItem}>
              <span style={{ color: theme.primary, fontWeight: 900 }}>•</span>
              <span>{trimmed.slice(2)}</span>
            </div>
          );
        }

        return (
          <div key={key} style={s.messageLine}>
            {line}
          </div>
        );
      });
    });
  };

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.searchBar, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <button
        style={{ ...s.fileBtn, color: theme.primary }}
        onClick={() => fileInputRef.current?.click()}
        title="Carica file testuale"
        disabled={fileLoading || !isLoggedIn}
      >
        {fileLoading ? (
          "…"
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21.44 11.05 12.2 20.29a6 6 0 0 1-8.49-8.49l9.24-9.24a4 4 0 0 1 5.66 5.66L9.64 17.2a2 2 0 0 1-2.83-2.83l8.49-8.49" />
          </svg>
        )}
      </button>

      <textarea
        style={{ ...s.textarea, color: theme.text }}
        rows={1}
        value={query}
        placeholder={isLoggedIn ? placeholder : "Effettua il login per iniziare a usare TechAI..."}
        onChange={e => {
          setQuery(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
        }}
        onFocus={() => {
          if (!isLoggedIn) setShowLoginPanel(true);
        }}
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
      />

      <button
        style={{ ...s.sendBtn, color: theme.primary }}
        onClick={callAI}
        disabled={loading || fileLoading}
      >
        ➤
      </button>
    </div>
  );

  const renderLoginCard = (compact = false) => (
    <div
      style={{
        ...s.loginCardModern,
        background: isDark ? "rgba(17,17,17,0.94)" : "rgba(255,255,255,0.72)",
        color: theme.text,
        border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)"}`,
        width: compact ? "100%" : "min(560px, calc(100vw - 32px))",
      }}
    >
      <div style={s.loginBrand}>
        TECH<span style={{ color: theme.primary }}>AI</span>
      </div>

      <h1 style={s.loginHeadline}>Accedi al tuo account</h1>
      <p style={s.loginDescription}>Area privata predisposta per salvare chat, file e impostazioni utente.</p>

      {savedLogins.length > 0 && (
        <div style={s.savedLoginArea}>
          <div style={s.savedLoginTitle}>Account salvati</div>
          <div style={s.savedLoginList}>
            {savedLogins.map(item => (
              <button
                key={item.email}
                style={{ ...s.savedLoginPill, border: `1px solid ${theme.border}`, color: theme.text }}
                onClick={() => useSavedLogin(item.email)}
                type="button"
              >
                {item.email}
              </button>
            ))}
          </div>
        </div>
      )}

      <label style={s.cleanLoginLabel}>Email</label>
      <input
        style={{ ...s.cleanLoginInput, color: theme.text, border: `1px solid ${theme.border}` }}
        value={loginEmail}
        onChange={e => setLoginEmail(e.target.value)}
        placeholder="nome@email.com"
        type="email"
        autoComplete="email"
      />

      <label style={s.cleanLoginLabel}>Password</label>
      <div style={{ ...s.cleanPasswordWrap, border: `1px solid ${theme.border}` }}>
        <input
          style={{ ...s.cleanPasswordInput, color: theme.text }}
          value={loginPassword}
          onChange={e => setLoginPassword(e.target.value)}
          placeholder="Minimo 6 caratteri"
          type={showPassword ? "text" : "password"}
          autoComplete="current-password"
          onKeyDown={e => e.key === "Enter" && handleLogin()}
        />
        <button
          style={{ ...s.cleanPasswordToggle, color: theme.primary }}
          onClick={() => setShowPassword(prev => !prev)}
          type="button"
        >
          {showPassword ? "Nascondi" : "Mostra"}
        </button>
      </div>

      {loginError && <div style={s.loginError}>{loginError}</div>}

      <button style={{ ...s.mainLoginBtn, background: theme.primary }} onClick={handleLogin}>
        Accedi
      </button>

      <div style={s.loginDivider}>oppure</div>

      <button
        style={{ ...s.providerBtn, color: theme.text, border: `1px solid ${theme.border}` }}
        onClick={() => handleProviderLogin("Google")}
        type="button"
      >
        Continua con Google
      </button>

      <button
        style={{ ...s.providerBtn, color: theme.text, border: `1px solid ${theme.border}` }}
        onClick={() => handleProviderLogin("telefono")}
        type="button"
      >
        Continua con telefono
      </button>

      <button
        style={{ ...s.guestBtn, color: theme.text, border: `1px solid ${theme.border}` }}
        onClick={handleGuestLogin}
        type="button"
      >
        <span style={s.guestIcon}>♟</span>
        <span style={s.guestTextWrap}>
          <strong>Continua come ospite</strong>
          <small>Usa TechAI senza account. Le chat non verranno salvate come profilo.</small>
        </span>
        <span style={s.guestArrow}>›</span>
      </button>

      <button
        style={{ ...s.registerBtn, color: theme.primary }}
        onClick={() => setLoginError("Registrazione grafica: per un account reale serve collegare un backend/database.")}
        type="button"
      >
        Non hai un account? Registrati
      </button>
    </div>
  );

  return (
    <div style={{ ...s.app, backgroundColor: theme.bg, color: theme.text }}>
      {!isLoggedIn && !showLoginPanel && (
        <div style={{ ...s.loginScreen, background: `linear-gradient(135deg, ${theme.bg}, ${theme.surface})` }}>
          {renderLoginCard(false)}
        </div>
      )}

      <aside
        style={{
          ...s.sidebar,
          width: sidebarOpen ? 280 : 74,
          minWidth: sidebarOpen ? 280 : 74,
          backgroundColor: isDark ? "#050505" : theme.bg,
          borderRight: `1px solid ${theme.border || theme.surface}`,
          filter: !isLoggedIn ? "blur(1px)" : "none",
          pointerEvents: !isLoggedIn ? "none" : "auto",
        }}
      >
        <div style={{ ...s.sidebarTop, justifyContent: sidebarOpen ? "space-between" : "center" }}>
          {sidebarOpen && (
            <div style={s.logoWrap}>
              <div style={{ ...s.logoMark, backgroundColor: theme.primary }}>T</div>
              <div style={s.logoText}>
                TECH<span style={{ color: theme.primary }}>AI</span>
              </div>
            </div>
          )}

          <button
            style={{
              ...s.collapseBtn,
              color: theme.text,
              backgroundColor: sidebarOpen ? "transparent" : theme.surface,
              border: `1px solid ${theme.border || theme.surface}`,
            }}
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? "Chiudi barra laterale" : "Apri barra laterale"}
          >
            ☰
          </button>
        </div>

        <div style={{ ...s.iconNav, alignItems: sidebarOpen ? "stretch" : "center" }}>
          {iconBtn("＋", "Nuova", createNewChat)}
          {iconBtn("≡", "Chat", () => setSidebarOpen(true), sidebarOpen)}
          {iconBtn("🔐", isLoggedIn ? "Account" : "Login", openLoginInsideApp)}

          <div
            style={{
              ...s.toolsGroup,
              backgroundColor: isDark ? "#111111" : theme.surface,
              border: `1px solid ${theme.border || theme.surface}`,
              boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.04) inset" : "0 8px 20px rgba(0,0,0,0.04)",
            }}
          >
            {sidebarOpen && (
              <div style={{ ...s.toolsTitle, color: theme.primary }}>
                Strumenti tecnici
              </div>
            )}

            {iconBtn("✓", "Checklist", () => setShowChecklist(true))}
            {iconBtn("∑", "Verifica", () => setShowQuickCalc(true))}
            {iconBtn("▦", "Materiali", () => setShowMaterials(true))}
            {iconBtn("▣", "Tavole", () => setShowDrawingGenerator(true))}
          </div>
        </div>

        {sidebarOpen && (
          <div style={s.chatHistory}>
            <div style={s.historyHeader}>Cronologia</div>

            {chats.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.6, padding: "8px" }}>Nessuna chat salvata</div>
            )}

            {chats.map(chat => (
              <div
                key={chat.id}
                style={{
                  ...s.historyItem,
                  backgroundColor: chat.id === activeChatId ? theme.surface : "transparent",
                  color: chat.id === activeChatId ? theme.primary : theme.text,
                  border: `1px solid ${chat.id === activeChatId ? theme.border || theme.surface : "transparent"}`,
                }}
              >
                <div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>
                  {chat.title}
                </div>

                <button style={s.deleteBtn} onClick={() => deleteChat(chat.id)} title="Elimina chat">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
        <div style={s.sidebarBottomActions}>
          {iconBtn("⚙", "Impostazioni", () => { setActiveTab("Aspetto"); setShowSettings(true); })}
        </div>

        <div
          style={{ ...s.sidebarAccount, justifyContent: sidebarOpen ? "flex-start" : "center" }}
          onClick={() => { setActiveTab("Account"); setShowSettings(true); }}
        >
          <div style={{ ...s.avatar, backgroundColor: theme.primary }}>{user.name.charAt(0)}</div>

          {sidebarOpen && (
            <div style={s.accountText}>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>{user.name}</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>{isLoggedIn ? "Online · Piano Pro" : "Non connesso"}</div>
            </div>
          )}
        </div>
      </aside>

      <main style={{ ...s.main, backgroundColor: theme.bg }}>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?</h1>
              {renderInputBar("Chiedi a TechAI o carica un file testuale...")}
              <p style={s.fileHint}>Supporta file testuali: TXT, CSV, JSON, MD, XML, HTML, CSS, JS, TS, TSX.</p>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div
                      style={
                        m.role === "utente"
                          ? { ...s.uBox, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }
                          : { ...s.aBox, color: theme.text }
                      }
                    >
                      {formatText(m.text)}
                    </div>
                  </div>
                ))}

                {fileLoading && <div style={{ color: theme.primary, textAlign: "center" }}>📎 Lettura file in corso...</div>}
                {loading && <div style={{ color: theme.primary, textAlign: "center" }}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file testuale...")}</div>
            </div>
          )}
        </section>

        {showLoginPanel && (
          <div style={s.overlay}>
            <div style={s.loginModalWrap}>
              {renderLoginCard(false)}
              <button
                style={{ ...s.closeFloatingBtn, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                onClick={() => {
                  setShowLoginPanel(false);
                  setLoginError("");
                }}
                title="Torna indietro"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {showDrawingGenerator && (
          <div style={s.overlay}>
            <div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={{ fontSize: "20px", margin: 0 }}>Generatore tavole tecniche controllate</h2>
                  <p style={s.checklistSubtitle}>Suggerisce viste, sezioni, quote, tolleranze, rugosità e note di cartiglio.</p>
                </div>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowDrawingGenerator(false)}>← Indietro</button>
              </div>

              <div style={s.drawingLayout}>
                <div style={s.checklistFormArea}>
                  <div style={s.checklistGrid}>
                    <div>
                      <label style={s.label}>Nome pezzo</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.partName} onChange={e => updateDrawingField("partName", e.target.value)} placeholder="Es. Albero intermedio" />
                    </div>
                    <div>
                      <label style={s.label}>Tipo pezzo</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.partType} onChange={e => updateDrawingField("partType", e.target.value)} placeholder="Albero, perno, staffa, flangia..." />
                    </div>
                    <div>
                      <label style={s.label}>Materiale</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.material} onChange={e => updateDrawingField("material", e.target.value)} placeholder="C45, S235, 6082 T6..." />
                    </div>
                    <div>
                      <label style={s.label}>Quantità / lotto</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.productionQuantity} onChange={e => updateDrawingField("productionQuantity", e.target.value)} placeholder="1 pezzo, 100 pezzi..." />
                    </div>
                  </div>

                  <label style={s.label}>Lavorazione prevista</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.manufacturing} onChange={e => updateDrawingField("manufacturing", e.target.value)} placeholder="Tornitura, fresatura, saldatura, piega, rettifica..." />

                  <label style={s.label}>Geometrie principali</label>
                  <textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.mainFeatures} onChange={e => updateDrawingField("mainFeatures", e.target.value)} placeholder="Fori, cave, asole, spallamenti, lamature, sedi cuscinetto..." />

                  <label style={s.label}>Funzione del pezzo nell'assieme</label>
                  <textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.assemblyFunction} onChange={e => updateDrawingField("assemblyFunction", e.target.value)} placeholder="Cosa fa il pezzo? Appoggia, centra, scorre, trasmette coppia, supporta carichi..." />

                  <label style={s.label}>Superfici funzionali</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.functionalSurfaces} onChange={e => updateDrawingField("functionalSurfaces", e.target.value)} placeholder="Sede cuscinetto, piano appoggio, superficie scorrimento..." />

                  <label style={s.label}>Fori / filetti / lamature</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.holesThreads} onChange={e => updateDrawingField("holesThreads", e.target.value)} placeholder="Foro Ø10 H7, M8 prof. 15, lamatura Ø14..." />

                  <label style={s.label}>Accoppiamenti</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.fits} onChange={e => updateDrawingField("fits", e.target.value)} placeholder="Ø20 h6, Ø35 H7, sede cuscinetto..." />

                  <label style={s.label}>Tolleranze già previste</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.tolerances} onChange={e => updateDrawingField("tolerances", e.target.value)} placeholder="ISO 2768-mK, planarità, posizione fori..." />

                  <label style={s.label}>Rugosità già previste</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.roughness} onChange={e => updateDrawingField("roughness", e.target.value)} placeholder="Ra 3.2 generale, Ra 1.6 sede..." />

                  <button style={{ ...s.checkBtn, background: theme.primary }} onClick={runDrawingGenerator}>Genera controllo tavola</button>
                </div>

                <div style={s.checklistResultsArea}>
                  {drawingResults.length === 0 ? (
                    <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>
                      Inserisci i dati del pezzo e premi “Genera controllo tavola”.
                    </div>
                  ) : (
                    drawingResults.map((item, index) => (
                      <div key={index} style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                        <div style={s.resultTop}>
                          <strong>{item.category}: {item.item}</strong>
                          <span style={s.resultStatus}>{item.status}</span>
                        </div>
                        <p style={s.resultDetail}>{item.reason}</p>
                        <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showQuickCalc && (
          <div style={s.overlay}>
            <div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={{ fontSize: "20px", margin: 0 }}>Verifica dimensionale rapida</h2>
                  <p style={s.checklistSubtitle}>Modulo preliminare per alberi, perni, staffe e componenti semplici.</p>
                </div>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowQuickCalc(false)}>← Indietro</button>
              </div>

              <div style={s.quickCalcLayout}>
                <div style={s.checklistFormArea}>
                  <div style={s.checklistGrid}>
                    <div>
                      <label style={s.label}>Tipo componente</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.componentType} onChange={e => updateQuickCalcField("componentType", e.target.value)} placeholder="Perno, albero, staffa..." />
                    </div>
                    <div>
                      <label style={s.label}>Tipo verifica</label>
                      <select style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.stressType} onChange={e => updateQuickCalcField("stressType", e.target.value)}>
                        <option value="flessione">Flessione</option>
                        <option value="taglio">Taglio</option>
                        <option value="torsione">Torsione</option>
                        <option value="assiale">Trazione / compressione</option>
                      </select>
                    </div>
                    <div>
                      <label style={s.label}>Materiale</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.material} onChange={e => updateQuickCalcField("material", e.target.value)} placeholder="C45" />
                    </div>
                    <div>
                      <label style={s.label}>Carico F [N]</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.load} onChange={e => updateQuickCalcField("load", e.target.value)} placeholder="2500" />
                    </div>
                    <div>
                      <label style={s.label}>Distanza / braccio L [mm]</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.distance} onChange={e => updateQuickCalcField("distance", e.target.value)} placeholder="120" />
                    </div>
                    <div>
                      <label style={s.label}>Diametro d [mm]</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.diameter} onChange={e => updateQuickCalcField("diameter", e.target.value)} placeholder="20" />
                    </div>
                  </div>

                  <label style={s.label}>Coefficiente sicurezza richiesto</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.safetyFactorRequired} onChange={e => updateQuickCalcField("safetyFactorRequired", e.target.value)} placeholder="2" />
                  <button style={{ ...s.checkBtn, background: theme.primary }} onClick={runQuickCalc}>Calcola verifica</button>
                  <div style={{ ...s.warningBox, border: `1px solid ${theme.border}` }}>Calcolo preliminare: non sostituisce verifica normativa, FEM o relazione firmata. Usa modelli semplificati.</div>
                </div>

                <div style={s.checklistResultsArea}>
                  {!quickCalcResult ? (
                    <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati e premi “Calcola verifica”.</div>
                  ) : (
                    <div style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                      <div style={s.resultTop}>
                        <strong>{quickCalcResult.title}</strong>
                        <span style={{ ...s.bigOutcome, color: quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626" }}>{quickCalcResult.outcome}</span>
                      </div>
                      <p style={s.resultDetail}>{quickCalcResult.scheme}</p>
                      <div style={s.formulaBlock}>{quickCalcResult.formulas.map((formula, index) => <div key={index}>{formula}</div>)}</div>
                      <div style={s.valueList}>{quickCalcResult.values.map((value, index) => <div key={index} style={s.valueRow}>• {value}</div>)}</div>
                      <div style={{ ...s.finalBox, borderLeft: `4px solid ${quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626"}` }}>Esito: {quickCalcResult.outcome}. Coefficiente calcolato n = {quickCalcResult.safetyFactor.toFixed(2)}.</div>
                      {quickCalcResult.notes.map((note, index) => <p key={index} style={s.resultSuggestion}>{note}</p>)}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showMaterials && (
          <div style={s.overlay}>
            <div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={{ fontSize: "20px", margin: 0 }}>Libreria materiali</h2>
                  <p style={s.checklistSubtitle}>Conversioni normative e proprietà meccaniche indicative.</p>
                </div>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowMaterials(false)}>← Indietro</button>
              </div>

              <div style={s.materialToolbar}>
                <input style={{ ...s.materialSearch, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} placeholder="Cerca materiale, EN, DIN, AISI, JIS..." />
                <button style={{ ...s.addMaterialBtn, background: theme.primary }} onClick={() => setShowAddMaterial(prev => !prev)}>
                  {showAddMaterial ? "Chiudi" : "+ Aggiungi materiale"}
                </button>
              </div>

              {showAddMaterial && (
                <div style={{ ...s.addMaterialPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                  <div style={s.addMaterialHeader}>
                    <strong>Nuovo materiale personalizzato</strong>
                    <span>Compila i dati che conosci. Gli altri resteranno “Non specificato”.</span>
                  </div>

                  <div style={s.addMaterialGrid}>
                    <div><label style={s.label}>Nome materiale *</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.name} onChange={e => updateNewMaterialField("name", e.target.value)} placeholder="Es. AISI 316Ti" /></div>
                    <div><label style={s.label}>Chiave interna</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.key} onChange={e => updateNewMaterialField("key", e.target.value)} placeholder="Es. aisi316ti" /></div>
                    <div><label style={s.label}>EN</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.en} onChange={e => updateNewMaterialField("en", e.target.value)} placeholder="EN 1.xxxx" /></div>
                    <div><label style={s.label}>UNI</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.uni} onChange={e => updateNewMaterialField("uni", e.target.value)} placeholder="Norma UNI" /></div>
                    <div><label style={s.label}>DIN</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.din} onChange={e => updateNewMaterialField("din", e.target.value)} placeholder="DIN" /></div>
                    <div><label style={s.label}>AISI/SAE</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.aisi} onChange={e => updateNewMaterialField("aisi", e.target.value)} placeholder="AISI / SAE" /></div>
                    <div><label style={s.label}>JIS</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.jis} onChange={e => updateNewMaterialField("jis", e.target.value)} placeholder="JIS" /></div>
                    <div><label style={s.label}>ISO / categoria</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.iso} onChange={e => updateNewMaterialField("iso", e.target.value)} placeholder="Acciaio, alluminio, polimero..." /></div>
                    <div><label style={s.label}>Rm [MPa]</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.rm || ""} onChange={e => updateNewMaterialField("rm", e.target.value)} placeholder="Es. 650" /></div>
                    <div><label style={s.label}>Re [MPa]</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.re || ""} onChange={e => updateNewMaterialField("re", e.target.value)} placeholder="Es. 370" /></div>
                  </div>

                  <label style={s.label}>Durezza</label>
                  <input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.hardness} onChange={e => updateNewMaterialField("hardness", e.target.value)} placeholder="Es. 170-220 HB" />

                  <div style={s.addMaterialGrid}>
                    <div><label style={s.label}>Trattamenti</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.treatments} onChange={e => updateNewMaterialField("treatments", e.target.value)} placeholder="Bonifica, tempra..." /></div>
                    <div><label style={s.label}>Saldabilità</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.weldability} onChange={e => updateNewMaterialField("weldability", e.target.value)} placeholder="Buona, limitata..." /></div>
                    <div><label style={s.label}>Lavorabilità</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.machinability} onChange={e => updateNewMaterialField("machinability", e.target.value)} placeholder="Buona, difficile..." /></div>
                    <div><label style={s.label}>Impieghi</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.uses} onChange={e => updateNewMaterialField("uses", e.target.value)} placeholder="Alberi, staffe, piastre..." /></div>
                  </div>

                  <label style={s.label}>Note</label>
                  <textarea style={{ ...s.addMaterialTextarea, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.notes} onChange={e => updateNewMaterialField("notes", e.target.value)} />

                  <button style={{ ...s.saveMaterialBtn, background: theme.primary }} onClick={addCustomMaterial}>Salva materiale</button>
                </div>
              )}

              <div style={s.materialGrid}>
                {allMaterials.filter(m => {
                  const q = materialSearch.toLowerCase().trim();
                  if (!q) return true;
                  return `${m.name} ${m.en} ${m.uni} ${m.din} ${m.aisi} ${m.jis} ${m.iso} ${m.uses}`.toLowerCase().includes(q);
                }).map(material => (
                  <div key={material.key} style={{ ...s.materialCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                    <div style={s.materialHead}>
                      <div>
                        <h3 style={{ margin: 0 }}>{material.name}</h3>
                        {customMaterials.some(item => item.key === material.key) && <span style={s.customTag}>Personalizzato</span>}
                      </div>
                      <div style={s.materialActions}>
                        <button style={{ ...s.smallUseBtn, background: theme.primary }} onClick={() => { setQuickCalcForm(prev => ({ ...prev, material: material.name })); setShowMaterials(false); setShowQuickCalc(true); }}>Usa in verifica</button>
                        {customMaterials.some(item => item.key === material.key) && (
                          <button style={s.smallDeleteMaterialBtn} onClick={() => deleteCustomMaterial(material.key)}>Elimina</button>
                        )}
                      </div>
                    </div>
                    <div style={s.materialCodes}>
                      <span>EN: {material.en}</span>
                      <span>UNI: {material.uni}</span>
                      <span>DIN: {material.din}</span>
                      <span>AISI/SAE: {material.aisi}</span>
                      <span>JIS: {material.jis}</span>
                      <span>ISO: {material.iso}</span>
                    </div>
                    <div style={s.materialProps}><strong>Rm:</strong> {material.rm} MPa · <strong>Re:</strong> {material.re} MPa · <strong>Durezza:</strong> {material.hardness}</div>
                    <p><strong>Trattamenti:</strong> {material.treatments}</p>
                    <p><strong>Saldabilità:</strong> {material.weldability}</p>
                    <p><strong>Lavorabilità:</strong> {material.machinability}</p>
                    <p><strong>Impieghi:</strong> {material.uses}</p>
                    <p style={{ opacity: 0.68 }}><strong>Nota:</strong> {material.notes}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {showChecklist && (
          <div style={s.overlay}>
            <div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={{ fontSize: "20px", margin: 0 }}>Checklist tecnica progetto</h2>
                  <p style={s.checklistSubtitle}>Controllo preliminare automatico per componenti meccanici.</p>
                </div>
                <button
                  style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }}
                  onClick={() => setShowChecklist(false)}
                >
                  ← Indietro
                </button>
              </div>

              <div style={s.checklistLayout}>
                <div style={s.checklistFormArea}>
                  <div style={s.checklistGrid}>
                    <div>
                      <label style={s.label}>Tipo componente</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.componentType} onChange={e => updateChecklistField("componentType", e.target.value)} placeholder="Albero, perno, staffa, flangia..." />
                    </div>
                    <div>
                      <label style={s.label}>Materiale</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.material} onChange={e => updateChecklistField("material", e.target.value)} placeholder="C45, S235, 42CrMo4..." />
                    </div>
                    <div>
                      <label style={s.label}>Carico indicativo [N]</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.load} onChange={e => updateChecklistField("load", e.target.value)} placeholder="2500" />
                    </div>
                    <div>
                      <label style={s.label}>Coefficiente sicurezza</label>
                      <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.safetyFactor} onChange={e => updateChecklistField("safetyFactor", e.target.value)} placeholder="2" />
                    </div>
                  </div>

                  <label style={s.label}>Ambiente d'uso</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.environment} onChange={e => updateChecklistField("environment", e.target.value)} placeholder="Interno, esterno, umido, corrosivo, olio..." />

                  <label style={s.label}>Lavorazione prevista</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.machining} onChange={e => updateChecklistField("machining", e.target.value)} placeholder="Tornitura, fresatura, saldatura, rettifica..." />

                  <label style={s.label}>Tolleranze / accoppiamenti presenti</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.tolerances} onChange={e => updateChecklistField("tolerances", e.target.value)} placeholder="Ø20 h6, foro Ø10 H7, posizione fori..." />

                  <label style={s.label}>Rugosità</label>
                  <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.roughness} onChange={e => updateChecklistField("roughness", e.target.value)} placeholder="Ra 3.2 generale, Ra 1.6 sedi..." />

                  <label style={s.label}>Note tecniche</label>
                  <textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.notes} onChange={e => updateChecklistField("notes", e.target.value)} placeholder="Smussi, raggi, filetti, trattamenti, note cartiglio..." />

                  <button style={{ ...s.checkBtn, background: theme.primary }} onClick={runProjectChecklist}>Esegui checklist</button>
                </div>

                <div style={s.checklistResultsArea}>
                  {checklistResults.length === 0 ? (
                    <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>
                      Inserisci i dati del pezzo e premi “Esegui checklist”.
                    </div>
                  ) : (
                    checklistResults.map((item, index) => (
                      <div key={index} style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                        <div style={s.resultTop}>
                          <strong>{item.area}</strong>
                          <span style={s.resultStatus}>{item.status}</span>
                        </div>
                        <p style={s.resultDetail}>{item.detail}</p>
                        <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {showSettings && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={{ ...s.modalSide, background: isDark ? "#050505" : "#f8fafc", borderRight: `1px solid ${theme.border}` }}>
                {["Account", "Aspetto", "AI Focus"].map(t => (
                  <div
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{ ...s.tab, color: activeTab === t ? theme.primary : theme.text, fontWeight: activeTab === t ? 800 : 400 }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div style={s.modalMain}>
                <div style={s.modalHeader}>
                  <h2 style={{ fontSize: "18px", margin: 0 }}>{activeTab}</h2>
                  <button
                    style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }}
                    onClick={() => setShowSettings(false)}
                  >
                    ← Indietro
                  </button>
                </div>

                {activeTab === "Account" && (
                  <div>
                    <label style={s.label}>Nome Visualizzato</label>
                    <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} />

                    <label style={s.label}>Email</label>
                    <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} />

                    <div style={s.accountButtonRow}>
                      <button style={{ ...s.miniPrimaryBtn, background: theme.primary }} onClick={openLoginInsideApp}>
                        Apri login
                      </button>
                      <button style={{ ...s.miniDangerBtn }} onClick={handleLogout}>
                        Logout
                      </button>
                    </div>

                    <div style={s.badge}>Stato Account: {isLoggedIn ? "Accesso effettuato ✅" : "Non connesso"}</div>
                  </div>
                )}

                {activeTab === "Aspetto" && (
                  <div style={s.themeGrid}>
                    {THEMES.map(t => (
                      <div
                        key={t.name}
                        onClick={() => setTheme(t)}
                        style={{
                          ...s.themeOption,
                          background: theme.name === t.name ? theme.surface : "transparent",
                          color: theme.text,
                          border:
                            theme.name === "Dark Black"
                              ? theme.name === t.name
                                ? "1px solid #5b5b5b"
                                : "1px solid #2f2f2f"
                              : theme.name === t.name
                                ? `1px solid ${t.primary}`
                                : `1px solid ${theme.border || "transparent"}`,
                          boxShadow:
                            theme.name === "Dark Black" && theme.name === t.name
                              ? "0 0 0 1px rgba(255,255,255,0.06) inset"
                              : "none",
                        }}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: t.name === "Dark Black" ? "#0b0b0b" : t.primary,
                            border: t.name === "Dark Black" ? "1px solid #f8fafc" : "none",
                          }}
                        />
                        {t.name}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "AI Focus" && (
                  <div>
                    <label style={s.label}>Ambito Tecnico Principale</label>
                    <input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={interest} onChange={e => setInterest(e.target.value)} />
                  </div>
                )}

                <button style={{ ...s.saveBtn, background: theme.primary }} onClick={saveAll}>Salva modifiche</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; transition: background 0.2s, color 0.2s, width 0.25s ease, min-width 0.25s ease, border 0.2s; }
        html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        input::placeholder, textarea::placeholder { opacity: 0.55; }
        button:disabled { opacity: 0.45; cursor: not-allowed; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", minWidth: 0 },

  loginScreen: {
    position: "fixed",
    inset: 0,
    zIndex: 2000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  loginModalWrap: { position: "relative" },
  loginCard: {
    borderRadius: 30,
    padding: 28,
    boxShadow: "0 30px 80px rgba(0,0,0,0.28)",
    backdropFilter: "blur(18px)",
  },
  loginLogo: {
    width: 46,
    height: 46,
    borderRadius: 16,
    color: "white",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    marginBottom: 18,
  },
  loginTitle: { margin: 0, fontSize: 28, fontWeight: 850, letterSpacing: "-0.8px" },
  loginSubtitle: { margin: "8px 0 24px", fontSize: 14, opacity: 0.68, lineHeight: 1.45 },
  loginLabel: { display: "block", fontSize: 11, fontWeight: 850, textTransform: "uppercase", opacity: 0.62, margin: "14px 0 8px" },
  loginInputWrap: {
    minHeight: 54,
    borderRadius: 18,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 14px",
    boxShadow: "0 8px 22px rgba(0,0,0,0.035)",
  },
  loginInputIcon: { width: 22, textAlign: "center", fontWeight: 900, opacity: 0.88 },
  loginInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 15,
    padding: "14px 0",
  },
  passwordToggle: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    padding: "8px 0 8px 8px",
  },
  loginError: {
    marginTop: 12,
    padding: "10px 12px",
    borderRadius: 12,
    color: "#b91c1c",
    background: "#fee2e2",
    fontSize: 13,
    fontWeight: 700,
  },
  loginBtn: {
    width: "100%",
    minHeight: 52,
    border: "none",
    borderRadius: 18,
    color: "white",
    fontWeight: 850,
    fontSize: 15,
    marginTop: 18,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(0,0,0,0.14)",
  },
  ghostLoginBtn: {
    width: "100%",
    minHeight: 44,
    borderRadius: 16,
    background: "transparent",
    fontWeight: 800,
    marginTop: 10,
    cursor: "pointer",
  },
  loginNote: { fontSize: 11, opacity: 0.55, lineHeight: 1.45, margin: "14px 0 0", textAlign: "center" },
  closeFloatingBtn: {
    position: "absolute",
    top: -12,
    right: -12,
    width: 38,
    height: 38,
    borderRadius: "50%",
    cursor: "pointer",
    fontSize: 22,
    fontWeight: 700,
  },

  loginCardModern: {
    borderRadius: 28,
    padding: "34px 44px",
    boxShadow: "0 30px 90px rgba(0,0,0,0.22)",
    backdropFilter: "blur(24px)",
    WebkitBackdropFilter: "blur(24px)",
  },
  loginBrand: {
    textAlign: "center",
    fontSize: 25,
    fontWeight: 950,
    letterSpacing: "-1px",
    marginBottom: 20,
  },
  loginHeadline: {
    textAlign: "center",
    margin: 0,
    fontSize: 28,
    fontWeight: 850,
    letterSpacing: "-0.8px",
  },
  loginDescription: {
    textAlign: "center",
    margin: "14px 0 24px",
    fontSize: 14,
    opacity: 0.72,
    lineHeight: 1.45,
  },
  savedLoginArea: { marginBottom: 18 },
  savedLoginTitle: { fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: 0.58, marginBottom: 8 },
  savedLoginList: { display: "flex", gap: 8, flexWrap: "wrap" },
  savedLoginPill: {
    background: "rgba(255,255,255,0.35)",
    borderRadius: 999,
    padding: "8px 11px",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
  },
  cleanLoginLabel: {
    display: "block",
    fontSize: 12,
    fontWeight: 900,
    textTransform: "uppercase",
    opacity: 0.7,
    margin: "18px 0 8px",
  },
  cleanLoginInput: {
    width: "100%",
    minHeight: 54,
    borderRadius: 16,
    background: "rgba(255,255,255,0.28)",
    outline: "none",
    padding: "0 16px",
    fontSize: 15,
    fontWeight: 600,
  },
  cleanPasswordWrap: {
    width: "100%",
    minHeight: 54,
    borderRadius: 16,
    background: "rgba(255,255,255,0.28)",
    display: "flex",
    alignItems: "center",
    padding: "0 8px 0 16px",
  },
  cleanPasswordInput: {
    flex: 1,
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 15,
    fontWeight: 600,
  },
  cleanPasswordToggle: {
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 850,
    padding: "10px",
  },
  mainLoginBtn: {
    width: "100%",
    minHeight: 54,
    border: "none",
    borderRadius: 16,
    color: "white",
    fontWeight: 900,
    fontSize: 15,
    marginTop: 24,
    cursor: "pointer",
    boxShadow: "0 14px 30px rgba(37,99,235,0.28)",
  },
  loginDivider: { textAlign: "center", fontSize: 12, opacity: 0.62, margin: "15px 0" },
  providerBtn: {
    width: "100%",
    minHeight: 48,
    borderRadius: 16,
    background: "rgba(255,255,255,0.22)",
    cursor: "pointer",
    fontWeight: 850,
    fontSize: 14,
    marginBottom: 10,
  },
  guestBtn: {
    width: "100%",
    minHeight: 64,
    borderRadius: 18,
    background: "rgba(255,255,255,0.22)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 14px",
    textAlign: "left",
    marginTop: 4,
  },
  guestIcon: { width: 28, fontSize: 22, textAlign: "center" },
  guestTextWrap: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  guestArrow: { fontSize: 30, opacity: 0.58 },
  registerBtn: {
    width: "100%",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    fontWeight: 900,
    fontSize: 15,
    marginTop: 20,
  },

  sidebar: {
    height: "100dvh",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflow: "hidden",
    flexShrink: 0,
  },

  sidebarTop: { display: "flex", alignItems: "center", gap: 8, minHeight: 50, flexShrink: 0 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { width: 34, height: 34, borderRadius: 12, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  logoText: { fontSize: 21, fontWeight: 900, letterSpacing: "-1px", whiteSpace: "nowrap" },
  collapseBtn: { width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },

  iconNav: { display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 },
  toolsGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    borderRadius: 18,
    padding: 8,
    margin: "8px 0",
  },
  toolsTitle: {
    fontSize: 11,
    textTransform: "uppercase",
    fontWeight: 950,
    letterSpacing: "0.6px",
    opacity: 0.95,
    padding: "5px 8px 7px",
    borderBottom: "1px solid rgba(120,120,120,0.18)",
    marginBottom: 3,
  },
  iconBtn: { minHeight: 44, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, background: "transparent", textAlign: "left", flexShrink: 0 },
  icon: { width: 22, height: 22, display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: 15, fontWeight: 600, opacity: 0.88, letterSpacing: "-1px", flexShrink: 0 },
  iconLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },

  chatHistory: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 },
  historyHeader: { fontSize: 11, textTransform: "uppercase", fontWeight: 800, opacity: 0.5, padding: "6px 8px" },
  historyItem: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "8px 10px", fontSize: 13, cursor: "pointer" },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 },
  deleteBtn: { border: "none", background: "transparent", cursor: "pointer", fontSize: 18, opacity: 0.55 },

  sidebarBottomActions: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  sidebarAccount: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "7px", cursor: "pointer", borderRadius: 14, flexShrink: 0 },
  avatar: { width: 38, height: 38, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  accountText: { display: "flex", flexDirection: "column", minWidth: 0 },

  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: 720, textAlign: "center", padding: "0 22px" },
  welcomeText: { fontSize: "clamp(25px, 4vw, 38px)", fontWeight: 600, marginBottom: 30, letterSpacing: "-1px" },

  searchBar: { display: "flex", alignItems: "center", borderRadius: 28, padding: "6px 16px", width: "100%", minHeight: 56, boxShadow: "0 8px 24px rgba(0,0,0,0.04)", backdropFilter: "blur(10px)", flexShrink: 0 },
  fileBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", marginRight: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85 },
  textarea: { flex: 1, minWidth: 0, maxHeight: 140, background: "none", border: "none", outline: "none", textAlign: "center", fontSize: 16, resize: "none", padding: "10px 0", overflowY: "auto" },
  sendBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 20, marginLeft: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 },
  fileHint: { fontSize: 12, opacity: 0.58, marginTop: 12 },

  chatView: { width: "100%", maxWidth: 900, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 22px", overflow: "hidden" },
  msgList: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 18, padding: "10px 0" },
  uRow: { display: "flex", justifyContent: "flex-end" },
  aRow: { display: "flex", justifyContent: "flex-start" },
  uBox: { padding: "13px 18px", borderRadius: 20, maxWidth: "82%", fontSize: 15, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  aBox: { padding: "10px 0", lineHeight: 1.7, fontSize: 16, whiteSpace: "pre-wrap", maxWidth: "92%", overflowWrap: "anywhere" },
  bottomInput: { padding: "10px 0 8px", flexShrink: 0 },

  messageTitle: {
    fontSize: 20,
    fontWeight: 850,
    marginTop: 22,
    marginBottom: 12,
    paddingBottom: 8,
    letterSpacing: "-0.4px",
  },
  messageListItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    margin: "4px 0",
    lineHeight: 1.65,
  },
  messageLine: {
    lineHeight: 1.7,
    margin: "2px 0",
  },
  mathExampleBox: {
    borderRadius: 16,
    padding: 14,
    margin: "10px 0",
    fontSize: 15,
    lineHeight: 1.7,
  },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 },
  modal: { borderRadius: 24, width: "min(620px, 100%)", height: "min(450px, calc(100dvh - 32px))", display: "flex", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" },
  modalSide: { width: 170, padding: 24, display: "flex", flexDirection: "column", gap: 15, flexShrink: 0 },
  modalMain: { flex: 1, minWidth: 0, padding: 32, display: "flex", flexDirection: "column", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  backBtn: { background: "transparent", borderRadius: 12, padding: "9px 12px", cursor: "pointer", fontWeight: 800, fontSize: 13 },
  tab: { cursor: "pointer", fontSize: 14 },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 12, marginBottom: 20, outline: "none", fontSize: 14 },
  badge: { fontSize: 12, color: "#10b981", fontWeight: 700, background: "#f0fdf4", padding: 10, borderRadius: 10, textAlign: "center", marginTop: 14 },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 },
  themeOption: { padding: 12, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700 },
  saveBtn: { marginTop: "auto", padding: 14, border: "none", borderRadius: 14, color: "white", fontWeight: 700, cursor: "pointer" },
  checklistModal: { borderRadius: 24, width: "min(1120px, calc(100vw - 32px))", height: "min(760px, calc(100dvh - 32px))", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.28)", padding: 28 },
  checklistSubtitle: { margin: "6px 0 0", fontSize: 13, opacity: 0.62 },
  checklistLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.9fr) minmax(360px, 1.1fr)", gap: 22, overflow: "hidden" },
  quickCalcLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.85fr) minmax(400px, 1.15fr)", gap: 22, overflow: "hidden" },
  drawingLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(380px, 0.95fr) minmax(430px, 1.05fr)", gap: 22, overflow: "hidden" },
  checklistFormArea: { overflowY: "auto", paddingRight: 6 },
  checklistResultsArea: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 },
  checklistGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  checklistTextarea: { width: "100%", minHeight: 92, padding: 12, borderRadius: 12, marginBottom: 20, outline: "none", fontSize: 14, resize: "vertical" },
  checkBtn: { width: "100%", padding: 15, border: "none", borderRadius: 14, color: "white", fontWeight: 850, cursor: "pointer", fontSize: 15 },
  emptyChecklist: { borderRadius: 18, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: 0.68, padding: 18, fontSize: 14 },
  resultCard: { borderRadius: 18, padding: 16 },
  resultTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, fontSize: 14 },
  resultStatus: { fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" },
  resultDetail: { margin: "0 0 10px", lineHeight: 1.5, fontSize: 13, opacity: 0.82 },
  resultSuggestion: { margin: 0, paddingLeft: 10, lineHeight: 1.5, fontSize: 13, fontWeight: 650 },
  warningBox: { marginTop: 14, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 1.5, opacity: 0.74 },
  formulaBlock: { borderRadius: 16, padding: 14, background: "rgba(120,120,120,0.08)", margin: "14px 0", overflowX: "auto", fontSize: 15 },
  valueList: { display: "flex", flexDirection: "column", gap: 7, marginTop: 10 },
  valueRow: { fontSize: 13, lineHeight: 1.45 },
  finalBox: { marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(120,120,120,0.08)", fontWeight: 850 },
  bigOutcome: { fontWeight: 950, fontSize: 18 },
  materialToolbar: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 18 },
  materialSearch: { width: "100%", padding: 14, borderRadius: 14, outline: "none", fontSize: 14 },
  addMaterialBtn: { border: "none", color: "white", borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontWeight: 850, whiteSpace: "nowrap" },
  addMaterialPanel: { borderRadius: 18, padding: 18, marginBottom: 18, overflowY: "auto", maxHeight: 390 },
  addMaterialHeader: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: 13, opacity: 0.9 },
  addMaterialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  addMaterialTextarea: { width: "100%", minHeight: 70, borderRadius: 12, padding: 12, outline: "none", resize: "vertical", marginBottom: 14 },
  saveMaterialBtn: { width: "100%", border: "none", color: "white", borderRadius: 14, padding: 14, fontWeight: 850, cursor: "pointer" },
  materialGrid: { flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, paddingRight: 4 },
  materialCard: { borderRadius: 18, padding: 18, lineHeight: 1.45, fontSize: 13 },
  materialHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  materialActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  smallUseBtn: { border: "none", color: "white", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" },
  smallDeleteMaterialBtn: { border: "none", color: "#991b1b", background: "#fee2e2", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" },
  customTag: { display: "inline-flex", marginTop: 5, fontSize: 11, fontWeight: 850, opacity: 0.68 },
  materialCodes: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, marginBottom: 12, opacity: 0.8 },
  materialProps: { padding: 10, borderRadius: 12, background: "rgba(120,120,120,0.08)", marginBottom: 10, lineHeight: 1.5 },
  accountButtonRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4, marginBottom: 4 },
  miniPrimaryBtn: { border: "none", color: "white", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 800 },
  miniDangerBtn: { border: "none", color: "#991b1b", background: "#fee2e2", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 800 },
};
