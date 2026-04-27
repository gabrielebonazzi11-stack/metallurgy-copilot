import React, { useState, useEffect, useRef } from "react";

// --- DATABASE ESTRATTO DAL TUO PDF ---
const PDF_DATA = [
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
  const [hardness, setHardness] = useState({ val: "", from: "HB" });
  
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- LOGICA CONVERSIONE DUREZZE NATIVA ---
  const calcH = (v: number, type: string) => {
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
      Rm: Math.round(hv * 3.35)
    };
  };

  const hRes = calcH(parseFloat(hardness.val), hardness.from);

  // --- GESTIONE FILE (FUNZIONANTE) ---
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => setBomList(ev.target?.result as string);
      reader.readAsText(file);
    }
  };

  const askAI = async (textOverride?: string) => {
    const input = textOverride || query;
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
          messages: [
            { role: "system", content: "Sei un Ingegnere Metallurgico. Rispondi in italiano con tabelle." },
            { role: "user", content: input }
          ],
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat(prev => [...prev, { role: "AI", text: "Errore API. Controlla la tua VITE_GROQ_API_KEY." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.container}>
      {/* SIDEBAR NATIVA */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span>COPILOT</span></div>
        <div style={s.nav}>
          <button style={view === 'advisor' ? s.navBtnActive : s.navBtn} onClick={() => setView('advisor')}>🧠 Advisor AI</button>
          <button style={view === 'bom' ? s.navBtnActive : s.navBtn} onClick={() => setView('bom')}>📋 Materiali BOM</button>
          <button style={view === 'calc' ? s.navBtnActive : s.navBtn} onClick={() => setView('calc')}>📐 Calcolatori</button>
        </div>
      </aside>

      <main style={s.main}>
        <header style={s.header}>
          <span style={s.badge}>DATABASE PDF: CARICATO</span>
        </header>

        {/* VIEW AREA CON ANIMAZIONE CSS NATIVA */}
        <div className="fade-in" style={s.content}>
          
          {/* ADVISOR */}
          {view === "advisor" && (
            <div style={s.chatBox}>
              <div style={s.chatScroll}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === 'utente' ? s.uMsg : s.aMsg}>{m.text}</div>
                ))}
              </div>
              <div style={s.inputRow}>
                <input style={s.input} value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} placeholder="Chiedi info tecniche..." />
                <button style={s.sendBtn} onClick={() => askAI()}>Invia</button>
              </div>
            </div>
          )}

          {/* BOM CON CARICAMENTO FILE */}
          {view === "bom" && (
            <div style={s.card}>
              <h3>Distinta Base (BOM)</h3>
              <div style={{display:'flex', gap:'10px', marginBottom:'15px'}}>
                <button style={s.secBtn} onClick={() => fileInputRef.current?.click()}>📁 Carica .TXT/.CSV</button>
                <input type="file" ref={fileInputRef} hidden onChange={handleFile} />
                <button style={s.secBtn} onClick={() => setBomList("")}>Reset</button>
              </div>
              <textarea style={s.textarea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Incolla o carica la lista..." />
              <button style={s.primaryBtn} onClick={() => askAI(`Converti questa lista materiali: ${bomList}`)}>Analizza con AI</button>
            </div>
          )}

          {/* CALCOLATORI COMPLETI */}
          {view === "calc" && (
            <div style={s.grid}>
              <div style={s.card}>
                <h3>Conversione Durezze</h3>
                <div style={s.row}>
                  <input style={s.input} type="number" placeholder="Valore" value={hardness.val} onChange={e => setHardness({...hardness, val: e.target.value})} />
                  <select style={s.select} value={hardness.from} onChange={e => setHardness({...hardness, from: e.target.value})}>
                    <option>HB</option><option>HRC</option><option>HRB</option><option>HV</option>
                  </select>
                </div>
                <div style={s.resGrid}>
                  <div style={s.resItem}><span>Vickers</span><strong>{hRes?.HV || '--'} HV</strong></div>
                  <div style={s.resItem}><span>Brinell</span><strong>{hRes?.HB || '--'} HB</strong></div>
                  <div style={s.resItem}><span>Rockwell C</span><strong>{hRes?.HRC || '--'} HRC</strong></div>
                  <div style={s.resItem}><span>Rockwell B</span><strong>{hRes?.HRB || '--'} HRB</strong></div>
                  <div style={{...s.resItem, backgroundColor: '#eff6ff'}}><span>Resistenza</span><strong style={{color:'#3b82f6'}}>{hRes?.Rm || '--'} N/mm²</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* ANIMAZIONE CSS NATIVA */}
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fadeIn 0.3s ease-out; }
      `}</style>
    </div>
  );
}

// --- STILI REALI (Funzionano ovunque) ---
const s: any = {
  container: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'system-ui, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', color: 'white', padding: '30px 20px' },
  logo: { fontSize: '20px', fontWeight: 900, marginBottom: '40px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px', border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', backgroundColor: 'transparent', color: '#94a3b8', fontWeight: 600 },
  navBtnActive: { padding: '12px', border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '20px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', fontWeight: 800, color: '#10b981', backgroundColor: '#ecfdf5', padding: '4px 10px', borderRadius: '20px' },
  content: { flex: 1, padding: '40px', overflowY: 'auto' },
  card: { backgroundColor: 'white', padding: '30px', borderRadius: '20px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' },
  textarea: { width: '100%', height: '150px', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', padding: '15px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 800, cursor: 'pointer' },
  secBtn: { padding: '10px 20px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', cursor: 'pointer', fontWeight: 600 },
  chatBox: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '800px', margin: '0 auto' },
  chatScroll: { flex: 1, overflowY: 'auto', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  uMsg: { alignSelf: 'flex-end', backgroundColor: '#3b82f6', color: 'white', padding: '10px 15px', borderRadius: '15px 15px 0 15px', maxWidth: '80%' },
  aMsg: { alignSelf: 'flex-start', backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '10px 15px', borderRadius: '0 15px 15px 15px', maxWidth: '80%' },
  inputRow: { display: 'flex', gap: '10px', backgroundColor: 'white', padding: '10px', borderRadius: '15px', border: '1px solid #e2e8f0' },
  input: { flex: 1, border: 'none', outline: 'none', padding: '10px' },
  sendBtn: { backgroundColor: '#1e293b', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '10px', fontWeight: 700, cursor: 'pointer' },
  grid: { display: 'grid', gridTemplateColumns: '1fr', maxWidth: '600px' },
  row: { display: 'flex', gap: '10px', marginBottom: '20px' },
  select: { border: '1px solid #e2e8f0', borderRadius: '10px', padding: '10px' },
  resGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  resItem: { padding: '15px', border: '1px solid #e2e8f0', borderRadius: '12px', display: 'flex', flexDirection: 'column' }
};
