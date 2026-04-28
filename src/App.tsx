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
  
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");
  const [personality, setPersonality] = useState("Professionale");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("techai_config_v2");
    if (saved) {
      const p = JSON.parse(saved);
      const foundTheme = THEMES.find(t => t.name === p.themeName) || THEMES[0];
      setTheme(foundTheme);
      setInterest(p.interest);
      setPersonality(p.personality);
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem("techai_config_v2", JSON.stringify({
      themeName: theme.name, interest, personality
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
            { role: "system", content: `Sei TechAI. Ambito: ${interest}. Stile: ${personality}. Rispondi in modo cordiale ma tecnico. Usa HTML per tabelle e formule.` },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) { alert("Errore connessione"); } finally { setLoading(false); }
  };

  const isChatEmpty = chat.length === 0;

  return (
    <div style={{...s.app, backgroundColor: theme.bg}}>
      <aside style={{...s.sidebar, borderRight: `1px solid ${theme.surface}`}}>
        <div style={{...s.logo, color: theme.text}}>TECH<span style={{color: theme.primary}}>AI</span></div>
        <nav style={s.nav}>
          <button style={{...s.navBtn, backgroundColor: theme.surface, color: theme.primary, fontWeight: 700}}>🧠 Advisor</button>
          <button style={{...s.navBtn, color: theme.text}} onClick={() => setChat([])}>🔄 Nuova chat</button>
        </nav>
        <div style={{...s.settingsTrigger, borderTop: `1px solid ${theme.surface}`, color: theme.text}} onClick={() => setShowSettings(true)}>⚙️ Impostazioni</div>
      </aside>

      <main style={{...s.main, backgroundColor: theme.bg}}>
        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'flex-start'}}>
          
          {isChatEmpty ? (
            <div style={s.homeWrapper}>
              <h1 style={{...s.welcomeText, color: theme.text}}>Benvenuto, come posso aiutarti oggi?</h1>
              <div style={s.searchContainer}>
                <div style={{...s.searchBar, background: theme.surface}}>
                  <textarea 
                    style={{...s.textarea, color: theme.text}} rows={1} value={query} placeholder="Chiedi a TechAI..."
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
                    <div style={m.role === "utente" ? {...s.uBox, backgroundColor: theme.surface, color: theme.text} : {...s.aBox, color: theme.text}} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{...s.loader, color: theme.primary}}>✨ Analisi in corso...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.chatInputFix}>
                <div style={{...s.searchBar, background: theme.surface}}>
                  <textarea 
                    style={{...s.textarea, color: theme.text}} rows={1} value={query} placeholder="Scrivi qui..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {showSettings && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <div style={s.modalSidebar}>
                <div style={{...s.tab, fontWeight: activeTab === "Aspetto" ? 800 : 400, color: theme.primary}} onClick={()=>setActiveTab("Aspetto")}>Aspetto</div>
                <div style={{...s.tab, fontWeight: activeTab === "AI" ? 800 : 400, color: theme.primary}} onClick={()=>setActiveTab("AI")}>AI & Focus</div>
              </div>
              <div style={s.modalBody}>
                {activeTab === "Aspetto" ? (
                  <div style={s.themeList}>
                    <label style={s.label}>Seleziona Tema Immersivo</label>
                    {THEMES.map(t => (
                      <div key={t.name} onClick={() => setTheme(t)} style={{...s.themeRow, background: theme.name === t.name ? t.surface : 'transparent'}}>
                        <div style={{width: 14, height: 14, borderRadius: '50%', background: t.primary}} />
                        <span style={{color: t.text}}>{t.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={s.form}>
                    <label style={s.label}>Ambito Tecnico</label>
                    <input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} />
                  </div>
                )}
                <button style={{...s.saveBtn, backgroundColor: theme.primary}} onClick={saveSettings}>Salva ed Esci</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; transition: background 0.3s ease, color 0.3s ease; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', width: '100vw' },
  sidebar: { width: '240px', backgroundColor: 'rgba(255,255,255,0.3)', padding: '20px', display: 'flex', flexDirection: 'column' },
  logo: { fontSize: '20px', fontWeight: 900, marginBottom: '40px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 16px', border: 'none', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '14px' },
  settingsTrigger: { padding: '15px', cursor: 'pointer', fontSize: '14px' },
  main: { flex: 1, position: 'relative', display: 'flex', flexDirection: 'column' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  homeWrapper: { width: '100%', maxWidth: '700px', display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '-10vh' },
  welcomeText: { fontSize: '32px', fontWeight: 600, marginBottom: '30px' },
  searchContainer: { width: '100%', padding: '0 20px' },
  chatView: { width: '100%', maxWidth: '800px', flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', paddingBottom: '30px' },
  chatInputFix: { padding: '20px 0' },
  searchBar: { display: 'flex', alignItems: 'center', borderRadius: '30px', padding: '5px 25px', width: '100%', minHeight: '56px', boxShadow: '0 2px 15px rgba(0,0,0,0.03)' },
  textarea: { flex: 1, background: 'transparent', border: 'none', outline: 'none', textAlign: 'center', fontSize: '16px', padding: '12px 0', resize: 'none' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { padding: '14px 22px', borderRadius: '22px', maxWidth: '85%', boxShadow: '0 2px 10px rgba(0,0,0,0.02)' },
  aBox: { padding: '12px 0', fontSize: '16px', lineHeight: '1.7' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { backgroundColor: 'white', borderRadius: '28px', width: '550px', height: '400px', display: 'flex', overflow: 'hidden' },
  modalSidebar: { width: '170px', backgroundColor: '#f8fafc', padding: '30px', borderRight: '1px solid #e2e8f0' },
  modalBody: { flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' },
  tab: { cursor: 'pointer', fontSize: '14px', marginBottom: '20px' },
  label: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '15px' },
  themeRow: { padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '15px', fontSize: '14px', marginBottom: '8px' },
  input: { padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', outline: 'none' },
  saveBtn: { padding: '14px', borderRadius: '14px', color: 'white', border: 'none', fontWeight: 700, cursor: 'pointer', marginTop: 'auto' },
  loader: { textAlign: 'center', padding: '10px', fontWeight: 600 }
};
