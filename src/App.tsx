import React, { useState, useRef } from "react";

// IL TUO PDF È ORA MEMORIZZATO QUI (Estratto sintetico per l'AI)
const PDF_DATABASE = `
Acciai al Carbonio: 1.0038(RSt.37-2), 1.0401(C15), 1.0402(C22), 1.0503(C45), 1.1191(Ck45).
Acciai Legati: 1.3505(100Cr6/52100), 1.7225(42CrMo4/4140), 1.7131(16MnCr5), 1.2344(H13).
Inox: 1.4301(304), 1.4404(316L), 1.4016(430), 1.4542(630/17-4PH).
Ghise: 0.6025(GG25), 0.7040(GGG40).
`;

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGICA CONVERSIONE DUREZZE (Formule Standard) ---
  const getHardnessConversion = (v: number, type: string) => {
    if (!v || isNaN(v)) return null;
    let hv = v;
    if (type === "HB") hv = v / 0.95;
    if (type === "HRC") hv = (v + 104) / 0.164;
    if (type === "HRB") hv = (v + 130) / 0.37;
    
    return {
      HV: Math.round(hv),
      HB: Math.round(hv * 0.95),
      HRC: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      HRB: hv <= 240 ? Math.round(0.37 * hv - 130) : "-",
      Rm: Math.round(hv * 3.35) // Resistenza N/mm²
    };
  };

  const results = getHardnessConversion(parseFloat(hVal), hFrom);

  // --- FUNZIONE UNIFICATA PER CHIAMATA AI ---
  const callAI = async (textToProcess?: string) => {
    const finalQuery = textToProcess || query;
    if (!finalQuery.trim() || loading) return;

    setLoading(true);
    const updatedChat = [...chat, { role: "utente", text: finalQuery }];
    setChat(updatedChat);
    setQuery("");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei un esperto metallurgico. Usa questo database PDF per le equivalenze: ${PDF_DATABASE}. Rispondi sempre con tabelle Markdown pulite.` },
            { role: "user", content: finalQuery }
          ],
        }),
      });
      const data = await response.json();
      setChat([...updatedChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (err) {
      setChat([...updatedChat, { role: "AI", text: "Errore di connessione. Verifica la API KEY." }]);
    } finally {
      setLoading(false);
    }
  };

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

      {/* MAIN CONTENT */}
      <main style={s.main}>
        <header style={s.header}>
          <div style={s.badge}>DATABASE PDF CARICATO IN MEMORIA</div>
        </header>

        <section style={s.content}>
          {/* VIEW: ADVISOR */}
          {view === "advisor" && (
            <div style={s.chatWrapper}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uMsg : s.aMsg}>{m.text}</div>
                ))}
              </div>
              <div style={s.inputArea}>
                <input style={s.input} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && callAI()} placeholder="Chiedi equivalenze o consigli tecnici..." />
                <button style={s.sendBtn} onClick={() => callAI()}>Invia</button>
              </div>
            </div>
          )}

          {/* VIEW: BOM - TASTO VERDE RIPRISTINATO */}
          {view === "bom" && (
            <div style={s.card}>
              <h3>Analisi Distinta Materiali</h3>
              <p style={{fontSize:'13px', color:'#64748b', marginBottom:'15px'}}>L'AI utilizzerà i dati del PDF per trovare gli equivalenti W.-Nr, AISI e UNI.</p>
              
              <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                <button style={s.secBtn} onClick={() => fileInputRef.current?.click()}>📁 Carica File</button>
                <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                  const f = e.target.files?.[0];
                  if(f) {
                    const reader = new FileReader();
                    reader.onload = (ev) => setBomList(ev.target?.result as string);
                    reader.readAsText(f);
                  }
                }} />
                <button style={s.secBtn} onClick={() => setBomList("")}>Pulisci</button>
              </div>

              <textarea 
                style={s.textarea} 
                value={bomList} 
                onChange={e => setBomList(e.target.value)} 
                placeholder="Incolla qui la lista dei materiali (es. C45, 1.7225, 304L)..."
              />
              
              {/* IL TASTO VERDE ORA FUNZIONA CORRETTAMENTE */}
              <button 
                style={s.primaryBtn} 
                onClick={() => {
                   if(!bomList) alert("Inserisci prima dei materiali!");
                   else callAI(`Analizza questa lista materiali e crea una tabella comparativa usando i dati del PDF: ${bomList}`);
                }}
              >
                {loading ? "ANALISI IN CORSO..." : "AVVIA ANALISI BATCH"}
              </button>
            </div>
          )}

          {/* VIEW: CALC */}
          {view === "calc" && (
            <div style={s.card}>
              <h3>Convertitore Durezze e Resistenza</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'25px'}}>
                <input style={s.input} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                  <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                </select>
              </div>
              <div style={s.resGrid}>
                <ValBox label="Vickers" val={results?.HV} unit="HV" />
                <ValBox label="Brinell" val={results?.HB} unit="HB" />
                <ValBox label="Rockwell C" val={results?.HRC} unit="HRC" />
                <ValBox label="Resistenza" val={results?.Rm} unit="N/mm²" highlight />
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// --- UI COMPONENTS ---
const ValBox = ({ label, val, unit, highlight }: any) => (
  <div style={{...s.valBox, backgroundColor: highlight ? '#f0f9ff' : '#f8fafc', border: highlight ? '1px solid #3b82f6' : '1px solid #e2e8f0'}}>
    <div style={{fontSize:'11px', color:'#64748b', fontWeight:700}}>{label}</div>
    <div style={{fontSize:'20px', fontWeight:800, color: highlight ? '#3b82f6' : '#1e293b'}}>{val || '--'} <small style={{fontSize:'10px'}}>{unit}</small></div>
  </div>
);

// --- STILI JSS ---
const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', background: 'none', color: '#94a3b8', fontWeight: 600 },
  navBtnAct: { padding: '12px 15px', border: 'none', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', fontWeight: 800, backgroundColor: '#ecfdf5', padding: '5px 12px', borderRadius: '20px', display: 'inline-block' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0', maxWidth: '800px' },
  textarea: { width: '100%', height: '180px', borderRadius: '15px', border: '1px solid #e2e8f0', padding: '15px', outline: 'none', marginBottom: '15px', transition: '0.3s' },
  primaryBtn: { width: '100%', padding: '16px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '14px', fontWeight: 800, cursor: 'pointer', fontSize: '14px' },
  secBtn: { padding: '10px 18px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingBottom: '20px' },
  uMsg: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 16px', borderRadius: '18px 18px 2px 18px', fontSize: '14px' },
  aMsg: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '12px 16px', borderRadius: '2px 18px 18px 18px', fontSize: '14px', color: '#334155' },
  inputArea: { display: 'flex', gap: '10px', padding: '10px', backgroundColor: 'white', borderRadius: '16px', border: '1px solid #e2e8f0' },
  input: { flex: 1, border: 'none', outline: 'none', padding: '10px' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', padding: '10px 20px', fontWeight: 700, cursor: 'pointer' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '15px' },
  valBox: { padding: '20px', borderRadius: '18px', textAlign: 'center' },
  select: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' }
};
