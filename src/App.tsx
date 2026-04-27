import React, { useState, useRef, useEffect } from "react";

// Database tecnico estratto dal tuo PDF per la memoria di base
const TECH_CONTEXT = "Contesto Materiali: 1.0503=C45, 1.7225=42CrMo4, 1.4301=304, 1.2344=H13. Formule Durezza: HV = HB/0.95, Rm = HV * 3.35.";

interface Message {
  role: "utente" | "AI";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  date: number;
}

export default function App() {
  // --- STATI PER CHAT MULTIPLE E MEMORIA ---
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  
  // Stati UI
  const [showHistory, setShowHistory] = useState(false);
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- CARICAMENTO INIZIALE (MEMORIA CROSS-CHAT) ---
  useEffect(() => {
    const savedSessions = localStorage.getItem("tech_copilot_sessions");
    if (savedSessions) {
      const parsed = JSON.parse(savedSessions);
      setSessions(parsed);
      if (parsed.length > 0) setActiveChatId(parsed[0].id);
    } else {
      createNewChat();
    }
  }, []);

  // Salva ogni volta che le sessioni cambiano
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("tech_copilot_sessions", JSON.stringify(sessions));
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeChatId]);

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newChat: ChatSession = {
      id: newId,
      title: `Analisi ${sessions.length + 1}`,
      messages: [],
      date: Date.now()
    };
    setSessions([newChat, ...sessions]);
    setActiveChatId(newId);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeChatId) || sessions[0];

  // --- LOGICA AI CON MEMORIA CROSS-CHAT ---
  const callAI = async (textOverride?: string) => {
    const textToSend = textOverride || query;
    if (!textToSend.trim() || loading) return;

    // Recuperiamo i "pattern" dalle altre chat per la memoria cross-chat
    const allPastMessages = sessions
      .flatMap(s => s.messages)
      .slice(-10) // Prende gli ultimi 10 messaggi scambiati in QUALSIASI chat
      .map(m => `${m.role}: ${m.text}`)
      .join("\n");

    setLoading(true);
    const updatedMessages: Message[] = [...activeChat.messages, { role: "utente", text: textToSend }];
    
    // Aggiorna localmente la sessione attiva
    setSessions(sessions.map(s => s.id === activeChatId ? { ...s, messages: updatedMessages, title: textToSend.substring(0, 25) + "..." } : s));
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `Sei un Technical Copilot Metallurgico. 
              MEMORIA CROSS-CHAT (Contesto delle altre conversazioni): ${allPastMessages}
              DATI PDF: ${TECH_CONTEXT}
              REGOLE DI LAYOUT:
              1. Usa tabelle Markdown per i confronti.
              2. Usa LaTeX o grassetti per le formule (es. **Rm = HV × 3.35**).
              3. Sii gentile, usa emoji e chiudi sempre con una domanda di approfondimento.` 
            },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      const aiText = data.choices[0].message.content;

      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...updatedMessages, { role: "AI", text: aiText }] } : s));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.app}>
      {/* SIDEBAR CON GESTIONE CHAT */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span>COPILOT</span></div>
        
        <button style={s.newChatBtn} onClick={createNewChat}>+ Nuova Analisi</button>
        
        <div style={s.sessionList}>
          <p style={s.sideTitle}>RECENTI</p>
          {sessions.map(sIdx => (
            <div 
              key={sIdx.id} 
              style={activeChatId === sIdx.id ? s.sessionItemAct : s.sessionItem}
              onClick={() => { setActiveChatId(sIdx.id); setView("advisor"); }}
            >
              💬 {sIdx.title}
            </div>
          ))}
        </div>

        <nav style={s.nav}>
          <button style={view === "calc" ? s.navBtnAct : s.navBtn} onClick={() => setView("calc")}>📐 Calcolatore</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div style={s.badge}>MEMORIA CROSS-CHAT ATTIVA 🧠</div>
          <div style={{fontSize:'12px', color:'#64748b'}}>{activeChat?.title}</div>
        </header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {activeChat?.messages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uMsgRow : s.aMsgRow}>
                    <div style={m.role === "utente" ? s.uMsg : s.aMsg}>
                      {/* Rendering basilare Markdown/Tabelle */}
                      <pre style={{whiteSpace:'pre-wrap', fontFamily:'inherit'}}>{m.text}</pre>
                    </div>
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ L'AI sta consultando i pattern tecnici...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.inputAreaContainer}>
                <textarea 
                  style={s.textarea}
                  rows={1}
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = e.target.scrollHeight + 'px';
                  }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  placeholder="Chiedi qualsiasi cosa (ricordo anche le altre chat)..."
                />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
              </div>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h2>📐 Calcolo Meccanico</h2>
              {/* Qui il tuo calcolatore di prima */}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// --- STILI AGGIORNATI PER ORDINE E PULIZIA ---
const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f4f7f9', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '25px', color: 'white', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '24px', fontWeight: 900, marginBottom: '30px', color: '#fff' },
  newChatBtn: { padding: '12px', borderRadius: '12px', border: '1px solid #334155', backgroundColor: '#1e293b', color: 'white', cursor: 'pointer', marginBottom: '20px', fontWeight: 600 },
  sessionList: { flex: 1, overflowY: 'auto', marginBottom: '20px' },
  sideTitle: { fontSize: '10px', color: '#64748b', fontWeight: 800, marginBottom: '10px', letterSpacing: '1px' },
  sessionItem: { padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: '#94a3b8', marginBottom: '5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  sessionItemAct: { padding: '10px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', color: 'white', backgroundColor: '#334155', marginBottom: '5px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 30px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  badge: { fontSize: '10px', fontWeight: 800, color: '#3b82f6', backgroundColor: '#eff6ff', padding: '5px 12px', borderRadius: '20px' },
  content: { flex: 1, padding: '30px', overflowY: 'auto' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '900px', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  uMsgRow: { display: 'flex', justifyContent: 'flex-end' },
  aMsgRow: { display: 'flex', justifyContent: 'flex-start' },
  uMsg: { backgroundColor: '#3b82f6', color: 'white', padding: '15px 20px', borderRadius: '20px 20px 0 20px', maxWidth: '80%', fontSize: '15px', lineHeight: '1.5' },
  aMsg: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '0 20px 20px 20px', maxWidth: '90%', fontSize: '16px', lineHeight: '1.6', color: '#1e293b', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
  inputAreaContainer: { display: 'flex', alignItems: 'flex-end', gap: '10px', backgroundColor: 'white', padding: '12px', borderRadius: '20px', border: '2px solid #e2e8f0', marginTop: '20px' },
  textarea: { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '15px', padding: '8px', maxHeight: '150px' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' },
  loader: { fontSize: '13px', color: '#3b82f6', textAlign: 'center', margin: '10px' }
};
