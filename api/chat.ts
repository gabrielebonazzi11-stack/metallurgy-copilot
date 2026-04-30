import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

type ChatMessage = {
  role?: string;
  text?: string;
};

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

async function readRequestBody(req: Request) {
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

    if (file instanceof File) {
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
        fileText = `\n\nContenuto del file:\n${preExtractedText.slice(0, 45000)}`;
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
  };
}

async function callGroqText(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
}) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!groqApiKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave Groq per la chat testuale.\n\n" +
      "Su Vercel aggiungi:\n\n" +
      "```env\n" +
      "GROQ_API_KEY=la_tua_chiave_groq\n" +
      "GROQ_MODEL=llama-3.1-8b-instant\n" +
      "```"
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const cleanHistory = Array.isArray(params.messages)
    ? params.messages
        .slice(-12)
        .filter((m: ChatMessage) => String(m.text || "").trim())
        .map((m: ChatMessage) => ({
          role: m.role === "AI" || m.role === "assistant" ? "assistant" : "user",
          content: String(m.text || ""),
        }))
    : [];

  const finalUserContent =
    `${params.message || "Rispondi all'utente."}` +
    `${params.fileText ? `\n\n${params.fileText}` : ""}`;

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
          model: groqModel,
          messages: [
            {
              role: "system",
              content:
                `Sei TechAI. Utente: ${userName}. Focus principale: ${focus}. ` +
                "Rispondi sempre in italiano, in modo chiaro, tecnico e ordinato. " +
                "Puoi usare emoji con moderazione. Quando fai calcoli o formule usa LaTeX leggibile.",
            },
            ...cleanHistory,
            {
              role: "user",
              content: finalUserContent,
            },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      },
      18000
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout Groq.\n\n" +
        "Il modello testuale non ha risposto entro il limite impostato.\n\n" +
        "Prova a usare questo modello nelle variabili ambiente:\n\n" +
        "```env\n" +
        "GROQ_MODEL=llama-3.1-8b-instant\n" +
        "```"
      );
    }

    throw error;
  }

  const raw = await response.text();
  const data = safeJsonParse<any>(raw, null);

  if (!response.ok) {
    return (
      "⚠️ Il backend ha chiamato Groq, ma Groq ha restituito un errore.\n\n" +
      `Modello usato: ${groqModel}\n` +
      `Codice: ${response.status}\n\n` +
      `Dettaglio: ${raw || "nessun dettaglio ricevuto"}`
    );
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "Ho ricevuto la richiesta, ma Groq non ha restituito una risposta valida."
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

  const prompt = params.message || "Analizza questa tavola tecnica meccanica con la massima precisione.";

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
                "Il tuo compito è analizzare tavole tecniche meccaniche con la MASSIMA PRECISIONE. " +
                "REGOLE FONDAMENTALI: " +
                "(1) Leggi e cita OGNI valore numerico visibile nella tavola: quote, tolleranze, rugosità Ra/Rz, designazioni filetti, scale. " +
                "(2) NON inventare mai valori: se un numero non è leggibile, scrivi esplicitamente 'non leggibile' o 'non visibile'. " +
                "(3) Identifica errori reali e specifici, non generici. Cita la posizione (es. 'quota in alto a destra', 'vista frontale'). " +
                "(4) Verifica la coerenza interna: le quote si sommano correttamente? Le tolleranze sono compatibili con la lavorazione indicata? " +
                "(5) Controlla sempre: cartiglio completo, numero di viste sufficiente, catena di quote chiusa, datum per GD&T, rugosità su superfici funzionali. " +
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
          max_tokens: 1200,
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

async function checkAuthAndRateLimit(req: Request): Promise<
  | { ok: true; userId: string; supabase: any }
  | { ok: false; response: Response }
> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      ok: false,
      response: jsonResponse({ error: "Supabase server non configurato." }, 500),
    };
  }

  const authHeader = req.headers.get("authorization");

  if (!authHeader) {
    return {
      ok: false,
      response: jsonResponse({ error: "Token mancante. Effettua il login." }, 401),
    };
  }

  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

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

  return { ok: true, userId: user.id, supabase };
}

async function incrementUsage(supabase: any, userId: string) {
  if (!userId) return;

  const { data } = await supabase
    .from("profiles")
    .select("ai_requests_used, ai_requests_limit")
    .eq("id", userId)
    .single();

  const profile = data as { ai_requests_used: number; ai_requests_limit: number } | null;

  if (profile) {
    console.log("USER ID:", userId);
    console.log("USAGE BEFORE:", profile.ai_requests_used);
    console.log("LIMIT:", profile.ai_requests_limit);

    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update({ ai_requests_used: profile.ai_requests_used + 1 })
      .eq("id", userId)
      .select("ai_requests_used")
      .single();

    if (updateError) {
      console.error("Errore update usage:", updateError);
    } else {
      console.log("Usage aggiornato:", updatedProfile.ai_requests_used);
    }
  }
}

export default async function handler(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "API /api/chat funzionante",
      env: {
        hasGroqKey: Boolean(process.env.GROQ_API_KEY),
        groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
        openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini",
        hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito. Usa POST." }, 405);
  }

  try {
    const auth = await checkAuthAndRateLimit(req);

    if (!auth.ok) {
      return auth.response;
    }

    const body = await readRequestBody(req);

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

    await incrementUsage(auth.supabase, auth.userId);

    return jsonResponse({ answer });
  } catch (error: any) {
    return jsonResponse({
      answer:
        "⚠️ Errore interno nella rotta `/api/chat`.\n\n" +
        `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
    });
  }
}
