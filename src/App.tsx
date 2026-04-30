import React, { useEffect, useMemo, useRef, useState } from "react";
import { MATERIALS_DB, MaterialInfo } from "./data/materials";
import * as pdfjsLib from "pdfjs-dist";
import { supabase, isSupabaseConfigured } from "./lib/supabaseClient";

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).href;

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

type ChecklistStatus = "✅ Conforme" | "⚠️ Da verificare" | "❌ Errore critico";

type ChecklistForm = {
  componentType: string;
  material: string;
  load: string;
  environment: string;
  machining: string;
  safetyFactor: string;
  tolerances: string;
  roughness: string;
  notes: string;
};

type ChecklistResult = {
  area: string;
  status: ChecklistStatus;
  detail: string;
  suggestion: string;
};

type QuickCalcForm = {
  componentType: string;
  stressType: string;
  material: string;
  load: string;
  distance: string;
  diameter: string;
  safetyFactorRequired: string;
};

type QuickCalcResult = {
  title: string;
  scheme: string;
  formulas: string[];
  values: string[];
  sigma: number;
  deflection: number;
  safetyFactor: number;
  outcome: "OK" | "NON OK";
  notes: string[];
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

const THEMES: Theme[] = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

const STORAGE_KEY = "techai_stable_app_v5_materials";
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

function safeParseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function isImageFile(file: File | null | undefined) {
  if (!file) return false;
  return file.type.startsWith("image/");
}

function isImageUpload(upload: DrawingUpload | null) {
  return Boolean(upload?.file && upload.file.type.startsWith("image/"));
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item: any) => ("str" in item ? item.str : ""))
      .join(" ");
    pages.push(pageText);
  }
  return pages.join("\n\n");
}

