// FILE: api/chat.ts


import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

type ChatMessage = {
  role?: string;
  text?: string;
};

type AnalysisMode =
  | "chat"
  | "project"
  | "bom"
  | "solidworks"
  | "advanced_check"
  | "drawing"
  | "step"
  | "file";

type DrawingImageInput = {
  label?: string;
  dataUrl?: string;
};

type RequestBodyData = {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  imageDataUrl: string;
  drawingImages: DrawingImageInput[];
  fileMeta: string;
  hasFile: boolean;
  analysisMode: AnalysisMode;
  projectContext?: string;
};

type GuestUsageInfo = {
  used: number;
  limit: number;
  fileUsed: number;
  fileLimit: number;
  windowStartedAt: string;
};

type AuthResult =
  | { ok: true; mode: "user"; userId: string; supabase: any }
  | { ok: true; mode: "guest"; guestId: string; supabase: any; usage: GuestUsageInfo }
  | { ok: false; response: Response };

type ModelRoute = {
  level: "fast" | "medium" | "hard";
  model: string;
  maxTokens: number;
  timeoutMs: number;
  reason: string;
};

const GUEST_TEXT_LIMIT_24H = 10;
const GUEST_FILE_LIMIT_24H = 2;
const GUEST_WINDOW_HOURS = 24;
const GUEST_WINDOW_MS = GUEST_WINDOW_HOURS * 60 * 60 * 1000;

const TECHAI_FORMATTING_RULES =
  `

REGOLE DI FORMATTAZIONE OBBLIGATORIE:
- Non usare mai Markdown grezzo visibile.
- Non usare asterischi per il grassetto, quindi evita testi tipo **Materiale**.
- Non usare titoli Markdown con #, ## o ###.
- Non usare separatori Markdown tipo ---.
- Non usare tabelle Markdown con il carattere |. Scrivi le tabelle come elenco di righe, non come griglia testuale.
- Usa titoli puliti, numerati o in maiuscolo, ad esempio: 4. COME PROCEDERE NEL DISEGNO.
- Usa elenchi puntati semplici con il simbolo •.
- Per le sintesi usa blocchi numerati, non tabelle Markdown.
- Mantieni un layout tecnico, ordinato e professionale, adatto a un software industriale.
- Se devi scrivere codice perché richiesto dall'utente, puoi usare blocchi codice; in tutti gli altri casi evita sintassi Markdown visibile.

ESEMPIO DI STILE CORRETTO:
4. COME PROCEDERE NEL DISEGNO

• Seleziona le superfici di riferimento:
  superfici di appoggio, fori di riferimento, superfici di montaggio.

• Definisci i datum:
  etichetta le superfici con lettere A, B, C.

• Inserisci i simboli GD&T:
  specifica tolleranze, valori numerici e riferimenti datum.

IN SINTESI

1. Superfici di riferimento
   Scegli superfici funzionali, di appoggio o di montaggio.

2. Datum
   Assegna lettere A, B, C alle superfici principali.

3. Tolleranze GD&T
   Inserisci simboli, valori e riferimenti datum.
`;




const MECHANICAL_KNOWLEDGE_BASE =
  `
KNOWLEDGE BASE TECNICA MECCANICA (dati di riferimento — cita sempre la fonte/norma quando usi questi dati):

═══ PROPRIETÀ MECCANICHE ACCIAI COMUNI ═══
Acciai da costruzione (UNI EN 10025):
- S235JR: Re=235 MPa, Rm=360-510 MPa, A%=26, uso: carpenteria leggera, telai, staffature
- S275JR: Re=275 MPa, Rm=410-560 MPa, A%=23, uso: strutture, piastre, supporti
- S355JR: Re=355 MPa, Rm=470-630 MPa, A%=22, uso: strutture sollecitate, bracci, traverse

Acciai da bonifica (UNI EN 10083):
- C40 (1.0511): Re=460 MPa, Rm=650-800 MPa, HRC 20-30, uso: alberi, perni, boccole
- C45 (1.0503): Re=490 MPa, Rm=700-850 MPa, HRC 22-32, uso: alberi, ingranaggi, assi
- 42CrMo4 (1.7225): Re=650 MPa, Rm=900-1100 MPa, HRC 28-36, uso: alberi sollecitati, ingranaggi, bielle
- 39NiCrMo3 (1.6510): Re=735 MPa, Rm=930-1130 MPa, HRC 28-36, uso: alberi elevate prestazioni, mozzi
- 34CrNiMo6 (1.6582): Re=800 MPa, Rm=1000-1200 MPa, HRC 30-38, uso: alberi critici, riduttori pesanti

Acciai da cementazione (UNI EN 10084):
- 16MnCr5 (1.7131): Re=590 MPa (cuore), HRC 58-62 (superficie), uso: ingranaggi, perni, camme
- 20MnCr5 (1.7147): Re=640 MPa (cuore), HRC 58-62 (superficie), uso: ingranaggi carichi elevati
- 18CrNiMo7-6 (1.6587): Re=685 MPa (cuore), HRC 58-62 (superficie), uso: ingranaggi riduttori pesanti

Acciai inossidabili (UNI EN 10088):
- AISI 304 (1.4301): Re=210 MPa, Rm=520-720 MPa, amagnetico, uso: alimentare, chimico, estetico
- AISI 316 (1.4401): Re=220 MPa, Rm=520-680 MPa, resistenza cloruri, uso: marino, farmaceutico
- AISI 420 (1.4021): Re=600 MPa, Rm=750-950 MPa, temperabile, uso: stampi, coltelli, punzoni
- AISI 440C (1.4125): Re=450 MPa (bonificato), Rm=760 MPa, HRC 56-58, uso: cuscinetti speciali, utensili

Ghise:
- EN-GJL-250 (grigia lamellare): Rm=250 MPa, Re~165 MPa, uso: basamenti, carter, flange
- EN-GJS-500-7 (sferoidale): Re=320 MPa, Rm=500 MPa, A%=7, uso: mozzi, bielle, leve
- EN-GJS-700-2 (sferoidale perlitica): Re=420 MPa, Rm=700 MPa, A%=2, uso: ingranaggi, camme

Alluminio (UNI EN 573/755):
- 6060 T6: Re=150 MPa, Rm=195 MPa, densita 2.70 g/cm3, uso: profili estrusi, telai leggeri
- 6082 T6: Re=260 MPa, Rm=310 MPa, densita 2.71 g/cm3, uso: strutture, piastre, mozzi
- 7075 T6: Re=505 MPa, Rm=570 MPa, densita 2.81 g/cm3, uso: aeronautica, parti sollecitate

═══ FILETTATURE METRICHE ISO (ISO 261/262) ═══
Passo grosso:
M3 p=0.5, M4 p=0.7, M5 p=0.8, M6 p=1.0, M8 p=1.25, M10 p=1.5, M12 p=1.75, M14 p=2.0, M16 p=2.0, M20 p=2.5, M24 p=3.0, M30 p=3.5, M36 p=4.0
Passo fine:
M8x1, M10x1, M10x1.25, M12x1.25, M12x1.5, M14x1.5, M16x1.5, M20x1.5, M20x2, M24x2, M30x2, M36x3
Area resistente As (mm2):
M3=5.03, M4=8.78, M5=14.2, M6=20.1, M8=36.6, M10=58.0, M12=84.3, M14=115, M16=157, M20=245, M24=353, M30=561, M36=817

═══ CLASSI DI RESISTENZA BULLONERIA (ISO 898-1) ═══
Classe 4.6: Re=240 MPa, Rm=400 MPa — uso generico non sollecitato
Classe 5.6: Re=300 MPa, Rm=500 MPa — medio carico
Classe 8.8: Re=640 MPa, Rm=800 MPa — uso strutturale/meccanico (la piu comune)
Classe 10.9: Re=940 MPa, Rm=1040 MPa — alte prestazioni, precarico elevato
Classe 12.9: Re=1100 MPa, Rm=1220 MPa — massime prestazioni, critico

Precarico consigliato Fi = 0.9 * Re * As (per serraggio controllato)
Coppia: T = K * d * Fi (K = 0.20 secco, 0.16 oliato, 0.12 lubrificante MoS2)

═══ CUSCINETTI VOLVENTI (ISO 281 — formule base) ═══
Durata nominale: L10 = (C/P)^p * 10^6 giri (p=3 sfere, p=10/3 rulli)
Durata in ore: L10h = L10 / (60 * n) dove n = giri/min
Carico equivalente: P = X*Fr + Y*Fa (valori X,Y da catalogo)
Criteri di scelta:
- Carico radiale puro: cuscinetti rigidi a sfere (6xxx), rulli cilindrici (NUxxx)
- Carico combinato: cuscinetti a contatto obliquo (72xx), conici (3xxxx)
- Carichi assiali puri: reggispinta a sfere (51xx), rullini assiali (AXK)
- Disallineamento: cuscinetti orientabili a sfere (12xx/22xx), rulli (23xxx)
Interferenze montaggio:
- Anello rotante rispetto al carico: interferenza (k5/k6/m5/m6)
- Anello fisso rispetto al carico: gioco (H7/js6/h6)

═══ LINGUETTE PARALLELE (UNI 6604 / DIN 6885) ═══
Dimensioni in funzione del diametro albero d:
d 6-8: b=2, h=2 | d 8-10: b=3, h=3 | d 10-12: b=4, h=4 | d 12-17: b=5, h=5
d 17-22: b=6, h=6 | d 22-30: b=8, h=7 | d 30-38: b=10, h=8 | d 38-44: b=12, h=8
d 44-50: b=14, h=9 | d 50-58: b=16, h=10 | d 58-65: b=18, h=11 | d 65-75: b=20, h=12
d 75-85: b=22, h=14 | d 85-95: b=25, h=14 | d 95-110: b=28, h=16

Verifica a rifollamento: sigma_rif = 2*Mt / (d * h_eff * L_eff) <= sigma_amm
Verifica a taglio: tau = 2*Mt / (d * b * L_eff) <= tau_amm

═══ SEEGER / ANELLI ELASTICI (DIN 471 albero, DIN 472 foro) ═══
Esempio dimensioni gola:
d=10: gola 9.3, spessore 1.0 | d=15: gola 14.0, spessore 1.0 | d=20: gola 19.0, spessore 1.2
d=25: gola 23.9, spessore 1.2 | d=30: gola 28.6, spessore 1.5 | d=35: gola 33.2, spessore 1.5
d=40: gola 37.5, spessore 1.75 | d=50: gola 47.0, spessore 2.0 | d=60: gola 57.0, spessore 2.5

═══ CRITERI DI RESISTENZA ═══
Von Mises: sigma_eq = sqrt(sigma^2 + 3*tau^2) — stati piani
Von Mises generalizzato: sigma_eq = sqrt(sigma_x^2 + sigma_y^2 - sigma_x*sigma_y + 3*tau_xy^2)
Tresca: tau_max = 0.5*sqrt(sigma^2 + 4*tau^2) oppure sigma_eq_Tresca = 2*tau_max
Goodman modificato: 1/n = sigma_a/Sn + sigma_m/Rm (fatica con carico medio non nullo)
Soderberg: 1/n = sigma_a/Sn + sigma_m/Re (piu conservativo di Goodman)
Limite a fatica stimato: Sn' circa 0.5*Rm per acciai (Rm < 1400 MPa), poi fattori correttivi:
  Sn = Sn' * ka * kb * kc * kd * ke
  ka = fattore finitura, kb = fattore dimensione, kc = fattore affidabilita, kd = fattore temperatura, ke = fattore vari

═══ FORMULE SEZIONI RESISTENTI ═══
Circolare piena (d):
  A = pi*d^2/4, Jf = pi*d^4/64, Wf = pi*d^3/32, Wt = pi*d^3/16
Circolare cava (D esterno, d interno):
  A = pi*(D^2-d^2)/4, Jf = pi*(D^4-d^4)/64, Wf = pi*(D^4-d^4)/(32*D), Wt = pi*(D^4-d^4)/(16*D)
Rettangolare piena (b x h):
  A = b*h, Jf = b*h^3/12 (attorno asse h), Wf = b*h^2/6
Rettangolare cava (B x H esterno, b x h interno):
  A = B*H - b*h, Jf = (B*H^3 - b*h^3)/12
Tubo sottile (D medio, s spessore):
  A circa pi*D*s, Jf circa pi*D^3*s/8, Wt circa pi*D^2*s/2

═══ SALDATURE (ISO 2553 + ISO 5817) ═══
Cordone a angolo — gola utile: a = 0.7 * cateto minore
Tensione ammissibile saldatura: circa 0.65-0.85 * sigma_amm materiale base (dipende da livello qualita ISO 5817: B, C, D)
Verifica: sigma_sald = F / (a * L_eff) <= sigma_amm_sald
Per saldature a T sollecitate a flessione: Wf_sald = a * L^2 / 6
Simboli ISO 2553: freccia lato cordone, linea continua = lato freccia, linea tratteggiata = lato opposto

═══ RECIPIENTI IN PRESSIONE (EN 13445 / PED) ═══
Cilindro parete sottile: sigma_circ = p*D/(2*s), sigma_ass = p*D/(4*s)
Cilindro parete spessa (Lame): sigma_r e sigma_circ con formule di Lame
Condizione parete sottile: s/D < 1/10
Spessore minimo: s_min = p*D / (2*sigma_amm*eta - p) + c (c = sovraspessore corrosione, eta = efficienza giunto)

═══ INGRANAGGI (base Lewis + cenni AGMA) ═══
Tensione al piede dente (Lewis semplificato): sigma_f = Ft / (b * m * Y)
  Ft = forza tangenziale = 2*Mt/d, b = larghezza dente, m = modulo, Y = fattore di Lewis
Moduli standard: 0.5, 0.8, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20
Rapporto di trasmissione: i = z2/z1 = n1/n2
Interasse: a = m*(z1+z2)/2
Pressione specifica Hertz (contatto): sigma_H = ZE * sqrt(Ft * KA * Kv / (b * d1) * (i+1)/i)

═══ MOLLE ELICOIDALI (EN 13906) ═══
Tensione torsionale: tau = 8*F*D / (pi*d^3) * K (K = fattore Wahl)
Rigidezza: k = G*d^4 / (8*D^3*n) (n = spire attive)
Freccia: f = F/k = 8*F*D^3*n / (G*d^4)
Fattore Wahl: K = (4C-1)/(4C-4) + 0.615/C dove C = D/d (indice della molla)
G acciaio armonico = 81500 MPa, G inox = 70000 MPa

═══ CONTATTO HERTZIANO ═══
Sfere su piano: sigma_max = 0.388 * (F*E^2 / R^2)^(1/3)
Cilindri paralleli: sigma_max = 0.418 * sqrt(F*E / (L*R))
Dove R = raggio equivalente = R1*R2/(R1+R2), E = modulo elastico equivalente

═══ OLEODINAMICA (cenni) ═══
Forza cilindro: F = p * A (A = area pistone, p = pressione)
Portata pompa: Q = V * n / eta_vol (V = cilindrata, n = giri/min, eta_vol circa 0.9-0.95)
Velocita cilindro: v = Q / A
Potenza: P = p * Q / eta_tot (eta_tot circa 0.75-0.85)
Diametro tubo: d = sqrt(4*Q / (pi*v_max)) — v_max: aspirazione 1-1.5 m/s, mandata 3-6 m/s, ritorno 2-4 m/s

═══ TOLLERANZE GENERALI ISO 2768 ═══
Classe f (fine):
  0.5-6mm: +/-0.05 | 6-30mm: +/-0.1 | 30-120mm: +/-0.15 | 120-400mm: +/-0.2 | 400-1000mm: +/-0.3
Classe m (media):
  0.5-6mm: +/-0.1 | 6-30mm: +/-0.2 | 30-120mm: +/-0.3 | 120-400mm: +/-0.5 | 400-1000mm: +/-0.8
Classe c (grossolana):
  0.5-6mm: +/-0.2 | 6-30mm: +/-0.5 | 30-120mm: +/-0.8 | 120-400mm: +/-1.2 | 400-1000mm: +/-2.0
`;


