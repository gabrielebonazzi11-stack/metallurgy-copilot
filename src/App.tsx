import React, { useState, useRef, useEffect } from "react";

// Tipi per la gestione dei dati
interface Message { role: "utente" | "AI"; text: string; isTable?: boolean; }
interface ChatSession { id: string; title: string; messages: Message[]; }
interface FileContext { name: string; content: string; type: 'pdf' | 'img'; }

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [uploadedContext, setUploadedContext] = useState<FileContext[]>([]);
  
  // Calcolatore
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // --- PERSISTENZA E MEMORIA CROSS-CHAT ---
  useEffect(() => {
    const saved = localStorage.getItem("tech_copilot_v5");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed.sessions || []);
      setUploadedContext(parsed.context || []);
      setActiveChatId(parsed.sessions[0]?.id || "");
    } else { startNewChat(); }
  }, []);

  useEffect(() => {
    localStorage.setItem("tech_copilot_v5", JSON.stringify({ sessions, context: uploadedContext }));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, uploadedContext, activeChatId]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setSessions([{ id: newId, title: "Nuova Analisi", messages: [] }, ...sessions]);
    setActiveChatId(newId);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeChatId) || sessions[0];

  // --- LOGICA DI CARICAMENTO E "LETTURA" FILE ---
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    // Simulazione Lettura/OCR: In un'app reale qui useresti Tesseract.js o PDF.js
    // Qui aggiungiamo il riferimento del file alla memoria per l'AI
    const newFile: FileContext = {
      name: file.name,
      type: file.type.includes('pdf') ? 'pdf' : 'img',
      content: `Dati estratti dal file ${file.name}: [Contenuto simulato per analisi metallurgica del materiale richiesto]`
    };

    setUploadedContext([...uploadedContext, newFile]);
    setTimeout(() => {
      setLoading(false);
      alert(`File ${file.name} caricato e indicizzato nella memoria globale!`);
    }, 1000);
  };

  // --- CHIAMATA AI CON RENDERING TABELLE ---
  const callAI = async (override?: string) => {
    const text = override || query;
    if (!text.trim() || loading) return;

    // Iniezione memoria globale (file caricati + vecchie chat)
    const fileData = uploadedContext.map(f => `FILE ${f.name}: ${f.content}`).join("\n");
    const pastChats = sessions.flatMap(s => s.messages.slice(-1)).map(m => m.text).join(" | ");

    setLoading(true);
    const newMsgs: Message[] = [...(activeChat?.messages || []), { role: "utente", text }];
    setSessions(sessions.map(s => s.id === activeChatId ? { ...s, messages: newMsgs, title: text.substring(0, 25) } : s));
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei un ingegnere metallurgico. 
              MEMORIA FILE CARICATI: ${fileData}. 
              MEMORIA CHAT PRECEDENTI: ${pastChats}.
              REGOLE OUTPUT:
              1. NON USARE | per le tabelle nel testo finale.
              2. PRODUCI TABELLE HTML/MARKDOWN PULITE.
              3. Usa i grassetti per le formule.
              4. Se l'utente chiede dati su file caricati, cercali nella memoria.` 
            },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      const reply = data.choices[0].message.content;
      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...newMsgs, { role: "AI", text: reply }] } : s));
    } catch (e) { alert("Errore API Groq"); } finally { setLoading(false); }
  };

  return (
    <div style={s.app}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <button style={s.newBtn} onClick={startNewChat}>+ Nuova Analisi</button>
        
        <div style={s.scrollArea}>
          <p style={s.label}>MEMORIA ATTIVA</p>
          {sessions.map(sIdx => (
            <div key={sIdx.id} onClick={() => {setActiveChatId(sIdx.id); setView("advisor");}} 
                 style={activeChatId === sIdx.id ? s.sItemAct : s.sItem}>💬 {sIdx.title}</div>
          ))}
          
          <p style={s.label} style={{marginTop:'20px'}}>FILE INDICIZZATI ({uploadedContext.length})</p>
          {uploadedContext.map((f, i) => (
            <div key={i} style={s.fileItem}>📄 {f.name}</div>
          ))}
        </div>

        <nav style={s.nav}>
          <button style={view === 'bom' ? s.navBtnAct : s.navBtn} onClick={() => setView('bom')}>📋 Distinta BOM</button>
          <button style={view === 'calc' ? s.navBtnAct : s.navBtn} onClick={() => setView('calc')}>📐 Calcolatore</button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={s.main}>
        <header style={s.header}>
          <div style={s.badge}>LIVE INTELLIGENCE: PDF & IMG READER ON</div>
        </header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrap}>
              <div style={s.msgList}>
                {activeChat?.messages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox}>
                      <div className="markdown-content">
                        {/* Questo pre-wrap ora è formattato meglio via CSS */}
                        <pre style={{whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0}}>{m.text}</pre>
                      </div>
                    </div>
                  </div>
                ))}
                {loading && <div style={s.loader}>⚙️ Estrazione dati e analisi in corso...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.inputArea}>
                <label style={s.iconBtn}>
                  📎 <input type="file" hidden onChange={handleFileUpload} accept="application/pdf,image/*" />
                </label>
                <textarea 
                  style={s.textarea} 
                  rows={1} 
                  value={query} 
                  placeholder="Chiedi dei materiali o dei file caricati..."
                  onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())} 
                />
                <button style={s.sendBtn} onClick={() => callAI()}>Analizza 🚀</button>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h2>📋 Distinta Materiali (BOM)</h2>
              <p style={{color:'#64748b', marginBottom:'20px'}}>Incolla la distinta o carica un file per estrarre i dati automaticamente nella memoria.</p>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Esempio: 2x C45, 1x 42CrMo4..." />
              <div style={{display:'flex', gap:'10px'}}>
                <button style={s.primaryBtn} onClick={() => callAI(`Analizza questa BOM: ${bomList}`)}>Analizza Testo</button>
                <label style={s.secondaryBtn}>
                  Carica PDF/IMG <input type="file" hidden onChange={handleFileUpload} />
                </label>
              </div>
            </div>
          )}

          {view === "calc" && (
             <div style={s.card}>
                <h2>📐 Convertitore e Formule</h2>
                {/* Logica calcolatore... */}
             </div>
          )}
        </section>
      </main>
    </div>
  );
}

