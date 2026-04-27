import React, { useState, useRef, useEffect } from "react";

// --- CONTESTO TECNICO DAL TUO PDF ---
const PDF_DATA_CONTEXT = `Equivalenze materiali principali: 
- 1.0503 = C45 (Carbonio)
- 1.7225 = 42CrMo4 (Legato)
- 1.4301 = AISI 304 (Inox)
- 0.7040 = GGG40 (Ghisa)`;

interface Message {
  role: "utente" | "AI";
  text: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
}

export default function App() {
  // Stati principali
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Calcolatore
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- GESTIONE MEMORIA E SESSIONI ---
  useEffect(() => {
    const saved = localStorage.getItem("copilot_v3_sessions");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      setActiveChatId(parsed[0]?.id || "");
    } else {
      startNewChat();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("copilot_v3_sessions", JSON.stringify(sessions));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeChatId]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    const newChat: ChatSession = { id: newId, title: "Nuova Analisi", messages: [] };
    setSessions([newChat, ...sessions]);
    setActiveChatId(newId);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeChatId) || sessions[0];

  // --- LOGICA AI GENTILE E PROFESSIONALE ---
  const callAI = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    // Recupero contesto cross-chat (memoria)
    const contextHistory = sessions.flatMap(s => s.messages.slice(-2)).map(m => m.text).join(" | ");

    setLoading(true);
    const newMsgs: Message[] = [...(activeChat?.messages || []), { role: "utente", text: textToSend }];
    
    setSessions(sessions.map(s => s.id === activeChatId ? { ...s, messages: newMsgs, title: textToSend.substring(0, 30) } : s));
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
              content: `Sei un Technical Copilot Metallurgico gentile e visivo. 
              Usa molte emoji (🛠️, ✅, 📊). Formatta i dati in TABELLE ORDINATE. 
              Usa grassetti per le formule. 
              Memoria Cross-Chat: ${contextHistory}. 
              Database PDF: ${PDF_DATA_CONTEXT}.
              Dopo la risposta chiedi sempre: "Vuoi approfondire un dettaglio tecnico o passare a un altro materiale?"` 
            },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      const aiResponse = data.choices[0].message.content;
      
      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...newMsgs, { role: "AI", text: aiResponse }] } : s));
    } catch (e) {
      alert("Errore di connessione. Verifica la API Key!");
    } finally {
      setLoading(false);
    }
  };

  // --- CALCOLO DUREZZE ---
  const calcResults = () => {
    const v = parseFloat(hVal);
    if (!v || isNaN(v)) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : v;
    return {
      hv: Math.round(hv),
      hb: Math.round(hv * 0.95),
      hrc: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      rm: Math.round(hv * 3.35)
    };
  };
  const res = calcResults();

  return (
    <div style={css.app}>
      {/* SIDEBAR */}
      <aside style={css.sidebar}>
        <div style={css.logo}>TECH<span>COPILOT</span></div>
        <button style={css.newChatBtn} onClick={startNewChat}>+ Nuova Chat</button>
        <div style={css.sessionScroll}>
          {sessions.map(s => (
            <div key={s.id} onClick={() => {setActiveChatId(s.id); setView("advisor");}} 
                 style={activeChatId === s.id ? css.sessionItemAct : css.sessionItem}>
              💬 {s.title}
            </div>
          ))}
        </div>
        <button style={view === "calc" ? css.navBtnAct : css.navBtn} onClick={() => setView("calc")}>📐 Calcolatore</button>
      </aside>

      {/* MAIN */}
      <main style={css.main}>
        <header style={css.header}>
          <div style={css.badge}>AI METALLURGICA ATTIVA</div>
        </header>

        <section style={css.content}>
          {view === "advisor" && (
            <div style={css.chatWrapper}>
              <div style={css.msgList}>
                {activeChat?.messages.length === 0 && (
                  <div style={css.welcome}>
                    <h1>Benvenuto nel tuo Laboratorio Digitale 🔬</h1>
                    <p>Incolla una lista di materiali o chiedimi un consiglio tecnico. Sono qui per aiutarti!</p>
                  </div>
                )}
                {activeChat?.messages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? css.uRow : css.aRow}>
                    <div style={m.role === "utente" ? css.uBox : css.aBox}>
                      <pre style={{whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0}}>{m.text}</pre>
                    </div>
                  </div>
                ))}
                {loading && <div style={css.loader}>✨ Sto elaborando i dati tecnici...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={css.inputArea}>
                <textarea 
                  style={css.textarea}
                  rows={1}
                  value={query}
                  onChange={e => {
                    setQuery(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = (e.target.scrollHeight) + 'px';
                  }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  placeholder="Scrivi qui la tua domanda..."
                />
                <button style={css.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
              </div>
            </div>
          )}

          {view === "calc" && (
            <div style={css.card}>
              <h2 style={{marginBottom:'20px'}}>📐 Convertitore di Precisione</h2>
              <div style={{display:'flex', gap:'15px', marginBottom:'30px'}}>
                <input style={css.input} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={css.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HV</option>
                </select>
              </div>
              <div style={css.resGrid}>
                <div style={css.resBox}><span>Vickers</span><strong>{res?.hv || '--'} HV</strong></div>
                <div style={css.resBox}><span>Brinell</span><strong>{res?.hb || '--'} HB</strong></div>
                <div style={css.resBox}><span>Rockwell C</span><strong>{res?.hrc || '--'} HRC</strong></div>
                <div style={{...css.resBox, background:'#eff6ff', border:'1px solid #3b82f6'}}>
                  <span style={{color:'#3b82f6'}}>Resistenza (Rm)</span>
                  <strong style={{color:'#3b82f6'}}>{res?.rm || '--'} N/mm²</strong>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// --- CSS OBJECT ---
const css: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', color: '#1e293b' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '30px 20px', display: 'flex', flexDirection: 'column', color: 'white' },
  logo: { fontSize: '24px', fontWeight: 900, marginBottom: '30px', letterSpacing: '-1px' },
  newChatBtn: { padding: '12px', backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', color: 'white', cursor: 'pointer', marginBottom: '20px', fontWeight: 700 },
  sessionScroll: { flex: 1, overflowY: 'auto' },
  sessionItem: { padding: '12px', borderRadius: '10px', fontSize: '14px', color: '#94a3b8', cursor: 'pointer', marginBottom: '5px' },
  sessionItemAct: { padding: '12px', borderRadius: '10px', fontSize: '14px', color: 'white', backgroundColor: '#334155' },
  navBtn: { padding: '14px', background: 'none', border: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  navBtnAct: { padding: '14px', backgroundColor: '#3b82f6', borderRadius: '12px', border: 'none', color: 'white', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', fontWeight: 900, color: '#10b981', background: '#ecfdf5', padding: '5px 12px', borderRadius: '20px' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '900px', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  welcome: { textAlign: 'center', marginTop: '10%' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#3b82f6', color: 'white', padding: '15px 20px', borderRadius: '20px 20px 2px 20px', maxWidth: '80%', fontSize: '16px' },
  aBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '2px 20px 20px 20px', maxWidth: '90%', fontSize: '16px', lineHeight: '1.6' },
  inputArea: { display: 'flex', alignItems: 'flex-end', gap: '12px', backgroundColor: 'white', padding: '12px 20px', borderRadius: '24px', border: '2px solid #e2e8f0', marginTop: '20px' },
  textarea: { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '16px', padding: '10px 0', maxHeight: '200px' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '12px 25px', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' },
  loader: { textAlign: 'center', color: '#3b82f6', padding: '10px', fontSize: '14px', fontWeight: 600 },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '30px', border: '1px solid #e2e8f0' },
  input: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px' },
  select: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' },
  resBox: { padding: '20px', borderRadius: '20px', border: '1px solid #e2e8f0', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '5px' }
};
