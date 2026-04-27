import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Recupero della chiave API
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  const askAI = async () => {
    // Debug: controlliamo in console se la chiave viene letta
    console.log("Richiesta inviata. API Key presente:", !!apiKey);

    if (!apiKey || !query.trim() || loading) {
      if (!apiKey) alert("Errore: API Key mancante nelle impostazioni di Vercel!");
      return;
    }

    const newChat = [...chat, { role: "utente", text: query }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      // URL corretto per il modello flash 1.5
      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
      
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: "Sei un esperto metallurgico. Rispondi in modo professionale e tecnico. Domanda: " + query }]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 800,
          }
        }),
      });

      const data = await res.json();

      if (data.error) {
        throw new Error(data.error.message || "Errore API");
      }

      const aiResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || "Nessuna risposta ricevuta dall'AI.";
      setChat([...newChat, { role: "AI", text: aiResponse }]);
      
    } catch (e: any) {
      console.error("Errore completo:", e);
      setChat([...newChat, { role: "AI", text: "Errore: " + (e.message || "Connessione fallita") }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto", fontFamily: "sans-serif" }}>
      <h1 style={{ textAlign: "center" }}>🛠️ Metallurgy Copilot</h1>
      <div style={{ 
        border: "1px solid #ccc", 
        height: "450px", 
        overflowY: "auto", 
        padding: "15px", 
        marginBottom: "15px", 
        borderRadius: "10px", 
        background: "#fff",
        boxShadow: "inset 0 0 10px rgba(0,0,0,0.05)"
      }}>
        {chat.length === 0 && (
          <p style={{ color: "#888", textAlign: "center", marginTop: "150px" }}>
            Inserisci una sigla (es. C45, 42CrMo4) o chiedi un equivalente AISI.
          </p>
        )}
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "15px", textAlign: m.role === "utente" ? "right" : "left" }}>
            <div style={{ 
              display: "inline-block", 
              padding: "10px", 
              borderRadius: "10px", 
              background: m.role === "utente" ? "#007bff" : "#eee", 
              color: m.role === "utente" ? "#fff" : "#000",
              maxWidth: "80%"
            }}>
              <strong>{m.role === "AI" ? "🦾 AI" : "👤 Tu"}:</strong> {m.text}
            </div>
          </div>
        ))}
        {loading && <p style={{ color: "#0
