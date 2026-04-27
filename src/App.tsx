import React, { useState, useRef, useEffect } from "react";

export default function App() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeId, setActiveId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  const [isMenuOpen, setIsMenuOpen] = useState(false); // Per il mobile

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("tech_v7_responsive");
    if (saved) {
      const p = JSON.parse(saved);
      setSessions(p);
      setActiveId(p[0]?.id || "");
    } else { createChat(); }
  }, []);

  useEffect(() => {
    localStorage.setItem("tech_v7_responsive", JSON.stringify(sessions));
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions]);

  const createChat = () => {
    const id = Date.now().toString();
    setSessions([{ id, title: "Nuova Analisi", messages: [] }, ...sessions]);
    setActiveId(id);
    setView("advisor");
    setIsMenuOpen(false);
  };

  const activeChat = sessions.find(s => s.id === activeId) || sessions[0];

  const callAI = async () => {
    if (!query.trim() || loading) return;
    const val = query;
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
              FORMATTAZIONE:
              1. Usa sempre tabelle HTML (<table>) per i dati.
              2. Per le frazioni usa: <div class="frac"><span>N</span><span class="bottom">D</span></div>.
              3. Risposta professionale e gentile.` 
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
      {/* OVERLAY MOBILE */}
      {isMenuOpen && <div style={s.overlay} onClick={() => setIsMenuOpen(false)} />}

      {/* SIDEBAR RESPONSIVE */}
      <aside style={{...s.sidebar, left: isMenuOpen ? '0' : '-100%'}}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <button style={s.newChat} onClick={createChat}>+ NUOVA CHAT</button>
        <div style={s.sessionList}>
          {sessions.map(sIdx => (
            <div key={sIdx.id} onClick={() => {setActiveId(sIdx.id); setView("advisor"); setIsMenuOpen(false);}} 
                 style={activeId === sIdx.id ? s.sItemAct : s.sItem}>💬 {sIdx.title}</div>
          ))}
        </div>
        <nav style={s.nav}>
          <button style={view === 'bom' ? s.nBtnA : s.nBtn} onClick={() => {setView('bom'); setIsMenuOpen(false);}}>📋 BOM</button>
          <button style={s.nBtn} onClick={() => {setView('calc'); setIsMenuOpen(false);}}>📐 CALCOLI</button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={s.main}>
        <header style={s.header}>
          <button style={s.menuToggle} onClick={() => setIsMenuOpen(true)}>☰</button>
          <div style={s.badge}>MEMORIA ATTIVA ✅</div>
        </header>

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
                {loading && <div style={s.loader}>✨ Analisi...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.inputWrapper}>
                <textarea 
                  style={s.textarea} 
                  value={query} 
                  rows={1}
                  placeholder="Chiedi..."
                  onChange={e => {setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'}}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                />
                <button style={s.sendBtn} onClick={callAI}>🚀</button>
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        /* TABELLE RESPONSIVE */
        .msg-container { overflow-x: auto; width: 100%; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; min-width: 400px; }
        th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 13px; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        
        /* FRAZIONI MATEMATICHE */
        .frac { display: inline-block; vertical-align: middle; text-align: center; margin: 0 5px; }
        .frac span { display: block; padding: 0 3px; }
        .frac span.bottom { border-top: 1.5px solid #1e293b; }

        @media (max-width: 768px) {
            aside { position: fixed; z-index: 1000; height: 100vh; transition: 0.3s ease; width: 80% !important; }
            main { width: 100%; }
            .uBox, .aBox { max-width: 95% !important; font-size: 14px !important; }
        }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', overflow: 'hidden' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '20px', display:'flex', flexDirection:'column', color:'white', position:'relative' },
  logo: { fontSize:'22px', fontWeight:900, marginBottom:'25px', textAlign:'center' },
  newChat: { padding:'12px', background:'#3b82f6', border:'none', color:'white', borderRadius:'10px', cursor:'pointer', fontWeight:700, marginBottom:'20px' },
  sessionList: { flex:1, overflowY:'auto' },
  sItem: { padding:'10px', color:'#94a3b8', fontSize:'13px', cursor:'pointer' },
  sItemAct: { padding:'10px', color:'white', backgroundColor:'#1e293b', borderRadius:'8px' },
  nav: { borderTop:'1px solid #334155', paddingTop:'15px' },
  nBtn: { width:'100%', padding:'12px', color:'#94a3b8', background:'none', border:'none', textAlign:'left', cursor:'pointer' },
  nBtnA: { width:'100%', padding:'12px', color:'white', backgroundColor:'#3b82f6', borderRadius:'10px', border:'none', textAlign:'left' },
  main: { flex:1, display: 'flex', flexDirection: 'column', position:'relative', minWidth: 0 },
  header: { padding:'10px 20px', backgroundColor:'white', borderBottom:'1px solid #e2e8f0', display:'flex', alignItems:'center', justifyContent:'space-between' },
  menuToggle: { background:'none', border:'none', fontSize:'24px', cursor:'pointer' },
  badge: { fontSize:'9px', fontWeight:900, color:'#10b981', background:'#ecfdf5', padding:'4px 10px', borderRadius:'15px' },
  content: { flex:1, padding:'15px', overflowY:'auto' },
  chatContainer: { height:'100%', display:'flex', flexDirection:'column' },
  msgList: { flex:1, overflowY:'auto', display:'flex', flexDirection:'column', gap:'15px' },
  uRow: { display:'flex', justifyContent:'flex-end' },
  aRow: { display:'flex', justifyContent:'flex-start' },
  uBox: { background:'#3b82f6', color:'white', padding:'12px 16px', borderRadius:'15px 15px 0 15px', maxWidth:'80%' },
  aBox: { background:'white', border:'1px solid #e2e8f0', padding:'15px', borderRadius:'0 15px 15px 15px', maxWidth:'90%', boxShadow:'0 2px 8px rgba(0,0,0,0.05)' },
  inputWrapper: { display:'flex', alignItems:'center', gap:'10px', background:'white', padding:'10px 15px', borderRadius:'25px', border:'1px solid #e2e8f0', marginTop:'15px' },
  textarea: { flex:1, border:'none', outline:'none', resize:'none', fontSize:'15px', maxHeight:'120px' },
  sendBtn: { background:'#0f172a', color:'white', border:'none', padding:'8px 15px', borderRadius:'50%', cursor:'pointer' },
  overlay: { position:'fixed', top:0, left:0, right:0, bottom:0, background:'rgba(0,0,0,0.5)', zIndex:999 },
  loader: { textAlign:'center', fontSize:'12px', color:'#3b82f6' }
};
