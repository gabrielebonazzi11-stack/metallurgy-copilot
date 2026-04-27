import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) alert("Errore: Manca la chiave VITE_GROQ_API_KEY su Vercel!");
      return;
    }

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
            { 
              role: "system", 
              content: "Sei un assistente esperto in metallurgia. Rispondi in modo professionale, tecnico e in italiano." 
            },
            { role: "user", content: query }
          ],
          temperature: 0.4
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error.message);

      const aiResponse = data.choices[0].message.content;
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      setChat([...newChat, { role: "AI", text: "⚠️ Errore: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#2c3e50" }}>🛠️ Metallurgy Copilot</h1>
      
      <div style={{ 
        border: "1px solid #dcdde1", height: "500px", overflowY: "auto", 
        padding: "20px", marginBottom: "20px", borderRadius: "12px", background: "#f5f6fa"
      }}>
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "15px", textAlign: m.role === "utente" ? "right" : "left" }}>
            <div style={{ 
              display: "inline-block", padding: "12px 16px", borderRadius: "15px",
              background: m.role === "utente" ? "#007bff" : "#ffffff",
              color: m.role === "utente" ? "#ffffff" : "#2f3640",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              maxWidth: "80%"
            }}>
              {m.text}
            </div>
          </div>
        ))}
        {loading && <p style={{ color: "#f39c12" }}>Analisi in corso...</p>}
      </div>

      <div style={{ display: "flex", gap: "12px" }}>
        <input 
          style={{ flex: 1, padding: "14px", borderRadius: "10px", border: "1px solid #dcdde1" }}
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && askAI()}
          placeholder="Chiedi all'esperto..."
        />
        <button 
          onClick={askAI} 
          style={{ padding: "0 25px", background: "#f39c12", color: "#fff", border: "none", borderRadius: "10px", cursor: "pointer" }}
        >
          INVIA
        </button>
      </div>
    </div>
  );
}
