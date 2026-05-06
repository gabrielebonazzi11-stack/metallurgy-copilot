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
  verificationType: string;
  sectionType: string;
  material: string;

  axialLoad: string;
  shearLoad: string;
  bendingMoment: string;
  torque: string;
  distance: string;

  diameter: string;
  outerDiameter: string;
  innerDiameter: string;

  base: string;
  height: string;
  outerBase: string;
  outerHeight: string;
  innerBase: string;
  innerHeight: string;

  pressure: string;
  radius: string;
  thickness: string;

  sigmaX: string;
  sigmaY: string;
  tauXY: string;

  sigmaMax: string;
  sigmaMin: string;
  fatigueLimit: string;

  safetyFactorRequired: string;
};

type QuickCalcResult = {
  title: string;
  scheme: string;
  section: string;
  formulas: string[];
  sectionValues: string[];
  values: string[];
  equivalentStress: number;
  trescaStress?: number;
  safetyFactor: number;
  outcome: "OK" | "NON OK";
  notes: string[];
};

type DrawingUpload = {
  file: File;
  fileAttachment: FileAttachment;
  previewUrl?: string;
  convertedFile?: File;
  isPdf?: boolean;
  totalPages?: number;
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

type ProjectSavedItem = {
  id: string;
  type: "checklist" | "quickcalc" | "drawing" | "file" | "bom" | "solidworks" | "advanced";
  title: string;
  createdAt: string;
  summary: string;
  payload?: any;
};

type ProjectRecord = {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  items: ProjectSavedItem[];
};

type ProjectFileMeta = {
  name: string;
  type: string;
  sizeKb: string;
  extension: string;
  category: string;
  note: string;
};

type SeriousVerificationForm = {
  mode: "fatigue" | "contact" | "bolts";
  material: string;
  rm: string;
  re: string;
  sn: string;
  sigmaMax: string;
  sigmaMin: string;
  normalLoad: string;
  contactArea: string;
  contactDiameter: string;
  contactLength: string;
  boltClass: string;
  boltSize: string;
  boltArea: string;
  boltCount: string;
  shearForce: string;
  tensileForce: string;
};

type SeriousVerificationResult = {
  title: string;
  status: "OK" | "NON OK" | "DA VERIFICARE";
  rows: string[];
  suggestions: string[];
};

type BomIssue = {
  row: number;
  severity: IssueSeverity;
  message: string;
  suggestion: string;
};

type SectionData = {
  name: string;
  A: number;
  Jf: number;
  Wf: number;
  Jp: number;
  Wt: number;
  shearFactor: number;
  values: string[];
  notes: string[];
};
const THEMES: Theme[] = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },

  { name: "Black Red", primary: "#ef4444", bg: "#050505", surface: "#111111", text: "#ef4444", border: "#262626" },
  { name: "Black Green", primary: "#22c55e", bg: "#050505", surface: "#111111", text: "#22c55e", border: "#262626" },
];

const STORAGE_KEY_BASE = "techai_stable_app_v7_scoped";
const GUEST_ID_KEY = "techai_guest_id";
const GUEST_USED_KEY = "techai_guest_used";
const GUEST_LIMIT = 10;
const GUEST_FILE_LIMIT = 1;

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
  return Boolean(file && file.type.startsWith("image/"));
}