const TECHNICAL_STANDARDS_RULES =
  `

REGOLE OBBLIGATORIE SUI RIFERIMENTI NORMATIVI:
- Quando rispondi a domande tecniche, indica sempre le norme o i riferimenti tecnici utili, quando pertinenti.
- Non scrivere solo "secondo normativa": indica la norma probabile e il motivo per cui è collegata al caso.
- Per disegno tecnico, viste, sezioni e rappresentazione: cita ISO 128 quando pertinente.
- Per tolleranze geometriche, datum, planarità, parallelismo, perpendicolarità, posizione, concentricità/coassialità: cita ISO 1101 quando pertinente.
- Per tolleranze dimensionali e accoppiamenti tipo H7, h6, g6, f7, k6, m6, s6: cita ISO 286 quando pertinente.
- Per rugosità e stato delle superfici: cita ISO 1302 quando pertinente.
- Per tolleranze generali dimensionali/geometriche: cita ISO 2768 quando pertinente.
- Per filettature metriche: cita ISO 965 oppure ISO 261/262 quando pertinente.
- Per viti, bulloni e classi 8.8, 10.9, 12.9: cita ISO 898-1 quando pertinente.
- Per materiali metallici cita la norma materiale specifica quando nota, ad esempio UNI EN 10025, UNI EN 10083, UNI EN 10088, UNI EN 10277, UNI EN 10087.
- Per saldature cita ISO 2553 per simboli di saldatura e ISO 5817 per livelli di qualità quando pertinente.
- Per cuscinetti, linguette, seeger, spine e componenti normalizzati cita la norma o il catalogo tecnico di riferimento se conosciuto; se non sei sicuro scrivi "riferimento tecnico da verificare".
- Se non sei sicuro della norma precisa, non inventare: scrivi "norma da confermare in base al componente e al settore applicativo".
`;

