import React, { useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS_DB, MaterialInfo } from "./data/materials";

type Role = "utente" | "AI";
type IssueSeverity = "errore" | "attenzione" | "info";

type Theme = {
  name: string;
  primary: string;
  bg: string;
  surface: string;
  text: string;
  border: string;
};

type FileAttachment = {
  name: string;
  type: string;
  size: number;
};

type PendingFile = {
  file: File;
  fileAttachment: FileAttachment;
};

type Message = {
  role: Role;
  text: string;
  fileAttachment?: FileAttachment;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
};

type UserProfile = {
  name: string;
  email: string;
};

type DrawingUpload = {
  file: File;
  fileAttachment: FileAttachment;
  previewUrl?: string;
};

type DrawingIssue = {
  id: string;
  label: string;
  severity: IssueSeverity;
  x: number;
  y: number;
  detail: string;
};

type DrawingResult = {
  category: string;
  status: string;
  item: string;
  reason: string;
  suggestion: string;
};

type DrawingForm = {
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
};

type QuickCalcResult = {
  title: string;
  values: string[];
  outcome: "OK" | "NON OK";
};

const THEMES: Theme[] = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

const STORAGE_KEY = "techai_backend_ready_fixed_v3";
const DEFAULT_USER: UserProfile = { name: "Utente", email: "utente@techai.local" };

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeAttachment(file: File): FileAttachment {
  return {
    name: file.name || "file",
    type: file.type || "sconosciuto",
    size: file.size || 0,
  };
}

function isDrawingReviewFile(file: File | null | undefined) {
  if (!file) return false;
  return file.type.startsWith("image/");
}

function isImageReviewFile(upload: DrawingUpload | null) {
  return Boolean(upload?.file && upload.file.type.startsWith("image/"));
}

function isStepFile(file: File | null | undefined) {
  if (!file) return false;
  const name = file.name.toLowerCase();
  return name.endsWith(".step") || name.endsWith(".stp") || name.endsWith(".stl") || name.endsWith(".iges") || name.endsWith(".igs");
}

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildIssuesFromAiAnswer(answer: string): DrawingIssue[] {
  const lower = answer.toLowerCase();
  const issues: DrawingIssue[] = [];

  if (lower.includes("quota") || lower.includes("quote")) {
    issues.push({ id: "ai-quote", label: "Quote", severity: "attenzione", x: 34, y: 36, detail: "L'analisi AI segnala controlli sulle quote." });
  }
  if (lower.includes("toller")) {
    issues.push({ id: "ai-tolleranze", label: "Tolleranze", severity: "attenzione", x: 63, y: 34, detail: "L'analisi AI segnala controlli sulle tolleranze." });
  }
  if (lower.includes("rugos")) {
    issues.push({ id: "ai-rugosita", label: "Rugosità", severity: "attenzione", x: 44, y: 64, detail: "L'analisi AI segnala controlli sulla rugosità." });
  }
  if (lower.includes("cartiglio") || lower.includes("materiale") || lower.includes("scala") || lower.includes("unità")) {
    issues.push({ id: "ai-cartiglio", label: "Cartiglio", severity: "attenzione", x: 78, y: 78, detail: "L'analisi AI segnala controlli sul cartiglio o sulle note generali." });
  }
  if (lower.includes("sezione") || lower.includes("vista") || lower.includes("dettaglio")) {
    issues.push({ id: "ai-viste", label: "Viste/Sezioni", severity: "info", x: 58, y: 24, detail: "L'analisi AI segnala controlli su viste, sezioni o dettagli." });
  }

  if (issues.length === 0) {
    issues.push({ id: "ai-generale", label: "Analisi AI", severity: "info", x: 50, y: 50, detail: "Analisi completata. Leggi il risultato testuale sotto." });
  }

  return issues;
}

