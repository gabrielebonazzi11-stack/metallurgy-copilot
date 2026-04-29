import React, { useEffect, useRef, useState } from "react";

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
  attachment: FileAttachment;
}

interface Message {
  role: Role;
  text: string;
  fileAttachment?: FileAttachment;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
}

interface SafeStoredState {
  themeName: string;
  sidebarOpen: boolean;
  chats: ChatSession[];
  activeChatId: string | null;
}

const STORAGE_KEY = "techai_frontend_safe_v1";

export default function App() {
  const [query, setQuery] = useState("");
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<PendingFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileLoading, setFileLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [theme, setTheme] = useState(THEMES[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [showPrivacyInfo, setShowPrivacyInfo] = useState(false);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeChat = chats.find(chat => chat.id === activeChatId);
  const currentMessages = activeChat?.messages || [];
  const isDark = theme.name === "Dark Black";

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;

    try {
      const parsed: SafeStoredState = JSON.parse(saved);
      setTheme(THEMES.find(t => t.name === parsed.themeName) || THEMES[0]);
      setSidebarOpen(parsed.sidebarOpen ?? true);
      setChats(parsed.chats || []);
      setActiveChatId(parsed.activeChatId || null);
    } catch {
      console.warn("Salvataggio locale non leggibile.");
    }
  }, []);

  useEffect(() => {
    const safeState: SafeStoredState = {
      themeName: theme.name,
      sidebarOpen,
      chats,
      activeChatId,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(safeState));
  }, [theme, sidebarOpen, chats, activeChatId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentMessages, loading]);

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
  };

  const ensureActiveChat = (title = "Nuova chat") => {
    if (activeChatId) return activeChatId;

    const newChat = createChatObject(title);
    setChats(prev => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    return newChat.id;
  };

  const deleteChat = (id: string) => {
    setChats(prev => prev.filter(chat => chat.id !== id));
    if (activeChatId === id) setActiveChatId(null);
  };

  const replaceMessagesInChat = (chatId: string, messages: Message[]) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;

        const firstUserMessage = messages.find(m => m.role === "utente")?.text || "Nuova chat";
        const shouldRename = chat.title === "Nuova chat" || chat.title.startsWith("File:");

        return {
          ...chat,
          messages,
          title: shouldRename ? firstUserMessage.slice(0, 38) + (firstUserMessage.length > 38 ? "..." : "") : chat.title,
        };
      })
    );
  };

  const addMessageToChat = (chatId: string, message: Message) => {
    setChats(prev =>
      prev.map(chat => {
        if (chat.id !== chatId) return chat;
        return { ...chat, messages: [...chat.messages, message] };
      })
    );
  };

  const isSupportedFile = (file: File) => {
    const allowedExtensions = [
      ".txt", ".md", ".csv", ".json", ".xml", ".html", ".css", ".js", ".jsx", ".ts", ".tsx",
      ".py", ".java", ".cpp", ".c", ".h", ".sql", ".yaml", ".yml", ".pdf", ".docx", ".xlsx",
      ".png", ".jpg", ".jpeg", ".webp",
    ];

    const lowerName = file.name.toLowerCase();
    return allowedExtensions.some(ext => lowerName.endsWith(ext));
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || fileLoading) return;

    if (!isSupportedFile(file)) {
      alert("Formato file non supportato.");
      if (event.target) event.target.value = "";
      return;
    }

    setFileLoading(true);

    try {
      setPendingFile({
        file,
        attachment: {
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
    if ((!query.trim() && !pendingFile) || loading) return;

    const text = query.trim() || (pendingFile ? `Analizza il file "${pendingFile.attachment.name}".` : "");
    const chatId = ensureActiveChat(pendingFile ? `File: ${pendingFile.attachment.name}` : text.slice(0, 32) + "...");

    const userMessage: Message = {
      role: "utente",
      text,
      fileAttachment: pendingFile?.attachment,
    };

    const oldMessages = chats.find(chat => chat.id === chatId)?.messages || [];
    const updatedMessages = [...oldMessages, userMessage];

    replaceMessagesInChat(chatId, updatedMessages);
    setQuery("");
    setPendingFile(null);
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", text);
      formData.append("messages", JSON.stringify(updatedMessages.map(m => ({ role: m.role, text: m.text }))));

      if (pendingFile) {
        formData.append("file", pendingFile.file);
        formData.append("fileMeta", JSON.stringify(pendingFile.attachment));
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Errore dal backend. Controlla che /api/chat sia attivo.");
      }

      const data = await response.json();
      const aiText = data?.answer || data?.message || "Risposta non valida dal backend.";

      replaceMessagesInChat(chatId, [...updatedMessages, { role: "AI", text: aiText }]);
    } catch (error: any) {
      replaceMessagesInChat(chatId, [
        ...updatedMessages,
        {
          role: "AI",
          text:
            "⚠️ Non riesco a contattare il backend.\n\n" +
            "Per usare l'AI in modo sicuro devi avere un endpoint backend tipo `/api/chat` che riceve il messaggio, usa la chiave API privata e restituisce la risposta.\n\n" +
            `Dettaglio: ${error?.message || "errore sconosciuto"}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
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

      return block.split("\n").map((line, lineIndex) => {
        const trimmed = line.trim();
        const key = `line-${blockIndex}-${lineIndex}`;

        if (!trimmed) return <div key={key} style={{ height: 10 }} />;

        if (trimmed.startsWith("### ")) {
          return <h3 key={key} style={{ ...s.aiHeading3, color: theme.primary }}>{trimmed.replace("### ", "")}</h3>;
        }

        if (trimmed.startsWith("## ")) {
          return <h2 key={key} style={{ ...s.aiHeading2, color: theme.primary }}>{trimmed.replace("## ", "")}</h2>;
        }

        if (trimmed.startsWith("# ")) {
          return <h1 key={key} style={{ ...s.aiHeading1, color: theme.primary }}>{trimmed.replace("# ", "")}</h1>;
        }

        if (trimmed.startsWith("**") && trimmed.endsWith("**")) {
          return (
            <div key={key} style={{ ...s.messageTitle, color: theme.primary, borderBottom: `1px solid ${theme.border || theme.surface}` }}>
              {trimmed.replace(/\*\*/g, "")}
            </div>
          );
        }

        if (trimmed === "---") {
          return <hr key={key} style={{ border: "none", borderTop: `1px solid ${theme.border || "rgba(120,120,120,0.25)"}`, margin: "18px 0" }} />;
        }

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
            <div
              key={key}
              style={{
                ...s.highlightBox,
                borderLeft: `4px solid ${theme.primary}`,
                background: isDark ? "rgba(96,165,250,0.08)" : "rgba(59,130,246,0.08)",
              }}
            >
              {renderInlineFormatting(line)}
            </div>
          );
        }

        if (trimmed.startsWith("$$") || trimmed.startsWith("\\[") || trimmed.includes("\\frac") || trimmed.includes("\\cdot")) {
          return (
            <div key={key} style={{ ...s.formulaPrettyBox, background: isDark ? "#050505" : "#f8fafc", border: `1px solid ${theme.border}` }}>
              {line}
            </div>
          );
        }

        return <div key={key} style={s.messageLine}>{renderInlineFormatting(line)}</div>;
      });
    });
  };

  const renderInputBar = () => (
    <div style={{ ...s.inputComposer, backgroundColor: theme.surface, border: `1px solid ${theme.border || theme.surface}` }}>
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.csv,.json,.xml,.html,.css,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.sql,.yaml,.yml,.pdf,.docx,.xlsx,.png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {pendingFile && (
        <div style={{ ...s.pendingFileChip, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "rgba(255,255,255,0.72)" }}>
          <div style={{ ...s.pendingFileIcon, background: theme.primary }}>📄</div>
          <div style={s.pendingFileMeta}>
            <div style={s.pendingFileName}>{pendingFile.attachment.name}</div>
            <div style={s.pendingFileSub}>{(pendingFile.attachment.size / 1024).toFixed(1)} KB · pronto da inviare al backend</div>
          </div>
          <button style={{ ...s.pendingFileRemove, color: theme.text, border: `1px solid ${theme.border}` }} onClick={removePendingFile} title="Rimuovi file" type="button">
            ×
          </button>
        </div>
      )}

      <div style={s.searchBarInner}>
        <button style={{ ...s.fileBtn, color: theme.primary }} onClick={() => fileInputRef.current?.click()} title="Carica file" disabled={fileLoading || loading}>
          {fileLoading ? "…" : "📎"}
        </button>

        <textarea
          style={{ ...s.textarea, color: theme.text }}
          rows={1}
          value={query}
          placeholder={pendingFile ? "Scrivi cosa vuoi fare con il file..." : "Scrivi un messaggio o carica un file..."}
          onChange={event => {
            setQuery(event.target.value);
            event.target.style.height = "auto";
            event.target.style.height = Math.min(event.target.scrollHeight, 140) + "px";
          }}
          onKeyDown={event => event.key === "Enter" && !event.shiftKey && (event.preventDefault(), callAI())}
        />

        <button style={{ ...s.sendBtn, color: theme.primary }} onClick={callAI} disabled={loading || (!query.trim() && !pendingFile)}>
          ➤
        </button>
      </div>
    </div>
  );

  const renderFileCard = (attachment: FileAttachment) => (
    <div style={{ ...s.sentFileCard, border: `1px solid ${theme.border}`, background: "rgba(120,120,120,0.10)" }}>
      <div style={{ ...s.sentFileIcon, background: theme.primary }}>📄</div>
      <div style={{ minWidth: 0 }}>
        <div style={s.sentFileName}>{attachment.name}</div>
        <div style={s.sentFileSub}>{(attachment.size / 1024).toFixed(1)} KB · inviato al backend</div>
      </div>
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
              <div style={s.logoText}>TECH<span style={{ color: theme.primary }}>AI</span></div>
            </div>
          )}

          <button
            style={{ ...s.collapseBtn, color: theme.text, backgroundColor: sidebarOpen ? "transparent" : theme.surface, border: `1px solid ${theme.border || theme.surface}` }}
            onClick={() => setSidebarOpen(prev => !prev)}
            title={sidebarOpen ? "Chiudi barra laterale" : "Apri barra laterale"}
          >
            ☰
          </button>
        </div>

        <div style={{ ...s.iconNav, alignItems: sidebarOpen ? "stretch" : "center" }}>
          <button style={{ ...s.iconBtn, color: theme.text, justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={createNewChat}>
            <span style={s.icon}>＋</span>
            {sidebarOpen && <span>Nuova chat</span>}
          </button>

          <button style={{ ...s.iconBtn, color: theme.text, justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={() => setShowPrivacyInfo(true)}>
            <span style={s.icon}>🔒</span>
            {sidebarOpen && <span>Sicurezza</span>}
          </button>

          <button style={{ ...s.iconBtn, color: theme.text, justifyContent: sidebarOpen ? "flex-start" : "center" }} onClick={() => setShowSettings(true)}>
            <span style={s.icon}>⚙</span>
            {sidebarOpen && <span>Impostazioni</span>}
          </button>
        </div>

        {sidebarOpen && (
          <div style={s.chatHistory}>
            <div style={s.historyHeader}>Cronologia sicura</div>
            {chats.length === 0 && <div style={s.emptyHistory}>Nessuna chat salvata</div>}
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

        {sidebarOpen && (
          <div style={{ ...s.safeNote, border: `1px solid ${theme.border}`, background: isDark ? "#0b0b0b" : theme.surface }}>
            <strong>Frontend pulito ✅</strong>
            <span>Nessuna API key nel browser. File e AI passano da backend.</span>
          </div>
        )}
      </aside>

      <main style={s.main}>
        <section style={{ ...s.content, justifyContent: currentMessages.length === 0 ? "center" : "flex-start" }}>
          {currentMessages.length === 0 ? (
            <div style={s.homeWrapper}>
              <div style={{ ...s.heroBadge, color: theme.primary, border: `1px solid ${theme.border}`, background: isDark ? "#0b0b0b" : theme.surface }}>
                🔒 Frontend pronto per backend
              </div>
              <h1 style={s.welcomeText}>TechAI pulito e sicuro</h1>
              <p style={s.welcomeSubText}>
                Questo frontend non contiene chiavi API, password o file privati nel codice. I messaggi e i file vengono inviati a <strong>/api/chat</strong>.
              </p>
              {renderInputBar()}
              <p style={s.fileHint}>Il contenuto dei file non viene salvato in localStorage. Viene inviato solo al backend quando premi invio.</p>
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
                          ? {
                              ...s.uBox,
                              backgroundColor: theme.surface,
                              border: `1px solid ${theme.border || theme.surface}`,
                              boxShadow: isDark ? "0 8px 20px rgba(0,0,0,0.20)" : "0 8px 22px rgba(15,23,42,0.06)",
                            }
                          : {
                              ...s.aBox,
                              color: theme.text,
                              background: isDark ? "#0b0b0b" : "#ffffff",
                              border: `1px solid ${theme.border || theme.surface}`,
                              boxShadow: isDark ? "0 12px 28px rgba(0,0,0,0.32)" : "0 14px 34px rgba(15,23,42,0.08)",
                            }
                      }
                    >
                      {message.role === "AI" && (
                        <div style={s.aiHeader}>
                          <div>
                            <div style={s.aiName}>TechAI</div>
                            <div style={s.aiSubName}>Risposta dal backend</div>
                          </div>
                        </div>
                      )}

                      {formatText(message.text)}
                      {message.fileAttachment && renderFileCard(message.fileAttachment)}
                    </div>
                  </div>
                ))}

                {loading && <div style={{ color: theme.primary, textAlign: "center", fontWeight: 800 }}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.bottomInput}>{renderInputBar()}</div>
            </div>
          )}
        </section>

        {showSettings && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={s.modalTitle}>Impostazioni aspetto</h2>
                  <p style={s.modalSub}>Qui puoi cambiare solo impostazioni grafiche del frontend.</p>
                </div>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowSettings(false)}>
                  ×
                </button>
              </div>

              <div style={s.themeGrid}>
                {THEMES.map(t => (
                  <button
                    key={t.name}
                    onClick={() => setTheme(t)}
                    style={{
                      ...s.themeOption,
                      background: theme.name === t.name ? theme.surface : "transparent",
                      color: theme.text,
                      border: theme.name === t.name ? `1px solid ${t.primary}` : `1px solid ${theme.border}`,
                    }}
                  >
                    <div
                      style={{
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: t.name === "Dark Black" ? "#050505" : t.primary,
                        border: t.name === "Dark Black" ? "1px solid #ffffff" : "none",
                      }}
                    />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {showPrivacyInfo && (
          <div style={s.overlay}>
            <div style={{ ...s.modal, background: isDark ? "#111111" : "white", color: theme.text, border: `1px solid ${theme.border}` }}>
              <div style={s.modalHeader}>
                <div>
                  <h2 style={s.modalTitle}>Sicurezza progetto 🔒</h2>
                  <p style={s.modalSub}>Cosa è stato tolto dal frontend e cosa deve stare nel backend.</p>
                </div>
                <button style={{ ...s.backBtn, color: theme.text, border: `1px solid ${theme.border}` }} onClick={() => setShowPrivacyInfo(false)}>
                  ×
                </button>
              </div>

              <div style={s.privacyGrid}>
                <div style={{ ...s.privacyCard, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "#f8fafc" }}>
                  <h3>✅ Può stare nel frontend</h3>
                  <p>Layout, tema, pulsanti, barra file, cronologia visuale, componenti grafici, chiamata a <strong>/api/chat</strong>.</p>
                </div>
                <div style={{ ...s.privacyCard, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "#f8fafc" }}>
                  <h3>❌ Non deve stare nel frontend</h3>
                  <p>API key, password reali, file privati salvati, database riservati, chiamate dirette a Groq/OpenAI, logiche segrete.</p>
                </div>
                <div style={{ ...s.privacyCard, border: `1px solid ${theme.border}`, background: isDark ? "#050505" : "#f8fafc" }}>
                  <h3>🔧 Deve stare nel backend</h3>
                  <p>Endpoint <strong>/api/chat</strong>, chiave API, lettura file, chiamata all'AI, gestione utenti, database e salvataggi sicuri.</p>
                </div>
              </div>
            </div>
          </div>
        )}
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

  sidebar: { height: "100dvh", padding: "10px", display: "flex", flexDirection: "column", gap: "12px", overflow: "hidden", flexShrink: 0 },
  sidebarTop: { display: "flex", alignItems: "center", gap: 8, minHeight: 50, flexShrink: 0 },
  logoWrap: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  logoMark: { width: 34, height: 34, borderRadius: 12, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900 },
  logoText: { fontSize: 21, fontWeight: 900, letterSpacing: "-1px", whiteSpace: "nowrap" },
  collapseBtn: { width: 44, height: 44, borderRadius: 14, cursor: "pointer", fontSize: 22, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center" },
  iconNav: { display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 },
  iconBtn: { minHeight: 44, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 750, background: "transparent", border: "1px solid transparent", padding: "0 12px" },
  icon: { width: 22, height: 22, display: "inline-flex", justifyContent: "center", alignItems: "center", fontSize: 15, fontWeight: 600, opacity: 0.88, flexShrink: 0 },
  chatHistory: { flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden", display: "flex", flexDirection: "column", gap: 6, paddingRight: 2 },
  historyHeader: { fontSize: 11, textTransform: "uppercase", fontWeight: 850, opacity: 0.5, padding: "6px 8px" },
  emptyHistory: { fontSize: 12, opacity: 0.6, padding: "8px" },
  historyItem: { minHeight: 38, display: "flex", alignItems: "center", justifyContent: "space-between", borderRadius: 12, padding: "8px 10px", fontSize: 13, cursor: "pointer" },
  historyTitle: { overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis", flex: 1 },
  deleteBtn: { border: "none", background: "transparent", cursor: "pointer", fontSize: 18, opacity: 0.55 },
  safeNote: { borderRadius: 18, padding: 14, display: "flex", flexDirection: "column", gap: 4, fontSize: 12, lineHeight: 1.4 },

  main: { flex: 1, minWidth: 0, height: "100dvh", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" },
  content: { flex: 1, minHeight: 0, width: "100%", display: "flex", flexDirection: "column", alignItems: "center", overflow: "hidden" },
  homeWrapper: { width: "100%", maxWidth: 760, textAlign: "center", padding: "0 22px" },
  heroBadge: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 850, marginBottom: 18 },
  welcomeText: { fontSize: "clamp(30px, 5vw, 48px)", fontWeight: 850, margin: "0 0 12px", letterSpacing: "-1.4px" },
  welcomeSubText: { maxWidth: 650, margin: "0 auto 28px", fontSize: 15, lineHeight: 1.6, opacity: 0.72 },

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

  sentFileCard: { marginTop: 10, display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, maxWidth: 320 },
  sentFileIcon: { width: 34, height: 42, borderRadius: 6, color: "white", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 900, fontSize: 18 },
  sentFileName: { fontWeight: 800, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" },
  sentFileSub: { fontSize: 11, opacity: 0.65 },

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
  messageLine: { lineHeight: 1.7, margin: "2px 0", wordBreak: "break-word" },

  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000, padding: 16 },
  modal: { borderRadius: 24, width: "min(720px, 100%)", maxHeight: "min(620px, calc(100dvh - 32px))", display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 30px 60px rgba(0,0,0,0.25)", padding: 28 },
  modalHeader: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 },
  modalTitle: { margin: 0, fontSize: 22, fontWeight: 900, letterSpacing: "-0.5px" },
  modalSub: { margin: "6px 0 0", fontSize: 13, opacity: 0.65, lineHeight: 1.5 },
  backBtn: { width: 36, height: 36, background: "transparent", borderRadius: 12, cursor: "pointer", fontWeight: 900, fontSize: 20 },
  themeGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 },
  themeOption: { padding: 13, borderRadius: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 12, fontSize: 13, fontWeight: 800, background: "transparent" },
  privacyGrid: { display: "grid", gridTemplateColumns: "1fr", gap: 12, overflowY: "auto" },
  privacyCard: { borderRadius: 18, padding: 16, lineHeight: 1.55 },
};