const TECHNICAL_DEPTH_RULES =
    MECHANICAL_KNOWLEDGE_BASE +
  `

REGOLE DI APPROFONDIMENTO TECNICO:
- Le risposte tecniche devono essere complete, motivate e utili per progettazione, verifica o correzione.
- Evita risposte troppo corte quando la domanda riguarda tavole, materiali, tolleranze, rugosità, dimensionamenti, elettronica, automazione, oleodinamica, CAD, codice o API.
- Quando analizzi un problema tecnico, usa sempre sezioni ordinate e spiega il perché tecnico delle scelte.
- Indica dati usati, dati mancanti, ipotesi, controlli consigliati e rischi principali.
- Per calcoli tecnici indica: dati, formule, sostituzione numerica quando possibile, risultato, unità di misura, verifica e conclusione.
- Per tavole tecniche indica: cartiglio, materiale, viste/sezioni, quote funzionali, tolleranze dimensionali, tolleranze geometriche, rugosità, filetti/fori, criticità, norme utili e giudizio finale.
- Per codice indica: problema individuato, causa probabile, modifica da fare, codice corretto o blocco da sostituire, e test da eseguire.
- Per componenti meccanici indica: funzione, sollecitazioni principali, controlli da fare, norme/riferimenti e dati necessari per confermare.
- Non inventare dati mancanti: quando un dato non c'è, dichiaralo e spiega come recuperarlo o verificarlo.
- Sii diretto, ma non superficiale: preferisci una risposta tecnica corposa rispetto a una risposta minimale.
- Le risposte devono essere COMPLETE: non troncare calcoli, procedure o elenchi a meta'.
- Quando spieghi una formula, mostra sempre la sostituzione numerica con i valori disponibili.
- Per domande pratiche di progettazione dai sempre valori concreti, non solo principi generali.
`;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeAnalysisMode(value: string | null | undefined): AnalysisMode {
  const mode = String(value || "chat").trim().toLowerCase();

  if (
    mode === "project" ||
    mode === "bom" ||
    mode === "solidworks" ||
    mode === "advanced_check" ||
    mode === "drawing" ||
    mode === "step" ||
    mode === "file"
  ) {
    return mode;
  }

  return "chat";
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function isOlderThan24Hours(dateValue: string | null | undefined) {
  if (!dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  return Date.now() - date.getTime() >= GUEST_WINDOW_MS;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 18000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildStepMetadata(file: File) {
  const name = file.name || "file STEP";
  const lowerName = name.toLowerCase();
  const ext = lowerName.endsWith(".stp") ? "STP" : lowerName.endsWith(".step") ? "STEP" : "STEP/STP";
  const sizeKb = (file.size / 1024).toFixed(1);

  return (
    `\n\nMetadata file CAD:\n` +
    `Nome: ${name}\n` +
    `Formato stimato: ${ext}\n` +
    `Dimensione: ${sizeKb} KB\n` +
    `Nota: in ambiente Edge non viene ricostruita la geometria 3D, ma posso analizzare metadata, intestazione STEP, nomi entità e testo tecnico se leggibile.\n`
  );
}

async function readRequestBody(req: Request): Promise<RequestBodyData> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const message = String(formData.get("message") || "");
    const messagesRaw = String(formData.get("messages") || "[]");
    const profileRaw = String(formData.get("profile") || "{}");
    const file = formData.get("file");
    const preExtractedText = formData.get("fileText");
    const drawingImagesRaw = String(formData.get("drawingImages") || "[]");
    const projectContextRaw = String(formData.get("projectContext") || "");
    const analysisMode = normalizeAnalysisMode(String(formData.get("analysisMode") || "chat"));
    const preExtractedTextClean =
      typeof preExtractedText === "string" ? preExtractedText.trim() : "";

    const messages = safeJsonParse<ChatMessage[]>(messagesRaw, []);
    const profile = safeJsonParse<any>(profileRaw, {});
    const drawingImagesParsed = safeJsonParse<DrawingImageInput[]>(drawingImagesRaw, []);

    let fileText = "";
    let imageDataUrl = "";
    let drawingImages: DrawingImageInput[] = [];
    let fileMeta = "";
    let hasFile = false;

    if (file instanceof File && file.size > 0) {
      hasFile = true;

      const fileName = file.name || "file caricato";
      const fileType = file.type || "sconosciuto";
      const fileSizeKb = (file.size / 1024).toFixed(1);
      const lowerName = fileName.toLowerCase();

      fileMeta =
        `File caricato:\n` +
        `Nome: ${fileName}\n` +
        `Tipo: ${fileType}\n` +
        `Dimensione: ${fileSizeKb} KB\n` +
        `Modalità analisi: ${analysisMode}\n`;

      if (file.type.startsWith("image/")) {
        // Quando il frontend usa src/utils/technicalDrawingUtils.ts, spesso invia:
        // - un file immagine leggero solo come riferimento/preview;
        // - drawingImages già pronti con crop della tavola;
        // - fileText già estratto dal PDF.
        // In quel caso non riconvertiamo il file immagine in base64: useremo i crop già pronti.
        if (!(analysisMode === "drawing" && Array.isArray(drawingImagesParsed) && drawingImagesParsed.length > 0)) {
          const buffer = await file.arrayBuffer();
          const base64 = arrayBufferToBase64(buffer);
          imageDataUrl = `data:${file.type};base64,${base64}`;
        }

        if (preExtractedTextClean) {
          fileText = `\n\nTesto estratto/preparato dal frontend:\n${preExtractedTextClean.slice(0, 26000)}`;
        }
      } else if (lowerName.endsWith(".step") || lowerName.endsWith(".stp")) {
        fileText = buildStepMetadata(file);

        try {
          const text = await file.text();
          if (text.trim()) {
            fileText += `\n\nEstratto iniziale STEP/STP:\n${text.slice(0, 16000)}`;
          }
        } catch {
          fileText += "\n\nNon sono riuscito a leggere il contenuto testuale del file STEP/STP.";
        }
      } else if (preExtractedTextClean) {
        fileText = `\n\nTesto estratto/preparato dal frontend:\n${preExtractedTextClean.slice(0, 26000)}`;
      } else {
        try {
          const text = await file.text();
          fileText = text?.trim()
            ? `\n\nContenuto del file:\n${text.slice(0, 16000)}`
            : "\n\nIl file non contiene testo leggibile direttamente.";
        } catch {
          fileText = "\n\nNon sono riuscito a leggere il contenuto testuale del file.";
        }
      }
    }

    if (Array.isArray(drawingImagesParsed) && drawingImagesParsed.length > 0) {
      drawingImages = drawingImagesParsed
        .filter((img) => img?.dataUrl && String(img.dataUrl).startsWith("data:image/"))
        .map((img) => ({
          label: String(img.label || "Crop tavola"),
          dataUrl: String(img.dataUrl),
        }))
        .slice(0, 12);
    }

    return {
      message,
      messages,
      profile,
      fileText,
      imageDataUrl,
      drawingImages,
      fileMeta,
      hasFile,
      analysisMode,
      projectContext: projectContextRaw,
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    message: body.message || "",
    messages: body.messages || [],
    profile: body.profile || {},
    fileText: body.fileText || "",
    imageDataUrl: "",
    drawingImages: Array.isArray(body.drawingImages)
      ? body.drawingImages
          .filter((img: DrawingImageInput) => img?.dataUrl && String(img.dataUrl).startsWith("data:image/"))
          .map((img: DrawingImageInput) => ({
            label: String(img.label || "Crop tavola"),
            dataUrl: String(img.dataUrl),
          }))
          .slice(0, 12)
      : [],
    fileMeta: body.fileMeta || "",
    hasFile: Boolean(body.hasFile),
    analysisMode: normalizeAnalysisMode(body.analysisMode),
  };
}

function chooseOpenAITextModel(params: {
  message: string;
  fileText: string;
  analysisMode: AnalysisMode;
}): ModelRoute {
  const message = String(params.message || "");
  const fileText = String(params.fileText || "");
  const analysisMode = params.analysisMode || "chat";

  const routingText = `${message}
${fileText}
${analysisMode}`.toLowerCase();

  const fastModel =
    process.env.OPENAI_TEXT_MODEL_FAST ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.OPENAI_API_MODEL ||
    "gpt-4o-mini";

  const mediumModel =
    process.env.OPENAI_TEXT_MODEL_MEDIUM ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.OPENAI_API_MODEL ||
    "gpt-4o-mini";

  const hardModel =
    process.env.OPENAI_TEXT_MODEL_HARD ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.OPENAI_API_MODEL ||
    "gpt-4o";

  let score = 0;
  const reasons: string[] = [];

  if (analysisMode !== "chat") {
    score += 3;
    reasons.push(`modalità ${analysisMode}`);
  }

  if (analysisMode === "bom" || analysisMode === "advanced_check" || analysisMode === "project") {
    score += 3;
    reasons.push("analisi strutturata progetto/distinta/verifica");
  }

  if (analysisMode === "solidworks") {
    score += 2;
    reasons.push("procedura guidata SolidWorks");
  }

  if (analysisMode === "step") {
    score += 3;
    reasons.push("metadata STEP/STP");
  }

  if (fileText.trim().length > 0) {
    score += 4;
    reasons.push("file allegato");
  }

  if (message.length > 1000) {
    score += 2;
    reasons.push("prompt lungo");
  }

  if (routingText.length > 6000) {
    score += 3;
    reasons.push("contesto lungo nel prompt");
  }

  if (
    /errore|error|build|typescript|react|vite|vercel|supabase|api\/chat|codice|script|tsx|ts|javascript|funzione|debug|console|runtime|deploy|backend|frontend/i.test(routingText)
  ) {
    score += 3;
    reasons.push("codice/debug");
  }

  if (
    /calcola|verifica|dimensiona|flessione|torsione|taglio|von mises|tresca|fatica|goodman|soderberg|precarico|bullone|bulloni|contatto|pressione specifica|coefficiente|momento|tensione|formula|meccanica|albero|perno|cuscinetto|linguetta/i.test(routingText)
  ) {
    score += 3;
    reasons.push("calcolo tecnico avanzato");
  }

  if (
    /tavola|disegno tecnico|rugosità|rugosita|tolleranza|gd&t|quota|quote funzionali|funzionale|critica|accoppiamento|sede|interasse|asola|battuta|datum|sezione|cartiglio|materiale|acciaio|c45|42crmo4|aisi|inventor|solidworks|step|stp|distinta|bom|csv|json/i.test(routingText)
  ) {
    score += 3;
    reasons.push("argomento tecnico CAD/progetto");
  }

  if (
    /riassumi|spiega|confronta|analizza|migliora|riscrivi|ottimizza|progetta|scrivimi completo|copia e incolla/i.test(routingText)
  ) {
    score += 1;
    reasons.push("richiesta articolata");
  }

  if (message.length < 120 && score <= 1) {
    return {
      level: "fast",
      model: fastModel,
      maxTokens: 1800,
      timeoutMs: 28000,
      reason: "domanda breve/semplice",
    };
  }

  if (score >= 6) {
    return {
      level: "hard",
      model: hardModel,
      maxTokens: 4000,
      timeoutMs: 50000,
      reason: reasons.join(", ") || "richiesta complessa",
    };
  }

  return {
    level: "medium",
    model: mediumModel,
    maxTokens: 3600,
    timeoutMs: 44000,
    reason: reasons.join(", ") || "richiesta media",
  };
}

function buildLightSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
  analysisMode: AnalysisMode;
}) {
  const { userName, focus, route, analysisMode } = params;

  return (
    `Sei TechAI, assistente tecnico per meccanica industriale e sviluppo React/TypeScript.\n` +
    `Utente: ${userName}. Focus: ${focus}. Modalità: ${analysisMode}. Livello: ${route.level}. Motivo: ${route.reason}.\n` +
    `Rispondi nella stessa lingua dell'utente. Sii tecnico, pratico, ordinato e sufficientemente approfondito. ` +
    `Non inventare dati. Se mancano dati, dichiarali e spiega quali servono. ` +
    `Per codice, dai modifiche complete e copiabili. Per problemi tecnici, includi motivazione, riferimenti normativi quando pertinenti e controlli consigliati.` +
    TECHNICAL_STANDARDS_RULES +
    TECHNICAL_DEPTH_RULES +
    MECHANICAL_KNOWLEDGE_BASE +
    TECHAI_FORMATTING_RULES
  );
}

