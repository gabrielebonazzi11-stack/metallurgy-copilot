import React, { useState, useRef, useEffect } from "react";

const THEMES = [
  { name: "Industrial Blue", primary: "#3b82f6", bg: "#f0f7ff" },
  { name: "Slate Grey", primary: "#475569", bg: "#f8fafc" },
  { name: "Forest Green", primary: "#15803d", bg: "#f0fdf4" },
  { name: "Deep Burgundy", primary: "#991b1b", bg: "#fef2f2" },
  { name: "Sandstone", primary: "#a8a29e", bg: "#fafaf9" },
];

interface Message { role: "utente" | "AI"; text: string; }

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("Aspetto");
  
  // STATI PERSISTENTI
  const [showSettings, setShowSettings] = useState(false);
  const [theme, setTheme] = useState(THEMES[0]);
  const [interest, setInterest] = useState("Ingegneria Meccanica");
  const [personality, setPersonality] = useState("Professionale");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Carica impostazioni al boot
  useEffect(() => {
    const saved = localStorage.getItem("techai_prefs");
    if (saved) {
      const parsed = JSON.parse(saved);
      setTheme(parsed.theme);
      setInterest(parsed.interest);
      setPersonality(parsed.personality);
    }
  }, []);

  // Salva ogni volta che cambiano
  const savePrefs = () => {
    localStorage.setItem("techai_prefs", JSON.stringify({ theme, interest, personality }));
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
            { 
              role: "system", 
              content: `Sei TechAI. Ambito: ${interest}. Stile: ${personality}. 
              Se salutato o vago, rispondi cordiale e breve. Se specifico, sii tecnico.
              Matematica: <div class="math-frac"><span>N</span><span class="bottom">D</span></div>. Tabelle: HTML.` 
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
          {isChatEmpty && <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti?</h1>}
          
          <div style={s.chatWrapper}>
            {!isChatEmpty && (
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? {...s.uBox, backgroundColor: theme.bg} : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={{...s.loader, color: theme.primary}}>✨ Elaborazione...</div>}
                <div ref={chatEndRef} />
              </div>
            )}

            <div style={isChatEmpty ? s.inputHome : s.inputChat}>
              <div style={s.searchBar}>
                <textarea 
                  style={s.textarea} rows={1} value={query} placeholder="Chiedi a TechAI..."
                  onChange={e => { setQuery(e.target.value); e.target.style.height='auto'; e.target.style.height=e.target.scrollHeight+'px'; }}
                  onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                />
                <button style={s.sendBtn} onClick={callAI}>🚀</button>
              </div>
            </div>
          </div>
        </section>

        {/* MODALE IMPOSTAZIONI COMPLETO */}
        {showSettings && (
          <div style={s.modalOverlay}>
            <div style={s.modal}>
              <div style={s.modalSidebar}>
                {["Aspetto", "Personalità", "Account"].map(tab => (
                  <div key={tab} style={{...s.tabBtn, color: activeTab === tab ? theme.primary : '#64748b', fontWeight: activeTab === tab ? 700 : 400}} onClick={() => setActiveTab(tab)}>{tab}</div>
                ))}
              </div>
              <div style={s.modalContent}>
                {activeTab === "Aspetto" && (
                  <>
                    <label style={s.label}>Seleziona Tema Sobrio</label>
                    <div style={s.themeGrid}>
                      {THEMES.map(t => (
                        <div key={t.name} onClick={() => setTheme(t)} style={{...s.themeOption, border: theme.name === t.name ? `2px solid ${t.primary}` : '2px solid transparent'}}>
                          <div style={{background: t.primary, width: '20px', height: '20px', borderRadius: '50%'}}></div>
                          {t.name}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {activeTab === "Personalità" && (
                  <>
                    <label style={s.label}>Ambito Tecnico</label>
                    <input style={s.input} value={interest} onChange={e => setInterest(e.target.value)} />
                    <label style={s.label}>Modo di fare</label>
                    <select style={s.input} value={personality} onChange={e => setPersonality(e.target.value)}>
                      <option>Professionale</option><option>Sintetico</option><option>Creativo</option>
                    </select>
                  </>
                )}
                <button style={{...s.primaryBtn, backgroundColor: theme.primary}} onClick={savePrefs}>Applica e Salva</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap');
        * { font-family: 'Inter', -apple-system, sans-serif !important; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 18px; margin: 0 4px; }
        .math-frac span { display: block; border-top: 1.5px solid #1e293b; padding-top: 1px; }
        .math-frac span:first-child { border: none; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        th { background: #f8fafc; padding: 10px; font-size: 12px; color: #64748b; text-align: left; }
        td { padding: 10px; border-top: 1px solid #f1f5f9; font-size: 14px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#ffffff' },
  sidebar: { width: '240px', backgroundColor: '#f9fafb', padding: '20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb' },
  logo: { fontSize: '20px', fontWeight: 800, marginBottom: '30px' },
  nav: { flex: 1, display: 'flex', flexDirection: 'column', gap: '5px' },
  navBtn: { padding: '10px 15px', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', borderRadius: '12px', fontSize: '14px' },
  settingsTrigger: { padding: '15px', borderTop: '1px solid #e5e7eb', cursor: 'pointer', fontSize: '14px', color: '#6b7280' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  welcomeText: { fontSize: '32px', fontWeight: 600, textAlign: 'center', marginBottom: '40px', color: '#111827' },
  chatWrapper: { maxWidth: '800px', width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', flex: 1 },
  msgList: { flex: 1, padding: '20px', display: 'flex', flexDirection: 'column', gap: '25px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { padding: '12px 18px', borderRadius: '18px', maxWidth: '80%', fontSize: '15px', color: '#1e293b' },
  aBox: { padding: '12px 0', fontSize: '16px', lineHeight: '1.6', color: '#111827' },
  inputHome: { width: '100%', padding: '0 20px' },
  inputChat: { padding: '20px', marginTop: 'auto' },
  searchBar: { display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '28px', padding: '5px 20px', minHeight: '54px' },
  textarea: { flex: 1, border: 'none', background: 'transparent', outline: 'none', textAlign: 'center', fontSize: '16px', padding: '12px 0', resize: 'none' },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px' },
  modalOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 },
  modal: { backgroundColor: 'white', borderRadius: '24px', width: '600px', height: '400px', display: 'flex', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.1)' },
  modalSidebar: { width: '180px', backgroundColor: '#f9fafb', padding: '20px', borderRight: '1px solid #e5e7eb' },
  modalContent: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column' },
  tabBtn: { padding: '10px 0', cursor: 'pointer', fontSize: '14px' },
  label: { fontSize: '11px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', marginBottom: '10px' },
  themeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' },
  themeOption: { padding: '10px', borderRadius: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', backgroundColor: '#f9fafb' },
  input: { padding: '10px', borderRadius: '8px', border: '1px solid #e5e7eb', marginBottom: '15px', fontSize: '14px' },
  primaryBtn: { padding: '12px', border: 'none', borderRadius: '10px', color: 'white', fontWeight: 600, cursor: 'pointer', marginTop: 'auto' },
  loader: { textAlign: 'center', padding: '10px', fontWeight: 600, fontSize: '14px' }
};
