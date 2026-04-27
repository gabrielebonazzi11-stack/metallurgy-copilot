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
      // MODIFICA: Usiamo la versione 'v1' invece di 'v1beta' e il modello senza 'models/' davanti nel fetch
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: "Sei un esperto metallurgico. Domanda: " + query }] }]
          }),
        }
      );

      const data = await res.json();

      if (data.error) {
        // Se v1 fallisce, l'errore apparirà qui in chat per darci un indizio
        throw new Error(data.error.message);
      }

      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta ricevuta.";
      setChat([...newChat, { role: "AI", text: aiResponse }]);
    } catch (e: any) {
      console.error("Errore:", e);
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
          placeholder="Chiedi (es. C45 o 42CrMo4)..."
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
