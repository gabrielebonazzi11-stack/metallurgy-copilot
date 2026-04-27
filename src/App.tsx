import React, { useState, useEffect, useRef } from "react";

// DATABASE ESTRATTO DAI TUOI PDF
const PDF_KNOWLEDGE = `
Tabelle Caricate:
- Acciai Carbonio: C15(1.0401), C45(1.0503), C60(1.0601)[cite: 6].
- Acciai Legati: 42CrMo4(1.7225), 100Cr6(1.3505), 16MnCr5(1.7131)[cite: 8, 9].
- Inox: 304(1.4301), 316(1.4401), 410(1.4006), 430(1.4016)[cite: 15, 17].
- Ghise: GG25(0.6025), GGG40(0.7040), GGG50(0.7050)[cite: 24, 26].
`;

export default function App() {
  const [view, setView] = useState("chat"); // 'chat', 'batch', 'calc'
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Stati per Calcolatore
  const [hardness, setHardness] = useState({ value: "", type: "HB" });
  const [weight, setWeight] = useState({ dim: "", density: 7.85 });

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const askAI = async (customPrompt?: string) => {
    const input = customPrompt || query;
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
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `Sei un Ingegnere Metallurgico. 
              Dati di riferimento: ${PDF_KNOWLEDGE}.
              Compiti: 1. Converti sigle (UNI, AISI, DIN). 2. Valuta saldabilità. 3. Suggerisci trattamenti termici.` 
            },
            { role: "user", content: input }
          ],
          temperature: 0.2
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di sistema." }]);
    } finally {
      setLoading(false);
    }
  };

  const styles: any = {
    app: { display: 'flex', height: '100vh', backgroundColor: '#f4f7f9', fontFamily: 'Segoe UI, sans-serif' },
    sidebar: { width: '280px', backgroundColor: '#1a202c', color: 'white', padding: '20px', display: 'flex', flexDirection: 'column' },
    navBtn: (active: boolean) => ({
      width: '100%', padding: '12px', marginBottom: '10px', borderRadius: '8px', border: 'none',
      backgroundColor: active ? '#3182ce' : 'transparent', color: 'white', textAlign: 'left', cursor: 'pointer', fontWeight: 'bold'
    }),
    content: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
    card: { backgroundColor: 'white', borderRadius: '12px', padding: '20px', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', margin: '20px' },
    input: { width: '100%', padding: '15px', borderRadius: '10px', border: '1px solid #e2e8f0', outline: 'none' }
  };

  return (
    <div style={styles.app}>
      {/* SIDEBAR PROFESSIONALE */}
      <div style={styles.sidebar}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '30px' }}>Copilot <span style={{ color: '#63b3ed' }}>ENG</span></h2>
        <button style={styles.navBtn(view === 'chat')} onClick={() => setView('chat')}>💬 Advisor AI</button>
        <button style={styles.navBtn(view === 'batch')} onClick={() => setView('batch')}>📊 Analisi BOM (Batch)</button>
        <button style={styles.navBtn(view === 'calc')} onClick={() => setView('calc')}>🧮 Calcolatori Tecnici</button>
        <div style={{ marginTop: 'auto', fontSize: '0.8rem', color: '#a0aec0' }}>Database: PDF Materiali v1.2</div>
      </div>

      <div style={styles.content}>
        {/* HEADER STATS */}
        <div style={{ display: 'flex', gap: '20px', padding: '20px' }}>
          {['Acciai', 'Ghise', 'Inox'].map(t => (
            <div key={t} style={{ flex: 1, padding: '15px', backgroundColor: 'white', borderRadius: '10px', borderLeft: '4px solid #3182ce' }}>
              <small style={{ color: '#718096' }}>{t.toUpperCase()}</small>
              <div style={{ fontWeight: 'bold' }}>Database Attivo</div>
            </div>
          ))}
        </div>

        {/* VIEW CHAT / ADVISOR */}
        {view === 'chat' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px' }}>
              {chat.map((m, i) => (
                <div key={i} style={{ marginBottom: '20px', textAlign: m.role === 'utente' ? 'right' : 'left' }}>
                  <div style={{ 
                    display: 'inline-block', padding: '15px', borderRadius: '12px', maxWidth: '80%',
                    backgroundColor: m.role === 'utente' ? '#3182ce' : 'white',
                    color: m.role === 'utente' ? 'white' : '#2d3748',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                  }}>
                    <pre style={{ whiteSpace: 'pre-wrap', fontSans: 'inherit', margin: 0 }}>{m.text}</pre>
                  </div>
                </div>
              ))}
              {loading && <p style={{ color: '#3182ce' }}>Analisi metallurgica in corso...</p>}
            </div>
            <div style={{ padding: '20px', backgroundColor: 'white' }}>
              <div style={{ display: 'flex', gap: '10px' }}>
                <input style={styles.input} placeholder="Es: Devo saldare C45 con 42CrMo4, consigli?" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI()} />
                <button style={{ padding: '0 25px', backgroundColor: '#2d3748', color: 'white', borderRadius: '10px', border: 'none', cursor: 'pointer' }} onClick={() => askAI()}>Invia</button>
              </div>
            </div>
          </div>
        )}

        {/* VIEW BATCH / BOM */}
        {view === 'batch' && (
          <div style={styles.card}>
            <h3>Analisi Massiva Distinta Base (BOM)</h3>
            <p style={{ color: '#718096', fontSize: '0.9rem' }}>Incolla una lista di materiali per convertirli tutti secondo normativa EN/AISI.</p>
            <textarea style={{ ...styles.input, height: '200px', marginTop: '10px' }} placeholder="C45&#10;39NiCrMo3&#10;100Cr6..." />
            <button style={{ marginTop: '15px', padding: '10px 20px', backgroundColor: '#38a169', color: 'white', border: 'none', borderRadius: '6px' }} onClick={() => askAI("Analizza questa lista di materiali e convertili in tabella: C45, 100Cr6, 42CrMo4")}>Analizza Lista</button>
          </div>
        )}

        {/* VIEW CALC */}
        {view === 'calc' && (
          <div style={{ display: 'flex', flexWrap: 'wrap' }}>
            <div style={{ ...styles.card, flex: '1 1 300px' }}>
              <h4>Convertitore Durezza</h4>
              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input style={styles.input} placeholder="Valore" type="number" />
                <select style={{ padding: '10px', borderRadius: '8px' }}><option>HB</option><option>HRC</option><option>HV</option></select>
              </div>
              <button style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px' }}>Calcola Equivalenza</button>
            </div>
            <div style={{ ...styles.card, flex: '1 1 300px' }}>
              <h4>Calcolo Peso Teorico</h4>
              <input style={{ ...styles.input, marginTop: '10px' }} placeholder="Diametro (mm)" />
              <input style={{ ...styles.input, marginTop: '10px' }} placeholder="Lunghezza (mm)" />
              <button style={{ marginTop: '10px', width: '100%', padding: '10px', backgroundColor: '#3182ce', color: 'white', border: 'none', borderRadius: '6px' }}>Calcola Peso (kg)</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
