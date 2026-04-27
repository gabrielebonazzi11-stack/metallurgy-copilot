import React, { useState, useRef, useEffect } from "react";

// Simuliamo il contenuto estratto dai tuoi PDF per la memoria dell'AI
const PDF_MEMORY = "Contesto: 1.0503=C45, 1.7225=42CrMo4, 1.4301=304, 0.7040=GGG40.";

export default function App() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  const [bomList, setBomList] = useState("");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tech_v6");
    if (saved) {
      const p = JSON.parse(saved);
      setSessions(p);
      setActiveId(p[0]?.id || "");
    } else { createChat(); }
  }, []);

  useEffect(() => {
    localStorage.setItem("tech_v6", JSON.stringify(sessions));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  const createChat = () => {
    const id = Date.now().toString();
    setSessions([{ id, title: "Nuova Analisi", messages: [] }, ...sessions]);
    setActiveId(id);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeId) || sessions[0];

  const callAI = async (textOverride?: string) => {
    const val = textOverride || query;
    if (!val.trim() || loading) return;

    setLoading(true);
    const updatedMsgs = [...(activeChat?.messages || []), { role: "utente", text: val }];
    setSessions(sessions.map(s => s.id === activeId ? { ...s, messages: updatedMsgs } : s));
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
              content: `Sei un ingegnere metallurgico. 
              REGOLE DI FORMATTAZIONE OBBLIGATORIE:
              1. Usa tabelle HTML standard (<table>, <tr>, <td>) per dati tecnici.
              2. Per le formule matematiche con frazioni, simula il layout con HTML: 
                 usa <div class="frac"><span>numeratore</span><span class="bottom">denominatore</span></div>.
              3. Sii gentile e usa emoji. Memoria PDF: ${PDF_MEMORY}.` 
            },
            { role: "user", content: val }
          ],
        }),
      });
      const data = await res.json();
      const aiText = data.choices[0].message.content;
      setSessions(prev => prev.map(s => s.id === activeId ? { ...s, messages: [...updatedMsgs, { role: "AI", text: aiText }] } : s));
    } catch (e) { console.error(e); } finally { setLoading(false); }
  };

  return (
    <div style={s.app}>
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span>COPILOT</span></div>
        <button style={s.newChat} onClick={createChat}>+ NUOVA CHAT</button>
        <div style={s.sessionList}>
          {sessions.map(sIdx => (
            <div key={sIdx.id} onClick={() => {setActiveId(sIdx.id); setView("advisor");}} 
                 style={activeId === sIdx.id ? s.sItemAct : s.sItem}>💬 {sIdx.title}</div>
          ))}
        </div>
        <nav style={s.nav}>
          <button style={view === 'bom' ? s.nBtnA : s.nBtn} onClick={() => setView('bom')}>📋 DISTINTA BOM</button>
          <button style={view === 'calc' ? s.nBtnA : s.nBtn} onClick={() => setView('calc')}>📐 CALCOLATORE</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>MEMORIA PDF CARICATA ✅</div></header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatContainer}>
              <div style={s.msgList}>
                {activeChat?.messages.map((m: any, i: number) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ Elaborazione in corso...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.inputWrapper}>
                <textarea 
                  style={s.textarea} 
                  value={query} 
                  rows={1}
                  placeholder="Chiedi equivalenze o calcoli..."
                  onChange={e => {setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'}}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia</button>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h2>📋 Analisi Professionale BOM</h2>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Incolla lista materiali..." />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza questa lista materiali: ${bomList}`)}>AVVIA ANALISI BATCH</button>
            </div>
          )}
        </section>
      </main>

      {/* STILE CSS PER TABELLE E FRAZIONI */}
      <style>{`
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 2px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 14px; }
        td { padding: 10px 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; }
        tr:nth-child(even) { background-color: #f8fafc; }
        
        .frac { display: inline-block; vertical-align: middle; text-align: center; font-size: 14px; margin: 0 5px; }
        .frac span { display: block; padding: 0 5px; }
        .frac span.bottom { border-top: 2px solid #1e293b; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '25px', display:'flex', flexDirection:'column', color:'white' },
  logo: { fontSize:'24px', fontWeight:900, marginBottom:'30px', letterSpacing:'-1px' },
  newChat: { padding:'12px', background:'#3b82f6', border:'none', color:'white', borderRadius:'10px', cursor:'pointer', fontWeight:700, marginBottom:'20px' },
  sessionList: { flex:1, overflowY:'auto' },
  sItem: { padding:'10px', borderRadius:'8px', color:'#94a3b8', fontSize:'13px', cursor:'pointer', marginBottom:'5px' },
  sItemAct: { padding:'10px', borderRadius:'8px', color:'white', backgroundColor:'#1e293b', border:'1px solid #334155' },
  nav: { borderTop:'1px solid #1e293b', paddingTop:'20px', display:'flex', flexDirection:'column', gap:'10px' },
  nBtn: { padding:'12px', color:'#94a3b8', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontWeight:600 },
  nBtnA: { padding:'12px', color:'white', backgroundColor:'#3b82f6', borderRadius:'10px', border:'none', textAlign:'left', fontWeight:600 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { padding:'15px 30px', backgroundColor:'white', borderBottom:'1px solid #e2e8f0' },
  badge: { fontSize:'10px', fontWeight:900, color:'#10b981', background:'#ecfdf5', padding:'5px 12px', borderRadius:'20px' },
  content: { flex:1, padding:'30px', overflowY:'auto' },
  chatContainer: { height:'100%', display:'flex', flexDirection:'column', maxWidth:'900px', margin:'0 auto' },
  msgList: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'20px' },
  uRow: { display:'flex', justifyContent:'flex-end' },
  aRow: { display:'flex', justifyContent:'flex-start' },
  uBox: { background:'#3b82f6', color:'white', padding:'15px 20px', borderRadius:'20px 20px 0 20px', maxWidth:'80%' },
  aBox: { background:'white', border:'1px solid #e2e8f0', padding:'20px', borderRadius:'0 20px 20px 20px', maxWidth:'95%', color:'#1e293b', lineHeight:'1.6', boxShadow:'0 4px 12px rgba(0,0,0,0.05)' },
  inputWrapper: { display:'flex', alignItems:'flex-end', gap:'10px', background:'white', padding:'12px 20px', borderRadius:'20px', border:'2px solid #e2e8f0', marginTop:'20px' },
  textarea: { flex:1, border:'none', outline:'none', fontSize:'16px', padding:'10px 0', resize:'none', fontFamily:'inherit' },
  sendBtn: { background:'#0f172a', color:'white', border:'none', padding:'12px 20px', borderRadius:'12px', fontWeight:700, cursor:'pointer' },
  card: { background:'white', padding:'30px', borderRadius:'25px', border:'1px solid #e2e8f0' },
  bomArea: { width:'100%', height:'150px', borderRadius:'15px', border:'1px solid #e2e8f0', padding:'15px', marginBottom:'15px', outline:'none', fontSize:'16px' },
  primaryBtn: { width:'100%', padding:'15px', background:'#10b981', color:'white', border:'none', borderRadius:'12px', fontWeight:800, cursor:'pointer' },
  loader: { textAlign:'center', color:'#3b82f6', fontWeight:700 }
};
