import React, { useState, useRef, useEffect } from "react";

const PDF_DB = "Riferimento: 1.0503(C45), 1.7225(42CrMo4), 1.4301(304), 0.7040(GGG40).";

interface Message { role: "utente" | "AI"; text: string; }
interface ChatSession { id: string; title: string; messages: Message[]; }

export default function App() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tech_v4_data");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      setActiveChatId(parsed[0]?.id || "");
    } else { startNewChat(); }
  }, []);

  useEffect(() => {
    localStorage.setItem("tech_v4_data", JSON.stringify(sessions));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeChatId]);

  const startNewChat = () => {
    const newId = Date.now().toString();
    setSessions([{ id: newId, title: "Nuova Analisi", messages: [] }, ...sessions]);
    setActiveChatId(newId);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeChatId) || sessions[0];

  const callAI = async (override?: string) => {
    const text = override || query;
    if (!text.trim() || loading) return;

    const crossContext = sessions.flatMap(s => s.messages.slice(-1)).map(m => m.text).join(" | ");
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
            { role: "system", content: `Sei un Technical Copilot gentile. Usa EMOJI, TABELLE e FORMULE MATEMATICHE. Memoria: ${crossContext}. DB: ${PDF_DB}. Chiedi sempre se serve altro.` },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      const reply = data.choices[0].message.content;
      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...newMsgs, { role: "AI", text: reply }] } : s));
    } catch (e) { alert("Errore API"); } finally { setLoading(false); }
  };

  const resH = (() => {
    const v = parseFloat(hVal); if (!v) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : v;
    return { hv: Math.round(hv), hb: Math.round(hv * 0.95), rm: Math.round(hv * 3.35) };
  })();

  return (
    <div style={s.app}>
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <button style={s.newBtn} onClick={startNewChat}>+ Nuova Analisi</button>
        <div style={s.sessionList}>
          {sessions.map(sIdx => (
            <div key={sIdx.id} onClick={() => {setActiveChatId(sIdx.id); setView("advisor");}} 
                 style={activeChatId === sIdx.id ? s.sItemAct : s.sItem}>💬 {sIdx.title}</div>
          ))}
        </div>
        <nav style={s.nav}>
          <button style={view === 'bom' ? s.navBtnAct : s.navBtn} onClick={() => setView('bom')}>📋 Distinta BOM</button>
          <button style={view === 'calc' ? s.navBtnAct : s.navBtn} onClick={() => setView('calc')}>📐 Calcolatore</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>DATABASE PDF & MEMORIA ATTIVA</div></header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrap}>
              <div style={s.msgList}>
                {activeChat?.messages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox}>
                      <pre style={{whiteSpace:'pre-wrap', fontFamily:'inherit', margin:0}}>{m.text}</pre>
                    </div>
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ Analisi tecnica in corso...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.inputArea}>
                <button style={s.iconBtn} onClick={() => fileRef.current?.click()}>📎</button>
                <textarea style={s.textarea} rows={1} value={query} placeholder="Chiedi o incolla dati..."
                  onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())} />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h2 style={{marginBottom:'10px'}}>📋 Gestione Distinta BOM</h2>
              <p style={{color:'#64748b', fontSize:'14px', marginBottom:'20px'}}>L'AI analizzerà la lista usando la memoria cross-chat e i dati PDF.</p>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Incolla materiali (es. C45, 1.7225...)" />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza batch materiali: ${bomList}`)}>AVVIA ANALISI BATCH 🚀</button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h2 style={{marginBottom:'20px'}}>📐 Convertitore Durezze</h2>
              <div style={{display:'flex', gap:'15px', marginBottom:'30px'}}>
                <input style={s.calcInput} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}><option>HB</option><option>HRC</option><option>HV</option></select>
              </div>
              <div style={s.resGrid}>
                <div style={s.resBox}><span>Vickers</span><strong>{resH?.hv || '--'} HV</strong></div>
                <div style={s.resBox}><span>Brinell</span><strong>{resH?.hb || '--'} HB</strong></div>
                <div style={{...s.resBox, background:'#eff6ff', border:'1px solid #3b82f6'}}><span>Resistenza</span><strong style={{color:'#3b82f6'}}>{resH?.rm || '--'} N/mm²</strong></div>
              </div>
            </div>
          )}
        </section>
        <input type="file" ref={fileRef} hidden />
      </main>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white', display:'flex', flexDirection:'column' },
  logo: { fontSize: '26px', fontWeight: 900, marginBottom: '35px', letterSpacing:'-1px' },
  newBtn: { padding:'12px', background:'#1e293b', border:'1px solid #334155', color:'white', borderRadius:'12px', cursor:'pointer', marginBottom:'20px', fontWeight:700 },
  sessionList: { flex:1, overflowY:'auto', marginBottom:'20px' },
  sItem: { padding:'10px', borderRadius:'8px', color:'#94a3b8', fontSize:'13px', cursor:'pointer' },
  sItemAct: { padding:'10px', borderRadius:'8px', color:'white', backgroundColor:'#334155', fontSize:'13px' },
  nav: { display:'flex', flexDirection:'column', gap:'8px' },
  navBtn: { padding:'12px', color:'#94a3b8', background:'none', border:'none', textAlign:'left', cursor:'pointer', fontWeight:600 },
  navBtnAct: { padding:'12px', color:'white', backgroundColor:'#3b82f6', borderRadius:'12px', border:'none', textAlign:'left', fontWeight:600 },
  main: { flex:1, display:'flex', flexDirection:'column', overflow:'hidden' },
  header: { padding:'15px 40px', backgroundColor:'white', borderBottom:'1px solid #e2e8f0' },
  badge: { fontSize:'10px', fontWeight:900, color:'#10b981', background:'#ecfdf5', padding:'5px 12px', borderRadius:'20px' },
  content: { flex:1, padding:'40px', overflowY:'auto' },
  chatWrap: { height:'100%', display:'flex', flexDirection:'column', maxWidth:'900px', margin:'0 auto' },
  msgList: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'20px' },
  uRow: { display:'flex', justifyContent:'flex-end' },
  aRow: { display:'flex', justifyContent:'flex-start' },
  uBox: { backgroundColor:'#3b82f6', color:'white', padding:'15px 20px', borderRadius:'20px 20px 2px 20px', fontSize:'16px' },
  aBox: { backgroundColor:'white', border:'1px solid #e2e8f0', padding:'20px', borderRadius:'2px 20px 20px 20px', fontSize:'16px', lineHeight:'1.6' },
  inputArea: { display:'flex', alignItems:'flex-end', gap:'12px', background:'white', padding:'12px 20px', borderRadius:'24px', border:'2px solid #e2e8f0', marginTop:'20px' },
  textarea: { flex:1, border:'none', outline:'none', resize:'none', fontSize:'16px', padding:'8px 0', maxHeight:'200px', fontFamily:'inherit', color:'#1e293b' },
  iconBtn: { background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#64748b' },
  sendBtn: { backgroundColor:'#0f172a', color:'white', border:'none', padding:'12px 25px', borderRadius:'15px', fontWeight:800, cursor:'pointer' },
  card: { backgroundColor:'white', padding:'40px', borderRadius:'30px', border:'1px solid #e2e8f0' },
  bomArea: { width:'100%', height:'200px', borderRadius:'15px', border:'2px solid #f1f5f9', padding:'20px', outline:'none', marginBottom:'15px', fontSize:'16px' },
  primaryBtn: { width:'100%', padding:'18px', background:'#10b981', color:'white', border:'none', borderRadius:'15px', fontWeight:800, cursor:'pointer' },
  resGrid: { display:'grid', gridTemplateColumns:'repeat(3, 1fr)', gap:'15px' },
  resBox: { padding:'20px', borderRadius:'20px', border:'1px solid #e2e8f0', textAlign:'center', display:'flex', flexDirection:'column' },
  calcInput: { padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0', fontSize:'16px' },
  select: { padding:'12px', borderRadius:'10px', border:'1px solid #e2e8f0' },
  loader: { textAlign:'center', color:'#3b82f6', fontWeight:700, fontSize:'14px' }
};
