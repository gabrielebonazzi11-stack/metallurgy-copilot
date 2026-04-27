import React, { useState, useRef, useEffect } from "react";

// Database simulato dai tuoi PDF per la memoria dell'AI
const TECH_CONTEXT = "Dati estratti: C45 (1.0503), 42CrMo4 (1.7225), AISI 304 (1.4301). Formule: Rm = HB * 3.35.";

interface Message {
  role: "utente" | "AI";
  text: string;
}

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState("advisor");
  const [bomList, setBomList] = useState("");

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat]);

  const callAI = async (override?: string) => {
    const text = override || query;
    if (!text.trim() || loading) return;

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
              content: `Sei un Ingegnere Metallurgico. 
              TABELLE: Usa <table> HTML con bordi.
              MATEMATICA: Per le frazioni usa SEMPRE: <div class="math-frac"><span>Numeratore</span><span class="bottom">Denominatore</span></div>.
              Contesto: ${TECH_CONTEXT}. Sii tecnico ma amichevole.` 
            },
            { role: "user", content: text }
          ],
        }),
      });
      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      alert("Errore API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.app}>
      <aside style={s.sidebar}>
        <div style={s.logo}>TECH<span style={{color:'#3b82f6'}}>COPILOT</span></div>
        <nav style={s.nav}>
          <button style={view === "advisor" ? s.navBtnAct : s.navBtn} onClick={() => setView("advisor")}>🧠 AI Advisor</button>
          <button style={view === "bom" ? s.navBtnAct : s.navBtn} onClick={() => setView("bom")}>📋 Distinta BOM</button>
        </nav>
      </aside>

      <main style={s.main}>
        <header style={s.header}><div style={s.badge}>LIVE DATA: PDF & MEMORIA ON ✅</div></header>

        <section style={s.content}>
          {view === "advisor" && (
            <div style={s.chatContainer}>
              <div style={s.msgList}>
                {chat.map((m, i) => (
                  <div key={i} style={m.role === "utente" ? s.uRow : s.aRow}>
                    <div style={m.role === "utente" ? s.uBox : s.aBox} 
                         dangerouslySetInnerHTML={{ __html: m.text.replace(/\n/g, '<br/>') }} />
                  </div>
                ))}
                {loading && <div style={s.loader}>⚙️ Analisi metallurgica in corso...</div>}
                <div ref={chatEndRef} />
              </div>

              {/* BARRA DI RICERCA CENTRATA */}
              <div style={s.inputContainer}>
                <div style={s.inputWrapper}>
                  <textarea 
                    style={s.textarea} 
                    rows={1} 
                    value={query} 
                    placeholder="Scrivi qui per calcoli o analisi..."
                    onChange={e => { 
                        setQuery(e.target.value); 
                        e.target.style.height = 'auto'; 
                        e.target.style.height = e.target.scrollHeight + 'px'; 
                    }}
                    onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), callAI())}
                  />
                  <button style={s.sendBtn} onClick={() => callAI()}>Invia 🚀</button>
                </div>
              </div>
            </div>
          )}

          {view === "bom" && (
            <div style={s.card}>
              <h3>📋 Batch Analysis BOM</h3>
              <textarea style={s.bomArea} value={bomList} onChange={e => setBomList(e.target.value)} placeholder="Incolla lista..." />
              <button style={s.primaryBtn} onClick={() => callAI(`Analizza batch: ${bomList}`)}>Analizza Batch 🚀</button>
            </div>
          )}
        </section>
      </main>

      <style>{`
        table { width: 100%; border-collapse: collapse; margin: 15px 0; background: white; border: 1px solid #cbd5e1; }
        th { background: #0f172a; color: white; padding: 12px; text-align: left; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        tr:nth-child(even) { background-color: #f8fafc; }
        .math-frac { display: inline-block; vertical-align: middle; text-align: center; font-family: "Times New Roman", serif; font-size: 18px; margin: 0 5px; }
        .math-frac span { display: block; padding: 0 5px; }
        .math-frac span.bottom { border-top: 2px solid #0f172a; padding-top: 2px; }
      `}</style>
    </div>
  );
}

const s: any = {
  app: { display: 'flex', height: '100vh', backgroundColor: '#f8fafc', fontFamily: 'Inter, sans-serif' },
  sidebar: { width: '260px', backgroundColor: '#0f172a', padding: '30px 20px', color: 'white', display:'flex', flexDirection:'column' },
  logo: { fontSize: '24px', fontWeight: 900, marginBottom: '40px', letterSpacing: '-1.5px' },
  nav: { display: 'flex', flexDirection: 'column', gap: '10px' },
  navBtn: { padding: '12px', border: 'none', background: 'none', color: '#94a3b8', textAlign: 'left', cursor: 'pointer', fontWeight: 600 },
  navBtnAct: { padding: '12px', backgroundColor: '#3b82f6', color: 'white', borderRadius: '12px', border: 'none', textAlign: 'left', fontWeight: 600 },
  main: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  header: { padding: '15px 40px', backgroundColor: 'white', borderBottom: '1px solid #e2e8f0' },
  badge: { fontSize: '10px', color: '#10b981', background: '#ecfdf5', padding: '5px 12px', borderRadius: '20px', fontWeight: 800 },
  content: { flex: 1, padding: '30px', overflowY: 'auto' },
  chatContainer: { height: '100%', display: 'flex', flexDirection: 'column', maxWidth: '850px', margin: '0 auto' },
  msgList: { flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' },
  uRow: { display: 'flex', justifyContent: 'flex-end' },
  aRow: { display: 'flex', justifyContent: 'flex-start' },
  uBox: { backgroundColor: '#3b82f6', color: 'white', padding: '15px 20px', borderRadius: '20px 20px 0 20px', fontSize: '15px', boxShadow: '0 4px 12px rgba(59,130,246,0.15)' },
  aBox: { backgroundColor: 'white', border: '1px solid #e2e8f0', padding: '20px', borderRadius: '0 20px 20px 20px', fontSize: '15px', color:'#1e293b', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' },
  inputContainer: { padding: '20px 0' },
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
  textarea: { 
    flex: 1, 
    border: 'none', 
    outline: 'none', 
    resize: 'none', 
    fontSize: '16px', 
    fontFamily: 'inherit',
    textAlign: 'center', // Centra il testo orizzontalmente
    padding: '10px 0'
  },
  sendBtn: { background: '#0f172a', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '20px', fontWeight: 700, cursor: 'pointer' },
  card: { backgroundColor: 'white', padding: '40px', borderRadius: '24px', border: '1px solid #e2e8f0' },
  bomArea: { width: '100%', height: '150px', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '15px', fontSize: '16px', marginBottom: '15px', outline: 'none' },
  primaryBtn: { width: '100%', padding: '18px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '15px', fontWeight: 800, cursor: 'pointer' },
  loader: { textAlign: 'center', color: '#3b82f6', fontWeight: 700, padding: '10px' }
};
