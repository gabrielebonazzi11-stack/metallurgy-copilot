import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b", border: "#dbeafe" },
  { name: "Slate Grey", primary: "#475569", bg: "#e5e7eb", surface: "#cbd5e1", text: "#1e293b", border: "#94a3b8" },
  { name: "Forest Green", primary: "#22c55e", bg: "#f0fdf4", surface: "#dcfce7", text: "#14532d", border: "#bbf7d0" },
  { name: "Deep Burgundy", primary: "#dc2626", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d", border: "#fecaca" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#f5f5f4", surface: "#e7e5e4", text: "#44403c", border: "#d6d3d1" },
  { name: "Dark Black", primary: "#60a5fa", bg: "#050505", surface: "#111111", text: "#f8fafc", border: "#262626" },
];

type Role = "utente" | "AI";

interface Message {
  role: Role;
  text: string;
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

const defaultUser: UserProfile = {
  name: "Mario Rossi",
  email: "mario.rossi@tech.it",
};

const STORAGE_KEY = "techai_ultimate_v5_slide_sidebar";

export default function App() {
  const [query, setQuery] = useState("");
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
    } catch {
      console.warn("Impossibile leggere il salvataggio locale.");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats,
        activeChatId,
        sidebarOpen,
      })
    );
  }, [theme, interest, user, chats, activeChatId, sidebarOpen]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading, fileLoading]);

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

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev =>
      prev.map(chat => (chat.id === chatId ? { ...chat, messages } : chat))
    );
  };

  const isSupportedTextFile = (file: File) => {
    const name = file.name.toLowerCase();
    const type = file.type;

    return (
      type.startsWith("text/") ||
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
      name.endsWith(".yml")
    );
  };

  const readTextFile = async (file: File) => {
    if (!isSupportedTextFile(file)) {
      throw new Error(
        "Formato non leggibile senza librerie. Questa versione supporta solo file testuali: TXT, CSV, JSON, MD, XML, HTML, CSS, JS, TS, TSX e simili."
      );
    }

    return await file.text();
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || fileLoading) return;

    const chatId = ensureActiveChat(`File: ${file.name}`);
    setFileLoading(true);

    try {
      const extractedText = await readTextFile(file);
      const cleanedText = extractedText.trim();

      addMessageToChat(chatId, {
        role: "utente",
        text:
          `📎 File caricato: ${file.name}
` +
          `Tipo: ${file.type || "sconosciuto"}
` +
          `Dimensione: ${(file.size / 1024).toFixed(1)} KB

` +
          `CONTENUTO DEL FILE:
${cleanedText || "Il file risulta vuoto."}`,
      });

      setQuery(`Analizza il file "${file.name}" e fammi un riassunto chiaro dei punti principali.`);
    } catch (error: any) {
      addMessageToChat(chatId, {
        role: "AI",
        text: error?.message || "Non sono riuscito a leggere il file.",
      });
    } finally {
      setFileLoading(false);
      if (event.target) event.target.value = "";
    }
  };

  const callAI = async () => {
    if (!query.trim() || loading) return;

    const text = query;
    const chatId = ensureActiveChat(text.slice(0, 32) + "...");
    setQuery("");
    setLoading(true);

    const oldMessages = chats.find(c => c.id === chatId)?.messages || [];
    const updatedMessages: Message[] = [...oldMessages, { role: "utente", text }];

    replaceMessagesInChat(chatId, updatedMessages);

    try {
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
                "Rispondi in modo chiaro, tecnico e ordinato. Se l'utente carica un file, analizza il contenuto testuale presente in chat.",
            },
            ...updatedMessages.map(m => ({
              role: m.role === "utente" ? "user" : "assistant",
              content: m.text,
            })),
          ],
        }),
      });

      const data = await res.json();
      const aiText = data?.choices?.[0]?.message?.content || "Errore nella risposta AI.";

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
    } catch {
      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        { role: "AI", text: "Errore API. Controlla chiave API, connessione o limiti del modello." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveAll = () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        themeName: theme.name,
        interest,
        user,
        chats,
        activeChatId,
        sidebarOpen,
      })
    );
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

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.searchBar, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <button
        style={{ ...s.fileBtn, color: theme.primary }}
        onClick={() => fileInputRef.current?.click()}
        title="Carica file testuale"
        disabled={fileLoading}
      >
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

      <button
        style={{ ...s.sendBtn, color: theme.primary }}
        onClick={callAI}
        disabled={loading || fileLoading}
      >
        ➤
      </button>
    </div>
  );

  return (
    <div style={{ ...s.app, backgroundColor: theme.bg, color: theme.text }}>
      <aside
        style={{
          ...s.sidebar,
          width: sidebarOpen ? 280 : 74,
          minWidth: sidebarOpen ? 280 : 74,
          backgroundColor: isDark ? "#050505" : theme.bg,
          borderRight: `1px solid ${theme.border || theme.surface}`,
        }}
      >
        <div style={{ ...s.sidebarTop, justifyContent: sidebarOpen ? "space-between" : "center" }}>
          {sidebarOpen && (
            <div style={s.logoWrap}>
              <div style={{ ...s.logoMark, backgroundColor: theme.primary }}>T</div>
              <div style={s.logoText}>
                TECH<span style={{ color: theme.primary }}>AI</span>
              </div>
            </div>
          )}

          <button
            style={{
              ...s.collapseBtn,
              color: theme.text,
              backgroundColor: sidebarOpen ? "transparent" : theme.surface,
              border: `1px solid ${theme.border || theme.surface}`,
            }}
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? "Chiudi barra laterale" : "Apri barra laterale"}
          >
            {sidebarOpen ? "☰" : "☰"}
          </button>
        </div>

        <div style={{ ...s.iconNav, alignItems: sidebarOpen ? "stretch" : "center" }}>
          {iconBtn("＋", "Nuova", createNewChat)}
          {iconBtn("≡", "Chat", () => setSidebarOpen(true), sidebarOpen)}
          {iconBtn("⚙", "Impostazioni", () => { setActiveTab("Aspetto"); setShowSettings(true); })}
        </div>

        {sidebarOpen && (
          <div style={s.chatHistory}>
            <div style={s.historyHeader}>Cronologia</div>

            {chats.length === 0 && (
              <div style={{ fontSize: 12, opacity: 0.6, padding: "8px" }}>Nessuna chat salvata</div>
            )}

            {chats.map(chat => (
              <div
                key={chat.id}
                style={{
                  ...s.historyItem,
                  backgroundColor: chat.id === activeChatId ? theme.surface : "transparent",
                  color: chat.id === activeChatId ? theme.primary : theme.text,
                  border: `1px solid ${chat.id === activeChatId ? theme.border || theme.surface : "transparent"}`,
                }}
              >
                <div style={s.historyTitle} onClick={() => setActiveChatId(chat.id)}>
                  {chat.title}
                </div>

                <button style={s.deleteBtn} onClick={() => deleteChat(chat.id)} title="Elimina chat">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div
          style={{ ...s.sidebarAccount, justifyContent: sidebarOpen ? "flex-start" : "center" }}
          onClick={() => { setActiveTab("Account"); setShowSettings(true); }}
        >
          <div style={{ ...s.avatar, backgroundColor: theme.primary }}>{user.name.charAt(0)}</div>

          {sidebarOpen && (
            <div style={s.accountText}>
              <div style={{ fontWeight: 700, fontSize: "13px" }}>{user.name}</div>
              <div style={{ fontSize: "11px", opacity: 0.7 }}>Piano Pro</div>
            </div>
          )}
        </div>
      </aside>

      <main style={{ ...s.main, backgroundColor: theme.bg }}>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?</h1>
              {renderInputBar("Chiedi a TechAI o carica un file testuale...")}
              <p style={s.fileHint}>Supporta file testuali: TXT, CSV, JSON, MD, XML, HTML, CSS, JS, TS, TSX.</p>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div
                      style={
                        m.role === "utente"
                          ? { ...s.uBox, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }
                          : { ...s.aBox, color: theme.text }
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {fileLoading && <div style={{ color: theme.primary, textAlign: "center" }}>📎 Lettura file in corso...</div>}
                {loading && <div style={{ color: theme.primary, textAlign: "center" }}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file testuale...")}</div>
            </div>
          )}
        </section>

        {showSettings && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={{ ...s.modalSide, background: isDark ? "#050505" : "#f8fafc", borderRight: `1px solid ${theme.border}` }}>
                {["Account", "Aspetto", "AI Focus"].map(t => (
                  <div
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{ ...s.tab, color: activeTab === t ? theme.primary : theme.text, fontWeight: activeTab === t ? 800 : 400 }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div style={s.modalMain}>
                <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>{activeTab}</h2>

                {activeTab === "Account" && (
                  <div>
                    <label style={s.label}>Nome Visualizzato</label>
                    <input style={s.input} value={user.name} onChange={e => setUser({ ...user, name: e.target.value })} />

                    <label style={s.label}>Email</label>
                    <input style={s.input} value={user.email} onChange={e => setUser({ ...user, email: e.target.value })} />

                    <div style={s.badge}>Stato Account: Abbonamento Attivo ✅</div>
                  </div>
                )}

                {activeTab === "Aspetto" && (
                  <div style={s.themeGrid}>
                    {THEMES.map(t => (
                      <div
                        key={t.name}
                        onClick={() => setTheme(t)}
                        style={{
                          ...s.themeOption,
                          background: theme.name === t.name ? theme.surface : "transparent",
                          color: theme.text,
                          border:
                            theme.name === "Dark Black"
                              ? theme.name === t.name
                                ? "1px solid #5b5b5b"
                                : "1px solid #2f2f2f"
                              : theme.name === t.name
                                ? `1px solid ${t.primary}`
                                : `1px solid ${theme.border || "transparent"}`,
                          boxShadow:
                            theme.name === "Dark Black" && theme.name === t.name
                              ? "0 0 0 1px rgba(255,255,255,0.06) inset"
                              : "none",
                        }}
                      >
                        <div
                          style={{
                            width: 12,
                            height: 12,
                            borderRadius: "50%",
                            background: t.name === "Dark Black" ? "#0b0b0b" : t.primary,
                            border: t.name === "Dark Black" ? "1px solid #f8fafc" : "none",
                          }}
                        />
                        {t.name}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "AI Focus" && (
                  <div>
                    <label style={s.label}>Ambito Tecnico Principale</label>
                    <input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} />
                  </div>
                )}

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
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(120,120,120,0.35); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", minWidth: 0 },

  sidebar: {
    height: "100dvh",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflow: "hidden",
    flexShrink: 0,
  },

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
  fileBtn: { width: 34, height: 34, background: "none", border: "none", cursor: "pointer", fontSize: 22, marginRight: 6, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.85 },
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