function runClientTests() {
  try {
    const png = new File(["x"], "tavola.png", { type: "image/png" });
    const step = new File(["x"], "pezzo.step", { type: "application/octet-stream" });
    const txt = new File(["x"], "note.txt", { type: "text/plain" });

    console.assert(isDrawingReviewFile(png) === true, "TEST: PNG should be valid drawing review file");
    console.assert(isStepFile(step) === true, "TEST: STEP helper still validates STEP files, but STEP upload is hidden in the Tavole UI");
    console.assert(isDrawingReviewFile(txt) === false, "TEST: TXT should not be a drawing review file");
    console.assert(buildIssuesFromAiAnswer("mancano quote e tolleranze").length >= 2, "TEST: AI issue extraction should detect quote/tolleranze");
  } catch {
    // I test usano File, disponibile nel browser. Nessun blocco in ambienti strani.
  }
}

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDrawingGenerator, setShowDrawingGenerator] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("Aspetto");

  const [user, setUser] = useState<UserProfile>(DEFAULT_USER);
  const [loginEmail, setLoginEmail] = useState(DEFAULT_USER.email);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(true);

  const [theme, setTheme] = useState(THEMES[5]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const [materialSearch, setMaterialSearch] = useState("");
  const [quickCalcResult, setQuickCalcResult] = useState<QuickCalcResult | null>(null);

  const [drawingReviewFile, setDrawingReviewFile] = useState<DrawingUpload | null>(null);
  const [drawingStepFile, setDrawingStepFile] = useState<DrawingUpload | null>(null);
  const [drawingAiLoading, setDrawingAiLoading] = useState(false);
  const [drawingResults, setDrawingResults] = useState<DrawingResult[]>([]);
  const [drawingIssues, setDrawingIssues] = useState<DrawingIssue[]>([]);
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingReviewInputRef = useRef<HTMLInputElement>(null);
  const drawingStepInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isDark = theme.name === "Dark Black";
  const activeChat = chats.find(chat => chat.id === activeChatId);
  const currentMessages = activeChat?.messages || [];

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return MATERIALS_DB.slice(0, 40);
    return MATERIALS_DB.filter((m: MaterialInfo) => `${m.name} ${m.en} ${m.uni} ${m.din} ${m.aisi} ${m.jis} ${m.iso} ${m.uses}`.toLowerCase().includes(q)).slice(0, 80);
  }, [materialSearch]);

  useEffect(() => {
    runClientTests();
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    const data = safeParseJson<any>(saved, null);
    if (!data) return;
    setTheme(THEMES.find(t => t.name === data.themeName) || THEMES[5]);
    setUser(data.user || DEFAULT_USER);
    setLoginEmail(data.user?.email || DEFAULT_USER.email);
    setInterest(data.interest || "Ingegneria Meccanica");
    setChats(Array.isArray(data.chats) ? data.chats : []);
    setActiveChatId(data.activeChatId || null);
    setSidebarOpen(data.sidebarOpen ?? true);
    setIsLoggedIn(data.isLoggedIn ?? true);
  }, []);

  useEffect(() => {
    const safeChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message => ({ role: message.role, text: message.text, fileAttachment: message.fileAttachment })),
    }));

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ themeName: theme.name, user, interest, chats: safeChats, activeChatId, sidebarOpen, isLoggedIn })
    );
  }, [theme, user, interest, chats, activeChatId, sidebarOpen, isLoggedIn]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

  useEffect(() => {
    return () => {
      if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);
      if (drawingStepFile?.previewUrl) URL.revokeObjectURL(drawingStepFile.previewUrl);
    };
  }, [drawingReviewFile?.previewUrl, drawingStepFile?.previewUrl]);

  const createChatObject = (title = "Nuova chat"): ChatSession => ({
    id: createId(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  });

  const createNewChat = () => {
    const newChat = createChatObject();
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setPendingFile(null);
    setQuery("");
  };

  const ensureActiveChat = (title = "Nuova chat") => {
    if (activeChatId) return activeChatId;
    const newChat = createChatObject(title);
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;
        const first = messages.find(m => m.role === "utente")?.text || chat.title;
        return { ...chat, messages, title: first.slice(0, 32) + (first.length > 32 ? "..." : "") };
      })
    );
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(chat => chat.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const clearAllChats = () => {
    setChats([]);
    setActiveChatId(null);
    setPendingFile(null);
    setQuery("");
  };

  const updateDrawingField = (field: keyof DrawingForm, value: string) => {
    setDrawingForm(prev => ({ ...prev, [field]: value }));
  };

  const handleLogin = () => {
    if (!loginEmail.includes("@")) {
      setLoginError("Inserisci una email valida.");
      return;
    }
    if (!loginPassword.trim()) {
      setLoginError("Inserisci una password.");
      return;
    }
    setUser(prev => ({ ...prev, email: loginEmail.trim() }));
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
    setLoginPassword("");
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPendingFile({ file, fileAttachment: makeAttachment(file) });
    event.target.value = "";
  };

  const removePendingFile = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const callAI = async () => {
    if ((!query.trim() && !pendingFile) || loading) return;

    const text = query.trim() || `Analizza il file "${pendingFile?.fileAttachment.name}".`;
    const chatId = ensureActiveChat(pendingFile ? `File: ${pendingFile.fileAttachment.name}` : text);
    const userMessage: Message = pendingFile ? { role: "utente", text, fileAttachment: pendingFile.fileAttachment } : { role: "utente", text };
    const fileToSend = pendingFile;
    const oldMessages = chats.find(chat => chat.id === chatId)?.messages || [];
    const updatedMessages = [...oldMessages, userMessage];

    setQuery("");
    setPendingFile(null);
    setLoading(true);
    replaceMessagesInChat(chatId, updatedMessages);

    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append("messages", JSON.stringify(updatedMessages.map(m => ({ role: m.role, text: m.text }))));
      formData.append("profile", JSON.stringify({ userName: user.name, focus: interest }));
      if (fileToSend?.file) formData.append("file", fileToSend.file);

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      const raw = await res.text();
      const data = safeParseJson<any>(raw, null);

      if (!res.ok) throw new Error(data?.error || raw || `Errore HTTP ${res.status}`);
      const answer = data?.answer || data?.message || raw;
      if (!answer) throw new Error("Il backend non ha restituito una risposta valida.");

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: answer }]);
    } catch (error: any) {
      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        {
          role: "AI",
          text: `⚠️ Backend non collegato correttamente.\n\nControlla che la rotta \`/api/chat\` esista su Vercel e che le variabili ambiente siano configurate.\n\nDettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleDrawingReviewUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isDrawingReviewFile(file)) {
      alert("Per la revisione tavola carica solo immagini: PNG, JPG, JPEG o WebP.");
      event.target.value = "";
      return;
    }

    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);

    setDrawingReviewFile({
      file,
      fileAttachment: makeAttachment(file),
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    });
    setDrawingResults([]);
    setDrawingIssues([]);
    event.target.value = "";
  };

  const handleDrawingStepUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isStepFile(file)) {
      alert("Per l'idea tavola carica un file STEP/STP, STL o IGES.");
      event.target.value = "";
      return;
    }

    if (drawingStepFile?.previewUrl) URL.revokeObjectURL(drawingStepFile.previewUrl);

    setDrawingStepFile({ file, fileAttachment: makeAttachment(file) });
    setDrawingResults([]);
    setDrawingIssues([]);
    event.target.value = "";
  };

  const removeDrawingReviewFile = () => {
    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);
    setDrawingReviewFile(null);
    setDrawingResults([]);
    setDrawingIssues([]);
    if (drawingReviewInputRef.current) drawingReviewInputRef.current.value = "";
  };

  const removeDrawingStepFile = () => {
    if (drawingStepFile?.previewUrl) URL.revokeObjectURL(drawingStepFile.previewUrl);
    setDrawingStepFile(null);
    setDrawingResults([]);
    setDrawingIssues([]);
    if (drawingStepInputRef.current) drawingStepInputRef.current.value = "";
  };

  const runDrawingGenerator = async () => {
    const f = drawingForm;

    if (isImageReviewFile(drawingReviewFile)) {
      setDrawingAiLoading(true);
      setDrawingResults([]);
      setDrawingIssues([]);

      try {
        const formData = new FormData();
        formData.append(
          "message",
          `Analizza questa tavola tecnica caricata come immagine.\n\nDati utente:\n- Nome pezzo: ${f.partName || "non indicato"}\n- Tipo pezzo: ${f.partType || "non indicato"}\n- Materiale: ${f.material || "non indicato"}\n- Quantità/lotto: ${f.productionQuantity || "non indicato"}\n- Lavorazione prevista: ${f.manufacturing || "non indicata"}\n- Geometrie principali: ${f.mainFeatures || "non indicate"}\n- Funzione nell'assieme: ${f.assemblyFunction || "non indicata"}\n- Superfici funzionali: ${f.functionalSurfaces || "non indicate"}\n- Fori/filetti/lamature: ${f.holesThreads || "non indicati"}\n- Accoppiamenti: ${f.fits || "non indicati"}\n- Tolleranze previste: ${f.tolerances || "non indicate"}\n- Rugosità previste: ${f.roughness || "non indicate"}\n\nGuarda davvero l'immagine. Non fare una checklist generica. Se qualcosa non è leggibile, dillo chiaramente. Organizza la risposta con Sintesi, Errori/Mancanze, Zone da controllare, Correzioni consigliate e Conclusione.`
        );
        formData.append("file", drawingReviewFile!.file);
        formData.append("profile", JSON.stringify({ userName: user.name, focus: interest }));
        formData.append("messages", JSON.stringify([]));

        const res = await fetch("/api/chat", { method: "POST", body: formData });
        const raw = await res.text();
        const data = safeParseJson<any>(raw, null);

        if (!res.ok) throw new Error(data?.error || raw || `Errore HTTP ${res.status}`);
        const answer = data?.answer || data?.message || raw || "Nessuna risposta ricevuta dall'analisi immagine.";

        setDrawingIssues(buildIssuesFromAiAnswer(String(answer)));
        setDrawingResults([
          {
            category: "Analisi AI immagine",
            status: "⚠️ Da verificare",
            item: drawingReviewFile!.fileAttachment.name,
            reason: String(answer),
            suggestion: "Usa questa analisi come revisione preliminare: controlla manualmente la tavola originale.",
          },
        ]);
      } catch (error: any) {
        setDrawingIssues([{ id: "ai-error", label: "Errore analisi", severity: "errore", x: 50, y: 50, detail: error?.message || "Errore durante l'analisi immagine." }]);
        setDrawingResults([
          {
            category: "Errore analisi immagine",
            status: "❌ Errore",
            item: drawingReviewFile?.fileAttachment.name || "immagine",
            reason: error?.message || "Non sono riuscito ad analizzare l'immagine.",
            suggestion: "Controlla OPENROUTER_API_KEY, OPENROUTER_VISION_MODEL e redeploy Vercel.",
          },
        ]);
      } finally {
        setDrawingAiLoading(false);
      }
      return;
    }

    const issues: DrawingIssue[] = [];
    const results: DrawingResult[] = [];
    const text = `${f.partType} ${f.mainFeatures} ${f.holesThreads} ${f.fits}`.toLowerCase();

    if (drawingReviewFile) {
      results.push({
        category: "File immagine tavola caricato",
        status: "⚠️ Da verificare",
        item: drawingReviewFile.fileAttachment.name,
        reason: "Il file immagine è stato caricato correttamente.",
        suggestion: "Premi Analizza immagine tavola per inviarlo al backend AI."
      });
    }

    if (!f.functionalSurfaces.trim()) {
      issues.push({ id: "funzionali", label: "Superfici funzionali", severity: "errore", x: 24, y: 28, detail: "Mancano superfici funzionali: indica sedi, appoggi, scorrimenti, battute o riferimenti." });
    }
    if (!f.tolerances.trim() && !f.fits.trim()) {
      issues.push({ id: "tolleranze", label: "Tolleranze", severity: "errore", x: 66, y: 35, detail: "Mancano tolleranze o accoppiamenti sulle quote importanti." });
    }
    if (!f.roughness.trim()) {
      issues.push({ id: "rugosita", label: "Rugosità", severity: "attenzione", x: 44, y: 62, detail: "Manca rugosità generale o specifica sulle superfici funzionali." });
    }
    if (!f.material.trim() || !f.manufacturing.trim()) {
      issues.push({ id: "cartiglio", label: "Cartiglio", severity: "attenzione", x: 78, y: 78, detail: "Controlla materiale, lavorazione, trattamento, scala, unità e note generali nel cartiglio." });
    }
    if (text.includes("foro") || text.includes("filett") || text.includes("lamatura")) {
      issues.push({ id: "fori", label: "Fori/filetti", severity: "info", x: 58, y: 22, detail: "Verifica diametri, profondità, posizioni, lamature/svasature e tolleranze dei fori." });
    }

    if (issues.length === 0) {
      issues.push({ id: "ok", label: "Controllo base OK", severity: "info", x: 50, y: 50, detail: "Non emergono mancanze principali dai dati inseriti." });
    }

    results.push(
      { category: "Viste", status: "✅ Necessaria", item: "Vista principale", reason: "Serve per mostrare la forma più riconoscibile e le quote principali.", suggestion: "Scegli la vista più rappresentativa del pezzo." },
      { category: "Sezioni", status: "🟦 Consigliata", item: "Sezione A-A", reason: "Utile se ci sono fori, cave, lamature o geometrie interne.", suggestion: "Aggiungi sezioni solo dove chiariscono dettagli nascosti." },
      { category: "Quote", status: "⚠️ Da verificare", item: "Quote funzionali", reason: "Le quote devono descrivere funzione e producibilità, non solo ingombri.", suggestion: "Evita catene chiuse e quota da riferimenti funzionali." },
      { category: "Cartiglio", status: f.material.trim() ? "⚠️ Da verificare" : "❌ Mancante", item: "Materiale/note", reason: f.material.trim() ? `Materiale indicato: ${f.material}.` : "Materiale non indicato.", suggestion: "Riporta materiale, trattamento, scala, unità, tolleranze generali e note." }
    );

    setDrawingIssues(issues);
    setDrawingResults(results);
  };

  const runQuickCalc = () => {
    const material = MATERIALS_DB[0];
    setQuickCalcResult({
      title: "Verifica rapida dimostrativa",
      outcome: "OK",
      values: [
        `Materiale esempio: ${material?.name || "C45"}`,
        "Modulo pronto per formule più dettagliate.",
        "Per ora la verifica serve come area tecnica preliminare.",
      ],
    });
  };

  const renderFormattedText = (text: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g);
    return blocks.map((block, index) => {
      if (!block) return null;
      if (block.startsWith("```") && block.endsWith("```")) {
        return (
          <pre key={index} style={s.codeBlock}>
            <code>{block.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "")}</code>
          </pre>
        );
      }

      return block.split("\n").map((line, lineIndex) => {
        const trimmed = line.trim();
        const key = `${index}-${lineIndex}`;
        if (!trimmed) return <div key={key} style={{ height: 8 }} />;
        if (trimmed.startsWith("### ")) return <h3 key={key} style={{ color: theme.primary }}>{trimmed.slice(4)}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={key} style={{ color: theme.primary }}>{trimmed.slice(3)}</h2>;
        if (/^\d+\.\s/.test(trimmed)) return <div key={key} style={s.numberedLine}>{trimmed}</div>;
        if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) return <div key={key} style={s.bulletLine}>• {trimmed.slice(2)}</div>;
        return <div key={key} style={s.messageLine}>{line}</div>;
      });
    });
  };

  const iconBtn = (icon: string, label: string, onClick: () => void) => (
    <button
      style={{
        ...s.iconBtn,
        color: theme.text,
        justifyContent: sidebarOpen ? "flex-start" : "center",
        width: sidebarOpen ? "100%" : 44,
      }}
      onClick={onClick}
      title={label}
      type="button"
    >
      <span style={s.icon}>{icon}</span>
      {sidebarOpen && <span>{label}</span>}
    </button>
  );

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.inputComposer, background: theme.surface, border: `1px solid ${theme.border}` }}>
      <input ref={fileInputRef} type="file" accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml,.pdf,.docx,.xlsx,image/*" style={{ display: "none" }} onChange={handleFileUpload} />
      {pendingFile && (
        <div style={{ ...s.pendingFileChip, border: `1px solid ${theme.border}` }}>
          <div style={{ ...s.fileIcon, background: theme.primary }}>📄</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <strong>{pendingFile.fileAttachment.name}</strong>
            <div style={s.muted}>{(pendingFile.fileAttachment.size / 1024).toFixed(1)} KB · pronto da inviare al backend</div>
          </div>
          <button style={s.roundBtn} onClick={removePendingFile} type="button">×</button>
        </div>
      )}
      <div style={s.searchBarInner}>
        <button style={{ ...s.fileBtn, color: theme.primary }} onClick={() => fileInputRef.current?.click()} type="button">📎</button>
        <textarea
          style={{ ...s.textarea, color: theme.text }}
          rows={1}
          value={query}
          placeholder={placeholder}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              callAI();
            }
          }}
        />
        <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || (!query.trim() && !pendingFile)} type="button">➤</button>
      </div>
    </div>
  );

  const renderLoginCard = () => (
    <div style={{ ...s.loginCard, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}>
      <h1>TECH<span style={{ color: theme.primary }}>AI</span></h1>
      <p style={s.muted}>Login grafico locale. Per login reale serve backend/database.</p>
      <label style={s.label}>Email</label>
      <input style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} />
      <label style={s.label}>Password</label>
      <input style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" />
      {loginError && <div style={s.errorBox}>{loginError}</div>}
      <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={handleLogin} type="button">Accedi</button>
      <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => { setUser({ name: "Ospite", email: "ospite@techai.local" }); setIsLoggedIn(true); setShowLoginPanel(false); }} type="button">Continua come ospite</button>
    </div>
  );

  return (
    <div style={{ ...s.app, background: theme.bg, color: theme.text }}>
      {!isLoggedIn && !showLoginPanel && <div style={s.loginScreen}>{renderLoginCard()}</div>}

      <aside style={{ ...s.sidebar, width: sidebarOpen ? 280 : 74, minWidth: sidebarOpen ? 280 : 74, background: isDark ? "#050505" : theme.bg, borderRight: `1px solid ${theme.border}` }}>
        <div style={s.sidebarTop}>
          {sidebarOpen && <div style={s.logoWrap}><div style={{ ...s.logoMark, background: theme.primary }}>T</div><div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div></div>}
          <button style={{ ...s.collapseBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setSidebarOpen(prev => !prev)} type="button">☰</button>
        </div>

        <div style={s.iconNav}>
          {iconBtn("＋", "Nuova", createNewChat)}
          <div style={{ ...s.toolsGroup, background: theme.surface, border: `1px solid ${theme.border}` }}>
            {sidebarOpen && <div style={{ ...s.toolsTitle, color: theme.primary }}>Strumenti tecnici</div>}
            {iconBtn("✓", "Checklist", () => setShowChecklist(true))}
            {iconBtn("∑", "Verifica", () => setShowQuickCalc(true))}
            {iconBtn("▦", "Materiali", () => setShowMaterials(true))}
            {iconBtn("▣", "Tavole", () => setShowDrawingGenerator(true))}
          </div>
        </div>

        {sidebarOpen && (
          <div style={s.chatHistory}>
            <div style={s.historyHeaderRow}>
              <span style={s.historyHeader}>Cronologia</span>
              {chats.length > 0 && <button style={{ ...s.clearChatsBtn, color: theme.primary, border: `1px solid ${theme.border}` }} onClick={clearAllChats} type="button">Svuota</button>}
            </div>
            {chats.length === 0 && <div style={s.emptyText}>Nessuna chat salvata</div>}
            {chats.map(chat => (
              <div key={chat.id} style={{ ...s.historyItem, background: chat.id === activeChatId ? theme.surface : "transparent", border: `1px solid ${chat.id === activeChatId ? theme.border : "transparent"}` }}>
                <div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>{chat.title}</div>
                <button style={{ ...s.deleteBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => deleteChat(chat.id)} type="button">×</button>
              </div>
            ))}
          </div>
        )}

        <div style={s.sidebarBottomActions}>
          {iconBtn("⚙", "Impostazioni", () => { setActiveTab("Aspetto"); setShowSettings(true); })}
        </div>
      </aside>

      <main style={s.main}>
        {!sidebarOpen && <div style={s.collapsedBrand}>TECH<span style={{ color: theme.primary }}>AI</span></div>}
        <button style={{ ...s.floatingAccountBtn, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => { setActiveTab("Account"); setShowSettings(true); }} type="button">👤</button>

        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?</h1>
              {renderInputBar("Chiedi a TechAI o carica un file...")}
              <p style={s.fileHint}>Il file viene mandato al backend. La chiave AI non è nel frontend.</p>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((message, index) => (
                  <div key={index} style={message.role === "utente" ? s.uRow : s.aRow}>
                    {message.role === "AI" && <div style={{ ...s.aiAvatar, background: theme.primary }}>T</div>}
                    <div style={message.role === "utente" ? { ...s.uBox, background: theme.surface, border: `1px solid ${theme.border}` } : { ...s.aBox, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }}>
                      {message.role === "AI" && <div style={s.aiHeader}><strong>TechAI</strong><span style={s.muted}>Risposta tecnica dal backend</span></div>}
                      {renderFormattedText(message.text)}
                      {message.fileAttachment && <div style={s.attachmentBox}>📄 {message.fileAttachment.name} · {(message.fileAttachment.size / 1024).toFixed(1)} KB</div>}
                    </div>
                  </div>
                ))}
                {loading && <div style={{ textAlign: "center", color: theme.primary }}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file...")}</div>
            </div>
          )}
        </section>
      </main>

      {showLoginPanel && <div style={s.overlay}><div style={s.loginModalWrap}>{renderLoginCard()}<button style={s.closeFloatingBtn} onClick={() => setShowLoginPanel(false)} type="button">×</button></div></div>}

      {showChecklist && (
        <Modal title="Checklist tecnica progetto" subtitle="Controllo preliminare automatico per componenti meccanici." theme={theme} isDark={isDark} onClose={() => setShowChecklist(false)}>
          <div style={s.simplePanel}>Modulo checklist pronto. In questa versione stabile la priorità è sistemare backend, upload file e analisi tavole.</div>
        </Modal>
      )}

      {showQuickCalc && (
        <Modal title="Verifica dimensionale rapida" subtitle="Modulo preliminare per componenti semplici." theme={theme} isDark={isDark} onClose={() => setShowQuickCalc(false)}>
          <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runQuickCalc} type="button">Calcola verifica demo</button>
          {quickCalcResult && <div style={s.resultCard}><strong>{quickCalcResult.title}</strong>{quickCalcResult.values.map(v => <p key={v}>{v}</p>)}</div>}
        </Modal>
      )}

      {showMaterials && (
        <Modal title="Libreria materiali" subtitle="Conversioni normative e proprietà meccaniche indicative." theme={theme} isDark={isDark} onClose={() => setShowMaterials(false)} wide>
          <input style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} placeholder="Cerca materiale, EN, DIN, AISI, JIS..." />
          <div style={s.materialGrid}>
            {filteredMaterials.map((m: MaterialInfo) => (
              <div key={m.key} style={{ ...s.materialCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3>{m.name}</h3>
                <p><strong>EN:</strong> {m.en} · <strong>UNI:</strong> {m.uni}</p>
                <p><strong>Rm:</strong> {m.rm} MPa · <strong>Re:</strong> {m.re} MPa</p>
                <p>{m.uses}</p>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {showDrawingGenerator && (
        <Modal
          title="Generatore tavole tecniche controllate"
          subtitle="Carica un'immagine della tavola per analisi AI o compila i dati per controllo base."
          theme={theme}
          isDark={isDark}
          onClose={() => setShowDrawingGenerator(false)}
          wide
        >
          <div style={s.drawingLayout}>
            <div style={s.checklistFormArea}>
              <input
                ref={drawingReviewInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp,image/*"
                style={{ display: "none" }}
                onChange={handleDrawingReviewUpload}
              />


              <div style={{ ...s.drawingUploadPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <strong>Revisione tavola / idea di tavola</strong>
                <p style={s.muted}>Carica solo un'immagine della tavola: PNG, JPG, JPEG o WebP. PDF, DWG, DXF e STEP sono stati rimossi da questa funzione.</p>

                <div style={s.drawingUploadGridSingle}>
                  <button
                    style={{ ...s.drawingUploadBtn, color: theme.text, border: `1px solid ${theme.border}` }}
                    onClick={() => drawingReviewInputRef.current?.click()}
                    type="button"
                  >
                    🖼️ Carica immagine tavola
                    <small>PNG, JPG, JPEG, WebP</small>
                  </button>
                </div>

                {drawingReviewFile && (
                  <FileCard upload={drawingReviewFile} icon="📄" theme={theme} isDark={isDark} onRemove={removeDrawingReviewFile} />
                )}
              </div>

              <div style={s.checklistGrid}>
                <Field label="Nome pezzo" value={drawingForm.partName} onChange={v => updateDrawingField("partName", v)} placeholder="Es. Albero intermedio" theme={theme} isDark={isDark} />
                <Field label="Tipo pezzo" value={drawingForm.partType} onChange={v => updateDrawingField("partType", v)} placeholder="Albero, perno, staffa..." theme={theme} isDark={isDark} />
                <Field label="Materiale" value={drawingForm.material} onChange={v => updateDrawingField("material", v)} placeholder="C45, S235..." theme={theme} isDark={isDark} />
                <Field label="Quantità / lotto" value={drawingForm.productionQuantity} onChange={v => updateDrawingField("productionQuantity", v)} placeholder="1 pezzo, 100 pezzi..." theme={theme} isDark={isDark} />
              </div>

              <Field label="Lavorazione prevista" value={drawingForm.manufacturing} onChange={v => updateDrawingField("manufacturing", v)} placeholder="Tornitura, fresatura..." theme={theme} isDark={isDark} />
              <Field label="Geometrie principali" value={drawingForm.mainFeatures} onChange={v => updateDrawingField("mainFeatures", v)} placeholder="Fori, cave, asole..." theme={theme} isDark={isDark} />
              <Field label="Funzione del pezzo nell'assieme" value={drawingForm.assemblyFunction} onChange={v => updateDrawingField("assemblyFunction", v)} placeholder="Cosa fa il pezzo?" theme={theme} isDark={isDark} />
              <Field label="Superfici funzionali" value={drawingForm.functionalSurfaces} onChange={v => updateDrawingField("functionalSurfaces", v)} placeholder="Sedi, appoggi, scorrimenti..." theme={theme} isDark={isDark} />
              <Field label="Fori / filetti / lamature" value={drawingForm.holesThreads} onChange={v => updateDrawingField("holesThreads", v)} placeholder="M8, Ø10 H7, lamature..." theme={theme} isDark={isDark} />
              <Field label="Accoppiamenti" value={drawingForm.fits} onChange={v => updateDrawingField("fits", v)} placeholder="H7/g6, sede cuscinetto..." theme={theme} isDark={isDark} />
              <Field label="Tolleranze già previste" value={drawingForm.tolerances} onChange={v => updateDrawingField("tolerances", v)} placeholder="ISO 2768, geometriche..." theme={theme} isDark={isDark} />
              <Field label="Rugosità già previste" value={drawingForm.roughness} onChange={v => updateDrawingField("roughness", v)} placeholder="Ra 3.2, Ra 1.6..." theme={theme} isDark={isDark} />

              <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runDrawingGenerator} disabled={drawingAiLoading} type="button">
                {drawingAiLoading ? "Analisi immagine in corso..." : "Analizza immagine tavola"}
              </button>
            </div>

            <div style={s.checklistResultsArea}>
              <DrawingPreview
                issues={drawingIssues}
                previewUrl={drawingReviewFile?.previewUrl}
                fileName={drawingReviewFile?.fileAttachment.name}
                theme={theme}
                isDark={isDark}
              />

              {drawingResults.length === 0 ? (
                <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>
                  Carica una tavola e premi il pulsante di analisi, oppure compila i dati per il controllo base.
                </div>
              ) : (
                drawingResults.map((item, index) => (
                  <div key={index} style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                    <div style={s.resultTop}>
                      <strong>{item.category}: {item.item}</strong>
                      <span>{item.status}</span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{renderFormattedText(item.reason)}</div>
                    <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {showSettings && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}>
            <div style={{ ...s.modalSide, background: isDark ? "#050505" : "#f8fafc", borderRight: `1px solid ${theme.border}` }}>
              {["Account", "Aspetto", "AI Focus"].map(tab => (
                <button key={tab} style={{ ...s.tabBtn, color: activeTab === tab ? theme.primary : theme.text }} onClick={() => setActiveTab(tab)} type="button">
                  {tab}
                </button>
              ))}
            </div>

            <div style={s.modalMain}>
              <div style={s.modalHeader}>
                <h2>{activeTab}</h2>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowSettings(false)} type="button">×</button>
              </div>

              {activeTab === "Account" && (
                <>
                  <Field label="Nome" value={user.name} onChange={v => setUser(prev => ({ ...prev, name: v }))} theme={theme} isDark={isDark} />
                  <Field label="Email" value={user.email} onChange={v => setUser(prev => ({ ...prev, email: v }))} theme={theme} isDark={isDark} />
                  <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowLoginPanel(true)} type="button">Apri login</button>
                </>
              )}

              {activeTab === "Aspetto" && (
                <div style={s.themeGrid}>
                  {THEMES.map(t => (
                    <button key={t.name} style={{ ...s.themeOption, color: theme.text, border: `1px solid ${theme.name === t.name ? t.primary : theme.border}` }} onClick={() => setTheme(t)} type="button">
                      <span style={{ ...s.themeDot, background: t.name === "Dark Black" ? "#050505" : t.primary, border: t.name === "Dark Black" ? "1px solid #fff" : "none" }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "AI Focus" && <Field label="Ambito tecnico principale" value={interest} onChange={setInterest} theme={theme} isDark={isDark} />}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif !important; box-sizing: border-box; }
        html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        button { font-family: inherit; }
        input::placeholder, textarea::placeholder { opacity: 0.55; }
        button:disabled { opacity: 0.5; cursor: not-allowed; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
      `}</style>
    </div>
  );
}

