import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import mammoth from "mammoth";
import XLSX from "xlsx";
import pdfParse from "pdf-parse";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3001);
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";

if (!GROQ_API_KEY) {
  console.warn("⚠️ GROQ_API_KEY non trovata nel file .env. Il backend partirà, ma /api/chat non potrà chiamare l'AI.");
}

app.use(
  cors({
    origin: FRONTEND_ORIGIN,
    methods: ["GET", "POST"],
  })
);

app.use(express.json({ limit: "2mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 12 * 1024 * 1024,
  },
});

type ChatRole = "utente" | "AI" | "user" | "assistant" | "system";

interface ClientMessage {
  role: ChatRole;
  text: string;
}

const allowedExtensions = new Set([
  ".txt",
  ".md",
  ".csv",
  ".json",
  ".xml",
  ".html",
  ".css",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".py",
  ".java",
  ".cpp",
  ".c",
  ".h",
  ".sql",
  ".yaml",
  ".yml",
  ".pdf",
  ".docx",
  ".xlsx",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
]);

function isAllowedFile(filename: string) {
  const ext = path.extname(filename).toLowerCase();
  return allowedExtensions.has(ext);
}

function clampText(text: string, maxChars = 45000) {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "\n\n[Contenuto tagliato perché troppo lungo.]";
}

function safeJsonParse<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

async function extractTextFromFile(file: Express.Multer.File) {
  const filename = file.originalname;
  const ext = path.extname(filename).toLowerCase();
  const buffer = file.buffer;

  if (!isAllowedFile(filename)) {
    throw new Error(`Formato file non supportato: ${ext || "sconosciuto"}`);
  }

  if ([".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
    return `[Immagine caricata: ${filename}. OCR/lettura immagini non configurata in questo backend base.]`;
  }

  if (ext === ".pdf") {
    const result = await pdfParse(buffer);
    return result.text || "[PDF letto, ma non è stato trovato testo selezionabile.]";
  }

  if (ext === ".docx") {
    const result = await mammoth.extractRawText({ buffer });
    return result.value || "[DOCX letto, ma non è stato trovato testo.]";
  }

  if (ext === ".xlsx") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    let text = "";

    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      text += `\n--- FOGLIO: ${sheetName} ---\n${csv}`;
    });

    return text || "[XLSX letto, ma non è stato trovato contenuto.]";
  }

  return buffer.toString("utf-8");
}

function toGroqMessages(messages: ClientMessage[], currentMessage: string, fileText?: string) {
  const cleanHistory = messages
    .slice(-12)
    .filter(message => message.text?.trim())
    .map(message => ({
      role: message.role === "AI" || message.role === "assistant" ? "assistant" : "user",
      content: message.text,
    }));

  const systemPrompt =
    "Sei TechAI, un assistente tecnico per ingegneria, progettazione meccanica, tavole tecniche, calcoli e studio. " +
    "Rispondi in italiano, in modo chiaro, ordinato e professionale. " +
    "Puoi usare emoji mirate come ✅, ⚠️, 📌, 🔧, 📐, 🧮 quando aiutano la leggibilità, senza esagerare. " +
    "Usa titoli Markdown con ## e ### quando la risposta è lunga. " +
    "Se ci sono formule, usa LaTeX leggibile con \\frac{}, \\cdot, \\sqrt{} e blocchi \\[ ... \\]. " +
    "Quando analizzi file caricati, cita chiaramente che ti basi sul contenuto ricevuto dal backend. " +
    "Se mancano dati per un calcolo, chiedi i dati mancanti invece di inventarli.";

  const finalUserContent = fileText
    ? `${currentMessage}\n\n--- CONTENUTO FILE CARICATO ---\n${clampText(fileText)}\n--- FINE CONTENUTO FILE ---`
    : currentMessage;

  return [
    { role: "system", content: systemPrompt },
    ...cleanHistory,
    { role: "user", content: finalUserContent },
  ];
}

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: "TechAI backend",
    model: GROQ_MODEL,
    hasGroqKey: Boolean(GROQ_API_KEY),
  });
});

app.post("/api/chat", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!GROQ_API_KEY) {
      return res.status(500).json({
        error: "GROQ_API_KEY mancante nel backend. Inseriscila nel file .env.",
      });
    }

    const message = String(req.body.message || "").trim();
    const messages = safeJsonParse<ClientMessage[]>(req.body.messages, []);
    const uploadedFile = req.file;

    if (!message && !uploadedFile) {
      return res.status(400).json({ error: "Messaggio o file obbligatorio." });
    }

    let fileText = "";

    if (uploadedFile) {
      fileText = await extractTextFromFile(uploadedFile);
    }

    const groqMessages = toGroqMessages(messages, message || "Analizza il file caricato.", fileText);

    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: groqMessages,
        temperature: 0.25,
      }),
    });

    const data = await groqResponse.json();

    if (!groqResponse.ok) {
      console.error("Errore Groq:", data);
      return res.status(groqResponse.status).json({
        error: "Errore durante la chiamata al modello AI.",
        details: data,
      });
    }

    const answer = data?.choices?.[0]?.message?.content || "Non ho ricevuto una risposta valida dal modello.";

    return res.json({
      answer,
      fileReceived: uploadedFile
        ? {
            name: uploadedFile.originalname,
            type: uploadedFile.mimetype,
            size: uploadedFile.size,
          }
        : null,
    });
  } catch (error: any) {
    console.error("Errore /api/chat:", error);
    return res.status(500).json({
      error: "Errore interno del backend.",
      details: error?.message || "Errore sconosciuto",
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ TechAI backend attivo su http://localhost:${PORT}`);
  console.log(`🔒 Frontend consentito: ${FRONTEND_ORIGIN}`);
});
