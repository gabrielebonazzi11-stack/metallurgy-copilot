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

type RequestBodyData = {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  imageDataUrl: string;
  fileMeta: string;
  hasFile: boolean;
  analysisMode: AnalysisMode;
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
    const analysisMode = normalizeAnalysisMode(String(formData.get("analysisMode") || "chat"));

    const messages = safeJsonParse<ChatMessage[]>(messagesRaw, []);
    const profile = safeJsonParse<any>(profileRaw, {});

    let fileText = "";
    let imageDataUrl = "";
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
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        imageDataUrl = `data:${file.type};base64,${base64}`;
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
      } else if (typeof preExtractedText === "string" && preExtractedText.trim()) {
        fileText = `\n\nContenuto del file:\n${preExtractedText.slice(0, 22000)}`;
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

    return {
      message,
      messages,
      profile,
      fileText,
      imageDataUrl,
      fileMeta,
      hasFile,
      analysisMode,
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    message: body.message || "",
    messages: body.messages || [],
    profile: body.profile || {},
    fileText: body.fileText || "",
    imageDataUrl: "",
    fileMeta: body.fileMeta || "",
    hasFile: Boolean(body.hasFile),
    analysisMode: normalizeAnalysisMode(body.analysisMode),
  };
}

function chooseGroqModel(params: {
  message: string;
  fileText: string;
  analysisMode: AnalysisMode;
}): ModelRoute {
  const message = String(params.message || "");
  const fileText = String(params.fileText || "");
  const analysisMode = params.analysisMode || "chat";

  const routingText = `${message}\n${fileText}\n${analysisMode}`.toLowerCase();

  const fastModel =
    process.env.GROQ_MODEL_FAST ||
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant";

  const mediumModel =
    process.env.GROQ_MODEL_MEDIUM ||
    process.env.GROQ_MODEL ||
    fastModel;

  const hardModel =
    process.env.GROQ_MODEL_HARD ||
    process.env.GROQ_MODEL_MEDIUM ||
    process.env.GROQ_MODEL ||
    "llama-3.3-70b-versatile";

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
    /tavola|disegno tecnico|rugosità|rugosita|tolleranza|gd&t|quota|sezione|cartiglio|materiale|acciaio|c45|42crmo4|aisi|inventor|solidworks|step|stp|distinta|bom|csv|json/i.test(routingText)
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

  if (message.length < 220 && score <= 1) {
    return {
      level: "fast",
      model: fastModel,
      maxTokens: 450,
      timeoutMs: 12000,
      reason: "domanda breve/semplice",
    };
  }

  if (score >= 6) {
    return {
      level: "hard",
      model: hardModel,
      maxTokens: 1200,
      timeoutMs: 22000,
      reason: reasons.join(", ") || "richiesta complessa",
    };
  }

  return {
    level: "medium",
    model: mediumModel,
    maxTokens: 750,
    timeoutMs: 17000,
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
    `Rispondi nella stessa lingua dell'utente. Sii diretto, pratico e ordinato. ` +
    `Non inventare dati. Se mancano dati, chiedili. ` +
    `Per codice, dai modifiche complete e copiabili.`
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
      `Controlla in modo concreto:\n` +
      `- codici duplicati;\n` +
      `- materiali mancanti;\n` +
      `- quantità vuote, zero, negative o incoerenti;\n` +
      `- descrizioni troppo generiche o incomplete;\n` +
      `- componenti commerciali senza norma;\n` +
      `- viti senza classe di resistenza, ad esempio 8.8 / 10.9;\n` +
      `- cuscinetti senza sigla completa;\n` +
      `- trattamenti superficiali mancanti se necessari;\n` +
      `- unità di misura mancanti.\n\n` +
      `Output richiesto:\n` +
      `- tabella con Riga / Problema / Gravità / Correzione consigliata;\n` +
      `- esempi tipo: "Riga 12: vite M8x20 senza classe → aggiungere 8.8 / 10.9";\n` +
      `- riepilogo finale con numero errori critici e attenzioni.\n` +
      `Non inventare righe non presenti: se il file non contiene numerazione, usa l'ordine progressivo letto.\n`
    );
  }

  if (analysisMode === "solidworks") {
    return (
      `\n\n## MODALITÀ ASSISTENTE SOLIDWORKS PRATICO\n` +
      `Non limitarti a dire "come si fa": devi dare una procedura guidata concreta.\n` +
      `Usa questa struttura:\n` +
      `1. Metodo consigliato\n` +
      `2. Comandi SolidWorks in italiano\n` +
      `3. Passaggi operativi numerati\n` +
      `4. Errori comuni\n` +
      `5. Quando NON usare questo metodo\n` +
      `6. Controllo finale prima della messa in tavola\n\n` +
      `Casi da gestire bene:\n` +
      `- modellare un pezzo da zero;\n` +
      `- tubo piegato / sweep / funzione lamiera / saldature;\n` +
      `- sottoassieme;\n` +
      `- collegare materiale al cartiglio;\n` +
      `- rendere un file STEP modificabile;\n` +
      `- ricostruire feature da geometria importata;\n` +
      `- preparare tavola con viste, sezioni, quote, tolleranze e rugosità.\n`
    );
  }

  if (analysisMode === "advanced_check") {
    return (
      `\n\n## MODALITÀ VERIFICHE SERIE\n` +
      `Devi distinguerti da un calcolo base tipo σ=M/W.\n` +
      `Quando l'utente chiede verifiche, considera anche:\n` +
      `- statica: Von Mises, Tresca, coefficienti di sicurezza;\n` +
      `- fatica: Goodman e Soderberg;\n` +
      `- contatti: pressione specifica e, se applicabile, Hertz;\n` +
      `- bulloni: precarico, verifica a taglio, trazione, schiacciamento, classe 8.8/10.9;\n` +
      `- linguette: taglio e pressione specifica;\n` +
      `- cuscinetti: sigla, carico equivalente, durata L10h;\n` +
      `- tolleranze e rugosità delle superfici funzionali.\n\n` +
      `Struttura output:\n` +
      `1. Dati usati\n` +
      `2. Formule\n` +
      `3. Calcoli numerici con unità\n` +
      `4. Esito OK/NON OK\n` +
      `5. Cosa manca per una verifica definitiva\n`
    );
  }

  if (analysisMode === "step") {
    return (
      `\n\n## MODALITÀ STEP/STP\n` +
      `Analizza il file STEP/STP per quanto possibile dal testo/metadata.\n` +
      `Non dire che puoi vedere perfettamente il 3D se non è disponibile.\n` +
      `Cerca nel testo: nomi entità, unità, schema STEP, eventuali riferimenti a materiale, assembly, product name, geometrie nominate.\n` +
      `Output:\n` +
      `1. Metadata rilevati\n` +
      `2. Possibile contenuto del file\n` +
      `3. Limiti dell'analisi\n` +
      `4. Come importarlo in SolidWorks\n` +
      `5. Come renderlo modificabile o ricostruire le feature\n`
    );
  }

  if (analysisMode === "drawing") {
    return (
      `\n\n## MODALITÀ TAVOLA TECNICA\n` +
      `Analizza la tavola come revisione tecnica preliminare.\n` +
      `Controlla: cartiglio, materiale, scala, viste, sezioni, quote, tolleranze, GD&T, rugosità, filetti, fori, lamature, note e producibilità.\n`
    );
  }

  if (analysisMode === "file") {
    return (
      `\n\n## MODALITÀ FILE TECNICO\n` +
      `Analizza il file caricato e produci un riepilogo tecnico, problemi rilevati, dati utili e azioni consigliate.\n`
    );
  }

  return "";
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
    `- Sii diretto, ordinato, tecnico e pratico.\n` +
    `- Usa Markdown e formule leggibili.\n` +
    `- Cita sempre le unità di misura.\n` +
    `- Se mancano dati, chiedili e non inventare.\n` +
    `- Se la richiesta riguarda codice, dai modifiche precise e copiabili.\n` +
    `- Se l'utente chiede un file completo, riscrivi il file completo.\n` +
    `- Se si parla di componenti o disegni tecnici, quando opportuno scrivi: "fare riferimento a normativa: ...".\n\n` +

    `PROMEMORIA TECNICO COMPATTO:\n` +
    `Meccanica: equilibrio ΣF=0, ΣM=0; F=ma; P=Fv=Mω; Mt[Nm]=9550P[kW]/n[rpm].\n` +
    `Trazione: σ=F/A; ΔL=FL/(EA). Flessione: σ=Mf/Wf. Torsione: τ=Mt/Wt.\n` +
    `Sezione circolare: Jf=πd⁴/64, Wf=πd³/32, Jp=πd⁴/32, Wt=πd³/16.\n` +
    `Von Mises: σid=√(σ²+3τ²). Alberi: Mid=√(Mf²+0,75Mt²), d≥∛(32Mid/(πσamm)).\n` +
    `Fatica: σm=(σmax+σmin)/2, σa=(σmax-σmin)/2, Goodman, Soderberg, Se≈0,5Rm corretto con fattori.\n` +
    `Bulloni: precarico, taglio, trazione, classe 8.8/10.9. Contatti: pressione specifica e Hertz se serve.\n` +
    `Materiali: S235/S275/S355 per carpenteria; C45 per alberi/perni medi; 42CrMo4 e 39NiCrMo3 per carichi alti; 16MnCr5 per cementazione; 100Cr6 per rulli/cuscinetti.\n` +
    `Tolleranze: sede cuscinetto H7; albero rotante k6/m6; scorrimento H7/f7; fisso H7/s6.\n` +
    `Rugosità: generica Ra 3,2÷6,3 µm; sedi/tenute Ra 0,8÷1,6 µm; superfici molto funzionali Ra 0,4÷0,8 µm.\n` +
    `Oleoidraulica: F=pA; v=Q/A; centro aperto P→T; centro chiuso vie bloccate.\n` +
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
    `Rispondi in italiano, tecnico e preciso. Usa Markdown e notazione chiara per formule. Cita sempre le unità. Se mancano dati, chiedi.\n` +
    `Se la richiesta riguarda codice, dai modifiche precise, copiabili e complete. Se chiede un file completo, riscrivi il file completo.\n` +
    buildModeInstructions(analysisMode) +
    `\n\n` +

    `## MECCANICA BASE E STATICA\n` +
    `Newton: F=ma. Equilibrio: ΣF=0, ΣM=0. Gdl piano: 3 (2 traslazioni+1 rotazione). Spazio: 6. Isostatica=vincoli necessari e sufficienti.\n` +
    `Cinematica: MRU s=v·t; MRUA v=v0+at, s=v0t+½at², v²=v0²+2as. Caduta libera g=9,81m/s².\n` +
    `Moto circolare: v=ω·r; ac=v²/r=ω²r; ω=2πn/60. Energia cinetica Ec=½mv². Potenziale Ep=mgz.\n` +
    `Momento inerzia: I=Σmi·ri². Huygens-Steiner: I=Icm+Mh². Dinamica rotaz.: M=I·α. Ec_rot=½Iω².\n` +
    `Lavoro: L=F·s·cosθ. Potenza: P=F·v=M·ω. P[kW]=Mt[Nm]·n[giri/min]/9550.\n\n` +

    `## SOLLECITAZIONI E SCIENZA DELLE COSTRUZIONI\n` +
    `E acciaio=206000MPa; E alluminio=70000MPa; E ghisa=100000MPa; ν acciaio=0,3; G acciaio=79000MPa.\n` +
    `Trazione: σ=F/A; ε=ΔL/L0; σ=E·ε; ΔL=FL/(EA). Deformazione trasversale: εt=-ν·ε.\n` +
    `Flessione (Navier): σ=Mf·y/Jf; σmax=Mf/Wf. Sez.circolare: Jf=πd⁴/64; Wf=πd³/32. Sez.rettang. b×h: Jf=bh³/12; Wf=bh²/6. Sez.cava D,d: Jf=π(D⁴-d⁴)/64; Wf=π(D⁴-d⁴)/(32D).\n` +
    `Torsione: τ=Mt·r/Jp; τmax=Mt/Wt. Sez.circolare: Jp=πd⁴/32; Wt=πd³/16. θ=Mt·L/(G·Jp). Limite: θ≤0,0044rad/m.\n` +
    `Taglio: τmedio=T/A. Sez.circolare: τmax=4T/(3A). Sez.rett.: τmax=3T/(2bh).\n` +
    `Frecce travi: appoggiata+carico centrale f=FL³/(48EJ); appoggiata+q_distrib f=5qL⁴/(384EJ); mensola+F f=FL³/(3EJ); mensola+q f=qL⁴/(8EJ). Carico in C (bracci a,b): fC=Fa²b²/(3EJL).\n` +
    `Travi incastrate: R_A=5qL/8, R_B=3qL/8, M_A=qL²/8 (incastro-appoggio+q). Doppio incastro+q: M_incastri=qL²/12; M_mezzeria=qL²/24.\n` +
    `Proprietà materiale dalla prova di trazione: Rm(rottura), Re/Rp0.2(snervamento), A%(duttilità), tenacità=area sotto curva σ-ε, resilienza=σe²/(2E).\n\n` +

    `## CONDIZIONE DI RESISTENZA E CRITERI\n` +
    `σe≤σam=σcr/n. n: statico 1,5÷2; variabile 2÷3; dinamico 3÷5. c(servizio): uniforme 1÷1,25; variabile 1,5÷2,5.\n` +
    `Von Mises (duttili): σid=√(σ²+3τ²)≤σam. Alberi: σid=√(σf²+3τt²); Mid=√(Mf²+¾Mt²); σid=Mid/Wf.\n` +
    `Tresca (duttili): σid=σ1-σ3; piano: σid=√(σ²+4τ²). Rankine (fragili): σid=σ1.\n` +
    `Mohr: σ1,2=(σx+σy)/2±√[((σx-σy)/2)²+τxy²]; τmax=√[((σx-σy)/2)²+τxy²].\n` +
    `Concentrazione tensioni: Kt da grafici; Kf=1+q(Kt-1); q=1/(1+a/r). a[mm]: Rm=600→0,21; Rm=800→0,145; Rm=1000→0,094.\n` +
    `Dim.statico albero: d≥∛(32·Mid/(π·σam)). Freccia max: L/2000 (comune); L/5000 (utensili). θmax sede cuscinetto sfere: 0,003rad; rulli: 0,0009rad.\n\n` +

    `## FATICA\n` +
    `σm=(σmax+σmin)/2; σa=(σmax-σmin)/2; R=σmin/σmax. Alterno simm.: σm=0,R=-1. Pulsante: R=0.\n` +
    `Se≈0,5Rm (acciaio). Se=ka·kb·kc·kd·ke·S'e. ka(rugosità): lucido=1,0; lavorato≈0,7÷0,8. kb(dim): d<8mm→1; d=8÷50mm→0,85÷0,9. kc: flessione=1; trazione=0,85; torsione=0,59. ke: 90%→0,897; 99%→0,814.\n` +
    `Goodman: σa/Se + σm/Rm ≤ 1/n. Soderberg: σa/Se + σm/Re ≤ 1/n. Haigh: Se,m=Se·(1-σm/Rm). nf=Se,m/σa≥1,5. Miner: D=Σ(ni/Ni)≤1.\n\n` +

    `## TECNOLOGIA MECCANICA\n` +
    `Lavorazioni: fonderia (colata sabbia, bassa precisione); stampaggio a caldo (alta resistenza meccanica); tranciatura/piegatura/imbutitura (lamiera a freddo); tornitura (moto taglio rotatorio pezzo); fresatura (moto taglio rotatorio utensile); rettifica (alta precisione).\n` +
    `Saldatura autogena: fonde metallo base (arco elettrico MIG/MAG/TIG/elettrodo rivestito, laser, a resistenza). Eterogenea (brasatura): fonde solo metallo d'apporto.\n` +
    `Giunti saldati: testa-testa (piena penetrazione), d'angolo, a T, sovrapposizione.\n` +
    `Cordone d'angolo: σeq=√(σ⊥²+τ⊥²+τ∥²)≤fu/(βw·γm). βw: S235=0,80; S275=0,85; S355=0,90. γm=1,25. Fatica EN3: giunto testa-testa=cat.71÷90; cordone angolo=cat.36÷50.\n` +
    `Additive manufacturing: libertà di forma totale, bassa precisione, costo unitario alto.\n\n` +

    `## MATERIALI\n` +
    `Acciaio=Fe-C con C≤2,06%; Ghisa=Fe-C con C>2,06%.\n` +
    `Strutturali: S235(Rm=360,Re=235); S275(Rm=430,Re=275); S355(Rm=510,Re=355) MPa. Buona saldabilità.\n` +
    `Bonifica: C45(640÷870/410÷510); 41Cr4(740÷1130/540÷735); 42CrMo4(740÷1230/510÷835); 39NiCrMo3(900÷1000/700÷800) [Rm/Re MPa].\n` +
    `Cementazione (superficie dura 58÷62HRC, cuore tenace): 16MnCr5, 16NiCr4. Automatici (alta lavorabilità): 11SMn37, ETG100.\n` +
    `Inox austenitici (non magnetici, non temprabile): AISI304(EN1.4301,Rm=520,Re=210); AISI316L(Rm=500,Re=200) MPa. Inox martensitici (temprabile): AISI420, AISI440C.\n` +
    `Ghise GJL (grigia lamellare, fragile, buon smorzamento): GJL-200(Rm=200); GJL-250(Rm=250); GJL-300(Rm=300). GJS (sferoidale, duttile): GJS-400-15(Rm=400,A=15%); GJS-500-7(Rm=500,A=7%) MPa.\n` +
    `Alluminio (E=70000MPa, ρ=2700kg/m³): 6082-T6(Rm=310,Re=260); 7075-T6(Rm=540,Re=480); 6061-T6(Rm=290,Re=240) MPa.\n` +
    `Titanio Ti-6Al-4V: Rm=900MPa, Re=830MPa, E=110000MPa. Alta resistenza specifica, lavorabilità difficile, costo elevato.\n` +
    `Polimeri: PA66(Nylon,Rm=80MPa,assorbe umidità); POM(acetalico,Rm=65MPa,basso attrito); PTFE(Rm=25MPa,ottima resistenza chimica). CFRP: Rm=600MPa, anisotropo, non saldabile.\n` +
    `Ceramiche tecniche: alta durezza, fragilità, resistenza ad alta T. Al2O3, Si3N4, SiC. Uso: cuscinetti ceramici, utensili.\n\n` +

    `## TRASMISSIONI DI POTENZA\n` +
    `i=n1/n2=z2/z1=D2/D1. Mt[Nm]=9550·P[kW]/n[giri/min].\n` +
    `Ingranaggi denti dritti: m=dp/z; φ=20°; de=dp+2m; df=dp-7/3m. Lewis: m=∛[2Mt/(λYzk)]; λ=b/m≈10; k=k0·5,6/(5,6+v). Y(φ=20°): z=17→0,302; z=20→0,320; z=30→0,358; z=50→0,408. Moduli UNI[mm]: 1;1,25;1,5;2;2,5;3;4;5;6;8;10;12;16;20.\n` +
    `Ingranaggi elicoidali: mn=mf·cosψ; z_eq=z/cos³ψ; Wa=Wt·tanψ.\n` +
    `Cinghie trapezoidali: Lp≈2C+π(D+d)/2+(D-d)²/(4C); θ=π-(D-d)/C; F1-F2=2Mt/d; feff≈0,44 (φ=40°). Sezioni: A(13×8mm,≤7,5kW,dmin=75mm); B(17×11mm,≤19kW,dmin=125mm); C(22×14mm,≤75kW,dmin=220mm); D(32×20mm,≤186kW,dmin=330mm).\n` +
    `Cuscinetti SKF: L10=(C/P)^p Mln giri (p=3 sfere; p=10/3 rulli); L10h=[10⁶/(60n)]·(C/P)³. P=XFr+YFa. Per sfere: P=Fr se Fa/Fr≤e; P=0,56Fr+YFa se Fa/Fr>e. Verifica statica: F≤C0/s0 (s0=0,5 sfere norm.; s0=1,0 rulli norm.). Durata: 20000÷30000h (macchine 8h); 40000÷60000h (continuo).\n` +
    `Bulloni: classi Rm/Re[MPa]: 4.6(400/240); 5.6(500/300); 8.8(800/640); 10.9(1000/900). Ares[mm²]: M6=20,1; M8=36,6; M10=58; M12=84; M16=157; M20=245; M24=353. Fp=0,8·fy·Ares; Ts=0,2·Fp·d. Taglio: Fv,R=0,6·fu·Ares/1,25. Trazione: FT,R=0,9·Ares·fu/1,25.\n` +
    `Linguette: τ=2T/(wLDn); p=4T/(hLDn)≤pam. pam acciaio bonifica=100÷150MPa; ghisa GJL=40÷70MPa.\n` +
    `Interferenza: Mt=μ·p·π·D²·L/2. μ acciaio-acciaio: 0,15 unto; 0,20 secco.\n` +
    `Hertz cilindro: b=√(2PC/(πL)); pmax=4P/(π·2bL); σGuest=0,801·pmax a z0=0,489b. Sfera: a=∛(3PdC/8); pmax=1,5P/(πa²).\n` +
    `Tolleranze ISO 286: sede cuscinetto foro H7; albero rotante k6/m6; scorrevole H7/f7; fisso H7/s6. Ra: superfici generiche 3,2÷6,3μm; sedi cuscin./tenute 0,8÷1,6μm; O-ring 0,4÷0,8μm.\n\n` +

    `## OLEOIDRAULICA\n` +
    `Fluidi (ISO 6743-4): HL(antiruggine); HM/HLP(antiusura—uso comune); HV(alto VI per T variabili). HFA/HFB/HFC/HFD: fluidi resistenti alla fiamma. ISO VG=viscosità cSt a 40°C (tipico: VG32, VG46, VG68).\n` +
    `Pompe volumetriche: a ingranaggi (semplici/economiche); a palette (silenziose, cilindrata variabile); a pistoni assiali/radiali (alta p, alta η). Q_th=Vg·n. ηv=Qreale/Qth≈0,90÷0,98. ηhm≈0,85÷0,95. ηtot=ηv·ηhm. P=QΔp/ηtot. M_th=Vg·Δp/(2π).\n` +
    `Motori idraulici: inverso della pompa. ηv_motore=Qth/Qreale. Vg·Δp=2π·Mc,m. Pm=Mc,m·ωm.\n` +
    `Cilindri: semplice effetto (forza in un senso); doppio effetto (forza in entrambi i sensi). As=πD²/4; Ar=π(D²-d²)/4. F_est=p·As-pret·Ar; F_rit=p·Ar. v_est=Q/As; v_rit=Q/Ar.\n` +
    `Valvole: limitatrice di pressione (VLP, norm.chiusa, protegge da sovrapressione, diretta o pilotata); riduttrice (norm.aperta, mantiene p_valle costante); regolatrice portata 2 bocche (influenzata da Δp); regolatrice 3 bocche con compensatore (Q costante indip.da Δp).\n` +
    `Distributori: N bocche/M posizioni. 4/3: P,T,A,B; 3 posizioni. Centro aperto: P→T a riposo. Centro chiuso: tutto bloccato. Proporzionali: posizione proporzionale al segnale elettrico.\n` +
    `Fluidodinamica: continuità Q=A1v1=A2v2. Bernoulli: p/(ρg)+v²/(2g)+z=cost. Con perdite: +hf. Hagen-Poiseuille (laminare): Δp=128μLQ/(πD⁴). Re=ρvD/μ: laminare<2300; turbolento>4000. Pressioni: bassa≤50bar; media 50÷200bar; alta 200÷350bar.\n\n` +

    `## TERMODINAMICA E FISICA TECNICA\n` +
    `Sistema chiuso: Q-L=ΔU. Sistema aperto stazionario: Q̇-Ẇ=ṁ·(Δh+Δv²/2+gΔz). h=u+pv. Gas ideale: Δh=cpΔT; Δu=cvΔT.\n` +
    `p·v=Rs·T. Aria: Rs=287J/(kgK); cp=1005J/(kgK); cv=718J/(kgK); γ=1,4.\n` +
    `II principio: η=L/QC=1-QF/QC≤ηCarnot=1-TF/TC. Frigorifero: COP=QF/L. Pompa calore: COP=QC/L.\n` +
    `Vapore: titolo x=m_vapore/m_tot. h=hf+x·hfg. Acqua 1atm: Tsat=100°C; hfg=2257kJ/kg.\n` +
    `Statica fluidi: dp/dz=-γ; p=p0+γh (γ=ρg). Archimede: FA=γfluido·Vimmerso. p_ass=p_rel+p_atm (patm≈101325Pa=1,013bar).\n` +
    `Equazione continuità: ṁ=ρAv=cost. Viscosità dinamica μ[Pa·s]: acqua 20°C≈10⁻³; olio VG46 a 40°C≈0,046.\n\n` +

    `## TRASMISSIONE DEL CALORE\n` +
    `Conduzione (Fourier): q=-λA(dT/dx)=λAΔT/L. Rt_cond=L/(λA). Guscio cilindrico: Rt=ln(r2/r1)/(2πLλ).\n` +
    `λ[W/(mK)]: acciaio=50; alluminio=237; rame=401; aria=0,026; acqua=0,607; PTFE=0,25.\n` +
    `Convezione (Newton): q=hA(Ts-T∞). Rt_conv=1/(hA). h[W/(m²K)]: libera gas 2÷25; forzata gas 25÷250; forzata liquidi 50÷20000; ebollizione/condensazione 2500÷100000.\n` +
    `Nu=hL/λ; Re=ρvL/μ; Pr=cpμ/λ; Ra=Gr·Pr; Gr=gβΔTL³/ν².\n` +
    `Irraggiamento: E=ε·σ·T⁴; σ=5,67×10⁻⁸W/(m²K⁴). ε: corpo nero=1; superfici reali 0<ε<1. α+ρ+τ=1; mezzo opaco: α+ρ=1.\n` +
    `Circuiti termici: q=ΔT/Rt (analogo I=ΔV/R). Serie: Rtot=ΣRi. Parallelo: 1/Rtot=Σ(1/Ri). U=1/(Rtot·A).\n` +
    `Scambiatori: q=UAΔTml. LMTD: ΔTml=(ΔT1-ΔT2)/ln(ΔT1/ΔT2). Equicorrente: ΔT1=Tci-Tfi; ΔT2=Tcu-Tfu. Controcorrente: ΔT1=Tci-Tfu; ΔT2=Tcu-Tfi (più efficiente). ε-NTU: ε=Q_reale/Q_max=f(Cr,NTU); NTU=UA/Cmin; Cr=Cmin/Cmax.\n`
  );
}