function Modal({ title, subtitle, children, theme, isDark, onClose, wide = false }: { title: string; subtitle?: string; children: React.ReactNode; theme: Theme; isDark: boolean; onClose: () => void; wide?: boolean }) {
  return (
    <div style={s.overlay}>
      <div style={{ ...s.checklistModal, width: wide ? "min(1120px, calc(100vw - 32px))" : "min(760px, calc(100vw - 32px))", background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}>
        <div style={s.modalHeader}>
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {subtitle && <p style={s.muted}>{subtitle}</p>}
          </div>
          <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={onClose} type="button">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder = "", theme, isDark }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; theme: Theme; isDark: boolean }) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function FileCard({ upload, icon, theme, isDark, onRemove }: { upload: DrawingUpload; icon: string; theme: Theme; isDark: boolean; onRemove: () => void }) {
  return (
    <div style={{ ...s.drawingFileCard, background: isDark ? "#111" : "#fff", border: `1px solid ${theme.border}` }}>
      <div style={{ ...s.fileIcon, background: theme.primary }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>{upload.fileAttachment.name}</strong>
        <div style={s.muted}>{(upload.fileAttachment.size / 1024).toFixed(1)} KB</div>
        {upload.previewUrl && <img src={upload.previewUrl} alt="Anteprima tavola" style={s.drawingPreviewImage} />}
      </div>
      <button style={s.roundBtn} onClick={onRemove} type="button">×</button>
    </div>
  );
}

function DrawingPreview({
  issues,
  previewUrl,
  fileName,
  theme,
  isDark,
}: {
  issues: DrawingIssue[];
  previewUrl?: string;
  fileName?: string;
  theme: Theme;
  isDark: boolean;
}) {
  const badgeColor =
    issues.length === 0
      ? "#64748b"
      : issues.some(i => i.severity === "errore")
      ? "#dc2626"
      : issues.some(i => i.severity === "attenzione")
      ? "#f59e0b"
      : "#16a34a";

  return (
    <div style={{ ...s.drawingPreviewPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
      <div style={s.drawingPreviewTop}>
        <div>
          <strong>Anteprima controllo tavola</strong>
          <p style={s.muted}>{previewUrl ? `Anteprima reale: ${fileName || "tavola caricata"}` : "Carica un'immagine PNG/JPG/WebP per vedere la tavola a destra."}</p>
        </div>
        <span style={{ ...s.previewBadge, background: badgeColor }}>{issues.length}</span>
      </div>

      <div style={{ ...s.realDrawingPreviewBox, background: isDark ? "#0b0b0b" : "#ffffff", border: `1px solid ${theme.border}` }}>
        {previewUrl ? (
          <img src={previewUrl} alt={fileName || "Anteprima tavola"} style={s.realDrawingPreviewImage} />
        ) : (
          <div style={s.noIssuesOverlay}>Nessuna anteprima immagine disponibile</div>
        )}

        {issues.map(issue => (
          <div
            key={issue.id}
            title={issue.detail}
            style={{
              ...s.issueMarker,
              left: `${issue.x}%`,
              top: `${issue.y}%`,
              background: issue.severity === "errore" ? "#dc2626" : issue.severity === "attenzione" ? "#f59e0b" : "#16a34a",
            }}
          >
            !
          </div>
        ))}
      </div>

      <div style={s.issueList}>
        {issues.length === 0 ? (
          <div style={s.emptyText}>Esegui il controllo per vedere gli errori evidenziati.</div>
        ) : (
          issues.map(issue => (
            <div key={issue.id} style={s.issueRow}>
              <span style={{ ...s.issueDot, background: issue.severity === "errore" ? "#dc2626" : issue.severity === "attenzione" ? "#f59e0b" : "#16a34a" }} />
              <div>
                <strong>{issue.label}</strong>
                <p>{issue.detail}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden" },
  loginScreen: { position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.45)" },
  loginCard: { borderRadius: 28, padding: 34, width: "min(520px, calc(100vw - 32px))", boxShadow: "0 30px 90px rgba(0,0,0,0.25)" },
  loginModalWrap: { position: "relative" },
  closeFloatingBtn: { position: "absolute", top: -12, right: -12, width: 38, height: 38, borderRadius: "50%", border: "none", cursor: "pointer", fontSize: 22, fontWeight: 900 },
  sidebar: { height: "100dvh", padding: 10, display: "flex", flexDirection: "column", gap: 12, overflow: "hidden", flexShrink: 0 },
  sidebarTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 50 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { width: 34, height: 34, borderRadius: 12, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  logoText: { fontSize: 21, fontWeight: 900, letterSpacing: -1, whiteSpace: "nowrap" },
  collapseBtn: { width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 22, background: "transparent" },
  iconNav: { display: "flex", flexDirection: "column", gap: 10 },
  iconBtn: { minHeight: 44, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 800, background: "transparent", border: "1px solid transparent" },
  icon: { width: 22, textAlign: "center" },
  toolsGroup: { display: "flex", flexDirection: "column", gap: 6, borderRadius: 18, padding: 8, margin: "8px 0" },
  toolsTitle: { fontSize: 11, textTransform: "uppercase", fontWeight: 950, padding: "5px 8px 7px", borderBottom: "1px solid rgba(120,120,120,0.18)" },
  chatHistory: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 },
  historyHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 4px" },
  historyHeader: { fontSize: 11, textTransform: "uppercase", fontWeight: 800, opacity: 0.5 },
  clearChatsBtn: { borderRadius: 999, background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 850, padding: "5px 8px" },
  historyItem: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "8px 8px 8px 10px", fontSize: 13, gap: 8 },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1, cursor: "pointer" },
  deleteBtn: { width: 24, height: 24, borderRadius: "50%", background: "rgba(120,120,120,0.10)", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", justifyContent: "center" },
  sidebarBottomActions: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8 },
  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  collapsedBrand: { position: "absolute", top: 22, left: 28, zIndex: 20, fontSize: 24, fontWeight: 950, letterSpacing: 2, pointerEvents: "none" },
  floatingAccountBtn: { position: "absolute", top: 18, right: 28, zIndex: 30, width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 18, display: "flex", alignItems: "center", justifyContent: "center" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: 720, textAlign: "center", padding: "0 22px" },
  welcomeText: { fontSize: "clamp(25px, 4vw, 38px)", fontWeight: 700, marginBottom: 30, letterSpacing: -1 },
  inputComposer: { display: "flex", flexDirection: "column", gap: 8, borderRadius: 28, padding: "8px 12px", width: "100%", minHeight: 56, boxShadow: "0 8px 24px rgba(0,0,0,0.05)" },
  searchBarInner: { display: "flex", alignItems: "center", width: "100%" },
  fileBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 18 },
  textarea: { flex: 1, minWidth: 0, maxHeight: 140, background: "none", border: "none", outline: "none", textAlign: "center", fontSize: 16, resize: "none", padding: "10px 0" },
  sendBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 20 },
  fileHint: { fontSize: 12, opacity: 0.58, marginTop: 12 },
  pendingFileChip: { display: "flex", alignItems: "center", gap: 10, borderRadius: 18, padding: "10px 12px", width: "100%" },
  fileIcon: { width: 36, height: 44, borderRadius: 10, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, flexShrink: 0 },
  roundBtn: { width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(120,120,120,0.16)", cursor: "pointer", fontSize: 18, lineHeight: 1 },
  muted: { fontSize: 12, opacity: 0.65, margin: "4px 0 0", lineHeight: 1.45 },
  chatView: { width: "100%", maxWidth: 940, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 22px", overflow: "hidden" },
  msgList: { flex: 1, minHeight: 0, overflowY: "auto", display: "flex", flexDirection: "column", gap: 18, padding: "10px 0" },
  uRow: { display: "flex", justifyContent: "flex-end", width: "100%" },
  aRow: { display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 12, width: "100%" },
  uBox: { padding: "13px 18px", borderRadius: "22px 22px 6px 22px", maxWidth: "78%", fontSize: 15, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 },
  aBox: { padding: "18px 20px", borderRadius: "8px 22px 22px 22px", lineHeight: 1.72, fontSize: 16, whiteSpace: "pre-wrap", maxWidth: "86%", overflowWrap: "anywhere" },
  aiAvatar: { width: 34, height: 34, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, flexShrink: 0, marginTop: 10 },
  aiHeader: { display: "flex", flexDirection: "column", gap: 2, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid rgba(120,120,120,0.18)" },
  bottomInput: { padding: "10px 0 8px", flexShrink: 0 },
  messageLine: { lineHeight: 1.7, margin: "2px 0" },
  numberedLine: { margin: "8px 0", lineHeight: 1.65, fontWeight: 650 },
  bulletLine: { margin: "6px 0", lineHeight: 1.65 },
  codeBlock: { borderRadius: 16, padding: "16px 18px", margin: "14px 0", overflowX: "auto", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", background: "#0f172a", color: "#e5e7eb" },
  attachmentBox: { marginTop: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(120,120,120,0.10)", fontSize: 13 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 },
  checklistModal: { borderRadius: 24, height: "min(760px, calc(100dvh - 32px))", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.28)", padding: 28 },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, minWidth: 38, padding: 0, background: "transparent", borderRadius: "50%", cursor: "pointer", fontWeight: 900, fontSize: 24, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { borderRadius: 24, width: "min(620px, 100%)", height: "min(450px, calc(100dvh - 32px))", display: "flex", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" },
  modalSide: { width: 170, padding: 24, display: "flex", flexDirection: "column", gap: 15, flexShrink: 0 },
  modalMain: { flex: 1, minWidth: 0, padding: 32, display: "flex", flexDirection: "column", overflowY: "auto" },
  tabBtn: { textAlign: "left", border: "none", background: "transparent", cursor: "pointer", fontSize: 14, fontWeight: 850, padding: "8px 0" },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 12, marginBottom: 14, outline: "none", fontSize: 14 },
  primaryBtn: { width: "100%", padding: 15, border: "none", borderRadius: 14, color: "white", fontWeight: 850, cursor: "pointer", fontSize: 15, marginTop: 8 },
  secondaryBtn: { width: "100%", padding: 13, borderRadius: 14, background: "transparent", fontWeight: 850, cursor: "pointer", marginTop: 10 },
  errorBox: { marginTop: 12, padding: "10px 12px", borderRadius: 12, color: "#b91c1c", background: "#fee2e2", fontSize: 13, fontWeight: 700 },
  simplePanel: { borderRadius: 18, padding: 18, background: "rgba(120,120,120,0.1)", lineHeight: 1.6 },
  resultCard: { borderRadius: 18, padding: 16, marginTop: 12 },
  resultTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, fontSize: 14 },
  resultSuggestion: { marginTop: 12, paddingLeft: 10, lineHeight: 1.5, fontSize: 13, fontWeight: 650 },
  materialGrid: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, paddingRight: 4 },
  materialCard: { borderRadius: 18, padding: 18, lineHeight: 1.45, fontSize: 13 },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  themeOption: { padding: 12, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 800, background: "transparent" },
  themeDot: { width: 12, height: 12, borderRadius: "50%" },
  drawingLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(380px, 0.95fr) minmax(430px, 1.05fr)", gap: 22, overflow: "hidden" },
  checklistFormArea: { overflowY: "auto", paddingRight: 6 },
  checklistResultsArea: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 },
  checklistGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  drawingUploadPanel: { borderRadius: 18, padding: 16, marginBottom: 18 },
  drawingUploadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 },
  drawingUploadGridSingle: { display: "grid", gridTemplateColumns: "1fr", gap: 10, marginTop: 12 },
  drawingUploadBtn: { minHeight: 72, borderRadius: 16, background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 850, fontSize: 14 },
  drawingFileCard: { display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 16, padding: 12, marginTop: 12 },
  drawingPreviewImage: { width: "100%", maxHeight: 180, objectFit: "contain", borderRadius: 12, marginTop: 10, background: "rgba(120,120,120,0.08)" },
  drawingPreviewPanel: { borderRadius: 18, padding: 16, marginBottom: 12 },
  drawingPreviewTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  previewBadge: { minWidth: 28, height: 28, borderRadius: 999, color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 },
  realDrawingPreviewBox: { position: "relative", width: "100%", minHeight: 360, maxHeight: 520, borderRadius: 14, overflow: "hidden", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "center" },
  realDrawingPreviewImage: { width: "100%", height: "100%", maxHeight: 520, objectFit: "contain", display: "block" },
  noIssuesOverlay: { position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, opacity: 0.55, pointerEvents: "none", textAlign: "center", padding: 20 },
  issueMarker: { position: "absolute", transform: "translate(-50%, -50%)", width: 26, height: 26, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, fontSize: 15, boxShadow: "0 8px 22px rgba(0,0,0,0.28)", border: "2px solid rgba(255,255,255,0.85)" },
  issueList: { display: "flex", flexDirection: "column", gap: 8 },
  issueRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.35 },
  issueDot: { width: 9, height: 9, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  emptyText: { fontSize: 12, opacity: 0.6, padding: 8 },
  emptyChecklist: { borderRadius: 18, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: 0.68, padding: 18, fontSize: 14 },
};

