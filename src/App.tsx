import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b", border: "#cbd5e1" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c", border: "#e7e5e4" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

type Role = "utente" | "AI";
type AttachmentKind = "image" | "pdf" | "text" | "spreadsheet" | "docx" | "zip" | "cad" | "generic";

interface Attachment {
  name: string;
  type: string;
  size: number;
  kind: AttachmentKind;
  url?: string;
  previewUrls?: string[];
  extractedText?: string;
}

interface Message {
  role: Role;
  text: string;
  attachments?: Attachment[];
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface UserProfile {
  id?: string;
  name: string;
  email: string;
  phone?: string;
  plan?: "Free" | "Pro" | "Business";
}

const defaultUser: UserProfile = {
  id: "demo-user",
  name: "Mario Rossi",
  email: "mario.rossi@tech.it",
  phone: "",
  plan: "Free",
};

const STORAGE_KEY = "techai_ultimate_v7_all_files";
const TEXT_LIMIT = 24000;
const MAX_PDF_PAGES_TO_ANALYZE = 5;
const MAX_IMAGES_PER_VISION_REQUEST = 5;

const truncateText = (text: string, limit = TEXT_LIMIT) => {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n\n[TESTO TAGLIATO: il file contiene ${text.length} caratteri totali]`;
};

const getExt = (name: string) => name.toLowerCase().split(".").pop() || "";

export default function App() {
  const [query, setQuery] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authName, setAuthName] = useState("");
  const [authPhone, setAuthPhone] = useState("");
  const [authError, setAuthError] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentMessages = activeChat?.messages || [];
  const isDark = theme.name === "Dark Black";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const p = JSON.parse(saved);
      setTheme(THEMES.find(t => t.name === p.themeName) || THEMES[0]);
      setInterest(p.interest || "Ingegneria Meccanica");
      setUser(p.user || defaultUser);
      setChats(p.chats || []);
      setActiveChatId(p.activeChatId || null);
      setSidebarOpen(p.sidebarOpen ?? true);
      setIsAuthenticated(p.isAuthenticated ?? false);
    } catch {
      console.warn("Impossibile leggere il salvataggio locale.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ themeName: theme.name, interest, user, chats, activeChatId, sidebarOpen, isAuthenticated })
    );
  }, [theme, interest, user, chats, activeChatId, sidebarOpen, isAuthenticated]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading, fileLoading]);

  const handleAuthSubmit = () => {
    setAuthError("");

    if (!authEmail.trim()) {
      setAuthError("Inserisci una email valida.");
      return;
    }

    if (authPassword.length < 6) {
      setAuthError("La password deve avere almeno 6 caratteri.");
      return;
    }

    if (authMode === "register" && !authName.trim()) {
      setAuthError("Inserisci il nome visualizzato.");
      return;
    }

    // Predisposizione frontend. Qui poi collegheremo Supabase Auth.
    setUser({
      id: crypto.randomUUID(),
      name: authMode === "register" ? authName.trim() : authEmail.split("@")[0],
      email: authEmail.trim(),
      phone: authPhone.trim(),
      plan: "Free",
    });
    setIsAuthenticated(true);
    setAuthPassword("");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setActiveChatId(null);
    setChats([]);
    setQuery("");
  };

  const renderAuthScreen = () => (
    <div style={{ ...s.authPage, backgroundColor: theme.bg, color: theme.text }}>
      <div style={{ ...s.authCard, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
        <div style={s.authLogo}>TECH<span style={{ color: theme.primary }}>AI</span></div>
        <h1 style={s.authTitle}>{authMode === "login" ? "Accedi al tuo account" : "Crea account"}</h1>
        <p style={s.authSubtitle}>Area privata predisposta per salvare chat, file e impostazioni utente.</p>

        {authMode === "register" && (
          <>
            <label style={s.label}>Nome visualizzato</label>
            <input style={s.authInput} value={authName} onChange={e => setAuthName(e.target.value)} placeholder="Mario Rossi" />
          </>
        )}

        <label style={s.label}>Email</label>
        <input style={s.authInput} value={authEmail} onChange={e => setAuthEmail(e.target.value)} placeholder="nome@email.com" type="email" />

        {authMode === "register" && (
          <>
            <label style={s.label}>Telefono opzionale</label>
            <input style={s.authInput} value={authPhone} onChange={e => setAuthPhone(e.target.value)} placeholder="+39..." type="tel" />
          </>
        )}

        <label style={s.label}>Password</label>
        <input style={s.authInput} value={authPassword} onChange={e => setAuthPassword(e.target.value)} placeholder="Minimo 6 caratteri" type="password" onKeyDown={e => e.key === "Enter" && handleAuthSubmit()} />

        {authError && <div style={s.authError}>{authError}</div>}

        <button style={{ ...s.authPrimaryBtn, backgroundColor: theme.primary }} onClick={handleAuthSubmit}>
          {authMode === "login" ? "Accedi" : "Registrati"}
        </button>

        <div style={s.authDivider}>oppure</div>

        <button style={s.authSecondaryBtn} onClick={() => setAuthError("Login Google predisposto: verrà collegato con Supabase Auth.")}>Continua con Google</button>
        <button style={s.authSecondaryBtn} onClick={() => setAuthError("Login telefono predisposto: richiede provider SMS configurato in Supabase.")}>Continua con telefono</button>

        <button style={{ ...s.authSwitchBtn, color: theme.primary }} onClick={() => { setAuthError(""); setAuthMode(authMode === "login" ? "register" : "login"); }}>
          {authMode === "login" ? "Non hai un account? Registrati" : "Hai già un account? Accedi"}
        </button>
      </div>
    </div>
  );

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

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev => prev.map(chat => {
      if (chat.id !== chatId) return chat;
      const title = chat.title === "Nuova chat" && messages[0]?.text ? messages[0].text.slice(0, 32) + "..." : chat.title;
      return { ...chat, title, messages };
    }));
  };

  const addMessageToChat = (chatId: string, message: Message) => {
    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    replaceMessagesInChat(chatId, [...oldMessages, message]);
  };

  const getFileKind = (file: File): AttachmentKind => {
    const ext = getExt(file.name);
    if (file.type.startsWith("image/")) return "image";
    if (file.type === "application/pdf" || ext === "pdf") return "pdf";
    if (["docx"].includes(ext)) return "docx";
    if (["xlsx", "xls", "csv"].includes(ext)) return ext === "csv" ? "text" : "spreadsheet";
    if (["zip"].includes(ext)) return "zip";
    if (["step", "stp", "iges", "igs"].includes(ext)) return "cad";
    if (isSupportedTextFile(file)) return "text";
    return "generic";
  };

  const isSupportedTextFile = (file: File) => {
    const ext = getExt(file.name);
    return (
      file.type.startsWith("text/") ||
      ["txt", "md", "csv", "json", "xml", "html", "css", "js", "jsx", "ts", "tsx", "py", "java", "cpp", "c", "h", "sql", "yaml", "yml", "step", "stp", "iges", "igs", "log"].includes(ext)
    );
  };

  const imageFileToResizedDataUrl = (file: File, maxSize = 1600, quality = 0.82): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const img = new Image();

      reader.onload = () => {
        img.src = reader.result as string;
      };
      reader.onerror = reject;

      img.onload = () => {
        let { width, height } = img;
        const ratio = Math.min(maxSize / width, maxSize / height, 1);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);

        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas non disponibile."));

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };

      img.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const canvasToDataUrl = (canvas: HTMLCanvasElement, maxSize = 1600, quality = 0.82) => {
    const resized = document.createElement("canvas");
    const ctx = resized.getContext("2d");
    if (!ctx) throw new Error("Canvas non disponibile.");

    let width = canvas.width;
    let height = canvas.height;
    const ratio = Math.min(maxSize / width, maxSize / height, 1);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);

    resized.width = width;
    resized.height = height;
    ctx.drawImage(canvas, 0, 0, width, height);
    return resized.toDataURL("image/jpeg", quality);
  };

  const readUnavailableFile = async (file: File) => {
    return `Il file "${file.name}" è stato caricato, ma questa build senza librerie esterne non può estrarre direttamente il contenuto di PDF, DOCX, XLSX o ZIP. Per ora carica immagini JPG/PNG/WebP o file testuali TXT/CSV/JSON/STEP.`;
  };

  const callVisionAI = async (imageDataUrls: string[], prompt: string) => {
    if (!apiKey) throw new Error("Chiave API mancante. Controlla VITE_GROQ_API_KEY nelle variabili ambiente.");

    const limitedImages = imageDataUrls.slice(0, MAX_IMAGES_PER_VISION_REQUEST);

    const content = [
      { type: "text", text: prompt },
      ...limitedImages.map(url => ({ type: "image_url", image_url: { url } })),
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        messages: [
          {
            role: "user",
            content,
          },
        ],
        temperature: 0.1,
        max_completion_tokens: 1600,
      }),
    });

    const data = await res.json();
    console.log("VISION RESPONSE", data);
    if (!res.ok) throw new Error(data?.error?.message || "Errore durante l'analisi vision.");
    return data?.choices?.[0]?.message?.content || "Il modello non ha restituito contenuto leggibile.";
  };

  const callTextAI = async (messages: Message[]) => {
    if (!apiKey) throw new Error("Chiave API mancante. Controlla VITE_GROQ_API_KEY nelle variabili ambiente.");

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              `Sei TechAI. Utente: ${user.name}. Focus: ${interest}. ` +
              "Agisci come assistente per progettazione meccanica e ufficio tecnico. " +
              "Quando analizzi file, produci report con: contenuto riconosciuto, problemi, errori, rischi, controlli da fare, prossimi step. " +
              "Non inventare valori mancanti.",
          },
          ...messages.map(m => ({
            role: m.role === "utente" ? "user" : "assistant",
            content: m.text,
          })),
        ],
        temperature: 0.2,
        max_completion_tokens: 1800,
      }),
    });

    const data = await res.json();
    console.log("TEXT RESPONSE", data);
    if (!res.ok) throw new Error(data?.error?.message || "Errore nella chiamata AI.");
    return data?.choices?.[0]?.message?.content || "Errore nella risposta AI.";
  };

  const analyzeExtractedText = async (chatId: string, file: File, attachment: Attachment, extractedText: string, instruction: string) => {
    const userMessage: Message = {
      role: "utente",
      text:
        `📎 File caricato: ${file.name}\n` +
        `Tipo: ${file.type || "sconosciuto"}\n` +
        `Dimensione: ${(file.size / 1024).toFixed(1)} KB\n\n` +
        `CONTENUTO ESTRATTO:\n${extractedText}`,
      attachments: [attachment],
    };

    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    const updatedMessages = [...oldMessages, userMessage];
    replaceMessagesInChat(chatId, updatedMessages);

    const aiText = await callTextAI([
      ...updatedMessages,
      { role: "utente", text: instruction },
    ]);

    replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || fileLoading || loading) return;

    const chatId = ensureActiveChat(`File: ${file.name}`);
    setFileLoading(true);

    try {
      const kind = getFileKind(file);
      const fileUrl = URL.createObjectURL(file);

      if (kind === "image") {
        const previewUrl = fileUrl;
        const imageDataUrl = await imageFileToResizedDataUrl(file);

        const userMessage: Message = {
          role: "utente",
          text:
            `🖼️ Immagine caricata: ${file.name}\n` +
            `Tipo: ${file.type || "sconosciuto"}\n` +
            `Dimensione: ${(file.size / 1024).toFixed(1)} KB\n\n` +
            "Richiesta: interpretazione tecnica dell'immagine.",
          attachments: [{ name: file.name, type: file.type, size: file.size, kind, url: previewUrl, previewUrls: [previewUrl] }],
        };

        const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
        const updatedMessages = [...oldMessages, userMessage];
        replaceMessagesInChat(chatId, updatedMessages);

        const aiText = await callVisionAI(
          [imageDataUrl],
          "Analizza questa immagine tecnica. Se è una tavola meccanica: identifica viste/sezioni, quote leggibili, tolleranze, rugosità, filettature, materiali, note, errori e mancanze. Se è uno screenshot CAD: spiega cosa si vede e cosa fare operativamente. Rispondi in italiano con sezioni: Cosa vedo, Problemi, Controlli consigliati, Azioni pratiche. Non inventare misure non leggibili."
        );

        replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
        return;
      }

      if (kind === "pdf" || kind === "docx" || kind === "spreadsheet" || kind === "zip") {
        const extractedText = await readUnavailableFile(file);
        await analyzeExtractedText(
          chatId,
          file,
          { name: file.name, type: file.type || "application/octet-stream", size: file.size, kind, url: fileUrl, extractedText },
          extractedText,
          `Spiega all'utente che il file "${file.name}" è stato ricevuto, ma questa build senza librerie non può leggerlo direttamente. Suggerisci il formato alternativo migliore: immagini per tavole/PDF, CSV per Excel, TXT per documenti.`
        );
        return;
      }

      if (kind === "text" || kind === "cad") {
        const extractedText = truncateText(await file.text());
        await analyzeExtractedText(
          chatId,
          file,
          { name: file.name, type: file.type || "text/plain", size: file.size, kind, url: fileUrl, extractedText },
          extractedText,
          kind === "cad"
            ? `Analizza il file CAD testuale "${file.name}". Se è STEP/STP/IGES, prova a riconoscere unità, intestazione, entità principali, nomi, geometrie base e limiti dell'analisi. Non fingere di aver ricostruito il 3D completo.`
            : `Analizza il file testuale "${file.name}" e dammi un report tecnico ordinato.`
        );
        return;
      }

      addMessageToChat(chatId, {
        role: "utente",
        text:
          `📦 File caricato: ${file.name}\n` +
          `Tipo: ${file.type || "sconosciuto"}\n` +
          `Dimensione: ${(file.size / 1024).toFixed(1)} KB\n\n` +
          "Formato non ancora interpretabile direttamente in questa versione frontend.",
        attachments: [{ name: file.name, type: file.type || "application/octet-stream", size: file.size, kind, url: fileUrl }],
      });

      addMessageToChat(chatId, {
        role: "AI",
        text: "File ricevuto, ma per interpretare questo formato serve un backend specifico o una libreria dedicata. Posso comunque tenerlo come allegato.",
      });
    } catch (error: any) {
      addMessageToChat(chatId, { role: "AI", text: error?.message || "Errore durante l'analisi del file." });
    } finally {
      setFileLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  const callAI = async () => {
    if (!query.trim() || loading || fileLoading) return;

    const text = query;
    const chatId = ensureActiveChat(text.slice(0, 32) + "...");
    setQuery("");
    setLoading(true);

    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    const updatedMessages: Message[] = [...oldMessages, { role: "utente", text }];
    replaceMessagesInChat(chatId, updatedMessages);

    try {
      const aiText = await callTextAI(updatedMessages);
      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
    } catch (error: any) {
      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: error?.message || "Errore API." }]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ themeName: theme.name, interest, user, chats, activeChatId, sidebarOpen, isAuthenticated }));
    setShowSettings(false);
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

  const renderAttachments = (attachments?: Attachment[]) => {
    if (!attachments?.length) return null;

    return (
      <div style={s.attachmentList}>
        {attachments.map((file, idx) => (
          <div key={`${file.name}-${idx}`} style={{ ...s.attachmentCard, border: `1px solid ${theme.border || theme.surface}` }}>
            {file.previewUrls?.length ? (
              <div style={s.previewGrid}>
                {file.previewUrls.slice(0, 5).map((url, i) => (
                  <img key={i} src={url} alt={`${file.name} preview ${i + 1}`} style={s.previewImage} />
                ))}
              </div>
            ) : file.type.startsWith("image/") && file.url ? (
              <img src={file.url} alt={file.name} style={s.previewImage} />
            ) : (
              <div style={s.fileChip}>📄 {file.name}</div>
            )}

            <div style={s.attachmentMeta}>
              <div style={{ fontWeight: 700 }}>{file.name}</div>
              <div style={{ opacity: 0.65, fontSize: 12 }}>{file.kind} · {(file.size / 1024).toFixed(1)} KB · {file.type || "tipo sconosciuto"}</div>
              {file.url && <a href={file.url} download={file.name} style={{ color: theme.primary, fontSize: 12, fontWeight: 700 }}>Apri/scarica allegato</a>}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.searchBar, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml,.png,.jpg,.jpeg,.webp,.gif,.pdf,.step,.stp,.iges,.igs,.zip,.docx,.xlsx,.xls"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <button style={{ ...s.fileBtn, color: theme.primary }} onClick={() => fileInputRef.current?.click()} title="Carica file o immagine" disabled={fileLoading || loading}>
        {fileLoading ? "…" : "📎"}
      </button>

      <textarea
        style={{ ...s.textarea, color: theme.text }}
        rows={1}
        value={query}
        placeholder={placeholder}
        onChange={e => {
          setQuery(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
        }}
        onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
      />

      <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || fileLoading}>➤</button>
    </div>
  );

  if (!isAuthenticated) return renderAuthScreen();

  return (
    <div style={{ ...s.app, backgroundColor: theme.bg, color: theme.text }}>
      <aside style={{ ...s.sidebar, width: sidebarOpen ? 280 : 74, minWidth: sidebarOpen ? 280 : 74, backgroundColor: isDark ? "#050505" : theme.bg, borderRight: `1px solid ${theme.border || theme.surface}` }}>
        <div style={{ ...s.sidebarTop, justifyContent: sidebarOpen ? "space-between" : "center" }}>
          {sidebarOpen && (
            <div style={s.logoWrap}>
              <div style={{ ...s.logoMark, backgroundColor: theme.primary }}>T</div>
              <div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div>
            </div>
          )}
          <button style={{ ...s.collapseBtn, color: theme.text, backgroundColor: sidebarOpen ? "transparent" : theme.surface, border: `1px solid ${theme.border || theme.surface}` }} onClick={() => setSidebarOpen(prev => !prev)}>☰</button>
        </div>

        <div style={{ ...s.iconNav, alignItems: sidebarOpen ? "stretch" : "center" }}>
          {iconBtn("＋", "Nuova", createNewChat)}
          {iconBtn("≡", "Chat", () => setSidebarOpen(true), sidebarOpen)}
          {iconBtn("⚙", "Impostazioni", () => { setActiveTab("Aspetto"); setShowSettings(true); })}
          {iconBtn("⇥", "Logout", handleLogout)}
        </div>

        {sidebarOpen && (
          <div style={s.chatHistory}>
            <div style={s.historyHeader}>Cronologia</div>
            {chats.length === 0 && <div style={{ fontSize: 12, opacity: 0.6, padding: "8px" }}>Nessuna chat salvata</div>}
            {chats.map(chat => (
              <div key={chat.id} style={{ ...s.historyItem, backgroundColor: chat.id === activeChatId ? theme.surface : "transparent", color: chat.id === activeChatId ? theme.primary : theme.text, border: `1px solid ${chat.id === activeChatId ? theme.border || theme.surface : "transparent"}` }}>
                <div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>{chat.title}</div>
                <button style={s.deleteBtn} onClick={() => deleteChat(chat.id)}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{ ...s.sidebarAccount, justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={() => { setActiveTab("Account"); setShowSettings(true); }}>
          <div style={{ ...s.avatar, backgroundColor: theme.primary }}>{user.name.charAt(0)}</div>
          {sidebarOpen && <div style={s.accountText}><div style={{ fontWeight: 700, fontSize: "13px" }}>{user.name}</div><div style={{ fontSize: "11px", opacity: 0.7 }}>Piano {user.plan || "Free"}</div></div>}
        </div>
      </aside>

      <main style={{ ...s.main, backgroundColor: theme.bg }}>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?</h1>
              {renderInputBar("Chiedi a TechAI o carica PDF, immagini, DOCX, XLSX, ZIP, STEP...")}
              <p style={s.fileHint}>PDF e immagini vengono analizzati visivamente; DOCX/XLSX/ZIP/testi vengono estratti e analizzati come testo.</p>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? { ...s.uBox, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` } : { ...s.aBox, color: theme.text }}>
                      {m.text}
                      {renderAttachments(m.attachments)}
                    </div>
                  </div>
                ))}
                {fileLoading && <div style={{ color: theme.primary, textAlign: "center" }}>📎 Lettura e interpretazione file...</div>}
                {loading && <div style={{ color: theme.primary, textAlign: "center" }}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file tecnico...")}</div>
            </div>
          )}
        </section>

        {showSettings && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={{ ...s.modalSide, background: isDark ? "#050505" : "#f8fafc", borderRight: `1px solid ${theme.border}` }}>
                {["Account", "Aspetto", "AI Focus"].map(t => <div key={t} onClick={() => setActiveTab(t)} style={{ ...s.tab, color: activeTab === t ? theme.primary : theme.text, fontWeight: activeTab === t ? 800 : 400 }}>{t}</div>)}
              </div>
              <div style={s.modalMain}>
                <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>{activeTab}</h2>
                {activeTab === "Account" && <div><label style={s.label}>Nome Visualizzato</label><input style={s.input} value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} /><label style={s.label}>Email</label><input style={s.input} value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} /><label style={s.label}>Telefono</label><input style={s.input} value={user.phone || ""} onChange={e => setUser({ ...user, phone: e.target.value })} /><div style={s.badge}>Account privato: predisposto per collegamento Supabase ✅</div></div>}
                {activeTab === "Aspetto" && <div style={s.themeGrid}>{THEMES.map(t => <div key={t.name} onClick={() => setTheme(t)} style={{ ...s.themeOption, background: theme.name === t.name ? theme.surface : "transparent", color: theme.text, border: theme.name === t.name ? `1px solid ${t.primary}` : `1px solid ${theme.border || "transparent"}` }}><div style={{ width: 12, height: 12, borderRadius: "50%", background: t.name === "Dark Black" ? "#0b0b0b" : t.primary, border: t.name === "Dark Black" ? "1px solid #f8fafc" : "none" }} />{t.name}</div>)}</div>}
                {activeTab === "AI Focus" && <div><label style={s.label}>Ambito Tecnico Principale</label><input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} /></div>}
                <button style={{ ...s.saveBtn, background: theme.primary }} onClick={saveAll}>Salva modifiche</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; transition: background 0.2s, color 0.2s, width 0.25s ease, min-width 0.25s ease; }
        html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; }
        textarea::placeholder { opacity: 0.55; }
        button:disabled { opacity: 0.45; cursor: not-allowed; }
        a { text-decoration: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  authPage: { minHeight: "100dvh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  authCard: { width: "min(430px, 100%)", borderRadius: 26, padding: 30, boxShadow: "0 24px 60px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", gap: 10 },
  authLogo: { fontSize: 24, fontWeight: 900, letterSpacing: "-1px", marginBottom: 8 },
  authTitle: { fontSize: 25, margin: "4px 0", letterSpacing: "-0.8px" },
  authSubtitle: { fontSize: 13, opacity: 0.68, lineHeight: 1.5, margin: "0 0 14px" },
  authInput: { width: "100%", padding: "13px 14px", borderRadius: 13, border: "1px solid rgba(120,120,120,0.25)", outline: "none", fontSize: 14, marginBottom: 10, background: "rgba(255,255,255,0.78)" },
  authPrimaryBtn: { width: "100%", padding: 14, border: "none", borderRadius: 14, color: "white", fontWeight: 800, cursor: "pointer", marginTop: 4 },
  authSecondaryBtn: { width: "100%", padding: 12, border: "1px solid rgba(120,120,120,0.25)", borderRadius: 13, background: "rgba(255,255,255,0.65)", cursor: "pointer", fontWeight: 700 },
  authSwitchBtn: { border: "none", background: "transparent", cursor: "pointer", fontWeight: 800, marginTop: 8 },
  authDivider: { textAlign: "center", fontSize: 12, opacity: 0.55, margin: "6px 0" },
  authError: { fontSize: 12, color: "#dc2626", background: "rgba(220,38,38,0.08)", padding: 10, borderRadius: 10, marginBottom: 4 },
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", minWidth: 0 },
  sidebar: { height: "100dvh", padding: "10px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { display: "flex", alignItems: "center", gap: 8, minHeight: 50, flexShrink: 0 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { width: 34, height: 34, borderRadius: 12, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  logoText: { fontSize: 21, fontWeight: 900, letterSpacing: "-1px", whiteSpace: "nowrap" },
  collapseBtn: { width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  iconNav: { display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 },
  iconBtn: { minHeight: 44, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 700, background: "transparent", textAlign: "left", flexShrink: 0 },
  icon: { width: 22, height: 22, display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: 15, fontWeight: 600, opacity: 0.88, letterSpacing: "-1px", flexShrink: 0 },
  iconLabel: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  chatHistory: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 },
  historyHeader: { fontSize: 11, textTransform: "uppercase", fontWeight: 800, opacity: 0.5, padding: "6px 8px" },
  historyItem: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "8px 10px", fontSize: 13, cursor: "pointer" },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 },
  deleteBtn: { border: "none", background: "transparent", cursor: "pointer", fontSize: 18, opacity: 0.55 },
  sidebarAccount: { display: "flex", alignItems: "center", gap: 10, minHeight: 48, padding: "7px", cursor: "pointer", borderRadius: 14, marginTop: "auto", flexShrink: 0 },
  avatar: { width: 38, height: 38, borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 14, flexShrink: 0 },
  accountText: { display: "flex", flexDirection: "column", minWidth: 0 },
  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: 720, textAlign: "center", padding: "0 22px" },
  welcomeText: { fontSize: "clamp(25px, 4vw, 38px)", fontWeight: 600, marginBottom: 30, letterSpacing: "-1px" },
  searchBar: { display: "flex", alignItems: "center", borderRadius: 28, padding: "6px 16px", width: "100%", minHeight: 56, boxShadow: "0 8px 24px rgba(0,0,0,0.04)", backdropFilter: "blur(10px)", flexShrink: 0 },
  fileBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", marginRight: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85, fontSize: 19 },
  textarea: { flex: 1, minWidth: 0, maxHeight: 140, background: "none", border: "none", outline: "none", textAlign: "center", fontSize: 16, resize: "none", padding: "10px 0", overflowY: "auto" },
  sendBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 20, marginLeft: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.9 },
  fileHint: { fontSize: 12, opacity: 0.58, marginTop: 12 },
  chatView: { width: "100%", maxWidth: 900, flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "14px 22px", overflow: "hidden" },
  msgList: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 18, padding: "10px 0" },
  uRow: { display: "flex", justifyContent: "flex-end" },
  aRow: { display: "flex", justifyContent: "flex-start" },
  uBox: { padding: "13px 18px", borderRadius: 20, maxWidth: "82%", fontSize: 15, whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  aBox: { padding: "10px 0", lineHeight: 1.7, fontSize: 16, whiteSpace: "pre-wrap", maxWidth: "92%", overflowWrap: "anywhere" },
  bottomInput: { padding: "10px 0 8px", flexShrink: 0 },
  attachmentList: { marginTop: 12, display: "flex", flexDirection: "column", gap: 10 },
  attachmentCard: { borderRadius: 14, padding: 10, background: "rgba(255,255,255,0.35)", display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 },
  previewGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 8 },
  previewImage: { width: "100%", maxWidth: 330, maxHeight: 260, objectFit: "contain", borderRadius: 12, display: "block", background: "rgba(0,0,0,0.04)" },
  fileChip: { padding: "10px 12px", borderRadius: 10, background: "rgba(120,120,120,0.12)", fontSize: 13, fontWeight: 700, overflowWrap: "anywhere" },
  attachmentMeta: { display: "flex", flexDirection: "column", gap: 4, fontSize: 13, overflowWrap: "anywhere" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 },
  modal: { borderRadius: 24, width: "min(620px, 100%)", height: "min(450px, calc(100dvh - 32px))", display: "flex", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.25)" },
  modalSide: { width: 170, padding: 24, display: "flex", flexDirection: "column", gap: 15, flexShrink: 0 },
  modalMain: { flex: 1, minWidth: 0, padding: 32, display: "flex", flexDirection: "column", overflowY: "auto" },
  tab: { cursor: "pointer", fontSize: 14 },
  label: { fontSize: 11, fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: 8, display: "block" },
  input: { width: "100%", padding: 12, borderRadius: 12, border: "1px solid #e2e8f0", marginBottom: 20, outline: "none", fontSize: 14 },
  badge: { fontSize: 12, color: "#10b981", fontWeight: 700, background: "#f0fdf4", padding: 10, borderRadius: 10, textAlign: "center" },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(135px, 1fr))", gap: 10 },
  themeOption: { padding: 12, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 700 },
  saveBtn: { marginTop: "auto", padding: 14, border: "none", borderRadius: 14, color: "white", fontWeight: 700, cursor: "pointer" },
};