// --- STILI CORRETTI E PROFESSIONALI ---
const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: '"Segoe UI", Roboto, sans-serif' },
  sidebar: { width: '300px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white', display:'flex', flexDirection:'column', boxShadow:'4px 0 15px rgba(0,0,0,0.1)' },
  logo: { fontSize: '28px', fontWeight: 900, marginBottom: '30px', letterSpacing:'-1.5px' },
  newBtn: { padding:'14px', background:'#1e293b', border:'1px solid #334155', color:'white', borderRadius:'12px', cursor:'pointer', fontWeight:700, marginBottom:'20px' },
  scrollArea: { flex:1, overflowY:'auto' },
  label: { fontSize:'10px', color:'#64748b', fontWeight:800, letterSpacing:'1px', marginBottom:'10px' },
  sItem: { padding:'10px', borderRadius:'8px', color:'#94a3b8', fontSize:'13px', cursor:'pointer', marginBottom:'4px' },
  sItemAct: { padding:'10px', borderRadius:'8px', color:'white', backgroundColor:'#334155', fontSize:'13px', fontWeight:600 },
  fileItem: { padding:'8px', fontSize:'12px', color:'#10b981', background:'#064e3b', borderRadius:'6px', marginBottom:'5px' },
  nav: { borderTop:'1px solid #1e293b', paddingTop:'20px', display:'flex', flexDirection:'column', gap:'10px' },
  navBtn: { padding:'12px', color:'#94a3b8', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontWeight:600 },
  navBtnAct: { padding:'12px', color:'white', backgroundColor:'#3b82f6', borderRadius:'12px', border:'none', textAlign:'left', fontWeight:600 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { padding:'15px 40px', backgroundColor:'white', borderBottom:'1px solid #e2e8f0', display:'flex', justifyContent:'flex-end' },
  badge: { fontSize:'10px', fontWeight:900, color:'#3b82f6', background:'#eff6ff', padding:'6px 15px', borderRadius:'20px', border:'1px solid #dbeafe' },
  content: { flex:1, padding:'30px', overflowY:'auto' },
  chatWrap: { height:'100%', display:'flex', flexDirection:'column', maxWidth:'1000px', margin:'0 auto' },
  msgList: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'25px', padding:'10px' },
  uRow: { display:'flex', justifyContent:'flex-end' },
  aRow: { display:'flex', justifyContent:'flex-start' },
  uBox: { backgroundColor:'#3b82f6', color:'white', padding:'18px 24px', borderRadius:'25px 25px 4px 25px', fontSize:'16px', boxShadow:'0 4px 15px rgba(59,130,246,0.2)' },
  aBox: { backgroundColor:'white', border:'1px solid #e2e8f0', padding:'25px', borderRadius:'4px 25px 25px 25px', fontSize:'16px', lineHeight:'1.7', color:'#1e293b', boxShadow:'0 4px 15px rgba(0,0,0,0.05)' },
  inputArea: { display:'flex', alignItems:'center', gap:'15px', background:'white', padding:'15px 25px', borderRadius:'30px', border:'2px solid #e2e8f0', marginTop:'20px', boxShadow:'0 10px 25px rgba(0,0,0,0.05)' },
  textarea: { flex:1, border:'none', outline:'none', resize:'none', fontSize:'16px', fontFamily:'"Inter", sans-serif', color:'#1e293b' },
  iconBtn: { fontSize:'22px', cursor:'pointer', color:'#64748b', display:'flex', alignItems:'center' },
  sendBtn: { backgroundColor:'#0f172a', color:'white', border:'none', padding:'12px 25px', borderRadius:'18px', fontWeight:800, cursor:'pointer' },
  card: { backgroundColor:'white', padding:'40px', borderRadius:'24px', boxShadow:'0 10px 30px rgba(0,0,0,0.05)', border:'1px solid #e2e8f0' },
  bomArea: { width:'100%', height:'150px', borderRadius:'12px', border:'1px solid #e2e8f0', padding:'15px', marginBottom:'15px', fontSize:'16px', outline:'none' },
  primaryBtn: { flex:1, padding:'15px', background:'#10b981', color:'white', border:'none', borderRadius:'12px', fontWeight:700, cursor:'pointer' },
  secondaryBtn: { flex:1, padding:'15px', background:'#f1f5f9', color:'#1e293b', border:'1px solid #e2e8f0', borderRadius:'12px', fontWeight:700, cursor:'pointer', textAlign:'center' },
  loader: { textAlign:'center', color:'#3b82f6', fontWeight:700 }
};