function buildModeInstructions(analysisMode: AnalysisMode) {
  if (analysisMode === "project") {
    return (
      `\n\n## MODALITÀ PROGETTO\n` +
      `Devi aiutare l'utente a gestire un progetto tecnico meccanico.\n` +
      `Quando possibile struttura la risposta così:\n` +
      `1. Stato progetto\n` +
      `2. Verifiche salvabili\n` +
      `3. File caricati e cosa rappresentano\n` +
      `4. Criticità tecniche\n` +
      `5. Prossime azioni consigliate\n` +
      `Se l'utente carica un file, crea una prima analisi iniziale e suggerisci in quale sezione del progetto salvarlo.\n`
    );
  }

  if (analysisMode === "bom") {
    return (
      `\n\n## MODALITÀ CONTROLLO DISTINTA BASE / BOM\n` +
      `Analizza CSV/JSON o testo di distinta componenti.\n` +
      `Controlla in modo concreto: codici duplicati, materiali mancanti, quantità incoerenti, descrizioni incomplete, componenti commerciali senza norma, viti senza classe, cuscinetti senza sigla completa, trattamenti mancanti e unità mancanti.\n` +
      `Output richiesto: tabella con Riga / Problema / Gravità / Correzione consigliata e riepilogo finale. Non inventare righe non presenti.\n`
    );
  }

  if (analysisMode === "solidworks") {
    return (
      `\n\n## MODALITÀ ASSISTENTE SOLIDWORKS PRATICO\n` +
      `Usa questa struttura: Metodo consigliato, Comandi SolidWorks in italiano, Passaggi operativi numerati, Errori comuni, Quando NON usare questo metodo, Controllo finale prima della messa in tavola.\n`
    );
  }

  if (analysisMode === "advanced_check") {
    return (
      `\n\n## MODALITÀ VERIFICHE SERIE\n` +
      `Considera statica, Von Mises, Tresca, fatica Goodman/Soderberg, contatti, bulloni, linguette, cuscinetti, tolleranze e rugosità. Struttura: dati usati, formule, calcoli con unità, esito, dati mancanti.\n`
    );
  }

  if (analysisMode === "step") {
    return (
      `\n\n## MODALITÀ STEP/STP\n` +
      `Analizza metadata e testo STEP/STP quando disponibili. Non dire che vedi perfettamente il 3D. Dai anche indicazioni per importarlo in SolidWorks e renderlo modificabile.\n`
    );
  }

 if (analysisMode === "drawing") {
  return (
    `\n\n## MODALITÀ PRE-LETTURA TAVOLA TECNICA - STRICT MODE\n` +
    `Devi analizzare la tavola tecnica in modo accurato.\n\n` +

    `REGOLE ANTI-ERRORE OBBLIGATORIE:\n` +
    `- Non inventare quote, tolleranze, materiali, rugosità, filetti, fori, trattamenti o note.\n` +
    `- Se un dato non è chiaramente leggibile, scrivi esattamente: "non rilevabile dalla tavola".\n` +
    `- Non dichiarare un errore tecnico se non hai evidenza chiara dalla tavola.\n` +
    `- Non dedurre materiale, scala, unità o trattamento se non sono visibili nel cartiglio o nelle note.\n` +
    `- Non trasformare una mancanza di leggibilità in un errore di progettazione.\n` +
    `- Se l'immagine/PDF è poco leggibile, segnala prima il limite di qualità.\n` +
    `- Distingui sempre tra "rilevato", "incerto" e "non rilevabile".\n` +
    `- Per le quote funzionali non usare certezze assolute se non conosci l'assieme: usa "probabilmente funzionale", "potenzialmente critica" o "da verificare".\n\n` +

    `ANALISI QUOTE FUNZIONALI E CRITICHE:\n` +
    `Devi individuare, quando leggibili, le quote che possono influenzare montaggio, accoppiamento, centraggio, battuta, scorrimento, tenuta, resistenza, lavorazione o controllo qualità.\n` +
    `Classifica ogni quota rilevante in una di queste categorie:\n` +
    `- Funzionale probabile: quota che sembra influenzare montaggio, accoppiamento o funzione del pezzo.\n` +
    `- Critica: quota che, se errata, può compromettere montaggio, funzionamento, sicurezza, intercambiabilità o produzione.\n` +
    `- Descrittiva/secondaria: quota utile a definire la forma ma non chiaramente legata alla funzione principale.\n` +
    `- Non valutabile: quota non leggibile o funzione non deducibile dalla tavola.\n\n` +

    `Considera funzionali probabili soprattutto:\n` +
    `- diametri di fori, perni, alberi, sedi cuscinetto, sedi boccole e sedi spine;\n` +
    `- interassi tra fori, cave, asole e riferimenti di montaggio;\n` +
    `- larghezze/profondità di cave, scanalature, asole, lamature e svasature;\n` +
    `- spessori di battute, appoggi, flange, pareti sottili o zone resistenti;\n` +
    `- quote con tolleranza stretta o accoppiamenti ISO tipo H7, h6, g6, f7, k6, m6, s6;\n` +
    `- quote collegate a rugosità specifiche, simboli Ra/Rz o superfici lavorate;\n` +
    `- quote collegate a tolleranze geometriche ISO 1101, datum A/B/C, posizione, planarità, parallelismo, perpendicolarità, coassialità;\n` +
    `- superfici di appoggio, centraggio, rotazione, scorrimento, tenuta o fissaggio.\n\n` +

    `Per ogni quota funzionale o critica devi scrivere:\n` +
    `- Quota rilevata.\n` +
    `- Classificazione.\n` +
    `- Confidenza: alta / media / bassa.\n` +
    `- Motivazione tecnica.\n` +
    `- Controllo consigliato.\n` +
    `- Riferimento tecnico: norma ISO/UNI applicabile oppure principio tecnico generale.\n` +
    `- Eventuale dato mancante, ad esempio tolleranza, rugosità, datum, profondità foro, quantità fori o componente accoppiato.\n\n` +

    `ESEMPI DI RAGIONAMENTO:\n` +
    `- Ø20 H7: quota funzionale critica, perché H7 indica un probabile accoppiamento con perno, albero, boccola o sede.\n` +
    `- Interasse tra due fori: quota funzionale probabile, perché influenza il montaggio del pezzo su un altro componente.\n` +
    `- Ra 0.8 su superficie cilindrica: superficie probabilmente funzionale, possibile scorrimento, tenuta o accoppiamento.\n` +
    `- Asola o cava quotata: quota funzionale probabile se serve per regolazione, guida, bloccaggio o passaggio componente.\n` +
    `- Smusso 1x45°: descrittivo/secondario, salvo funzione evidente di invito, montaggio o sicurezza.\n` +
    `- Raccordo R2 senza tolleranze particolari: descrittivo/secondario, salvo zona resistente o anticricca.\n\n` +

    `FORMATO RISPOSTA OBBLIGATORIO:\n` +
    `1. Qualità lettura tavola: buona / media / bassa, con motivo.\n` +
    `2. Dati rilevati con alta confidenza: cartiglio, materiale, scala, formato, unità, viste, sezioni, quote principali, tolleranze, rugosità, filetti, fori, note.\n` +
    `3. Quote funzionali e critiche rilevate: elenco con quota, classificazione, confidenza, motivazione e controllo consigliato.\n` +
    `4. Quote descrittive/secondarie rilevate: elenco sintetico, solo se leggibili.\n` +
    `5. Dati incerti o parzialmente leggibili: elenco con motivo dell'incertezza.\n` +
    `6. Dati non rilevabili dalla tavola: elenco se assenti o non leggibili.\n` +
    `7. Controlli consigliati al progettista: solo checklist, non conclusioni definitive.\n` +
    `8. Possibili criticità: inserisci solo criticità supportate da evidenza chiara. Per ogni criticità scrivi: evidenza osservata, rischio, verifica consigliata.\n\n` +

    `SOGLIA DI CONFIDENZA:\n` +
    `- Alta confidenza: dato chiaramente leggibile.\n` +
    `- Media confidenza: dato parzialmente leggibile; va confermato.\n` +
    `- Bassa confidenza: non usare il dato per conclusioni.\n\n` +

    `ESEMPI DI COMPORTAMENTO CORRETTO:\n` +
    `- Se vedi "C45" chiaramente nel cartiglio, puoi scrivere materiale rilevato: C45.\n` +
    `- Se il materiale sembra "C4..." ma non è chiaro, scrivi: materiale incerto, possibile C45 ma da confermare.\n` +
    `- Se non leggi la rugosità, scrivi: rugosità non rilevabile dall'immagine.\n` +
    `- Se non vedi tolleranze, non dire che sono sbagliate: scrivi tolleranze non rilevabili o non presenti nella porzione leggibile.\n` +

    `KNOWLEDGE BASE TOLLERANZE E RUGOSITA' (usa per SUGGERIRE valori concreti, non solo segnalare mancanze):\n` +
    `Accoppiamenti tipici ISO 286:\n` +
    `- Sede cuscinetto a sfera/rulli (foro): H7 - esempio: Diametro30 H7\n` +
    `- Albero per cuscinetto a sfera: k6 o js6 - esempio: Diametro30 k6\n` +
    `- Albero per cuscinetto a rulli: m6 o n6\n` +
    `- Accoppiamento scorrevole senza gioco: H7/g6 o H7/f7\n` +
    `- Accoppiamento girevole libero: H7/e8\n` +
    `- Accoppiamento fisso con interferenza leggera: H7/p6\n` +
    `- Accoppiamento fisso con interferenza forte: H7/s6\n` +
    `- Spine cilindriche: H7/n6 o H7/m6\n` +
    `- Filetti standard: 6H (foro) / 6g (vite)\n` +
    `Rugosita Ra raccomandata per tipo di superficie:\n` +
    `- Sedi cuscinetti: Ra minore uguale 0.8 micrometri\n` +
    `- Tenute O-ring e guarnizioni: Ra tra 0.4 e 0.8 micrometri\n` +
    `- Superfici di scorrimento e guide: Ra minore uguale 1.6 micrometri\n` +
    `- Superfici funzionali generali (appoggi, battute): Ra minore uguale 3.2 micrometri\n` +
    `- Filetti, raccordi, superfici secondarie: Ra minore uguale 6.3 micrometri\n` +
    `- Superfici non funzionali: Ra minore uguale 12.5 micrometri\n` +
    `Tolleranze geometriche tipiche ISO 1101:\n` +
    `- Pianezza appoggi: 0.05-0.1 mm su 100 mm\n` +
    `- Perpendicolarita spalle: 0.02-0.05 mm\n` +
    `- Coassialita sedi cuscinetto: 0.02-0.05 mm\n` +
    `- Posizione fori su cerchio bulloni: +/-0.1 mm o simbolo posizione con datum\n` +
    `ISTRUZIONE FONDAMENTALE: quando vedi un foro o sede senza tolleranza specificata, SUGGERISCI il valore ISO corretto in base alla funzione dedotta dalla geometria. Quando vedi superficie funzionale senza rugosita, SUGGERISCI Ra appropriato. Non limitarti a segnalare la mancanza: dai il valore concreto.\n` +

    `PINS_JSON (obbligatorio, SEMPRE ALL'INIZIO della risposta - PRIMA di qualsiasi testo):\n` +
    `PRIMA di scrivere qualsiasi analisi, scrivi subito il blocco JSON tra i tag <PINS> e </PINS>.\n` +
    `REGOLA FONDAMENTALE: inserisci UN PIN SEPARATO per OGNI criticita trovata. Se hai trovato 4 problemi, inserisci 4 pin. Non raggruppare tutto in un solo pin.\n` +
    `Ogni pin ha questi campi:\n` +
    `- id: stringa univoca (p1, p2, p3...)\n` +
    `- label: nome breve del problema\n` +
    `- severity: errore (critico), attenzione (da verificare), info (nota positiva)\n` +
    `- zona: OBBLIGATORIO, scegli tra: cartiglio, cartiglio_materiale, cartiglio_scala, vista_principale, vista_destra, vista_alto, sezione_aa, sezione_bb, quotatura, tolleranze, rugosita, fori_filetti, note_generali\n` +
    `- detail: descrizione breve del problema (max 120 caratteri)\n` +
    `Esempio con 3 errori trovati:\n` +
    `<PINS>\n` +
    `[{"id":"p1","label":"Materiale mancante","severity":"errore","zona":"cartiglio_materiale","detail":"Materiale non indicato nel cartiglio"},{"id":"p2","label":"Tolleranze geometriche","severity":"errore","zona":"tolleranze","detail":"Assenza GD&T su superfici funzionali"},{"id":"p3","label":"Rugosita mancante","severity":"attenzione","zona":"rugosita","detail":"Ra non specificato"}]\n` +
    `</PINS>\n` +
    `Se la tavola e corretta: [{"id":"p1","label":"Tavola approvata","severity":"info","zona":"cartiglio","detail":"Nessuna criticita rilevata"}]\n` +
    `Non omettere mai il blocco PINS. Non mettere testo fuori dai tag PINS.\n`
  );
}

  if (analysisMode === "file")
 {
    return (
      `\n\n## MODALITÀ FILE TECNICO\n` +
      `Analizza il file caricato e produci riepilogo tecnico, problemi rilevati, dati utili e azioni consigliate.\n`
    );
  }

  return "";
}


