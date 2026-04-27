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
  const [history, setHistory] = useState<string[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Scroll automatico all'ultimo messaggio
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    const newHistory = [textToSend, ...history.filter(h => h !== textToSend)].slice(0, 10);
    setHistory(newHistory);
    localStorage.setItem("tech_prompt_history", JSON.stringify(newHistory));

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
            { 
              role: "system", 
              content: `Sei un Technical Copilot gentile, esperto e coinvolgente. 
              Usa molte EMOJI (🛠️, 🔬, 📊, ✅) e icone. 
              Usa un tono professionale ma amichevole. 
              Dopo ogni risposta chiedi SEMPRE se l'utente ha bisogno di altri dettagli, calcoli specifici o se vuole approfondire un punto.
              Dati PDF: ${PDF_DB_CONTEXT}. 
              Formatta con grassetti e tabelle larghe.` 
            },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "❌ Oops! Qualcosa è andato storto con la connessione. Verifichiamo la tua API Key? 🛠️" }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.app}>
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
          <div style={s.badge}>🟢 SISTEMA INTELLIGENTE ATTIVO</div>
        </header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {chat.length === 0 && (
                  <div style={s.welcome}>
                    <h1>Ciao! Sono il tuo Copilota Tecnico 👋</h1>
                    <p>Posso aiutarti con equivalenze materiali, analisi trattamenti o calcoli di durezza. Cosa analizziamo oggi? 🔬</p>
                  </div>
                )}
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uMsgContainer : s.aMsgContainer}>
                    <div style={m.role === "utente" ? s.uMsg : s.aMsg}>
                      {m.text.split('\n').map((line, k) => <p key={k} style={{margin:'5px 0'}}>{line}</p>)}
                    </div>
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ Elaborazione dati tecnici in corso...</div>}
                <div ref={chatEndRef} />
              </div>
              
              <div style={s.inputContainer}>
                <div style={s.inputArea}>
                  <button style={s.iconBtn} title="Storico" onClick={() => setShowHistory(!showHistory)}>🕒</button>
                  <button style={s.iconBtn} title="Carica Immagine/File" onClick={() => fileInputRef.current?.click()}>📎</button>
                  <textarea 
                    style={s.textareaInput} 
                    rows={1}
                    value={query} 
                    onChange={e => {
                        setQuery(e.target.value);
                        e.target.style.height = 'auto';
                        e.target.style.height = e.target.scrollHeight + 'px';
                    }} 
                    onKeyDown={e => {
                        if(e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            callAI();
                        }
                    }} 
                    placeholder="Scrivi qui la tua domanda (Shift+Invio per andare a capo)..." 
                  />
                  <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
                </div>
                
                {showHistory && history.length > 0 && (
                  <div style={s.dropdown}>
                    <div style={s.dropTitle}>PROMPT RECENTI</div>
                    {history.map((h, i) => (
                      <div key={i} style={s.dropItem} onClick={() => { setQuery(h); setShowHistory(false); }}>{h}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h2 style={{fontSize:'24px', marginBottom:'10px'}}>📋 Analisi Batch Distinta</h2>
              <p style={{color:'#64748b', marginBottom:'20px'}}>Incolla la tua lista materiali: troverò tutte le equivalenze internazionali per te! ✨</p>
              <textarea 
                style={s.bomTextarea} 
                value={bomList} 
                onChange={e => setBomList(e.target.value)} 
                placeholder="Esempio:&#10;1.0503&#10;AISI 304&#10;42CrMo4"
              />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza questa lista materiali e crea una tabella comparativa: ${bomList}`)}>
                {loading ? "⌛ Analizzando..." : "AVVIA ANALISI PROFESSIONALE 🚀"}
              </button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h2 style={{fontSize:'24px', marginBottom:'20px'}}>📐 Calcolatore Precisione</h2>
              <div style={{display:'flex', gap:'15px', marginBottom:'30px'}}>
                <input style={s.inputBig} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.selectBig} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                {/* I calcoli vengono fatti nel componente o tramite funzione */}
                <div style={s.resBox}><span>Vickers (HV)</span><strong>--</strong></div>
                <div style={{...s.resBox, border:'2px solid #3b82f6'}}><span>Resistenza (Rm)</span><strong style={{color:'#3b82f6'}}>--</strong></div>
              </div>
            </div>
          )}
        </section>
        <input type="file" ref={fileInputRef} hidden />
      </main>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#fcfcfd', fontFamily: '"Segoe UI", Roboto, Helvetica, Arial, sans-serif' },
  sidebar: { width: '280px', backgroundColor: '#0f172a', padding: '40px 24px', color: 'white' },
  logo: { fontSize: '26px', fontWeight: 900, marginBottom: '50px', letterSpacing:'-1px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '12px' },
  navBtn: { padding: '14px 18px', border: 'none', borderRadius: '15px', textAlign: 'left', cursor: 'pointer', background: 'none', color: '#94a3b8', fontWeight: 600, fontSize:'15px' },
  navBtnAct: { padding: '14px 18px', border: 'none', borderRadius: '15px', textAlign: 'left', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600, fontSize:'15px', boxShadow:'0 4px 12px rgba(59, 130, 246, 0.3)' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #f1f5f9' },
  badge: { fontSize: '11px', color: '#10b981', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '6px 14px', borderRadius: '30px' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '1000px', margin: '0 auto' },
  welcome: { textAlign: 'center', marginTop: '10vh', color: '#1e293b' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '30px' },
  uMsgContainer: { display: 'flex', justifyContent: 'flex-end' },
  aMsgContainer: { display: 'flex', justifyContent: 'flex-start' },
  uMsg: { backgroundColor: '#3b82f6', color: 'white', padding: '16px 22px', borderRadius: '25px 25px 4px 25px', fontSize: '16px', lineHeight: '1.6', maxWidth: '80%', boxShadow:'0 4px 10px rgba(59,130,246,0.1)' },
  aMsg: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px 26px', borderRadius: '4px 25px 25px 25px', fontSize: '17px', lineHeight: '1.7', maxWidth: '90%', color: '#334155', boxShadow:'0 2px 15px rgba(0,0,0,0.03)' },
  inputContainer: { position: 'relative', marginTop: '20px' },
  inputArea: { display: 'flex', alignItems: 'flex-end', gap: '12px', padding: '12px 18px', backgroundColor: 'white', borderRadius: '24px', border: '2px solid #e2e8f0', boxShadow:'0 10px 30px rgba(0,0,0,0.05)' },
  textareaInput: { flex: 1, border: 'none', outline: 'none', padding: '10px 0', fontSize: '16px', resize: 'none', maxHeight: '200px', fontFamily: 'inherit' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', padding: '8px', borderRadius: '12px', transition: '0.2s', color: '#64748b' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '18px', padding: '12px 24px', fontWeight: 700, cursor: 'pointer', transition:'0.2s' },
  dropdown: { position: 'absolute', bottom: '100%', left: 0, right: 0, backgroundColor: 'white', borderRadius: '20px', boxShadow: '0 -10px 40px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0', marginBottom: '15px', overflow: 'hidden' },
  dropTitle: { padding: '15px 20px', fontSize: '11px', fontWeight: 800, color: '#94a3b8', background: '#f8fafc' },
  dropItem: { padding: '15px 20px', fontSize: '14px', cursor: 'pointer', borderBottom: '1px solid #f1f5f9' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '35px', border: '1px solid #e2e8f0', boxShadow:'0 20px 50px rgba(0,0,0,0.03)' },
  bomTextarea: { width: '100%', height: '250px', borderRadius: '25px', border: '2px solid #f1f5f9', padding: '25px', marginBottom: '20px', outline: 'none', fontSize: '16px' },
  primaryBtn: { width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '20px', fontWeight: 800, cursor: 'pointer', fontSize: '16px', boxShadow:'0 6px 20px rgba(16, 185, 129, 0.3)' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' },
  resBox: { padding: '25px', borderRadius: '25px', backgroundColor: '#f8fafc', textAlign: 'center', border: '1px solid #e2e8f0' },
  inputBig: { padding: '15px 25px', borderRadius: '18px', border: '2px solid #f1f5f9', fontSize: '18px', width: '150px' },
  selectBig: { padding: '15px', borderRadius: '18px', border: '2px solid #f1f5f9', fontSize: '16px' },
  loader: { padding: '10px', color: '#3b82f6', fontWeight: 600, fontSize: '14px', animation: 'pulse 1.5s infinite' }
};
