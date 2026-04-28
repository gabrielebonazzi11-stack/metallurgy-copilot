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
  
  // STATI PERSISTENTI (Inclusi dati Account)
  const [user, setUser] = useState({ name: "Mario Rossi", email: "mario.rossi@tech.it" });
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("techai_ultimate_v1");
    if (saved) {
      const p = JSON.parse(saved);
      setTheme(THEMES.find(t => t.name === p.themeName) || THEMES[0]);
      setInterest(p.interest || "Ingegneria Meccanica");
      setUser(p.user || { name: "Mario Rossi", email: "mario.rossi@tech.it" });
    }
  }, []);

  const saveAll = () => {
    localStorage.setItem("techai_ultimate_v1", JSON.stringify({ themeName: theme.name, interest, user }));
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
          messages: [{ role: "system", content: `Sei TechAI. Utente: ${user.name}. Focus: ${interest}.` }, { role: "user", content: text }],
        }),
      });
      const data = await res.json();
      setChat(prev => [...prev, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) { alert("Errore"); } finally { setLoading(false); }
  };

  return (
    <div key={theme.name} style={{...s.app, backgroundColor: theme.bg, color: theme.text}}>
      
      {/* SIDEBAR */}
      <aside style={{...s.sidebar, backgroundColor: theme.bg, borderRight: `1px solid ${theme.surface}`}}>
        <div style={s.logo}>TECH<span style={{color: theme.primary}}>AI</span></div>
        
        <nav style={s.nav}>
          <button style={{...s.navBtn, backgroundColor: theme.surface, color: theme.primary}}>🧠 Advisor</button>
          <button style={{...s.navBtn, color: theme.text}} onClick={() => setChat([])}>🔄 Nuova chat</button>
        </nav>

        {/* ACCOUNT INFO IN SIDEBAR */}
        <div style={s.sidebarAccount} onClick={() => {setActiveTab("Account"); setShowSettings(true);}}>
          <div style={{...s.avatar, backgroundColor: theme.primary}}>{user.name.charAt(0)}</div>
          <div style={s.accountText}>
            <div style={{fontWeight: 700, fontSize: '13px'}}>{user.name}</div>
            <div style={{fontSize: '11px', opacity: 0.7}}>Piano Pro</div>
          </div>
        </div>
        
        <div style={{...s.settingsBtn, color: theme.text}} onClick={() => {setActiveTab("Aspetto"); setShowSettings(true);}}>⚙️ Impostazioni</div>
      </aside>

      <main style={s.main}>
        <section style={{...s.content, justifyContent: chat.length === 0 ? 'center' : 'flex-start'}}>
          
          {chat.length === 0 ? (
            <div style={s.homeWrapper}>
              <h1 style={s.welcomeText}>Benvenuto {user.name.split(' ')[0]}, come posso aiutarti?</h1>
              <div style={{...s.searchBar, backgroundColor: theme.surface}}>
                <textarea 
                  style={{...s.textarea, color: theme.text}} rows={1} value={query} placeholder="Chiedi a TechAI..."
                  onChange={e => {setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px';}}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                />
                <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
              </div>
            </div>
          ) : (
            <div style={s.chatView}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? {...s.uBox, backgroundColor: theme.surface} : s.aBox} dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{color: theme.primary, textAlign:'center'}}>✨ TechAI sta elaborando...</div>}
                <div ref={chatEndRef} />
              </div>
              <div style={s.bottomInput}>
                <div style={{...s.searchBar, backgroundColor: theme.surface}}>
                  <textarea style={{...s.textarea, color: theme.text}} rows={1} value={query} onChange={e => setQuery(e.target.value)} placeholder="Scrivi qui..." />
                  <button style={{...s.sendBtn, color: theme.primary}} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* MODALE IMPOSTAZIONI MULTI-TAB */}
        {showSettings && (
          <div style={s.overlay}>
            <div style={s.modal}>
              <div style={s.modalSide}>
                {["Account", "Aspetto", "AI Focus"].map(t => (
                  <div key={t} onClick={()=>setActiveTab(t)} style={{...s.tab, color: activeTab===t?theme.primary:'', fontWeight: activeTab===t?800:400}}>{t}</div>
                ))}
              </div>
              <div style={s.modalMain}>
                <h2 style={{fontSize: '18px', marginBottom: '20px'}}>{activeTab}</h2>
                
                {activeTab === "Account" && (
                  <div style={s.form}>
                    <label style={s.label}>Nome Visualizzato</label>
                    <input style={s.input} value={user.name} onChange={e => setUser({...user, name: e.target.value})} />
                    <label style={s.label}>Email</label>
                    <input style={s.input} value={user.email} onChange={e => setUser({...user, email: e.target.value})} />
                    <div style={s.badge}>Stato Account: Abbonamento Attivo ✅</div>
                  </div>
                )}

                {activeTab === "Aspetto" && (
                  <div style={s.themeGrid}>
                    {THEMES.map(t => (
                      <div key={t.name} onClick={() => setTheme(t)} style={{...s.themeOption, background: theme.name === t.name ? theme.surface : 'transparent', border: theme.name === t.name ? `1px solid ${t.primary}` : '1px solid transparent'}}>
                        <div style={{width:12, height:12, borderRadius:'50%', background: t.primary}} /> {t.name}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === "AI Focus" && (
                  <div style={s.form}>
                    <label style={s.label}>Ambito Tecnico Principale</label>
                    <input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} />
                  </div>
                )}

                <button style={{...s.saveBtn, background: theme.primary}} onClick={saveAll}>Salva modifiche</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', sans-serif !important; box-sizing: border-box; transition: background 0.2s, color 0.2s; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' },
  sidebar: { width: '250px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px' },
  logo: { fontSize: '22px', fontWeight: 900, marginBottom: '30px', letterSpacing: '-1px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' },
  navBtn: { padding: '12px 15px', border: 'none', borderRadius: '12px', cursor: 'pointer', textAlign: 'left', fontSize: '14px', fontWeight: 600 },
  sidebarAccount: { display: 'flex', alignItems: 'center', gap: '10px', padding: '15px 10px', cursor: 'pointer', borderRadius: '12px', marginBottom: '5px', hover: {background: 'rgba(0,0,0,0.05)'} },
  avatar: { width: '32px', height: '32px', borderRadius: '50%', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '14px' },
  accountText: { display: 'flex', flexDirection: 'column' },
  settingsBtn: { padding: '15px 10px', cursor: 'pointer', borderTop: '1px solid rgba(0,0,0,0.05)', fontSize: '13px', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' },
  homeWrapper: { width: '100%', maxWidth: '650px', textAlign: 'center', marginTop: '-15vh' },
  welcomeText: { fontSize: '36px', fontWeight: 600, marginBottom: '40px', letterSpacing: '-1px' },
  searchBar: { display: 'flex', alignItems: 'center', borderRadius: '32px', padding: '8px 25px', width: '100%', minHeight: '60px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' },
  textarea: { flex: 1, background: 'none', border: 'none', outline: 'none', textAlign: 'center', fontSize: '17px', resize: 'none', padding: '10px 0' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '22px' },
  chatView: { width: '100%', maxWidth: '850px', flex: 1, display: 'flex', flexDirection: 'column', padding: '20px' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '25px', padding: '20px 0' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { padding: '14px 22px', borderRadius: '22px', maxWidth: '80%', fontSize: '15px' },
  aBox: { padding: '12px 0', lineHeight: '1.7', fontSize: '16px' },
  bottomInput: { padding: '20px 0' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: 'white', borderRadius: '28px', width: '600px', height: '450px', display: 'flex', overflow: 'hidden', color: '#1e293b', boxShadow: '0 30px 60px rgba(0,0,0,0.2)' },
  modalSide: { width: '180px', background: '#f8fafc', padding: '30px', borderRight: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '15px' },
  modalMain: { flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' },
  tab: { cursor: 'pointer', fontSize: '14px' },
  label: { fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', display: 'block' },
  input: { width: '100%', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', marginBottom: '20px', outline: 'none', fontSize: '14px' },
  badge: { fontSize: '12px', color: '#10b981', fontWeight: 700, background: '#f0fdf4', padding: '10px', borderRadius: '10px', textAlign: 'center' },
  themeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  themeOption: { padding: '12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px' },
  saveBtn: { marginTop: 'auto', padding: '15px', border: 'none', borderRadius: '15px', color: 'white', fontWeight: 700, cursor: 'pointer' }
};
