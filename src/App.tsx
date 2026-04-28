import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f8fafc", surface: "#eff6ff", text: "#1e293b" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9", surface: "#e2e8f0", text: "#1e293b" },
  { name: "Forest Green", primary: "#15803d", bg: "#f0fdf4", surface: "#dcfce7", text: "#166534" },
  { name: "Deep Burgundy", primary: "#991b1b", bg: "#fef2f2", surface: "#fee2e2", text: "#7f1d1d" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9", surface: "#f5f5f4", text: "#44403c" },
];

interface Message { role: "utente" | "AI"; text: string; }

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  
  // Inizializza il tema dallo storage o usa il primo
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("techai_config_v3");
    if (saved) {
      const p = JSON.parse(saved);
      return THEMES.find(t => t.name === p.themeName) || THEMES[0];
    }
    return THEMES[0];
  });

  const [interest, setInterest] = useState("Ingegneria Meccanica");
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Funzione per cambiare tema real-time
  const handleThemeChange = (t: any) => {
    setTheme(t);
  };

  const saveSettings = () => {
    localStorage.setItem("techai_config_v3", JSON.stringify({
      themeName: theme.name,
      interest
    }));
    setShowSettings(false);
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async () => {
    if (!query.trim() || loading) return;
    const text = query;
    setLoading(true);
    setChat(prev => [...prev, { role: "utente", text }]);
    setQuery("");

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: `Sei TechAI esperto in ${interest}. Rispondi in modo professionale.` },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) { alert("Errore API"); } finally { setLoading(false); }
  };

  const isChatEmpty = chat.length === 0;

  return (
    <div key={theme.name} style={{...s.app, backgroundColor: theme.bg, color: theme.text}}>
      
      {/* SIDEBAR */}
      <aside style={{...s.sidebar, borderRight: `1px solid ${theme.surface}`, backgroundColor: theme.bg}}>
        <div style={s.logo}>TECH<span style={{color: theme.primary}}>AI</span></div>
        <nav style={s.nav}>
          <button style={{...s.navBtn, backgroundColor: theme.surface, color: theme.primary}}>🧠 Advisor</button>
          <button style={{...s.navBtn, color: theme.text}} onClick={() => setChat([])}>🔄 Nuova chat</button>
        </nav>
        <div style={{...s.settingsBtn, color: theme.text}} onClick={() => setShowSettings(true)}>⚙️ Impostazioni</div>
      </aside>

      {/* MAIN CONTENT */}
      <main style={{...s.main, backgroundColor: theme.bg}}>
        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'flex-start'}}>
          
          {isChatEmpty ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti?</h1>
              <div style={s.searchContainer}>
                <div style={{...s.searchBar, backgroundColor: theme.surface}}>
                  <textarea 
                    style={{...s.textarea, color: theme.text}} rows={1} value={query}
                    onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? {...s.uBox, backgroundColor: theme.surface} : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{color: theme.primary, textAlign:'center'}}>✨ Elaborazione...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.bottomInput}>
                <div style={{...s.searchBar, backgroundColor: theme.surface}}>
                  <textarea style={{...s.textarea, color: theme.text}} rows={1} value={query} onChange={e => setQuery(e.target.value)} />
                  <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* MODALE IMPOSTAZIONI */}
        {showSettings && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalSide}>
                <div onClick={()=>setActiveTab("Aspetto")} style={{...s.tab, color: activeTab==="Aspetto"?theme.primary:''}}>Aspetto</div>
                <div onClick={()=>setActiveTab("AI")} style={{...s.tab, color: activeTab==="AI"?theme.primary:''}}>AI Focus</div>
              </div>
              <div style={s.modalMain}>
                {activeTab === "Aspetto" ? (
                  <div>
                    <label style={s.label}>Seleziona Tema</label>
                    {THEMES.map(t => (
                      <div key={t.name} onClick={() => handleThemeChange(t)} style={{...s.themeOption, background: theme.name === t.name ? theme.surface : 'transparent'}}>
                        <div style={{width:12, height:12, borderRadius:'50%', background: t.primary}} /> {t.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div>
                    <label style={s.label}>Interesse</label>
                    <input style={s.input} value={interest} onChange={e=>setInterest(e.target.value)} />
                  </div>
                )}
                <button style={{...s.saveBtn, background: theme.primary}} onClick={saveSettings}>Salva ed Esci</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; transition: all 0.2s ease; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', width: '100vw' },
  sidebar: { width: '240px', padding: '20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '20px', fontWeight: 800, marginBottom: '30px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' },
  navBtn: { padding: '12px', border: 'none', borderRadius: '10px', textAlign: 'left', cursor: 'pointer' },
  settingsBtn: { padding: '10px', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.05)' },
  main: { flex: 1, display: 'flex', flexDirection: 'column' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  homeWrapper: { width: '100%', maxWidth: '600px', textAlign: 'center', marginTop: '-10%' },
  welcomeText: { fontSize: '28px', fontWeight: 700, marginBottom: '20px' },
  searchContainer: { width: '100%' },
  searchBar: { display: 'flex', alignItems: 'center', borderRadius: '30px', padding: '5px 20px', minHeight: '50px' },
  textarea: { flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'center', fontSize: '16px', resize: 'none' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' },
  chatView: { width: '100%', maxWidth: '800px', flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { padding: '12px 20px', borderRadius: '20px', maxWidth: '80%' },
  aBox: { padding: '12px 0', lineHeight: '1.6' },
  bottomInput: { padding: '20px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { background: 'white', borderRadius: '20px', width: '500px', height: '350px', display: 'flex', overflow: 'hidden', color: '#1e293b' },
  modalSide: { width: '150px', background: '#f8fafc', padding: '20px', borderRight: '1px solid #e2e8f0' },
  modalMain: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column' },
  tab: { cursor: 'pointer', marginBottom: '15px', fontSize: '14px' },
  label: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', display: 'block' },
  themeOption: { padding: '10px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' },
  input: { width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0' },
  saveBtn: { marginTop: 'auto', padding: '12px', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 700, cursor: 'pointer' }
};
