import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#eff6ff" },
  { name: "Slate Grey", primary: "#475569", bg: "#f1f5f9" },
  { name: "Forest Green", primary: "#15803d", bg: "#f0fdf4" },
  { name: "Deep Burgundy", primary: "#991b1b", bg: "#fef2f2" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9" },
];

interface Message { role: "utente" | "AI"; text: string; }

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  
  // STATI PERSONALIZZAZIONE
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");
  const [personality, setPersonality] = useState("Professionale");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Caricamento iniziale
  useEffect(() => {
    const saved = localStorage.getItem("techai_config");
    if (saved) {
      const p = JSON.parse(saved);
      const foundTheme = THEMES.find(t => t.name === p.themeName) || THEMES[0];
      setTheme(foundTheme);
      setInterest(p.interest);
      setPersonality(p.personality);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem("techai_config", JSON.stringify({
      themeName: theme.name,
      interest,
      personality
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
            { role: "system", content: `Sei TechAI. Ambito: ${interest}. Personalità: ${personality}. Rispondi a tono. Per formule usa <div class="math-frac"><span>N</span><span class="bottom">D</span></div>.` },
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
    <div style={{...s.app, backgroundColor: '#ffffff'}}>
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color: theme.primary}}>AI</span></div>
        <nav style={s.nav}>
          <button style={{...s.navBtn, backgroundColor: theme.bg, color: theme.primary, fontWeight: 700}}>🧠 Advisor</button>
          <button style={s.navBtn} onClick={() => setChat([])}>🔄 Nuova chat</button>
        </nav>
        <div style={s.settingsTrigger} onClick={() => setShowSettings(true)}>⚙️ Impostazioni</div>
      </aside>

      <main style={s.main}>
        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'flex-start'}}>
          
          {isChatEmpty ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti oggi?</h1>
              <div style={s.searchContainer}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} rows={1} value={query} placeholder="Chiedi a TechAI..."
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
                    <div style={m.role === "utente" ? {...s.uBox, backgroundColor: theme.bg} : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{...s.loader, color: theme.primary}}>✨ Analisi in corso...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.chatInputFix}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} rows={1} value={query} placeholder="Scrivi qui..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* MODALE IMPOSTAZIONI SNELLO */}
        {showSettings && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <div style={s.modalSidebar}>
                <div style={{...s.tab, fontWeight: activeTab === "Aspetto" ? 800 : 400, color: activeTab === "Aspetto" ? theme.primary : '#64748b'}} onClick={()=>setActiveTab("Aspetto")}>Aspetto</div>
                <div style={{...s.tab, fontWeight: activeTab === "AI" ? 800 : 400, color: activeTab === "AI" ? theme.primary : '#64748b'}} onClick={()=>setActiveTab("AI")}>AI & Focus</div>
              </div>
              <div style={s.modalBody}>
                {activeTab === "Aspetto" ? (
                  <div style={s.themeList}>
                    <label style={s.label}>Seleziona Tema</label>
                    {THEMES.map(t => (
                      <div key={t.name} onClick={() => setTheme(t)} style={{...s.themeRow, background: theme.name === t.name ? t.bg : 'transparent'}}>
                        <div style={{width: 12, height: 12, borderRadius: '50%', background: t.primary}} />
                        {t.name}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={s.form}>
                    <label style={s.label}>Ambito di interesse</label>
                    <input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} />
                    <label style={s.label}>Personalità</label>
                    <select style={s.input} value={personality} onChange={e => setPersonality(e.target.value)}>
                      <option>Professionale</option><option>Sintetico</option><option>Creativo</option>
                    </select>
                  </div>
                )}
                <button style={{...s.saveBtn, backgroundColor: theme.primary}} onClick={saveSettings}>Salva Modifiche</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; margin: 0 4px; }
        .math-frac span { display: block; border-top: 1.5px solid #000; }
        .math-frac span:first-child { border: none; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', width: '100vw' },
  sidebar: { width: '240px', backgroundColor: '#f8fafc', borderRight: '1px solid #e2e8f0', padding: '20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '20px', fontWeight: 900, marginBottom: '40px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 16px', border: 'none', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  settingsTrigger: { padding: '15px', borderTop: '1px solid #e2e8f0', cursor: 'pointer', color: '#64748b', fontSize: '14px' },
  main: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  
  // BARRA AL CENTRO (HOME)
  homeWrapper: { width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-10vh' },
  welcomeText: { fontSize: '32px', fontWeight: 600, color: '#1e293b', marginBottom: '30px' },
  searchContainer: { width: '100%', padding: '0 20px' },
  
  // BARRA IN BASSO (CHAT)
  chatView: { width: '100%', maxWidth: '800px', flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '30px' },
  chatInputFix: { padding: '20px 0' },
  
  // COMPONENTE BARRA UNIFICATO
  searchBar: { display: 'flex', alignItems: 'center', background: '#f1f5f9', borderRadius: '30px', padding: '5px 25px', width: '100%', minHeight: '56px' },
  textarea: { flex: 1, background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontSize: '16px', padding: '12px 0', resize: 'none' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' },
  
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { padding: '12px 20px', borderRadius: '20px', maxWidth: '80%', color: '#1e293b' },
  aBox: { padding: '12px 0', fontSize: '16px', lineHeight: '1.7', color: '#1e293b' },

  // MODALE
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.2)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { backgroundColor: 'white', borderRadius: '24px', width: '550px', height: '380px', display: 'flex', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' },
  modalSidebar: { width: '160px', backgroundColor: '#f8fafc', padding: '25px', borderRight: '1px solid #e2e8f0' },
  modalBody: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column' },
  tab: { cursor: 'pointer', fontSize: '14px', marginBottom: '15px' },
  label: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px' },
  themeRow: { padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', marginBottom: '5px' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px', outline: 'none' },
  saveBtn: { padding: '12px', borderRadius: '12px', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  loader: { textAlign: 'center', padding: '10px', fontWeight: 600 }
};
