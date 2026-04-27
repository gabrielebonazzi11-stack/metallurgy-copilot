import React, { useState, useRef, useEffect } from "react";

const PDF_DB_CONTEXT = "Usa i dati del PDF per le equivalenze (es: 1.0503=C45, 1.7225=42CrMo4, 1.4301=304).";

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");
  
  // STATO PER LO STORICO PROMPT
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Carica storico da localStorage all'avvio
  useEffect(() => {
    const saved = localStorage.getItem("tech_prompt_history");
    if (saved) setHistory(JSON.parse(saved));
  }, []);

  const saveToHistory = (prompt: string) => {
    if (!prompt || history.includes(prompt)) return;
    const newHistory = [prompt, ...history].slice(0, 10); // Tiene gli ultimi 10
    setHistory(newHistory);
    localStorage.setItem("tech_prompt_history", JSON.stringify(newHistory));
  };

  const callAI = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    saveToHistory(textToSend);
    setLoading(true);
    const newChat = [...chat, { role: "utente", text: textToSend }];
    setChat(newChat);
    setQuery("");
    setShowHistory(false);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei un Technical Copilot esperto in metallurgia. ${PDF_DB_CONTEXT} Rispondi con tabelle Markdown.` },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di connessione API." }]);
    } finally {
      setLoading(false);
    }
  };

  // Calcolo Durezze
  const results = (() => {
    const v = parseFloat(hVal);
    if (!v || isNaN(v)) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : hFrom === "HRB" ? (v + 130) / 0.37 : v;
    return {
      HV: Math.round(hv),
      HB: Math.round(hv * 0.95),
      HRC: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      Rm: Math.round(hv * 3.35)
    };
  })();

  return (
    <div style={s.app}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 Advisor AI</button>
          <button style={view === "bom" ? s.navBtnAct : s.navBtn} onClick={() => setView("bom")}>📋 Distinta BOM</button>
          <button style={view === "calc" ? s.navBtnAct : s.navBtn} onClick={() => setView("calc")}>📐 Calcolatore</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div style={s.badge}>DATABASE PDF CARICATO</div>
        </header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uMsg : s.aMsg}>{m.text}</div>
                ))}
              </div>
              
              {/* AREA INPUT CON STORICO A TENDINA */}
              <div style={s.inputContainer}>
                <div style={s.inputArea}>
                  <button style={s.histToggle} onClick={() => setShowHistory(!showHistory)}>🕒</button>
                  <input 
                    style={s.input} 
                    value={query} 
                    onChange={e => setQuery(e.target.value)} 
                    onKeyDown={e => e.key === "Enter" && callAI()} 
                    placeholder="Chiedi equivalenze..." 
                  />
                  <button style={s.sendBtn} onClick={() => callAI()}>Invia</button>
                </div>
                
                {showHistory && history.length > 0 && (
                  <div style={s.dropdown}>
                    <div style={s.dropTitle}>PROMPT RECENTI</div>
                    {history.map((h, i) => (
                      <div key={i} style={s.dropItem} onClick={() => { setQuery(h); setShowHistory(false); }}>{h}</div>
                    ))}
                    <div style={s.dropClear} onClick={() => { setHistory([]); localStorage.removeItem("tech_prompt_history"); }}>Cancella storico</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h3>Analisi Distinta Materiali</h3>
              <textarea 
                style={s.textarea} 
                value={bomList} 
                onChange={e => setBomList(e.target.value)} 
                placeholder="Incolla materiali qui..."
              />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza questa lista: ${bomList}`)}>
                {loading ? "ELABORAZIONE..." : "AVVIA ANALISI BATCH"}
              </button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h3>Convertitore Durezze</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input style={s.inputBorder} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                <div style={s.resBox}><span>Vickers</span><strong>{results?.HV || '--'} HV</strong></div>
                <div style={s.resBox}><span>Brinell</span><strong>{results?.HB || '--'} HB</strong></div>
                <div style={{...s.resBox, background:'#eff6ff'}}><span>Resistenza</span><strong style={{color:'#3b82f6'}}>{results?.Rm || '--'} N/mm²</strong></div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', background: 'none', color: '#94a3b8', fontWeight: 600 },
  navBtnAct: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '5px 12px', borderRadius: '20px' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px' },
  uMsg: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 16px', borderRadius: '18px 18px 2px 18px', fontSize: '14px' },
  aMsg: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '2px 18px 18px 18px', fontSize: '14px' },
  inputContainer: { position: 'relative' },
  inputArea: { display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' },
  histToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' },
  input: { flex: 1, border: 'none', outline: 'none' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 15px', fontWeight: 700, cursor: 'pointer' },
  dropdown: { position: 'absolute', bottom: '110%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', zIndex: 100, overflow: 'hidden' },
  dropTitle: { padding: '10px 15px', fontSize: '10px', fontWeight: 800, color: '#94a3b8', borderBottom: '1px solid #f1f5f9' },
  dropItem: { padding: '12px 15px', fontSize: '13px', cursor: 'pointer', transition: '0.2s', borderBottom: '1px solid #f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  dropClear: { padding: '10px', textAlign: 'center', fontSize: '11px', color: '#ef4444', cursor: 'pointer', fontWeight: 700 },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', border: '1px solid #e2e8f0' },
  textarea: { width: '100%', height: '150px', borderRadius: '15px', border: '1px solid #e2e8f0', padding: '15px', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px' },
  resBox: { padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center', display: 'flex', flexDirection: 'column' },
  inputBorder: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  select: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }
};
