import React, { useState, useEffect, useRef } from "react";

// Database integrato dalle tue tabelle PDF
const METALLURGY_DB = `
RIFERIMENTI TABELLE:
- Acciai al Carbonio: C15 (1.0401), C45 (1.0503/1.1191), C60 (1.0601)[cite: 36].
- Acciai Legati: 42CrMo4 (1.7225 -> AISI 4140), 36CrNiMo4 (1.6511 -> AISI 9840), 100Cr6 (1.3505 -> AISI 52100)[cite: 38, 39].
- Inox: AISI 304 (1.4301), AISI 316 (1.4401), AISI 410 (1.4006), AISI 430 (1.4016)[cite: 45, 47].
- Ghise: Grigia GG25 (0.6025), Sferoidale GGG40 (0.7040)[cite: 54, 56].
`;

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat]);

  const askAI = async (text?: string) => {
    const input = text || query;
    if (!apiKey || !input.trim() || loading) return;

    const newChat = [...chat, { role: "utente", text: input }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile", // Il modello più recente
          messages: [
            { 
              role: "system", 
              content: `Sei un Technical Copilot esperto in metallurgia. 
              Usa questi dati di riferimento: ${METALLURGY_DB}. 
              Fornisci conversioni tra norme DIN, AISI, UNI e dati su trattamenti termici.` 
            },
            { role: "user", content: input }
          ],
          temperature: 0.2
        }),
      });

      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "⚠️ Errore di connessione con Groq." }]);
    } finally {
      setLoading(false);
    }
  };

  // Stili Inline per evitare problemi di CSS
  const styles = {
    container: { display: "flex", height: "100vh", backgroundColor: "#f8fafc", fontFamily: "sans-serif" },
    sidebar: { width: "260px", backgroundColor: "#0f172a", color: "white", padding: "24px", display: "flex", flexDirection: "column" },
    main: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" },
    statsRow: { display: "flex", gap: "20px", padding: "24px", backgroundColor: "white", borderBottom: "1px solid #e2e8f0" },
    statBox: { flex: 1, padding: "16px", backgroundColor: "#f1f5f9", borderRadius: "12px" },
    chatArea: { flex: 1, overflowY: "auto", padding: "24px", display: "flex", flexDirection: "column", gap: "16px" },
    inputArea: { padding: "24px", backgroundColor: "white", borderTop: "1px solid #e2e8f0" },
    inputWrapper: { display: "flex", backgroundColor: "white", borderRadius: "12px", border: "1px solid #cbd5e1", padding: "8px", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" },
    button: { backgroundColor: "#0f172a", color: "white", border: "none", borderRadius: "8px", padding: "8px 20px", cursor: "pointer", fontWeight: "bold" },
    badge: { fontSize: "10px", fontWeight: "bold", padding: "4px 8px", borderRadius: "4px", marginBottom: "4px", display: "inline-block" }
  };

  return (
    <div style={styles.container}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={{ fontSize: "1.2rem", fontWeight: "bold", marginBottom: "32px" }}>Technical <span style={{ color: "#3b82f6" }}>AI</span></h2>
        <div style={{ flex: 1 }}>
          <p style={{ color: "#64748b", fontSize: "12px", fontWeight: "bold", marginBottom: "12px" }}>MENU</p>
          <div style={{ padding: "12px", backgroundColor: "#1e293b", borderRadius: "8px", cursor: "pointer" }}>📂 Materiali</div>
        </div>
        <div style={{ fontSize: "11px", color: "#475569" }}>v2.0 - Database PDF Caricato [cite: 33]</div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold" }}>BASE MATERIALI</p>
            <p style={{ fontSize: "24px", fontWeight: "900", color: "#2563eb" }}>159</p>
          </div>
          <div style={styles.statBox}>
            <p style={{ fontSize: "11px", color: "#64748b", fontWeight: "bold" }}>FONTE</p>
            <p style={{ fontSize: "24px", fontWeight: "900", color: "#f59e0b" }}>PDF Mista</p>
          </div>
        </div>

        <div ref={scrollRef} style={styles.chatArea}>
          {chat.length === 0 && <p style={{ textAlign: "center", color: "#94a3b8", marginTop: "100px" }}>Fai una ricerca tecnica (es. Equivalente AISI del 42CrMo4)...</p>}
          {chat.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "utente" ? "flex-end" : "flex-start", maxWidth: "80%" }}>
              <div style={{ 
                padding: "16px", borderRadius: "12px", 
                backgroundColor: m.role === "utente" ? "#2563eb" : "white",
                color: m.role === "utente" ? "white" : "#1e293b",
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                border: m.role === "AI" ? "1px solid #e2e8f0" : "none"
              }}>
                <span style={{ ...styles.badge, backgroundColor: m.role === "utente" ? "#1d4ed8" : "#f1f5f9", color: m.role === "utente" ? "white" : "#64748b" }}>
                  {m.role === "AI" ? "REPORT TECNICO" : "DESIGNER"}
                </span>
                <div style={{ fontSize: "14px", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{m.text}</div>
              </div>
            </div>
          ))}
          {loading && <p style={{ color: "#3b82f6", fontSize: "12px" }}>⚙️ Analisi metallurgica in corso...</p>}
        </div>

        <div style={styles.inputArea}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            {["C45", "42CrMo4", "AISI 304", "AISI 316"].map(tag => (
              <button key={tag} onClick={() => askAI(`Scheda tecnica ${tag}`)} style={{ padding: "4px 12px", borderRadius: "20px", border: "1px solid #e2e8f0", backgroundColor: "white", fontSize: "12px", cursor: "pointer" }}>{tag}</button>
            ))}
          </div>
          <div style={styles.inputWrapper}>
            <input 
              style={{ flex: 1, border: "none", outline: "none", padding: "12px", fontSize: "15px" }}
              placeholder="Inserisci materiale o normativa..."
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && askAI()}
            />
            <button onClick={() => askAI()} style={styles.button}>Invia ➜</button>
          </div>
        </div>
      </div>
    </div>
  );
}
