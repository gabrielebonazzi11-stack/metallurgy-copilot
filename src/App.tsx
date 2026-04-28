import React, { useState, useRef, useEffect } from "react";

interface Message { role: "utente" | "AI"; text: string; }

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  
  // STATI PER PERSONALIZZAZIONE
  const [showSettings, setShowSettings] = useState(false);
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [interest, setInterest] = useState("Ingegneria Meccanica e Metallurgia");
  const [personality, setPersonality] = useState("Professionale e Tecnico");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async () => {
    if (!query.trim() || loading) return;
    const text = query;
    setLoading(true);
    const newChat: Message[] = [...chat, { role: "utente", text }];
    setChat(newChat);
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
              content: `Sei TechAI. 
              AMBITO: ${interest}. 
              PERSONALITÀ: ${personality}.
              MATEMATICA: Usa <div class="math-frac"><span>N</span><span class="bottom">D</span></div> per le frazioni.
              TABELLE: HTML con bordi.` 
            },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) { alert("Errore API"); } finally { setLoading(false); }
  };

  const isChatEmpty = chat.length === 0;

  return (
    <div style={s.app}>
      {/* SIDEBAR */}
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color: accentColor}}>AI</span></div>
        <nav style={s.nav}>
          <button style={{...(view === "advisor" ? s.navBtnAct : s.navBtn), backgroundColor: view === "advisor" ? `${accentColor}20` : 'transparent', color: view === "advisor" ? accentColor : '#444746'}} onClick={() => setView("advisor")}>🧠 Advisor</button>
          <button style={s.navBtn} onClick={() => setChat([])}>🔄 Nuova chat</button>
        </nav>
        
        {/* ICONA IMPOSTAZIONI IN BASSO */}
        <div style={s.settingsTrigger} onClick={() => setShowSettings(!showSettings)}>
          ⚙️ Impostazioni
        </div>
      </aside>

      <main style={s.main}>
        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'space-between'}}>
          
          {isChatEmpty ? (
            <div style={s.homeCenter}>
              <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti oggi?</h1>
              <div style={s.searchBarWrapper}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} rows={1} value={query} 
                    placeholder="Chiedi a TechAI..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={s.chatContainer}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{...s.loader, color: accentColor}}>✨ TechAi sta analizzando...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.bottomInputWrapper}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} rows={1} value={query} 
                    placeholder="Scrivi qui..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* MODALE IMPOSTAZIONI */}
        {showSettings && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <h2 style={{marginBottom: '20px'}}>Personalizzazione</h2>
              <label style={s.label}>Colore Interfaccia</label>
              <input type="color" value={accentColor} onChange={(e) => setAccentColor(e.target.value)} style={s.colorPicker} />
              
              <label style={s.label}>Ambito di Interesse</label>
              <input style={s.input} value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="Es: Meccanica, Software..." />

              <label style={s.label}>Modo di fare dell'AI</label>
              <select style={s.input} value={personality} onChange={(e) => setPersonality(e.target.value)}>
                <option>Professionale e Tecnico</option>
                <option>Amichevole e Creativo</option>
                <option>Sintetico e Diretto</option>
              </select>

              <button style={{...s.primaryBtn, backgroundColor: accentColor}} onClick={() => setShowSettings(false)}>Salva e Chiudi</button>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        th { background: #f8fafc; color: #64748b; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 18px; margin: 0 4px; }
        .math-frac span { display: block; padding: 0 4px; }
        .math-frac span.bottom { border-top: 1.5px solid #1e293b; padding-top: 1px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#ffffff' },
  sidebar: { width: '240px', backgroundColor: '#f0f4f9', padding: '20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', position: 'relative' },
  logo: { fontSize: '22px', fontWeight: 800, marginBottom: '30px', letterSpacing: '-1px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 },
  navBtn: { padding: '10px 15px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', fontWeight: 500, borderRadius: '12px', fontSize: '14px' },
  navBtnAct: { padding: '10px 15px', borderRadius: '12px', border: 'none', textAlign: 'left', fontWeight: 600, fontSize: '14px' },
  settingsTrigger: { padding: '12px', cursor: 'pointer', fontSize: '14px', color: '#444746', fontWeight: 500, borderTop: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  homeCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
  welcomeText: { fontSize: '32px', fontWeight: 600, color: '#1e293b', marginBottom: '30px', textAlign: 'center' },
  searchBarWrapper: { width: '100%', maxWidth: '650px', padding: '0 20px' },
  bottomInputWrapper: { padding: '20px', width: '100%', maxWidth: '800px', margin: '0 auto' },
  searchBar: { display: 'flex', alignItems: 'center', background: '#f0f4f9', padding: '5px 20px', borderRadius: '28px', minHeight: '50px' },
  textarea: { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '16px', background: 'transparent', textAlign: 'center', padding: '12px 0' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' },
  chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' },
  msgList: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#f0f4f9', color: '#1e293b', padding: '12px 20px', borderRadius: '18px', maxWidth: '80%', fontSize: '15px' },
  aBox: { color: '#1e293b', padding: '12px 0', maxWidth: '100%', fontSize: '16px', lineHeight: '1.6' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { backgroundColor: 'white', padding: '30px', borderRadius: '20px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 40px rgba(0,0,0,0.2)' },
  label: { display: 'block', fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '8px', marginTop: '15px', textTransform: 'uppercase' },
  input: { width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none' },
  colorPicker: { width: '100%', height: '40px', border: 'none', cursor: 'pointer', background: 'none' },
  primaryBtn: { width: '100%', padding: '12px', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, marginTop: '20px', cursor: 'pointer' },
  loader: { textAlign: 'center', fontSize: '14px', padding: '10px', fontWeight: 600 }
};
