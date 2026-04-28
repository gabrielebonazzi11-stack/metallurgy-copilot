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

const STORAGE_KEY = "techai_ultimate_v4_no_libs";

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");

  const [user, setUser] = useState<UserProfile>(defaultUser);
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);
  const currentMessages = activeChat?.messages || [];

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
      })
    );
  }, [theme, interest, user, chats, activeChatId]);

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

      const fileMessage: Message = {
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
      };

      addMessageToChat(chatId, fileMessage);

      setQuery(
        `Analizza il file "${file.name}" e fammi un riassunto chiaro dei punti principali.`
      );
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
      })
    );
    setShowSettings(false);
  };

  const renderInputBar = (placeholder: string) => (
    <div style={{ ...s.searchBar, backgroundColor: theme.surface }}>
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
        {fileLoading ? "⏳" : "📎"}
      </button>

      <textarea
        style={{ ...s.textarea, color: theme.text }}
        rows={1}
        value={query}
        placeholder={placeholder}
        onChange={e => {
          setQuery(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = e.target.scrollHeight + "px";
        }}
        onKeyDown={e =>
          e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())
        }
      />

      <button
        style={{ ...s.sendBtn, color: theme.primary }}
        onClick={callAI}
        disabled={loading || fileLoading}
      >
        🚀
      </button>
    </div>
  );

  return (
    <div key={theme.name} style={{ ...s.app, backgroundColor: theme.bg, color: theme.text }}>
      <aside style={{ ...s.sidebar, backgroundColor: theme.bg, borderRight: `1px solid ${theme.border || theme.surface}` }}>
        <div style={s.logo}>
          TECH<span style={{ color: theme.primary }}>AI</span>
        </div>

        <button style={{ ...s.newChatBtn, backgroundColor: theme.primary }} onClick={createNewChat}>
          ＋ Nuova chat
        </button>

        <div style={s.chatHistory}>
          {chats.length === 0 && (
            <div style={{ fontSize: 12, opacity: 0.6 }}>Nessuna chat salvata</div>
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
                💬 {chat.title}
              </div>

              <button style={s.deleteBtn} onClick={() => deleteChat(chat.id)}>
                ×
              </button>
            </div>
          ))}
        </div>

        <div
          style={s.sidebarAccount}
          onClick={() => {
            setActiveTab("Account");
            setShowSettings(true);
          }}
        >
          <div style={{ ...s.avatar, backgroundColor: theme.primary }}>
            {user.name.charAt(0)}
          </div>

          <div style={s.accountText}>
            <div style={{ fontWeight: 700, fontSize: "13px" }}>{user.name}</div>
            <div style={{ fontSize: "11px", opacity: 0.7 }}>Piano Pro</div>
          </div>
        </div>

        <div
          style={{ ...s.settingsBtn, color: theme.text }}
          onClick={() => {
            setActiveTab("Aspetto");
            setShowSettings(true);
          }}
        >
          ⚙️ Impostazioni
        </div>
      </aside>

      <main style={{ ...s.main, backgroundColor: theme.bg }}>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>
                Benvenuto {user.name.split(" ")[0]}, come posso aiutarti?
              </h1>
              {renderInputBar("Chiedi a TechAI o carica un file testuale...")}
              <p style={s.fileHint}>
                Versione senza librerie: supporta file testuali come TXT, CSV, JSON, MD, XML, HTML, CSS, JS, TS e TSX.
              </p>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {currentMessages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div
                      style={
                        m.role === "utente"
                          ? { ...s.uBox, backgroundColor: theme.surface }
                          : s.aBox
                      }
                    >
                      {m.text}
                    </div>
                  </div>
                ))}

                {fileLoading && (
                  <div style={{ color: theme.primary, textAlign: "center" }}>
                    📎 Lettura file in corso...
                  </div>
                )}

                {loading && (
                  <div style={{ color: theme.primary, textAlign: "center" }}>
                    ✨ TechAI sta elaborando...
                  </div>
                )}

                <div ref={chatEndRef} />
              </div>

              <div style={s.bottomInput}>{renderInputBar("Scrivi qui o carica un file testuale...")}</div>
            </div>
          )}
        </section>

        {showSettings && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalSide}>
                {["Account", "Aspetto", "AI Focus"].map(t => (
                  <div
                    key={t}
                    onClick={() => setActiveTab(t)}
                    style={{
                      ...s.tab,
                      color: activeTab === t ? theme.primary : "",
                      fontWeight: activeTab === t ? 800 : 400,
                    }}
                  >
                    {t}
                  </div>
                ))}
              </div>

              <div style={s.modalMain}>
                <h2 style={{ fontSize: "18px", marginBottom: "20px" }}>{activeTab}</h2>

                {activeTab === "Account" && (
                  <div style={s.form}>
                    <label style={s.label}>Nome Visualizzato</label>
                    <input
                      style={s.input}
                      value={user.name}
                      onChange={e => setUser({ ...user, name: e.target.value })}
                    />

                    <label style={s.label}>Email</label>
                    <input
                      style={s.input}
                      value={user.email}
                      onChange={e => setUser({ ...user, email: e.target.value })}
                    />

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
                          color: theme.name === "Dark Black" ? "#f8fafc" : "#1e293b",
                          border: theme.name === t.name ? `1px solid ${t.primary}` : `1px solid ${theme.border || "transparent"}`,
                        }}
                      >
                        <div style={{ width: 12, height: 12, borderRadius: "50%", background: t.primary }} />
                        {t.name}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "AI Focus" && (
                  <div style={s.form}>
                    <label style={s.label}>Ambito Tecnico Principale</label>
                    <input
                      style={s.input}
                      value={interest}
                      onChange={e => setInterest(e.target.value)}
                    />
                  </div>
                )}

                <button style={{ ...s.saveBtn, background: theme.primary }} onClick={saveAll}>
                  Salva modifiche
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');

        * {
          font-family: 'Inter', sans-serif !important;
          box-sizing: border-box;
          transition: background 0.2s, color 0.2s;
        }

        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: "flex", height: "100dvh", width: "100vw", overflow: "hidden", minWidth: 0 },
  sidebar: { width: "260px", minWidth: "230px", maxWidth: "260px", height: "100dvh", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", overflow: "hidden" },
  logo: { fontSize: "22px", fontWeight: 900, marginBottom: "20px", letterSpacing: "-1px" },
  newChatBtn: { border: "none", borderRadius: "12px", padding: "12px", color: "white", fontWeight: 700, cursor: "pointer", marginBottom: "10px" },
  chatHistory: { flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" },
  historyItem: { display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: "10px", padding: "8px 10px", fontSize: "13px", cursor: "pointer" },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 },
  deleteBtn: { border: "none", background: "transparent", cursor: "pointer", fontSize: "18px", opacity: 0.5 },
  sidebarAccount: { display: "flex", alignItems: "center", gap: "10px", padding: "15px 10px", cursor: "pointer", borderRadius: "12px", marginBottom: "5px" },
  avatar: { width: "32px", height: "32px", borderRadius: "50%", color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "14px" },
  accountText: { display: "flex", flexDirection: "column" },
  settingsBtn: { padding: "15px 10px", cursor: "pointer", borderTop: "1px solid rgba(0,0,0,0.05)", fontSize: "13px", fontWeight: 600 },
  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: "650px", textAlign: "center", padding: "0 20px" },
  welcomeText: { fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 600, marginBottom: "32px", letterSpacing: "-1px" },
  searchBar: { display: "flex", alignItems: "center", borderRadius: "32px", padding: "8px 20px", width: "100%", minHeight: "60px", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" },
  fileBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "22px", marginRight: "8px" },
  textarea: { flex: 1, background: "none", border: "none", outline: "none", textAlign: "center", fontSize: "17px", resize: "none", padding: "10px 0" },
  sendBtn: { background: "none", border: "none", cursor: "pointer", fontSize: "22px", marginLeft: "8px" },
  fileHint: { fontSize: "12px", opacity: 0.6, marginTop: "14px" },
  chatView: { width: "100%", maxWidth: "850px", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "16px 20px", overflow: "hidden" },
  msgList: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: "18px", padding: "12px 0" },
  uRow: { display: "flex", justifyContent: "flex-end" },
  aRow: { display: "flex", justifyContent: "flex-start" },
  uBox: { padding: "14px 22px", borderRadius: "22px", maxWidth: "80%", fontSize: "15px", whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
  aBox: { padding: "12px 0", lineHeight: "1.7", fontSize: "16px", whiteSpace: "pre-wrap", maxWidth: "90%", overflowWrap: "anywhere" },
  bottomInput: { padding: "12px 0 8px", flexShrink: 0 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 },
  modal: { background: "white", borderRadius: "24px", width: "min(600px, calc(100vw - 32px))", height: "min(450px, calc(100dvh - 32px))", display: "flex", overflow: "hidden", color: "#1e293b", boxShadow: "0 30px 60px rgba(0,0,0,0.2)" },
  modalSide: { width: "180px", background: "#f8fafc", padding: "30px", borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "15px" },
  modalMain: { flex: 1, padding: "40px", display: "flex", flexDirection: "column" },
  tab: { cursor: "pointer", fontSize: "14px" },
  label: { fontSize: "11px", fontWeight: 800, color: "#94a3b8", textTransform: "uppercase", marginBottom: "8px", display: "block" },
  input: { width: "100%", padding: "12px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "20px", outline: "none", fontSize: "14px" },
  badge: { fontSize: "12px", color: "#10b981", fontWeight: 700, background: "#f0fdf4", padding: "10px", borderRadius: "10px", textAlign: "center" },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" },
  themeOption: { padding: "12px", borderRadius: "12px", cursor: "pointer", display: "flex", alignItems: "center", gap: "12px", fontSize: "13px" },
  saveBtn: { marginTop: "auto", padding: "15px", border: "none", borderRadius: "15px", color: "white", fontWeight: 700, cursor: "pointer" },
};

