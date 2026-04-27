import React, { useState, useEffect, useRef } from "react";

// Dati estratti dai PDF per il sistema locale 
const MATERIAL_MAP = {
  "1.0503": { din: "C45", aisi: "1045", uni: "C45", tipo: "Acciaio al carbonio" },
  "1.7225": { din: "42CrMo4", aisi: "4140", uni: "42CrMo4", tipo: "Acciaio legato" },
  "1.3505": { din: "100Cr6", aisi: "52100", uni: "100Cr6", tipo: "Acciaio da cuscinetti" },
  "1.4301": { din: "X5CrNi18-10", aisi: "304", uni: "X5CrNi1810", tipo: "Inox Austenitico" },
  "0.6025": { din: "GG25", aisi: "No 35 B", uni: "G25", tipo: "Ghisa Grigia" },
  "0.7040": { din: "GGG 40", aisi: "60-40-18", uni: "GS 400-12", tipo: "Ghisa Sferoidale" }
};

export default function App() {
  const [view, setView] = useState("advisor");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bomList, setBomList] = useState("");
  const [hardness, setHardness] = useState({ hb: "", hrc: "" });
  
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat]);

  // Gestione caricamento File per BOM
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const content = ev.target?.result as string;
        setBomList(content); // Carica il contenuto nel box di testo
      };
      reader.readAsText(file);
    }
  };

  const askAI = async (customPrompt?: string) => {
    const input = customPrompt || query;
    if (!apiKey || !input.trim() || loading) return;

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
              content: `Sei un Technical Copilot per ingegneri meccanici. Usa questi dati PDF: ${JSON.stringify(MATERIAL_MAP)}. 
              Fornisci tabelle di conversione, consigli su saldatura (es. preriscaldo per legati) e trattamenti termici.` 
            },
            { role: "user", content: input }
          ],
          temperature: 0.1
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di connessione." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: '#F1F5F9', fontFamily: 'Inter, system-ui' }}>
      
      {/* SIDEBAR */}
      <nav style={{ width: '260px', backgroundColor: '#0F172A', color: 'white', padding: '24px', display: 'flex', flexDirection: 'column' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '40px', letterSpacing: '-0.5px' }}>
          TECH<span style={{ color: '#3B82F6' }}>COPILOT</span>
        </h1>
        
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <SidebarBtn active={view === 'advisor'} onClick={() => setView('advisor')} label="AI Advisor" icon="🧠" />
          <SidebarBtn active={view === 'bom'} onClick={() => setView('bom')} label="Conversione BOM" icon="📋" />
          <SidebarBtn active={view === 'calc'} onClick={() => setView('calc')} label="Calcolatori" icon="📐" />
        </div>

        <div style={{ fontSize: '10px', color: '#64748B', borderTop: '1px solid #1E293B', paddingTop: '20px' }}>
          DATABASE: PDF_CONFRONTO_MAT_V2 
        </div>
      </nav>

      {/* MAIN AREA */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        {/* TOP BAR / STATS */}
        <header style={{ padding: '16px 32px', backgroundColor: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: '30px' }}>
            <StatItem label="Database" value="Caricato (PDF)" color="#10B981" />
            <StatItem label="Materiali" value="150+" color="#3B82F6" />
          </div>
          <button onClick={() => setChat([])} style={{ color: '#EF4444', border: 'none', background: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }}>PULISCI SESSIONE</button>
        </header>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          
          {/* VISTA ADVISOR (CHAT) */}
          {view === 'advisor' && (
            <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', height: '100%' }}>
              <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', marginBottom: '20px' }}>
                {chat.length === 0 && <WelcomeView />}
                {chat.map((m, i) => <ChatMessage key={i} message={m} />)}
              </div>
              <div style={{ position: 'relative' }}>
                <input 
                  style={inputStyle} 
                  placeholder="Chiedi consiglio su materiali, trattamenti o saldabilità..." 
                  value={query} onChange={e => setQuery(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && askAI()}
                />
                <button onClick={() => askAI()} style={sendBtnStyle}>Invia ➜</button>
              </div>
            </div>
          )}

          {/* VISTA BOM (DISTINTA BASE) */}
          {view === 'bom' && (
            <div style={{ maxWidth: '900px', margin: '0 auto' }}>
              <div style={cardStyle}>
                <h3 style={{ marginBottom: '8px' }}>Batch Material Converter</h3>
                <p style={{ color: '#64748B', fontSize: '14px', marginBottom: '20px' }}>Incolla una lista di sigle (es. C45, 1.7225) o carica un file .txt/.csv per la conversione automatica.</p>
                
                <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <label style={uploadBtnStyle}>
                    📁 Carica File BOM
                    <input type="file" hidden onChange={handleFileUpload} accept=".txt,.csv" />
                  </label>
                  <button onClick={() => setBomList("")} style={{ padding: '10px 20px', borderRadius: '8px', border: '1px solid #E2E8F0', cursor: 'pointer' }}>Svuota</button>
                </div>

                <textarea 
                  style={{ ...inputStyle, height: '200px', fontFamily: 'monospace', fontSize: '13px' }} 
                  placeholder="Esempio:&#10;C45&#10;1.4301&#10;42CrMo4"
                  value={bomList}
                  onChange={e => setBomList(e.target.value)}
                />
                <button 
                  onClick={() => askAI(`Analizza questa lista di materiali e crea una tabella con W.-Nr, DIN, AISI e UNI: ${bomList}`)}
                  style={{ marginTop: '16px', padding: '12px 24px', backgroundColor: '#10B981', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                >
                  AVVIA CONVERSIONE MASSIVA
                </button>
              </div>
            </div>
          )}

          {/* VISTA CALCOLATORI */}
          {view === 'calc' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              <div style={cardStyle}>
                <h4>🔄 Convertitore Durezza</h4>
                <div style={{ marginTop: '20px' }}>
                  <label style={labelStyle}>Durezza Brinell (HB)</label>
                  <input type="number" style={inputStyle} placeholder="Es: 300" onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setHardness({ hb: e.target.value, hrc: val ? (val / 10).toFixed(1) : "" }); // Formula semplificata per esempio
                  }} />
                  <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    <small>Equivalente Stimato:</small>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#3B82F6' }}>{hardness.hrc || "--"} HRC</p>
                  </div>
                </div>
              </div>
              
              <div style={cardStyle}>
                <h4>⚖️ Calcolo Peso Teorico</h4>
                <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <input style={inputStyle} placeholder="Diametro (mm)" type="number" />
                  <input style={inputStyle} placeholder="Lunghezza (mm)" type="number" />
                  <div style={{ padding: '15px', backgroundColor: '#F8FAFC', borderRadius: '8px' }}>
                    <small>Peso Stimato (Acciaio):</small>
                    <p style={{ fontSize: '20px', fontWeight: 'bold', color: '#10B981' }}>-- kg</p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

// SOTTO-COMPONENTI E STILI
const SidebarBtn = ({ active, onClick, label, icon }: any) => (
  <button onClick={onClick} style={{
    display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '10px', border: 'none', cursor: 'pointer',
    backgroundColor: active ? '#3B82F6' : 'transparent', color: active ? 'white' : '#94A3B8', fontWeight: 600, textAlign: 'left', transition: '0.2s'
  }}>
    <span>{icon}</span> {label}
  </button>
);

const StatItem = ({ label, value, color }: any) => (
  <div>
    <p style={{ fontSize: '10px', color: '#64748B', fontWeight: 800, textTransform: 'uppercase', marginBottom: '2px' }}>{label}</p>
    <p style={{ fontSize: '14px', fontWeight: 700, color }}>{value}</p>
  </div>
);

const ChatMessage = ({ message }: any) => (
  <div style={{ display: 'flex', justifyContent: message.role === 'utente' ? 'flex-end' : 'flex-start', marginBottom: '16px' }}>
    <div style={{
      maxWidth: '85%', padding: '16px', borderRadius: '16px', fontSize: '14px', lineHeight: '1.5', boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
      backgroundColor: message.role === 'utente' ? '#3B82F6' : 'white',
      color: message.role === 'utente' ? 'white' : '#1E293B',
      border: message.role === 'AI' ? '1px solid #E2E8F0' : 'none'
    }}>
      <div style={{ fontSize: '10px', fontWeight: 900, marginBottom: '4px', opacity: 0.7 }}>{message.role === 'utente' ? 'DESIGNER' : 'AI ADVISOR'}</div>
      <div style={{ whiteSpace: 'pre-wrap' }}>{message.text}</div>
    </div>
  </div>
);

const WelcomeView = () => (
  <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748B' }}>
    <div style={{ fontSize: '40px', marginBottom: '20px' }}>🦾</div>
    <h2>Advisor Tecnico Metallurgico</h2>
    <p>Chiedi conversioni tra norme o consigli su come trattare un materiale specifico.</p>
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '14px 20px', borderRadius: '12px', border: '1px solid #E2E8F0', outline: 'none', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
};

const cardStyle: React.CSSProperties = {
  backgroundColor: 'white', padding: '24px', borderRadius: '16px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)'
};

const sendBtnStyle: React.CSSProperties = {
  position: 'absolute', right: '8px', top: '8px', bottom: '8px', padding: '0 20px', backgroundColor: '#0F172A', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold'
};

const uploadBtnStyle: React.CSSProperties = {
  backgroundColor: '#F1F5F9', padding: '10px 16px', borderRadius: '8px', border: '1px solid #E2E8F0', fontSize: '14px', fontWeight: 'bold', cursor: 'pointer'
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '6px', textTransform: 'uppercase'
};
