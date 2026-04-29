export const config = {
  runtime: "nodejs",
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

async function readRequestBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const message = String(formData.get("message") || "");
    const messagesRaw = String(formData.get("messages") || "[]");
    const profileRaw = String(formData.get("profile") || "{}");
    const file = formData.get("file");

    let messages: ChatMessage[] = [];
    let profile: any = {};

    try {
      messages = JSON.parse(messagesRaw);
    } catch {
      messages = [];
    }

    try {
      profile = JSON.parse(profileRaw);
    } catch {
      profile = {};
    }

    let fileText = "";

    if (file instanceof File) {
      const fileName = file.name || "file caricato";
      const fileType = file.type || "sconosciuto";
      const fileSizeKb = (file.size / 1024).toFixed(1);

      fileText =
        `\n\nFile caricato:\n` +
        `Nome: ${fileName}\n` +
        `Tipo: ${fileType}\n` +
        `Dimensione: ${fileSizeKb} KB\n`;

      try {
        const text = await file.text();
        if (text && text.trim()) {
          fileText += `\nContenuto del file:\n${text.slice(0, 12000)}`;
        } else {
          fileText += `\nIl file non contiene testo leggibile direttamente.`;
        }
      } catch {
        fileText += `\nNon sono riuscito a leggere il contenuto testuale del file.`;
      }
    }

    return {
      message,
      messages,
      profile,
      fileText,
    };
  }

  try {
    const body = await req.json();
    return {
      message: body.message || "",
      messages: body.messages || [],
      profile: body.profile || {},
      fileText: "",
    };
  } catch {
    return {
      message: "",
      messages: [],
      profile: {},
      fileText: "",
    };
  }
}

export default async function handler(req: Request) {
  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Metodo non consentito. Usa POST.",
      },
      405
    );
  }

  try {
    const groqApiKey = process.env.GROQ_API_KEY;
    const groqModel = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    if (!groqApiKey) {
      return jsonResponse(
        {
          answer:
            "⚠️ Backend collegato, ma manca la chiave API.\n\n" +
            "La rotta `/api/chat` ora esiste e funziona, però su Vercel devi aggiungere la variabile ambiente:\n\n" +
            "```env\n" +
            "GROQ_API_KEY=la_tua_chiave\n" +
            "GROQ_MODEL=llama-3.3-70b-versatile\n" +
            "```\n\n" +
            "Vai su Vercel → Project Settings → Environment Variables.",
        },
        200
      );
    }

    const { message, messages, profile, fileText } = await readRequestBody(req);

    const userName = profile?.userName || "Utente";
    const focus = profile?.focus || "Ingegneria Meccanica";

    const cleanHistory = Array.isArray(messages)
      ? messages.slice(-12).map((m: ChatMessage) => ({
          role: m.role === "AI" ? "assistant" : "user",
          content: String(m.text || ""),
        }))
      : [];

    const finalUserContent =
      `${message || "Rispondi all'utente."}` +
      `${fileText ? `\n\n${fileText}` : ""}`;

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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
              "Puoi usare emoji con moderazione per rendere la risposta leggibile. " +
              "Quando fai calcoli o formule usa LaTeX leggibile. " +
              "Per argomenti tecnici usa passaggi numerati, conclusione finale e note pratiche. " +
              "Se l'utente carica un file, analizza il contenuto disponibile.",
          },
          ...cleanHistory,
          {
            role: "user",
            content: finalUserContent,
          },
        ],
        temperature: 0.4,
        max_tokens: 1800,
      }),
    });

    const raw = await groqResponse.text();

    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      data = null;
    }

    if (!groqResponse.ok) {
      return jsonResponse(
        {
          answer:
            "⚠️ Il backend ha chiamato Groq, ma Groq ha restituito un errore.\n\n" +
            `Codice: ${groqResponse.status}\n\n` +
            `Dettaglio: ${raw || "nessun dettaglio ricevuto"}`,
        },
        200
      );
    }

    const answer =
      data?.choices?.[0]?.message?.content ||
      "Ho ricevuto la richiesta, ma il modello non ha restituito una risposta valida.";

    return jsonResponse({
      answer,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        answer:
          "⚠️ Errore interno nella rotta `/api/chat`.\n\n" +
          `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
      },
      200
    );
  }
}
