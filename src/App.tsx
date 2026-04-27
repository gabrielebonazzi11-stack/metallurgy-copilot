import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Questa variabile legge la chiave che hai messo su Vercel
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) alert("Manca la VITE_GROQ_API_KEY su Vercel!");
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
          model: "llama-3.1-8b-instant", // MODELLO AGGIORNATO (Llama 3.1)
          messages: [
            { role: "system", content: "Sei un esperto metallurgico. Rispondi in modo tecnico e professionale in italiano." },
            { role: "user", content: query }
          ],
          temperature: 0.5
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiResponse = data.choices[0].message.content;
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      console.error("Errore Groq:", e);
      setChat([...newChat, { role: "AI", text: "Errore Groq: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>🛠️ Metallurgy Copilot (Groq)</h1>
      <div style={{ 
        border: "1px solid #ccc", height: "450px", overflowY: "auto", 
        padding: "15px", marginBottom: "15px", borderRadius: "10px", background: "#f9f9f9" 
      }}>
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "12px", textAlign: m.role === "utente" ? "right" : "left" }}>
            <span style={{ 
              display: "inline-block", padding: "10px 14px", borderRadius: "12px",
              background: m.role === "utente" ? "#007bff" : "#fff",
              color: m.role === "utente" ? "#fff" : "#333",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
            }}>
              <strong>{m.role === "AI" ? "Groq AI" : "Tu"}:</strong> {m.text}
            </span>
          </div>
        ))}
        {loading && <p style={{ color: "#f39c12" }}><em>Analisi metallurgica in corso...</em></p>}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
          value={query} onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && askAI()}
          placeholder="Chiedi a Groq (es. Trattamento C45)..."
        />
        <button 
          onClick={askAI} 
          style={{ padding: "10px 20px", background: "#f39c12", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
        >
          Invia
        </button>
      </div>
    </div>
  );
}