function buildProjectContextSection(projectContextRaw: string): string {
  try {
    const p = JSON.parse(projectContextRaw);
    if (!p?.name) return "";
    const lines: string[] = [];
    lines.push(`[PROGETTO ATTIVO: ${p.name}${p.description ? " — " + p.description : ""}]`);
    if (p.materials?.length) {
      lines.push("Materiali:");
      p.materials.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    if (p.verifications?.length) {
      lines.push("Verifiche:");
      p.verifications.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    if (p.calcoli?.length) {
      lines.push("Calcoli:");
      p.calcoli.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    if (p.drawings?.length) {
      lines.push("Tavole:");
      p.drawings.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    if (p.decisions?.length) {
      lines.push("Decisioni:");
      p.decisions.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    if (p.notes?.length) {
      lines.push("Note:");
      p.notes.forEach((v: any) => lines.push(`  • ${v.title}${v.summary ? ": " + v.summary : ""}`));
    }
    return lines.length > 1
      ? "\n\n[CONTESTO PROGETTO ATTIVO]\n" + lines.join("\n") + "\n[FINE CONTESTO PROGETTO]"
      : "";
  } catch {
    return "";
  }
}

function buildCompactTechAiSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
  analysisMode: AnalysisMode;
}) {
  const { userName, focus, route, analysisMode } = params;

  return (
    `Sei TechAI, copilot tecnico per ingegneria meccanica industriale.\n` +
    `Utente: ${userName}. Focus: ${focus}.\n` +
    `Livello selezionato automaticamente: ${route.level}. Motivo: ${route.reason}. Modalità: ${analysisMode}.\n\n` +
    `REGOLE RISPOSTA:\n` +
    `- Rispondi nella stessa lingua dell'utente.\n` +
    `- Sii diretto, ordinato, tecnico, pratico e approfondito quando l'argomento lo richiede.\n` +
    `- Scrivi le formule in LaTeX: \\( formula \\) per inline, \\[ formula \\] per display su riga dedicata. Esempio corretto: \\( \\sigma_{id} = \\sqrt{\\sigma^2 + 3\\tau^2} \\). Non usare Markdown grezzo visibile.\n` +
    `- Cita sempre le unità di misura.\n` +
    `- Se mancano dati, dichiarali, non inventare e spiega quali dati servono.\n` +
    `- Se la richiesta riguarda codice, dai modifiche precise e copiabili.\n` +
    `- Se l'utente chiede un file completo, riscrivi il file completo.\n` +
    `- Se si parla di componenti, disegni tecnici, materiali, tolleranze o verifiche, indica norme ISO, UNI, EN, DIN o riferimenti tecnici applicabili quando pertinenti.\n` +
    TECHNICAL_STANDARDS_RULES +
    TECHNICAL_DEPTH_RULES +
    MECHANICAL_KNOWLEDGE_BASE +
    TECHAI_FORMATTING_RULES +
    `\nPROMEMORIA TECNICO COMPATTO:\n` +
    `Meccanica: equilibrio ΣF=0, ΣM=0; F=ma; P=Fv=Mω; Mt[Nm]=9550P[kW]/n[rpm]. Trazione σ=F/A; flessione σ=Mf/Wf; torsione τ=Mt/Wt. Von Mises σid=√(σ²+3τ²). Fatica: Goodman/Soderberg. Bulloni: precarico, taglio, trazione, classe 8.8/10.9. Tolleranze: H7, k6, m6, H7/f7. Rugosità: Ra 3,2÷6,3 generica; Ra 0,8÷1,6 sedi/tenute.\n` +
    buildModeInstructions(analysisMode)
  );
}

function buildFullTechAiSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
  analysisMode: AnalysisMode;
}) {
  const { userName, focus, route, analysisMode } = params;

  return (
    `Sei TechAI, copilot tecnico per ingegneria meccanica industriale. Utente: ${userName}. Focus: ${focus}.\n` +
    `Livello selezionato automaticamente: ${route.level}. Motivo scelta: ${route.reason}. Modalità: ${analysisMode}.\n` +
    `REGOLA FONDAMENTALE - AMBITO: Rispondi SOLO a domande riguardanti ingegneria meccanica, progettazione, CAD, materiali tecnici, calcoli strutturali, tolleranze, rugosità, disegno tecnico, automazione industriale, oleodinamica, pneumatica, elettronica industriale, software tecnico (React, TypeScript, API), o supporto aziendale per aziende metalmeccaniche. ` +
    `Se la domanda riguarda storia, cultura generale, politica, sport, intrattenimento, cucina, viaggi, personaggi storici, notizie o qualsiasi argomento non tecnico-industriale, rispondi ESATTAMENTE con: ` +
    `"Non posso aiutarti su questo argomento. TechAI è specializzato in supporto tecnico per ingegneria meccanica e aziende metalmeccaniche. Hai domande su calcoli, materiali, disegno tecnico o progettazione?" ` +
    `Non fare eccezioni a questa regola, anche se l'utente insiste o riformula la domanda.\n` +
    `Rispondi in italiano, tecnico, preciso e approfondito. Per le formule usa LaTeX: \\( formula \\) per inline, \\[ formula \\] per display. Esempio: \\( \\sigma_{id} = \\sqrt{\\sigma^2 + 3\\tau^2} \\). Non usare Markdown grezzo visibile per il resto. Cita sempre le unità. Se mancano dati, dichiarali e spiega quali servono.\n` +
    `Se la richiesta riguarda codice, dai modifiche precise, copiabili e complete. Se chiede un file completo, riscrivi il file completo.\n` +
    TECHNICAL_STANDARDS_RULES +
    TECHNICAL_DEPTH_RULES +
    MECHANICAL_KNOWLEDGE_BASE +
    TECHAI_FORMATTING_RULES +
    buildModeInstructions(analysisMode) +
    `\n\n` +
    `## PROMEMORIA TECNICO\n` +
    `Newton F=ma. Equilibrio ΣF=0, ΣM=0. Potenza P=Fv=Mω. Mt[Nm]=9550P[kW]/n[rpm].\n` +
    `Trazione σ=F/A; ΔL=FL/(EA). Flessione σ=Mf/Wf. Torsione τ=Mt/Wt. Sezione circolare: Jf=πd⁴/64, Wf=πd³/32, Jp=πd⁴/32, Wt=πd³/16.\n` +
    `Von Mises σid=√(σ²+3τ²). Tresca piano σid=√(σ²+4τ²). Alberi Mid=√(Mf²+0,75Mt²), d≥∛(32Mid/(πσamm)).\n` +
    `Fatica: σm=(σmax+σmin)/2; σa=(σmax-σmin)/2; Se≈0,5Rm corretto; Goodman σa/Se+σm/Rm≤1/n; Soderberg σa/Se+σm/Re≤1/n.\n` +
    `Materiali: S235/S275/S355 carpenteria; C45 alberi/perni medi; 42CrMo4 e 39NiCrMo3 carichi alti; 16MnCr5 cementazione; 100Cr6 rulli/cuscinetti.\n` +
    `Tolleranze ISO 286: sede cuscinetto foro H7; albero rotante k6/m6; scorrevole H7/f7; fisso H7/s6. Rugosità: generiche Ra 3,2÷6,3 µm; sedi/tenute Ra 0,8÷1,6 µm; superfici molto funzionali Ra 0,4÷0,8 µm.\n` +
    `Bulloni: classi 8.8, 10.9; precarico Fp≈0,8fyAres; taglio Fv,R≈0,6fuAres/1,25; trazione FT,R≈0,9fuAres/1,25. Linguette: τ=2T/(wLDn), p=4T/(hLDn).\n` +
    `Oleoidraulica: F=pA; v=Q/A; centro aperto P→T; centro chiuso vie bloccate.\n`
  );
}



type ScopeCheckResult = {
  allowed: boolean;
  reason: string;
};

const OUT_OF_SCOPE_MESSAGE =
  "Domanda fuori ambito. Questo assistente è progettato per supportare attività tecniche legate a ingegneria, programmazione, informatica, CAD, materiali, progettazione meccanica, automazione, elettronica e analisi di tavole tecniche. Riformula la domanda in un contesto tecnico e sarò felice di aiutarti.";

function normalizeForScope(value: string) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
}

function isAllowedTechnicalScope(params: {
  message: string;
  messages: ChatMessage[];
  hasFile: boolean;
  analysisMode: AnalysisMode;
}): ScopeCheckResult {
  // Il filtro principale è nel system prompt del modello.
  // Qui blocchiamo solo casi palesemente fuori ambito per risparmiare token.
  if (params.hasFile) return { allowed: true, reason: "file allegato" };
  if (params.analysisMode !== "chat") return { allowed: true, reason: `modalità ${params.analysisMode}` };
  return { allowed: true, reason: "valutazione delegata al modello" };
}


function cleanAiOutput(text: string) {
  const withoutMarkdown = String(text || "")
    // Toglie il grassetto Markdown anche se il modello lo usa male.
    .replace(/\*\*/g, "")
    // Toglie titoli Markdown tipo #, ##, ### lasciando il testo.
    .replace(/^\s*#{1,6}\s*/gm, "")
    // Sostituisce i separatori Markdown con una riga grafica più pulita.
    .replace(/^\s*---+\s*$/gm, "────────────────────────")
    // Toglie i delimitatori dei blocchi codice quando finiscono per comparire nel testo.
    .replace(/```[a-zA-Z0-9_-]*/g, "")
    .replace(/```/g, "");

  const lines = withoutMarkdown.split("\n");

  const cleanedLines = lines.map((line) => {
    const trimmed = line.trim();

    // Rimuove righe separatrici delle tabelle Markdown: | --- | --- |
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed)) {
      return "";
    }

    // Converte righe tabellari Markdown in righe leggibili senza caratteri |.
    if (trimmed.includes("|")) {
      const cells = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean);

      if (cells.length >= 2) {
        const first = cells[0];
        const rest = cells.slice(1);

        // Esempio: | 1 | Azione | Esempio | -> 1. Azione — Esempio
        if (/^\d+[.)]?$/.test(first)) {
          return `${first.replace(/[.)]$/, "")}. ${rest.join(" — ")}`;
        }

        // Esempio: | Elemento | Problema | Correzione | -> • Elemento: Problema — Correzione
        return `• ${first}: ${rest.join(" — ")}`;
      }
    }

    return line;
  });

  return cleanedLines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isOpenAIRateLimit(status: number, raw: string) {
  const text = String(raw || "").toLowerCase();

  return (
    status === 429 ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("quota") ||
    text.includes("insufficient_quota")
  );
}

function sanitizeOpenAIFailureMessage() {
  return (
    "⚠️ In questo momento il modello AI principale è al limite.\n\n" +
    "Ho provato automaticamente una modalità più leggera, ma non è disponibile. " +
    "Riprova tra qualche minuto oppure riduci la lunghezza del messaggio."
  );
}