function isGroqRateLimit(status: number, raw: string) {
  const text = String(raw || "").toLowerCase();

  return (
    status === 429 ||
    text.includes("rate_limit") ||
    text.includes("rate limit") ||
    text.includes("tokens per day") ||
    text.includes("tpd") ||
    text.includes("tpm")
  );
}

function sanitizeGroqFailureMessage() {
  return (
    "⚠️ In questo momento il modello AI principale è al limite.\n\n" +
    "Ho provato automaticamente una modalità più leggera, ma non è disponibile. " +
    "Riprova tra qualche minuto oppure riduci la lunghezza del messaggio."
  );
}

async function callGroqText(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  fileMeta: string;
  analysisMode: AnalysisMode;
}) {
  const groqApiKey = process.env.GROQ_API_KEY;

  const route = chooseGroqModel({
    message: params.message,
    fileText: `${params.fileMeta}\n${params.fileText}`,
    analysisMode: params.analysisMode,
  });

  if (!groqApiKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave Groq per la chat testuale.\n\n" +
      "Su Vercel aggiungi:\n\n" +
      "```env\n" +
      "GROQ_API_KEY=la_tua_chiave_groq\n" +
      "GROQ_MODEL_FAST=llama-3.1-8b-instant\n" +
      "GROQ_MODEL_MEDIUM=llama-3.1-8b-instant\n" +
      "GROQ_MODEL_HARD=llama-3.3-70b-versatile\n" +
      "```\n\n" +
      "Poi fai Redeploy del progetto."
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const fastModel =
    process.env.GROQ_MODEL_FAST ||
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant";

  const fallbackRoutes: ModelRoute[] = [
    route,
    {
      level: "fast",
      model: fastModel,
      maxTokens: 350,
      timeoutMs: 12000,
      reason: "fallback automatico economico dopo errore o limite",
    },
    {
      level: "fast",
      model: "llama-3.1-8b-instant",
      maxTokens: 300,
      timeoutMs: 12000,
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
            content: String(m.text || "").slice(0, isFallback ? 900 : 2200),
          }))
      : [];

    const fileTextLimit = isFallback ? 3500 : currentRoute.level === "hard" ? 12000 : 8000;

    const finalUserContent =
      `${params.message || "Rispondi all'utente."}` +
      `${params.fileMeta ? `\n\n${params.fileMeta}` : ""}` +
      `${params.fileText ? `\n\n${String(params.fileText).slice(0, fileTextLimit)}` : ""}`;

    const systemPrompt = isFallback
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
          });

    let response: Response;

    try {
      response = await fetchWithTimeout(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${groqApiKey}`,
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

      if (isFallback && i > 0) {
        return (
          content +
          "\n\n---\n" +
          "Nota: ho usato automaticamente una modalità AI più leggera perché il modello principale era al limite."
        );
      }

      return content;
    }

    if (isGroqRateLimit(response.status, raw)) {
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
    return sanitizeGroqFailureMessage();
  }

  return (
    "⚠️ Il modello AI non ha risposto correttamente.\n\n" +
    "Riprova tra poco oppure riduci la lunghezza del messaggio."
  );
}

async function callOpenRouterVision(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  imageDataUrl: string;
  fileMeta: string;
  analysisMode: AnalysisMode;
}) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini";

  if (!openRouterKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave OpenRouter per analizzare immagini/tavole.\n\n" +
      "Su Vercel aggiungi queste variabili ambiente:\n\n" +
      "```env\n" +
      "OPENROUTER_API_KEY=la_tua_chiave_openrouter\n" +
      "OPENROUTER_VISION_MODEL=openai/gpt-4o-mini\n" +
      "```\n\n" +
      "Poi fai Redeploy del progetto."
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const prompt =
    `${params.message || "Analizza questa immagine tecnica con la massima precisione."}\n\n` +
    `${params.fileMeta ? `${params.fileMeta}\n` : ""}` +
    `Modalità analisi: ${params.analysisMode}\n`;

  let response: Response;

  try {
    response = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://project-exdwv.vercel.app",
          "X-Title": "TechAI Metallurgy Copilot",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                `Sei TechAI Vision, un ingegnere meccanico senior specializzato in disegno tecnico, tavole, CAD, componenti meccanici e distinte. ` +
                `Utente: ${userName}. Settore: ${focus}. Modalità: ${params.analysisMode}. ` +
                "Analizza immagini/tavole con precisione. Leggi quote, tolleranze, rugosità, filetti, scale e cartiglio quando visibili. " +
                "Non inventare valori: se non è leggibile, scrivi non leggibile. " +
                "Se è una tavola, controlla ISO 128, ISO 1101, ISO 286, ISO 1302 quando opportuno. " +
                "Se è uno screenshot CAD/SolidWorks, dai anche consigli pratici sui comandi da usare. " +
                "Rispondi in italiano tecnico preciso.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: params.imageDataUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 1100,
        }),
      },
      18000
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout OpenRouter durante l'analisi immagine.\n\n" +
        `Modello usato: ${model}\n\n` +
        "La funzione ha interrotto la chiamata prima del timeout di Vercel.\n\n" +
        "Controlla che `OPENROUTER_VISION_MODEL` sia un modello vision reale, ad esempio:\n\n" +
        "```env\n" +
        "OPENROUTER_VISION_MODEL=openai/gpt-4o-mini\n" +
        "```"
      );
    }

    throw error;
  }

  const raw = await response.text();
  const data = safeJsonParse<any>(raw, null);

  if (!response.ok) {
    return (
      "⚠️ OpenRouter ha restituito un errore durante l'analisi immagine.\n\n" +
      `Modello usato: ${model}\n` +
      `Codice: ${response.status}\n\n` +
      `Dettaglio: ${raw || "nessun dettaglio ricevuto"}\n\n` +
      "Controlla che la chiave OpenRouter sia valida e che il modello scelto supporti immagini."
    );
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "Ho ricevuto l'immagine, ma OpenRouter non ha restituito una risposta valida."
  );
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
        hasGroqKey: Boolean(process.env.GROQ_API_KEY),
        groqModelFallback: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        groqModelFast: process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant",
        groqModelMedium:
          process.env.GROQ_MODEL_MEDIUM ||
          process.env.GROQ_MODEL ||
          "llama-3.1-8b-instant",
        groqModelHard:
          process.env.GROQ_MODEL_HARD ||
          process.env.GROQ_MODEL_MEDIUM ||
          process.env.GROQ_MODEL ||
          "llama-3.3-70b-versatile",
        hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
        openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini",
        hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
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

    if (!auth.ok) {
      return auth.response;
    }

    const answer = body.imageDataUrl
      ? await callOpenRouterVision({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          imageDataUrl: body.imageDataUrl,
          fileMeta: body.fileMeta,
          analysisMode: body.analysisMode,
        })
      : await callGroqText({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          fileText: body.fileText,
          fileMeta: body.fileMeta,
          analysisMode: body.analysisMode,
        });

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
