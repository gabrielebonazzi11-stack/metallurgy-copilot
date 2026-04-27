import React, { useState, useRef, useEffect } from "react";

// Database integrato dai file caricati
const TECH_CONTEXT = `Riferimenti: 1.0503 (C45), 1.7225 (42CrMo4), 1.4301 (304). 
Formule: HV = HB / 0.95; Rm = HV * 3.35.`;

interface Message {
  role: "utente" | "AI";
  text: string;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async (override?: string) => {
    const text = override || query;
    if (!text.trim() || loading) return;

    setLoading(true);
    const newChat: Message[] = [...chat, { role: "utente", text }];
    setChat(newChat);
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
              content: `Sei un Ingegnere Metallurgico. 
              FORMULE: Per le frazioni usa SEMPRE: <div class="math-frac"><span>N</span><span class="bottom">D</span></div>.
              TABELLE: Usa <table> HTML. Contesto: ${TECH_CONTEXT}. Sii professionale e usa emoji.` 
            },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      alert("Errore API");
    } finally {
      setLoading(false);
    }
  };

  const calc = (() => {
    const v = parseFloat(hVal);
    if (!v) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : v;
    return { hv: Math.round(hv), rm: Math.round(hv * 3.35) };
  })();

  return (
    <div style={s.app}>
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 AI Advisor</button>
          <button style={view === "bom" ? s.navBtnAct : s.navBtn} onClick={() => setView("bom")}>📋 Distinta BOM</button>
          <button style={view === "calc" ? s.navBtnAct : s.navBtn} onClick={() => setView("calc")}>📐 Calcolatori</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>DATABASE PDF CARICATO ✅</div></header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatContainer}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={s.loader}>⚙️ Analisi in corso...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.inputWrapper}>
                <textarea 
                  style={s.textarea} rows={1} value={query} 
                  placeholder="Chiedi un calcolo o un'equivalenza..."
                  onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h3>📋 Conversione BOM Batch</h3>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Incolla materiali..." />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza batch: ${bomList}`)}>Analizza Batch</button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h3>📐 Calcolatore Rapido</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input style={s.calcInput} type="number" value={hVal} onChange={e => setHVal(e.target.value)} />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                <div style={s.resBox}><span>Vickers (HV)</span><strong>{calc?.hv || '--'}</strong></div>
                <div style={{...s.resBox, background:'#eff6ff', border:'1px solid #3b82f6'}}><span>Resistenza (Rm)</span><strong style={{color:'#3b82f6'}}>{calc?.rm || '--'} MPa</strong></div>
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        th { background: #0f172a; color: white; padding: 12px; text-align: left; font-size: 14px; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 17px; margin: 0 5px; }
        .math-frac span { display: block; padding: 0 5px; }
        .math-frac span.bottom { border-top: 2px solid #1e293b; padding-top: 2px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white' },
  logo: { fontSize: '24px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '10px' },
  navBtn: { padding: '14px', border: 'none', background: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  navBtnAct: { padding: '14px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none', textAlign: 'left', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', background: '#ecfdf5', padding: '5px 12px', borderRadius: '20px', fontWeight: 800 },
  content: { flex: 1, padding: '30px', overflowY: 'auto' },
  chatContainer: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '900px', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#3b82f6', color: 'white', padding: '15px 20px', borderRadius: '20px 20px 0 20px', fontSize: '15px' },
  aBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '0 20px 20px 20px', fontSize: '15px', lineHeight: '1.6' },
  inputWrapper: { display: 'flex', alignItems: 'flex-end', gap: '12px', background: 'white', padding: '15px 25px', borderRadius: '30px', border: '2px solid #e2e8f0', marginTop: '10px' },
  textarea: { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '16px', padding: '5px 0', fontFamily: 'inherit' },
  sendBtn: { background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '15px', fontWeight: 700, cursor: 'pointer' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '24px', border: '1px solid #e2e8f0' },
  bomArea: { width: '100%', height: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '15px', fontSize: '16px', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' },
  calcInput: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px' },
  select: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  resGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' },
  resBox: { padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center', display: 'flex', flexDirection: 'column' },
  loader: { textAlign: 'center', color: '#3b82f6', fontWeight: 700 }
};