async function callOpenAIText(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  fileMeta: string;
  analysisMode: AnalysisMode;
  projectContext?: string;
}): Promise<string> {
  const openAiApiKey =
    process.env.OPENAI_TEXT_API_KEY ||
    process.env.OPENAI_API_KEY;

  const route = chooseOpenAITextModel({
    message: params.message,
    fileText: `${params.fileMeta}
${params.fileText}`,
    analysisMode: params.analysisMode,
  });

  if (!openAiApiKey) {
    console.error("Missing OPENAI_TEXT_API_KEY / OPENAI_API_KEY environment variable");

    return (
      "⚠️ Chat AI temporaneamente non disponibile.\n\n" +
      "Il sistema non riesce ad avviare il modello di risposta in questo momento. " +
      "Riprova tra poco o segnala il problema all’assistenza se persiste."
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const fastModel =
    process.env.OPENAI_TEXT_MODEL_FAST ||
    process.env.OPENAI_TEXT_MODEL ||
    process.env.OPENAI_API_MODEL ||
    "gpt-4o-mini";

  const fallbackRoutes: ModelRoute[] = [
    route,
    {
      level: "fast",
      model: fastModel,
      maxTokens: 1000,
      timeoutMs: 22000,
      reason: "fallback automatico economico dopo errore o limite",
    },
    {
      level: "fast",
      model: "gpt-4o-mini",
      maxTokens: 900,
      timeoutMs: 22000,
      reason: "fallback finale economico",
    },
  ];

  const uniqueRoutes = fallbackRoutes.filter((item, index, arr) => {
    return arr.findIndex((x) => x.model === item.model && x.level === item.level) === index;
  });

  let lastWasRateLimit = false;

  for (let i = 0; i < uniqueRoutes.length; i++) {
    const currentRoute = uniqueRoutes[i];
    const isFallback = i > 0 || currentRoute.level === "fast";

    const cleanHistory = Array.isArray(params.messages)
      ? params.messages
          .slice(isFallback ? -3 : -6)
          .filter((m: ChatMessage) => String(m.text || "").trim())
          .map((m: ChatMessage) => ({
            role: m.role === "AI" || m.role === "assistant" ? "assistant" : "user",
            content: String(m.text || "").slice(0, isFallback ? 1400 : 3200),
          }))
      : [];

    const fileTextLimit = isFallback ? 5000 : currentRoute.level === "hard" ? 18000 : 12000;

    const finalUserContent =
      `${params.message || "Rispondi all'utente."}` +
      `${params.fileMeta ? `

${params.fileMeta}` : ""}` +
      `${params.fileText ? `

${String(params.fileText).slice(0, fileTextLimit)}` : ""}`;

    const projectSection = params.projectContext ? buildProjectContextSection(params.projectContext) : "";
    const systemPrompt = (isFallback
      ? buildLightSystemPrompt({
          userName,
          focus,
          route: currentRoute,
          analysisMode: params.analysisMode,
        })
      : currentRoute.level === "fast"
        ? buildCompactTechAiSystemPrompt({
            userName,
            focus,
            route: currentRoute,
            analysisMode: params.analysisMode,
          })
        : buildFullTechAiSystemPrompt({
            userName,
            focus,
            route: currentRoute,
            analysisMode: params.analysisMode,
          })) + projectSection;

    let response: Response;

    try {
      response = await fetchWithTimeout(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openAiApiKey}`,
          },
          body: JSON.stringify({
            model: currentRoute.model,
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              ...cleanHistory,
              {
                role: "user",
                content: finalUserContent,
              },
            ],
            temperature:
              currentRoute.level === "fast"
                ? 0.3
                : currentRoute.level === "medium"
                  ? 0.35
                  : 0.25,
            max_tokens: currentRoute.maxTokens,
          }),
        },
        currentRoute.timeoutMs
      );
    } catch (error: any) {
      if (error?.name === "AbortError") {
        lastWasRateLimit = false;
        continue;
      }

      throw error;
    }

    const raw = await response.text();
    const data = safeJsonParse<any>(raw, null);

    if (response.ok) {
      const content =
        data?.choices?.[0]?.message?.content ||
        "Ho ricevuto la richiesta, ma il modello non ha restituito una risposta valida.";

      const cleanContent = cleanAiOutput(content);

      if (isFallback && i > 0) {
        return (
          `${cleanContent}\n\nNota: ho usato automaticamente una modalità AI più leggera perché il modello principale era al limite.`
        );
      }

      return cleanContent;
    }

    if (isOpenAIRateLimit(response.status, raw)) {
      lastWasRateLimit = true;
      continue;
    }

    if (response.status >= 500) {
      lastWasRateLimit = false;
      continue;
    }

    return (
      "⚠️ Non sono riuscito a completare la risposta con il modello AI.\n\n" +
      "Riprova tra poco oppure semplifica la richiesta."
    );
  }

  if (lastWasRateLimit) {
    return sanitizeOpenAIFailureMessage();
  }

  return (
    "⚠️ Il modello AI non ha risposto correttamente.\n\n" +
    "Riprova tra poco oppure riduci la lunghezza del messaggio."
  );
}

async function callOpenAIVision(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  imageDataUrl: string;
  drawingImages: DrawingImageInput[];
  fileText: string;
  fileMeta: string;
  analysisMode: AnalysisMode;
}): Promise<string> {
  const openAiDrawingKey =
    process.env.OPENAI_DRAWING_READER_API_KEY ||
    process.env.OPENAI_API_KEY;

  const model = process.env.OPENAI_DRAWING_READER_MODEL || "gpt-4o-mini";
  const openAiTimeoutMs = Number(process.env.OPENAI_DRAWING_TIMEOUT_MS || "45000");
  const imageDetail =
    process.env.OPENAI_DRAWING_IMAGE_DETAIL === "high" ||
    process.env.OPENAI_DRAWING_IMAGE_DETAIL === "low"
      ? process.env.OPENAI_DRAWING_IMAGE_DETAIL
      : "auto";

  if (!openAiDrawingKey) {
    console.error("Missing OpenAI API key for drawing reader");

    return (
      "⚠️ Modulo di analisi visiva non disponibile.\n\n" +
      "Non è stato possibile avviare la lettura della tavola tecnica. " +
      "Il problema non dipende dal file caricato, ma dalla configurazione del servizio AI.\n\n" +
      "Riprova più tardi oppure segnala il problema all’assistenza."
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const extractedPdfText = String(params.fileText || "").trim();

  const prompt =
    `${params.message || "Analizza questa immagine tecnica con la massima precisione."}

` +
    `${params.fileMeta ? `${params.fileMeta}
` : ""}` +
    `Modalità analisi: ${params.analysisMode}
` +
    (extractedPdfText
      ? `

TESTO ESTRATTO DAL PDF, DA USARE COME SUPPORTO E NON COME UNICA FONTE:
${extractedPdfText.slice(0, 26000)}
`
      : "");

  const imageInputs =
    params.drawingImages && params.drawingImages.length > 0
      ? params.drawingImages
      : params.imageDataUrl
        ? [{ label: "Immagine tecnica caricata", dataUrl: params.imageDataUrl }]
        : [];

  const isDrawingMode = params.analysisMode === "drawing";

  const genericVisionSystemPrompt =
    `Sei TechAI Vision, assistente visivo tecnico e generale. ` +
    `Utente: ${userName}. Settore: ${focus}. Modalità: ${params.analysisMode}. ` +
    `Analizza l'immagine in base alla domanda dell'utente, senza forzare sempre lo schema delle tavole tecniche. ` +
    `Se l'immagine mostra l'interfaccia di TechAI, riconosci che si tratta delle funzioni dell'app e spiega cosa sono. ` +
    `Se mostra un menu, una schermata software, un componente, una foto o uno screenshot, descrivilo normalmente. ` +
    `Usa l'analisi da tavola tecnica solo quando l'utente sta usando la modalità Tavole/drawing oppure chiede esplicitamente una revisione di tavola tecnica. ` +
    `Non inventare dati non visibili. Se qualcosa non è leggibile, scrivi che non è leggibile. ` +
    `Rispondi in italiano, in modo tecnico ma naturale. Usa titoli, elenchi e grassetto Markdown leggero quando utile. ` +
    TECHNICAL_STANDARDS_RULES +
    TECHNICAL_DEPTH_RULES +
    MECHANICAL_KNOWLEDGE_BASE;

  const drawingVisionSystemPrompt =
    `Sei TechAI Vision, un ingegnere meccanico senior specializzato in disegno tecnico secondo norme ISO 128, ISO 1101, ISO 286 e ISO 1302. ` +
    `Utente: ${userName}. Settore: ${focus}. Modalità: ${params.analysisMode}. ` +
    "Il tuo compito è analizzare tavole tecniche meccaniche, immagini CAD, screenshot SolidWorks, componenti meccanici e distinte visive con la massima precisione. " +
    "Leggi quote, tolleranze, rugosità, filetti, fori, lamature, scale, materiale, trattamento e cartiglio quando visibili. " +
    "Individua anche le quote probabilmente funzionali e critiche, spiegando sempre il motivo tecnico, il livello di confidenza e il riferimento tecnico quando applicabile. " +
    "Non inventare valori: se un dato non è leggibile o non è presente, scrivi chiaramente 'non leggibile' oppure 'non indicato'. " +
    "Quando la qualità dell'immagine è bassa, segnala il limite prima di giudicare la tavola. " +
    "Rispondi in italiano tecnico preciso, completo e motivato. " +
    TECHNICAL_STANDARDS_RULES +
    TECHNICAL_DEPTH_RULES +
    MECHANICAL_KNOWLEDGE_BASE +
    "\n\nREGOLE DI FORMATTAZIONE OBBLIGATORIE:\n" +
    "Usa sempre uno di questi stati per ogni controllo tecnico:\n" +
    "✅ OK = elemento presente, leggibile, coerente o apparentemente conforme.\n" +
    "⚠️ Da verificare = dato assente, poco leggibile, incompleto o non confermabile dalla tavola.\n" +
    "⚠️ Possibile anomalia = elemento potenzialmente errato, fuori standard o tecnicamente sospetto.\n" +
    "⚠️ Possibile incoerenza = contrasto possibile tra quote, note, materiale, tolleranze, rugosità o funzione del pezzo.\n" +
    "❌ Errore critico = problema evidente che può impedire produzione, montaggio o controllo.\n" +
    "Puoi usare **testo** per evidenziare parole importanti: il frontend lo renderizza come grassetto senza mostrare gli asterischi.\n" +
    "Esempio corretto: ✅ OK Materiale: 11SMnPb37 - UNI EN 10087.\n" +
    "Esempio corretto: ⚠️ Da verificare Rugosità: non leggibile o non indicata chiaramente sulle superfici funzionali.\n" +
    "Esempio corretto: ⚠️ Possibile anomalia Tolleranze geometriche: assenti su una sede probabilmente funzionale, da verificare con assieme.\n" +
    "Esempio corretto: ⚠️ Possibile incoerenza Materiale indicato nel cartiglio diverso da quello richiamato nelle note.\n" +
    "Esempio corretto: ❌ Errore critico Quota principale mancante e necessaria per la produzione.\n" +
    "\n\nSTRUTTURA RISPOSTA OBBLIGATORIA PER TAVOLE TECNICHE:\n" +
    "Usa titoli Markdown chiari, ad esempio ## 1. Cartiglio.\n" +
    "## 1. Cartiglio\n" +
    "Per ogni voce usa ✅ / ❌ / ⚠️. Controlla nome pezzo, numero disegno, materiale, scala, autore, data, revisione, unità.\n\n" +
    "## 2. Viste e sezioni\n" +
    "Controlla se le viste sono sufficienti, se servono sezioni A-A/B-B, dettagli, viste ausiliarie o ingrandimenti.\n\n" +
    "## 3. Quotatura generale\n" +
    "Cita solo le quote chiaramente leggibili. Segnala quote mancanti, ridondanti, catene chiuse, riferimenti poco chiari o quote funzionali assenti.\n" +
    "Non ricavare quote dalla geometria se non sono esplicitamente leggibili. Se una quota sembra deducibile ma non è scritta chiaramente, indica: non valutabile dalla tavola.\n" +
    "Non trasformare una quota non leggibile in un errore di progettazione.\n\n" +

    "## 3B. Quote funzionali e critiche\n" +
    "Questa sezione è obbligatoria quando l'utente chiede quote funzionali, quote critiche, controllo tavola o analisi tecnica del disegno.\n" +
    "Non scrivere spiegazioni generiche tipo: Le quote funzionali sono quelle che... Vai direttamente all'elenco tecnico.\n" +
    "Non usare una risposta discorsiva libera. Usa sempre blocchi ripetuti con lo schema sotto.\n\n" +

    "SCHEMA OBBLIGATORIO PER OGNI QUOTA O SPECIFICA:\n" +
    "Quota / specifica rilevata: ...\n" +
    "Classificazione: funzionale probabile / critica / descrittiva-secondaria / non valutabile\n" +
    "Motivazione tecnica: ...\n" +
    "Confidenza: alta / media / bassa\n" +
    "Controllo consigliato: ...\n" +
    "Riferimento tecnico: ISO/UNI applicabile oppure principio tecnico generale.\n" +
    "Nota: ...\n\n" +

    "REGOLE DI CLASSIFICAZIONE:\n" +
    "- Funzionale probabile: fori di fissaggio, filettature, interassi, sedi, cave, asole, battute, spessori di appoggio, diametri di accoppiamento, superfici di centraggio, superfici di scorrimento, superfici di tenuta e quote collegate al montaggio.\n" +
    "- Critica: quote marcate come caratteristiche critiche, quote con tolleranze strette, accoppiamenti tipo H7/h6/g6/f7/k6/m6/s6, filettature funzionali, datum, tolleranze geometriche, quote che se errate impediscono montaggio, intercambiabilità o funzionamento.\n" +
    "- Descrittiva-secondaria: raggi, smussi, raccordi o quote di forma che non risultano chiaramente collegate a montaggio, accoppiamento o funzione.\n" +
    "- Non valutabile: quota non leggibile, non presente, parzialmente coperta o funzione non deducibile dalla tavola.\n\n" +

    "REGOLE ANTI-INVENZIONE PER QUOTE FUNZIONALI:\n" +
    "- Non dire mai che una quota è sicuramente funzionale se non conosci l'assieme.\n" +
    "- Usa formule come: probabilmente funzionale, potenzialmente critica, da verificare con assieme.\n" +
    "- Non inventare lunghezze, diametri, profondità, tolleranze o rugosità non leggibili.\n" +
    "- Non scrivere che una lunghezza è ricavabile dalla sezione se non è quotata chiaramente. Scrivi: non valutabile dalla tavola.\n" +
    "- Non scrivere frasi finali tipo: se vuoi posso continuare, fammi sapere, posso evidenziare graficamente. Il report deve sembrare un output tecnico di software industriale.\n\n" +

    "ESEMPIO DI OUTPUT CORRETTO:\n" +
    "Quota / specifica rilevata: M16x1 - 6H\n" +
    "Classificazione: critica\n" +
    "Motivazione tecnica: filettatura interna destinata ad accoppiamento con componente maschio; la classe 6H influisce sulla compatibilità del filetto.\n" +
    "Confidenza: alta\n" +
    "Controllo consigliato: verificare classe 6H, profondità utile, smusso di imbocco e compatibilità con componente accoppiato.\n" +
    "Riferimento tecnico: ISO 965 per filettature metriche; principio di quotatura funzionale.\n" +
    "Nota: funzione da confermare con assieme.\n\n" +

    "Quota / specifica rilevata: Ø16,6 +0,1/0\n" +
    "Classificazione: critica\n" +
    "Motivazione tecnica: quota dimensionale tollerata e potenzialmente collegata ad accoppiamento interno o passaggio componente.\n" +
    "Confidenza: alta se chiaramente leggibile; media se parzialmente leggibile.\n" +
    "Controllo consigliato: verificare metodo di controllo, tolleranza, rugosità associata e funzione nell'assieme.\n" +
    "Riferimento tecnico: ISO 286 per accoppiamenti dimensionali; ISO 1302 se è collegata a rugosità; principio di quotatura funzionale.\n" +
    "Nota: se marcata come caratteristica critica, indicarla come prioritaria.\n\n" +
    "## 4. Tolleranze dimensionali\n" +
    "Controlla tolleranze ISO, accoppiamenti H7/h6, H7/g6, k6, m6, tolleranze generali e quote funzionali.\n\n" +
    "## 5. Tolleranze geometriche\n" +
    "Controlla planarità, parallelismo, perpendicolarità, concentricità/coassialità, posizione, riferimenti datum A/B/C.\n\n" +
    "## 6. Rugosità\n" +
    "Controlla simboli Ra/Rz, rugosità generale, rugosità specifiche su sedi, scorrimenti, appoggi, tenute e superfici funzionali.\n\n" +
    "## 7. Filetti, fori e lamature\n" +
    "Controlla designazioni filetti, profondità, lamature, svasature, fori passanti/ciechi, interassi e quantità fori.\n\n" +
    "## 8. Materiale e trattamenti\n" +
    "Controlla materiale, norma, trattamenti termici, trattamenti superficiali, durezza e note produttive.\n\n" +
    "## 9. Errori critici e correzioni prioritarie\n" +
    "Qui usa soprattutto ❌ e ⚠️. Elenca solo problemi concreti. Se non trovi errori critici scrivi: ✅ Errori critici: nessuno riscontrato.\n\n" +
    "## 10. Giudizio finale\n" +
    "Usa obbligatoriamente uno solo di questi tre esiti:\n" +
    "✅ APPROVATA\n" +
    "⚠️ APPROVATA CON NOTE / DA RIVEDERE\n" +
    "❌ NON APPROVATA\n" +
    "Poi aggiungi una frase breve con il motivo principale.\n\n" +
    "CRITERIO GIUDIZIO:\n" +
    "Se mancano dati fondamentali come materiale, quote principali o tolleranze funzionali, non dare ✅ APPROVATA piena. Usa ⚠️ o ❌. " +
    "Se la tavola è leggibile e completa per produzione, usa ✅ APPROVATA. " +
    "Se ci sono errori gravi che impediscono la produzione, usa ❌ NON APPROVATA. " +
    "\n\nSE NON È UNA TAVOLA TECNICA:\n" +
    "Mantieni comunque gli emoji ✅ / ❌ / ⚠️, ma adatta le sezioni al contenuto dell'immagine. " +
    "Se è uno screenshot CAD/SolidWorks, aggiungi: Metodo consigliato, Comandi SolidWorks in italiano, Errori comuni e Quando NON usare questo metodo.";

  const visionSystemPrompt = isDrawingMode ? drawingVisionSystemPrompt : genericVisionSystemPrompt;

  const visionContent: any[] = [
    {
      type: "text",
      text:
        prompt +
        (isDrawingMode
          ? "\n\nIMPORTANTE LETTURA TAVOLA PDF/A1/A0:\n" +
            "Le immagini allegate sono crop della stessa tavola tecnica generati dal frontend con src/utils/technicalDrawingUtils.ts: alcuni automatici da testo PDF, alcuni da aree grafiche dense, più crop di sicurezza. Non trattarle come tavole separate.\n" +
            "Usa la vista completa solo per orientarti.\n" +
            "Usa i crop dinamici per leggere cartiglio, note, viste, sezioni, quote, fori, filetti, lamature e lavorazioni.\n" +
            "Il testo estratto dal PDF serve come aiuto per riconoscere dati e parole, ma le conclusioni devono restare collegate alla tavola/crop visibili.\n" +
            "Distingui chiaramente: rilevato / incerto / non leggibile. Non inventare dati mancanti e non trasformare la scarsa leggibilità in errore tecnico.\n" +
            "Quando l'utente chiede il riconoscimento delle quote funzionali, concentrati su quote funzionali probabili, quote critiche, quote descrittive/secondarie e quote non valutabili, sempre con motivazione tecnica.\n"
          : "\n\nIMPORTANTE ANALISI IMMAGINE GENERICA:\n" +
            "Rispondi alla domanda dell'utente guardando l'immagine.\n" +
            "Non usare automaticamente lo schema Cartiglio / Viste / Quotatura / Tolleranze, a meno che l'utente chieda una revisione di tavola tecnica.\n" +
            "Se l'immagine mostra funzioni dell'app TechAI, descrivi le funzioni visibili e spiega a cosa servono.\n"),    },
  ];

  for (const img of imageInputs.slice(0, 12)) {
    visionContent.push({ type: "text", text: `Immagine/crop: ${img.label}` });
    visionContent.push({
      type: "image_url",
      image_url: {
        url: img.dataUrl,
        detail: imageDetail,
      },
    });
  }

  let response: Response;

  try {
    response = await fetchWithTimeout(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openAiDrawingKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content: visionSystemPrompt,
            },
            {
              role: "user",
              content: visionContent,
            },
          ],
          temperature: 0.15,
          max_tokens: 8000,
        }),
      },
      openAiTimeoutMs
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout OpenAI durante l'analisi immagine.\n\n" +
        `Modello usato: ${model}\n\n` +
        "La funzione ha interrotto la chiamata prima della risposta del modello.\n\n" +
        "Prova con un'immagine più leggera oppure imposta in Vercel:\n\n" +
        "```env\n" +
        "OPENAI_DRAWING_READER_MODEL=gpt-4o-mini\n" +
        "```"
      );
    }

    throw error;
  }

  const raw = await response.text();
  const data = safeJsonParse<any>(raw, null);

  if (!response.ok) {
    return (
      "⚠️ OpenAI ha restituito un errore durante l'analisi immagine.\n\n" +
      `Modello usato: ${model}\n` +
      `Codice: ${response.status}\n\n` +
      `Dettaglio: ${raw || "nessun dettaglio ricevuto"}\n\n` +
      "Controlla che la chiave OpenAI sia valida e che il modello scelto supporti immagini. " +
      "Variabili richieste: OPENAI_DRAWING_READER_API_KEY e OPENAI_DRAWING_READER_MODEL."
    );
  }

  const visionAnswer =
    data?.choices?.[0]?.message?.content ||
    "Ho ricevuto l'immagine, ma OpenAI non ha restituito una risposta valida.";

  // Estrai PINS prima di cleanAiOutput (che corromperebbe il JSON interno)
  const pinsMatchV = visionAnswer.match(/<PINS>[\s\S]*?<\/PINS>/i);
  const pinsBlockV = pinsMatchV ? pinsMatchV[0] : "";
  const textWithoutPinsV = visionAnswer.replace(/<PINS>[\s\S]*?<\/PINS>/gi, "").trim();
  const cleanTextV = cleanAiOutput(textWithoutPinsV);
  return pinsBlockV ? `${pinsBlockV}\n\n${cleanTextV}` : cleanTextV;
}

