import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Recuperiamo la chiave OpenAI da Vercel
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) alert("Manca la VITE_OPENAI_API_KEY su Vercel!");
      return;
    }

    const newChat = [...chat, { role: "utente", text: query }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey.trim()}`
        },
        body: JSON.stringify({
          model: "gpt-4o-mini", // Modello economico, veloce e potentissimo
          messages: [
            { role: "system", content: "Sei un esperto metallurgico. Rispondi in modo tecnico e preciso." },
            { role: "user", content: query }
          ],
          temperature: 0.7
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const aiResponse = data.choices[0].message.content;
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      console.error("Errore OpenAI:", e);
      setChat([...newChat, { role: "AI", text: "Errore ChatGPT: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>🛠️ Metallurgy Copilot (GPT)</h1>
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
              <strong>{m.role === "AI" ? "ChatGPT" : "Tu"}:</strong> {m.text}
            </span>
          </div>
        ))}
        {loading && <p style={{ color: "#007bff" }}><em>Analisi in corso...</em></p>}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "12px", borderRadius: "8px", border: "1px solid #ccc" }}
          value={query} onChange={e => setQuery(e.target.value)} 
          onKeyDown={e => e.key === "Enter" && askAI()}
          placeholder="Chiedi a ChatGPT (es. Trattamento termico 39NiCrMo3)..."
        />
        <button 
          onClick={askAI} 
          style={{ padding: "10px 20px", background: "#28a745", color: "#fff", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" }}
        >
          Invia
        </button>
      </div>
    </div>
  );
}
