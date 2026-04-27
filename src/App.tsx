import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Assicurati che su Vercel la variabile si chiami esattamente VITE_GROQ_API_KEY
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const askAI = async () => {
    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) alert("Errore: Manca la chiave VITE_GROQ_API_KEY nelle impostazioni di Vercel!");
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
          // Modello aggiornato ad Aprile 2026: performante e stabile
          model: "llama-3.3-70b-versatile", 
          messages: [
            { 
              role: "system", 
              content: "Sei un assistente esperto in metallurgia e scienza dei materiali. Rispondi in modo professionale, tecnico e sempre in lingua italiana." 
            },
            { role: "user", content: query }
          ],
          temperature: 0.4 // Leggermente più basso per risposte più precise e meno creative
        }),
      });

      const data = await res.json();

      if (data.error) {
        // Se Groq restituisce un errore (es. modello non trovato), lo mostriamo in chat
        throw new Error(data.error.message);
      }

      const aiResponse = data.choices[0].message.content;
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      console.error("Errore Groq:", e);
      setChat([...newChat, { role: "AI", text: "⚠️ Errore Tecnico: " + e.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "700px", margin: "0 auto", fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif" }}>
      <h1 style={{ textAlign: "center", color: "#2c3e50" }}>🛠️ Metallurgy Copilot</h1>
      <p style={{ textAlign: "center", color: "#7f8c8d", fontSize: "0.9rem" }}>Powered by Groq AI - Llama 3.3</p>
      
      <div style={{ 
        border: "1px solid #dcdde1", height: "500px", overflowY: "auto", 
        padding: "20px", marginBottom: "20px", borderRadius: "12px", background: "#f5f6fa",
        boxShadow: "inset 0 2px 4px rgba(0,0,0,0.05)"
      }}>
        {chat.length === 0 && (
          <p style={{ color: "#95a5a6", textAlign: "center", marginTop: "200px" }}>
            Chiedi informazioni su acciai, trattamenti termici o leghe...
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "15px", textAlign: m.role === "utente" ? "right" : "left" }}>
            <div style={{ 
              display: "inline-block", padding: "12px 16px", borderRadius: "15px",
              background: m.role === "utente" ? "#007bff" : "#ffffff",
              color: m.role === "utente" ? "#ffffff" : "#2f3640",
              boxShadow: "0 2px 5px rgba(0,0,0,0.1)",
              maxWidth: "80%",
              whiteSpace: "pre-wrap"
            }}>
              <strong style={{ display: "block", marginBottom: "4px", fontSize: "0.8rem", opacity: 0.8 }}>
                {m.role === "AI" ? "ASSISTENTE METALLURGICO" : "TU"}
              </strong>
              {m.text}
            </div>
          </div>
        ))}
        {loading &&