async function checkAuthAndRateLimit(
  req: Request,
  usageRequest: { hasFile: boolean }
): Promise<AuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      ok: false,
      response: jsonResponse({ error: "Supabase server non configurato." }, 500),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("authorization");
  const guestId = req.headers.get("x-guest-id");

  if (!authHeader && guestId) {
    const cleanGuestId = guestId.trim();

    if (!cleanGuestId || cleanGuestId.length < 8 || cleanGuestId.length > 120) {
      return {
        ok: false,
        response: jsonResponse({ error: "Guest ID non valido." }, 400),
      };
    }

    const { data: existingGuest, error: selectError } = await supabase
      .from("guest_usage")
      .select("guest_id, ai_requests_used, ai_requests_limit, file_uploads_used, file_uploads_limit, window_started_at")
      .eq("guest_id", cleanGuestId)
      .maybeSingle();

    if (selectError) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Errore controllo limite ospite.",
            detail: selectError.message,
          },
          500
        ),
      };
    }

    const nowIso = new Date().toISOString();

    if (!existingGuest) {
      const { error: insertError } = await supabase
        .from("guest_usage")
        .insert({
          guest_id: cleanGuestId,
          ai_requests_used: 0,
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_used: 0,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          window_started_at: nowIso,
          updated_at: nowIso,
        });

      if (insertError) {
        return {
          ok: false,
          response: jsonResponse(
            {
              error: "Errore creazione profilo ospite.",
              detail: insertError.message,
            },
            500
          ),
        };
      }

      return {
        ok: true,
        mode: "guest",
        guestId: cleanGuestId,
        supabase,
        usage: {
          used: 0,
          limit: GUEST_TEXT_LIMIT_24H,
          fileUsed: 0,
          fileLimit: GUEST_FILE_LIMIT_24H,
          windowStartedAt: nowIso,
        },
      };
    }

    let used = Number(existingGuest.ai_requests_used || 0);
    let limit = Number(existingGuest.ai_requests_limit || GUEST_TEXT_LIMIT_24H);
    let fileUsed = Number(existingGuest.file_uploads_used || 0);
    let fileLimit = Number(existingGuest.file_uploads_limit || GUEST_FILE_LIMIT_24H);
    let windowStartedAt = String(existingGuest.window_started_at || nowIso);

    if (isOlderThan24Hours(windowStartedAt)) {
      used = 0;
      limit = GUEST_TEXT_LIMIT_24H;
      fileUsed = 0;
      fileLimit = GUEST_FILE_LIMIT_24H;
      windowStartedAt = nowIso;

      const { error: resetError } = await supabase
        .from("guest_usage")
        .update({
          ai_requests_used: 0,
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_used: 0,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          window_started_at: nowIso,
          updated_at: nowIso,
        })
        .eq("guest_id", cleanGuestId);

      if (resetError) {
        return {
          ok: false,
          response: jsonResponse(
            {
              error: "Errore reset limite ospite.",
              detail: resetError.message,
            },
            500
          ),
        };
      }
    } else if (limit !== GUEST_TEXT_LIMIT_24H || fileLimit !== GUEST_FILE_LIMIT_24H) {
      limit = GUEST_TEXT_LIMIT_24H;
      fileLimit = GUEST_FILE_LIMIT_24H;

      await supabase
        .from("guest_usage")
        .update({
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          updated_at: nowIso,
        })
        .eq("guest_id", cleanGuestId);
    }

    if (used >= limit) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Limite ospite raggiunto",
            used,
            limit,
            fileUsed,
            fileLimit,
            resetAfterHours: GUEST_WINDOW_HOURS,
          },
          403
        ),
      };
    }

    if (usageRequest.hasFile && fileUsed >= fileLimit) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Limite file ospite raggiunto",
            used,
            limit,
            fileUsed,
            fileLimit,
            resetAfterHours: GUEST_WINDOW_HOURS,
          },
          403
        ),
      };
    }

    return {
      ok: true,
      mode: "guest",
      guestId: cleanGuestId,
      supabase,
      usage: {
        used,
        limit,
        fileUsed,
        fileLimit,
        windowStartedAt,
      },
    };
  }

  if (!authHeader) {
    return {
      ok: false,
      response: jsonResponse({ error: "Token mancante. Effettua il login oppure entra come ospite." }, 401),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false,
      response: jsonResponse({ error: "Token non valido." }, 401),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: jsonResponse({ error: "Sessione non valida. Effettua di nuovo il login." }, 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, plan, ai_requests_used, ai_requests_limit")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: jsonResponse({ error: "Profilo utente non trovato." }, 404),
    };
  }

  if (profile.ai_requests_used >= profile.ai_requests_limit) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: "Limite AI raggiunto",
          plan: profile.plan,
          used: profile.ai_requests_used,
          limit: profile.ai_requests_limit,
        },
        403
      ),
    };
  }

  return {
    ok: true,
    mode: "user",
    userId: user.id,
    supabase,
  };
}

