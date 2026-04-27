import React, { useState, useRef, useEffect } from "react";

// DATABASE INTEGRATO DAL TUO PDF (ESTRATTO)
const MATERIAL_DB = [
  { w: "1.0401", din: "C15", aisi: "1015", uni: "C15", tipo: "Carbonio" },
  { w: "1.0503", din: "C45", aisi: "1045", uni: "C45", tipo: "Carbonio" },
  { w: "1.7225", din: "42CrMo4", aisi: "4140", uni: "42CrMo4", tipo: "Legato" },
  { w: "1.3505", din: "100Cr6", aisi: "52100", uni: "100Cr6", tipo: "Legato" },
  { w: "1.4301", din: "X5CrNi18-10", aisi: "304", uni: "X5CrNi1810", tipo: "Inox" },
  { w: "0.7040", din: "GGG 40", aisi: "60-40-18", uni: "GS 400-12", tipo: "Ghisa" }
];

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileRef = useRef<HTMLInputElement>(null);

  // --- LOGICA DUREZZE PROFESSIONALE (Formule DIN 50150) ---
  const convertHardness = (val: number, type: string) => {
    if (!val || isNaN(val)) return null;
    let hv = val;
    if (type === "HB") hv = val / 0.95;
    if (type === "HRC") hv = (val + 104) / 0.164;
    if (type === "HRB") hv = (val + 130) / 0.37;

    return {
      HV: Math.round(hv),
      HB: Math.round(hv * 0.95),
      HRC: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      HRB: hv <= 240 ? Math.round(0.37 * hv - 130) : "-",
      HK: Math.round(hv * 1.05),
      Rm: Math.round(hv * 3.35) // Resistenza a trazione N/mm²
    };
  };

  const hRes = convertHardness(parseFloat(hVal), hFrom);

  const askAI = async (override?: string) => {
    const input = override || query;
    if (!input.trim() || loading) return;
    setLoading(true);
    const newChat = [...chat, { role: "utente", text: input }];
    setChat(newChat);
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei un Technical Copilot. Usa i dati: ${JSON.stringify(MATERIAL_DB)}. Rispondi con tabelle.` },
            { role: "user", content: input }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore API. Controlla la chiave." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.app}>
      {/* SIDEBAR - STILE ORIGINALE */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view==='advisor'?s.btnAct:s.btn} onClick={()=>setView('advisor')}>🧠 Advisor AI</button>
          <button style={view==='bom'?s.btnAct:s.btn} onClick={()=>setView('bom')}>📋 Distinta BOM</button>
          <button style={view==='calc'?s.btnAct:s.btn} onClick={()=>setView('calc')}>📐 Calcolatori</button>
        </nav>
        <div style={s.sidebarFooter}>DB: PDF_CONFRONTO_V1</div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div style={s.status}><div style={s.dot}></div> Database Materiali PDF Attivo</div>
          <button style={s.clearBtn} onClick={()=>setChat([])}>Pulisci Chat</button>
        </header>

        <section style={s.container}>
          {/* VISTA ADVISOR */}
          {view === 'advisor' && (
            <div style={s.chatBox}>
              <div style={s.scrollArea}>
                {chat.length === 0 && <div style={s.empty}>Chiedi info su acciai, trattamenti o equivalenti...</div>}
                {chat.map((m,i) => (
                  <div key={i} style={m.role==='utente'?s.uMsg:s.aMsg}>
                    <div style={s.bubble}>{m.text}</div>
                  </div>
                ))}
                {loading && <div style={s.loader}>Analisi tecnica...</div>}
              </div>
              <div style={s.inputBar}>
                <input style={s.input} value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>e.key==='Enter'&&askAI()} placeholder="Scrivi qui la tua domanda tecnica..." />
                <button style={s.sendBtn} onClick={()=>askAI()}>Invia</button>
              </div>
            </div>
          )}

          {/* VISTA BOM - CARICAMENTO FILE E PDF */}
          {view === 'bom' && (
            <div style={s.card}>
              <h3>Conversione Materiali (BOM)</h3>
              <p style={s.subtitle}>Puoi inserire le sigle manualmente o caricare un file della distinta.</p>
              
              <div style={s.toolRow}>
                <label style={s.fileLabel}>
                  📁 Carica Distinta (PDF/TXT/CSV)
                  <input type="file" hidden ref={fileRef} onChange={(e) => {
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

              <textarea style={s.textarea} value={bomList} onChange={e=>setBomList(e.target.value)} placeholder="Esempio:&#10;C45&#10;1.7225&#10;AISI 304" />
              <button style={s.primaryBtn} onClick={()=>askAI(`Analizza questa distinta materiali e crea una tabella con equivalenti W.-Nr, AISI, UNI: ${bomList}`)}>
                AVVIA CONVERSIONE BATCH
              </button>
            </div>
          )}

          {/* VISTA CALCOLATORI - DUREZZE PROFESSIONALI */}
          {view === 'calc' && (
            <div style={s.grid}>
              <div style={s.card}>
                <h3>🔄 Convertitore Durezze Totale</h3>
                <div style={s.row}>
                  <input style={s.input} type="number" value={hVal} onChange={e=>setHVal(e.target.value)} placeholder="Valore" />
                  <select style={s.select} value={hFrom} onChange={e=>setHFrom(e.target.value)}>
                    <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                  </select>
                </div>
                <div style={s.resGrid}>
                  <ResultItem label="Vickers" val={hRes?.HV} unit="HV" />
                  <ResultItem label="Brinell" val={hRes?.HB} unit="HB" />
                  <ResultItem label="Rockwell C" val={hRes?.HRC} unit="HRC" />
                  <ResultItem label="Rockwell B" val={hRes?.HRB} unit="HRB" />
                  <ResultItem label="Knoop" val={hRes?.HK} unit="HK" />
                  <ResultItem label="Resistenza (Rm)" val={hRes?.Rm} unit="N/mm²" blue />
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .container-anim { animation: slideUp 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// --- SOTTO-COMPONENTI ---
const ResultItem = ({label, val, unit, blue}: any) => (
  <div style={{...s.resBox, backgroundColor: blue ? '#eff6ff' : '#f8fafc'}}>
    <div style={s.resLabel}>{label}</div>
    <div style={{...s.resVal, color: blue ? '#3b82f6' : '#1e293b'}}>{val || '--'} <small style={{fontSize:'10px'}}>{unit}</small></div>
  </div>
);

// --- STILI JSS (SIDEBAR SCURA + CARD PULITE) ---
const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', color: 'white', padding: '30px 20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  btn: { padding: '12px 15px', border: 'none', borderRadius: '12px', backgroundColor: 'transparent', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: 600, transition: '0.2s' },
  btnAct: { padding: '12px 15px', border: 'none', borderRadius: '12px', backgroundColor: '#3b82f6', color: 'white', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  sidebarFooter: { fontSize: '10px', color: '#475569', borderTop: '1px solid #1e293b', paddingTop: '15px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  status: { fontSize: '12px', fontWeight: 700, color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' },
  dot: { width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' },
  clearBtn: { background: 'none', border: 'none', color: '#ef4444', fontSize: '11px', fontWeight: 800, cursor: 'pointer' },
  container: { flex: 1, padding: '40px', overflowY: 'auto' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  subtitle: { fontSize: '14px', color: '#64748b', marginBottom: '20px' },
  toolRow: { display: 'flex', gap: '10px', marginBottom: '15px' },
  fileLabel: { padding: '10px 20px', backgroundColor: '#f1f5f9', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 700, border: '1px solid #e2e8f0' },
  secBtn: { padding: '10px 20px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '10px', cursor: 'pointer', fontSize: '13px' },
  textarea: { width: '100%', height: '180px', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '15px', outline: 'none', fontFamily: 'monospace' },
  primaryBtn: { width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer', marginTop: '15px' },
  chatBox: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '850px', margin: '0 auto' },
  scrollArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '20px' },
  uMsg: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 18px', borderRadius: '18px 18px 2px 18px', fontSize: '14px', maxWidth: '80%' },
  aMsg: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '2px 18px 18px 18px', fontSize: '14px', maxWidth: '80%', color: '#1e293b' },
  inputBar: { display: 'flex', gap: '10px', backgroundColor: 'white', padding: '8px', borderRadius: '16px', border: '1px solid #e2e8f0' },
  input: { flex: 1, border: 'none', outline: 'none', padding: '10px 15px' },
  sendBtn: { backgroundColor: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', maxWidth: '700px' },
  row: { display: 'flex', gap: '10px', marginBottom: '20px' },
  select: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' },
  resBox: { padding: '15px', borderRadius: '15px', border: '1px solid #e2e8f0', textAlign: 'center' },
  resLabel: { fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '5px' },
  resVal: { fontSize: '20px', fontWeight: 800 },
  empty: { textAlign: 'center', marginTop: '100px', color: '#94a3b8' },
  loader: { textAlign: 'center', color: '#3b82f6', fontWeight: 700, fontSize: '12px' }
};
