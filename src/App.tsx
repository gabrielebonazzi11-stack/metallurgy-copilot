import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion"; // Assicurati di fare: npm install framer-motion

// DATABASE ESTRATTO DAL TUO PDF [cite: 36, 38, 45, 54, 56]
const DB_MATERIALI = [
  { w: "1.0401", din: "C15", aisi: "1015", uni: "C15", tipo: "Carbonio" },
  { w: "1.0503", din: "C45", aisi: "1045", uni: "C45", tipo: "Carbonio" },
  { w: "1.7225", din: "42CrMo4", aisi: "4140", uni: "42CrMo4", tipo: "Legato" },
  { w: "1.3505", din: "100Cr6", aisi: "52100", uni: "100Cr6", tipo: "Legato" },
  { w: "1.4301", din: "X5CrNi18-10", aisi: "304", uni: "X5CrNi1810", tipo: "Inox" },
  { w: "1.4404", din: "316L", aisi: "316L", uni: "X2CrNiMo1712", tipo: "Inox" },
  { w: "0.6025", din: "GG25", aisi: "No 35 B", uni: "G25", tipo: "Ghisa" },
  { w: "0.7040", din: "GGG 40", aisi: "60-40-18", uni: "GS 400-12", tipo: "Ghisa" },
];

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hVal, setHVal] = useState<any>("");
  const [hFrom, setHFrom] = useState("HB");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  // --- LOGICA CONVERSIONE DUREZZA PROFESSIONALE ---
  const getHardness = (v: number, type: string) => {
    if (!v) return null;
    let hv = v;
    if (type === "HRC") hv = (v + 104) / 0.164;
    if (type === "HB") hv = v / 0.95;
    if (type === "HRB") hv = (v + 130) / 0.37;
    
    return {
      hv: Math.round(hv),
      hb: Math.round(hv * 0.95),
      hrc: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      hrb: hv < 240 ? Math.round(0.37 * hv - 130) : "-",
      hk: Math.round(hv * 1.05),
      rm: Math.round(hv * 3.35)
    };
  };

  const results = getHardness(parseFloat(hVal), hFrom);

  const askAI = async (text?: string) => {
    const input = text || query;
    if (!input.trim() || loading) return;
    setLoading(true);
    setChat(prev => [...prev, { role: "utente", text: input }]);
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "system", content: "Sei un Ingegnere Metallurgico esperto. Rispondi in italiano usando tabelle per i dati tecnici." }, { role: "user", content: input }],
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat(prev => [...prev, { role: "AI", text: "Errore API. Controlla la chiave." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.app}>
      {/* SIDEBAR CON ANIMAZIONE */}
      <motion.aside initial={{ x: -100 }} animate={{ x: 0 }} style={s.sidebar}>
        <div style={s.logo}>TECH<span>COPILOT</span></div>
        <div style={s.nav}>
          <NavBtn active={view === 'advisor'} label="Advisor AI" icon="🧠" onClick={() => setView('advisor')} />
          <NavBtn active={view === 'bom'} label="Materiali BOM" icon="📋" onClick={() => setView('bom')} />
          <NavBtn active={view === 'calc'} label="Calcolatori" icon="📐" onClick={() => setView('calc')} />
        </div>
      </motion.aside>

      <main style={s.main}>
        <header style={s.header}>
          <h2>{view === 'advisor' ? 'AI Metallurgical Advisor' : view === 'bom' ? 'Conversione Distinta Base' : 'Engineering Tools'}</h2>
        </header>

        <AnimatePresence mode="wait">
          <motion.section 
            key={view}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            style={s.content}
          >
            {/* VIEW ADVISOR */}
            {view === 'advisor' && (
              <div style={s.chatWrapper}>
                <div style={s.chatArea}>
                  {chat.map((m, i) => (
                    <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} key={i} style={m.role === 'utente' ? s.msgUser : s.msgAi}>
                      {m.text}
                    </motion.div>
                  ))}
                  {loading && <div style={s.loader}>Analisi in corso...</div>}
                </div>
                <div style={s.inputBar}>
                  <input style={s.input} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Chiedi info tecniche..." />
                  <button style={s.sendBtn} onClick={() => askAI()}>Invia</button>
                </div>
              </div>
            )}

            {/* VIEW BOM - FUNZIONANTE [cite: 36, 47] */}
            {view === 'bom' && (
              <div style={s.card}>
                <h3>Conversione Massiva</h3>
                <textarea 
                  style={s.textarea} 
                  value={bomList} 
                  onChange={e => setBomList(e.target.value)} 
                  placeholder="Inserisci sigle (es: C45, 1.4301, GGG40)..." 
                />
                <button style={s.primaryBtn} onClick={() => askAI(`Genera una tabella di confronto tecnico per questi materiali: ${bomList}`)}>
                  Converti Lista con AI
                </button>
                <div style={s.quickTable}>
                  <p>Suggerimenti rapidi dal Database PDF:</p>
                  <div style={s.chipArea}>
                    {DB_MATERIALI.map(m => (
                      <span key={m.w} onClick={() => setBomList(prev => prev + m.din + ", ")} style={s.chip}>{m.din}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW CALC - TUTTE LE DUREZZE  */}
            {view === 'calc' && (
              <div style={s.grid}>
                <div style={s.card}>
                  <h3>🔄 Convertitore Totale Durezze</h3>
                  <div style={s.row}>
                    <input style={s.input} type="number" value={hVal} onChange={e => setHVal(e.target.value)} placeholder="Valore" />
                    <select style={s.select} value={hFrom} onChange={e => setHFrom(e.target.value)}>
                      <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                    </select>
                  </div>
                  <div style={s.hardnessResults}>
                    <ResultRow label="Vickers" val={results?.hv} unit="HV" />
                    <ResultRow label="Brinell" val={results?.hb} unit="HB" />
                    <ResultRow label="Rockwell C" val={results?.hrc} unit="HRC" />
                    <ResultRow label="Rockwell B" val={results?.hrb} unit="HRB" />
                    <ResultRow label="Knoop" val={results?.hk} unit="HK" />
                    <ResultRow label="Resistenza" val={results?.rm} unit="N/mm²" highlight />
                  </div>
                </div>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- COMPONENTI UI ---
const NavBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} style={{ ...s.navBtn, backgroundColor: active ? '#3b82f6' : 'transparent', color: active ? 'white' : '#94a3b8' }}>
    <span style={{ marginRight: '10px' }}>{icon}</span> {label}
  </button>
);

const ResultRow = ({ label, val, unit, highlight }: any) => (
  <div style={{ ...s.resRow, backgroundColor: highlight ? '#eff6ff' : '#f8fafc' }}>
    <span>{label}</span>
    <span style={{ fontWeight: 800, color: highlight ? '#3b82f6' : '#1e293b' }}>{val} {unit}</span>
  </div>
);

// --- STILI REVISIONATI ---
const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', color: '#1e293b', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#ffffff', borderRight: '1px solid #e2e8f0', padding: '30px 20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '5px' },
  navBtn: { border: 'none', padding: '12px 15px', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', fontWeight: 600, transition: '0.3s' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' },
  chatArea: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '20px' },
  msgUser: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 20px', borderRadius: '15px 15px 0 15px', fontSize: '14px' },
  msgAi: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '15px 20px', borderRadius: '0 15px 15px 15px', fontSize: '14px', lineHeight: '1.6' },
  inputBar: { display: 'flex', gap: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0' },
  input: { flex: 1, border: 'none', outline: 'none', padding: '10px' },
  sendBtn: { backgroundColor: '#1e293b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  textarea: { width: '100%', height: '120px', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '15px', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', backgroundColor: '#10b981', color: 'white', border: 'none', padding: '15px', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', maxWidth: '600px' },
  row: { display: 'flex', gap: '10px', marginBottom: '20px' },
  select: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  resRow: { display: 'flex', justifyContent: 'space-between', padding: '12px 15px', borderRadius: '8px', marginBottom: '5px', fontSize: '14px' },
  chipArea: { display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '10px' },
  chip: { padding: '5px 12px', backgroundColor: '#f1f5f9', borderRadius: '20px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 },
  loader: { color: '#3b82f6', fontWeight: 700, fontSize: '12px', textAlign: 'center' }
};
