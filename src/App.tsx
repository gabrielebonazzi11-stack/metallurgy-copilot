import React, { useState, useRef, useEffect } from "react";

// --- MEMORIA PDF INTEGRATA (Esempio dati) ---
const PDF_DATA_CONTEXT = `Riferimenti Materiali:
1.0503=C45 (Carbonio), Rm≈650 MPa, HB≈200.
1.7225=42CrMo4 (Legato), Rm≈1000 MPa, HB≈300.
1.4301=AISI304 (Inox), HB≈180.
Formule: HV = HB/0.95; Rm = HV*3.35.`;

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
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("copilot_final_v1");
    if (saved) {
      const parsed = JSON.parse(saved);
      setSessions(parsed);
      setActiveChatId(parsed[0]?.id || "");
    } else {
      createNewChat();
    }
  }, []);

  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem("copilot_final_v1", JSON.stringify(sessions));
    }
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [sessions, activeChatId]);

  const createNewChat = () => {
    const newId = Date.now().toString();
    const newChat: ChatSession = { id: newId, title: "Nuova Analisi", messages: [] };
    setSessions([newChat, ...sessions]);
    setActiveChatId(newId);
    setView("advisor");
  };

  const activeChat = sessions.find(s => s.id === activeChatId) || sessions[0];

  const callAI = async (textOverride?: string) => {
    const valToSend = textOverride || query;
    if (!valToSend.trim() || loading) return;

    setLoading(true);
    const updatedMessages: Message[] = [...(activeChat?.messages || []), { role: "utente", text: valToSend }];
    
    setSessions(sessions.map(s => s.id === activeChatId ? { ...s, messages: updatedMessages } : s));
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
              content: `Sei un ingegnere metallurgico esperto e gentile. Usa molte EMOJI.
              FORMATTAZIONE FORMULE: Per le frazioni matematiche, usa SEMPRE questo formato HTML: <span class="math-frac"><span>numeratore</span><span class="bottom">denominatore</span></span>.
              FORMATTAZIONE TABELLE: Usa tabelle HTML <table> pulite.
              Usa i dati del PDF: ${PDF_DATA_CONTEXT}. 
              Dopo ogni risposta chiedi: "Hai bisogno di altri dettagli o di un calcolo specifico?"` 
            },
            { role: "user", content: valToSend }
          ],
        }),
      });
      const data = await res.json();
      const aiResponse = data.choices[0].message.content;

      setSessions(prev => prev.map(s => s.id === activeChatId ? { ...s, messages: [...updatedMessages, { role: "AI", text: aiResponse }] } : s));
    } catch (e) {
      alert("Errore di connessione API. Controlla la chiave!");
    } finally {
      setLoading(false);
    }
  };

  const calcolatoreRes = (() => {
    const v = parseFloat(hVal);
    if (!v || isNaN(v)) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : v;
    return {
      hv: Math.round(hv),
      hb: Math.round(hv * 0.95),
      hrc: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      rm: Math.round(hv * 3.35)
    };
  })();

  return (
    <div style={s.app}>
      {/* SIDEBAR FISSA (Layout Ripristinato) */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <button style={s.newChatBtn} onClick={createNewChat}>+ NUOVA CHAT</button>
        <div style={s.sessionList}>
          {sessions.map(sIdx => (
            <div key={sIdx.id} onClick={() => { setActiveChatId(sIdx.id); setView("advisor"); }}
                 style={activeChatId === sIdx.id ? s.sItemAct : s.sItem}>💬 {sIdx.title}</div>
          ))}
        </div>
        <nav style={s.nav}>
          <button style={view === "bom" ? s.nBtnAct : s.nBtn} onClick={() => setView("bom")}>📋 DISTINTA BOM</button>
          <button style={view === "calc" ? s.nBtnAct : s.nBtn} onClick={() => setView("calc")}>📐 CALCOLATORE</button>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <main style={s.main}>
        <header style={s.header}>
          <div style={s.badge}>DATABASE PDF & MEMORIA ATTIVA ✅</div>
        </header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {activeChat?.messages.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox}
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ Sto elaborando i dati tecnici...</div>}
                <div ref={chatEndRef} />
              </div>

              <div style={s.inputWrapper}>
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
                  placeholder="Chiedi equivalenze, calcoli o trattamenti termici..."
                />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h3>📋 Analisi Batch Distinta (BOM)</h3>
              <p style={{fontSize:'13px', color:'#64748b', marginBottom:'15px'}}>Incolla una lista di materiali o sigle. L'AI userà la memoria cross-chat e i dati PDF.</p>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Esempio: 2x C45, 1x 42CrMo4, 3x AISI 304..." />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza batch materiali: ${bomList}`)}>AVVIA ANALISI BATCH</button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h3>📐 Convertitore Durezze e Resistenza</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input style={s.inputBorder} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                <ResBox label="Vickers" val={calcolatoreRes?.hv} unit="HV" />
                <ResBox label="Brinell" val={calcolatoreRes?.hb} unit="HB" />
                <ResBox label="Rockwell C" val={calcolatoreRes?.hrc} unit="HRC" />
                <ResBox label="Resistenza" val={calcolatoreRes?.rm} unit="N/mm²" blue />
              </div>
            </div>
          )}
        </section>
      </main>

      {/* --- STILE CSS PER FORMULE PROFESSIONALI (LaTeX-Style) --- */}
      <style>{`
        /* Tabelle pulite */
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 13px; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        tr:nth-child(even) { background-color: #f8fafc; }

        /* Formule Matematiche Professionale (Come su Foglio) */
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", Times, serif; font-size: 15px; margin: 0 5px; }
        .math-frac span { display: block; padding: 0 4px; }
        .math-frac span.bottom { border-top: 2px solid #1e293b; padding-top: 2px; }
      `}</style>
    </div>
  );
}

