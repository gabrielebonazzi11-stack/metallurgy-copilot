import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const askAI = async () => {
    if (!apiKey) return alert("Errore: API Key non trovata su Vercel!");
    if (!query.trim()) return;

    const userMsg = query;
    setChat(prev => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);
    setQuery("");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { 
              parts: [{ text: "Sei un esperto metallurgico. Riferimenti tecnici: 1.0503=C45, 1.7225=42CrMo4, 1.4301=AISI 304. Rispondi in modo professionale." }] 
            },
            contents: [{ parts: [{ text: userMsg }] }]
          })
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const aiText = data.candidates[0].content.parts[0].text;
      setChat(prev => [...prev, { role: "ai", content: aiText }]);
    } catch (err: any) {
      setChat(prev => [...prev, { role: "ai", content: "❌ Errore: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif", maxWidth: "800px", margin: "auto" }}>
      <h1 style={{ color: "#333", borderBottom: "2px solid #28a745", paddingBottom: "10px" }}>Metallurgy Copilot v1.0</h1>
      
      <div style={{ border: "1px solid #ccc", height: "400px", overflowY: "auto", padding: "15px", borderRadius: "8px", background: "#f9f9f9", marginBottom: "20px" }}>
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "15px", textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{ display: "inline-block", padding: "10px", borderRadius: "10px", backgroundColor: m.role === "user" ? "#007bff" : "#e9ecef", color: m.role === "user" ? "white" : "black" }}>
              <strong>{m.role === "user" ? "Tu: " : "AI: "}</strong> {m.content}
            </div>
          </div>
        ))}
        {loading && <p style={{ color: "#666" }}>Analisi in corso...</p>}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "12px", borderRadius: "5px", border: "1px solid #ccc" }}
          value={query} 
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && askAI()}
          placeholder="Chiedi info su un acciaio (es: 1.0503)..."
        />
        <button onClick={askAI} style={{ padding: "10px 20px", backgroundColor: "#28a745", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Invia</button>
      </div>
    </div>
  );
}
