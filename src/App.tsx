import React, { useState, useEffect, useRef } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  // Auto-scroll alla fine della chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chat]);

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) return;

    const newChat = [...chat, { role: "utente", text: query }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { role: "system", content: "Sei un ingegnere metallurgico esperto. Fornisci dati precisi su acciai, trattamenti termici e normative. Usa un tono professionale." },
            { role: "user", content: query }
          ],
          temperature: 0.3
        }),
      });

      const data = await res.json();
      const aiResponse = data.choices[0].message.content;
      setChat([...newChat, { role: "AI", text: aiResponse }]);
    } catch (e: any) {
      setChat([...newChat, { role: "AI", text: "⚠️ Errore di connessione." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", height: "100vh", backgroundColor: "#f0f2f5", fontFamily: "'Inter', sans-serif" }}>
      
      {/* SIDEBAR */}
      <div style={{ width: "260px", backgroundColor: "#1e293b", color: "white", padding: "20px", display: "flex", flexDirection: "column" }}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "30px", display: "flex", alignItems: "center", gap: "10px" }}>
           🦾 METALLURGY
        </h2>
        <div style={{ flex: 1 }}>
          <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginBottom: "10px" }}>RECENTI</p>
          {/* Qui andranno i titoli delle chat salvate */}
          <div style={{ padding: "10px", borderRadius: "8px", backgroundColor: "#334155", cursor: "pointer", fontSize: "0.9rem" }}>
            Analisi Acciaio C45
          </div>
        </div>
        <div style={{ fontSize: "0.75rem", color: "#64748b" }}>v1.0 Pro - Stable</div>
      </div>

      {/* MAIN CHAT AREA */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
        
        {/* HEADER */}
        <header style={{ padding: "15px 30px", backgroundColor: "white", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 600, color: "#475569" }}>Copilot Tecnico</span>
          <button onClick={() => setChat([])} style={{ fontSize: "0.8rem", color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}>Pulisci Chat</button>
        </header>

        {/* MESSAGES */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "40px 10% 100px 10%" }}>
          {chat.length === 0 && (
            <div style={{ textAlign: "center", marginTop: "100px" }}>
              <h1 style={{ color: "#1e293b", marginBottom: "10px" }}>Benvenuto nel Laboratorio AI</h1>
              <p style={{ color: "#64748b" }}>Inserisci una sigla, una normativa o un problema termico per iniziare.</p>
            </div>
          )}
          {chat.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "utente" ? "flex-end" : "flex-start", marginBottom: "25px" }}>
              <div style={{ 
                maxWidth: "75%", 
                padding: "16px 20px", 
                borderRadius: "18px",
                lineHeight: "1.5",
                fontSize: "0.95rem",
                boxShadow: "0 2px 5px rgba(0,0,0,0.05)",
                backgroundColor: m.role === "utente" ? "#2563eb" : "white",
                color: m.role === "utente" ? "white" : "#1e293b",
                border: m.role === "AI" ? "1px solid #e2e8f0" : "none"
              }}>
                <div style={{ fontSize: "0.7rem", marginBottom: "5px", opacity: 0.8, fontWeight: "bold", textTransform: "uppercase" }}>
                  {m.role === "AI" ? "Intelligence Report" : "Richiesta Utente"}
                </div>
                <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            </div>
          ))}
          {loading && <div style={{ color: "#2563eb", fontSize: "0.9rem", fontWeight: 600 }}>● ● ● Elaborazione dati...</div>}
        </div>

        {/* INPUT AREA */}
        <div style={{ position: "absolute", bottom: 0, width: "100%", padding: "20px 10%", background: "linear-gradient(to top, #f0f2f5 70%, transparent)" }}>
          <div style={{ display: "flex", backgroundColor: "white", borderRadius: "12px", padding: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", border: "1px solid #e2e8f0" }}>
            <input 
              style={{ flex: 1, border: "none", outline: "none", padding: "12px", fontSize: "1rem" }}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askAI()}
              placeholder="Chiedi info su materiali, trattamenti o durezze..."
            />
            <button 
              onClick={askAI}
              style={{ backgroundColor: "#2563eb", color: "white", border: "none", borderRadius: "8px", padding: "0 20px", cursor: "pointer", fontWeight: "bold" }}
            >
              Invia
            </button>
          </div>
          <p style={{ textAlign: "center", fontSize: "0.7rem", color: "#94a3b8", marginTop: "8px" }}>
            Strumento di supporto tecnico - Verificare sempre i dati con le normative vigenti.
          </p>
        </div>
      </div>
    </div>
  );
}