function buildIssuesFromAiAnswer(answer: string): DrawingIssue[] {
  const lower = answer.toLowerCase();
  const issues: DrawingIssue[] = [];

  if (lower.includes("quota") || lower.includes("quote")) {
    issues.push({
      id: "ai-quote",
      label: "Quote",
      severity: "attenzione",
      x: 34,
      y: 36,
      detail: "L'analisi AI segnala controlli sulle quote.",
    });
  }

  if (lower.includes("toller")) {
    issues.push({
      id: "ai-tolleranze",
      label: "Tolleranze",
      severity: "attenzione",
      x: 63,
      y: 34,
      detail: "L'analisi AI segnala controlli sulle tolleranze.",
    });
  }

  if (lower.includes("rugos")) {
    issues.push({
      id: "ai-rugosita",
      label: "Rugosità",
      severity: "attenzione",
      x: 44,
      y: 64,
      detail: "L'analisi AI segnala controlli sulla rugosità.",
    });
  }

  if (lower.includes("cartiglio") || lower.includes("materiale") || lower.includes("scala") || lower.includes("unità")) {
    issues.push({
      id: "ai-cartiglio",
      label: "Cartiglio",
      severity: "attenzione",
      x: 78,
      y: 78,
      detail: "L'analisi AI segnala controlli sul cartiglio o sulle note generali.",
    });
  }

  if (lower.includes("sezione") || lower.includes("vista") || lower.includes("dettaglio")) {
    issues.push({
      id: "ai-viste",
      label: "Viste/Sezioni",
      severity: "info",
      x: 58,
      y: 24,
      detail: "L'analisi AI segnala controlli su viste, sezioni o dettagli.",
    });
  }

  if (issues.length === 0) {
    issues.push({
      id: "ai-generale",
      label: "Analisi AI",
      severity: "info",
      x: 50,
      y: 50,
      detail: "Analisi completata. Leggi il risultato testuale sotto.",
    });
  }

  return issues;
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
  const [loginName, setLoginName] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authLoading, setAuthLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  const [theme, setTheme] = useState(THEMES[5]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const [materialSearch, setMaterialSearch] = useState("");
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

  const [drawingReviewFile, setDrawingReviewFile] = useState<DrawingUpload | null>(null);
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
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isDark = theme.name === "Dark Black";
  const activeChat = chats.find(chat => chat.id === activeChatId);
  const currentMessages = activeChat?.messages || [];

  const allMaterials = useMemo(() => [...MATERIALS_DB, ...customMaterials], [customMaterials]);

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();

    if (!q) return allMaterials.slice(0, 140);

    return allMaterials.filter((m: MaterialInfo) =>
      `${m.name} ${m.en} ${m.uni} ${m.din} ${m.aisi} ${m.jis} ${m.iso} ${m.uses} ${m.notes}`.toLowerCase().includes(q)
    ).slice(0, 180);
  }, [materialSearch, allMaterials]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const data = safeParseJson<any>(saved, null);
      if (data) {
        setTheme(THEMES.find(t => t.name === data.themeName) || THEMES[5]);
        setInterest(data.interest || "Ingegneria Meccanica");
        setChats(Array.isArray(data.chats) ? data.chats : []);
        setActiveChatId(data.activeChatId || null);
        setSidebarOpen(data.sidebarOpen ?? true);
        setCustomMaterials(Array.isArray(data.customMaterials) ? data.customMaterials : []);
      }
    }

    if (!isSupabaseConfigured || !supabase) {
      setIsLoggedIn(true);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Utente";
        setUser({ name, email: session.user.email || "" });
        setLoginEmail(session.user.email || "");
        setIsLoggedIn(true);
        setShowLoginPanel(false);
      } else {
        setIsLoggedIn(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) setIsLoggedIn(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const safeChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message => ({
        role: message.role,
        text: message.text,
        fileAttachment: message.fileAttachment,
      })),
    }));

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        user,
        interest,
        chats: safeChats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        customMaterials,
      })
    );
  }, [theme, user, interest, chats, activeChatId, sidebarOpen, isLoggedIn, customMaterials]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

  useEffect(() => {
    return () => {
      if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);
    };
  }, [drawingReviewFile?.previewUrl]);

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

        return {
          ...chat,
          messages,
          title: first.slice(0, 32) + (first.length > 32 ? "..." : ""),
        };
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

  const updateChecklistField = (field: keyof ChecklistForm, value: string) => {
    setChecklistForm(prev => ({ ...prev, [field]: value }));
  };

  const updateQuickCalcField = (field: keyof QuickCalcForm, value: string) => {
    setQuickCalcForm(prev => ({ ...prev, [field]: value }));
  };

  const updateDrawingField = (field: keyof DrawingForm, value: string) => {
    setDrawingForm(prev => ({ ...prev, [field]: value }));
  };

  const normalizeMaterialKey = (value?: string) => {
    return String(value || "").toLowerCase().replaceAll(" ", "").replaceAll("-", "").replaceAll("_", "");
  };

  const findMaterial = (value: string) => {
    const key = normalizeMaterialKey(value);

    return allMaterials.find((m: MaterialInfo) =>
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

    const exists = allMaterials.some(
      m =>
        normalizeMaterialKey(m.key) === generatedKey ||
        normalizeMaterialKey(m.name) === normalizeMaterialKey(materialName)
    );

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
      rm: newMaterial.rm || 0,
      re: newMaterial.re || 0,
      hardness: newMaterial.hardness || "Non specificato",
      treatments: newMaterial.treatments || "Non specificato",
      weldability: newMaterial.weldability || "Non specificato",
      machinability: newMaterial.machinability || "Non specificato",
      uses: newMaterial.uses || "Non specificato",
      notes: newMaterial.notes || "Materiale aggiunto dall'utente. Verificare sempre i dati prima di usarlo in calcoli reali.",
    };

    setCustomMaterials(prev => [...prev, materialToSave]);

    setNewMaterial({
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

    setShowAddMaterial(false);
    setMaterialSearch(materialName);
  };

  const deleteCustomMaterial = (key: string) => {
    setCustomMaterials(prev => prev.filter(material => material.key !== key));
  };

  const getYoungModulus = (material?: MaterialInfo) => {
    if (!material) return 210000;

    const name = material.name.toLowerCase();

    if (name.includes("alluminio")) return 70000;
    if (name.includes("rame") || name.includes("ottone")) return 110000;
    if (name.includes("ptfe") || name.includes("nylon") || name.includes("gomma") || name.includes("pvc")) return 3000;

    return 210000;
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (!supabase) return null;

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      setIsLoggedIn(false);
      setShowLoginPanel(true);
      setLoginError("Sessione scaduta. Effettua di nuovo il login.");
      return null;
    }

    return session.access_token;
  };

  const handleLogin = async () => {
    if (!loginEmail.includes("@")) { setLoginError("Inserisci una email valida."); return; }
    if (!loginPassword.trim()) { setLoginError("Inserisci la password."); return; }
    if (!supabase) { setLoginError("Supabase non configurato."); return; }

    setAuthLoading(true);
    setLoginError("");
    const { error } = await supabase.auth.signInWithPassword({ email: loginEmail.trim(), password: loginPassword });
    setAuthLoading(false);

    if (error) { setLoginError(error.message); return; }
    setLoginPassword("");
  };

  const handleRegister = async () => {
    if (!loginName.trim()) { setLoginError("Inserisci il tuo nome."); return; }
    if (!loginEmail.includes("@")) { setLoginError("Inserisci una email valida."); return; }
    if (loginPassword.length < 6) { setLoginError("La password deve essere di almeno 6 caratteri."); return; }
    if (!supabase) { setLoginError("Supabase non configurato."); return; }

    setAuthLoading(true);
    setLoginError("");
    const { error } = await supabase.auth.signUp({
      email: loginEmail.trim(),
      password: loginPassword,
      options: { data: { name: loginName.trim() } },
    });
    setAuthLoading(false);

    if (error) { setLoginError(error.message); return; }
    setLoginError("Registrazione completata! Controlla la tua email per confermare l'account.");
    setAuthMode("login");
    setLoginPassword("");
  };

  const handleLogout = async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(DEFAULT_USER);
    setIsLoggedIn(false);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setPendingFile({
      file,
      fileAttachment: makeAttachment(file),
    });

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
    const userMessage: Message = pendingFile
      ? { role: "utente", text, fileAttachment: pendingFile.fileAttachment }
      : { role: "utente", text };

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

      if (fileToSend?.file) {
        formData.append("file", fileToSend.file);
        const ext = fileToSend.file.name.split(".").pop()?.toLowerCase();
        if (ext === "pdf") {
          try {
            const pdfText = await extractPdfText(fileToSend.file);
            if (pdfText.trim()) formData.append("fileText", pdfText);
          } catch {
            // fallback: l'API proverà file.text() che restituirà poco
          }
        }
      }

      const token = await getAuthToken();

      if (!token) {
        replaceMessagesInChat(chatId, [
          ...updatedMessages,
          { role: "AI", text: "⚠️ Sessione scaduta. Effettua di nuovo il login e riprova." },
        ]);
        return;
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const raw = await res.text();
      const data = safeParseJson<any>(raw, null);

      if (!res.ok) {
        const errMsg = data?.error || raw || `Errore HTTP ${res.status}`;
        if (res.status === 403 && data?.error === "Limite AI raggiunto") {
          replaceMessagesInChat(chatId, [
            ...updatedMessages,
            { role: "AI", text: `⚠️ **Limite AI raggiunto** (${data.used}/${data.limit} richieste usate).\n\nUpgrada al piano Pro per continuare a usare l'assistente.` },
          ]);
          return;
        }
        if (res.status === 401) {
          replaceMessagesInChat(chatId, [
            ...updatedMessages,
            { role: "AI", text: `⚠️ **Sessione scaduta.** Effettua di nuovo il login per continuare.` },
          ]);
          return;
        }
        throw new Error(errMsg);
      }

      const answer = data?.answer || data?.message || raw;
      if (!answer) throw new Error("Il backend non ha restituito una risposta valida.");

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: answer }]);
    } catch (error: any) {
      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        {
          role: "AI",
          text:
            `⚠️ Backend non collegato correttamente.\n\n` +
            `Controlla che la rotta \`/api/chat\` esista su Vercel e che le variabili ambiente siano configurate.\n\n` +
            `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
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
        ? "Controlla Rm, Re/Rp0.2, durezza, saldabilità e disponibilità commerciale."
        : "Inserisci una sigla materiale, ad esempio C45, S235JR, 42CrMo4, AISI 304.",
    });

    results.push({
      area: "Coerenza carico/materiale",
      status: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0
        ? "❌ Errore critico"
        : material
        ? "⚠️ Da verificare"
        : "❌ Errore critico",
      detail: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0
        ? "Carico non indicato o non numerico."
        : `Carico indicativo inserito: ${f.load} N. La sola checklist non sostituisce la verifica tensionale.`,
      suggestion: "Esegui almeno una verifica rapida a trazione/flessione/taglio/torsione in base al componente.",
    });

    results.push({
      area: "Ambiente d'uso",
      status: "⚠️ Da verificare",
      detail: environment
        ? `Ambiente indicato: ${f.environment}.`
        : "Ambiente non specificato: corrosione, temperatura, umidità e polveri possono cambiare la scelta del materiale.",
      suggestion: environment.includes("corros") || environment.includes("umid") || environment.includes("esterno")
        ? "Valuta inox, zincatura, verniciatura o altro trattamento superficiale."
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
      area: "Coefficiente di sicurezza",
      status: !f.safetyFactor.trim() || Number.isNaN(safetyValue)
        ? "❌ Errore critico"
        : safetyValue < 1.5
        ? "❌ Errore critico"
        : safetyValue < 2
        ? "⚠️ Da verificare"
        : "✅ Conforme",
      detail: !f.safetyFactor.trim() || Number.isNaN(safetyValue)
        ? "Coefficiente di sicurezza non indicato."
        : `Coefficiente di sicurezza indicato: n = ${f.safetyFactor}.`,
      suggestion: !f.safetyFactor.trim() || Number.isNaN(safetyValue)
        ? "Inserisci n. Per componenti statici spesso si parte da valori indicativi ≥ 2."
        : safetyValue < 1.5
        ? "Valore molto basso: giustificalo con norma, prove o calcolo accurato."
        : "Verifica che il coefficiente sia coerente con incertezza del carico e conseguenze del cedimento.",
    });

    results.push({
      area: "Tolleranze dimensionali",
      status: tolerances ? "✅ Conforme" : "⚠️ Da verificare",
      detail: tolerances
        ? `Tolleranze indicate: ${f.tolerances}.`
        : "Non risultano tolleranze o accoppiamenti indicati.",
      suggestion: tolerances
        ? "Controlla che siano presenti sulle quote funzionali."
        : "Aggiungi tolleranze sulle quote funzionali. Esempi: Ø10 H7, Ø20 h6, posizione fori, planarità appoggi.",
    });

    results.push({
      area: "Rugosità",
      status: roughness ? "✅ Conforme" : "⚠️ Da verificare",
      detail: roughness
        ? `Rugosità indicata: ${f.roughness}.`
        : "Rugosità non indicata.",
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
      formulas = ["Mf = F · L", "Wf = π · d³ / 32", "σf = Mf / Wf", "f = F · L³ / (3 · E · I)", "n = Re / σf"];
      notes = ["Modello conservativo per mensola semplice.", "Per un perno reale controllare anche taglio, pressione specifica e condizioni di vincolo."];
    } else if (quickCalcForm.stressType === "taglio") {
      sigma = (4 * F) / (3 * A);
      title = "Verifica rapida a taglio";
      scheme = "Schema statico semplificato: sezione circolare soggetta a taglio trasversale.";
      formulas = ["A = π · d² / 4", "τmax ≈ 4F / 3A", "n = Re / τmax"];
      notes = ["Per taglio su spine o perni verificare se il taglio è singolo o doppio.", "Per criteri più corretti usare tensione ammissibile a taglio o Von Mises."];
    } else if (quickCalcForm.stressType === "torsione") {
      sigma = M / Wt;
      title = "Verifica rapida a torsione";
      scheme = "Schema statico semplificato: albero circolare pieno soggetto a momento torcente.";
      formulas = ["Mt = F · L", "Wt = π · d³ / 16", "τt = Mt / Wt", "n = Re / τt"];
      notes = ["Il braccio inserito viene usato come leva per generare il momento torcente.", "Per alberi reali verificare anche fatica, cave linguetta e concentrazioni di tensione."];
    } else {
      sigma = F / A;
      deflection = F * L / (E * A);
      title = "Verifica rapida a trazione/compressione";
      scheme = "Schema statico semplificato: barra circolare caricata assialmente.";
      formulas = ["A = π · d² / 4", "σ = F / A", "ΔL = F · L / (E · A)", "n = Re / σ"];
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

    setQuickCalcResult({
      title,
      scheme,
      formulas,
      values,
      sigma,
      deflection,
      safetyFactor: n,
      outcome,
      notes,
    });
  };

  const handleDrawingReviewUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isImageFile(file)) {
      alert("Per la revisione tavola carica solo immagini: PNG, JPG, JPEG o WebP.");
      event.target.value = "";
      return;
    }

    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);

    setDrawingReviewFile({
      file,
      fileAttachment: makeAttachment(file),
      previewUrl: URL.createObjectURL(file),
    });

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

  const runDrawingGenerator = async () => {
    const f = drawingForm;

    if (isImageUpload(drawingReviewFile)) {
      setDrawingAiLoading(true);
      setDrawingResults([]);
      setDrawingIssues([]);

      try {
        const formData = new FormData();
        formData.append(
          "message",
          `Analizza questa tavola tecnica caricata come immagine.

Dati utente:
- Nome pezzo: ${f.partName || "non indicato"}
- Tipo pezzo: ${f.partType || "non indicato"}
- Materiale: ${f.material || "non indicato"}
- Quantità/lotto: ${f.productionQuantity || "non indicato"}
- Lavorazione prevista: ${f.manufacturing || "non indicata"}
- Geometrie principali: ${f.mainFeatures || "non indicate"}
- Funzione nell'assieme: ${f.assemblyFunction || "non indicata"}
- Superfici funzionali: ${f.functionalSurfaces || "non indicate"}
- Fori/filetti/lamature: ${f.holesThreads || "non indicati"}
- Accoppiamenti: ${f.fits || "non indicati"}
- Tolleranze previste: ${f.tolerances || "non indicate"}
- Rugosità previste: ${f.roughness || "non indicate"}

Guarda davvero l'immagine. Non fare una checklist generica. Se qualcosa non è leggibile, dillo chiaramente. Organizza la risposta con Sintesi, Errori/Mancanze, Zone da controllare, Correzioni consigliate e Conclusione.`
        );
        formData.append("file", drawingReviewFile!.file);
        formData.append("profile", JSON.stringify({ userName: user.name, focus: interest }));
        formData.append("messages", JSON.stringify([]));

        const token = await getAuthToken();
        if (!token) return;

        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        const raw = await res.text();
        const data = safeParseJson<any>(raw, null);

        if (res.status === 403 && data?.error === "Limite AI raggiunto") {
          throw new Error(`Limite AI raggiunto (${data.used}/${data.limit} richieste). Upgrada al piano Pro per continuare.`);
        }

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
        setDrawingIssues([
          {
            id: "ai-error",
            label: "Errore analisi",
            severity: "errore",
            x: 50,
            y: 50,
            detail: error?.message || "Errore durante l'analisi immagine.",
          },
        ]);

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

    if (!f.functionalSurfaces.trim()) {
      issues.push({
        id: "funzionali",
        label: "Superfici funzionali",
        severity: "errore",
        x: 24,
        y: 28,
        detail: "Mancano superfici funzionali: indica sedi, appoggi, scorrimenti, battute o riferimenti.",
      });
    }

    if (!f.tolerances.trim() && !f.fits.trim()) {
      issues.push({
        id: "tolleranze",
        label: "Tolleranze",
        severity: "errore",
        x: 66,
        y: 35,
        detail: "Mancano tolleranze o accoppiamenti sulle quote importanti.",
      });
    }

    if (!f.roughness.trim()) {
      issues.push({
        id: "rugosita",
        label: "Rugosità",
        severity: "attenzione",
        x: 44,
        y: 62,
        detail: "Manca rugosità generale o specifica sulle superfici funzionali.",
      });
    }

    if (!f.material.trim() || !f.manufacturing.trim()) {
      issues.push({
        id: "cartiglio",
        label: "Cartiglio",
        severity: "attenzione",
        x: 78,
        y: 78,
        detail: "Controlla materiale, lavorazione, trattamento, scala, unità e note generali nel cartiglio.",
      });
    }

    if (text.includes("foro") || text.includes("filett") || text.includes("lamatura")) {
      issues.push({
        id: "fori",
        label: "Fori/filetti",
        severity: "info",
        x: 58,
        y: 22,
        detail: "Verifica diametri, profondità, posizioni, lamature/svasature e tolleranze dei fori.",
      });
    }

    if (issues.length === 0) {
      issues.push({
        id: "ok",
        label: "Controllo base OK",
        severity: "info",
        x: 50,
        y: 50,
        detail: "Non emergono mancanze principali dai dati inseriti.",
      });
    }

    results.push(
      {
        category: "Viste",
        status: "✅ Necessaria",
        item: "Vista principale",
        reason: "Serve per mostrare la forma più riconoscibile e le quote principali.",
        suggestion: "Scegli la vista più rappresentativa del pezzo.",
      },
      {
        category: "Sezioni",
        status: "🟦 Consigliata",
        item: "Sezione A-A",
        reason: "Utile se ci sono fori, cave, lamature o geometrie interne.",
        suggestion: "Aggiungi sezioni solo dove chiariscono dettagli nascosti.",
      },
      {
        category: "Quote",
        status: "⚠️ Da verificare",
        item: "Quote funzionali",
        reason: "Le quote devono descrivere funzione e producibilità, non solo ingombri.",
        suggestion: "Evita catene chiuse e quota da riferimenti funzionali.",
      },
      {
        category: "Cartiglio",
        status: f.material.trim() ? "⚠️ Da verificare" : "❌ Mancante",
        item: "Materiale/note",
        reason: f.material.trim() ? `Materiale indicato: ${f.material}.` : "Materiale non indicato.",
        suggestion: "Riporta materiale, trattamento, scala, unità, tolleranze generali e note.",
      }
    );

    setDrawingIssues(issues);
    setDrawingResults(results);
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml,.pdf,.docx,.xlsx,image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

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

        <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || (!query.trim() && !pendingFile)} type="button">
          ➤
        </button>
      </div>
    </div>
  );

  const renderLoginCard = () => {
    const isRegister = authMode === "register";
    const inputStyle = { ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` };
    const tabBase: React.CSSProperties = { flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 15, borderRadius: 10, transition: "background 0.2s" };

    return (
      <div className="slide-in" style={{ ...s.loginCard, position: "relative", background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}>
        {showLoginPanel && (
          <button
            type="button"
            onClick={() => setShowLoginPanel(false)}
            style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: theme.text, opacity: 0.5, padding: 4 }}
          >✕</button>
        )}
        <h1>TECH<span style={{ color: theme.primary }}>AI</span></h1>

        <div style={{ display: "flex", gap: 6, marginBottom: 22, background: isDark ? "#1a1a1a" : "#f2f2f2", borderRadius: 12, padding: 4 }}>
          <button
            style={{ ...tabBase, background: !isRegister ? theme.primary : "transparent", color: !isRegister ? "#fff" : theme.text }}
            onClick={() => { setAuthMode("login"); setLoginError(""); }}
            type="button"
          >Accedi</button>
          <button
            style={{ ...tabBase, background: isRegister ? theme.primary : "transparent", color: isRegister ? "#fff" : theme.text }}
            onClick={() => { setAuthMode("register"); setLoginError(""); }}
            type="button"
          >Registrati</button>
        </div>

        {isRegister && (
          <>
            <label style={s.label}>Nome</label>
            <input style={inputStyle} value={loginName} onChange={e => setLoginName(e.target.value)} placeholder="Il tuo nome" />
          </>
        )}

        <label style={s.label}>Email</label>
        <input style={inputStyle} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} type="email" placeholder="email@esempio.com" />

        <label style={s.label}>Password</label>
        <input style={inputStyle} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" placeholder={isRegister ? "Minimo 6 caratteri" : ""} />

        {loginError && (
          <div style={{ ...s.errorBox, color: loginError.startsWith("Registrazione") ? "#22c55e" : undefined }}>
            {loginError}
          </div>
        )}

        <button
          style={{ ...s.primaryBtn, background: theme.primary, opacity: authLoading ? 0.7 : 1 }}
          onClick={isRegister ? handleRegister : handleLogin}
          disabled={authLoading}
          type="button"
        >
          {authLoading ? "Attendere..." : isRegister ? "Crea account" : "Accedi"}
        </button>

      </div>
    );
  };

  return (
    <div style={{ ...s.app, background: theme.bg, color: theme.text }}>
      <style>{`
        @keyframes slideInUp {
          from { opacity: 0; transform: translateY(28px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .slide-in { animation: slideInUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .fade-in  { animation: fadeIn 0.22s ease both; }
        button { transition: transform 0.15s ease, opacity 0.15s ease !important; }
        button:hover:not(:disabled) { transform: scale(1.05); }
        button:active:not(:disabled) { transform: scale(0.97); }
      `}</style>

      {!isLoggedIn && !showLoginPanel && <div style={s.loginScreen}>{renderLoginCard()}</div>}

      <aside
        style={{
          ...s.sidebar,
          width: sidebarOpen ? 280 : 74,
          minWidth: sidebarOpen ? 280 : 74,
          background: isDark ? "#050505" : theme.bg,
          borderRight: `1px solid ${theme.border}`,
        }}
      >
        <div style={s.sidebarTop}>
          {sidebarOpen && (
            <div style={s.logoWrap}>
              <div style={{ ...s.logoMark, background: theme.primary }}>T</div>
              <div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div>
            </div>
          )}

          <button
            style={{ ...s.collapseBtn, color: theme.text, border: `1px solid ${theme.border}` }}
            onClick={() => setSidebarOpen(prev => !prev)}
            type="button"
          >
            ☰
          </button>
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
              {chats.length > 0 && (
                <button
                  style={{ ...s.clearChatsBtn, color: theme.primary, border: `1px solid ${theme.border}` }}
                  onClick={clearAllChats}
                  type="button"
                >
                  Svuota
                </button>
              )}
            </div>

            {chats.length === 0 && <div style={s.emptyText}>Nessuna chat salvata</div>}

            {chats.map(chat => (
              <div
                key={chat.id}
                style={{
                  ...s.historyItem,
                  background: chat.id === activeChatId ? theme.surface : "transparent",
                  border: `1px solid ${chat.id === activeChatId ? theme.border : "transparent"}`,
                }}
              >
                <div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>{chat.title}</div>
                <button
                  style={{ ...s.deleteBtn, color: theme.text, border: `1px solid ${theme.border}` }}
                  onClick={() => deleteChat(chat.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={s.sidebarBottomActions}>
          {iconBtn("⚙", "Impostazioni", () => {
            setActiveTab("Aspetto");
            setShowSettings(true);
          })}
        </div>
      </aside>

      <main style={s.main}>
        {!sidebarOpen && <div style={s.collapsedBrand}>TECH<span style={{ color: theme.primary }}>AI</span></div>}

        <button
          style={{ ...s.floatingAccountBtn, background: theme.surface, color: theme.text, border: `1px solid ${theme.border}` }}
          onClick={() => {
            setActiveTab("Account");
            setShowSettings(true);
          }}
          type="button"
        >
          👤
        </button>

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

                    <div
                      style={
                        message.role === "utente"
                          ? { ...s.uBox, background: theme.surface, border: `1px solid ${theme.border}` }
                          : { ...s.aBox, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }
                      }
                    >
                      {message.role === "AI" && (
                        <div style={s.aiHeader}>
                          <strong>TechAI</strong>
                          <span style={s.muted}>Risposta tecnica dal backend</span>
                        </div>
                      )}

                      {renderFormattedText(message.text)}

                      {message.fileAttachment && (
                        <div style={s.attachmentBox}>
                          📄 {message.fileAttachment.name} · {(message.fileAttachment.size / 1024).toFixed(1)} KB
                        </div>
                      )}
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

      {showLoginPanel && (
        <div className="fade-in" style={s.overlay}>
          <div style={s.loginModalWrap}>
            {renderLoginCard()}
          </div>
        </div>
      )}

      {showChecklist && (
        <Modal
          title="Checklist tecnica progetto"
          subtitle="Controllo preliminare automatico per componenti meccanici."
          theme={theme}
          isDark={isDark}
          onClose={() => setShowChecklist(false)}
          wide
        >
          <div style={s.checklistLayout}>
            <div style={s.checklistFormArea}>
              <div style={s.checklistGrid}>
                <Field label="Tipo componente" value={checklistForm.componentType} onChange={v => updateChecklistField("componentType", v)} placeholder="Albero, perno, staffa, flangia..." theme={theme} isDark={isDark} />
                <Field label="Materiale" value={checklistForm.material} onChange={v => updateChecklistField("material", v)} placeholder="C45, S235JR, 42CrMo4..." theme={theme} isDark={isDark} />
                <Field label="Carico indicativo [N]" value={checklistForm.load} onChange={v => updateChecklistField("load", v)} placeholder="2500" theme={theme} isDark={isDark} />
                <Field label="Coefficiente sicurezza" value={checklistForm.safetyFactor} onChange={v => updateChecklistField("safetyFactor", v)} placeholder="2" theme={theme} isDark={isDark} />
              </div>

              <Field label="Ambiente d'uso" value={checklistForm.environment} onChange={v => updateChecklistField("environment", v)} placeholder="Interno, esterno, umido, corrosivo, olio..." theme={theme} isDark={isDark} />
              <Field label="Lavorazione prevista" value={checklistForm.machining} onChange={v => updateChecklistField("machining", v)} placeholder="Tornitura, fresatura, saldatura, rettifica..." theme={theme} isDark={isDark} />
              <Field label="Tolleranze / accoppiamenti presenti" value={checklistForm.tolerances} onChange={v => updateChecklistField("tolerances", v)} placeholder="Ø20 h6, foro Ø10 H7..." theme={theme} isDark={isDark} />
              <Field label="Rugosità" value={checklistForm.roughness} onChange={v => updateChecklistField("roughness", v)} placeholder="Ra 3.2 generale, Ra 1.6 sedi..." theme={theme} isDark={isDark} />

              <label style={s.label}>Note tecniche</label>
              <textarea
                style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                value={checklistForm.notes}
                onChange={e => updateChecklistField("notes", e.target.value)}
                placeholder="Smussi, raggi, filetti, trattamenti..."
              />

              <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runProjectChecklist} type="button">
                Esegui checklist
              </button>
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
                      <span>{item.status}</span>
                    </div>
                    <p style={s.resultDetail}>{item.detail}</p>
                    <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
                  </div>
                ))
              )}
            </div>
          </div>
        </Modal>
      )}

      {showQuickCalc && (
        <Modal
          title="Verifica dimensionale rapida"
          subtitle="Modulo preliminare per alberi, perni, staffe e componenti semplici."
          theme={theme}
          isDark={isDark}
          onClose={() => setShowQuickCalc(false)}
          wide
        >
          <div style={s.quickCalcLayout}>
            <div style={s.checklistFormArea}>
              <div style={s.checklistGrid}>
                <Field label="Tipo componente" value={quickCalcForm.componentType} onChange={v => updateQuickCalcField("componentType", v)} placeholder="Perno, albero, staffa..." theme={theme} isDark={isDark} />

                <div>
                  <label style={s.label}>Tipo verifica</label>
                  <select
                    style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                    value={quickCalcForm.stressType}
                    onChange={e => updateQuickCalcField("stressType", e.target.value)}
                  >
                    <option value="flessione">Flessione</option>
                    <option value="taglio">Taglio</option>
                    <option value="torsione">Torsione</option>
                    <option value="assiale">Trazione / compressione</option>
                  </select>
                </div>

                <Field label="Materiale" value={quickCalcForm.material} onChange={v => updateQuickCalcField("material", v)} placeholder="C45" theme={theme} isDark={isDark} />
                <Field label="Carico F [N]" value={quickCalcForm.load} onChange={v => updateQuickCalcField("load", v)} placeholder="2500" theme={theme} isDark={isDark} />
                <Field label="Distanza / braccio L [mm]" value={quickCalcForm.distance} onChange={v => updateQuickCalcField("distance", v)} placeholder="120" theme={theme} isDark={isDark} />
                <Field label="Diametro d [mm]" value={quickCalcForm.diameter} onChange={v => updateQuickCalcField("diameter", v)} placeholder="20" theme={theme} isDark={isDark} />
              </div>

              <Field label="Coefficiente sicurezza richiesto" value={quickCalcForm.safetyFactorRequired} onChange={v => updateQuickCalcField("safetyFactorRequired", v)} placeholder="2" theme={theme} isDark={isDark} />

              <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runQuickCalc} type="button">
                Calcola verifica
              </button>

              <div style={{ ...s.warningBox, border: `1px solid ${theme.border}` }}>
                Calcolo preliminare: non sostituisce verifica normativa, FEM o relazione firmata.
              </div>
            </div>

            <div style={s.checklistResultsArea}>
              {!quickCalcResult ? (
                <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>
                  Inserisci i dati e premi “Calcola verifica”.
                </div>
              ) : (
                <div style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                  <div style={s.resultTop}>
                    <strong>{quickCalcResult.title}</strong>
                    <span style={{ color: quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626", fontWeight: 950 }}>
                      {quickCalcResult.outcome}
                    </span>
                  </div>

                  <p style={s.resultDetail}>{quickCalcResult.scheme}</p>

                  <div style={s.formulaBlock}>
                    {quickCalcResult.formulas.map((formula, index) => (
                      <div key={index}>• {formula}</div>
                    ))}
                  </div>

                  {quickCalcResult.values.map((value, index) => (
                    <div key={index} style={s.valueRow}>• {value}</div>
                  ))}

                  <div style={{ ...s.finalBox, borderLeft: `4px solid ${quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626"}` }}>
                    Esito: {quickCalcResult.outcome}. Coefficiente calcolato n = {quickCalcResult.safetyFactor.toFixed(2)}.
                  </div>

                  {quickCalcResult.notes.map((note, index) => (
                    <p key={index} style={s.resultSuggestion}>{note}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}

      {showMaterials && (
        <Modal
          title="Libreria materiali"
          subtitle="Conversioni normative e proprietà meccaniche indicative."
          theme={theme}
          isDark={isDark}
          onClose={() => setShowMaterials(false)}
          wide
        >
          <div style={s.materialToolbar}>
            <input
              style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}`, marginBottom: 0 }}
              value={materialSearch}
              onChange={e => setMaterialSearch(e.target.value)}
              placeholder="Cerca materiale, EN, DIN, AISI, JIS..."
            />

            <button
              style={{ ...s.addMaterialBtn, background: theme.primary }}
              onClick={() => setShowAddMaterial(prev => !prev)}
              type="button"
            >
              {showAddMaterial ? "Chiudi" : "+ Aggiungi materiale"}
            </button>
          </div>

          {showAddMaterial && (
            <div style={{ ...s.addMaterialPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
              <h3 style={{ marginTop: 0 }}>Nuovo materiale personalizzato</h3>
              <p style={s.muted}>Compila i dati che conosci. Gli altri resteranno “Non specificato”.</p>

              <div style={s.addMaterialGrid}>
                {(["name", "key", "en", "uni", "din", "aisi", "jis", "iso", "rm", "re"] as (keyof MaterialInfo)[]).map(field => (
                  <div key={String(field)}>
                    <label style={s.label}>{String(field).toUpperCase()}</label>
                    <input
                      style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                      value={(newMaterial as any)[field] || ""}
                      onChange={e => updateNewMaterialField(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>

              {(["hardness", "treatments", "weldability", "machinability", "uses"] as (keyof MaterialInfo)[]).map(field => (
                <div key={String(field)}>
                  <label style={s.label}>{String(field)}</label>
                  <input
                    style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                    value={(newMaterial as any)[field] || ""}
                    onChange={e => updateNewMaterialField(field, e.target.value)}
                  />
                </div>
              ))}

              <label style={s.label}>Note</label>
              <textarea
                style={{ ...s.addMaterialTextarea, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}
                value={newMaterial.notes}
                onChange={e => updateNewMaterialField("notes", e.target.value)}
              />

              <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={addCustomMaterial} type="button">
                Salva materiale
              </button>
            </div>
          )}

          <div style={s.materialGrid}>
            {filteredMaterials.map((m: MaterialInfo) => {
              const isCustom = customMaterials.some(item => item.key === m.key);

              return (
                <div key={m.key} style={{ ...s.materialCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                  <div style={s.materialHead}>
                    <div>
                      <h3 style={{ marginTop: 0, marginBottom: 4 }}>{m.name}</h3>
                      {isCustom && <span style={s.customTag}>Personalizzato</span>}
                    </div>

                    {isCustom && (
                      <button style={s.smallDeleteMaterialBtn} onClick={() => deleteCustomMaterial(m.key)} type="button">
                        Elimina
                      </button>
                    )}
                  </div>

                  <div style={s.materialCodes}>
                    <span><strong>EN:</strong> {m.en}</span>
                    <span><strong>UNI:</strong> {m.uni}</span>
                    <span><strong>DIN:</strong> {m.din}</span>
                    <span><strong>AISI/SAE:</strong> {m.aisi}</span>
                    <span><strong>JIS:</strong> {m.jis}</span>
                    <span><strong>ISO:</strong> {m.iso}</span>
                  </div>

                  <div style={s.materialProps}>
                    <strong>Rm:</strong> {m.rm} MPa · <strong>Re:</strong> {m.re} MPa · <strong>Durezza:</strong> {m.hardness}
                  </div>

                  <p><strong>Trattamenti:</strong> {m.treatments}</p>
                  <p><strong>Saldabilità:</strong> {m.weldability}</p>
                  <p><strong>Lavorabilità:</strong> {m.machinability}</p>
                  <p><strong>Impieghi:</strong> {m.uses}</p>
                  <p style={{ opacity: 0.72 }}><strong>Nota:</strong> {m.notes}</p>
                </div>
              );
            })}
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
                <strong>Revisione tavola</strong>
                <p style={s.muted}>Carica solo un'immagine della tavola: PNG, JPG, JPEG o WebP.</p>

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
                  <FileCard upload={drawingReviewFile} icon="🖼️" theme={theme} isDark={isDark} onRemove={removeDrawingReviewFile} />
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
                {drawingAiLoading ? "Analisi immagine in corso..." : isImageUpload(drawingReviewFile) ? "Analizza immagine tavola" : "Genera controllo tavola"}
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
                <button
                  key={tab}
                  style={{ ...s.tabBtn, color: activeTab === tab ? theme.primary : theme.text }}
                  onClick={() => setActiveTab(tab)}
                  type="button"
                >
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
                  <Field label="Email" value={user.email} onChange={v => {}} theme={theme} isDark={isDark} />
                  <button
                    style={{ ...s.secondaryBtn, color: "#ef4444", border: "1px solid #ef4444", marginTop: 8 }}
                    onClick={handleLogout}
                    type="button"
                  >
                    Disconnetti
                  </button>
                </>
              )}

              {activeTab === "Aspetto" && (
                <div style={s.themeGrid}>
                  {THEMES.map(t => (
                    <button
                      key={t.name}
                      style={{ ...s.themeOption, color: theme.text, border: `1px solid ${theme.name === t.name ? t.primary : theme.border}` }}
                      onClick={() => setTheme(t)}
                      type="button"
                    >
                      <span
                        style={{
                          ...s.themeDot,
                          background: t.name === "Dark Black" ? "#050505" : t.primary,
                          border: t.name === "Dark Black" ? "1px solid #fff" : "none",
                        }}
                      />
                      {t.name}
                    </button>
                  ))}
                </div>
              )}

              {activeTab === "AI Focus" && (
                <Field label="Ambito tecnico principale" value={interest} onChange={setInterest} theme={theme} isDark={isDark} />
              )}
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

function Modal({
  title,
  subtitle,
  children,
  theme,
  isDark,
  onClose,
  wide = false,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  theme: Theme;
  isDark: boolean;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div style={s.overlay}>
      <div
        style={{
          ...s.checklistModal,
          width: wide ? "min(1120px, calc(100vw - 32px))" : "min(760px, calc(100vw - 32px))",
          background: isDark ? "#111" : "#fff",
          color: theme.text,
          border: `1px solid ${theme.border}`,
        }}
      >
        <div style={s.modalHeader}>
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            {subtitle && <p style={s.muted}>{subtitle}</p>}
          </div>

          <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={onClose} type="button">
            ×
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  theme,
  isDark,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  theme: Theme;
  isDark: boolean;
}) {
  return (
    <div>
      <label style={s.label}>{label}</label>
      <input
        style={{
          ...s.input,
          background: isDark ? "#050505" : "#fff",
          color: theme.text,
          border: `1px solid ${theme.border}`,
        }}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function FileCard({
  upload,
  icon,
  theme,
  isDark,
  onRemove,
}: {
  upload: DrawingUpload;
  icon: string;
  theme: Theme;
  isDark: boolean;
  onRemove: () => void;
}) {
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
          <p style={s.muted}>
            {previewUrl
              ? `Anteprima reale: ${fileName || "tavola caricata"}`
              : "Carica un'immagine PNG/JPG/WebP per vedere la tavola a destra."}
          </p>
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
              <span
                style={{
                  ...s.issueDot,
                  background: issue.severity === "errore" ? "#dc2626" : issue.severity === "attenzione" ? "#f59e0b" : "#16a34a",
                }}
              />
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

  checklistLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.9fr) minmax(360px, 1.1fr)", gap: 22, overflow: "hidden" },
  quickCalcLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.85fr) minmax(400px, 1.15fr)", gap: 22, overflow: "hidden" },
  checklistFormArea: { overflowY: "auto", paddingRight: 6 },
  checklistResultsArea: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 },
  checklistGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  checklistTextarea: { width: "100%", minHeight: 92, padding: 12, borderRadius: 12, marginBottom: 14, outline: "none", fontSize: 14, resize: "vertical" },
  emptyChecklist: { borderRadius: 18, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: 0.68, padding: 18, fontSize: 14 },
  resultCard: { borderRadius: 18, padding: 16, marginTop: 12 },
  resultTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, fontSize: 14 },
  resultDetail: { margin: "0 0 10px", lineHeight: 1.5, fontSize: 13, opacity: 0.82 },
  resultSuggestion: { marginTop: 12, paddingLeft: 10, lineHeight: 1.5, fontSize: 13, fontWeight: 650 },
  warningBox: { marginTop: 14, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 1.5, opacity: 0.74 },
  formulaBlock: { borderRadius: 16, padding: 14, background: "rgba(120,120,120,0.08)", margin: "14px 0", overflowX: "auto", fontSize: 14, lineHeight: 1.6 },
  valueRow: { fontSize: 13, lineHeight: 1.45, margin: "6px 0" },
  finalBox: { marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(120,120,120,0.08)", fontWeight: 850 },

  materialToolbar: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 18 },
  addMaterialBtn: { border: "none", color: "white", borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontWeight: 850, whiteSpace: "nowrap" },
  addMaterialPanel: { borderRadius: 18, padding: 18, marginBottom: 18, overflowY: "auto", maxHeight: 390 },
  addMaterialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  addMaterialTextarea: { width: "100%", minHeight: 70, borderRadius: 12, padding: 12, outline: "none", resize: "vertical", marginBottom: 14 },
  materialGrid: { flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, paddingRight: 4 },
  materialCard: { borderRadius: 18, padding: 18, lineHeight: 1.45, fontSize: 13 },
  materialHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  customTag: { display: "inline-flex", fontSize: 11, fontWeight: 850, opacity: 0.68 },
  smallDeleteMaterialBtn: { border: "none", color: "#991b1b", background: "#fee2e2", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" },
  materialCodes: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, marginBottom: 12, opacity: 0.82 },
  materialProps: { padding: 10, borderRadius: 12, background: "rgba(120,120,120,0.08)", marginBottom: 10, lineHeight: 1.5 },

  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 },
  themeOption: { padding: 12, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 800, background: "transparent" },
  themeDot: { width: 12, height: 12, borderRadius: "50%" },

  drawingLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(380px, 0.95fr) minmax(430px, 1.05fr)", gap: 22, overflow: "hidden" },
  drawingUploadPanel: { borderRadius: 18, padding: 16, marginBottom: 18 },
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
};
