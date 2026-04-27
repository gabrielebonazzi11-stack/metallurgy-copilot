import React, { useState, useEffect, useRef } from "react";

// --- LOGICA DI CONVERSIONE DUREZZA (Approssimazione Standard Acciai) ---
const convertHardness = (val: number, from: string) => {
  if (!val) return {};
  let hv = val;
  // Normalizziamo tutto in Vickers (HV) per poi convertire negli altri
  if (from === "HRC") hv = (val + 104) / 0.164; // Approx
  else if (from === "HB") hv = val * 0.95;
  else if (from === "HRB") hv = (val + 130) / 0.37;
  
  return {
    HV: Math.round(hv),
    HB: Math.round(hv / 0.95),
    HRC: hv > 240 ? Math.round((0.164 * hv) - 104) : "-",
    HRB: hv < 240 ? Math.round((0.37 * hv) - 130) : "-",
    HK: Math.round(hv * 1.05),
    R: Math.round(hv * 3.35) // Resistenza N/mm2
  };
};

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Stati Calcolatori
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");
  const [weightResult, setWeightResult] = useState(0);
  const [wParams, setWParams] = useState({ type: "tondo", d: "", l: "", w: "", h: "", rho: 7.85 });

  // Stato BOM
  const [bomList, setBomList] = useState("");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const askAI = async (text?: string) => {
    const input = text || query;
    if (!apiKey || !input.trim()) return;
    setLoading(true);
    const newChat = [...chat, { role: "utente", text: input }];
    setChat(newChat);
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // MODELLO AGGIORNATO
          messages: [
            { role: "system", content: "Sei un Ingegnere Metallurgico esperto. Rispondi in italiano. Fornisci dati tecnici precisi su materiali, trattamenti termici e saldabilità. Usa tabelle se necessario." },
            { role: "user", content: input }
          ],
          temperature: 0.2
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di connessione API. Verifica la tua API KEY." }]);
    } finally {
      setLoading(false);
    }
  };

  // Calcolo Peso Reale
  useEffect(() => {
    let vol = 0; // mm3
    const { d, l, w, h, type, rho } = wParams;
    const df = parseFloat(d), lf = parseFloat(l), wf = parseFloat(w), hf = parseFloat(h);
    
    if (type === "tondo" && df && lf) vol = Math.PI * Math.pow(df/2, 2) * lf;
    if (type === "quadro" && df && lf) vol = df * df * lf;
    if (type === "piatto" && lf && wf && hf) vol = wf * hf * lf;
    
    setWeightResult((vol * rho) / 1000000); // kg
  }, [wParams]);

  const hRes = convertHardness(parseFloat(hVal), hFrom);

  return (
    <div style={s.container}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <NavBtn active={view==='advisor'} onClick={()=>setView('advisor')} icon="🧠" label="AI Advisor" />
          <NavBtn active={view==='bom'} onClick={()=>setView('bom')} icon="📋" label="Materiali / BOM" />
          <NavBtn active={view==='calc'} onClick={()=>setView('calc')} icon="📐" label="Calcolatori" />
        </nav>
        <div style={s.dbTag}>DATABASE: PDF_ST_2024.1</div>
      </aside>

      {/* CONTENT */}
      <main style={s.main}>
        <header style={s.header}>
          <div style={{display:'flex', gap:'40px'}}>
            <Stat label="Modello AI" val="Llama 3.3 Pro" active />
            <Stat label="Fonte Dati" val="Mista (PDF + Web)" />
          </div>
          <button style={s.clearBtn} onClick={()=>setChat([])}>Pulisci Sessione</button>
        </header>

        <section style={s.scrollArea}>
          {/* VIEW: ADVISOR */}
          {view === 'advisor' && (
            <div style={s.chatContainer}>
              <div style={s.chatList}>
                {chat.length === 0 && <div style={s.empty}>Chiedi info su un trattamento (es. "Bonifica C40")</div>}
                {chat.map((m,i)=>(
                  <div key={i} style={m.role==='utente' ? s.msgUser : s.msgAi}>
                    <div style={s.msgBubble}>{m.text}</div>
                  </div>
                ))}
                {loading && <div style={s.loader}>Elaborazione tecnica...</div>}
              </div>
              <div style={s.inputBox}>
                <input style={s.input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Scrivi qui la tua richiesta tecnica..." />
                <button style={s.sendBtn} onClick={()=>askAI()}>Invia</button>
              </div>
            </div>
          )}

          {/* VIEW: BOM */}
          {view === 'bom' && (
            <div style={s.card}>
              <h2>Conversione Normativa Massiva</h2>
              <p style={{color:'#64748b', marginBottom:'20px'}}>Incolla una lista di materiali o carica un file per la conversione automatica.</p>
              <div style={{display:'flex', gap:'10px', marginBottom:'20px'}}>
                <label style={s.fileBtn}>
                   📁 Carica Fonte (CSV/TXT)
                  <input type="file" hidden onChange={e => {
                    const f = e.target.files?.[0];
                    if(f) {
                      const r = new FileReader();
                      r.onload = (ev) => setBomList(ev.target?.result as string);
                      r.readAsText(f);
                    }
                  }} />
                </label>
                <button style={s.secBtn} onClick={()=>setBomList("")}>Reset</button>
              </div>
              <textarea style={s.textarea} value={bomList} onChange={e=>setBomList(e.target.value)} placeholder="Esempio:&#10;C45&#10;39NiCrMo3&#10;1.4301" />
              <button style={s.primaryBtn} onClick={()=>askAI(`Converti questa lista in tabella (W.-Nr, AISI, DIN, UNI): ${bomList}`)}>
                AVVIA CONVERSIONE BATCH
              </button>
            </div>
          )}

          {/* VIEW: CALC */}
          {view === 'calc' && (
            <div style={s.grid}>
              <div style={s.card}>
                <h3>🔄 Convertitore Durezza</h3>
                <div style={s.row}>
                  <input style={s.input} type="number" value={hVal} onChange={e=>setHVal(e.target.value)} placeholder="Valore" />
                  <select style={s.select} value={hFrom} onChange={e=>setHFrom(e.target.value)}>
                    <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                  </select>
                </div>
                <div style={s.resGrid}>
                  <ResBox label="Vickers (HV)" val={hRes.HV} />
                  <ResBox label="Rockwell (HRC)" val={hRes.HRC} />
                  <ResBox label="Brinell (HB)" val={hRes.HB} />
                  <ResBox label="Knoop (HK)" val={hRes.HK} />
                  <ResBox label="Resistenza (Rm)" val={hRes.R + " N/mm²"} />
                </div>
              </div>

              <div style={s.card}>
                <h3>⚖️ Calcolo Peso Teorico</h3>
                <select style={{...s.select, width:'100%', marginBottom:'10px'}} onChange={e=>setWParams({...wParams, type: e.target.value})}>
                  <option value="tondo">Barra Tonda</option>
                  <option value="quadro">Barra Quadra</option>
                  <option value="piatto">Piatto / Lastra</option>
                </select>
                <div style={s.row}>
                  {wParams.type !== 'piatto' && <input style={s.input} type="number" placeholder="Dim (mm)" onChange={e=>setWParams({...wParams, d: e.target.value})} />}
                  {wParams.type === 'piatto' && (
                    <>
                      <input style={s.input} type="number" placeholder="Largh (mm)" onChange={e=>setWParams({...wParams, w: e.target.value})} />
                      <input style={s.input} type="number" placeholder="Spess (mm)" onChange={e=>setWParams({...wParams, h: e.target.value})} />
                    </>
                  )}
                  <input style={s.input} type="number" placeholder="Lungh (mm)" onChange={e=>setWParams({...wParams, l: e.target.value})} />
                </div>
                <div style={s.weightRes}>
                  <span style={{fontSize:'12px', color:'#64748b'}}>Peso Stimato:</span>
                  <div style={{fontSize:'32px', fontWeight:'800', color:'#10b981'}}>{weightResult.toFixed(2)} kg</div>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

// --- SOTTOCOMPONENTI STILIZZATI ---
const NavBtn = ({active, onClick, icon, label}: any) => (
  <button onClick={onClick} style={{
    ...s.navBtn, backgroundColor: active ? '#3b82f6' : 'transparent', color: active ? 'white' : '#94a3b8'
  }}>
    <span style={{marginRight:'12px'}}>{icon}</span> {label}
  </button>
);

const Stat = ({label, val, active}: any) => (
  <div>
    <div style={{fontSize:'10px', color:'#94a3b8', fontWeight:800, textTransform:'uppercase'}}>{label}</div>
    <div style={{fontSize:'14px', fontWeight:700, color: active ? '#10b981' : '#1e293b'}}>{val}</div>
  </div>
);

const ResBox = ({label, val}: any) => (
  <div style={{padding:'10px', backgroundColor:'#f8fafc', borderRadius:'8px', border:'1px solid #e2e8f0'}}>
    <div style={{fontSize:'10px', color:'#64748b', fontWeight:700}}>{label}</div>
    <div style={{fontSize:'16px', fontWeight:800, color:'#1e293b'}}>{val || '--'}</div>
  </div>
);

// --- STILI (JSS) ---
const s: any = {
  container: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', color: 'white', padding: '30px 20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '20px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { border: 'none', padding: '12px 16px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', fontWeight: 600, transition: '0.2s' },
  dbTag: { fontSize: '10px', color: '#475569', paddingTop: '20px', borderTop: '1px solid #1e293b' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  clearBtn: { background: 'none', border: 'none', color: '#ef4444', fontWeight: 700, cursor: 'pointer', fontSize: '12px' },
  scrollArea: { flex: 1, overflowY: 'auto', padding: '40px' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', border: '1px solid #e2e8f0' },
  chatContainer: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '900px', margin: '0 auto' },
  chatList: { flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '15px' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 18px', borderRadius: '18px 18px 2px 18px', maxWidth: '80%' },
  msgAi: { alignSelf: 'flex-start', backgroundColor: 'white', color: '#1e293b', padding: '12px 18px', borderRadius: '18px 18px 18px 2px', maxWidth: '80%', border: '1px solid #e2e8f0' },
  inputBox: { display: 'flex', gap: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '16px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  input: { flex: 1, border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', outline: 'none' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '0 25px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  fileBtn: { backgroundColor: '#f1f5f9', padding: '12px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', border: '1px solid #e2e8f0' },
  textarea: { width: '100%', height: '180px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', outline: 'none', fontFamily: 'monospace' },
  primaryBtn: { backgroundColor: '#10b981', color: 'white', border: 'none', padding: '14px', borderRadius: '12px', width: '100%', marginTop: '15px', fontWeight: 800, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '25px' },
  row: { display: 'flex', gap: '10px', marginTop: '15px' },
  select: { border: '1px solid #e2e8f0', padding: '10px', borderRadius: '10px', outline: 'none' },
  resGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '20px' },
  weightRes: { marginTop: '25px', padding: '20px', backgroundColor: '#f0fdf4', borderRadius: '16px', textAlign: 'center' },
  loader: { textAlign: 'center', color: '#3b82f6', fontSize: '12px', fontWeight: 700 },
  empty: { textAlign: 'center', marginTop: '100px', color: '#94a3b8' }
};
