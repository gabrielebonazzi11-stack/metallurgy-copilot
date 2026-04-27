import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Dati reali estratti dal tuo PDF [cite: 6, 9, 15, 17, 24, 26]
const PDF_DATA = [
  { w: "1.0401", din: "C15", aisi: "1015", uni: "C15", tipo: "Acciaio Carbonio" },
  { w: "1.0503", din: "C45", aisi: "1045", uni: "C45", tipo: "Acciaio Carbonio" },
  { w: "1.7225", din: "42CrMo4", aisi: "4140", uni: "42CrMo4", tipo: "Acciaio Legato" },
  { w: "1.3505", din: "100Cr6", aisi: "52100", uni: "100Cr6", tipo: "Acciaio Legato" },
  { w: "1.4301", din: "X5CrNi18-10", aisi: "304", uni: "X5CrNi1810", tipo: "Inox Austenitico" },
  { w: "1.4404", din: "X2CrNiMo1712", aisi: "316L", uni: "X2CrNiMo1712", tipo: "Inox Austenitico" },
  { w: "0.6025", din: "GG 25", aisi: "No 35 B", uni: "G25", tipo: "Ghisa Grigia" },
  { w: "0.7040", din: "GGG 40", aisi: "60-40-18", uni: "GS 400-12", tipo: "Ghisa Sferoidale" }
];

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hardness, setHardness] = useState({ val: "", from: "HB" });
  
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Funzione per gestire il caricamento del file BOM
  const handleFileLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setBomList(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const askAI = async (customText?: string) => {
    const textToSend = customText || query;
    if (!textToSend.trim() || loading) return;

    setLoading(true);
    const newChat = [...chat, { role: "utente", text: textToSend }];
    setChat(newChat);
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei un esperto metallurgico. Usa questi dati certi: ${JSON.stringify(PDF_DATA)}. Rispondi sempre con tabelle comparative.` },
            { role: "user", content: textToSend }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di comunicazione con l'AI." }]);
    } finally {
      setLoading(false);
    }
  };

  // Calcolo Durezze (Tutte le scale principali)
  const calcH = (v: number, type: string) => {
    if (!v) return null;
    let hv = type === "HB" ? v / 0.95 : type === "HRC" ? (v + 104) / 0.164 : type === "HRB" ? (v + 130) / 0.37 : v;
    return {
      HV: Math.round(hv),
      HB: Math.round(hv * 0.95),
      HRC: hv > 240 ? Math.round(0.164 * hv - 104) : "-",
      HRB: hv <= 240 ? Math.round(0.37 * hv - 130) : "-",
      HK: Math.round(hv * 1.05),
      Rm: Math.round(hv * 3.35) // Resistenza N/mm2
    };
  };

  const hRes = calcH(parseFloat(hardness.val), hardness.from);

  return (
    <div style={s.container}>
      {/* SIDEBAR MODERNA */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span>COPILOT</span></div>
        <nav style={s.nav}>
          <NavBtn active={view === "advisor"} icon="🧠" label="AI Advisor" onClick={() => setView("advisor")} />
          <NavBtn active={view === "bom"} icon="📋" label="Distinta / BOM" onClick={() => setView("bom")} />
          <NavBtn active={view === "calc"} icon="📐" label="Calcolatori" onClick={() => setView("calc")} />
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <div style={s.status}>Database PDF: <span style={{color:'#10b981'}}>Attivo</span></div>
        </header>

        <AnimatePresence mode="wait">
          <motion.div 
            key={view} 
            initial={{ opacity: 0, y: 10 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: -10 }} 
            style={s.content}
          >
            {/* VIEW: BOM - FUNZIONANTE CON FILE E TESTO */}
            {view === "bom" && (
              <div style={s.card}>
                <h3 style={{marginBottom:'20px'}}>Conversione Distinta Materiali</h3>
                <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                  <button style={s.fileBtn} onClick={() => fileInputRef.current?.click()}>📁 Carica File BOM</button>
                  <input type="file" ref={fileInputRef} hidden onChange={handleFileLoad} accept=".txt,.csv" />
                  <button style={s.secBtn} onClick={() => setBomList("")}>Svuota</button>
                </div>
                <textarea 
                  style={s.textarea} 
                  placeholder="Incolla qui la lista dei materiali (es. C45, 1.7225, 304L)..." 
                  value={bomList} 
                  onChange={(e) => setBomList(e.target.value)}
                />
                <button style={s.primaryBtn} onClick={() => askAI(`Analizza e converti questa BOM: ${bomList}`)}>
                  Avvia Conversione AI
                </button>
              </div>
            )}

            {/* VIEW: CALC - TUTTE LE DUREZZE */}
            {view === "calc" && (
              <div style={s.grid}>
                <div style={s.card}>
                  <h3>🔄 Convertitore Durezze</h3>
                  <div style={s.row}>
                    <input style={s.input} type="number" placeholder="Valore" value={hardness.val} onChange={(e)=>setHardness({...hardness, val: e.target.value})} />
                    <select style={s.select} value={hardness.from} onChange={(e)=>setHardness({...hardness, from: e.target.value})}>
                      <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                    </select>
                  </div>
                  <div style={s.resGrid}>
                    <ValBox label="Vickers" val={hRes?.HV} unit="HV" />
                    <ValBox label="Brinell" val={hRes?.HB} unit="HB" />
                    <ValBox label="Rockwell C" val={hRes?.HRC} unit="HRC" />
                    <ValBox label="Rockwell B" val={hRes?.HRB} unit="HRB" />
                    <ValBox label="Resistenza" val={hRes?.Rm} unit="N/mm²" highlight />
                  </div>
                </div>
              </div>
            )}

            {/* VIEW: ADVISOR */}
            {view === "advisor" && (
              <div style={s.chatWrapper}>
                <div style={s.chatList}>
                  {chat.map((m, i) => (
                    <div key={i} style={m.role === "utente" ? s.uMsg : s.aMsg}>{m.text}</div>
                  ))}
                  {loading && <div style={{textAlign:'center', color:'#3b82f6'}}>Analisi tecnica in corso...</div>}
                </div>
                <div style={s.inputArea}>
                  <input style={s.input} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} placeholder="Chiedi consiglio sui materiali..." />
                  <button style={s.sendBtn} onClick={() => askAI()}>Invia</button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

// --- UI COMPONENTS & STYLES ---
const NavBtn = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} style={{ ...s.navBtn, backgroundColor: active ? "#3b82f6" : "transparent", color: active ? "white" : "#94a3b8" }}>
    <span style={{marginRight:'12px'}}>{icon}</span> {label}
  </button>
);

const ValBox = ({ label, val, unit, highlight }: any) => (
  <div style={{...s.valBox, backgroundColor: highlight ? '#f0f9ff' : '#f8fafc'}}>
    <div style={{fontSize:'11px', color:'#64748b'}}>{label}</div>
    <div style={{fontSize:'18px', fontWeight:800, color: highlight ? '#3b82f6' : '#1e293b'}}>{val || '--'} <small style={{fontSize:'10px'}}>{unit}</small></div>
  </div>
);

const s: any = {
  container: { display: 'flex', height: '100vh', backgroundColor: '#f1f5f9', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '40px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { border: 'none', padding: '12px 16px', borderRadius: '12px', textAlign: 'left', cursor: 'pointer', fontWeight: 600, transition: '0.3s' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '24px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' },
  textarea: { width: '100%', height: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '15px', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' },
  fileBtn: { padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  secBtn: { padding: '10px 20px', background: 'none', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer' },
  input: { flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' },
  select: { padding: '10px', borderRadius: '10px', border: '1px solid #e2e8f0' },
  resGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px', marginTop: '20px' },
  valBox: { padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' },
  chatWrapper: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' },
  chatList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px', paddingBottom: '20px' },
  uMsg: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '12px 18px', borderRadius: '18px 18px 0 18px' },
  aMsg: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '12px 18px', borderRadius: '0 18px 18px 18px' },
  inputArea: { display: 'flex', gap: '10px', padding: '15px', backgroundColor: 'white', borderRadius: '15px', border: '1px solid #e2e8f0' },
  sendBtn: { padding: '0 25px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }
};
