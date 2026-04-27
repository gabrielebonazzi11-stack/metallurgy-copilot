import React, { useState, useRef, useEffect } from "react";

const TECH_CONTEXT = "Conoscenza: C45 (1.0503), 42CrMo4 (1.7225), 304 (1.4301). Formule: Rm=HB*3.35, HV=HB/0.95.";

interface Message { role: "utente" | "AI"; text: string; }

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  
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
            { role: "system", content: `Sei TechAi. Cordiale, breve se salutato, tecnico se interrogato su materiali.
              MATEMATICA: Usa <div class="math-frac"><span>N</span><span class="bottom">D</span></div> per le frazioni.
              TABELLE: Usa <table> HTML.` },
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
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>AI</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 Advisor</button>
          <button style={s.navBtn} onClick={() => {setChat([]); setView("advisor");}}>🔄 Nuova chat</button>
        </nav>
      </aside>

      <main style={s.main}>
        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'space-between'}}>
          
          {/* CENTER CONTENT (HOME) */}
          {isChatEmpty ? (
            <div style={s.homeCenter}>
              <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti oggi?</h1>
              <div style={s.searchBarWrapper}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} 
                    rows={1} 
                    value={query} 
                    placeholder="Chiedi a TechAI..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={callAI}>🚀</button>
                </div>
              </div>
            </div>
          ) : (
            /* CHAT LAYOUT */
            <div style={s.chatContainer}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={s.loader}>✨ TechAi sta scrivendo...</div>}
                <div ref={chatEndRef} />
              </div>
              
              <div style={s.bottomInputWrapper}>
                <div style={s.searchBar}>
                  <textarea 
                    style={s.textarea} 
                    rows={1} 
                    value={query} 
                    placeholder="Chiedi a TechAI..."
                    onChange={e => { setQuery(e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={callAI}>🚀</button>
                </div>
                <p style={s.disclaimer}>TechAI può commettere errori. Verifica le informazioni importanti.</p>
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; }
        th { background: #f8fafc; color: #64748b; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #1e293b; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 18px; margin: 0 4px; }
        .math-frac span { display: block; padding: 0 4px; }
        .math-frac span.bottom { border-top: 1.5px solid #1e293b; padding-top: 1px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#ffffff', fontFamily: 'Inter, system-ui, sans-serif' },
  sidebar: { width: '240px', backgroundColor: '#f0f4f9', padding: '20px', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0' },
  logo: { fontSize: '20px', fontWeight: 700, marginBottom: '30px', color: '#1e293b', paddingLeft: '10px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '4px' },
  navBtn: { padding: '10px 15px', border: 'none', background: 'none', color: '#444746', textAlign: 'left', cursor: 'pointer', fontWeight: 500, borderRadius: '20px', fontSize: '14px' },
  navBtnAct: { padding: '10px 15px', backgroundColor: '#d3e3fd', color: '#041e49', borderRadius: '20px', border: 'none', textAlign: 'left', fontWeight: 600, fontSize: '14px' },
  main: { flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' },
  content: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  homeCenter: { display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' },
  welcomeText: { fontSize: '40px', fontWeight: 500, color: '#1e293b', marginBottom: '40px', textAlign: 'center' },
  chatContainer: { flex: 1, display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', margin: '0 auto', overflow: 'hidden' },
  msgList: { flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '24px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#f0f4f9', color: '#1e293b', padding: '12px 20px', borderRadius: '18px', maxWidth: '80%', fontSize: '15px' },
  aBox: { backgroundColor: 'transparent', color: '#1e293b', padding: '12px 0', maxWidth: '100%', fontSize: '16px', lineHeight: '1.6' },
  
  // BARRA STILE GEMINI
  searchBarWrapper: { width: '100%', maxWidth: '720px', padding: '0 20px' },
  bottomInputWrapper: { padding: '20px', width: '100%', maxWidth: '800px', margin: '0 auto' },
  searchBar: { 
    display: 'flex', 
    alignItems: 'center', 
    background: '#f0f4f9', 
    padding: '8px 20px', 
    borderRadius: '28px', 
    transition: 'background 0.2s ease',
    minHeight: '52px'
  },
  textarea: { 
    flex: 1, 
    border: 'none', 
    outline: 'none', 
    resize: 'none', 
    fontSize: '16px', 
    background: 'transparent',
    color: '#1e293b',
    textAlign: 'center', 
    padding: '10px 0',
    maxHeight: '200px'
  },
  sendBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', padding: '5px' },
  disclaimer: { fontSize: '11px', color: '#70757a', textAlign: 'center', marginTop: '10px' },
  loader: { color: '#3b82f6', fontSize: '14px', padding: '10px 0', fontWeight: 500 }
};