const ResBox = ({ label, val, unit, blue }: any) => (
  <div style={{...s.resBox, backgroundColor: blue ? '#eff6ff' : '#f8fafc', border: blue ? '1px solid #3b82f6' : '1px solid #e2e8f0'}}>
    <div style={{fontSize:'11px', color:'#64748b', fontWeight:700}}>{label}Il layout è andato storto perché il codice precedente non gestiva correttamente i margini e l'allineamento. Inoltre, le formule matematiche apparivano piatte.

Ecco il codice corretto che ripristina l'interfaccia originale pulita, con la sidebar scura a sinistra e la barra di input in basso che si espande verso l'alto.

Per quanto riguarda le formule matematiche, ho aggiunto uno stile CSS specifico che permette all'AI di generare frazioni "matematiche" reali (numero sopra, numero sotto e linea in mezzo), usando il font Times New Roman per dargli quel look da "foglio stampato" professionale.

### 🛠️ Codice Integrale `src/App.tsx` (Layout & Formule Fix)

```tsx
import React, { useState, useRef, useEffect } from "react";

const PDF_DB_CONTEXT = "Dati PDF: 1.0503=C45, HB≈200. 1.7225=42CrMo4, Rm≈1000MPa. 1.4301=304, Rm≈600MPa. Formula: Rm = HB * 3.35.";

interface Message {
  role: "utente" | "AI";
  text: string;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");
  const [view, setView] = useState("advisor");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    setLoading(true);
    const updatedChat = [...chat, { role: "utente", text: textToSend }];
    setChat(updatedChat);
    setQuery("");

    try {
      const res = await fetch("[https://api.groq.com/openai/v1/chat/completions](https://api.groq.com/openai/v1/chat/completions)", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `Sei un Ingegnere Metallurgico gentile ed esperto. Usa tabelle HTML per i dati.
              REGOLE FORMULA: Per le frazioni matematiche, usa SEMPRE questo formato HTML: <div class="math-frac"><span>numeratore</span><span class="bottom">denominatore</span></div>.
              Contesto PDF: ${PDF_DB_CONTEXT}. Usa emoji e chiudi sempre con una domanda.` 
            },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      const aiResponse = data.choices[0].message.content;
      setChat([...updatedChat, { role: "AI", text: aiResponse }]);
    } catch (e) {
      alert("Errore API Groq");
    } finally {
      setLoading(false);
    }
  };

  const calcRes = (() => {
    const v = parseFloat(hVal);
    if (!v || isNaN(v)) return null;
    let hv = hFrom === "HB" ? v / 0.95 : hFrom === "HRC" ? (v + 104) / 0.164 : v;
    return { hv: Math.round(hv), rm: Math.round(hv * 3.35) };
  })();

  return (
    <div style={s.app}>
      {/* SIDEBAR SCURA ORIGINALE */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 Advisor AI</button>
          <button style={view === "bom" ? s.navBtnAct : s.navBtn} onClick={() => setView("bom")}>📋 Distinta BOM</button>
          <button style={view === "calc" ? s.navBtnAct : s.navBtn} onClick={() => setView("calc")}>📐 Calcolatore</button>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>MEMORIA PDF ATTIVA ✅</div></header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox}
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{textAlign:'center', color:'#3b82f6'}}>✨ Elaborazione dati tecnici...</div>}
                <div ref={chatEndRef} />
              </div>

              {/* BARRA INPUT FISSA IN BASSO CHE SI ESPANDE */}
              <div style={s.inputContainer}>
                <div style={s.inputArea}>
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
                    placeholder="Chiedi equivalenze materiali o calcoli di durezza..." 
                  />
                  <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
                </div>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h3>📋 Conversione Distinta Materiali (BOM)</h3>
              <p style={{color:'#64748b', fontSize:'13px', marginBottom:'15px'}}>Incolla la tua lista materiali (es: C45, 42CrMo4) per una conversione batch rapida.</p>
              <textarea style={s.textarea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Esempio: 2x C45, 1x 1.4301..." />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza batch materiali: ${bomList}`)}>Analizza Lista con AI 🚀</button>
            </div>
          )}

          {view === "calc" && (
            <div style={s.card}>
              <h3>📐 Calcolatore Durezze / Resistenza</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <input style={s.inputCalc} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                <div style={s.resBox}><span>Vickers (HV)</span><strong>{calcRes?.hv || '--'}</strong></div>
                <div style={{...s.resBox, background:'#eff6ff', border:'1px solid #3b82f6'}}><span>Resistenza (Rm)</span><strong style={{color:'#3b82f6'}}>{calcRes?.rm || '--'} N/mm²</strong></div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* --- STILE CSS PER TABELLE E FORMULE PROFESSIONALI --- */}
      <style>{`
        /* Tabelle pulite */
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        th { background: #0f172a; color: white; padding: 10px; text-align: left; font-size: 13px; }
        td { padding: 10px; border-bottom: 1px solid #f1f5f9; font-size: 13px; color: #1e293b; }
        tr:nth-child(even) { background-color: #f8fafc; }

        /* Formule Matematiche come su Foglio (LaTeX style) */
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", Times, serif; font-size: 15px; margin: 0 5px; }
        .math-frac span { display: block; padding: 0 3px; }
        .math-frac span.bottom { border-top: 2px solid #1e293b; padding-top: 1px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif', overflow: 'hidden' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', background: 'none', color: '#94a3b8', fontWeight: 600 },
  navBtnAct: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '5px 12px', borderRadius: '20px' },
  content: { flex: 1, padding: '30px', overflowY: 'auto', position: 'relative' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '30px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#3b82f6', color: 'white', padding: '12px 18px', borderRadius: '18px 18px 2px 18px', fontSize: '14px' },
  aBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '2px 18px 18px 18px', fontSize: '14px', color: '#1e293b' },
  inputContainer: { width: '100%', borderTop: '1px solid #e2e8f0', padding: '15px', backgroundColor: 'white', borderRadius: '15px', marginTop: 'auto' },
  inputArea: { display: 'flex', alignItems: 'flex-end', gap: '10px' },
  textarea: { flex: 1, border: 'none', outline: 'none', padding: '10px', resize: 'none', maxHeight: '200px', fontSize: '15px' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #e2e8f0' },
  inputCalc: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '16px' },
  select: { padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' },
  resBox: { padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' },
  primaryBtn: { width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, marginTop: '10px', cursor: 'pointer' }
};
