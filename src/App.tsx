import React, { useState, useRef, useEffect } from "react";

// Contesto tecnico per la memoria
const TECH_CONTEXT = "Dati: C45 (1.0503), 42CrMo4 (1.7225), AISI 304 (1.4301). Formule: Rm = HB * 3.35.";

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
            { role: "system", content: `Sei un Ingegnere Metallurgico. Tabelle: HTML con bordi. Matematica: <div class="math-frac"><span>N</span><span class="bottom">D</span></div>. Contesto: ${TECH_CONTEXT}.` },
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
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 AI Advisor</button>
          <button style={s.navBtn} onClick={() => {setChat([]); setView("advisor");}}>🔄 Nuova Chat</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>MEMORIA PDF ATTIVA ✅</div></header>

        <section style={{...s.content, justifyContent: isChatEmpty ? 'center' : 'flex-start'}}>
          {/* MESSAGGIO DI BENVENUTO DINAMICO */}
          {isChatEmpty && view === "advisor" && (
            <h1 style={s.welcomeText}>Benvenuto, come posso aiutarti oggi?</h1>
          )}

          {view === "advisor" && (
            <div style={{...s.chatWrapper, height: isChatEmpty ? 'auto' : '100%'}}>
              {!isChatEmpty && (
                <div style={s.msgList}>
                  {chat.map((m, i) => (
                    <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                      <div style={m.role === "utente" ? s.uBox : s.aBox} 
                           dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                    </div>
                  ))}
                  {loading && <div style={s.loader}>⚙️ Analisi in corso...</div>}
                  <div ref={chatEndRef} />
                </div>
              )}

              {/* BARRA DI RICERCA CHE SI SPOSTA */}
              <div style={isChatEmpty ? s.inputHome : s.inputChat}>
                <div style={s.inputWrapper}>
                  <textarea 
                    style={s.textarea} 
                    rows={1} 
                    value={query} 
                    placeholder="Chiedi un calcolo o un'equivalenza..."
                    onChange={e => { 
                      setQuery(e.target.value); 
                      e.target.style.height = 'auto'; 
                      e.target.style.height = e.target.scrollHeight + 'px'; 
                    }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={callAI}>Invia 🚀</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <style>{`
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #cbd5e1; }
        th { background: #0f172a; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 18px; margin: 0 5px; }
        .math-frac span { display: block; padding: 0 5px; }
        .math-frac span.bottom { border-top: 2px solid #0f172a; padding-top: 2px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white' },
  logo: { fontSize: '24px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1.5px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '10px' },
  navBtn: { padding: '12px', border: 'none', background: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  navBtnAct: { padding: '12px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none', textAlign: 'left', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', background: '#ecfdf5', padding: '5px 12px', borderRadius: '20px', fontWeight: 800 },
  content: { flex: 1, padding: '30px', display: 'flex', flexDirection: 'column' },
  welcomeText: { fontSize: '42px', fontWeight: 700, color: '#1e293b', textAlign: 'center', marginBottom: '40px', letterSpacing: '-1px' },
  chatWrapper: { display: 'flex', flexDirection: 'column', maxWidth: '850px', width: '100%', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '20px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#3b82f6', color: 'white', padding: '15px 20px', borderRadius: '20px 20px 0 20px', fontSize: '15px' },
  aBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '0 20px 20px 20px', fontSize: '15px' },
  inputHome: { width: '100%', maxWidth: '700px', margin: '0 auto' },
  inputChat: { padding: '20px 0', marginTop: 'auto' },
  inputWrapper: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '15px', 
    background: 'white', 
    padding: '12px 25px', 
    borderRadius: '35px', 
    border: '2px solid #e2e8f0',
    boxShadow: '0 10px 25px rgba(0,0,0,0.05)'
  },
  textarea: { flex: 1, border: 'none', outline: 'none', resize: 'none', fontSize: '16px', fontFamily: 'inherit', textAlign: 'center', padding: '10px 0' },
  sendBtn: { background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' },
  loader: { textAlign: 'center', color: '#3b82f6', fontWeight: 700, padding: '10px' }
};
