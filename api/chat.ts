// FILE: api/chat.ts

import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

type ChatMessage = {
  role?: string;
  text?: string;
};

type RequestBodyData = {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  imageDataUrl: string;
  fileMeta: string;
  hasFile: boolean;
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

async function readRequestBody(req: Request): Promise<RequestBodyData> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const message = String(formData.get("message") || "");
    const messagesRaw = String(formData.get("messages") || "[]");
    const profileRaw = String(formData.get("profile") || "{}");
    const file = formData.get("file");
    const preExtractedText = formData.get("fileText");

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

      fileMeta =
        `File caricato:\n` +
        `Nome: ${fileName}\n` +
        `Tipo: ${fileType}\n` +
        `Dimensione: ${fileSizeKb} KB\n`;

      if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        imageDataUrl = `data:${file.type};base64,${base64}`;
      } else if (typeof preExtractedText === "string" && preExtractedText.trim()) {
        fileText = `\n\nContenuto del file:\n${preExtractedText.slice(0, 18000)}`;
      } else {
        try {
          const text = await file.text();
          fileText = text?.trim()
            ? `\n\nContenuto del file:\n${text.slice(0, 12000)}`
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
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    message: body.message || "",
    messages: body.messages || [],
    profile: body.profile || {},
    fileText: "",
    imageDataUrl: "",
    fileMeta: "",
    hasFile: false,
  };
}

/**
 * IMPORTANTE:
 * La scelta del modello viene fatta SOLO sul prompt attuale + file.
 * La cronologia NON viene usata per decidere fast / medium / hard.
 */
function chooseGroqModel(params: {
  message: string;
  fileText: string;
}): ModelRoute {
  const message = String(params.message || "");
  const fileText = String(params.fileText || "");

  const routingText = `${message}\n${fileText}`.toLowerCase();

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
    mediumModel;

  let score = 0;
  const reasons: string[] = [];

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
    /calcola|verifica|dimensiona|flessione|torsione|taglio|von mises|tresca|fatica|coefficiente|momento|tensione|formula|meccanica|albero|perno|cuscinetto|linguetta|bullone/i.test(routingText)
  ) {
    score += 2;
    reasons.push("calcolo tecnico");
  }

  if (
    /tavola|disegno tecnico|rugosità|rugosita|tolleranza|gd&t|quota|sezione|cartiglio|materiale|acciaio|c45|42crmo4|aisi|inventor|solidworks/i.test(routingText)
  ) {
    score += 2;
    reasons.push("argomento tecnico");
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
      maxTokens: 900,
      timeoutMs: 20000,
      reason: reasons.join(", ") || "richiesta complessa",
    };
  }

  return {
    level: "medium",
    model: mediumModel,
    maxTokens: 650,
    timeoutMs: 16000,
    reason: reasons.join(", ") || "richiesta media",
  };
}

function buildTechAiSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
}) {
  const { userName, focus, route } = params;

  return (
    `Sei TechAI, copilot tecnico per ingegneria meccanica industriale.\n` +
    `Utente: ${userName}. Focus: ${focus}.\n` +
    `Livello selezionato automaticamente: ${route.level}. Motivo: ${route.reason}.\n\n` +

    `REGOLE RISPOSTA:\n` +
    `- Rispondi nella stessa lingua dell'utente.\n` +
    `- Sii diretto, ordinato, tecnico e pratico in tono amichevole e cordiale.\n` +
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
    `Fatica: σm=(σmax+σmin)/2, σa=(σmax-σmin)/2, Se≈0,5Rm corretto con fattori.\n` +
    `Materiali: S235/S275/S355 per carpenteria; C45 per alberi/perni medi; 42CrMo4 e 39NiCrMo3 per carichi alti; 16MnCr5 per cementazione; 100Cr6 per rulli/cuscinetti.\n` +
    `Tolleranze: sede cuscinetto H7; albero rotante k6/m6; scorrimento H7/f7; fisso H7/s6.\n` +
    `Rugosità: generica Ra 3,2÷6,3 µm; sedi/tenute Ra 0,8÷1,6 µm; superfici molto funzionali Ra 0,4÷0,8 µm.\n` +
    `Oleoidraulica: F=pA; v=Q/A; centro aperto P→T; centro chiuso vie bloccate.\n`
  );
}

function buildLightSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
}) {
  const { userName, focus, route } = params;

  return (
    `Sei TechAI, assistente tecnico per meccanica e sviluppo React/TypeScript.\n` +
    `Utente: ${userName}. Focus: ${focus}. Modalità leggera: ${route.level}.\n` +
    `Rispondi nella stessa lingua dell'utente. Sii diretto, pratico e ordinato. ` +
    `Non inventare dati. Se mancano dati, chiedili. ` +
    `Per codice, dai modifiche complete e copiabili.`
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
}) {
  const groqApiKey = process.env.GROQ_API_KEY;

  const route = chooseGroqModel({
    message: params.message,
    fileText: params.fileText,
  });

  if (!groqApiKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave Groq per la chat testuale.\n\n" +
      "Su Vercel aggiungi:\n\n" +
      "```env\n" +
      "GROQ_API_KEY=la_tua_chiave_groq\n" +
      "GROQ_MODEL_FAST=llama-3.1-8b-instant\n" +
      "GROQ_MODEL_MEDIUM=llama-3.3-70b-versatile\n" +
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

    const fileTextLimit = isFallback ? 3500 : 9000;

    const finalUserContent =
      `${params.message || "Rispondi all'utente."}` +
      `${params.fileText ? `\n\n${String(params.fileText).slice(0, fileTextLimit)}` : ""}`;

    const systemPrompt = isFallback
      ? buildLightSystemPrompt({
          userName,
          focus,
          route: currentRoute,
        })
      : buildTechAiSystemPrompt({
          userName,
          focus,
          route: currentRoute,
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
    `${params.message || "Analizza questa tavola tecnica meccanica con la massima precisione."}\n\n` +
    `${params.fileMeta ? `${params.fileMeta}\n` : ""}`;

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
                `Utente: ${userName}. Settore: ${focus}. ` +
                "Il tuo compito è analizzare tavole tecniche meccaniche con la massima precisione. " +
                "Leggi quote, tolleranze, rugosità, filetti, scale e cartiglio. " +
                "Non inventare valori: se non è leggibile, scrivi non leggibile. " +
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
          max_tokens: 1000,
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
          "llama-3.1-8b-instant",
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
        })
      : await callGroqText({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          fileText: body.fileText,
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