function isPdfFile(file: File | null | undefined) {
  return Boolean(file && (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")));
}

function isDrawingUpload(upload: DrawingUpload | null) {
  return Boolean(upload?.file && (isImageFile(upload.file) || isPdfFile(upload.file)));
}

function toNumber(value: string, fallback = 0) {
  const n = Number(String(value || "").replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}

async function pdfPageToImageFile(file: File): Promise<{ dataUrl: string; jpegFile: File; totalPages: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const page = await pdf.getPage(1);
  const scale = 2.5;
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx as any, viewport }).promise;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const blob = await new Promise<Blob>(resolve => canvas.toBlob(b => resolve(b!), "image/jpeg", 0.95));
  const jpegFile = new File([blob], file.name.replace(/\.pdf$/i, "_p1.jpg"), { type: "image/jpeg" });

  return { dataUrl, jpegFile, totalPages };
}

async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item: any) => ("str" in item ? item.str : "")).join(" ");
    pages.push(pageText);
  }

  return pages.join("\n\n");
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

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [loginDismissed, setLoginDismissed] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDrawingGenerator, setShowDrawingGenerator] = useState(false);
  const [showProjects, setShowProjects] = useState(false);
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
  const [isGuest, setIsGuest] = useState(false);
  const [guestUsed, setGuestUsed] = useState(0);
  const [activeStorageKey, setActiveStorageKey] = useState("");
  const [storageReady, setStorageReady] = useState(false);

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
    componentType: "albero",
    verificationType: "flessione_torsione",
    sectionType: "circolare_piena",
    material: "C45",

    axialLoad: "0",
    shearLoad: "2500",
    bendingMoment: "",
    torque: "80000",
    distance: "120",

    diameter: "25",
    outerDiameter: "40",
    innerDiameter: "25",

    base: "30",
    height: "50",
    outerBase: "60",
    outerHeight: "80",
    innerBase: "40",
    innerHeight: "60",

    pressure: "30",
    radius: "150",
    thickness: "4",

    sigmaX: "80",
    sigmaY: "20",
    tauXY: "30",

    sigmaMax: "180",
    sigmaMin: "20",
    fatigueLimit: "",

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
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [projectSmartFile, setProjectSmartFile] = useState<ProjectFileMeta | null>(null);

  const [seriousForm, setSeriousForm] = useState<SeriousVerificationForm>({
    mode: "fatigue",
    material: "C45",
    rm: "650",
    re: "370",
    sn: "260",
    sigmaMax: "180",
    sigmaMin: "20",
    normalLoad: "2500",
    contactArea: "120",
    contactDiameter: "20",
    contactLength: "15",
    boltClass: "8.8",
    boltSize: "M8",
    boltArea: "36.6",
    boltCount: "4",
    shearForce: "4000",
    tensileForce: "2000",
  });
  const [seriousResult, setSeriousResult] = useState<SeriousVerificationResult | null>(null);

  const [bomText, setBomText] = useState("");
  const [bomFileName, setBomFileName] = useState("");
  const [bomIssues, setBomIssues] = useState<BomIssue[]>([]);

  const [solidWorksTask, setSolidWorksTask] = useState("modellare_pezzo");
  const [solidWorksNotes, setSolidWorksNotes] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingReviewInputRef = useRef<HTMLInputElement>(null);
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const bomFileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isDark =
  theme.name === "Dark Black" ||
  theme.name === "Black Red" ||
  theme.name === "Black Green";
  const activeChat = chats.find(chat => chat.id === activeChatId);
  const currentMessages = activeChat?.messages || [];
  const allMaterials = useMemo(() => [...MATERIALS_DB, ...customMaterials], [customMaterials]);

  const filteredMaterials = useMemo(() => {
    const q = materialSearch.trim().toLowerCase();
    if (!q) return allMaterials.slice(0, 140);

    return allMaterials
      .filter((m: MaterialInfo) => `${m.name} ${m.en} ${m.uni} ${m.din} ${m.aisi} ${m.jis} ${m.iso} ${m.uses} ${m.notes}`.toLowerCase().includes(q))
      .slice(0, 180);
  }, [materialSearch, allMaterials]);

  const activeProject = useMemo(
    () => projects.find(project => project.id === activeProjectId) || projects[0] || null,
    [projects, activeProjectId]
  );

  const makeUserStorageKey = (email: string) => {
    const cleanEmail = String(email || "utente")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9@._-]/g, "_");

    return `${STORAGE_KEY_BASE}:user:${cleanEmail}`;
  };

  const makeGuestStorageKey = (guestId: string) => {
    const cleanGuestId = String(guestId || "guest").trim().replace(/[^a-zA-Z0-9_-]/g, "_");
    return `${STORAGE_KEY_BASE}:guest:${cleanGuestId}`;
  };

  const resetWorkspace = () => {
    setChats([]);
    setActiveChatId(null);
    setPendingFile(null);
    setQuery("");
    setChecklistResults([]);
    setQuickCalcResult(null);
    setDrawingReviewFile(null);
    setDrawingResults([]);
    setDrawingIssues([]);
    setProjects([]);
    setActiveProjectId(null);
    setProjectSmartFile(null);
    setSeriousResult(null);
    setBomIssues([]);
    setBomText("");
    setBomFileName("");
  };

  const loadWorkspaceFromStorage = (storageKey: string) => {
    setStorageReady(false);
    setActiveStorageKey(storageKey);

    const saved = localStorage.getItem(storageKey);

    if (!saved) {
      resetWorkspace();
      setTheme(THEMES[5]);
      setInterest("Ingegneria Meccanica");
      setSidebarOpen(true);
      setCustomMaterials([]);
      setProjects([]);
      setActiveProjectId(null);
      setStorageReady(true);
      return;
    }

    const data = safeParseJson<any>(saved, null);

    if (!data) {
      resetWorkspace();
      setStorageReady(true);
      return;
    }

    setTheme(THEMES.find(t => t.name === data.themeName) || THEMES[5]);
    setInterest(data.interest || "Ingegneria Meccanica");
    setChats(Array.isArray(data.chats) ? data.chats : []);
    setActiveChatId(data.activeChatId || null);
    setSidebarOpen(data.sidebarOpen ?? true);
    setCustomMaterials(Array.isArray(data.customMaterials) ? data.customMaterials : []);
    setProjects(Array.isArray(data.projects) ? data.projects : []);
    setActiveProjectId(data.activeProjectId || null);
    setPendingFile(null);
    setQuery("");
    setStorageReady(true);
  };

  useEffect(() => {
    const savedGuestUsed = Number(localStorage.getItem(GUEST_USED_KEY) || "0");
    setGuestUsed(Number.isFinite(savedGuestUsed) ? savedGuestUsed : 0);

    const applySession = (session: any) => {
      if (session?.user) {
        const name = session.user.user_metadata?.name || session.user.email?.split("@")[0] || "Utente";
        const email = session.user.email || "";
        const profile = { name, email };

        setUser(profile);
        setLoginEmail(email);
        setIsLoggedIn(true);
        setIsGuest(false);
        setShowLoginPanel(false);
        setLoginDismissed(false);
        setLoginError("");

        loadWorkspaceFromStorage(makeUserStorageKey(email));
      } else {
        setUser(DEFAULT_USER);
        setIsLoggedIn(false);
        setIsGuest(false);
        setStorageReady(false);
        setActiveStorageKey("");
        resetWorkspace();
      }
    };

    if (!isSupabaseConfigured || !supabase) {
      setIsLoggedIn(true);
      setIsGuest(false);
      loadWorkspaceFromStorage(`${STORAGE_KEY_BASE}:local`);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      applySession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!storageReady || !activeStorageKey) return;

    const safeChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message => ({
        role: message.role,
        text: message.text,
        fileAttachment: message.fileAttachment,
      })),
    }));

    localStorage.setItem(
      activeStorageKey,
      JSON.stringify({
        themeName: theme.name,
        user,
        interest,
        chats: safeChats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        isGuest,
        customMaterials,
        projects,
        activeProjectId,
      })
    );
  }, [theme, user, interest, chats, activeChatId, sidebarOpen, isLoggedIn, isGuest, customMaterials, projects, activeProjectId, storageReady, activeStorageKey]);

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

  const resetChecklist = () => {
    setChecklistForm({
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

    setChecklistResults([]);
  };

  const updateQuickCalcField = (field: keyof QuickCalcForm, value: string) => {
    setQuickCalcForm(prev => ({ ...prev, [field]: value }));
  };

  const resetQuickCalc = () => {
    setQuickCalcForm(prev => ({
      ...prev,

      axialLoad: "0",
      shearLoad: "2500",
      bendingMoment: "",
      torque: "80000",
      distance: "120",

      diameter: "25",
      outerDiameter: "40",
      innerDiameter: "25",

      base: "30",
      height: "50",
      outerBase: "60",
      outerHeight: "80",
      innerBase: "40",
      innerHeight: "60",

      pressure: "30",
      radius: "150",
      thickness: "4",

      sigmaX: "80",
      sigmaY: "20",
      tauXY: "30",

      sigmaMax: "180",
      sigmaMin: "20",
      fatigueLimit: "",

      safetyFactorRequired: "2",
    }));

    setQuickCalcResult(null);
  };

  const updateDrawingField = (field: keyof DrawingForm, value: string) => {
    setDrawingForm(prev => ({ ...prev, [field]: value }));
  };

  const resetDrawingGenerator = () => {
    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);

    setDrawingReviewFile(null);
    setDrawingResults([]);
    setDrawingIssues([]);
    setDrawingAiLoading(false);

    setDrawingForm({
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

    if (drawingReviewInputRef.current) drawingReviewInputRef.current.value = "";
  };

  const updateSeriousField = (field: keyof SeriousVerificationForm, value: string) => {
    setSeriousForm(prev => ({ ...prev, [field]: value }));
  };

  const createProject = (name?: string, description?: string) => {
    const projectName = String(name || newProjectName || "Nuovo progetto").trim();
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: createId(),
      name: projectName || "Nuovo progetto",
      description: String(description || newProjectDescription || "").trim(),
      createdAt: now,
      updatedAt: now,
      items: [],
    };

    setProjects(prev => [project, ...prev]);
    setActiveProjectId(project.id);
    setNewProjectName("");
    setNewProjectDescription("");
    return project.id;
  };

  const deleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(project => project.id !== projectId));
    if (activeProjectId === projectId) setActiveProjectId(null);
  };

  const addProjectItem = (item: Omit<ProjectSavedItem, "id" | "createdAt">, preferredProjectId?: string) => {
    const targetId = preferredProjectId || activeProject?.id || createProject("Progetto automatico", "Creato automaticamente da TechAI.");
    const now = new Date().toISOString();
    const completeItem: ProjectSavedItem = {
      id: createId(),
      createdAt: now,
      ...item,
    };

    setProjects(prev =>
      prev.map(project =>
        project.id === targetId
          ? { ...project, updatedAt: now, items: [completeItem, ...project.items] }
          : project
      )
    );

    setActiveProjectId(targetId);
  };

  const saveChecklistToProject = () => {
    if (checklistResults.length === 0) {
      alert("Prima esegui la checklist, poi salvala nel progetto.");
      return;
    }

    addProjectItem({
      type: "checklist",
      title: `Checklist - ${checklistForm.componentType || "Componente"}`,
      summary: `${checklistResults.length} controlli salvati. Materiale: ${checklistForm.material || "non indicato"}.`,
      payload: { checklistForm, checklistResults },
    });
  };

  const saveQuickCalcToProject = () => {
    if (!quickCalcResult) {
      alert("Prima esegui una verifica, poi salvala nel progetto.");
      return;
    }

    addProjectItem({
      type: "quickcalc",
      title: quickCalcResult.title,
      summary: `Esito ${quickCalcResult.outcome}. σeq = ${quickCalcResult.equivalentStress.toFixed(2)} MPa, n = ${quickCalcResult.safetyFactor.toFixed(2)}.`,
      payload: { quickCalcForm, quickCalcResult },
    });
  };

  const saveDrawingToProject = () => {
    if (drawingResults.length === 0 && !drawingReviewFile) {
      alert("Prima carica/analizza una tavola oppure compila il controllo base.");
      return;
    }

    addProjectItem({
      type: "drawing",
      title: `Tavola - ${drawingForm.partName || drawingReviewFile?.fileAttachment.name || "senza nome"}`,
      summary: drawingResults.length > 0 ? `${drawingResults.length} risultati/controlli salvati.` : "File tavola salvato come riferimento.",
      payload: { drawingForm, drawingResults, drawingIssues, file: drawingReviewFile?.fileAttachment },
    });
  };

  const runSeriousVerification = () => {
    const mode = seriousForm.mode;
    const Rm = toNumber(seriousForm.rm, 650);
    const Re = toNumber(seriousForm.re, 370);
    const Sn = toNumber(seriousForm.sn, 0.5 * Rm);
    const suggestions: string[] = [];
    let rows: string[] = [];
    let status: SeriousVerificationResult["status"] = "DA VERIFICARE";
    let title = "Verifica avanzata";

    if (mode === "fatigue") {
      const sigmaMax = toNumber(seriousForm.sigmaMax);
      const sigmaMin = toNumber(seriousForm.sigmaMin);
      const sigmaM = (sigmaMax + sigmaMin) / 2;
      const sigmaA = Math.abs(sigmaMax - sigmaMin) / 2;
      const sigmaMPositive = Math.max(sigmaM, 0);
      const nGoodman = 1 / (sigmaA / Sn + sigmaMPositive / Rm);
      const nSoderberg = 1 / (sigmaA / Sn + sigmaMPositive / Re);
      status = nGoodman >= 1.5 && nSoderberg >= 1.3 ? "OK" : "NON OK";
      title = "Fatica - Goodman e Soderberg";
      rows = [
        `Materiale: ${seriousForm.material}`,
        `Rm = ${Rm.toFixed(1)} MPa; Re/Rp0.2 = ${Re.toFixed(1)} MPa; Sn = ${Sn.toFixed(1)} MPa`,
        `σmax = ${sigmaMax.toFixed(2)} MPa; σmin = ${sigmaMin.toFixed(2)} MPa`,
        `σm = ${sigmaM.toFixed(2)} MPa; σa = ${sigmaA.toFixed(2)} MPa`,
        `Goodman: n = ${nGoodman.toFixed(2)}`,
        `Soderberg: n = ${nSoderberg.toFixed(2)}`,
      ];
      suggestions.push("Per progetto reale correggere Sn con rugosità, dimensione, tipo carico, affidabilità e intaglio Kf.");
      suggestions.push("Soderberg è più conservativo perché usa Re al posto di Rm sulla tensione media.");
    }

    if (mode === "contact") {
      const F = toNumber(seriousForm.normalLoad);
      const area = toNumber(seriousForm.contactArea);
      const d = toNumber(seriousForm.contactDiameter);
      const L = toNumber(seriousForm.contactLength);
      const projectedArea = d > 0 && L > 0 ? d * L : area;
      const pSpecific = F / Math.max(projectedArea, 1);
      status = pSpecific <= 80 ? "OK" : pSpecific <= 150 ? "DA VERIFICARE" : "NON OK";
      title = "Contatto - pressione specifica";
      rows = [
        `Carico normale F = ${F.toFixed(2)} N`,
        `Area inserita = ${area.toFixed(2)} mm²`,
        `Area proiettata d·L = ${projectedArea.toFixed(2)} mm²`,
        `Pressione specifica p = F/A = ${pSpecific.toFixed(2)} MPa`,
      ];
      suggestions.push("Per rulli, perni e camme usare questa come verifica preliminare; per progetto serio fare Hertz.");
      suggestions.push("Se p è alta: aumentare area di contatto, diametro, lunghezza oppure usare materiale/trattamento più resistente all'usura.");
    }

    if (mode === "bolts") {
      const boltCount = Math.max(1, toNumber(seriousForm.boltCount, 1));
      const area = toNumber(seriousForm.boltArea, 36.6);
      const shearForce = toNumber(seriousForm.shearForce);
      const tensileForce = toNumber(seriousForm.tensileForce);
      const preload = 0.75 * Re * area;
      const shearStress = shearForce / (boltCount * area);
      const tensileStress = tensileForce / (boltCount * area);
      const vm = Math.sqrt(tensileStress ** 2 + 3 * shearStress ** 2);
      const n = Re / Math.max(vm, 0.001);
      status = n >= 2 ? "OK" : n >= 1.3 ? "DA VERIFICARE" : "NON OK";
      title = "Bulloni - precarico, taglio e trazione";
      rows = [
        `Classe: ${seriousForm.boltClass}; vite: ${seriousForm.boltSize}; n° viti = ${boltCount}`,
        `Area resistente usata Ares = ${area.toFixed(2)} mm²`,
        `Precarico consigliato indicativo Fp ≈ 0,75·Re·Ares = ${preload.toFixed(0)} N per vite`,
        `Taglio medio per vite: τ = ${shearStress.toFixed(2)} MPa`,
        `Trazione media per vite: σ = ${tensileStress.toFixed(2)} MPa`,
        `Von Mises vite: σVM = ${vm.toFixed(2)} MPa`,
        `Coefficiente indicativo n = ${n.toFixed(2)}`,
      ];
      suggestions.push("Verifica anche schiacciamento dei pezzi collegati, rifollamento fori, attrito se giunto precaricato e normativa applicabile.");
      suggestions.push("Per classi 8.8 e 10.9 usare dati reali UNI EN ISO 898-1 e coppia di serraggio coerente.");
    }

    const result = { title, status, rows, suggestions };
    setSeriousResult(result);
    addProjectItem({ type: "advanced", title, summary: `${status} - ${rows[rows.length - 1] || "verifica avanzata"}`, payload: { seriousForm, result } });
  };

  const resetSeriousVerification = () => {
    setSeriousResult(null);
    setSeriousForm(prev => ({ ...prev, sigmaMax: "180", sigmaMin: "20", normalLoad: "2500", shearForce: "4000", tensileForce: "2000" }));
  };

  const parseBomRows = (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return [];

    if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
      const parsed = JSON.parse(trimmed);
      const array = Array.isArray(parsed) ? parsed : Array.isArray(parsed.items) ? parsed.items : [];
      return array.map((row: any, index: number) => ({ index: index + 1, data: row }));
    }

    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    const separator = lines[0].includes(";") ? ";" : ",";
    const headers = lines[0].split(separator).map(h => h.trim().toLowerCase());
    return lines.slice(1).map((line, index) => {
      const cells = line.split(separator).map(c => c.trim());
      const data: Record<string, string> = {};
      headers.forEach((header, i) => { data[header] = cells[i] || ""; });
      return { index: index + 2, data };
    });
  };

  const getBomValue = (row: any, keys: string[]) => {
    for (const key of keys) {
      const foundKey = Object.keys(row || {}).find(k => k.toLowerCase().replaceAll(" ", "") === key.toLowerCase().replaceAll(" ", ""));
      if (foundKey && String(row[foundKey] || "").trim()) return String(row[foundKey]).trim();
    }
    return "";
  };

  const runBomCheck = () => {
    try {
      const rows = parseBomRows(bomText);
      const issues: BomIssue[] = [];
      const codes = new Map<string, number[]>();

      rows.forEach(({ index, data }) => {
        const code = getBomValue(data, ["codice", "code", "partnumber", "part number", "codiceparticolare"]);
        const description = getBomValue(data, ["descrizione", "description", "desc", "nome"]);
        const material = getBomValue(data, ["materiale", "material", "mat"]);
        const qtyRaw = getBomValue(data, ["quantita", "quantità", "qty", "qta", "quantity"]);
        const standard = getBomValue(data, ["norma", "standard", "normativa", "uni", "iso", "din"]);
        const joined = `${code} ${description} ${material} ${standard}`.toLowerCase();
        const qty = Number(qtyRaw.replace(",", "."));

        if (code) codes.set(code, [...(codes.get(code) || []), index]);
        if (!code) issues.push({ row: index, severity: "errore", message: "Codice mancante", suggestion: "Aggiungere un codice univoco componente." });
        if (!description) issues.push({ row: index, severity: "errore", message: "Descrizione incompleta", suggestion: "Inserire descrizione tecnica chiara del componente." });
        if (!qtyRaw || !Number.isFinite(qty) || qty <= 0) issues.push({ row: index, severity: "errore", message: "Quantità mancante o incoerente", suggestion: "Inserire quantità numerica maggiore di zero." });
        if (!material && !/(vite|bullone|dado|rondella|cuscinetto|oring|o-ring|commerciale|motore|valvola)/i.test(joined)) issues.push({ row: index, severity: "attenzione", message: "Materiale mancante", suggestion: "Inserire materiale o indicare che il componente è commerciale." });
        if (/(vite|bullone)/i.test(joined) && !/(4\.6|5\.8|8\.8|10\.9|12\.9|a2|a4)/i.test(joined)) issues.push({ row: index, severity: "errore", message: "Vite/bullone senza classe di resistenza", suggestion: "Aggiungere classe, esempio 8.8 / 10.9 / A2-70." });
        if (/cuscinetto|bearing/i.test(joined) && !/(6|7|2|3|nu|nj|nup|na|hk)\d{2,}[a-z0-9-]*/i.test(joined)) issues.push({ row: index, severity: "attenzione", message: "Cuscinetto senza sigla completa", suggestion: "Inserire sigla completa, gioco, schermatura e marca se richiesto." });
        if (/(vite|bullone|dado|rondella|cuscinetto|oring|o-ring|seeger|spina)/i.test(joined) && !standard) issues.push({ row: index, severity: "attenzione", message: "Componente commerciale senza norma", suggestion: "Aggiungere norma UNI/ISO/DIN o codice fornitore." });
      });

      codes.forEach((indexes, code) => {
        if (indexes.length > 1) {
          indexes.forEach(index => issues.push({ row: index, severity: "errore", message: `Codice duplicato: ${code}`, suggestion: "Usare codici univoci oppure verificare se è davvero lo stesso componente." }));
        }
      });

      setBomIssues(issues);
      addProjectItem({ type: "bom", title: `Controllo distinta ${bomFileName || "manuale"}`, summary: `${issues.length} anomalie trovate su ${rows.length} righe.`, payload: { bomText, bomFileName, issues } });
    } catch (error: any) {
      setBomIssues([{ row: 0, severity: "errore", message: "File distinta non leggibile", suggestion: error?.message || "Controlla formato CSV/JSON." }]);
    }
  };

  const handleBomFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setBomText(text);
    setBomFileName(file.name);
    setBomIssues([]);
    event.target.value = "";
  };

  const handleProjectSmartFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const extension = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    const category = extension === "step" || extension === "stp" ? "STEP 3D" : file.type.includes("pdf") ? "PDF" : file.type.startsWith("image/") ? "Immagine" : "File tecnico";
    const note =
      category === "STEP 3D"
        ? "Metadata STEP acquisiti. Per ora non viene ricostruita la geometria, ma il file viene salvato nel progetto come riferimento."
        : category === "PDF"
          ? "PDF acquisito. Se contiene testo, può essere analizzato dalla chat/tavole."
          : category === "Immagine"
            ? "Immagine acquisita. In futuro potrà ricevere annotazioni tecniche."
            : "File acquisito come riferimento progetto.";

    const meta: ProjectFileMeta = {
      name: file.name,
      type: file.type || "sconosciuto",
      sizeKb: (file.size / 1024).toFixed(1),
      extension,
      category,
      note,
    };

    setProjectSmartFile(meta);
    const projectId = activeProject?.id || createProject(file.name.replace(/\.[^.]+$/, ""), "Creato automaticamente da upload file tecnico.");
    addProjectItem({ type: "file", title: `File caricato - ${file.name}`, summary: `${category} · ${meta.sizeKb} KB. ${note}`, payload: meta }, projectId);
    event.target.value = "";
  };

  const solidWorksGuide = useMemo(() => {
    const guides: Record<string, { title: string; method: string[]; commands: string[]; errors: string[]; avoid: string[] }> = {
      modellare_pezzo: {
        title: "Modellare un pezzo da zero",
        method: ["Parti dalla funzione principale del pezzo", "Crea lo schizzo base sulla vista più stabile", "Usa estrusioni/rivoluzioni semplici", "Aggiungi fori, raccordi e smussi alla fine"],
        commands: ["Nuovo > Parte", "Schizzo", "Quota intelligente", "Estrusione base/base", "Taglio estruso", "Creazione guidata fori", "Raccordo", "Smusso"],
        errors: ["Schizzo non completamente definito", "Raccordi messi troppo presto", "Quote riferite a spigoli che cambiano"],
        avoid: ["Non partire da dettagli piccoli", "Non usare superfici se basta un solido", "Non lasciare schizzi blu non definiti"],
      },
      tubo_piegato: {
        title: "Creare un tubo piegato",
        method: ["Definisci asse/percorso del tubo", "Imposta diametro esterno e spessore", "Controlla raggi minimi di piega", "Genera distinta/taglio se serve"],
        commands: ["Schizzo 3D", "Membro strutturale / Saldature", "Sweep/Base con sweep", "Libreria profili", "Appiattimento se lamiera"],
        errors: ["Raggio piega troppo piccolo", "Percorso 3D non vincolato", "Profilo non normale al percorso"],
        avoid: ["Non modellare ogni tratto come corpo separato se deve essere un unico tubo", "Non ignorare lo spessore reale"],
      },
      sottoassieme: {
        title: "Creare un sottoassieme",
        method: ["Raggruppa componenti funzionalmente collegati", "Definisci parte fissa", "Aggiungi accoppiamenti essenziali", "Controlla gradi di libertà"],
        commands: ["Nuovo > Assieme", "Inserisci componenti", "Accoppiamento", "Fissa/Libera", "Rilevamento interferenze", "Salva come sottoassieme"],
        errors: ["Troppi accoppiamenti ridondanti", "Componenti non fissati", "Origini non coerenti"],
        avoid: ["Non mettere tutto nell'assieme principale", "Non usare accoppiamenti casuali su facce poco stabili"],
      },
      cartiglio: {
        title: "Collegare materiale al cartiglio",
        method: ["Assegna materiale alla parte", "Compila proprietà personalizzate", "Collega note del cartiglio alle proprietà", "Aggiorna tavola"],
        commands: ["Materiale > Modifica materiale", "File > Proprietà", "Proprietà personalizzate", "Formato foglio", "Collega a proprietà"],
        errors: ["Materiale scritto a mano nel cartiglio", "Proprietà non aggiornate", "Nome proprietà diverso tra parte e tavola"],
        avoid: ["Non scrivere materiale solo come testo libero", "Non duplicare dati in cartiglio e note"],
      },
      step_modificabile: {
        title: "Rendere un file STEP modificabile",
        method: ["Importa STEP come solido", "Esegui diagnostica importazione", "Riconosci funzioni se possibile", "Ricostruisci quote critiche manualmente"],
        commands: ["Apri STEP", "Diagnostica importazione", "FeatureWorks / Riconoscimento funzioni", "Modifica diretta", "Sposta faccia", "Elimina faccia"],
        errors: ["Pensare che lo STEP abbia lo storico feature", "Modificare facce senza controllare quote", "Perdere riferimenti dell'assieme"],
        avoid: ["Non usare FeatureWorks su geometrie troppo complesse se crea feature sporche", "Non fidarti senza verificare le misure"],
      },
    };

    return guides[solidWorksTask] || guides.modellare_pezzo;
  }, [solidWorksTask]);

  const saveSolidWorksGuideToProject = () => {
    addProjectItem({ type: "solidworks", title: solidWorksGuide.title, summary: `Procedura guidata SolidWorks salvata. Note: ${solidWorksNotes || "nessuna"}`, payload: { solidWorksTask, solidWorksNotes, solidWorksGuide } });
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

  const getSectionData = (): SectionData => {
    const sectionType = quickCalcForm.sectionType;

    const d = toNumber(quickCalcForm.diameter);
    const D = toNumber(quickCalcForm.outerDiameter);
    const di = toNumber(quickCalcForm.innerDiameter);

    const b = toNumber(quickCalcForm.base);
    const h = toNumber(quickCalcForm.height);

    const B = toNumber(quickCalcForm.outerBase);
    const H = toNumber(quickCalcForm.outerHeight);
    const bi = toNumber(quickCalcForm.innerBase);
    const hi = toNumber(quickCalcForm.innerHeight);

    if (sectionType === "circolare_piena") {
      if (d <= 0) throw new Error("Inserisci un diametro d valido per la sezione circolare piena.");

      const A = Math.PI * d ** 2 / 4;
      const Jf = Math.PI * d ** 4 / 64;
      const Wf = Math.PI * d ** 3 / 32;
      const Jp = Math.PI * d ** 4 / 32;
      const Wt = Math.PI * d ** 3 / 16;

      return {
        name: `Circolare piena Ø${d} mm`,
        A,
        Jf,
        Wf,
        Jp,
        Wt,
        shearFactor: 4 / 3,
        values: [
          `Sezione: circolare piena`,
          `Diametro: d = ${d.toFixed(2)} mm`,
          `Area: A = ${A.toFixed(2)} mm²`,
          `Momento d'inerzia flessionale: Jf = ${Jf.toFixed(2)} mm⁴`,
          `Modulo resistente a flessione: Wf = ${Wf.toFixed(2)} mm³`,
          `Momento polare: Jp = ${Jp.toFixed(2)} mm⁴`,
          `Modulo resistente a torsione: Wt = ${Wt.toFixed(2)} mm³`,
        ],
        notes: [],
      };
    }

    if (sectionType === "circolare_cava") {
      if (D <= 0 || di <= 0 || di >= D) {
        throw new Error("Per la sezione circolare cava inserisci D esterno > d interno > 0.");
      }

      const A = Math.PI * (D ** 2 - di ** 2) / 4;
      const Jf = Math.PI * (D ** 4 - di ** 4) / 64;
      const Wf = Jf / (D / 2);
      const Jp = Math.PI * (D ** 4 - di ** 4) / 32;
      const Wt = Jp / (D / 2);

      return {
        name: `Circolare cava Ø${D}/${di} mm`,
        A,
        Jf,
        Wf,
        Jp,
        Wt,
        shearFactor: 1.35,
        values: [
          `Sezione: circolare cava`,
          `Diametro esterno: D = ${D.toFixed(2)} mm`,
          `Diametro interno: d = ${di.toFixed(2)} mm`,
          `Area: A = ${A.toFixed(2)} mm²`,
          `Momento d'inerzia flessionale: Jf = ${Jf.toFixed(2)} mm⁴`,
          `Modulo resistente a flessione: Wf = ${Wf.toFixed(2)} mm³`,
          `Momento polare: Jp = ${Jp.toFixed(2)} mm⁴`,
          `Modulo resistente a torsione: Wt = ${Wt.toFixed(2)} mm³`,
        ],
        notes: ["Per il taglio su sezione cava il coefficiente è indicativo."],
      };
    }

    if (sectionType === "rettangolare_piena") {
      if (b <= 0 || h <= 0) {
        throw new Error("Per la sezione rettangolare piena inserisci base b e altezza h valide.");
      }

      const A = b * h;
      const Jf = b * h ** 3 / 12;
      const Wf = b * h ** 2 / 6;

      const longSide = Math.max(b, h);
      const shortSide = Math.min(b, h);
      const Jt = longSide * shortSide ** 3 * (1 / 3 - 0.21 * (shortSide / longSide) * (1 - shortSide ** 4 / (12 * longSide ** 4)));
      const Wt = Jt / (shortSide / 2);

      return {
        name: `Rettangolare piena ${b}×${h} mm`,
        A,
        Jf,
        Wf,
        Jp: Jt,
        Wt,
        shearFactor: 1.5,
        values: [
          `Sezione: rettangolare piena`,
          `Base: b = ${b.toFixed(2)} mm`,
          `Altezza: h = ${h.toFixed(2)} mm`,
          `Area: A = ${A.toFixed(2)} mm²`,
          `Momento d'inerzia flessionale: Jf = ${Jf.toFixed(2)} mm⁴`,
          `Modulo resistente a flessione: Wf = ${Wf.toFixed(2)} mm³`,
          `Modulo resistente torsionale indicativo: Wt ≈ ${Wt.toFixed(2)} mm³`,
        ],
        notes: ["La torsione su sezione rettangolare è una stima preliminare."],
      };
    }

    if (sectionType === "rettangolare_cava") {
      if (B <= 0 || H <= 0 || bi <= 0 || hi <= 0 || bi >= B || hi >= H) {
        throw new Error("Per la sezione rettangolare cava inserisci dimensioni esterne maggiori di quelle interne.");
      }

      const A = B * H - bi * hi;
      const Jf = (B * H ** 3 - bi * hi ** 3) / 12;
      const Wf = Jf / (H / 2);

      const JpIndicativo = ((B * H ** 3 + H * B ** 3) - (bi * hi ** 3 + hi * bi ** 3)) / 12;
      const Wt = JpIndicativo / (Math.min(B, H) / 2);

      return {
        name: `Rettangolare cava ${B}×${H} / ${bi}×${hi} mm`,
        A,
        Jf,
        Wf,
        Jp: JpIndicativo,
        Wt,
        shearFactor: 1.5,
        values: [
          `Sezione: rettangolare cava`,
          `Base esterna: B = ${B.toFixed(2)} mm`,
          `Altezza esterna: H = ${H.toFixed(2)} mm`,
          `Base interna: b = ${bi.toFixed(2)} mm`,
          `Altezza interna: h = ${hi.toFixed(2)} mm`,
          `Area: A = ${A.toFixed(2)} mm²`,
          `Momento d'inerzia flessionale: Jf = ${Jf.toFixed(2)} mm⁴`,
          `Modulo resistente a flessione: Wf = ${Wf.toFixed(2)} mm³`,
          `Modulo torsionale indicativo: Wt ≈ ${Wt.toFixed(2)} mm³`,
        ],
        notes: ["La torsione su sezione rettangolare cava è molto semplificata: per progetto reale usare formule da manuale o FEM."],
      };
    }

    throw new Error("Tipo di sezione non riconosciuto.");
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
      m => normalizeMaterialKey(m.key) === generatedKey || normalizeMaterialKey(m.name) === normalizeMaterialKey(materialName)
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
    if (name.includes("rame") || name.includes("ottone") || name.includes("bronzo")) return 110000;
    if (name.includes("ghisa")) return 100000;
    if (
      name.includes("ptfe") ||
      name.includes("nylon") ||
      name.includes("gomma") ||
      name.includes("pvc") ||
      name.includes("pom") ||
      name.includes("abs") ||
      name.includes("pla") ||
      name.includes("petg")
    ) return 3000;
    return 210000;
  };

  const getOrCreateGuestId = () => {
    let guestId = localStorage.getItem(GUEST_ID_KEY);
    if (!guestId) {
      guestId = `guest_${createId()}`;
      localStorage.setItem(GUEST_ID_KEY, guestId);
    }
    return guestId;
  };

  const markGuestRequestUsed = () => {
    const newUsed = guestUsed + 1;
    setGuestUsed(newUsed);
    localStorage.setItem(GUEST_USED_KEY, String(newUsed));
  };

  const syncGuestUsageFromBackend = (data: any) => {
    if (!isGuest) return;
    if (data?.usage?.used !== undefined) {
      const backendUsed = Number(data.usage.used || 0);
      setGuestUsed(backendUsed);
      localStorage.setItem(GUEST_USED_KEY, String(backendUsed));
    } else {
      markGuestRequestUsed();
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (isGuest) return null;
    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      setIsLoggedIn(false);
      setIsGuest(false);
      setLoginDismissed(false);
      setShowLoginPanel(true);
      setLoginError("Sessione scaduta. Effettua di nuovo il login.");
      return null;
    }

    return session.access_token;
  };

  const buildApiHeaders = async (): Promise<Record<string, string> | null> => {
    const headers: Record<string, string> = {};
    const token = await getAuthToken();

    if (token) {
      headers.Authorization = `Bearer ${token}`;
      return headers;
    }

    if (isGuest) {
      headers["X-Guest-Id"] = getOrCreateGuestId();
      return headers;
    }

    return null;
  };

  const handleGuestAccess = () => {
    const used = Number(localStorage.getItem(GUEST_USED_KEY) || "0");
    const guestId = getOrCreateGuestId();

    setUser({ name: "Ospite", email: "ospite@techai.local" });
    setIsGuest(true);
    setIsLoggedIn(true);
    setGuestUsed(Number.isFinite(used) ? used : 0);
    setShowLoginPanel(false);
    setLoginDismissed(true);
    setLoginError("");

    loadWorkspaceFromStorage(makeGuestStorageKey(guestId));
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
    setIsGuest(false);
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
    setStorageReady(false);
    setActiveStorageKey("");
    resetWorkspace();

    if (supabase && !isGuest) await supabase.auth.signOut();

    setUser(DEFAULT_USER);
    setIsLoggedIn(false);
    setIsGuest(false);
    setLoginDismissed(false);
    setShowLoginPanel(true);
    setShowSettings(false);
    setLoginPassword("");
    setAuthMode("login");
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
            // fallback backend
          }
        }
      }

      const headers = await buildApiHeaders();

      if (!headers) {
        replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: "⚠️ Sessione scaduta. Effettua di nuovo il login oppure entra come ospite." }]);
        return;
      }

      const res = await fetch("/api/chat", { method: "POST", headers, body: formData });
      const raw = await res.text();
      const data = safeParseJson<any>(raw, null);

      if (!res.ok) {
        const errMsg = data?.error || raw || `Errore HTTP ${res.status}`;

        if (res.status === 403 && data?.error === "Limite file ospite raggiunto") {
          replaceMessagesInChat(chatId, [
            ...updatedMessages,
            {
              role: "AI",
              text:
                `⚠️ **Limite caricamento file raggiunto** (${data.fileUsed}/${data.fileLimit} file usati).\n\n` +
                `Come ospite puoi caricare massimo **1 file ogni 24 ore**.\n\n` +
                `Puoi comunque continuare con domande testuali se hai ancora richieste disponibili.`,
            },
          ]);
          return;
        }

        if (res.status === 403 && data?.error === "Limite AI raggiunto") {
          replaceMessagesInChat(chatId, [
            ...updatedMessages,
            { role: "AI", text: `⚠️ **Limite AI raggiunto** (${data.used}/${data.limit} richieste usate).\n\nUpgrada al piano Pro per continuare a usare l'assistente.` },
          ]);
          return;
        }

        if (res.status === 403 && data?.error === "Limite ospite raggiunto") {
          replaceMessagesInChat(chatId, [
            ...updatedMessages,
            {
              role: "AI",
              text:
                `⚠️ **Limite ospite raggiunto** (${data.used}/${data.limit} richieste usate).\n\n` +
                `Come ospite puoi fare massimo **10 richieste ogni 24 ore**.\n\n` +
                `Accedi o registrati per continuare a usare TechAI.`,
            },
          ]);
          return;
        }

        if (res.status === 401) {
          replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: `⚠️ **Sessione scaduta.** Effettua di nuovo il login oppure entra come ospite.` }]);
          return;
        }

        throw new Error(errMsg);
      }

      const answer = data?.answer || data?.message || raw;
      if (!answer) throw new Error("Il backend non ha restituito una risposta valida.");

      syncGuestUsageFromBackend(data);
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
      detail: material ? `Materiale indicato: ${f.material}. Va confrontato con carico, ambiente e lavorazione.` : "Materiale non indicato: non è possibile valutare resistenza, trattamenti e lavorabilità.",
      suggestion: material ? "Controlla Rm, Re/Rp0.2, durezza, saldabilità e disponibilità commerciale." : "Inserisci una sigla materiale, ad esempio C45, S235JR, 42CrMo4, AISI 304.",
    });

    results.push({
      area: "Coerenza carico/materiale",
      status: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0 ? "❌ Errore critico" : material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0 ? "Carico non indicato o non numerico." : `Carico indicativo inserito: ${f.load} N. La sola checklist non sostituisce la verifica tensionale.`,
      suggestion: "Esegui almeno una verifica rapida a trazione/flessione/taglio/torsione in base al componente.",
    });

    results.push({
      area: "Ambiente d'uso",
      status: "⚠️ Da verificare",
      detail: environment ? `Ambiente indicato: ${f.environment}.` : "Ambiente non specificato: corrosione, temperatura, umidità e polveri possono cambiare la scelta del materiale.",
      suggestion: environment.includes("corros") || environment.includes("umid") || environment.includes("esterno") ? "Valuta inox, zincatura, verniciatura o altro trattamento superficiale." : "Specifica se il pezzo lavora a secco, in esterno, in olio, in ambiente corrosivo o ad alta temperatura.",
    });

    results.push({
      area: "Trattamenti termici/superficiali",
      status: material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: material ? "La necessità di trattamenti dipende da usura, fatica, durezza superficiale e accoppiamenti." : "Senza materiale non si possono proporre trattamenti compatibili.",
      suggestion: material.includes("c45") ? "Per C45 valuta bonifica o tempra superficiale se servono resistenza e durezza." : material.includes("42crmo4") ? "Per 42CrMo4 valuta bonifica se servono alte prestazioni meccaniche." : "Aggiungi una nota se sono richiesti bonifica, cementazione, nitrurazione, tempra, zincatura o anodizzazione.",
    });

    results.push({
      area: "Coefficiente di sicurezza",
      status: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "❌ Errore critico" : safetyValue < 1.5 ? "❌ Errore critico" : safetyValue < 2 ? "⚠️ Da verificare" : "✅ Conforme",
      detail: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "Coefficiente di sicurezza non indicato." : `Coefficiente di sicurezza indicato: n = ${f.safetyFactor}.`,
      suggestion: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "Inserisci n. Per componenti statici spesso si parte da valori indicativi ≥ 2." : safetyValue < 1.5 ? "Valore molto basso: giustificalo con norma, prove o calcolo accurato." : "Verifica che il coefficiente sia coerente con incertezza del carico e conseguenze del cedimento.",
    });

    results.push({ area: "Tolleranze dimensionali", status: tolerances ? "✅ Conforme" : "⚠️ Da verificare", detail: tolerances ? `Tolleranze indicate: ${f.tolerances}.` : "Non risultano tolleranze o accoppiamenti indicati.", suggestion: tolerances ? "Controlla che siano presenti sulle quote funzionali." : "Aggiungi tolleranze sulle quote funzionali. Esempi: Ø10 H7, Ø20 h6, posizione fori, planarità appoggi." });
    results.push({ area: "Rugosità", status: roughness ? "✅ Conforme" : "⚠️ Da verificare", detail: roughness ? `Rugosità indicata: ${f.roughness}.` : "Rugosità non indicata.", suggestion: roughness ? "Verifica che la rugosità sia assegnata alle superfici funzionali e non solo come valore generale." : "Aggiungi rugosità generale e rugosità specifiche per sedi, scorrimenti, appoggi, tenute e accoppiamenti." });
    results.push({ area: "Note di lavorazione", status: machining || f.notes.trim() ? "⚠️ Da verificare" : "⚠️ Da verificare", detail: machining ? `Lavorazione indicata: ${f.machining}.` : "Lavorazione non specificata.", suggestion: "Indica se il pezzo è tornito, fresato, saldato, piegato, tagliato laser, rettificato o trattato. Aggiungi note per sbavatura e protezione superficiale." });

    setChecklistResults(results);
  };

  const runQuickCalc = () => {
    try {
      const material = findMaterial(quickCalcForm.material);
      const Re = material?.re || 300;
      const Rm = material?.rm || Math.max(Re * 1.4, 400);
      const E = getYoungModulus(material);
      const nRequired = toNumber(quickCalcForm.safetyFactorRequired, 2) || 2;
      const type = quickCalcForm.verificationType;

      const section = getSectionData();

      const N = toNumber(quickCalcForm.axialLoad);
      const T = toNumber(quickCalcForm.shearLoad);
      const L = toNumber(quickCalcForm.distance);
      const Mt = toNumber(quickCalcForm.torque);
      const MfInput = toNumber(quickCalcForm.bendingMoment);
      const Mf = MfInput > 0 ? MfInput : T * L;

      let title = "";
      let scheme = "";
      let formulas: string[] = [];
      let values: string[] = [];
      let notes: string[] = [...section.notes];

      let sigmaN = 0;
      let sigmaF = 0;
      let tauT = 0;
      let tauV = 0;
      let tauTot = 0;
      let sigmaTot = 0;
      let sigmaVM = 0;
      let sigmaTresca = 0;
      let safetyFactor = 0;

      if (type === "assiale") {
        sigmaN = N / section.A;
        sigmaVM = Math.abs(sigmaN);
        sigmaTresca = Math.abs(sigmaN);
        safetyFactor = Re / sigmaVM;
        title = "Verifica a trazione / compressione";
        scheme = "Barra o componente con carico assiale centrato.";
        formulas = ["A = area sezione", "σ = N / A", "n = Re / |σ|"];
        values = [
          `Carico assiale: N = ${N.toFixed(2)} N`,
          `Tensione normale: σ = ${sigmaN.toFixed(2)} MPa`,
          `Modulo elastico indicativo: E = ${E.toFixed(0)} MPa`,
        ];
        notes.push("Se il carico è di compressione e il pezzo è snello, controllare anche l'instabilità di punta.");
      }

      if (type === "taglio") {
        tauV = section.shearFactor * T / section.A;
        sigmaVM = Math.sqrt(3) * Math.abs(tauV);
        sigmaTresca = 2 * Math.abs(tauV);
        safetyFactor = Re / sigmaVM;
        title = "Verifica a taglio";
        scheme = "Sezione sollecitata da forza tagliante.";
        formulas = ["τmedio = T / A", "τmax = k · T / A", "σVM = √3 · τmax", "n = Re / σVM"];
        values = [
          `Forza tagliante: T = ${T.toFixed(2)} N`,
          `Coefficiente forma taglio: k = ${section.shearFactor.toFixed(2)}`,
          `Tensione tangenziale massima indicativa: τ = ${tauV.toFixed(2)} MPa`,
          `Tensione equivalente Von Mises: σVM = ${sigmaVM.toFixed(2)} MPa`,
        ];
        notes.push("Per spine/perni controllare se il taglio è singolo o doppio.");
      }

      if (type === "flessione") {
        sigmaF = Mf / section.Wf;
        sigmaVM = Math.abs(sigmaF);
        sigmaTresca = Math.abs(sigmaF);
        safetyFactor = Re / sigmaVM;
        title = "Verifica a flessione";
        scheme = MfInput > 0 ? "Momento flettente inserito direttamente." : "Momento flettente calcolato da forza tagliante e braccio: Mf = T · L.";
        formulas = ["Mf = T · L oppure valore inserito", "Wf = modulo resistente a flessione", "σf = Mf / Wf", "n = Re / |σf|"];
        values = [
          `Forza tagliante: T = ${T.toFixed(2)} N`,
          `Braccio: L = ${L.toFixed(2)} mm`,
          `Momento flettente: Mf = ${Mf.toFixed(2)} Nmm`,
          `Tensione di flessione: σf = ${sigmaF.toFixed(2)} MPa`,
        ];
      }

      if (type === "torsione") {
        tauT = Mt / section.Wt;
        sigmaVM = Math.sqrt(3) * Math.abs(tauT);
        sigmaTresca = 2 * Math.abs(tauT);
        safetyFactor = Re / sigmaVM;
        title = "Verifica a torsione";
        scheme = "Sezione sollecitata da momento torcente.";
        formulas = ["Wt = modulo resistente a torsione", "τt = Mt / Wt", "σVM = √3 · τt", "n = Re / σVM"];
        values = [
          `Momento torcente: Mt = ${Mt.toFixed(2)} Nmm`,
          `Tensione tangenziale di torsione: τt = ${tauT.toFixed(2)} MPa`,
          `Tensione equivalente Von Mises: σVM = ${sigmaVM.toFixed(2)} MPa`,
        ];
        notes.push("Per alberi con cave linguetta o spallamenti applicare coefficienti di intaglio.");
      }

      if (
        type === "flessione_torsione" ||
        type === "flessione_taglio" ||
        type === "trazione_flessione" ||
        type === "trazione_torsione" ||
        type === "generale"
      ) {
        sigmaN = N / section.A;
        sigmaF = Mf / section.Wf;
        tauT = Mt / section.Wt;
        tauV = section.shearFactor * T / section.A;

        const useAxial = type === "trazione_flessione" || type === "trazione_torsione" || type === "generale";
        const useBending = type === "flessione_torsione" || type === "flessione_taglio" || type === "trazione_flessione" || type === "generale";
        const useTorsion = type === "flessione_torsione" || type === "trazione_torsione" || type === "generale";
        const useShear = type === "flessione_taglio" || type === "generale";

        sigmaTot = (useAxial ? sigmaN : 0) + (useBending ? sigmaF : 0);
        tauTot = Math.sqrt((useTorsion ? tauT : 0) ** 2 + (useShear ? tauV : 0) ** 2);

        sigmaVM = Math.sqrt(sigmaTot ** 2 + 3 * tauTot ** 2);
        sigmaTresca = Math.sqrt(sigmaTot ** 2 + 4 * tauTot ** 2);
        safetyFactor = Re / sigmaVM;

        const titles: Record<string, string> = {
          flessione_torsione: "Verifica composta: flessione + torsione",
          flessione_taglio: "Verifica composta: flessione + taglio",
          trazione_flessione: "Verifica composta: trazione/compressione + flessione",
          trazione_torsione: "Verifica composta: trazione/compressione + torsione",
          generale: "Verifica generale: assiale + flessione + torsione + taglio",
        };

        title = titles[type];
        scheme = "Sollecitazioni combinate sulla stessa sezione. Verifica equivalente con Von Mises e confronto indicativo con Tresca.";
        formulas = [
          "σN = N / A",
          "σf = Mf / Wf",
          "τt = Mt / Wt",
          "τV = k · T / A",
          "σtot = σN + σf",
          "τtot = √(τt² + τV²)",
          "σVM = √(σtot² + 3τtot²)",
          "σTresca ≈ √(σtot² + 4τtot²)",
          "n = Re / σVM",
        ];
        values = [
          `Carico assiale: N = ${N.toFixed(2)} N`,
          `Forza tagliante: T = ${T.toFixed(2)} N`,
          `Braccio: L = ${L.toFixed(2)} mm`,
          `Momento flettente usato: Mf = ${Mf.toFixed(2)} Nmm`,
          `Momento torcente: Mt = ${Mt.toFixed(2)} Nmm`,
          `σN = ${sigmaN.toFixed(2)} MPa`,
          `σf = ${sigmaF.toFixed(2)} MPa`,
          `τt = ${tauT.toFixed(2)} MPa`,
          `τV = ${tauV.toFixed(2)} MPa`,
          `σtot usata = ${sigmaTot.toFixed(2)} MPa`,
          `τtot usata = ${tauTot.toFixed(2)} MPa`,
          `Von Mises: σVM = ${sigmaVM.toFixed(2)} MPa`,
          `Tresca indicativo: σTresca = ${sigmaTresca.toFixed(2)} MPa`,
        ];
        notes.push("Per alberi reali considera anche intagli, cava linguetta, fatica e diametri normalizzati.");
      }

      if (type === "pressione_interna") {
        const pBar = toNumber(quickCalcForm.pressure);
        const p = pBar * 0.1;
        const r = toNumber(quickCalcForm.radius);
        const sp = toNumber(quickCalcForm.thickness);

        if (pBar <= 0 || r <= 0 || sp <= 0) {
          throw new Error("Per la pressione interna inserisci p [bar], raggio medio r [mm] e spessore s [mm].");
        }

        const sigmaCirc = p * r / sp;
        const sigmaLong = p * r / (2 * sp);

        sigmaVM = Math.sqrt(sigmaCirc ** 2 - sigmaCirc * sigmaLong + sigmaLong ** 2);
        sigmaTresca = Math.max(Math.abs(sigmaCirc - sigmaLong), Math.abs(sigmaCirc), Math.abs(sigmaLong));
        safetyFactor = Re / sigmaVM;

        title = "Verifica recipiente cilindrico in pressione";
        scheme = "Guscio cilindrico sottile con pressione interna. Formula valida come stima se s << r.";
        formulas = [
          "p[MPa] = p[bar] · 0,1",
          "σcirconferenziale = p · r / s",
          "σlongitudinale = p · r / (2s)",
          "σVM = √(σc² - σcσl + σl²)",
          "n = Re / σVM",
        ];
        values = [
          `Pressione: p = ${pBar.toFixed(2)} bar = ${p.toFixed(2)} MPa`,
          `Raggio medio: r = ${r.toFixed(2)} mm`,
          `Spessore: s = ${sp.toFixed(2)} mm`,
          `σ circonferenziale = ${sigmaCirc.toFixed(2)} MPa`,
          `σ longitudinale = ${sigmaLong.toFixed(2)} MPa`,
          `Von Mises: σVM = ${sigmaVM.toFixed(2)} MPa`,
          `Tresca indicativo: σTresca = ${sigmaTresca.toFixed(2)} MPa`,
        ];
        notes.push("Per recipienti reali considera saldature, fondi, aperture, normative e coefficienti di sicurezza specifici.");
      }

      if (type === "stato_piano") {
        const sx = toNumber(quickCalcForm.sigmaX);
        const sy = toNumber(quickCalcForm.sigmaY);
        const txy = toNumber(quickCalcForm.tauXY);

        const center = (sx + sy) / 2;
        const radius = Math.sqrt(((sx - sy) / 2) ** 2 + txy ** 2);
        const s1 = center + radius;
        const s2 = center - radius;
        const s3 = 0;

        sigmaVM = Math.sqrt(sx ** 2 - sx * sy + sy ** 2 + 3 * txy ** 2);
        sigmaTresca = Math.max(Math.abs(s1 - s2), Math.abs(s1 - s3), Math.abs(s2 - s3));
        safetyFactor = Re / sigmaVM;

        title = "Stato piano di tensione";
        scheme = "Calcolo tensioni principali, taglio massimo, Von Mises e Tresca da σx, σy, τxy.";
        formulas = [
          "σ1,2 = (σx+σy)/2 ± √[((σx-σy)/2)² + τxy²]",
          "τmax = √[((σx-σy)/2)² + τxy²]",
          "σVM = √(σx² - σxσy + σy² + 3τxy²)",
          "σTresca = max(|σ1-σ2|, |σ1|, |σ2|)",
          "n = Re / σVM",
        ];
        values = [
          `σx = ${sx.toFixed(2)} MPa`,
          `σy = ${sy.toFixed(2)} MPa`,
          `τxy = ${txy.toFixed(2)} MPa`,
          `σ1 = ${s1.toFixed(2)} MPa`,
          `σ2 = ${s2.toFixed(2)} MPa`,
          `τmax = ${radius.toFixed(2)} MPa`,
          `Von Mises: σVM = ${sigmaVM.toFixed(2)} MPa`,
          `Tresca: σTresca = ${sigmaTresca.toFixed(2)} MPa`,
        ];
      }

      if (type === "fatica") {
        const sMax = toNumber(quickCalcForm.sigmaMax);
        const sMin = toNumber(quickCalcForm.sigmaMin);
        const SnInput = toNumber(quickCalcForm.fatigueLimit);
        const Sn = SnInput > 0 ? SnInput : 0.5 * Rm;

        const sm = (sMax + sMin) / 2;
        const sa = Math.abs(sMax - sMin) / 2;

        const denominator = sa / Sn + Math.max(sm, 0) / Rm;
        safetyFactor = denominator > 0 ? 1 / denominator : 999;
        sigmaVM = sa;
        sigmaTresca = undefined;

        title = "Verifica a fatica semplificata";
        scheme = "Verifica tipo Goodman con tensione media e alternata. Valida come controllo preliminare.";
        formulas = [
          "σm = (σmax + σmin) / 2",
          "σa = |σmax - σmin| / 2",
          "Sn ≈ 0,5 · Rm se non inserito",
          "1/n = σa/Sn + σm/Rm",
        ];
        values = [
          `σmax = ${sMax.toFixed(2)} MPa`,
          `σmin = ${sMin.toFixed(2)} MPa`,
          `σm = ${sm.toFixed(2)} MPa`,
          `σa = ${sa.toFixed(2)} MPa`,
          `Rm = ${Rm.toFixed(2)} MPa`,
          `Sn usato = ${Sn.toFixed(2)} MPa`,
          `Coefficiente a fatica: n = ${safetyFactor.toFixed(2)}`,
        ];
        notes.push("Per fatica reale correggere Sn con rugosità, dimensione, affidabilità, tipo di sollecitazione e intaglio.");
      }

      if (!Number.isFinite(sigmaVM) || sigmaVM <= 0) {
        throw new Error("La tensione calcolata è nulla o non valida. Inserisci carichi/momenti coerenti con il tipo di verifica scelto.");
      }

      const outcome = safetyFactor >= nRequired ? "OK" : "NON OK";

      const materialText = material
        ? `${material.name} (${material.en})`
        : `${quickCalcForm.material} non trovato: usati valori indicativi Re = ${Re} MPa, Rm = ${Rm} MPa`;

      setQuickCalcResult({
        title,
        scheme,
        section: section.name,
        formulas,
        sectionValues: [
          `Materiale usato: ${materialText}`,
          `Re/Rp0.2 usato: ${Re.toFixed(2)} MPa`,
          `Rm usato: ${Rm.toFixed(2)} MPa`,
          ...section.values,
        ],
        values: [
          ...values,
          `Tensione equivalente finale: ${sigmaVM.toFixed(2)} MPa`,
          `Coefficiente di sicurezza richiesto: n_req = ${nRequired.toFixed(2)}`,
          `Coefficiente di sicurezza calcolato: n = ${safetyFactor.toFixed(2)}`,
        ],
        equivalentStress: sigmaVM,
        trescaStress: sigmaTresca,
        safetyFactor,
        outcome,
        notes,
      });
    } catch (error: any) {
      setQuickCalcResult({
        title: "Errore nei dati inseriti",
        scheme: "Il modulo non riesce a completare la verifica perché uno o più dati non sono coerenti.",
        section: "Non calcolata",
        formulas: [],
        sectionValues: [],
        values: [],
        equivalentStress: 0,
        safetyFactor: 0,
        outcome: "NON OK",
        notes: [error?.message || "Controlla i dati inseriti e riprova."],
      });
    }
  };

  const handleDrawingReviewUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImg = isImageFile(file);
    const isPdf = isPdfFile(file);

    if (!isImg && !isPdf) {
      alert("Carica un'immagine (PNG, JPG, JPEG, WebP) oppure un PDF della tavola.");
      event.target.value = "";
      return;
    }

    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);

    setDrawingResults([]);
    setDrawingIssues([]);

    if (isPdf) {
      setDrawingAiLoading(true);
      try {
        const { dataUrl, jpegFile, totalPages } = await pdfPageToImageFile(file);
        setDrawingReviewFile({ file, fileAttachment: makeAttachment(file), previewUrl: dataUrl, convertedFile: jpegFile, isPdf: true, totalPages });
      } catch {
        alert("Errore nella conversione del PDF. Prova con un altro file.");
      } finally {
        setDrawingAiLoading(false);
      }
    } else {
      setDrawingReviewFile({ file, fileAttachment: makeAttachment(file), previewUrl: URL.createObjectURL(file) });
    }

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

    if (isDrawingUpload(drawingReviewFile)) {
      setDrawingAiLoading(true);
      setDrawingResults([]);
      setDrawingIssues([]);

      try {
        const fileToSend = drawingReviewFile!.convertedFile ?? drawingReviewFile!.file;
        const formData = new FormData();

        formData.append(
          "message",
          `Sei un esperto di disegno tecnico meccanico secondo le norme ISO 128, ISO 1101 e ISO 286.
Analizza con MASSIMA PRECISIONE questa tavola tecnica. Leggi ogni quota, simbolo e annotazione visibile.

DATI DEL PEZZO FORNITI DALL'UTENTE:
- Nome pezzo: ${f.partName || "non indicato"}
- Tipo pezzo: ${f.partType || "non indicato"}
- Materiale: ${f.material || "non indicato"}
- Quantità/lotto: ${f.productionQuantity || "non indicato"}
- Lavorazione prevista: ${f.manufacturing || "non indicata"}
- Geometrie principali: ${f.mainFeatures || "non indicate"}
- Funzione nell'assieme: ${f.assemblyFunction || "non indicata"}
- Superfici funzionali: ${f.functionalSurfaces || "non indicate"}
- Fori/filetti/lamature: ${f.holesThreads || "non indicati"}
- Accoppiamenti/tolleranze: ${f.fits || f.tolerances || "non indicati"}
- Rugosità: ${f.roughness || "non indicate"}

COSA DEVI CONTROLLARE:
1. CARTIGLIO: nome pezzo, numero disegno, materiale, scala, data, revisione, autore.
2. VISTE E SEZIONI: viste sufficienti, sezioni A-A/B-B, linee di taglio.
3. QUOTATURA: cita quote leggibili, quote mancanti, duplicate o in conflitto.
4. TOLLERANZE DIMENSIONALI: ISO visibili, coerenza con funzione.
5. TOLLERANZE GEOMETRICHE: simboli GD&T e datum.
6. RUGOSITÀ: simboli Ra/Rz visibili.
7. FILETTI E FORI: designazioni, profondità, lamature.
8. TRATTAMENTI E MATERIALE.
9. ERRORI CRITICI.

Rispondi SOLO con quanto vedi realmente. Se non è leggibile, dillo.

Struttura:
## 1. Cartiglio
## 2. Viste e sezioni
## 3. Quotatura
## 4. Tolleranze dimensionali
## 5. Tolleranze geometriche
## 6. Rugosità
## 7. Filetti e fori
## 8. Materiale e trattamenti
## 9. Errori critici e correzioni prioritarie
## 10. Giudizio finale (Approvata / Da correggere / Non producibile)`
        );
        formData.append("file", fileToSend);
        formData.append("profile", JSON.stringify({ userName: user.name, focus: interest }));
        formData.append("messages", JSON.stringify([]));

        const headers = await buildApiHeaders();
        if (!headers) throw new Error("Sessione scaduta. Effettua di nuovo il login oppure entra come ospite.");

        const res = await fetch("/api/chat", { method: "POST", headers, body: formData });
        const raw = await res.text();
        const data = safeParseJson<any>(raw, null);

        if (res.status === 403 && data?.error === "Limite AI raggiunto") {
          throw new Error(`Limite AI raggiunto (${data.used}/${data.limit} richieste). Upgrada al piano Pro per continuare.`);
        }

        if (res.status === 403 && data?.error === "Limite file ospite raggiunto") {
          throw new Error(`Limite caricamento file ospite raggiunto (${data.fileUsed}/${data.fileLimit} file usati). Come ospite puoi caricare massimo 1 file ogni 24 ore.`);
        }

        if (res.status === 403 && data?.error === "Limite ospite raggiunto") {
          throw new Error(`Limite ospite raggiunto (${data.used}/${data.limit} richieste). Come ospite puoi fare massimo 10 richieste ogni 24 ore. Accedi o registrati per continuare.`);
        }

        if (!res.ok) throw new Error(data?.error || raw || `Errore HTTP ${res.status}`);

        const answer = data?.answer || data?.message || raw || "Nessuna risposta ricevuta dall'analisi immagine.";
        syncGuestUsageFromBackend(data);

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

    if (!f.functionalSurfaces.trim()) issues.push({ id: "funzionali", label: "Superfici funzionali", severity: "errore", x: 24, y: 28, detail: "Mancano superfici funzionali: indica sedi, appoggi, scorrimenti, battute o riferimenti." });
    if (!f.tolerances.trim() && !f.fits.trim()) issues.push({ id: "tolleranze", label: "Tolleranze", severity: "errore", x: 66, y: 35, detail: "Mancano tolleranze o accoppiamenti sulle quote importanti." });
    if (!f.roughness.trim()) issues.push({ id: "rugosita", label: "Rugosità", severity: "attenzione", x: 44, y: 62, detail: "Manca rugosità generale o specifica sulle superfici funzionali." });
    if (!f.material.trim() || !f.manufacturing.trim()) issues.push({ id: "cartiglio", label: "Cartiglio", severity: "attenzione", x: 78, y: 78, detail: "Controlla materiale, lavorazione, trattamento, scala, unità e note generali nel cartiglio." });
    if (text.includes("foro") || text.includes("filett") || text.includes("lamatura")) issues.push({ id: "fori", label: "Fori/filetti", severity: "info", x: 58, y: 22, detail: "Verifica diametri, profondità, posizioni, lamature/svasature e tolleranze dei fori." });
    if (issues.length === 0) issues.push({ id: "ok", label: "Controllo base OK", severity: "info", x: 50, y: 50, detail: "Non emergono mancanze principali dai dati inseriti." });

    results.push(
      { category: "Viste", status: "✅ Necessaria", item: "Vista principale", reason: "Serve per mostrare la forma più riconoscibile e le quote principali.", suggestion: "Scegli la vista più rappresentativa del pezzo." },
      { category: "Sezioni", status: "🟦 Consigliata", item: "Sezione A-A", reason: "Utile se ci sono fori, cave, lamature o geometrie interne.", suggestion: "Aggiungi sezioni solo dove chiariscono dettagli nascosti." },
      { category: "Quote", status: "⚠️ Da verificare", item: "Quote funzionali", reason: "Le quote devono descrivere funzione e producibilità, non solo ingombri.", suggestion: "Evita catene chiuse e quota da riferimenti funzionali." },
      { category: "Cartiglio", status: f.material.trim() ? "⚠️ Da verificare" : "❌ Mancante", item: "Materiale/note", reason: f.material.trim() ? `Materiale indicato: ${f.material}.` : "Materiale non indicato.", suggestion: "Riporta materiale, trattamento, scala, unità, tolleranze generali e note." }
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
        <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || (!query.trim() && !pendingFile)} type="button">➤</button>
      </div>
    </div>
  );

  const renderLoginCard = () => {
    const isRegister = authMode === "register";
    const inputStyle = { ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` };
    const tabBase: React.CSSProperties = { flex: 1, padding: "8px 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 15, borderRadius: 10, transition: "background 0.2s" };

    return (
      <div className="slide-in" style={{ ...s.loginCard, position: "relative", background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }}>
        <button
          type="button"
          onClick={() => showLoginPanel ? setShowLoginPanel(false) : setLoginDismissed(true)}
          style={{ position: "absolute", top: 14, right: 14, background: "transparent", border: "none", cursor: "pointer", fontSize: 22, lineHeight: 1, color: theme.text, opacity: 0.5, padding: 4 }}
        >✕</button>

        <h1>TECH<span style={{ color: theme.primary }}>AI</span></h1>

        <div style={{ display: "flex", gap: 6, marginBottom: 22, background: isDark ? "#1a1a1a" : "#f2f2f2", borderRadius: 12, padding: 4 }}>
          <button style={{ ...tabBase, background: !isRegister ? theme.primary : "transparent", color: !isRegister ? "#fff" : theme.text }} onClick={() => { setAuthMode("login"); setLoginError(""); }} type="button">Accedi</button>
          <button style={{ ...tabBase, background: isRegister ? theme.primary : "transparent", color: isRegister ? "#fff" : theme.text }} onClick={() => { setAuthMode("register"); setLoginError(""); }} type="button">Registrati</button>
        </div>

        {isRegister && <Field label="Nome" value={loginName} onChange={setLoginName} placeholder="Il tuo nome" theme={theme} isDark={isDark} />}
        <Field label="Email" value={loginEmail} onChange={setLoginEmail} placeholder="email@esempio.com" theme={theme} isDark={isDark} />

        <label style={s.label}>Password</label>
        <input style={inputStyle} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} type="password" placeholder={isRegister ? "Minimo 6 caratteri" : ""} />

        {loginError && <div style={{ ...s.errorBox, color: loginError.startsWith("Registrazione") ? "#22c55e" : undefined }}>{loginError}</div>}

        <button style={{ ...s.primaryBtn, background: theme.primary, opacity: authLoading ? 0.7 : 1 }} onClick={isRegister ? handleRegister : handleLogin} disabled={authLoading} type="button">
          {authLoading ? "Attendere..." : isRegister ? "Crea account" : "Accedi"}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "14px 0 2px" }}>
          <div style={{ flex: 1, height: 1, background: theme.border }} />
          <span style={{ fontSize: 12, color: theme.text, opacity: 0.4, whiteSpace: "nowrap" }}>oppure</span>
          <div style={{ flex: 1, height: 1, background: theme.border }} />
        </div>

        <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}`, fontSize: 14, opacity: 0.75 }} onClick={handleGuestAccess} type="button">
          Continua come ospite · {Math.max(GUEST_LIMIT - guestUsed, 0)}/{GUEST_LIMIT} richieste rimaste nelle 24h
        </button>
      </div>
    );
  };

  const renderQuickCalcLoadInputs = () => {
    const type = quickCalcForm.verificationType;

    if (type === "pressione_interna") {
      return (
        <div style={s.checklistGrid}>
          <Field label="Pressione p [bar]" value={quickCalcForm.pressure} onChange={v => updateQuickCalcField("pressure", v)} placeholder="30" theme={theme} isDark={isDark} />
          <Field label="Raggio medio r [mm]" value={quickCalcForm.radius} onChange={v => updateQuickCalcField("radius", v)} placeholder="150" theme={theme} isDark={isDark} />
          <Field label="Spessore s [mm]" value={quickCalcForm.thickness} onChange={v => updateQuickCalcField("thickness", v)} placeholder="4" theme={theme} isDark={isDark} />
        </div>
      );
    }

    if (type === "stato_piano") {
      return (
        <div style={s.checklistGrid}>
          <Field label="σx [MPa]" value={quickCalcForm.sigmaX} onChange={v => updateQuickCalcField("sigmaX", v)} placeholder="80" theme={theme} isDark={isDark} />
          <Field label="σy [MPa]" value={quickCalcForm.sigmaY} onChange={v => updateQuickCalcField("sigmaY", v)} placeholder="20" theme={theme} isDark={isDark} />
          <Field label="τxy [MPa]" value={quickCalcForm.tauXY} onChange={v => updateQuickCalcField("tauXY", v)} placeholder="30" theme={theme} isDark={isDark} />
        </div>
      );
    }

    if (type === "fatica") {
      return (
        <div style={s.checklistGrid}>
          <Field label="σmax [MPa]" value={quickCalcForm.sigmaMax} onChange={v => updateQuickCalcField("sigmaMax", v)} placeholder="180" theme={theme} isDark={isDark} />
          <Field label="σmin [MPa]" value={quickCalcForm.sigmaMin} onChange={v => updateQuickCalcField("sigmaMin", v)} placeholder="20" theme={theme} isDark={isDark} />
          <Field label="Sn limite fatica [MPa]" value={quickCalcForm.fatigueLimit} onChange={v => updateQuickCalcField("fatigueLimit", v)} placeholder="Lascia vuoto per 0,5 Rm" theme={theme} isDark={isDark} />
        </div>
      );
    }

    return (
      <div style={s.checklistGrid}>
        <Field label="Carico assiale N [N]" value={quickCalcForm.axialLoad} onChange={v => updateQuickCalcField("axialLoad", v)} placeholder="0" theme={theme} isDark={isDark} />
        <Field label="Forza tagliante T [N]" value={quickCalcForm.shearLoad} onChange={v => updateQuickCalcField("shearLoad", v)} placeholder="2500" theme={theme} isDark={isDark} />
        <Field label="Braccio L [mm]" value={quickCalcForm.distance} onChange={v => updateQuickCalcField("distance", v)} placeholder="120" theme={theme} isDark={isDark} />
        <Field label="Momento flettente Mf [Nmm]" value={quickCalcForm.bendingMoment} onChange={v => updateQuickCalcField("bendingMoment", v)} placeholder="Vuoto = T·L" theme={theme} isDark={isDark} />
        <Field label="Momento torcente Mt [Nmm]" value={quickCalcForm.torque} onChange={v => updateQuickCalcField("torque", v)} placeholder="80000" theme={theme} isDark={isDark} />
      </div>
    );
  };

  const renderQuickCalcSectionInputs = () => {
    if (quickCalcForm.sectionType === "circolare_piena") {
      return (
        <div style={s.checklistGrid}>
          <Field label="Diametro d [mm]" value={quickCalcForm.diameter} onChange={v => updateQuickCalcField("diameter", v)} placeholder="25" theme={theme} isDark={isDark} />
        </div>
      );
    }

    if (quickCalcForm.sectionType === "circolare_cava") {
      return (
        <div style={s.checklistGrid}>
          <Field label="Diametro esterno D [mm]" value={quickCalcForm.outerDiameter} onChange={v => updateQuickCalcField("outerDiameter", v)} placeholder="40" theme={theme} isDark={isDark} />
          <Field label="Diametro interno d [mm]" value={quickCalcForm.innerDiameter} onChange={v => updateQuickCalcField("innerDiameter", v)} placeholder="25" theme={theme} isDark={isDark} />
        </div>
      );
    }

    if (quickCalcForm.sectionType === "rettangolare_piena") {
      return (
        <div style={s.checklistGrid}>
          <Field label="Base b [mm]" value={quickCalcForm.base} onChange={v => updateQuickCalcField("base", v)} placeholder="30" theme={theme} isDark={isDark} />
          <Field label="Altezza h [mm]" value={quickCalcForm.height} onChange={v => updateQuickCalcField("height", v)} placeholder="50" theme={theme} isDark={isDark} />
        </div>
      );
    }

    return (
      <div style={s.checklistGrid}>
        <Field label="Base esterna B [mm]" value={quickCalcForm.outerBase} onChange={v => updateQuickCalcField("outerBase", v)} placeholder="60" theme={theme} isDark={isDark} />
        <Field label="Altezza esterna H [mm]" value={quickCalcForm.outerHeight} onChange={v => updateQuickCalcField("outerHeight", v)} placeholder="80" theme={theme} isDark={isDark} />
        <Field label="Base interna b [mm]" value={quickCalcForm.innerBase} onChange={v => updateQuickCalcField("innerBase", v)} placeholder="40" theme={theme} isDark={isDark} />
        <Field label="Altezza interna h [mm]" value={quickCalcForm.innerHeight} onChange={v => updateQuickCalcField("innerHeight", v)} placeholder="60" theme={theme} isDark={isDark} />
      </div>
    );
  };

  return (
    <div style={{ ...s.app, background: theme.bg, color: theme.text }}>
      <style>{globalCss}</style>

      {!isLoggedIn && !showLoginPanel && !loginDismissed && <div style={s.loginScreen}>{renderLoginCard()}</div>}

      <aside style={{ ...s.sidebar, width: sidebarOpen ? 280 : 74, minWidth: sidebarOpen ? 280 : 74, background: isDark ? "#050505" : theme.bg, borderRight: `1px solid ${theme.border}` }}>
        <div style={s.sidebarTop}>
          {sidebarOpen && (
            <div style={s.logoWrap}>
              <div style={{ ...s.logoMark, background: theme.primary }}>T</div>
              <div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div>
            </div>
          )}
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
            {iconBtn("⌘", "Progetti", () => setShowProjects(true))}
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
              {isGuest && <p style={{ ...s.fileHint, color: theme.primary, fontWeight: 800 }}>Modalità ospite attiva · {Math.max(GUEST_LIMIT - guestUsed, 0)}/{GUEST_LIMIT} richieste rimaste nelle 24h · {GUEST_FILE_LIMIT} file ogni 24h</p>}
              {renderInputBar("Chiedi a TechAI o carica un file...")}
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((message, index) => (
                  <div key={index} style={message.role === "utente" ? s.uRow : s.aRow}>
                    {message.role === "AI" && <div style={{ ...s.aiAvatar, background: theme.primary }}>T</div>}
                    <div style={message.role === "utente" ? { ...s.uBox, background: theme.surface, border: `1px solid ${theme.border}` } : { ...s.aBox, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }}>
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

      {showLoginPanel && <div className="fade-in" style={s.overlay}><div style={s.loginModalWrap}>{renderLoginCard()}</div></div>}

      {showChecklist && (
        <Modal title="Checklist tecnica progetto" subtitle="Controllo preliminare automatico per componenti meccanici." theme={theme} isDark={isDark} onClose={() => setShowChecklist(false)} wide>
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
              <textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.notes} onChange={e => updateChecklistField("notes", e.target.value)} placeholder="Smussi, raggi, filetti, trattamenti..." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  style={{ ...s.primaryBtn, background: theme.primary }}
                  onClick={runProjectChecklist}
                  type="button"
                >
                  Esegui checklist
                </button>

                <button
                  style={{
                    ...s.secondaryBtn,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    marginTop: 8,
                  }}
                  onClick={resetChecklist}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <button
                style={{ ...s.secondaryBtn, color: theme.primary, border: `1px solid ${theme.border}` }}
                onClick={saveChecklistToProject}
                type="button"
              >
                Salva checklist nel progetto
              </button>
            </div>

            <div style={s.checklistResultsArea}>
              {checklistResults.length === 0 ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati del pezzo e premi “Esegui checklist”.</div> : checklistResults.map((item, index) => <ResultCard key={index} item={item} theme={theme} isDark={isDark} />)}
            </div>
          </div>
        </Modal>
      )}

      {showQuickCalc && (
        <Modal title="Verifica dimensionale rapida" subtitle="Sollecitazioni semplici, composte, pressione interna, stato piano e fatica." theme={theme} isDark={isDark} onClose={() => setShowQuickCalc(false)} wide>
          <div style={s.quickCalcLayout}>
            <div style={s.checklistFormArea}>
              <div style={s.checklistGrid}>
                <Field label="Tipo componente" value={quickCalcForm.componentType} onChange={v => updateQuickCalcField("componentType", v)} placeholder="Perno, albero, staffa..." theme={theme} isDark={isDark} />

                <div>
                  <label style={s.label}>Tipo verifica</label>
                  <select style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.verificationType} onChange={e => updateQuickCalcField("verificationType", e.target.value)}>
                    <option value="assiale">Trazione / compressione</option>
                    <option value="taglio">Taglio</option>
                    <option value="flessione">Flessione</option>
                    <option value="torsione">Torsione</option>
                    <option value="flessione_torsione">Flessione + torsione</option>
                    <option value="flessione_taglio">Flessione + taglio</option>
                    <option value="trazione_flessione">Trazione/compressione + flessione</option>
                    <option value="trazione_torsione">Trazione/compressione + torsione</option>
                    <option value="generale">Flessione + torsione + taglio + assiale</option>
                    <option value="pressione_interna">Pressione interna recipiente cilindrico</option>
                    <option value="stato_piano">Stato piano di tensione</option>
                    <option value="fatica">Fatica con σmax e σmin</option>
                  </select>
                </div>

                <Field label="Materiale" value={quickCalcForm.material} onChange={v => updateQuickCalcField("material", v)} placeholder="C45" theme={theme} isDark={isDark} />

                <div>
                  <label style={s.label}>Tipo sezione</label>
                  <select style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.sectionType} onChange={e => updateQuickCalcField("sectionType", e.target.value)}>
                    <option value="circolare_piena">Circolare piena</option>
                    <option value="circolare_cava">Circolare cava</option>
                    <option value="rettangolare_piena">Rettangolare piena</option>
                    <option value="rettangolare_cava">Rettangolare cava</option>
                  </select>
                </div>
              </div>

              <h3 style={{ margin: "12px 0", color: theme.primary }}>Dati sezione</h3>
              {renderQuickCalcSectionInputs()}

              <h3 style={{ margin: "12px 0", color: theme.primary }}>Dati carico / tensioni</h3>
              {renderQuickCalcLoadInputs()}

              <Field label="Coefficiente sicurezza richiesto" value={quickCalcForm.safetyFactorRequired} onChange={v => updateQuickCalcField("safetyFactorRequired", v)} placeholder="2" theme={theme} isDark={isDark} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  style={{ ...s.primaryBtn, background: theme.primary }}
                  onClick={runQuickCalc}
                  type="button"
                >
                  Calcola verifica
                </button>

                <button
                  style={{
                    ...s.secondaryBtn,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    marginTop: 8,
                  }}
                  onClick={resetQuickCalc}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <button
                style={{ ...s.secondaryBtn, color: theme.primary, border: `1px solid ${theme.border}` }}
                onClick={saveQuickCalcToProject}
                type="button"
              >
                Salva verifica nel progetto
              </button>
              <div style={{ ...s.warningBox, border: `1px solid ${theme.border}` }}>
                Calcolo preliminare. Per progetto reale controllare norme, intagli, fatica, saldature, vincoli, frecce, instabilità, coefficienti correttivi e dati certificati del materiale.
              </div>
            </div>

            <div style={s.checklistResultsArea}>
              {!quickCalcResult ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati e premi “Calcola verifica”.</div> : <QuickCalcCard result={quickCalcResult} theme={theme} isDark={isDark} />}
            </div>
          </div>
        </Modal>
      )}

      {showMaterials && (
        <Modal title="Libreria materiali" subtitle="Conversioni normative e proprietà meccaniche indicative." theme={theme} isDark={isDark} onClose={() => setShowMaterials(false)} wide>
          <div style={s.materialToolbar}>
            <input style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}`, marginBottom: 0 }} value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} placeholder="Cerca materiale, EN, DIN, AISI, JIS..." />
            <button style={{ ...s.addMaterialBtn, background: theme.primary }} onClick={() => setShowAddMaterial(prev => !prev)} type="button">{showAddMaterial ? "Chiudi" : "+ Aggiungi materiale"}</button>
          </div>

          {showAddMaterial && (
            <div style={{ ...s.addMaterialPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
              <h3 style={{ marginTop: 0 }}>Nuovo materiale personalizzato</h3>
              <p style={s.muted}>Compila i dati che conosci. Gli altri resteranno “Non specificato”.</p>
              <div style={s.addMaterialGrid}>
                {(["name", "key", "en", "uni", "din", "aisi", "jis", "iso", "rm", "re"] as (keyof MaterialInfo)[]).map(field => (
                  <div key={String(field)}>
                    <label style={s.label}>{String(field).toUpperCase()}</label>
                    <input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={(newMaterial as any)[field] || ""} onChange={e => updateNewMaterialField(field, e.target.value)} />
                  </div>
                ))}
              </div>
              {(["hardness", "treatments", "weldability", "machinability", "uses"] as (keyof MaterialInfo)[]).map(field => (
                <div key={String(field)}>
                  <label style={s.label}>{String(field)}</label>
                  <input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={(newMaterial as any)[field] || ""} onChange={e => updateNewMaterialField(field, e.target.value)} />
                </div>
              ))}
              <label style={s.label}>Note</label>
              <textarea style={{ ...s.addMaterialTextarea, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.notes} onChange={e => updateNewMaterialField("notes", e.target.value)} />
              <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={addCustomMaterial} type="button">Salva materiale</button>
            </div>
          )}

          <div style={s.materialGrid}>
            {filteredMaterials.map((m: MaterialInfo) => {
              const isCustom = customMaterials.some(item => item.key === m.key);
              return <MaterialCard key={m.key} material={m} isCustom={isCustom} theme={theme} isDark={isDark} onDelete={() => deleteCustomMaterial(m.key)} />;
            })}
          </div>
        </Modal>
      )}

      {showDrawingGenerator && (
        <Modal title="Generatore tavole tecniche controllate" subtitle="Carica un'immagine della tavola per analisi AI o compila i dati per controllo base." theme={theme} isDark={isDark} onClose={() => setShowDrawingGenerator(false)} wide>
          <div style={s.drawingLayout}>
            <div style={s.checklistFormArea}>
              <input ref={drawingReviewInputRef} type="file" accept=".png,.jpg,.jpeg,.webp,.pdf,image/*,application/pdf" style={{ display: "none" }} onChange={handleDrawingReviewUpload} />
              <div style={{ ...s.drawingUploadPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <strong>Revisione tavola</strong>
                <p style={s.muted}>Carica un'immagine o PDF della tavola. I PDF vengono convertiti automaticamente.</p>
                <div style={s.drawingUploadGridSingle}>
                  <button style={{ ...s.drawingUploadBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => drawingReviewInputRef.current?.click()} type="button">📐 Carica tavola tecnica<small>PNG, JPG, JPEG, WebP, PDF</small></button>
                </div>
                {drawingReviewFile && <FileCard upload={drawingReviewFile} icon={drawingReviewFile.isPdf ? "📄" : "🖼️"} theme={theme} isDark={isDark} onRemove={removeDrawingReviewFile} />}
                {drawingReviewFile?.isPdf && drawingReviewFile.totalPages && <p style={{ ...s.muted, marginTop: 4 }}>PDF · {drawingReviewFile.totalPages} {drawingReviewFile.totalPages === 1 ? "pagina" : "pagine"} · analisi sulla pagina 1</p>}
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
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  style={{ ...s.primaryBtn, background: theme.primary }}
                  onClick={runDrawingGenerator}
                  disabled={drawingAiLoading}
                  type="button"
                >
                  {drawingAiLoading ? "Analisi in corso..." : isDrawingUpload(drawingReviewFile) ? "Analizza tavola con AI" : "Genera controllo tavola"}
                </button>

                <button
                  style={{
                    ...s.secondaryBtn,
                    color: theme.text,
                    border: `1px solid ${theme.border}`,
                    marginTop: 8,
                  }}
                  onClick={resetDrawingGenerator}
                  disabled={drawingAiLoading}
                  type="button"
                >
                  Reset
                </button>
              </div>

              <button
                style={{ ...s.secondaryBtn, color: theme.primary, border: `1px solid ${theme.border}` }}
                onClick={saveDrawingToProject}
                type="button"
              >
                Salva tavola nel progetto
              </button>
            </div>

            <div style={s.checklistResultsArea}>
              <DrawingPreview issues={drawingIssues} previewUrl={drawingReviewFile?.previewUrl} fileName={drawingReviewFile?.fileAttachment.name} theme={theme} isDark={isDark} />
              {drawingResults.length === 0 ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Carica una tavola e premi il pulsante di analisi, oppure compila i dati per il controllo base.</div> : drawingResults.map((item, index) => <DrawingResultCard key={index} item={item} theme={theme} isDark={isDark} renderFormattedText={renderFormattedText} />)}
            </div>
          </div>
        </Modal>
      )}

      {showProjects && (
        <Modal title="Progetti e controlli avanzati" subtitle="Raccogli verifiche, tavole, file, distinte e procedure SolidWorks in un unico progetto." theme={theme} isDark={isDark} onClose={() => setShowProjects(false)} wide>
          <div style={s.projectLayout}>
            <div style={s.projectLeft}>
              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Crea progetto</h3>
                <Field label="Nome progetto" value={newProjectName} onChange={setNewProjectName} placeholder="Es. Rullatrice risana filetti" theme={theme} isDark={isDark} />
                <Field label="Descrizione" value={newProjectDescription} onChange={setNewProjectDescription} placeholder="Cliente, assieme, revisione, obiettivo..." theme={theme} isDark={isDark} />
                <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={() => createProject()} type="button">Crea progetto</button>
              </div>

              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Progetti salvati</h3>
                {projects.length === 0 ? (
                  <div style={s.emptyText}>Nessun progetto creato. Carica un file o premi “Crea progetto”.</div>
                ) : projects.map(project => (
                  <div key={project.id} style={{ ...s.projectListItem, border: `1px solid ${project.id === activeProject?.id ? theme.primary : theme.border}`, background: project.id === activeProject?.id ? "rgba(96,165,250,0.10)" : "transparent" }}>
                    <button style={s.projectListMain} onClick={() => setActiveProjectId(project.id)} type="button">
                      <strong>{project.name}</strong>
                      <span>{project.items.length} elementi · {new Date(project.updatedAt).toLocaleDateString("it-IT")}</span>
                    </button>
                    <button style={s.smallDeleteMaterialBtn} onClick={() => deleteProject(project.id)} type="button">Elimina</button>
                  </div>
                ))}
              </div>

              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Upload intelligente</h3>
                <p style={s.muted}>Carica PDF, STEP/STP, immagini o file tecnici. TechAI crea automaticamente un progetto se non esiste e salva metadata iniziali.</p>
                <input ref={projectFileInputRef} type="file" accept=".pdf,.step,.stp,.txt,.csv,.json,image/*" style={{ display: "none" }} onChange={handleProjectSmartFileUpload} />
                <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => projectFileInputRef.current?.click()} type="button">Carica file progetto</button>
                {projectSmartFile && (
                  <div style={{ ...s.projectMiniCard, border: `1px solid ${theme.border}` }}>
                    <strong>{projectSmartFile.category}</strong>
                    <span>{projectSmartFile.name} · {projectSmartFile.sizeKb} KB</span>
                    <p>{projectSmartFile.note}</p>
                  </div>
                )}
              </div>
            </div>

            <div style={s.projectRight}>
              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Archivio progetto attivo</h3>
                {!activeProject ? (
                  <div style={s.emptyChecklist}>Seleziona o crea un progetto per rivedere verifiche, tavole, file e distinte salvate.</div>
                ) : (
                  <>
                    <div style={s.projectHeaderCard}>
                      <strong>{activeProject.name}</strong>
                      <span>{activeProject.description || "Nessuna descrizione"}</span>
                    </div>
                    {activeProject.items.length === 0 ? <div style={s.emptyText}>Nessun elemento salvato in questo progetto.</div> : activeProject.items.map(item => (
                      <div key={item.id} style={{ ...s.projectSavedItem, border: `1px solid ${theme.border}`, background: isDark ? "#0b0b0b" : "#ffffff" }}>
                        <div style={s.resultTop}>
                          <strong>{item.title}</strong>
                          <span>{item.type}</span>
                        </div>
                        <p style={s.resultDetail}>{item.summary}</p>
                        <p style={s.muted}>{new Date(item.createdAt).toLocaleString("it-IT")}</p>
                      </div>
                    ))}
                  </>
                )}
              </div>

              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Verifiche serie</h3>
                <div style={s.checklistGrid}>
                  <div>
                    <label style={s.label}>Tipo verifica</label>
                    <select style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={seriousForm.mode} onChange={e => updateSeriousField("mode", e.target.value as any)}>
                      <option value="fatigue">Fatica Goodman/Soderberg</option>
                      <option value="contact">Contatto pressione specifica</option>
                      <option value="bolts">Bulloni precarico/taglio</option>
                    </select>
                  </div>
                  <Field label="Materiale" value={seriousForm.material} onChange={v => updateSeriousField("material", v)} placeholder="C45" theme={theme} isDark={isDark} />
                  <Field label="Rm [MPa]" value={seriousForm.rm} onChange={v => updateSeriousField("rm", v)} placeholder="650" theme={theme} isDark={isDark} />
                  <Field label="Re/Rp0.2 [MPa]" value={seriousForm.re} onChange={v => updateSeriousField("re", v)} placeholder="370" theme={theme} isDark={isDark} />
                </div>

                {seriousForm.mode === "fatigue" && (
                  <div style={s.checklistGrid}>
                    <Field label="Sn [MPa]" value={seriousForm.sn} onChange={v => updateSeriousField("sn", v)} placeholder="260" theme={theme} isDark={isDark} />
                    <Field label="σmax [MPa]" value={seriousForm.sigmaMax} onChange={v => updateSeriousField("sigmaMax", v)} placeholder="180" theme={theme} isDark={isDark} />
                    <Field label="σmin [MPa]" value={seriousForm.sigmaMin} onChange={v => updateSeriousField("sigmaMin", v)} placeholder="20" theme={theme} isDark={isDark} />
                  </div>
                )}

                {seriousForm.mode === "contact" && (
                  <div style={s.checklistGrid}>
                    <Field label="Carico normale F [N]" value={seriousForm.normalLoad} onChange={v => updateSeriousField("normalLoad", v)} placeholder="2500" theme={theme} isDark={isDark} />
                    <Field label="Area contatto [mm²]" value={seriousForm.contactArea} onChange={v => updateSeriousField("contactArea", v)} placeholder="120" theme={theme} isDark={isDark} />
                    <Field label="Diametro d [mm]" value={seriousForm.contactDiameter} onChange={v => updateSeriousField("contactDiameter", v)} placeholder="20" theme={theme} isDark={isDark} />
                    <Field label="Lunghezza L [mm]" value={seriousForm.contactLength} onChange={v => updateSeriousField("contactLength", v)} placeholder="15" theme={theme} isDark={isDark} />
                  </div>
                )}

                {seriousForm.mode === "bolts" && (
                  <div style={s.checklistGrid}>
                    <Field label="Classe vite" value={seriousForm.boltClass} onChange={v => updateSeriousField("boltClass", v)} placeholder="8.8" theme={theme} isDark={isDark} />
                    <Field label="Vite" value={seriousForm.boltSize} onChange={v => updateSeriousField("boltSize", v)} placeholder="M8" theme={theme} isDark={isDark} />
                    <Field label="Ares [mm²]" value={seriousForm.boltArea} onChange={v => updateSeriousField("boltArea", v)} placeholder="36.6" theme={theme} isDark={isDark} />
                    <Field label="Numero viti" value={seriousForm.boltCount} onChange={v => updateSeriousField("boltCount", v)} placeholder="4" theme={theme} isDark={isDark} />
                    <Field label="Forza taglio totale [N]" value={seriousForm.shearForce} onChange={v => updateSeriousField("shearForce", v)} placeholder="4000" theme={theme} isDark={isDark} />
                    <Field label="Forza trazione totale [N]" value={seriousForm.tensileForce} onChange={v => updateSeriousField("tensileForce", v)} placeholder="2000" theme={theme} isDark={isDark} />
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runSeriousVerification} type="button">Calcola e salva</button>
                  <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}`, marginTop: 8 }} onClick={resetSeriousVerification} type="button">Reset</button>
                </div>

                {seriousResult && (
                  <div style={{ ...s.resultCard, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }}>
                    <div style={s.resultTop}><strong>{seriousResult.title}</strong><span>{seriousResult.status}</span></div>
                    {seriousResult.rows.map((row, index) => <p key={index} style={s.valueRow}>{row}</p>)}
                    {seriousResult.suggestions.map((row, index) => <p key={index} style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{row}</p>)}
                  </div>
                )}
              </div>

              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Assistente SolidWorks pratico</h3>
                <div>
                  <label style={s.label}>Procedura guidata</label>
                  <select style={{ ...s.input, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={solidWorksTask} onChange={e => setSolidWorksTask(e.target.value)}>
                    <option value="modellare_pezzo">Devo modellare questo pezzo</option>
                    <option value="tubo_piegato">Devo fare un tubo piegato</option>
                    <option value="sottoassieme">Devo creare un sottoassieme</option>
                    <option value="cartiglio">Collegare materiale al cartiglio</option>
                    <option value="step_modificabile">Rendere un file STEP modificabile</option>
                  </select>
                </div>
                <Field label="Note sul caso" value={solidWorksNotes} onChange={setSolidWorksNotes} placeholder="Es. pezzo tornito con cave e fori..." theme={theme} isDark={isDark} />
                <div style={{ ...s.resultCard, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }}>
                  <h3 style={{ marginTop: 0, color: theme.primary }}>{solidWorksGuide.title}</h3>
                  <strong>Metodo consigliato</strong>
                  {solidWorksGuide.method.map((row, i) => <p key={`m-${i}`} style={s.valueRow}>• {row}</p>)}
                  <strong>Comandi SolidWorks in italiano</strong>
                  {solidWorksGuide.commands.map((row, i) => <p key={`c-${i}`} style={s.valueRow}>• {row}</p>)}
                  <strong>Errori comuni</strong>
                  {solidWorksGuide.errors.map((row, i) => <p key={`e-${i}`} style={s.valueRow}>• {row}</p>)}
                  <strong>Quando NON usare questo metodo</strong>
                  {solidWorksGuide.avoid.map((row, i) => <p key={`a-${i}`} style={s.valueRow}>• {row}</p>)}
                </div>
                <button style={{ ...s.secondaryBtn, color: theme.primary, border: `1px solid ${theme.border}` }} onClick={saveSolidWorksGuideToProject} type="button">Salva procedura nel progetto</button>
              </div>

              <div style={{ ...s.projectPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                <h3 style={s.projectTitle}>Controllo distinta CSV/JSON</h3>
                <p style={s.muted}>Controlla codici duplicati, materiali mancanti, quantità incoerenti, norme, viti senza classe e cuscinetti senza sigla.</p>
                <input ref={bomFileInputRef} type="file" accept=".csv,.json,.txt" style={{ display: "none" }} onChange={handleBomFileUpload} />
                <button style={{ ...s.secondaryBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => bomFileInputRef.current?.click()} type="button">Carica distinta CSV/JSON</button>
                <textarea style={{ ...s.checklistTextarea, minHeight: 130, background: isDark ? "#050505" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={bomText} onChange={e => setBomText(e.target.value)} placeholder={'codice;descrizione;materiale;quantita;norma\nP001;vite M8x20;;4;UNI ...'} />
                <button style={{ ...s.primaryBtn, background: theme.primary }} onClick={runBomCheck} type="button">Controlla distinta e salva</button>
                {bomIssues.length > 0 && bomIssues.map((issue, index) => (
                  <div key={index} style={{ ...s.resultCard, background: isDark ? "#0b0b0b" : "#fff", border: `1px solid ${theme.border}` }}>
                    <div style={s.resultTop}><strong>Riga {issue.row}</strong><span>{issue.severity}</span></div>
                    <p style={s.resultDetail}>{issue.message}</p>
                    <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{issue.suggestion}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {showSettings && (
        <div style={s.settingsOverlay}>
          <div style={{ ...s.settingsModal, color: isDark ? "#f8fafc" : "#0f172a" }}>
            <div style={s.settingsSidePanel}>
              <div style={s.settingsTabsArea}>
                {[
                  { key: "Account", icon: "♙", subtitle: "Profilo" },
                  { key: "Aspetto", icon: "◒", subtitle: "Tema" },
                  { key: "AI Focus", icon: "◎", subtitle: "Preferenze" },
                ].map(tab => {
                  const selected = activeTab === tab.key;

                  return (
                    <button
                      key={tab.key}
                      style={{
                        ...s.settingsTabBtn,
                        background: selected ? "rgba(96,165,250,0.16)" : "transparent",
                        color: selected ? "#60a5fa" : "rgba(226,232,240,0.78)",
                        boxShadow: selected ? "inset 3px 0 0 #60a5fa" : "none",
                      }}
                      onClick={() => setActiveTab(tab.key)}
                      type="button"
                    >
                      <span
                        style={{
                          ...s.settingsTabIcon,
                          borderColor: selected ? "rgba(96,165,250,0.62)" : "rgba(148,163,184,0.22)",
                          color: selected ? "#60a5fa" : "rgba(226,232,240,0.72)",
                        }}
                      >
                        {tab.icon}
                      </span>

                      <span style={s.settingsTabText}>
                        <strong>{tab.key}</strong>
                        <small>{tab.subtitle}</small>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div style={s.settingsSideFooter}>
                <div style={s.settingsFooterLine} />
                <div style={s.settingsInfoRow}>
                  <span style={s.settingsInfoIcon}>ⓘ</span>
                  <div>
                    <strong>Impostazioni</strong>
                    <small>Gestisci le tue preferenze</small>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ ...s.settingsMainPanel, background: isDark ? "#101010" : "#f8fbff" }}>
              <button
                style={{ ...s.settingsCloseBtn, color: isDark ? "#e2e8f0" : "#334155" }}
                onClick={() => setShowSettings(false)}
                type="button"
                aria-label="Chiudi impostazioni"
              >
                ×
              </button>

              <div style={s.settingsHeader}>
                <h2 style={s.settingsTitle}>{activeTab}</h2>
                <p style={s.settingsSubtitle}>
                  {activeTab === "Account"
                    ? "Gestisci le informazioni del tuo account."
                    : activeTab === "Aspetto"
                      ? "Scegli il tema grafico dell'interfaccia."
                      : "Imposta l'ambito principale delle risposte AI."}
                </p>
              </div>

              {activeTab === "Account" && (
                <div style={s.settingsContentStack}>
                  <div>
                    <label style={s.settingsLabel}>Nome</label>
                    <div
                      style={{
                        ...s.settingsInputCard,
                        background: isDark ? "#050505" : "rgba(255,255,255,0.9)",
                        border: `1px solid ${isDark ? "#262626" : "#dbe3ee"}`,
                      }}
                    >
                      <span style={s.settingsInputIcon}>♙</span>
                      <input
                        style={{ ...s.settingsInlineInput, color: isDark ? "#f8fafc" : "#1e293b" }}
                        value={user.name}
                        onChange={e => setUser(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Nome utente"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={s.settingsLabel}>Email</label>
                    <div
                      style={{
                        ...s.settingsInputCard,
                        background: isDark ? "#050505" : "rgba(255,255,255,0.9)",
                        border: `1px solid ${isDark ? "#262626" : "#dbe3ee"}`,
                      }}
                    >
                      <span style={s.settingsInputIcon}>✉</span>
                      <input
                        style={{ ...s.settingsInlineInput, color: isDark ? "#f8fafc" : "#1e293b", cursor: "default" }}
                        value={user.email}
                        readOnly
                      />
                    </div>
                  </div>

                  {isGuest && (
                    <div
                      style={{
                        ...s.settingsGuestNotice,
                        background: isDark ? "rgba(245,158,11,0.08)" : "#fffbeb",
                        border: `1px solid ${isDark ? "rgba(245,158,11,0.26)" : "#fde68a"}`,
                      }}
                    >
                      <strong>Modalità ospite attiva</strong>
                      <span>
                        Richieste rimaste: {Math.max(GUEST_LIMIT - guestUsed, 0)}/{GUEST_LIMIT} nelle 24h · massimo {GUEST_FILE_LIMIT} file ogni 24h.
                      </span>
                    </div>
                  )}

                  <button style={s.settingsLogoutBtn} onClick={handleLogout} type="button">
                    <span style={s.settingsLogoutIcon}>↪</span>
                    <strong>{isGuest ? "Esci dalla modalità ospite" : "Logout"}</strong>
                  </button>
                </div>
              )}

              {activeTab === "Aspetto" && (
                <div style={s.settingsThemeGrid}>
                  {THEMES.map(t => {
                    const selected = theme.name === t.name;
                    const optionTextColor =
                      t.name === "Black Red"
                        ? "#ef4444"
                        : t.name === "Black Green"
                          ? "#22c55e"
                          : isDark
                            ? "#f8fafc"
                            : "#1e293b";

                    const optionDotBackground =
                      t.name === "Dark Black"
                        ? "#050505"
                        : t.name === "Black Red"
                          ? "linear-gradient(90deg, #050505 50%, #ef4444 50%)"
                          : t.name === "Black Green"
                            ? "linear-gradient(90deg, #050505 50%, #22c55e 50%)"
                            : t.primary;

                    const optionDotBorder =
                      t.name === "Dark Black" ||
                      t.name === "Black Red" ||
                      t.name === "Black Green"
                        ? "1px solid #cbd5e1"
                        : "none";

                    return (
                      <button
                        key={t.name}
                        style={{
                          ...s.settingsThemeOption,
                          background: isDark ? "#050505" : "rgba(255,255,255,0.9)",
                          color: optionTextColor,
                          border: `1px solid ${selected ? t.primary : isDark ? "#262626" : "#dbe3ee"}`,
                          boxShadow: selected ? `0 18px 35px ${t.primary}24` : "none",
                        }}
                        onClick={() => setTheme(t)}
                        type="button"
                      >
                        <span
                          style={{
                            ...s.themeDot,
                            background: optionDotBackground,
                            border: optionDotBorder,
                          }}
                        />
                        <span>{t.name}</span>
                        {selected && <span style={{ marginLeft: "auto", color: t.primary, fontWeight: 950 }}>✓</span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {activeTab === "AI Focus" && (
                <div style={s.settingsContentStack}>
                  <div>
                    <label style={s.settingsLabel}>Ambito tecnico principale</label>
                    <div
                      style={{
                        ...s.settingsInputCard,
                        background: isDark ? "#050505" : "rgba(255,255,255,0.9)",
                        border: `1px solid ${isDark ? "#262626" : "#dbe3ee"}`,
                      }}
                    >
                      <span style={s.settingsInputIcon}>◎</span>
                      <input
                        style={{ ...s.settingsInlineInput, color: isDark ? "#f8fafc" : "#1e293b" }}
                        value={interest}
                        onChange={e => setInterest(e.target.value)}
                        placeholder="Ingegneria Meccanica"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      ...s.settingsGuestNotice,
                      background: isDark ? "rgba(96,165,250,0.08)" : "#eff6ff",
                      border: `1px solid ${isDark ? "rgba(96,165,250,0.26)" : "#bfdbfe"}`,
                    }}
                  >
                    <strong>Consiglio</strong>
                    <span>Scrivi un ambito specifico, ad esempio: Costruzione di Macchine, Oleodinamica, React/TypeScript, Disegno tecnico.</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
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

function ResultCard({ item, theme, isDark }: { item: ChecklistResult; theme: Theme; isDark: boolean }) {
  return (
    <div style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
      <div style={s.resultTop}><strong>{item.area}</strong><span>{item.status}</span></div>
      <p style={s.resultDetail}>{item.detail}</p>
      <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
    </div>
  );
}

function QuickCalcCard({ result, theme, isDark }: { result: QuickCalcResult; theme: Theme; isDark: boolean }) {
  const isOk = result.outcome === "OK";
  const outcomeColor = isOk ? "#22c55e" : "#ef4444";
  const softOutcomeBg = isOk ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)";

  const getNumberFromText = (text: string) => {
    const matches = text.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length === 0) return null;
    const value = Number(matches[matches.length - 1].replace(",", "."));
    return Number.isFinite(value) ? value : null;
  };

  const findNumberInRows = (rows: string[], patterns: RegExp[]) => {
    const row = rows.find(value => patterns.some(pattern => pattern.test(value)));
    return row ? getNumberFromText(row) : null;
  };

  const diameterValue =
    findNumberInRows(result.sectionValues || [], [/diametro/i, /\bd\b/i]) ??
    findNumberInRows(result.values || [], [/diametro/i, /\bd\b/i]);

  const requiredSafety =
    findNumberInRows(result.values || [], [/n richiesto/i, /n_req/i, /coefficiente.*richiesto/i]) ?? 2;

  const suggestedDiameter =
    !isOk && diameterValue && result.safetyFactor > 0
      ? diameterValue * Math.pow(requiredSafety / result.safetyFactor, 1 / 3)
      : null;

  const normalizedSuggestedDiameter =
    suggestedDiameter !== null
      ? Math.ceil(suggestedDiameter / 2) * 2
      : null;

  const loadRows = result.values.filter(value =>
    /carico|forza|braccio|momento/i.test(value)
  );

  const stressRows = result.values.filter(value =>
    /σ|sigma|τ|tau|von mises|tresca|tensione equivalente|mpa/i.test(value)
  );

  const safetyRows = result.values.filter(value =>
    /coefficiente|sicurezza|n_req|n =|n richiesto/i.test(value)
  );

  const otherRows = result.values.filter(value =>
    !loadRows.includes(value) &&
    !stressRows.includes(value) &&
    !safetyRows.includes(value)
  );

  const beautifyFormula = (formula: string) => {
    return formula
      .replaceAll("sigma", "σ")
      .replaceAll("tau", "τ")
      .replaceAll("sqrt", "√")
      .replaceAll("pi", "π")
      .replaceAll("*", "·")
      .replaceAll("sigmaN", "σN")
      .replaceAll("sigmaf", "σf")
      .replaceAll("sigmaVM", "σVM")
      .replaceAll("taut", "τt")
      .replaceAll("tauV", "τV")
      .replaceAll("sigma_tot", "σtot")
      .replaceAll("tau_tot", "τtot");
  };

  const detailSection = (title: string, rows: string[]) => {
    if (!rows || rows.length === 0) return null;

    return (
      <div
        style={{
          ...s.quickDetailSection,
          background: isDark ? "#080808" : "#f8fafc",
          border: `1px solid ${theme.border}`,
        }}
      >
        <h4 style={{ ...s.quickDetailTitle, color: theme.primary }}>{title}</h4>

        <div style={s.quickDetailList}>
          {rows.map((value, index) => (
            <div key={index} style={s.quickDetailRow}>
              <span style={{ ...s.quickDot, background: theme.primary }} />
              <span>{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        ...s.quickResultShell,
        background: isDark ? "#050505" : "#ffffff",
        border: `1px solid ${theme.border}`,
      }}
    >
      <div style={s.quickHero}>
        <div style={s.quickHeroText}>
          <div style={s.quickEyebrow}>Risultato verifica</div>
          <h3 style={s.quickHeroTitle}>{result.title}</h3>
          <p style={s.quickHeroSubtitle}>{result.scheme}</p>
        </div>

        <div
          style={{
            ...s.quickOutcomeBadge,
            background: softOutcomeBg,
            color: outcomeColor,
            border: `1px solid ${outcomeColor}`,
          }}
        >
          {result.outcome}
        </div>
      </div>

      <div style={s.quickMetricsGrid}>
        <div
          style={{
            ...s.quickMetricCard,
            background: softOutcomeBg,
            border: `1px solid ${outcomeColor}`,
          }}
        >
          <span style={s.quickMetricLabel}>Tensione equivalente</span>
          <strong style={{ ...s.quickMetricValue, color: outcomeColor }}>
            {result.equivalentStress.toFixed(2)} MPa
          </strong>
          <span style={s.quickMetricSub}>Valore usato per il confronto</span>
        </div>

        <div
          style={{
            ...s.quickMetricCard,
            background: softOutcomeBg,
            border: `1px solid ${outcomeColor}`,
          }}
        >
          <span style={s.quickMetricLabel}>n calcolato</span>
          <strong style={{ ...s.quickMetricValue, color: outcomeColor }}>
            {result.safetyFactor.toFixed(2)}
          </strong>
          <span style={s.quickMetricSub}>Coefficiente ottenuto</span>
        </div>

        <div
          style={{
            ...s.quickMetricCard,
            background: isDark ? "#0b0b0b" : "#ffffff",
            border: `1px solid ${theme.border}`,
          }}
        >
          <span style={s.quickMetricLabel}>n richiesto</span>
          <strong style={s.quickMetricValue}>
            {requiredSafety.toFixed(2)}
          </strong>
          <span style={s.quickMetricSub}>Valore minimo impostato</span>
        </div>
      </div>

      <div
        style={{
          ...s.quickFinalBanner,
          background: softOutcomeBg,
          border: `1px solid ${outcomeColor}`,
          borderLeft: `6px solid ${outcomeColor}`,
        }}
      >
        <div style={{ ...s.quickFinalIcon, background: outcomeColor }}>
          {isOk ? "✓" : "!"}
        </div>

        <div>
          <h3 style={{ ...s.quickFinalTitle, color: outcomeColor }}>
            Esito finale: {result.outcome}
          </h3>

          <p style={s.quickFinalText}>
            Tensione equivalente = <strong>{result.equivalentStress.toFixed(2)} MPa</strong>.{" "}
            Coefficiente calcolato n = <strong>{result.safetyFactor.toFixed(2)}</strong>.
            {result.trescaStress !== undefined && result.trescaStress > 0 && (
              <>
                {" "}Tresca indicativo = <strong>{result.trescaStress.toFixed(2)} MPa</strong>.
              </>
            )}
          </p>

          {!isOk && (
            <p style={s.quickFinalWarning}>
              La verifica non è soddisfatta: aumenta il diametro, cambia materiale oppure riduci carico e momenti applicati.
            </p>
          )}

          {isOk && (
            <p style={s.quickFinalOk}>
              La verifica preliminare risulta soddisfatta rispetto al coefficiente di sicurezza richiesto.
            </p>
          )}
        </div>
      </div>

          {!isOk && suggestedDiameter !== null && normalizedSuggestedDiameter !== null && (
        <div
          style={{
            ...s.quickSuggestionBox,
            background: isDark ? "#0b0b0b" : "#fff7ed",
            border: `1px solid ${theme.border}`,
            borderLeft: "5px solid #f97316",
          }}
        >
          <div style={s.quickSuggestionHeader}>
            <div>
              <span style={s.quickSuggestionKicker}>Suggerimento automatico</span>
              <h4 style={s.quickSuggestionTitle}>Diametro consigliato</h4>
            </div>

            <span style={s.quickSuggestionBadge}>
              Ø {normalizedSuggestedDiameter.toFixed(0)} mm
            </span>
          </div>

          <div style={s.quickSuggestionGrid}>
            <div style={s.quickSuggestionMiniCard}>
              <span style={s.quickSuggestionMiniLabel}>Attuale</span>
              <strong style={s.quickSuggestionMiniValue}>{diameterValue?.toFixed(2)} mm</strong>
            </div>

            <div style={s.quickSuggestionMiniCard}>
              <span style={s.quickSuggestionMiniLabel}>Minimo stimato</span>
              <strong style={s.quickSuggestionMiniValue}>{suggestedDiameter.toFixed(2)} mm</strong>
            </div>

            <div style={s.quickSuggestionMiniCard}>
              <span style={s.quickSuggestionMiniLabel}>Normalizzato</span>
              <strong style={s.quickSuggestionMiniValue}>{normalizedSuggestedDiameter.toFixed(0)} mm</strong>
            </div>
          </div>

          <p style={s.quickSuggestionNote}>
            Stima preliminare. Riverificare considerando intagli, cave, fatica e diametri normalizzati reali.
          </p>
        </div>
      )}
      
      <div
        style={{
          ...s.quickSectionBadge,
          background: isDark ? "#0b0b0b" : "#f8fafc",
          border: `1px solid ${theme.border}`,
          borderLeft: `5px solid ${theme.primary}`,
        }}
      >
        <span style={s.quickSectionLabel}>Sezione</span>
        <strong style={s.quickSectionValue}>{result.section}</strong>
      </div>
          <div
        style={{
          ...s.quickStepsBox,
          background: isDark ? "#080808" : "#f8fafc",
          border: `1px solid ${theme.border}`,
        }}
      >
        <h4 style={{ ...s.quickDetailTitle, color: theme.primary }}>
          Passaggi di calcolo
        </h4>

        <div style={s.quickStepsList}>
          <div style={s.quickStepItem}>
            <span style={{ ...s.quickStepNumber, background: theme.primary }}>1</span>
            <div>
              <strong>Materiale</strong>
              <p style={s.quickStepText}>
                Vengono letti i dati del materiale selezionato, in particolare Re/Rp0.2 e Rm.
              </p>
            </div>
          </div>

          <div style={s.quickStepItem}>
            <span style={{ ...s.quickStepNumber, background: theme.primary }}>2</span>
            <div>
              <strong>Sezione</strong>
              <p style={s.quickStepText}>
                In base alla sezione scelta vengono calcolati area A, momento d’inerzia Jf, modulo resistente Wf e modulo torsionale Wt.
              </p>
            </div>
          </div>

          <div style={s.quickStepItem}>
            <span style={{ ...s.quickStepNumber, background: theme.primary }}>3</span>
            <div>
              <strong>Sollecitazioni</strong>
              <p style={s.quickStepText}>
                Dai carichi inseriti vengono calcolate le tensioni normali e tangenziali.
              </p>
            </div>
          </div>

          <div style={s.quickStepItem}>
            <span style={{ ...s.quickStepNumber, background: theme.primary }}>4</span>
            <div>
              <strong>Tensione equivalente</strong>
              <p style={s.quickStepText}>
                Le tensioni vengono combinate con Von Mises. Se previsto viene mostrato anche Tresca.
              </p>
            </div>
          </div>

          <div style={s.quickStepItem}>
            <span style={{ ...s.quickStepNumber, background: theme.primary }}>5</span>
            <div>
              <strong>Esito</strong>
              <p style={s.quickStepText}>
                Il coefficiente calcolato viene confrontato con quello richiesto per stabilire OK o NON OK.
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {detailSection("Dati sezione / materiale", result.sectionValues)}
  
      {result.formulas.length > 0 && (
        <div
          style={{
            ...s.quickFormulaSection,
            background: isDark ? "#0b0b0b" : "#f8fafc",
            border: `1px solid ${theme.border}`,
          }}
        >
          <h4 style={{ ...s.quickDetailTitle, color: theme.primary }}>Formule usate</h4>

          <div style={s.quickFormulaGrid}>
            {result.formulas.map((formula, index) => (
              <div
                key={index}
                style={{
                  ...s.quickFormulaChip,
                  background: isDark ? "#050505" : "#ffffff",
                  border: `1px solid ${theme.border}`,
                }}
              >
                {beautifyFormula(formula)}
              </div>
            ))}
          </div>
        </div>
      )}

      {detailSection("Carichi e momenti applicati", loadRows)}
      {detailSection("Risultati tensioni / deformazioni", stressRows)}
      {detailSection("Coefficienti di sicurezza", safetyRows)}
      {detailSection("Altri risultati", otherRows)}

      {result.notes.length > 0 && (
        <div
          style={{
            ...s.quickNotesBox,
            background: isDark ? "#080808" : "#f8fafc",
            border: `1px solid ${theme.border}`,
          }}
        >
          <h4 style={{ ...s.quickDetailTitle, color: theme.primary }}>Note progettuali</h4>

          {result.notes.map((note, index) => (
            <p key={index} style={s.quickNoteText}>
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function MaterialCard({ material: m, isCustom, theme, isDark, onDelete }: { material: MaterialInfo; isCustom: boolean; theme: Theme; isDark: boolean; onDelete: () => void }) {
  return (
    <div style={{ ...s.materialCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
      <div style={s.materialHead}>
        <div>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>{m.name}</h3>
          {isCustom && <span style={s.customTag}>Personalizzato</span>}
        </div>
        {isCustom && <button style={s.smallDeleteMaterialBtn} onClick={onDelete} type="button">Elimina</button>}
      </div>
      <div style={s.materialCodes}>
        <span><strong>EN:</strong> {m.en}</span>
        <span><strong>UNI:</strong> {m.uni}</span>
        <span><strong>DIN:</strong> {m.din}</span>
        <span><strong>AISI/SAE:</strong> {m.aisi}</span>
        <span><strong>JIS:</strong> {m.jis}</span>
        <span><strong>ISO:</strong> {m.iso}</span>
      </div>
      <div style={s.materialProps}><strong>Rm:</strong> {m.rm} MPa · <strong>Re:</strong> {m.re} MPa · <strong>Durezza:</strong> {m.hardness}</div>
      <p><strong>Trattamenti:</strong> {m.treatments}</p>
      <p><strong>Saldabilità:</strong> {m.weldability}</p>
      <p><strong>Lavorabilità:</strong> {m.machinability}</p>
      <p><strong>Impieghi:</strong> {m.uses}</p>
      <p style={{ opacity: 0.72 }}><strong>Nota:</strong> {m.notes}</p>
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

function DrawingResultCard({ item, theme, isDark, renderFormattedText }: { item: DrawingResult; theme: Theme; isDark: boolean; renderFormattedText: (text: string) => React.ReactNode }) {
  return (
    <div style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
      <div style={s.resultTop}><strong>{item.category}: {item.item}</strong><span>{item.status}</span></div>
      <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>{renderFormattedText(item.reason)}</div>
      <p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p>
    </div>
  );
}

function DrawingPreview({ issues, previewUrl, fileName, theme, isDark }: { issues: DrawingIssue[]; previewUrl?: string; fileName?: string; theme: Theme; isDark: boolean }) {
  const badgeColor = issues.length === 0 ? "#64748b" : issues.some(i => i.severity === "errore") ? "#dc2626" : issues.some(i => i.severity === "attenzione") ? "#f59e0b" : "#16a34a";

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
        {previewUrl ? <img src={previewUrl} alt={fileName || "Anteprima tavola"} style={s.realDrawingPreviewImage} /> : <div style={s.noIssuesOverlay}>Nessuna anteprima immagine disponibile</div>}
        {issues.map(issue => (
          <div key={issue.id} title={issue.detail} style={{ ...s.issueMarker, left: `${issue.x}%`, top: `${issue.y}%`, background: issue.severity === "errore" ? "#dc2626" : issue.severity === "attenzione" ? "#f59e0b" : "#16a34a" }}>!</div>
        ))}
      </div>

      <div style={s.issueList}>
        {issues.length === 0 ? <div style={s.emptyText}>Esegui il controllo per vedere gli errori evidenziati.</div> : issues.map(issue => (
          <div key={issue.id} style={s.issueRow}>
            <span style={{ ...s.issueDot, background: issue.severity === "errore" ? "#dc2626" : issue.severity === "attenzione" ? "#f59e0b" : "#16a34a" }} />
            <div><strong>{issue.label}</strong><p>{issue.detail}</p></div>
          </div>
        ))}
      </div>
    </div>
  );
}

const globalCss = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
@keyframes slideInUp { from { opacity: 0; transform: translateY(28px); } to { opacity: 1; transform: translateY(0); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.slide-in { animation: slideInUp 0.32s cubic-bezier(0.16, 1, 0.3, 1) both; }
.fade-in  { animation: fadeIn 0.22s ease both; }
* { font-family: 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif !important; box-sizing: border-box; }
html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
button { font-family: inherit; transition: transform 0.15s ease, opacity 0.15s ease !important; }
button:hover:not(:disabled) { transform: scale(1.05); }
button:active:not(:disabled) { transform: scale(0.97); }
button:disabled { opacity: 0.5; cursor: not-allowed; }
input::placeholder, textarea::placeholder { opacity: 0.55; }
::-webkit-scrollbar { width: 5px; height: 5px; }
::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
`;

const s: Record<string, React.CSSProperties> = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden" },
  loginScreen: { position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "rgba(0,0,0,0.45)" },
  loginCard: { borderRadius: 28, padding: 34, width: "min(520px, calc(100vw - 32px))", boxShadow: "0 30px 90px rgba(0,0,0,0.25)" },
  loginModalWrap: { position: "relative" },
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
  settingsOverlay: {
    position: "fixed",
    inset: 0,
    background: "radial-gradient(circle at 30% 20%, rgba(96,165,250,0.18), transparent 30%), rgba(15,23,42,0.72)",
    backdropFilter: "blur(14px)",
    WebkitBackdropFilter: "blur(14px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: 18,
  },
  settingsModal: {
    width: "min(1180px, calc(100vw - 44px))",
    height: "min(760px, calc(100dvh - 44px))",
    minHeight: 520,
    display: "grid",
    gridTemplateColumns: "310px minmax(0, 1fr)",
    overflow: "hidden",
    borderRadius: 34,
    border: "1px solid rgba(226,232,240,0.38)",
    boxShadow: "0 34px 110px rgba(0,0,0,0.42)",
    background: "rgba(255,255,255,0.92)",
  },
  settingsSidePanel: {
    background: "linear-gradient(180deg, rgba(15,23,42,0.96), rgba(15,23,42,0.985))",
    padding: "38px 28px 30px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    gap: 28,
    borderRight: "1px solid rgba(255,255,255,0.12)",
  },
  settingsTabsArea: { display: "flex", flexDirection: "column", gap: 16 },
  settingsTabBtn: {
    width: "100%",
    minHeight: 74,
    border: "1px solid transparent",
    borderRadius: 16,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "13px 14px",
    textAlign: "left",
  },
  settingsTabIcon: {
    width: 42,
    height: 42,
    minWidth: 42,
    borderRadius: 14,
    border: "1px solid rgba(148,163,184,0.28)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 26,
    lineHeight: 1,
    fontWeight: 900,
  },
  settingsTabText: { display: "flex", flexDirection: "column", gap: 3, fontSize: 17, fontWeight: 900 },
  settingsSideFooter: { marginTop: "auto" },
  settingsFooterLine: { height: 1, background: "rgba(148,163,184,0.2)", marginBottom: 24 },
  settingsInfoRow: { display: "flex", alignItems: "center", gap: 12, color: "rgba(226,232,240,0.76)", fontSize: 13, lineHeight: 1.35 },
  settingsInfoIcon: { width: 26, height: 26, minWidth: 26, borderRadius: "50%", border: "1px solid rgba(148,163,184,0.42)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 },
  settingsMainPanel: {
    position: "relative",
    padding: "58px 68px",
    overflowY: "auto",
    background: "#f8fbff",
  },
  settingsCloseBtn: {
    position: "absolute",
    top: 36,
    right: 38,
    width: 54,
    height: 54,
    borderRadius: "50%",
    border: "1px solid rgba(148,163,184,0.24)",
    background: "rgba(255,255,255,0.72)",
    boxShadow: "0 12px 30px rgba(15,23,42,0.10)",
    cursor: "pointer",
    fontSize: 34,
    lineHeight: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  settingsHeader: { marginBottom: 54, paddingRight: 72 },
  settingsTitle: { margin: 0, fontSize: "clamp(34px, 4vw, 46px)", lineHeight: 1, fontWeight: 950, letterSpacing: -1.4 },
  settingsSubtitle: { margin: "12px 0 0", fontSize: 16, lineHeight: 1.45, color: "#64748b", fontWeight: 650 },
  settingsContentStack: { display: "flex", flexDirection: "column", gap: 26, maxWidth: 720 },
  settingsLabel: { fontSize: 12, fontWeight: 950, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 12, display: "block" },
  settingsInputCard: {
    minHeight: 74,
    borderRadius: 16,
    display: "flex",
    alignItems: "center",
    gap: 18,
    padding: "0 22px",
    boxShadow: "0 14px 32px rgba(15,23,42,0.06)",
  },
  settingsInputIcon: { width: 28, minWidth: 28, color: "#94a3b8", fontSize: 28, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  settingsInlineInput: {
    width: "100%",
    minWidth: 0,
    border: "none",
    outline: "none",
    background: "transparent",
    fontSize: 18,
    fontWeight: 700,
    padding: "14px 0",
  },
  settingsLogoutBtn: {
    position: "relative",
    minHeight: 78,
    width: "100%",
    borderRadius: 16,
    border: "1px solid rgba(239,68,68,0.24)",
    background: "rgba(254,226,226,0.64)",
    color: "#ef4444",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    fontSize: 17,
    fontWeight: 950,
    marginTop: 8,
  },
  settingsLogoutIcon: { position: "absolute", left: 28, fontSize: 31, lineHeight: 1 },
  settingsGuestNotice: { borderRadius: 18, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 5, fontSize: 13, lineHeight: 1.45, color: "#92400e" },
  settingsThemeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, maxWidth: 800 },
  settingsThemeOption: { padding: "15px 16px", minHeight: 60, borderRadius: 16, cursor: "pointer", display: "flex", alignItems: "center", gap: 13, fontSize: 14, fontWeight: 900 },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 12, marginBottom: 14, outline: "none", fontSize: 14 },
  primaryBtn: { width: "100%", padding: 15, border: "none", borderRadius: 14, color: "white", fontWeight: 850, cursor: "pointer", fontSize: 15, marginTop: 8 },
  secondaryBtn: { width: "100%", padding: 13, borderRadius: 14, background: "transparent", fontWeight: 850, cursor: "pointer", marginTop: 10 },
  errorBox: { marginTop: 12, padding: "10px 12px", borderRadius: 12, color: "#b91c1c", background: "#fee2e2", fontSize: 13, fontWeight: 700 },
  checklistLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.9fr) minmax(360px, 1.1fr)", gap: 22, overflow: "hidden" },
  quickCalcLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(390px, 0.95fr) minmax(430px, 1.05fr)", gap: 22, overflow: "hidden" },
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
  quickResultShell: {
  borderRadius: 22,
  padding: 18,
  display: "flex",
  flexDirection: "column",
  gap: 16,
  boxShadow: "0 18px 50px rgba(0,0,0,0.22)",
},

quickHero: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 16,
  paddingBottom: 14,
  borderBottom: "1px solid rgba(120,120,120,0.18)",
},

quickHeroText: {
  minWidth: 0,
  flex: 1,
},

quickEyebrow: {
  fontSize: 11,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 0.8,
  opacity: 0.55,
  marginBottom: 6,
},

quickHeroTitle: {
  margin: 0,
  fontSize: 19,
  lineHeight: 1.2,
  fontWeight: 950,
  letterSpacing: -0.4,
},

quickHeroSubtitle: {
  margin: "8px 0 0",
  fontSize: 13,
  lineHeight: 1.55,
  opacity: 0.72,
},

quickOutcomeBadge: {
  flexShrink: 0,
  minWidth: 92,
  minHeight: 38,
  borderRadius: 999,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 950,
  letterSpacing: 0.4,
  padding: "8px 13px",
},

quickMetricsGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 10,
},

quickMetricCard: {
  borderRadius: 18,
  padding: "14px 14px 13px",
  minHeight: 98,
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  gap: 8,
},

quickMetricLabel: {
  fontSize: 11,
  fontWeight: 900,
  textTransform: "uppercase",
  opacity: 0.58,
  lineHeight: 1.25,
},

quickMetricValue: {
  fontSize: 22,
  lineHeight: 1.05,
  fontWeight: 950,
  letterSpacing: -0.6,
},

quickMetricSub: {
  fontSize: 11,
  lineHeight: 1.3,
  opacity: 0.55,
},

quickFinalBanner: {
  borderRadius: 20,
  padding: 16,
  display: "flex",
  alignItems: "flex-start",
  gap: 13,
},

quickFinalIcon: {
  width: 32,
  height: 32,
  minWidth: 32,
  borderRadius: "50%",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontWeight: 950,
  fontSize: 18,
  marginTop: 2,
},

quickFinalTitle: {
  margin: 0,
  fontSize: 18,
  lineHeight: 1.2,
  fontWeight: 950,
},

quickFinalText: {
  margin: "7px 0 0",
  fontSize: 14,
  lineHeight: 1.55,
  fontWeight: 700,
},

quickFinalWarning: {
  margin: "9px 0 0",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 750,
  opacity: 0.86,
},

quickFinalOk: {
  margin: "9px 0 0",
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 750,
  opacity: 0.86,
},

quickSectionBadge: {
  borderRadius: 18,
  padding: "13px 15px",
  display: "flex",
  flexDirection: "column",
  gap: 4,
},

quickDetailSection: {
  borderRadius: 18,
  padding: 15,
},

quickDetailTitle: {
  margin: "0 0 12px",
  fontSize: 14,
  fontWeight: 950,
  letterSpacing: -0.2,
},

quickDetailList: {
  display: "flex",
  flexDirection: "column",
  gap: 8,
},

quickStepsBox: {
  borderRadius: 18,
  padding: 15,
},

quickStepsList: {
  display: "flex",
  flexDirection: "column",
  gap: 12,
},

quickStepItem: {
  display: "grid",
  gridTemplateColumns: "28px 1fr",
  gap: 10,
  alignItems: "flex-start",
  fontSize: 13,
  lineHeight: 1.45,
},

quickStepNumber: {
  width: 24,
  height: 24,
  borderRadius: "50%",
  color: "white",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 12,
  fontWeight: 950,
  marginTop: 2,
},

quickStepText: {
  margin: "4px 0 0",
  fontSize: 13,
  lineHeight: 1.45,
  opacity: 0.78,
},
  
quickDetailRow: {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  fontSize: 13,
  lineHeight: 1.45,
  fontWeight: 650,
},

quickDot: {
  width: 7,
  height: 7,
  borderRadius: "50%",
  marginTop: 7,
  flexShrink: 0,
},

quickFormulaSection: {
  borderRadius: 18,
  padding: 15,
},

quickFormulaGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
  gap: 8,
},

quickFormulaChip: {
  borderRadius: 13,
  padding: "10px 12px",
  fontSize: 13,
  lineHeight: 1.35,
  fontWeight: 800,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
},

  quickSuggestionBox: {
  borderRadius: 18,
  padding: 14,
  display: "flex",
  flexDirection: "column",
  gap: 12,
},

quickSuggestionHeader: {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 12,
},

quickSuggestionKicker: {
  display: "block",
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  letterSpacing: 0.7,
  color: "#f97316",
  marginBottom: 4,
},

quickSuggestionTitle: {
  margin: 0,
  fontSize: 16,
  lineHeight: 1.2,
  fontWeight: 950,
},

quickSuggestionBadge: {
  flexShrink: 0,
  borderRadius: 999,
  padding: "7px 11px",
  background: "rgba(249,115,22,0.14)",
  color: "#f97316",
  border: "1px solid rgba(249,115,22,0.55)",
  fontSize: 13,
  fontWeight: 950,
},

quickSuggestionGrid: {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: 8,
},

quickSuggestionMiniCard: {
  borderRadius: 14,
  padding: "10px 11px",
  background: "rgba(120,120,120,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: 5,
},

quickSuggestionMiniLabel: {
  fontSize: 10,
  fontWeight: 950,
  textTransform: "uppercase",
  opacity: 0.55,
},

quickSuggestionMiniValue: {
  fontSize: 14,
  fontWeight: 950,
  lineHeight: 1.2,
},

quickSuggestionNote: {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.45,
  opacity: 0.68,
},
  

quickNotesBox: {
  borderRadius: 18,
  padding: 15,
},

quickNoteText: {
  margin: "8px 0 0",
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 700,
  opacity: 0.82,
},
  projectLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(300px, 0.72fr) minmax(520px, 1.28fr)", gap: 18, overflow: "hidden" },
  projectLeft: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 4 },
  projectRight: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 14, paddingRight: 6 },
  projectPanel: { borderRadius: 20, padding: 16, boxShadow: "0 12px 34px rgba(0,0,0,0.10)" },
  projectTitle: { margin: "0 0 12px", fontSize: 16, fontWeight: 950, letterSpacing: -0.3 },
  projectListItem: { borderRadius: 16, padding: 10, display: "flex", alignItems: "center", gap: 10, marginBottom: 8 },
  projectListMain: { flex: 1, minWidth: 0, background: "transparent", border: "none", textAlign: "left", cursor: "pointer", display: "flex", flexDirection: "column", gap: 3, color: "inherit" },
  projectHeaderCard: { borderRadius: 16, padding: 14, background: "rgba(120,120,120,0.10)", display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  projectSavedItem: { borderRadius: 16, padding: 14, marginBottom: 10 },
  projectMiniCard: { borderRadius: 16, padding: 12, marginTop: 10, display: "flex", flexDirection: "column", gap: 4, fontSize: 13 },

};
