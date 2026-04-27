import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Recupero della chiave API (Vite usa import.meta.env)
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const askAI = async () => {
    // Se la chiave manca, l'URL risulterà errato (404)
    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) console.error("ATTENZIONE: VITE_GEMINI_API_KEY non trovata!");
      return;
    }

    const newChat = [...chat, { role: "utente", text: query }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      // URL costruito in modo sicuro
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: "Sei un esperto metallurgico. Rispondi alla domanda in modo tecnico: " + query }]
          }]
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta.";
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      console.error("Dettaglio errore:", e);
      setChat([...newChat, { role: "AI", text: "Errore: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>🛠️ Metallurgy Copilot</h1>
      <div style={{ 
        border: "1px solid #ccc", height: "450px", overflowY: "auto", 
        padding: "15px", marginBottom: "15px", borderRadius: "10px", background: "#f9f9f9" 
      }}>
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "10px", textAlign: m.role === "utente" ? "right" : "left" }}>
            <span style={{ 
              display: "inline-block", padding: "8px 12px", borderRadius: "10px",
              background: m.role === "utente" ? "#007bff" : "#e9e9eb",
              color: m.role === "utente" ? "#fff" : "#000"
            }}>
              <strong>{m.role === "AI" ? "AI" : "Tu"}:</strong> {m.text}
            </span>
          </div>
        ))}
        {loading && <p style={{ color: "#007bff" }}>Analisi in corso...</p>}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "10px", borderRadius: "5px", border: "1px solid #ccc" }}
          value={query} onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && askAI()}
          placeholder="Chiedi (es. equivalente AISI di C45)..."
        />
        <button 
          onClick={askAI} 
          style={{ padding: "10px 20px", background: "#007bff", color: "#fff", border: "none", borderRadius: "5px", cursor: "pointer" }}
        >
          Invia
        </button>
      </div>
    </div>
  );
}
