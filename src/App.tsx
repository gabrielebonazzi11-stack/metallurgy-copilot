import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) return;

    const newChat = [...chat, { role: "utente", text: query }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              {
                role: "user",
                parts: [{ text: "Sei un esperto metallurgico. Rispondi in modo tecnico ma conciso. Domanda: " + query }]
              }
            ]
          }),
        }
      );

      const data = await res.json();
      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta ricevuta";
      
      setChat([...newChat, { role: "AI", text: aiResponse }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "Errore di connessione." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1>🛠️ Metallurgy Copilot</h1>
      <div style={{ 
        border: "1px solid #ccc", 
        height: "400px", 
        overflowY: "auto", 
        padding: "10px", 
        marginBottom: "10px",
        borderRadius: "8px",
        background: "#f9f9f9"
      }}>
        {chat.length === 0 && <p style={{color: "#888"}}>Chiedimi qualcosa sugli acciai (es. 1.0503 o 1.7225)...</p>}
        {chat.map((m, i) => (
          <p key={i}><strong>{m.role.toUpperCase()}:</strong> {m.text}</p>
        ))}
        {loading && <p><em>L'AI sta analizzando...</em></p>}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "10px" }}
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && askAI()} 
          placeholder="Scrivi qui..."
        />
        <button 
          onClick={askAI} 
          disabled={loading}
          style={{ padding: "10px 20px", cursor: "pointer", background: "#007bff", color: "white", border: "none", borderRadius: "4px" }}
        >
          Invia
        </button>
      </div>
    </div>
  );
}
