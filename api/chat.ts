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
      `\n\n## MODALITÀ TAVOLA TECNICA\n` +
      `Analizza cartiglio, materiale, scala, viste, sezioni, quote, tolleranze, GD&T, rugosità, filetti, fori, lamature, note e producibilità.\n`
    );
  }

  if (analysisMode === "file") {
    return (
      `\n\n## MODALITÀ FILE TECNICO\n` +
      `Analizza il file caricato e produci riepilogo tecnico, problemi rilevati, dati utili e azioni consigliate.\n`
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
    `Rispondi in italiano, tecnico e preciso. Usa Markdown e notazione chiara per formule. Cita sempre le unità. Se mancano dati, chiedi.\n` +
    `Se la richiesta riguarda codice, dai modifiche precise, copiabili e complete. Se chiede un file completo, riscrivi il file completo.\n` +
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
                `Sei TechAI Vision, un ingegnere meccanico senior specializzato in disegno tecnico secondo norme ISO 128, ISO 1101, ISO 286 e ISO 1302. ` +
                `Utente: ${userName}. Settore: ${focus}. Modalità: ${params.analysisMode}. ` +
                "Il tuo compito è analizzare tavole tecniche meccaniche, immagini CAD, screenshot SolidWorks, componenti meccanici e distinte visive con la massima precisione. " +
                "Leggi quote, tolleranze, rugosità, filetti, fori, lamature, scale, materiale, trattamento e cartiglio quando visibili. " +
                "Non inventare valori: se un dato non è leggibile o non è presente, scrivi chiaramente 'non leggibile' oppure 'non indicato'. " +
                "Rispondi in italiano tecnico preciso. " +
                "\n\nREGOLE DI FORMATTAZIONE OBBLIGATORIE:\n" +
                "Usa sempre emoji di stato all'inizio delle righe di controllo:\n" +
                "✅ = elemento corretto, presente, conforme o verificato.\n" +
                "❌ = errore, mancanza, incongruenza, non conformità o problema critico.\n" +
                "⚠️ = dato dubbio, poco leggibile, incompleto o da verificare.\n" +
                "Non usare asterischi Markdown tipo **Materiale** quando scrivi gli esiti tecnici. Scrivi invece frasi pulite.\n" +
                "Esempio corretto: ✅ Materiale: 11SMnPb37 - UNI EN 10087.\n" +
                "Esempio corretto: ❌ Rugosità: non indicata sulle superfici funzionali.\n" +
                "Esempio corretto: ⚠️ Tolleranze geometriche: non visibili, da verificare se necessarie.\n" +
                "\n\nSTRUTTURA RISPOSTA OBBLIGATORIA PER TAVOLE TECNICHE:\n" +
                "## 1. Cartiglio\n" +
                "Per ogni voce usa ✅ / ❌ / ⚠️. Controlla nome pezzo, numero disegno, materiale, scala, autore, data, revisione, unità.\n\n" +
                "## 2. Viste e sezioni\n" +
                "Controlla se le viste sono sufficienti, se servono sezioni A-A/B-B, dettagli, viste ausiliarie o ingrandimenti.\n\n" +
                "## 3. Quotatura\n" +
                "Cita le quote leggibili. Segnala quote mancanti, ridondanti, catene chiuse, riferimenti poco chiari o quote funzionali assenti.\n\n" +
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
                "Se è uno screenshot CAD/SolidWorks, aggiungi: Metodo consigliato, Comandi SolidWorks in italiano, Errori comuni e Quando NON usare questo metodo.",
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
          max_tokens: 1400,
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