async function incrementUserUsage(supabase: any, userId: string) {
  if (!userId || !supabase) return;

  const { data, error: readError } = await supabase
    .from("profiles")
    .select("ai_requests_used, ai_requests_limit")
    .eq("id", userId)
    .single();

  if (readError || !data) {
    console.error("Errore lettura usage utente:", readError);
    return;
  }

  const profile = data as { ai_requests_used: number; ai_requests_limit: number };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ai_requests_used: profile.ai_requests_used + 1 })
    .eq("id", userId);

  if (updateError) {
    console.error("Errore update usage utente:", updateError);
  }
}

async function incrementGuestUsage(supabase: any, guestId: string, hasFile: boolean) {
  if (!guestId || !supabase) {
    return {
      used: 0,
      limit: GUEST_TEXT_LIMIT_24H,
      fileUsed: 0,
      fileLimit: GUEST_FILE_LIMIT_24H,
      windowStartedAt: new Date().toISOString(),
    };
  }

  const { data, error: readError } = await supabase
    .from("guest_usage")
    .select("ai_requests_used, ai_requests_limit, file_uploads_used, file_uploads_limit, window_started_at")
    .eq("guest_id", guestId)
    .single();

  if (readError || !data) {
    console.error("Errore lettura usage ospite:", readError);
    return {
      used: 0,
      limit: GUEST_TEXT_LIMIT_24H,
      fileUsed: 0,
      fileLimit: GUEST_FILE_LIMIT_24H,
      windowStartedAt: new Date().toISOString(),
    };
  }

  const used = Number(data.ai_requests_used || 0) + 1;
  const fileUsed = Number(data.file_uploads_used || 0) + (hasFile ? 1 : 0);
  const limit = Number(data.ai_requests_limit || GUEST_TEXT_LIMIT_24H);
  const fileLimit = Number(data.file_uploads_limit || GUEST_FILE_LIMIT_24H);
  const windowStartedAt = String(data.window_started_at || new Date().toISOString());

  const { error: updateError } = await supabase
    .from("guest_usage")
    .update({
      ai_requests_used: used,
      file_uploads_used: fileUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("guest_id", guestId);

  if (updateError) {
    console.error("Errore update usage ospite:", updateError);
  }

  return {
    used,
    limit,
    fileUsed,
    fileLimit,
    windowStartedAt,
  };
}
export default async function handler(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "API /api/chat funzionante",
      env: {
        hasOpenAITextKey: Boolean(
          process.env.OPENAI_TEXT_API_KEY || process.env.OPENAI_API_KEY
        ),
        openAITextKeyStatus:
          process.env.OPENAI_TEXT_API_KEY || process.env.OPENAI_API_KEY ? "SET" : "MISSING",
        openAITextModelFast:
          process.env.OPENAI_TEXT_MODEL_FAST ||
          process.env.OPENAI_TEXT_MODEL ||
          process.env.OPENAI_API_MODEL ||
          "gpt-4o-mini",
        openAITextModelMedium:
          process.env.OPENAI_TEXT_MODEL_MEDIUM ||
          process.env.OPENAI_TEXT_MODEL ||
          process.env.OPENAI_API_MODEL ||
          "gpt-4o-mini",
        openAITextModelHard:
          process.env.OPENAI_TEXT_MODEL_HARD ||
          process.env.OPENAI_TEXT_MODEL ||
          process.env.OPENAI_API_MODEL ||
          "gpt-4o",
        hasOpenAIDrawingKey: Boolean(
          process.env.OPENAI_DRAWING_READER_API_KEY || process.env.OPENAI_API_KEY
        ),
        openAIDrawingKeyStatus:
          process.env.OPENAI_DRAWING_READER_API_KEY || process.env.OPENAI_API_KEY
            ? "SET"
            : "MISSING",
        openAIDrawingModel:
          process.env.OPENAI_DRAWING_READER_MODEL || "gpt-4o-mini",
        openAIDrawingImageDetail:
          process.env.OPENAI_DRAWING_IMAGE_DETAIL || "auto",
        hasSupabase: Boolean(
          process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
        ),
        guestTextLimit24h: GUEST_TEXT_LIMIT_24H,
        guestFileLimit24h: GUEST_FILE_LIMIT_24H,
        guestWindowHours: GUEST_WINDOW_HOURS,
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito. Usa POST." }, 405);
  }

  try {
    const body = await readRequestBody(req);

    const auth = await checkAuthAndRateLimit(req, {
      hasFile: body.hasFile,
    });

    if (auth.ok === false) {
      return auth.response;
    }

    const scopeCheck = isAllowedTechnicalScope({
      message: body.message,
      messages: body.messages,
      hasFile: body.hasFile,
      analysisMode: body.analysisMode,
    });

    if (!scopeCheck.allowed) {
      return jsonResponse({
        answer: OUT_OF_SCOPE_MESSAGE,
        mode: auth.mode,
        usage: auth.mode === "guest" ? auth.usage : null,
        blockedByScope: true,
        scopeReason: scopeCheck.reason,
      });
    }

    const hasVisionInput =
      Boolean(body.imageDataUrl) ||
      Boolean(body.drawingImages && body.drawingImages.length > 0);

    const rawAnswer: string = hasVisionInput
      ? await callOpenAIVision({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          imageDataUrl: body.imageDataUrl,
          drawingImages: body.drawingImages,
          fileText: body.fileText,
          fileMeta: body.fileMeta,
          analysisMode: body.analysisMode,
        })
      : await callOpenAIText({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          fileText: body.fileText,
          fileMeta: body.fileMeta,
          analysisMode: body.analysisMode,
          projectContext: body.projectContext,
        });

    // Ultima pulizia obbligatoria prima di mandare il testo al frontend.
    // Per le risposte vision il rawAnswer è già pulito (cleanAiOutput è chiamato dentro callOpenAIVision
    // con il blocco PINS protetto). Evitiamo di riprocessarlo per non corrompere i tag PINS.
    // Serve anche se il modello ignora il prompt e produce ancora ** o tabelle Markdown.
    const answer = hasVisionInput ? rawAnswer : cleanAiOutput(rawAnswer);

    let usage: any = null;

    if (auth.mode === "user") {
      await incrementUserUsage(auth.supabase, auth.userId);
    } else {
      usage = await incrementGuestUsage(auth.supabase, auth.guestId, body.hasFile);
    }

    return jsonResponse({
      answer,
      mode: auth.mode,
      usage,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        answer:
          "⚠️ Errore interno nella rotta `/api/chat`.\n\n" +
          `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
      },
      500
    );
  }
}
