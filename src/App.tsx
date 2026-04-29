import React, { useEffect, useRef, useState } from "react";
import { MATERIALS_DB, MaterialInfo } from "./data/materials";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

type Role = "utente" | "AI";

interface FileAttachment {
  name: string;
  type: string;
  size: number;
}

interface PendingFile {
  file: File;
  fileAttachment: FileAttachment;
}

interface Message {
  role: Role;
  text: string;
  imageUrl?: string;
  fileAttachment?: FileAttachment;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface UserProfile {
  name: string;
  email: string;
}

interface SavedLogin {
  email: string;
  lastAccess: string;
}

interface ChecklistForm {
  componentType: string;
  material: string;
  load: string;
  environment: string;
  machining: string;
  safetyFactor: string;
  tolerances: string;
  roughness: string;
  notes: string;
}

type ChecklistStatus = "✅ Conforme" | "⚠️ Da verificare" | "❌ Errore critico";

interface ChecklistResult {
  area: string;
  status: ChecklistStatus;
  detail: string;
  suggestion: string;
}

interface QuickCalcForm {
  componentType: string;
  stressType: string;
  material: string;
  load: string;
  distance: string;
  diameter: string;
  safetyFactorRequired: string;
}

interface QuickCalcResult {
  title: string;
  scheme: string;
  formulas: string[];
  values: string[];
  sigma: number;
  deflection: number;
  safetyFactor: number;
  outcome: "OK" | "NON OK";
  notes: string[];
}

interface DrawingForm {
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
}

type DrawingStatus = "✅ Necessaria" | "🟦 Consigliata" | "⚠️ Da verificare" | "❌ Mancante" | "ℹ️ Informativa";

interface DrawingResult {
  category: string;
  status: DrawingStatus;
  item: string;
  reason: string;
  suggestion: string;
}

interface DrawingUpload {
  file: File;
  fileAttachment: FileAttachment;
  previewUrl?: string;
}

interface DrawingIssue {
  id: string;
  label: string;
  severity: "errore" | "attenzione" | "info";
  x: number;
  y: number;
  detail: string;
}

const defaultUser: UserProfile = {
  name: "Mario Rossi",
  email: "mario.rossi@tech.it",
};

const STORAGE_KEY = "techai_ultimate_backend_ready_v1";
const BS = String.fromCharCode(92);

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);

  const [showSettings, setShowSettings] = useState(false);
  const [showLoginPanel, setShowLoginPanel] = useState(false);
  const [showChecklist, setShowChecklist] = useState(false);
  const [showQuickCalc, setShowQuickCalc] = useState(false);
  const [showMaterials, setShowMaterials] = useState(false);
  const [showDrawingGenerator, setShowDrawingGenerator] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [loginEmail, setLoginEmail] = useState(defaultUser.email);
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [savedLogins, setSavedLogins] = useState<SavedLogin[]>([]);

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
  const [drawingResults, setDrawingResults] = useState<DrawingResult[]>([]);
  const [drawingIssues, setDrawingIssues] = useState<DrawingIssue[]>([]);
  const [drawingReviewFile, setDrawingReviewFile] = useState<DrawingUpload | null>(null);
  const [drawingStepFile, setDrawingStepFile] = useState<DrawingUpload | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const drawingReviewInputRef = useRef<HTMLInputElement>(null);
  const drawingStepInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentMessages = activeChat?.messages || [];
  const isDark = theme.name === "Dark Black";
  const allMaterials = [...MATERIALS_DB, ...customMaterials];

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const p = JSON.parse(saved);
      const savedUser = p.user || defaultUser;

      setTheme(THEMES.find(t => t.name === p.themeName) || THEMES[0]);
      setInterest(p.interest || "Ingegneria Meccanica");
      setUser(savedUser);
      setLoginEmail(savedUser.email || defaultUser.email);
      setChats(p.chats || []);
      setActiveChatId(p.activeChatId || null);
      setSidebarOpen(p.sidebarOpen ?? true);
      setIsLoggedIn(p.isLoggedIn ?? false);
      setSavedLogins(p.savedLogins || []);
      setCustomMaterials(p.customMaterials || []);
    } catch {
      console.warn("Impossibile leggere il salvataggio locale.");
    }
  }, []);

  useEffect(() => {
    const safeChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message => ({
        role: message.role,
        text: message.text,
        imageUrl: message.imageUrl,
        fileAttachment: message.fileAttachment,
      })),
    }));

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats: safeChats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        savedLogins,
        customMaterials,
      })
    );
  }, [theme, interest, user, chats, activeChatId, sidebarOpen, isLoggedIn, savedLogins, customMaterials]);

  useEffect(() => {
    const existingScript = document.getElementById("mathjax-script");

    if (!existingScript) {
      (window as any).MathJax = {
        tex: {
          inlineMath: [["\\(", "\\)"], ["$", "$"]],
          displayMath: [["\\[", "\\]"], ["$$", "$$"]],
        },
        svg: { fontCache: "global" },
      };

      const script = document.createElement("script");
      script.id = "mathjax-script";
      script.src = "https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-svg.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => {
      const mathJax = (window as any).MathJax;
      if (mathJax?.typesetPromise) {
        mathJax.typesetPromise().catch(() => console.warn("MathJax non è riuscito a renderizzare una formula."));
      }
    }, 80);
  }, [currentMessages, loading, fileLoading, checklistResults, quickCalcResult]);

  const createChatObject = (title = "Nuova chat"): ChatSession => ({
    id: crypto.randomUUID(),
    title,
    messages: [],
    createdAt: new Date().toISOString(),
  });

  const createNewChat = () => {
    const newChat = createChatObject();
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setQuery("");
    setPendingFile(null);
    setSidebarOpen(true);
  };

  const ensureActiveChat = (title = "Nuova chat") => {
    if (activeChatId) return activeChatId;

    const newChat = createChatObject(title);
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(c => c.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const clearAllChats = () => {
    setChats([]);
    setActiveChatId(null);
    setQuery("");
    setPendingFile(null);
  };

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;

        const firstMessage = messages.find(m => m.role === "utente")?.text || chat.title;
        const shouldRename = chat.title === "Nuova chat" || chat.title.startsWith("File:");

        return {
          ...chat,
          messages,
          title: shouldRename ? firstMessage.slice(0, 32) + (firstMessage.length > 32 ? "..." : "") : chat.title,
        };
      })
    );
  };

  const addMessageToChat = (chatId: string, message: Message) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;

        const messages = [...chat.messages, message];
        const shouldRename = chat.title === "Nuova chat" && messages.length > 0;

        return {
          ...chat,
          messages,
          title: shouldRename ? messages[0].text.slice(0, 32) + "..." : chat.title,
        };
      })
    );
  };

  const handleLogin = () => {
    const cleanedEmail = loginEmail.trim();
    const cleanedPassword = loginPassword.trim();

    if (!cleanedEmail || !cleanedPassword) {
      setLoginError("Inserisci email e password per accedere.");
      return;
    }

    if (!cleanedEmail.includes("@")) {
      setLoginError("Inserisci un indirizzo email valido.");
      return;
    }

    setUser(prev => ({ ...prev, email: cleanedEmail }));
    setSavedLogins(prev => {
      const withoutDuplicate = prev.filter(item => item.email !== cleanedEmail);
      return [{ email: cleanedEmail, lastAccess: new Date().toISOString() }, ...withoutDuplicate].slice(0, 5);
    });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
    setLoginPassword("");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setShowLoginPanel(true);
  };

  const handleGuestLogin = () => {
    setUser({ name: "Ospite", email: "ospite@techai.local" });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
    setLoginPassword("");
  };

  const handleProviderLogin = (provider: "Google" | "telefono") => {
    const providerEmail = provider === "Google" ? "google.user@techai.local" : "telefono@techai.local";
    setUser({ name: provider === "Google" ? "Utente Google" : "Utente Telefono", email: providerEmail });
    setSavedLogins(prev => {
      const withoutDuplicate = prev.filter(item => item.email !== providerEmail);
      return [{ email: providerEmail, lastAccess: new Date().toISOString() }, ...withoutDuplicate].slice(0, 5);
    });
    setIsLoggedIn(true);
    setShowLoginPanel(false);
    setLoginError("");
  };

  const useSavedLogin = (email: string) => {
    setLoginEmail(email);
    setLoginPassword("demo123");
    setLoginError("");
  };

  const openLoginInsideApp = () => {
    setShowLoginPanel(true);
    setShowSettings(false);
    setShowChecklist(false);
    setShowQuickCalc(false);
    setShowMaterials(false);
    setShowDrawingGenerator(false);
    setLoginError("");
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

  const isDrawingReviewFile = (file: File) => {
    const name = file.name.toLowerCase();
    return (
      file.type.startsWith("image/") ||
      name.endsWith(".pdf") ||
      name.endsWith(".dwg") ||
      name.endsWith(".dxf") ||
      name.endsWith(".png") ||
      name.endsWith(".jpg") ||
      name.endsWith(".jpeg") ||
      name.endsWith(".webp")
    );
  };

  const isStepFile = (file: File) => {
    const name = file.name.toLowerCase();
    return name.endsWith(".step") || name.endsWith(".stp") || name.endsWith(".stl") || name.endsWith(".iges") || name.endsWith(".igs");
  };

  const handleDrawingReviewUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isDrawingReviewFile(file)) {
      alert("Per la revisione tavola carica PDF, immagine, DWG o DXF.");
      if (event.target) event.target.value = "";
      return;
    }

    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);

    setDrawingReviewFile({
      file,
      fileAttachment: {
        name: file.name,
        type: file.type || "disegno tecnico",
        size: file.size,
      },
      previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined,
    });

    if (event.target) event.target.value = "";
  };

  const handleDrawingStepUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!isStepFile(file)) {
      alert("Per l'idea tavola carica un file STEP/STP, STL o IGES.");
      if (event.target) event.target.value = "";
      return;
    }

    if (drawingStepFile?.previewUrl) URL.revokeObjectURL(drawingStepFile.previewUrl);

    setDrawingStepFile({
      file,
      fileAttachment: {
        name: file.name,
        type: file.type || "modello 3D",
        size: file.size,
      },
    });

    if (event.target) event.target.value = "";
  };

  const removeDrawingReviewFile = () => {
    if (drawingReviewFile?.previewUrl) URL.revokeObjectURL(drawingReviewFile.previewUrl);
    setDrawingReviewFile(null);
    if (drawingReviewInputRef.current) drawingReviewInputRef.current.value = "";
  };

  const removeDrawingStepFile = () => {
    if (drawingStepFile?.previewUrl) URL.revokeObjectURL(drawingStepFile.previewUrl);
    setDrawingStepFile(null);
    if (drawingStepInputRef.current) drawingStepInputRef.current.value = "";
  };

  const normalizeMaterialKey = (value?: string) => String(value || "").toLowerCase().replaceAll(" ", "").replaceAll("-", "");

  const findMaterial = (value: string) => {
    const key = normalizeMaterialKey(value);
    return allMaterials.find(m =>
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
    if (material.name.toLowerCase().includes("alluminio")) return 70000;
    return 210000;
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
      formulas = [
        "$$ M_f = F " + BS + "cdot L $$",
        "$$ W_f = " + BS + "frac{" + BS + "pi " + BS + "cdot d^3}{32} $$",
        "$$ " + BS + "sigma_f = " + BS + "frac{M_f}{W_f} $$",
        "$$ f = " + BS + "frac{F " + BS + "cdot L^3}{3 " + BS + "cdot E " + BS + "cdot I} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "sigma_f} $$",
      ];
      notes = ["Modello conservativo per mensola semplice.", "Per un perno reale controllare anche taglio, pressione specifica e condizioni di vincolo."];
    } else if (quickCalcForm.stressType === "taglio") {
      sigma = (4 * F) / (3 * A);
      title = "Verifica rapida a taglio";
      scheme = "Schema statico semplificato: sezione circolare soggetta a taglio trasversale.";
      formulas = [
        "$$ A = " + BS + "frac{" + BS + "pi " + BS + "cdot d^2}{4} $$",
        "$$ " + BS + "tau_{max} " + BS + "approx " + BS + "frac{4F}{3A} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "tau_{max}} $$",
      ];
      notes = ["Per taglio su spine o perni verificare se il taglio è singolo o doppio.", "Per criteri più corretti usare tensione ammissibile a taglio o Von Mises."];
    } else if (quickCalcForm.stressType === "torsione") {
      sigma = M / Wt;
      title = "Verifica rapida a torsione";
      scheme = "Schema statico semplificato: albero circolare pieno soggetto a momento torcente.";
      formulas = [
        "$$ M_t = F " + BS + "cdot L $$",
        "$$ W_t = " + BS + "frac{" + BS + "pi " + BS + "cdot d^3}{16} $$",
        "$$ " + BS + "tau_t = " + BS + "frac{M_t}{W_t} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "tau_t} $$",
      ];
      notes = ["Il braccio inserito viene usato come leva per generare il momento torcente.", "Per alberi reali verificare anche fatica, cave linguetta e concentrazioni di tensione."];
    } else {
      sigma = F / A;
      deflection = F * L / (E * A);
      title = "Verifica rapida a trazione/compressione";
      scheme = "Schema statico semplificato: barra circolare caricata assialmente.";
      formulas = [
        "$$ A = " + BS + "frac{" + BS + "pi " + BS + "cdot d^2}{4} $$",
        "$$ " + BS + "sigma = " + BS + "frac{F}{A} $$",
        "$$ " + BS + "Delta L = " + BS + "frac{F " + BS + "cdot L}{E " + BS + "cdot A} $$",
        "$$ n = " + BS + "frac{R_e}{" + BS + "sigma} $$",
      ];
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

    setQuickCalcResult({ title, scheme, formulas, values, sigma, deflection, safetyFactor: n, outcome, notes });
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
      suggestion: material ? "Controlla Rm, Re/Rp0.2, durezza, saldabilità e disponibilità commerciale. Per acciai comuni verifica anche la sigla EN/UNI/DIN." : "Inserisci una sigla materiale, ad esempio C45, S235, 42CrMo4, 11SMnPb37, AISI 304.",
    });

    results.push({
      area: "Coerenza carico/materiale",
      status: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0 ? "❌ Errore critico" : material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: !f.load.trim() || Number.isNaN(loadValue) || loadValue <= 0 ? "Carico non indicato o non numerico." : `Carico indicativo inserito: ${f.load} N. La sola checklist non sostituisce la verifica tensionale.`,
      suggestion: "Esegui almeno una verifica rapida a trazione/flessione/taglio/torsione in base al componente. Indica anche braccio, sezione resistente e tipo di sollecitazione.",
    });

    results.push({
      area: "Ambiente d'uso",
      status: environment ? "⚠️ Da verificare" : "⚠️ Da verificare",
      detail: environment ? `Ambiente indicato: ${f.environment}.` : "Ambiente non specificato: corrosione, temperatura, umidità e polveri possono cambiare la scelta del materiale.",
      suggestion: environment.includes("corros") || environment.includes("umid") || environment.includes("esterno") ? "Valuta inox, zincatura, brunitura, verniciatura o trattamento superficiale. Specifica sempre la protezione in tavola." : "Specifica se il pezzo lavora a secco, in esterno, in olio, in ambiente corrosivo o ad alta temperatura.",
    });

    results.push({
      area: "Trattamenti termici/superficiali",
      status: material ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: material ? "La necessità di trattamenti dipende da usura, fatica, durezza superficiale e accoppiamenti." : "Senza materiale non si possono proporre trattamenti compatibili.",
      suggestion: material.includes("c45") ? "Per C45 valuta bonifica o tempra superficiale se servono resistenza e durezza." : material.includes("42crmo4") ? "Per 42CrMo4 valuta bonifica se servono alte prestazioni meccaniche." : "Aggiungi una nota se sono richiesti bonifica, cementazione, nitrurazione, tempra, zincatura o anodizzazione.",
    });

    results.push({
      area: "Tensioni ammissibili",
      status: material && f.load.trim() ? "⚠️ Da verificare" : "❌ Errore critico",
      detail: "La tensione ammissibile non è stata calcolata automaticamente in questa prima checklist.",
      suggestion: "Ricava σamm = Re/n oppure usa criteri a fatica se il carico è variabile. Inserisci sempre il coefficiente di sicurezza usato.",
    });

    results.push({
      area: "Coefficiente di sicurezza",
      status: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "❌ Errore critico" : safetyValue < 1.5 ? "❌ Errore critico" : safetyValue < 2 ? "⚠️ Da verificare" : "✅ Conforme",
      detail: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "Coefficiente di sicurezza non indicato." : `Coefficiente di sicurezza indicato: n = ${f.safetyFactor}.`,
      suggestion: !f.safetyFactor.trim() || Number.isNaN(safetyValue) ? "Inserisci n. Per componenti statici spesso si parte da valori indicativi ≥ 2, salvo norme specifiche." : safetyValue < 1.5 ? "Valore molto basso: giustificalo con norma, prove o calcolo accurato." : "Verifica che il coefficiente sia coerente con incertezza del carico, conseguenze del cedimento e materiale.",
    });

    results.push({
      area: "Tolleranze dimensionali",
      status: tolerances ? "✅ Conforme" : "⚠️ Da verificare",
      detail: tolerances ? `Tolleranze indicate: ${f.tolerances}.` : "Non risultano tolleranze o accoppiamenti indicati.",
      suggestion: tolerances ? "Controlla che siano presenti soprattutto sulle quote funzionali, sedi cuscinetto, fori di centraggio, spine, alberi e accoppiamenti." : "Aggiungi tolleranze sulle quote funzionali. Esempi: Ø10 H7, Ø20 h6, posizione fori, planarità superfici di appoggio.",
    });

    results.push({
      area: "Raggi e smussi",
      status: f.notes.toLowerCase().includes("smus") || f.notes.toLowerCase().includes("raggio") || f.notes.toLowerCase().includes("raccord") ? "✅ Conforme" : "⚠️ Da verificare",
      detail: "La checklist cerca indicazioni testuali su smussi/raccordi nelle note.",
      suggestion: "Specifica smussi generali, ad esempio 'Smussi non quotati 0.5x45°', e raggi di raccordo dove servono per fatica o lavorazione.",
    });

    results.push({
      area: "Fori e filetti normalizzati",
      status: "⚠️ Da verificare",
      detail: "Controllare sempre che fori, maschiature e lamature siano quotati secondo norma.",
      suggestion: "Per viti indica M, passo se non grosso, profondità utile, lamatura/svasatura e classe vite se presente in distinta.",
    });

    results.push({
      area: "Rugosità",
      status: roughness ? "✅ Conforme" : "⚠️ Da verificare",
      detail: roughness ? `Rugosità indicata: ${f.roughness}.` : "Rugosità non indicata.",
      suggestion: roughness ? "Verifica che la rugosità sia assegnata alle superfici funzionali e non solo come valore generale." : "Aggiungi rugosità generale e rugosità specifiche per sedi, scorrimenti, appoggi, tenute e accoppiamenti.",
    });

    results.push({
      area: "Note di lavorazione",
      status: machining || f.notes.trim() ? "⚠️ Da verificare" : "⚠️ Da verificare",
      detail: machining ? `Lavorazione indicata: ${f.machining}.` : "Lavorazione non specificata.",
      suggestion: "Indica se il pezzo è tornito, fresato, saldato, piegato, tagliato laser, rettificato o trattato. Aggiungi note per sbavatura e protezione superficiale.",
    });

    setChecklistResults(results);
  };

  const runDrawingGenerator = () => {
    const f = drawingForm;
    const text = `${f.partName} ${f.partType} ${f.material} ${f.manufacturing} ${f.mainFeatures} ${f.functionalSurfaces} ${f.holesThreads} ${f.fits} ${f.tolerances} ${f.roughness} ${f.assemblyFunction}`.toLowerCase();
    const partType = f.partType.toLowerCase();
    const holes = f.holesThreads.toLowerCase();
    const fits = f.fits.toLowerCase();
    const tolerances = f.tolerances.toLowerCase();
    const roughness = f.roughness.toLowerCase();
    const manufacturing = f.manufacturing.toLowerCase();

    const hasHoles = holes.includes("foro") || holes.includes("m") || holes.includes("filett") || text.includes("lamatura") || text.includes("svasatura");
    const hasShaft = partType.includes("albero") || partType.includes("perno") || text.includes("sede cuscinetto") || text.includes("linguetta");
    const hasPlate = partType.includes("piastra") || partType.includes("staffa") || partType.includes("flangia");
    const hasWeld = manufacturing.includes("sald") || text.includes("sald");
    const hasBearing = text.includes("cuscinetto");
    const hasThread = holes.includes("m") || holes.includes("filett");
    const hasSlot = text.includes("asola") || text.includes("cava") || text.includes("linguetta");

    const results: DrawingResult[] = [];

    if (drawingReviewFile) {
      results.push({
        category: "File tavola caricato",
        status: "⚠️ Da verificare",
        item: drawingReviewFile.fileAttachment.name,
        reason: "È stato caricato un file tavola/disegno per la revisione. In questa versione il controllo automatico analizza soprattutto i dati inseriti nel modulo; la lettura tecnica completa del file richiede backend dedicato o revisione manuale.",
        suggestion: "Usa questo caricamento come riferimento visivo: controlla viste, sezioni, quote, tolleranze, rugosità, cartiglio, note e coerenza con funzione del pezzo.",
      });
    }

    if (drawingStepFile) {
      results.push({
        category: "File 3D / STEP caricato",
        status: "🟦 Consigliata",
        item: drawingStepFile.fileAttachment.name,
        reason: "Il modello 3D può aiutare a proporre un'idea di tavola: vista principale, viste ausiliarie, sezioni, dettagli e possibili quote funzionali.",
        suggestion: "Per una vera anteprima 3D serve integrare un viewer STEP/STL oppure convertire il modello lato backend. Per ora il file viene registrato come riferimento per impostare la tavola.",
      });
    }

    results.push({ category: "Viste", status: "✅ Necessaria", item: "Vista principale/frontale", reason: "Serve per rappresentare la forma più riconoscibile e la maggior parte delle quote principali del pezzo.", suggestion: "Scegli come vista frontale quella che mostra meglio funzione, fori principali, ingombri e simmetrie." });
    results.push({ category: "Viste", status: hasShaft ? "✅ Necessaria" : "🟦 Consigliata", item: hasShaft ? "Vista longitudinale dell'albero/perno" : "Vista laterale o superiore", reason: hasShaft ? "Per alberi e perni è essenziale mostrare diametri, spallamenti, gole, smussi e lunghezze." : "Una seconda vista evita ambiguità su spessori, profondità e posizione dei dettagli.", suggestion: hasShaft ? "Quota diametri e lunghezze in sequenza, aggiungendo assi tratto-punto e dettagli su gole/cave." : "Aggiungi una vista laterale/superiore se la geometria non è completamente definita dalla vista frontale." });
    results.push({ category: "Sezioni", status: hasHoles || hasBearing || hasSlot ? "🟦 Consigliata" : "ℹ️ Informativa", item: hasHoles || hasBearing || hasSlot ? "Sezione A-A" : "Sezione non obbligatoria salvo geometrie interne", reason: hasHoles || hasBearing || hasSlot ? "Fori, sedi, cave, lamature o geometrie interne sono più chiare in sezione." : "Se il pezzo è pieno e semplice, la sezione può non essere necessaria.", suggestion: hasBearing ? "Usa una sezione passante per la sede cuscinetto e quota diametro, profondità, smusso e rugosità." : hasHoles ? "Usa una sezione passante per fori ciechi, filetti, lamature o svasature." : "Valuta una sezione solo se ci sono dettagli nascosti importanti." });
    results.push({ category: "Quote funzionali", status: f.functionalSurfaces.trim() ? "⚠️ Da verificare" : "❌ Mancante", item: "Superfici funzionali e quote critiche", reason: f.functionalSurfaces.trim() ? `Superfici indicate: ${f.functionalSurfaces}.` : "Non sono state indicate superfici funzionali: rischio di quotare solo gli ingombri.", suggestion: f.functionalSurfaces.trim() ? "Assicurati che ogni superficie funzionale abbia quota, tolleranza e rugosità adeguata." : "Indica sedi, appoggi, superfici di scorrimento, battute, fori di centraggio e riferimenti di montaggio." });
    results.push({ category: "Fori e filetti", status: hasHoles ? "⚠️ Da verificare" : "ℹ️ Informativa", item: hasThread ? "Filetti e maschiature" : "Fori, lamature e svasature", reason: hasHoles ? `Dettagli indicati: ${f.holesThreads}.` : "Non sono stati indicati fori o filetti.", suggestion: hasThread ? "Per ogni filetto indica M, passo se non standard, profondità utile, eventuale preforo e tolleranza se richiesta." : hasHoles ? "Per ogni foro indica diametro, profondità, posizione, eventuale tolleranza H7/H13, lamatura o svasatura." : "Nessuna azione se il pezzo non contiene fori." });
    results.push({ category: "Tolleranze", status: tolerances || fits ? "⚠️ Da verificare" : "❌ Mancante", item: "Tolleranze dimensionali/geometriche", reason: tolerances || fits ? `Tolleranze/accoppiamenti indicati: ${f.tolerances || f.fits}.` : "Non risultano tolleranze specifiche: rischio tavola non producibile o non controllabile.", suggestion: hasBearing ? "Per sedi cuscinetto valuta tolleranze tipo H7, h6, k6, m6 secondo montaggio. Aggiungi concentricità/coassialità se necessaria." : hasSlot ? "Per cave e asole valuta larghezza tollerata, posizione e rugosità se sono funzionali." : "Aggiungi tolleranze sulle quote funzionali; lascia le quote non critiche alla tolleranza generale del cartiglio." });
    results.push({ category: "Rugosità", status: roughness ? "⚠️ Da verificare" : "❌ Mancante", item: "Rugosità generale e specifica", reason: roughness ? `Rugosità indicata: ${f.roughness}.` : "Non è stata indicata rugosità generale o specifica.", suggestion: hasBearing ? "Per sede cuscinetto consiglia Ra 1.6 o migliore secondo applicazione; per superfici generiche Ra 3.2/6.3." : text.includes("scorr") ? "Per superfici di scorrimento valuta Ra 0.8–1.6; per superfici non funzionali usa rugosità generale." : "Inserisci rugosità generale nel cartiglio e rugosità specifiche sulle superfici funzionali." });
    results.push({ category: "Quote ridondanti", status: "⚠️ Da verificare", item: "Controllo quote sovrabbondanti", reason: "La checklist non vede la tavola grafica, ma segnala il rischio tipico di quote duplicate o chiuse in catena.", suggestion: "Evita catene di quote chiuse. Usa quote funzionali da riferimenti/datum e lascia le quote derivate non quotate." });
    results.push({ category: "Cartiglio e note", status: f.material.trim() && f.manufacturing.trim() ? "⚠️ Da verificare" : "❌ Mancante", item: "Note generali di tavola", reason: f.material.trim() && f.manufacturing.trim() ? "Materiale e lavorazione sono presenti, ma vanno riportati in modo coerente in tavola." : "Mancano informazioni base per il cartiglio o le note di lavorazione.", suggestion: `Metti in cartiglio/materiale: ${f.material || "materiale da definire"}. Note consigliate: sbavare gli spigoli, smussi non quotati, trattamento superficiale, tolleranze generali ISO 2768 se applicabile.` });
    results.push({ category: "Produzione", status: manufacturing ? "⚠️ Da verificare" : "❌ Mancante", item: "Metodo produttivo e quantità", reason: manufacturing ? `Lavorazione indicata: ${f.manufacturing}. Quantità: ${f.productionQuantity || "non indicata"}.` : "Metodo produttivo non indicato.", suggestion: hasWeld ? "Per pezzi saldati aggiungi simboli di saldatura, preparazioni lembi, controlli e distensione se richiesta." : manufacturing.includes("rett") ? "Se è prevista rettifica, quota tolleranze e rugosità coerenti sulle superfici rettificate." : "Specifica se il pezzo è tornito, fresato, tagliato laser, piegato, saldato, fuso o stampato." });

    if (hasPlate) {
      results.push({ category: "Riferimenti", status: "🟦 Consigliata", item: "Datum su superficie di appoggio", reason: "Per piastre, staffe e flange conviene definire una superficie base per posizione fori e controlli geometrici.", suggestion: "Imposta datum A sulla superficie di appoggio principale; datum B/C su lati o fori di riferimento." });
    }

    const issues: DrawingIssue[] = [];

    if (!f.functionalSurfaces.trim()) {
      issues.push({ id: "funzionali", label: "Superfici funzionali", severity: "errore", x: 24, y: 28, detail: "Mancano superfici funzionali: indica sedi, appoggi, scorrimenti, battute o riferimenti." });
    }

    if (!tolerances && !fits) {
      issues.push({ id: "tolleranze", label: "Tolleranze", severity: "errore", x: 66, y: 35, detail: "Mancano tolleranze o accoppiamenti sulle quote importanti." });
    }

    if (!roughness) {
      issues.push({ id: "rugosita", label: "Rugosità", severity: "attenzione", x: 44, y: 62, detail: "Manca rugosità generale o specifica sulle superfici funzionali." });
    }

    if (!f.material.trim() || !f.manufacturing.trim()) {
      issues.push({ id: "cartiglio", label: "Cartiglio", severity: "attenzione", x: 78, y: 78, detail: "Controlla materiale, lavorazione, trattamento, scala, unità e note generali nel cartiglio." });
    }

    if (hasHoles && !text.includes("prof") && !text.includes("h7") && !text.includes("h13")) {
      issues.push({ id: "fori", label: "Fori/filetti", severity: "attenzione", x: 58, y: 22, detail: "Fori e filetti vanno quotati con diametro, profondità, posizione, lamatura/svasatura e tolleranza se funzionali." });
    }

    if (issues.length === 0) {
      issues.push({ id: "ok", label: "Controllo base OK", severity: "info", x: 50, y: 50, detail: "Non emergono mancanze principali dai dati inseriti. Rimane necessaria la verifica tecnica della tavola." });
    }

    setDrawingIssues(issues);
    setDrawingResults(results);
  };

  const isSupportedTextFile = (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type;

    return (
      type.startsWith("text/") ||
      file.type.startsWith("image/") ||
      name.endsWith(".txt") ||
      name.endsWith(".md") ||
      name.endsWith(".csv") ||
      name.endsWith(".json") ||
      name.endsWith(".xml") ||
      name.endsWith(".html") ||
      name.endsWith(".css") ||
      name.endsWith(".js") ||
      name.endsWith(".jsx") ||
      name.endsWith(".ts") ||
      name.endsWith(".tsx") ||
      name.endsWith(".py") ||
      name.endsWith(".java") ||
      name.endsWith(".cpp") ||
      name.endsWith(".c") ||
      name.endsWith(".h") ||
      name.endsWith(".sql") ||
      name.endsWith(".yaml") ||
      name.endsWith(".yml") ||
      name.endsWith(".pdf") ||
      name.endsWith(".docx") ||
      name.endsWith(".xlsx")
    );
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || fileLoading) return;

    if (!isLoggedIn) {
      setShowLoginPanel(true);
      setLoginError("Effettua il login prima di caricare file su TechAI.");
      if (event.target) event.target.value = "";
      return;
    }

    if (!isSupportedTextFile(file)) {
      alert("Formato file non supportato.");
      if (event.target) event.target.value = "";
      return;
    }

    setFileLoading(true);

    try {
      setPendingFile({
        file,
        fileAttachment: {
          name: file.name,
          type: file.type || "sconosciuto",
          size: file.size,
        },
      });
    } finally {
      setFileLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  const removePendingFile = () => {
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const callAI = async () => {
    if ((!query.trim() && !pendingFile) || loading || fileLoading) return;

    if (!isLoggedIn) {
      setShowLoginPanel(true);
      setLoginError("Effettua il login prima di usare TechAI.");
      return;
    }

    const text =
      query.trim() ||
      (pendingFile
        ? `Analizza il file "${pendingFile.fileAttachment.name}" e fammi un riassunto chiaro dei punti principali.`
        : "");

    const chatTitle = pendingFile ? `File: ${pendingFile.fileAttachment.name}` : text.slice(0, 32) + "...";
    const chatId = ensureActiveChat(chatTitle);

    const userMessage: Message = pendingFile
      ? { role: "utente", text, fileAttachment: pendingFile.fileAttachment }
      : { role: "utente", text };

    const fileToSend = pendingFile;

    setQuery("");
    setPendingFile(null);
    setLoading(true);

    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    const updatedMessages: Message[] = [...oldMessages, userMessage];

    replaceMessagesInChat(chatId, updatedMessages);

    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append(
        "messages",
        JSON.stringify(
          updatedMessages.map(m => ({
            role: m.role,
            text: m.text,
          }))
        )
      );
      formData.append(
        "profile",
        JSON.stringify({
          userName: user.name,
          focus: interest,
        })
      );

      if (fileToSend) {
        formData.append("file", fileToSend.file);
        formData.append("fileMeta", JSON.stringify(fileToSend.fileAttachment));
      }

      const res = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      const rawText = await res.text();
      let data: any = null;

      try {
        data = rawText ? JSON.parse(rawText) : null;
      } catch {
        data = null;
      }

      if (!res.ok) {
        const backendMessage = data?.error || data?.message || rawText;
        throw new Error(
          backendMessage ||
            `Backend non disponibile oppure rotta /api/chat non configurata. Codice HTTP: ${res.status}`
        );
      }

      if (!data) {
        throw new Error("Il backend ha risposto, ma non ha restituito JSON valido.");
      }

      const aiText = data?.answer || data?.message || data?.content;

      if (!aiText) {
        throw new Error("Il backend ha risposto, ma manca il campo answer/message/content.");
      }

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
    } catch (error: any) {
      const isBackendMissing = String(error?.message || "").includes("404") || String(error?.message || "").toLowerCase().includes("backend") || String(error?.message || "").toLowerCase().includes("json");

      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        {
          role: "AI",
          text:
            "⚠️ Backend non collegato correttamente.

" +
            "La grafica dell'app funziona, ma la risposta AI richiede una rotta `/api/chat` attiva.

" +
            "Cosa significa:
" +
            "- il frontend è ok;
" +
            "- la chat prova a chiamare `/api/chat`;
" +
            "- online, quella rotta non sta restituendo una risposta valida.

" +
            "Soluzione consigliata:
" +
            "1. se vuoi usare Vercel, dobbiamo creare una cartella `api/chat.ts` nella root del progetto;
" +
            "2. se vuoi usare backend separato, devi avviarlo e collegarlo al frontend;
" +
            "3. la key deve restare solo nel backend, mai in `App.tsx`.

" +
            `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}` +
            (isBackendMissing ? "" : ""),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = () => {
    const safeChats = chats.map(chat => ({
      ...chat,
      messages: chat.messages.map(message => ({
        role: message.role,
        text: message.text,
        imageUrl: message.imageUrl,
        fileAttachment: message.fileAttachment,
      })),
    }));

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats: safeChats,
        activeChatId,
        sidebarOpen,
        isLoggedIn,
        savedLogins,
        customMaterials,
      })
    );
    setShowSettings(false);
  };

  const renderInlineFormatting = (line: string) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={index} style={{ fontWeight: 850 }}>
            {part.replace(/\*\*/g, "")}
          </strong>
        );
      }

      return <React.Fragment key={index}>{part}</React.Fragment>;
    });
  };

  const formatText = (text: string) => {
    const blocks = text.split(/(```[\s\S]*?```)/g);

    return blocks.map((block, blockIndex) => {
      if (!block) return null;

      if (block.startsWith("```") && block.endsWith("```")) {
        const cleanCode = block.replace(/^```[a-zA-Z]*\n?/, "").replace(/```$/, "");

        return (
          <pre
            key={`code-${blockIndex}`}
            style={{
              ...s.codeBlock,
              background: isDark ? "#050505" : "#0f172a",
              color: "#e5e7eb",
              border: `1px solid ${isDark ? "#262626" : "#1e293b"}`,
            }}
          >
            <code>{cleanCode}</code>
          </pre>
        );
      }

      return block.split("\n").map((line, i) => {
        const trimmed = line.trim();
        const key = `line-${blockIndex}-${i}`;

        if (!trimmed) return <div key={key} style={{ height: 10 }} />;

        if (trimmed.startsWith("### ")) return <h3 key={key} style={{ ...s.aiHeading3, color: theme.primary }}>{trimmed.replace("### ", "")}</h3>;
        if (trimmed.startsWith("## ")) return <h2 key={key} style={{ ...s.aiHeading2, color: theme.primary }}>{trimmed.replace("## ", "")}</h2>;
        if (trimmed.startsWith("# ")) return <h1 key={key} style={{ ...s.aiHeading1, color: theme.primary }}>{trimmed.replace("# ", "")}</h1>;

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <div key={key} style={{ ...s.messageTitle, color: theme.primary, borderBottom: `1px solid ${theme.border || theme.surface}` }}>
              {trimmed.replace(/\*\*/g, "")}
            </div>
          );
        }

        if (trimmed === "---") return <hr key={key} style={{ border: "none", borderTop: `1px solid ${theme.border || "rgba(120,120,120,0.25)"}`, margin: "18px 0" }} />;

        if (trimmed.startsWith("* ") || trimmed.startsWith("+ ") || trimmed.startsWith("- ")) {
          return (
            <div key={key} style={s.messageListItem}>
              <span style={{ ...s.bulletDot, backgroundColor: theme.primary }} />
              <span>{renderInlineFormatting(trimmed.slice(2))}</span>
            </div>
          );
        }

        if (/^\d+\.\s/.test(trimmed)) {
          const number = trimmed.match(/^(\d+)\./)?.[1];
          const content = trimmed.replace(/^\d+\.\s/, "");
          return (
            <div key={key} style={s.numberedItem}>
              <span style={{ ...s.numberBadge, backgroundColor: theme.primary }}>{number}</span>
              <span>{renderInlineFormatting(content)}</span>
            </div>
          );
        }

        if (
          trimmed.toLowerCase().startsWith("nota:") ||
          trimmed.toLowerCase().startsWith("attenzione:") ||
          trimmed.toLowerCase().startsWith("risultato:") ||
          trimmed.toLowerCase().startsWith("conclusione:")
        ) {
          return (
            <div key={key} style={{ ...s.highlightBox, borderLeft: `4px solid ${theme.primary}`, background: isDark ? "rgba(96,165,250,0.08)" : "rgba(59,130,246,0.08)" }}>
              {renderInlineFormatting(line)}
            </div>
          );
        }

        if (trimmed.startsWith("$$") || trimmed.startsWith("\\[") || trimmed.includes("\\frac") || trimmed.includes("\\cdot")) {
          return <div key={key} style={{ ...s.formulaPrettyBox, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>{line}</div>;
        }

        return <div key={key} style={s.messageLine}>{renderInlineFormatting(line)}</div>;
      });
    });
  };

  const iconBtn = (icon: string, label: string, onClick: () => void, active = false) => (
    <button
      style={{
        ...s.iconBtn,
        width: sidebarOpen ? "100%" : 44,
        height: 44,
        justifyContent: sidebarOpen ? "flex-start" : "center",
        padding: sidebarOpen ? "0 12px" : 0,
        backgroundColor: active ? theme.surface : "transparent",
        color: active ? theme.primary : theme.text,
        border: `1px solid ${active ? theme.border || theme.surface : "transparent"}`,
      }}
      onClick={onClick}
      title={label}
    >
      <span style={s.icon}>{icon}</span>
      {sidebarOpen && <span style={s.iconLabel}>{label}</span>}
    </button>
  );

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.inputComposer, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml,.pdf,.docx,.xlsx,image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {pendingFile && (
        <div style={{ ...s.pendingFileChip, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "rgba(255,255,255,0.72)" }}>
          <div style={{ ...s.pendingFileIcon, background: theme.primary }}>📄</div>
          <div style={s.pendingFileMeta}>
            <div style={s.pendingFileName}>{pendingFile.fileAttachment.name}</div>
            <div style={s.pendingFileSub}>{(pendingFile.fileAttachment.size / 1024).toFixed(1)} KB · pronto da inviare al backend</div>
          </div>
          <button style={{ ...s.pendingFileRemove, color: theme.text, border: `1px solid ${theme.border}` }} onClick={removePendingFile} title="Rimuovi file" type="button">×</button>
        </div>
      )}

      <div style={s.searchBarInner}>
        <button style={{ ...s.fileBtn, color: theme.primary }} onClick={() => fileInputRef.current?.click()} title="Carica file" disabled={fileLoading || !isLoggedIn}>
          {fileLoading ? "…" : "📎"}
        </button>

        <textarea
          style={{ ...s.textarea, color: theme.text }}
          rows={1}
          value={query}
          placeholder={isLoggedIn ? (pendingFile ? "Scrivi cosa vuoi fare con il file..." : placeholder) : "Effettua il login per iniziare a usare TechAI..."}
          onChange={e => {
            setQuery(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
          }}
          onFocus={() => {
            if (!isLoggedIn) setShowLoginPanel(true);
          }}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
        />

        <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || fileLoading || (!query.trim() && !pendingFile)}>➤</button>
      </div>
    </div>
  );

  const renderLoginCard = (compact = false) => (
    <div style={{ ...s.loginCardModern, background: isDark ? "rgba(17,17,17,0.94)" : "rgba(255,255,255,0.72)", color: theme.text, border: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.75)"}`, width: compact ? "100%" : "min(560px, calc(100vw - 32px))" }}>
      <div style={s.loginBrand}>TECH<span style={{ color: theme.primary }}>AI</span></div>
      <h1 style={s.loginHeadline}>Accedi al tuo account</h1>
      <p style={s.loginDescription}>Area grafica predisposta per futuro login reale tramite backend.</p>

      {savedLogins.length > 0 && (
        <div style={s.savedLoginArea}>
          <div style={s.savedLoginTitle}>Account salvati localmente</div>
          <div style={s.savedLoginList}>{savedLogins.map(item => <button key={item.email} style={{ ...s.savedLoginPill, border: `1px solid ${theme.border}`, color: theme.text }} onClick={() => useSavedLogin(item.email)} type="button">{item.email}</button>)}</div>
        </div>
      )}

      <label style={s.cleanLoginLabel}>Email</label>
      <input style={{ ...s.cleanLoginInput, color: theme.text, border: `1px solid ${theme.border}` }} value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="nome@email.com" type="email" autoComplete="email" />
      <label style={s.cleanLoginLabel}>Password</label>
      <div style={{ ...s.cleanPasswordWrap, border: `1px solid ${theme.border}` }}>
        <input style={{ ...s.cleanPasswordInput, color: theme.text }} value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="Minimo 6 caratteri" type={showPassword ? "text" : "password"} autoComplete="current-password" onKeyDown={e => e.key === "Enter" && handleLogin()} />
        <button style={{ ...s.cleanPasswordToggle, color: theme.primary }} onClick={() => setShowPassword(prev => !prev)} type="button">{showPassword ? "Nascondi" : "Mostra"}</button>
      </div>
      {loginError && <div style={s.loginError}>{loginError}</div>}
      <button style={{ ...s.mainLoginBtn, background: theme.primary }} onClick={handleLogin}>Accedi</button>
      <div style={s.loginDivider}>oppure</div>
      <button style={{ ...s.providerBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => handleProviderLogin("Google")} type="button">Continua con Google</button>
      <button style={{ ...s.providerBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => handleProviderLogin("telefono")} type="button">Continua con telefono</button>
      <button style={{ ...s.guestBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={handleGuestLogin} type="button">
        <span style={s.guestIcon}>♟</span>
        <span style={s.guestTextWrap}><strong>Continua come ospite</strong><small>Usa TechAI senza account reale. Per login vero serve backend/database.</small></span>
        <span style={s.guestArrow}>›</span>
      </button>
      <button style={{ ...s.registerBtn, color: theme.primary }} onClick={() => setLoginError("Registrazione grafica: per un account reale serve collegare un backend/database.")} type="button">Non hai un account? Registrati</button>
    </div>
  );

  return (
    <div style={{ ...s.app, backgroundColor: theme.bg, color: theme.text }}>
      {!isLoggedIn && !showLoginPanel && <div style={{ ...s.loginScreen, background: `linear-gradient(135deg, ${theme.bg}, ${theme.surface})` }}>{renderLoginCard(false)}</div>}

      <aside style={{ ...s.sidebar, width: sidebarOpen ? 280 : 74, minWidth: sidebarOpen ? 280 : 74, backgroundColor: isDark ? "#050505" : theme.bg, borderRight: `1px solid ${theme.border || theme.surface}`, filter: !isLoggedIn ? "blur(1px)" : "none", pointerEvents: !isLoggedIn ? "none" : "auto" }}>
        <div style={{ ...s.sidebarTop, justifyContent: sidebarOpen ? "space-between" : "center" }}>
          {sidebarOpen && <div style={s.logoWrap}><div style={{ ...s.logoMark, backgroundColor: theme.primary }}>T</div><div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div></div>}
          <div style={s.topActions}>
            <button style={{ ...s.collapseBtn, color: theme.text, backgroundColor: sidebarOpen ? "transparent" : theme.surface, border: `1px solid ${theme.border || theme.surface}` }} onClick={() => setSidebarOpen(prev => !prev)} title={sidebarOpen ? "Chiudi barra laterale" : "Apri barra laterale"}>☰</button>
          </div>
        </div>

        <div style={{ ...s.iconNav, alignItems: sidebarOpen ? "stretch" : "center" }}>
          {iconBtn("＋", "Nuova", createNewChat)}
          <div style={{ ...s.toolsGroup, backgroundColor: isDark ? "#111111" : theme.surface, border: `1px solid ${theme.border || theme.surface}`, boxShadow: isDark ? "0 0 0 1px rgba(255,255,255,0.04) inset" : "0 8px 20px rgba(0,0,0,0.04)" }}>
            {sidebarOpen && <div style={{ ...s.toolsTitle, color: theme.primary }}>Strumenti tecnici</div>}
            {iconBtn("✓", "Checklist", () => setShowChecklist(true))}
            {iconBtn("∑", "Verifica", () => setShowQuickCalc(true))}
            {iconBtn("▦", "Materiali", () => setShowMaterials(true))}
            {iconBtn("▣", "Tavole", () => setShowDrawingGenerator(true))}
          </div>
        </div>

        {sidebarOpen && <div style={s.chatHistory}>
          <div style={s.historyHeaderRow}>
            <div style={s.historyHeader}>Cronologia</div>
            {chats.length > 0 && <button style={{ ...s.clearChatsBtn, color: theme.primary, border: `1px solid ${theme.border}` }} onClick={clearAllChats} title="Elimina tutte le chat" type="button">Svuota</button>}
          </div>
          {chats.length === 0 && <div style={{ fontSize: 12, opacity: 0.6, padding: "8px" }}>Nessuna chat salvata</div>}
          {chats.map(chat => <div key={chat.id} style={{ ...s.historyItem, backgroundColor: chat.id === activeChatId ? theme.surface : "transparent", color: chat.id === activeChatId ? theme.primary : theme.text, border: `1px solid ${chat.id === activeChatId ? theme.border || theme.surface : "transparent"}` }}><div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>{chat.title}</div><button style={{ ...s.deleteBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => deleteChat(chat.id)} title="Elimina questa chat" type="button">×</button></div>)}
        </div>}
        <div style={s.sidebarBottomActions}>{iconBtn("⚙", "Impostazioni", () => { setActiveTab("Aspetto"); setShowSettings(true); })}</div>
        
      </aside>

      <main style={{ ...s.main, backgroundColor: theme.bg }}>
        {!sidebarOpen && (
          <div style={{ ...s.collapsedBrand, color: theme.text }}>
            TECH<span style={{ color: theme.primary }}>AI</span>
          </div>
        )}

        <button
          style={{ ...s.floatingAccountBtn, color: theme.text, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}
          onClick={() => { setActiveTab("Account"); setShowSettings(true); }}
          title={isLoggedIn ? "Account" : "Login"}
          type="button"
        >
          👤
        </button>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? <div style={s.homeWrapper}><h1 style={s.welcomeText}>Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?</h1>{renderInputBar("Chiedi a TechAI o carica un file...")}<p style={s.fileHint}>Il file viene mandato al backend. La chiave AI non è nel frontend.</p></div> : <div style={s.chatView}><div style={s.msgList}>{currentMessages.map((m, i) => <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>{m.role === "AI" && <div style={{ ...s.aiAvatar, background: theme.primary }}>T</div>}<div style={m.role === "utente" ? { ...s.uBox, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}`, boxShadow: isDark ? "0 8px 20px rgba(0,0,0,0.20)" : "0 8px 22px rgba(15,23,42,0.06)" } : { ...s.aBox, color: theme.text, background: isDark ? "#0b0b0b" : "#ffffff", border: `1px solid ${theme.border || theme.surface}`, boxShadow: isDark ? "0 12px 28px rgba(0,0,0,0.32)" : "0 14px 34px rgba(15,23,42,0.08)" }}>{m.role === "AI" && <div style={s.aiHeader}><div><div style={s.aiName}>TechAI</div><div style={s.aiSubName}>Risposta tecnica dal backend</div></div></div>}{formatText(m.text)}{m.fileAttachment && <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "rgba(120,120,120,0.10)", border: `1px solid ${theme.border}`, maxWidth: 320 }}><div style={{ width: 34, height: 42, borderRadius: 6, background: theme.primary, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 }}>📄</div><div style={{ minWidth: 0 }}><div style={{ fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.fileAttachment.name}</div><div style={{ fontSize: 11, opacity: 0.65 }}>{(m.fileAttachment.size / 1024).toFixed(1)} KB · inviato al backend</div></div></div>}</div></div>)}{fileLoading && <div style={{ color: theme.primary, textAlign: "center" }}>📎 Preparazione file...</div>}{loading && <div style={{ color: theme.primary, textAlign: "center" }}>✨ TechAI sta elaborando...</div>}<div ref={chatEndRef} /></div><div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file...")}</div></div>}
        </section>

        {showLoginPanel && <div style={s.overlay}><div style={s.loginModalWrap}>{renderLoginCard(false)}<button style={{ ...s.closeFloatingBtn, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => { setShowLoginPanel(false); setLoginError(""); }} title="Torna indietro">×</button></div></div>}

        {showQuickCalc && <div style={s.overlay}><div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}><div style={s.modalHeader}><div><h2 style={{ fontSize: "20px", margin: 0 }}>Verifica dimensionale rapida</h2><p style={s.checklistSubtitle}>Modulo preliminare per alberi, perni, staffe e componenti semplici.</p></div><button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowQuickCalc(false)}>×</button></div><div style={s.quickCalcLayout}><div style={s.checklistFormArea}><div style={s.checklistGrid}><div><label style={s.label}>Tipo componente</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.componentType} onChange={e => updateQuickCalcField("componentType", e.target.value)} placeholder="Perno, albero, staffa..." /></div><div><label style={s.label}>Tipo verifica</label><select style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.stressType} onChange={e => updateQuickCalcField("stressType", e.target.value)}><option value="flessione">Flessione</option><option value="taglio">Taglio</option><option value="torsione">Torsione</option><option value="assiale">Trazione / compressione</option></select></div><div><label style={s.label}>Materiale</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.material} onChange={e => updateQuickCalcField("material", e.target.value)} placeholder="C45" /></div><div><label style={s.label}>Carico F [N]</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.load} onChange={e => updateQuickCalcField("load", e.target.value)} placeholder="2500" /></div><div><label style={s.label}>Distanza / braccio L [mm]</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.distance} onChange={e => updateQuickCalcField("distance", e.target.value)} placeholder="120" /></div><div><label style={s.label}>Diametro d [mm]</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.diameter} onChange={e => updateQuickCalcField("diameter", e.target.value)} placeholder="20" /></div></div><label style={s.label}>Coefficiente sicurezza richiesto</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={quickCalcForm.safetyFactorRequired} onChange={e => updateQuickCalcField("safetyFactorRequired", e.target.value)} placeholder="2" /><button style={{ ...s.checkBtn, background: theme.primary }} onClick={runQuickCalc}>Calcola verifica</button><div style={{ ...s.warningBox, border: `1px solid ${theme.border}` }}>Calcolo preliminare: non sostituisce verifica normativa, FEM o relazione firmata. Usa modelli semplificati.</div></div><div style={s.checklistResultsArea}>{!quickCalcResult ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati e premi “Calcola verifica”.</div> : <div style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}><div style={s.resultTop}><strong>{quickCalcResult.title}</strong><span style={{ ...s.bigOutcome, color: quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626" }}>{quickCalcResult.outcome}</span></div><p style={s.resultDetail}>{quickCalcResult.scheme}</p><div style={s.formulaBlock}>{quickCalcResult.formulas.map((formula, index) => <div key={index}>{formula}</div>)}</div><div style={s.valueList}>{quickCalcResult.values.map((value, index) => <div key={index} style={s.valueRow}>• {value}</div>)}</div><div style={{ ...s.finalBox, borderLeft: `4px solid ${quickCalcResult.outcome === "OK" ? "#16a34a" : "#dc2626"}` }}>Esito: {quickCalcResult.outcome}. Coefficiente calcolato n = {quickCalcResult.safetyFactor.toFixed(2)}.</div>{quickCalcResult.notes.map((note, index) => <p key={index} style={s.resultSuggestion}>{note}</p>)}</div>}</div></div></div></div>}

        {showChecklist && <div style={s.overlay}><div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}><div style={s.modalHeader}><div><h2 style={{ fontSize: "20px", margin: 0 }}>Checklist tecnica progetto</h2><p style={s.checklistSubtitle}>Controllo preliminare automatico per componenti meccanici.</p></div><button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowChecklist(false)}>×</button></div><div style={s.checklistLayout}><div style={s.checklistFormArea}><div style={s.checklistGrid}><div><label style={s.label}>Tipo componente</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.componentType} onChange={e => updateChecklistField("componentType", e.target.value)} placeholder="Albero, perno, staffa, flangia..." /></div><div><label style={s.label}>Materiale</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.material} onChange={e => updateChecklistField("material", e.target.value)} placeholder="C45, S235, 42CrMo4..." /></div><div><label style={s.label}>Carico indicativo [N]</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.load} onChange={e => updateChecklistField("load", e.target.value)} placeholder="2500" /></div><div><label style={s.label}>Coefficiente sicurezza</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.safetyFactor} onChange={e => updateChecklistField("safetyFactor", e.target.value)} placeholder="2" /></div></div><label style={s.label}>Ambiente d'uso</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.environment} onChange={e => updateChecklistField("environment", e.target.value)} placeholder="Interno, esterno, umido, corrosivo, olio..." /><label style={s.label}>Lavorazione prevista</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.machining} onChange={e => updateChecklistField("machining", e.target.value)} placeholder="Tornitura, fresatura, saldatura, rettifica..." /><label style={s.label}>Tolleranze / accoppiamenti presenti</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.tolerances} onChange={e => updateChecklistField("tolerances", e.target.value)} placeholder="Ø20 h6, foro Ø10 H7..." /><label style={s.label}>Rugosità</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.roughness} onChange={e => updateChecklistField("roughness", e.target.value)} placeholder="Ra 3.2 generale, Ra 1.6 sedi..." /><label style={s.label}>Note tecniche</label><textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={checklistForm.notes} onChange={e => updateChecklistField("notes", e.target.value)} placeholder="Smussi, raggi, filetti, trattamenti..." /><button style={{ ...s.checkBtn, background: theme.primary }} onClick={runProjectChecklist}>Esegui checklist</button></div><div style={s.checklistResultsArea}>{checklistResults.length === 0 ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati del pezzo e premi “Esegui checklist”.</div> : checklistResults.map((item, index) => <div key={index} style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}><div style={s.resultTop}><strong>{item.area}</strong><span style={s.resultStatus}>{item.status}</span></div><p style={s.resultDetail}>{item.detail}</p><p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p></div>)}</div></div></div></div>}

        {showDrawingGenerator && <div style={s.overlay}><div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}><div style={s.modalHeader}><div><h2 style={{ fontSize: "20px", margin: 0 }}>Generatore tavole tecniche controllate</h2><p style={s.checklistSubtitle}>Suggerisce viste, sezioni, quote, tolleranze, rugosità e note di cartiglio.</p></div><button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowDrawingGenerator(false)}>×</button></div><div style={s.drawingLayout}><div style={s.checklistFormArea}>
                  <input ref={drawingReviewInputRef} type="file" accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg,.webp,image/*" style={{ display: "none" }} onChange={handleDrawingReviewUpload} />
                  <input ref={drawingStepInputRef} type="file" accept=".step,.stp,.stl,.iges,.igs" style={{ display: "none" }} onChange={handleDrawingStepUpload} />

                  <div style={{ ...s.drawingUploadPanel, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "#f8fafc" }}>
                    <div style={s.drawingUploadHeader}>
                      <div>
                        <strong>Revisione tavola / idea di tavola</strong>
                        <p style={{ margin: "4px 0 0", opacity: 0.68, fontSize: 12, lineHeight: 1.45 }}>
                          Carica una tavola già fatta per farla controllare, oppure un file STEP/STP per impostare un'idea di tavola con possibile anteprima futura.
                        </p>
                      </div>
                    </div>

                    <div style={s.drawingUploadGrid}>
                      <button style={{ ...s.drawingUploadBtn, border: `1px solid ${theme.border}`, color: theme.text }} onClick={() => drawingReviewInputRef.current?.click()} type="button">
                        📄 Carica tavola
                        <small>PDF, immagine, DWG, DXF</small>
                      </button>
                      <button style={{ ...s.drawingUploadBtn, border: `1px solid ${theme.border}`, color: theme.text }} onClick={() => drawingStepInputRef.current?.click()} type="button">
                        🧊 Carica STEP/3D
                        <small>STEP, STP, STL, IGES</small>
                      </button>
                    </div>

                    {(drawingReviewFile || drawingStepFile) && (
                      <div style={s.drawingUploadedList}>
                        {drawingReviewFile && (
                          <div style={{ ...s.drawingFileCard, border: `1px solid ${theme.border}`, background: isDark ? "#111" : "#fff" }}>
                            <div style={{ ...s.drawingFileIcon, background: theme.primary }}>📄</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={s.drawingFileName}>{drawingReviewFile.fileAttachment.name}</strong>
                              <span style={s.drawingFileSub}>{(drawingReviewFile.fileAttachment.size / 1024).toFixed(1)} KB · tavola da revisionare</span>
                              {drawingReviewFile.previewUrl && <img src={drawingReviewFile.previewUrl} alt="Anteprima tavola" style={s.drawingPreviewImage} />}
                            </div>
                            <button style={s.drawingRemoveBtn} onClick={removeDrawingReviewFile} type="button">×</button>
                          </div>
                        )}

                        {drawingStepFile && (
                          <div style={{ ...s.drawingFileCard, border: `1px solid ${theme.border}`, background: isDark ? "#111" : "#fff" }}>
                            <div style={{ ...s.drawingFileIcon, background: theme.primary }}>🧊</div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <strong style={s.drawingFileName}>{drawingStepFile.fileAttachment.name}</strong>
                              <span style={s.drawingFileSub}>{(drawingStepFile.fileAttachment.size / 1024).toFixed(1)} KB · modello per idea tavola</span>
                              <div style={{ fontSize: 11, opacity: 0.65, marginTop: 4 }}>Anteprima 3D: predisposta per futura integrazione viewer/backend.</div>
                            </div>
                            <button style={s.drawingRemoveBtn} onClick={removeDrawingStepFile} type="button">×</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div style={s.checklistGrid}><div><label style={s.label}>Nome pezzo</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.partName} onChange={e => updateDrawingField("partName", e.target.value)} placeholder="Es. Albero intermedio" /></div><div><label style={s.label}>Tipo pezzo</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.partType} onChange={e => updateDrawingField("partType", e.target.value)} placeholder="Albero, perno, staffa..." /></div><div><label style={s.label}>Materiale</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.material} onChange={e => updateDrawingField("material", e.target.value)} placeholder="C45, S235..." /></div><div><label style={s.label}>Quantità / lotto</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.productionQuantity} onChange={e => updateDrawingField("productionQuantity", e.target.value)} placeholder="1 pezzo, 100 pezzi..." /></div></div><label style={s.label}>Lavorazione prevista</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.manufacturing} onChange={e => updateDrawingField("manufacturing", e.target.value)} placeholder="Tornitura, fresatura..." /><label style={s.label}>Geometrie principali</label><textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.mainFeatures} onChange={e => updateDrawingField("mainFeatures", e.target.value)} placeholder="Fori, cave, asole..." /><label style={s.label}>Funzione del pezzo nell'assieme</label><textarea style={{ ...s.checklistTextarea, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm.assemblyFunction} onChange={e => updateDrawingField("assemblyFunction", e.target.value)} placeholder="Cosa fa il pezzo?" />{(["functionalSurfaces", "holesThreads", "fits", "tolerances", "roughness"] as (keyof DrawingForm)[]).map(field => <div key={field}><label style={s.label}>{field === "functionalSurfaces" ? "Superfici funzionali" : field === "holesThreads" ? "Fori / filetti / lamature" : field === "fits" ? "Accoppiamenti" : field === "tolerances" ? "Tolleranze già previste" : "Rugosità già previste"}</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={drawingForm[field]} onChange={e => updateDrawingField(field, e.target.value)} /></div>)}<button style={{ ...s.checkBtn, background: theme.primary }} onClick={runDrawingGenerator}>Genera controllo tavola</button></div><div style={s.checklistResultsArea}>
                  <div style={{ ...s.drawingPreviewPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
                    <div style={s.drawingPreviewTop}>
                      <div>
                        <strong>Anteprima controllo tavola</strong>
                        <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.65 }}>I marker indicano le zone da controllare nella tavola.</p>
                      </div>
                      <span style={{ ...s.previewBadge, background: drawingIssues.some(i => i.severity === "errore") ? "#dc2626" : drawingIssues.some(i => i.severity === "attenzione") ? "#f59e0b" : "#16a34a" }}>
                        {drawingIssues.length || 0}
                      </span>
                    </div>

                    <div style={{ ...s.drawingSheetMock, background: isDark ? "#0b0b0b" : "#ffffff", border: `1px solid ${theme.border}` }}>
                      <div style={s.sheetViewLarge}>Vista principale</div>
                      <div style={s.sheetViewSmallA}>Sezione A-A</div>
                      <div style={s.sheetViewSmallB}>Dettaglio</div>
                      <div style={s.sheetCartiglio}>Cartiglio</div>

                      {drawingIssues.map(issue => (
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
                      {drawingIssues.length === 0 ? (
                        <div style={{ opacity: 0.65, fontSize: 13 }}>Esegui il controllo per vedere gli errori evidenziati.</div>
                      ) : (
                        drawingIssues.map(issue => (
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

                  {drawingResults.length === 0 ? <div style={{ ...s.emptyChecklist, border: `1px dashed ${theme.border}` }}>Inserisci i dati del pezzo e premi “Genera controllo tavola”.</div> : drawingResults.map((item, index) => <div key={index} style={{ ...s.resultCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}><div style={s.resultTop}><strong>{item.category}: {item.item}</strong><span style={s.resultStatus}>{item.status}</span></div><p style={s.resultDetail}>{item.reason}</p><p style={{ ...s.resultSuggestion, borderLeft: `3px solid ${theme.primary}` }}>{item.suggestion}</p></div>)}
                </div></div></div></div>}

        {showMaterials && <div style={s.overlay}><div style={{ ...s.checklistModal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}><div style={s.modalHeader}><div><h2 style={{ fontSize: "20px", margin: 0 }}>Libreria materiali</h2><p style={s.checklistSubtitle}>Conversioni normative e proprietà meccaniche indicative.</p></div><button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowMaterials(false)}>×</button></div><div style={s.materialToolbar}><input style={{ ...s.materialSearch, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={materialSearch} onChange={e => setMaterialSearch(e.target.value)} placeholder="Cerca materiale, EN, DIN, AISI, JIS..." /><button style={{ ...s.addMaterialBtn, background: theme.primary }} onClick={() => setShowAddMaterial(prev => !prev)}>{showAddMaterial ? "Chiudi" : "+ Aggiungi materiale"}</button></div>{showAddMaterial && <div style={{ ...s.addMaterialPanel, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}><div style={s.addMaterialHeader}><strong>Nuovo materiale personalizzato</strong><span>Compila i dati che conosci. Gli altri resteranno “Non specificato”.</span></div><div style={s.addMaterialGrid}>{(["name", "key", "en", "uni", "din", "aisi", "jis", "iso", "rm", "re"] as (keyof MaterialInfo)[]).map(field => <div key={String(field)}><label style={s.label}>{String(field).toUpperCase()}</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={(newMaterial as any)[field] || ""} onChange={e => updateNewMaterialField(field, e.target.value)} /></div>)}</div>{(["hardness", "treatments", "weldability", "machinability", "uses"] as (keyof MaterialInfo)[]).map(field => <div key={String(field)}><label style={s.label}>{String(field)}</label><input style={{ ...s.input, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={(newMaterial as any)[field] || ""} onChange={e => updateNewMaterialField(field, e.target.value)} /></div>)}<label style={s.label}>Note</label><textarea style={{ ...s.addMaterialTextarea, background: isDark ? "#111" : "#fff", color: theme.text, border: `1px solid ${theme.border}` }} value={newMaterial.notes} onChange={e => updateNewMaterialField("notes", e.target.value)} /><button style={{ ...s.saveMaterialBtn, background: theme.primary }} onClick={addCustomMaterial}>Salva materiale</button></div>}<div style={s.materialGrid}>{allMaterials.filter(m => { const q = materialSearch.toLowerCase().trim(); if (!q) return true; return `${m.name} ${m.en} ${m.uni} ${m.din} ${m.aisi} ${m.jis} ${m.iso} ${m.uses}`.toLowerCase().includes(q); }).map(material => <div key={material.key} style={{ ...s.materialCard, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}><div style={s.materialHead}><div><h3 style={{ margin: 0 }}>{material.name}</h3>{customMaterials.some(item => item.key === material.key) && <span style={s.customTag}>Personalizzato</span>}</div><div style={s.materialActions}><button style={{ ...s.smallUseBtn, background: theme.primary }} onClick={() => { setQuickCalcForm(prev => ({ ...prev, material: material.name })); setShowMaterials(false); setShowQuickCalc(true); }}>Usa in verifica</button>{customMaterials.some(item => item.key === material.key) && <button style={s.smallDeleteMaterialBtn} onClick={() => deleteCustomMaterial(material.key)}>Elimina</button>}</div></div><div style={s.materialCodes}><span>EN: {material.en}</span><span>UNI: {material.uni}</span><span>DIN: {material.din}</span><span>AISI/SAE: {material.aisi}</span><span>JIS: {material.jis}</span><span>ISO: {material.iso}</span></div><div style={s.materialProps}><strong>Rm:</strong> {material.rm} MPa · <strong>Re:</strong> {material.re} MPa · <strong>Durezza:</strong> {material.hardness}</div><p><strong>Trattamenti:</strong> {material.treatments}</p><p><strong>Saldabilità:</strong> {material.weldability}</p><p><strong>Lavorabilità:</strong> {material.machinability}</p><p><strong>Impieghi:</strong> {material.uses}</p><p style={{ opacity: 0.68 }}><strong>Nota:</strong> {material.notes}</p></div>)}</div></div></div>}

        {showSettings && <div style={s.overlay}><div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}><div style={{ ...s.modalSide, background: isDark ? "#050505" : "#f8fafc", borderRight: `1px solid ${theme.border}` }}>{["Account", "Aspetto", "AI Focus"].map(t => <div key={t} onClick={() => setActiveTab(t)} style={{ ...s.tab, color: activeTab === t ? theme.primary : theme.text, fontWeight: activeTab === t ? 800 : 400 }}>{t}</div>)}</div><div style={s.modalMain}><div style={s.modalHeader}><h2 style={{ fontSize: "18px", margin: 0 }}>{activeTab}</h2><button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowSettings(false)}>×</button></div>{activeTab === "Account" && <div><label style={s.label}>Nome Visualizzato</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} /><label style={s.label}>Email</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} /><div style={s.accountButtonRow}><button style={{ ...s.miniPrimaryBtn, background: theme.primary }} onClick={openLoginInsideApp}>Apri login</button><button style={s.miniDangerBtn} onClick={handleLogout}>Logout</button></div><div style={s.badge}>Stato Account: {isLoggedIn ? "Accesso effettuato ✅" : "Non connesso"}</div></div>}{activeTab === "Aspetto" && <div style={s.themeGrid}>{THEMES.map(t => <div key={t.name} onClick={() => setTheme(t)} style={{ ...s.themeOption, background: theme.name === t.name ? theme.surface : "transparent", color: theme.text, border: theme.name === t.name ? `1px solid ${t.primary}` : `1px solid ${theme.border || "transparent"}` }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: t.name === "Dark Black" ? "#050505" : t.primary, border: t.name === "Dark Black" ? "1px solid #ffffff" : "none", boxShadow: t.name === "Dark Black" ? "0 0 0 1px rgba(0,0,0,0.35)" : "none" }} />{t.name}</div>)}</div>}{activeTab === "AI Focus" && <div><label style={s.label}>Ambito Tecnico Principale</label><input style={{ ...s.input, background: isDark ? "#050505" : "#ffffff", color: theme.text, border: `1px solid ${theme.border}` }} value={interest} onChange={e => setInterest(e.target.value)} /></div>}<button style={{ ...s.saveBtn, background: theme.primary }} onClick={saveAll}>Salva modifiche</button></div></div></div>}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', 'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif !important; box-sizing: border-box; transition: background 0.2s, color 0.2s, width 0.25s ease, min-width 0.25s ease, border 0.2s; }
        html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        input::placeholder, textarea::placeholder { opacity: 0.55; }
        button:disabled { opacity: 0.45; cursor: not-allowed; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", minWidth: 0 },
  loginScreen: { position: "fixed", inset: 0, zIndex: 2000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 },
  loginModalWrap: { position: "relative" },
  closeFloatingBtn: { position: "absolute", top: -12, right: -12, width: 38, height: 38, borderRadius: "50%", cursor: "pointer", fontSize: 22, fontWeight: 700 },
  loginCardModern: { borderRadius: 28, padding: "34px 44px", boxShadow: "0 30px 90px rgba(0,0,0,0.22)", backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)" },
  loginBrand: { textAlign: "center", fontSize: 25, fontWeight: 950, letterSpacing: "-1px", marginBottom: 20 },
  loginHeadline: { textAlign: "center", margin: 0, fontSize: 28, fontWeight: 850, letterSpacing: "-0.8px" },
  loginDescription: { textAlign: "center", margin: "14px 0 24px", fontSize: 14, opacity: 0.72, lineHeight: 1.45 },
  savedLoginArea: { marginBottom: 18 },
  savedLoginTitle: { fontSize: 11, fontWeight: 900, textTransform: "uppercase", opacity: 0.58, marginBottom: 8 },
  savedLoginList: { display: "flex", gap: 8, flexWrap: "wrap" },
  savedLoginPill: { background: "rgba(255,255,255,0.35)", borderRadius: 999, padding: "8px 11px", cursor: "pointer", fontSize: 12, fontWeight: 800 },
  cleanLoginLabel: { display: "block", fontSize: 12, fontWeight: 900, textTransform: "uppercase", opacity: 0.7, margin: "18px 0 8px" },
  cleanLoginInput: { width: "100%", minHeight: 54, borderRadius: 16, background: "rgba(255,255,255,0.28)", outline: "none", padding: "0 16px", fontSize: 15, fontWeight: 600 },
  cleanPasswordWrap: { width: "100%", minHeight: 54, borderRadius: 16, background: "rgba(255,255,255,0.28)", display: "flex", alignItems: "center", padding: "0 8px 0 16px" },
  cleanPasswordInput: { flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 15, fontWeight: 600 },
  cleanPasswordToggle: { border: "none", background: "transparent", cursor: "pointer", fontSize: 12, fontWeight: 850, padding: "10px" },
  loginError: { marginTop: 12, padding: "10px 12px", borderRadius: 12, color: "#b91c1c", background: "#fee2e2", fontSize: 13, fontWeight: 700 },
  mainLoginBtn: { width: "100%", minHeight: 54, border: "none", borderRadius: 16, color: "white", fontWeight: 900, fontSize: 15, marginTop: 24, cursor: "pointer", boxShadow: "0 14px 30px rgba(37,99,235,0.28)" },
  loginDivider: { textAlign: "center", fontSize: 12, opacity: 0.62, margin: "15px 0" },
  providerBtn: { width: "100%", minHeight: 48, borderRadius: 16, background: "rgba(255,255,255,0.22)", cursor: "pointer", fontWeight: 850, fontSize: 14, marginBottom: 10 },
  guestBtn: { width: "100%", minHeight: 64, borderRadius: 18, background: "rgba(255,255,255,0.22)", cursor: "pointer", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", textAlign: "left", marginTop: 4 },
  guestIcon: { width: 28, fontSize: 22, textAlign: "center" },
  guestTextWrap: { display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 },
  guestArrow: { fontSize: 30, opacity: 0.58 },
  registerBtn: { width: "100%", border: "none", background: "transparent", cursor: "pointer", fontWeight: 900, fontSize: 15, marginTop: 20 },

  sidebar: { height: "100dvh", padding: "10px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { display: "flex", alignItems: "center", gap: 8, minHeight: 50, flexShrink: 0 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { width: 34, height: 34, borderRadius: 12, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  logoText: { fontSize: 21, fontWeight: 900, letterSpacing: "-1px", whiteSpace: "nowrap" },
  collapseBtn: { width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  topActions: { display: "flex", alignItems: "center", gap: 8, flexShrink: 0 },
  collapsedBrand: { position: "absolute", top: 22, left: 28, zIndex: 20, fontSize: 24, fontWeight: 950, letterSpacing: "2px", pointerEvents: "none" },
  floatingAccountBtn: { position: "absolute", top: 18, right: 28, zIndex: 30, width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 18, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 8px 22px rgba(0,0,0,0.12)" },
  iconNav: { display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 },
  toolsGroup: { display: "flex", flexDirection: "column", gap: 6, borderRadius: 18, padding: 8, margin: "8px 0" },
  toolsTitle: { fontSize: 11, textTransform: "uppercase", fontWeight: 950, letterSpacing: "0.6px", opacity: 0.95, padding: "5px 8px 7px", borderBottom: "1px solid rgba(120,120,120,0.18)", marginBottom: 3 },
  iconBtn: { minHeight: 44, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, background: "transparent", textAlign: "left", flexShrink: 0 },
  icon: { width: 22, height: 22, display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: 15, fontWeight: 600, opacity: 0.88, letterSpacing: "-1px", flexShrink: 0 },
  iconLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatHistory: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 },
  historyHeaderRow: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "2px 4px" },
  historyHeader: { fontSize: 11, textTransform: "uppercase", fontWeight: 800, opacity: 0.5, padding: "6px 4px" },
  clearChatsBtn: { borderRadius: 999, background: "transparent", cursor: "pointer", fontSize: 11, fontWeight: 850, padding: "5px 8px" },
  historyItem: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "8px 8px 8px 10px", fontSize: 13, cursor: "pointer", gap: 8 },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 },
  deleteBtn: { width: 24, height: 24, borderRadius: "50%", background: "rgba(120,120,120,0.10)", cursor: "pointer", fontSize: 16, opacity: 0.85, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  sidebarBottomActions: { marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 },
  sidebarAccount: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "7px", cursor: "pointer", borderRadius: 14, flexShrink: 0 },
  avatar: { width: 38, height: 38, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  accountText: { display: "flex", flexDirection: "column", minWidth: 0 },

  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: 720, textAlign: "center", padding: "0 22px" },
  welcomeText: { fontSize: "clamp(25px, 4vw, 38px)", fontWeight: 600, marginBottom: 30, letterSpacing: "-1px" },
  inputComposer: { display: "flex", flexDirection: "column", gap: 8, borderRadius: 28, padding: "8px 12px", width: "100%", minHeight: 56, boxShadow: "0 8px 24px rgba(0,0,0,0.04)", backdropFilter: "blur(10px)", flexShrink: 0 },
  searchBarInner: { display: "flex", alignItems: "center", width: "100%" },
  fileBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", marginRight: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85, fontSize: 18 },
  textarea: { flex: 1, minWidth: 0, maxHeight: 140, background: "none", border: "none", outline: "none", textAlign: "center", fontSize: 16, resize: "none", padding: "10px 0", overflowY: "auto" },
  sendBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 20, marginLeft: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 },
  fileHint: { fontSize: 12, opacity: 0.58, marginTop: 12 },
  pendingFileChip: { display: "flex", alignItems: "center", gap: 10, borderRadius: 18, padding: "10px 12px", width: "100%", boxShadow: "0 8px 20px rgba(0,0,0,0.035)" },
  pendingFileIcon: { width: 34, height: 42, borderRadius: 9, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 17, flexShrink: 0 },
  pendingFileMeta: { minWidth: 0, flex: 1, textAlign: "left" },
  pendingFileName: { fontWeight: 850, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  pendingFileSub: { fontSize: 11, opacity: 0.62, marginTop: 2 },
  pendingFileRemove: { width: 30, height: 30, borderRadius: "50%", background: "transparent", cursor: "pointer", fontSize: 20, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 },

  chatView: { width: "100%", maxWidth: 940, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 22px", overflow: "hidden" },
  msgList: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 18, padding: "10px 0" },
  uRow: { display: "flex", justifyContent: "flex-end", width: "100%" },
  aRow: { display: "flex", justifyContent: "flex-start", alignItems: "flex-start", gap: 12, width: "100%" },
  uBox: { padding: "13px 18px", borderRadius: "22px 22px 6px 22px", maxWidth: "78%", fontSize: 15, whiteSpace: "pre-wrap", overflowWrap: "anywhere", lineHeight: 1.55 },
  aBox: { padding: "18px 20px", borderRadius: "8px 22px 22px 22px", lineHeight: 1.72, fontSize: 16, whiteSpace: "pre-wrap", maxWidth: "86%", overflowWrap: "anywhere" },
  bottomInput: { padding: "10px 0 8px", flexShrink: 0 },

  aiAvatar: { width: 34, height: 34, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, fontSize: 14, flexShrink: 0, marginTop: 10, boxShadow: "0 10px 24px rgba(0,0,0,0.18)" },
  aiHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid rgba(120,120,120,0.18)" },
  aiName: { fontSize: 14, fontWeight: 900, letterSpacing: "-0.2px" },
  aiSubName: { fontSize: 11, opacity: 0.55, marginTop: 2 },
  aiHeading1: { fontSize: 26, fontWeight: 900, margin: "20px 0 12px", letterSpacing: "-0.7px", lineHeight: 1.2 },
  aiHeading2: { fontSize: 22, fontWeight: 880, margin: "18px 0 10px", letterSpacing: "-0.5px", lineHeight: 1.25 },
  aiHeading3: { fontSize: 18, fontWeight: 850, margin: "16px 0 8px", letterSpacing: "-0.3px", lineHeight: 1.3 },
  messageTitle: { fontSize: 20, fontWeight: 850, marginTop: 22, marginBottom: 12, paddingBottom: 8, letterSpacing: "-0.4px" },
  messageListItem: { display: "flex", alignItems: "flex-start", gap: 8, margin: "6px 0", lineHeight: 1.65 },
  bulletDot: { width: 7, height: 7, borderRadius: "50%", marginTop: 10, flexShrink: 0 },
  numberedItem: { display: "flex", alignItems: "flex-start", gap: 10, margin: "8px 0", lineHeight: 1.65 },
  numberBadge: { minWidth: 24, height: 24, borderRadius: 999, color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, marginTop: 1, flexShrink: 0 },
  highlightBox: { borderRadius: 14, padding: "12px 14px", margin: "12px 0", fontSize: 14, lineHeight: 1.6, fontWeight: 650 },
  formulaPrettyBox: { borderRadius: 16, padding: "14px 16px", margin: "12px 0", overflowX: "auto", fontSize: 15, lineHeight: 1.7 },
  codeBlock: { borderRadius: 16, padding: "16px 18px", margin: "14px 0", overflowX: "auto", fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap" },
  messageLine: { lineHeight: 1.7, margin: "2px 0" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 },
  modal: { borderRadius: 24, width: "min(620px, 100%)", height: "min(450px, calc(100dvh - 32px))", display: "flex", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" },
  modalSide: { width: 170, padding: 24, display: "flex", flexDirection: "column", gap: 15, flexShrink: 0 },
  modalMain: { flex: 1, minWidth: 0, padding: 32, display: "flex", flexDirection: "column", overflowY: "auto" },
  modalHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  backBtn: { width: 38, height: 38, minWidth: 38, padding: 0, background: "transparent", borderRadius: "50%", cursor: "pointer", fontWeight: 900, fontSize: 24, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  tab: { cursor: "pointer", fontSize: 14 },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 12, marginBottom: 20, outline: "none", fontSize: 14 },
  badge: { fontSize: 12, color: "#10b981", fontWeight: 700, background: "#f0fdf4", padding: 10, borderRadius: 10, textAlign: "center", marginTop: 14 },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 },
  themeOption: { padding: 12, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700 },
  saveBtn: { marginTop: "auto", padding: 14, border: "none", borderRadius: 14, color: "white", fontWeight: 700, cursor: "pointer" },

  checklistModal: { borderRadius: 24, width: "min(1120px, calc(100vw - 32px))", height: "min(760px, calc(100dvh - 32px))", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 70px rgba(0,0,0,0.28)", padding: 28 },
  checklistSubtitle: { margin: "6px 0 0", fontSize: 13, opacity: 0.62 },
  checklistLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.9fr) minmax(360px, 1.1fr)", gap: 22, overflow: "hidden" },
  quickCalcLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(340px, 0.85fr) minmax(400px, 1.15fr)", gap: 22, overflow: "hidden" },
  drawingLayout: { flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "minmax(380px, 0.95fr) minmax(430px, 1.05fr)", gap: 22, overflow: "hidden" },
  drawingUploadPanel: { borderRadius: 18, padding: 16, marginBottom: 18 },
  drawingUploadHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  drawingUploadGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  drawingUploadBtn: { minHeight: 72, borderRadius: 16, background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, fontWeight: 850, fontSize: 14 },
  drawingUploadedList: { display: "flex", flexDirection: "column", gap: 10, marginTop: 12 },
  drawingFileCard: { display: "flex", alignItems: "flex-start", gap: 10, borderRadius: 16, padding: 12 },
  drawingFileIcon: { width: 36, height: 44, borderRadius: 10, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 900, flexShrink: 0 },
  drawingFileName: { display: "block", fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  drawingFileSub: { display: "block", fontSize: 11, opacity: 0.65, marginTop: 2 },
  drawingPreviewImage: { width: "100%", maxHeight: 160, objectFit: "contain", borderRadius: 12, marginTop: 10, background: "rgba(120,120,120,0.08)" },
  drawingRemoveBtn: { width: 28, height: 28, borderRadius: "50%", border: "none", background: "rgba(120,120,120,0.16)", cursor: "pointer", fontSize: 18, lineHeight: 1, flexShrink: 0 },
  drawingPreviewPanel: { borderRadius: 18, padding: 16, marginBottom: 12 },
  drawingPreviewTop: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  previewBadge: { minWidth: 28, height: 28, borderRadius: 999, color: "white", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900 },
  drawingSheetMock: { position: "relative", height: 260, borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  sheetViewLarge: { position: "absolute", left: "8%", top: "12%", width: "42%", height: "42%", border: "1px solid rgba(120,120,120,0.35)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.75 },
  sheetViewSmallA: { position: "absolute", right: "10%", top: "14%", width: "28%", height: "24%", border: "1px solid rgba(120,120,120,0.35)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.75 },
  sheetViewSmallB: { position: "absolute", left: "20%", bottom: "16%", width: "26%", height: "20%", border: "1px solid rgba(120,120,120,0.35)", borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.75 },
  sheetCartiglio: { position: "absolute", right: "6%", bottom: "6%", width: "34%", height: "18%", border: "1px solid rgba(120,120,120,0.35)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, opacity: 0.75 },
  issueMarker: { position: "absolute", transform: "translate(-50%, -50%)", width: 26, height: 26, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 950, fontSize: 15, boxShadow: "0 8px 22px rgba(0,0,0,0.28)", border: "2px solid rgba(255,255,255,0.85)" },
  issueList: { display: "flex", flexDirection: "column", gap: 8 },
  issueRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, lineHeight: 1.35 },
  issueDot: { width: 9, height: 9, borderRadius: "50%", marginTop: 5, flexShrink: 0 },
  checklistFormArea: { overflowY: "auto", paddingRight: 6 },
  checklistResultsArea: { overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingRight: 6 },
  checklistGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  checklistTextarea: { width: "100%", minHeight: 92, padding: 12, borderRadius: 12, marginBottom: 20, outline: "none", fontSize: 14, resize: "vertical" },
  checkBtn: { width: "100%", padding: 15, border: "none", borderRadius: 14, color: "white", fontWeight: 850, cursor: "pointer", fontSize: 15 },
  emptyChecklist: { borderRadius: 18, minHeight: 160, display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", opacity: 0.68, padding: 18, fontSize: 14 },
  resultCard: { borderRadius: 18, padding: 16 },
  resultTop: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 8, fontSize: 14 },
  resultStatus: { fontWeight: 900, fontSize: 13, whiteSpace: "nowrap" },
  resultDetail: { margin: "0 0 10px", lineHeight: 1.5, fontSize: 13, opacity: 0.82 },
  resultSuggestion: { margin: 0, paddingLeft: 10, lineHeight: 1.5, fontSize: 13, fontWeight: 650 },
  warningBox: { marginTop: 14, borderRadius: 14, padding: 12, fontSize: 12, lineHeight: 1.5, opacity: 0.74 },
  formulaBlock: { borderRadius: 16, padding: 14, background: "rgba(120,120,120,0.08)", margin: "14px 0", overflowX: "auto", fontSize: 15 },
  valueList: { display: "flex", flexDirection: "column", gap: 7, marginTop: 10 },
  valueRow: { fontSize: 13, lineHeight: 1.45 },
  finalBox: { marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "rgba(120,120,120,0.08)", fontWeight: 850 },
  bigOutcome: { fontWeight: 950, fontSize: 18 },

  materialToolbar: { display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "center", marginBottom: 18 },
  materialSearch: { width: "100%", padding: 14, borderRadius: 14, outline: "none", fontSize: 14 },
  addMaterialBtn: { border: "none", color: "white", borderRadius: 14, padding: "14px 16px", cursor: "pointer", fontWeight: 850, whiteSpace: "nowrap" },
  addMaterialPanel: { borderRadius: 18, padding: 18, marginBottom: 18, overflowY: "auto", maxHeight: 390 },
  addMaterialHeader: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 14, fontSize: 13, opacity: 0.9 },
  addMaterialGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 },
  addMaterialTextarea: { width: "100%", minHeight: 70, borderRadius: 12, padding: 12, outline: "none", resize: "vertical", marginBottom: 14 },
  saveMaterialBtn: { width: "100%", border: "none", color: "white", borderRadius: 14, padding: 14, fontWeight: 850, cursor: "pointer" },
  materialGrid: { flex: 1, minHeight: 0, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))", gap: 14, paddingRight: 4 },
  materialCard: { borderRadius: 18, padding: 18, lineHeight: 1.45, fontSize: 13 },
  materialHead: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 },
  materialActions: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" },
  smallUseBtn: { border: "none", color: "white", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" },
  smallDeleteMaterialBtn: { border: "none", color: "#991b1b", background: "#fee2e2", borderRadius: 999, padding: "8px 12px", cursor: "pointer", fontWeight: 850, fontSize: 12, whiteSpace: "nowrap" },
  customTag: { display: "inline-flex", marginTop: 5, fontSize: 11, fontWeight: 850, opacity: 0.68 },
  materialCodes: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12, marginBottom: 12, opacity: 0.8 },
  materialProps: { padding: 10, borderRadius: 12, background: "rgba(120,120,120,0.08)", marginBottom: 10, lineHeight: 1.5 },
  accountButtonRow: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 4, marginBottom: 4 },
  miniPrimaryBtn: { border: "none", color: "white", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 800 },
  miniDangerBtn: { border: "none", color: "#991b1b", background: "#fee2e2", padding: 12, borderRadius: 12, cursor: "pointer", fontWeight: 800 },
};
