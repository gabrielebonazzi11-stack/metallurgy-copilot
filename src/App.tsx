import React, { useState } from "react";

export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; content: string }[]>([]);
  const [loading, setLoading] = useState(false);

  // Legge la chiave che hai impostato nelle Environment Variables di Vercel
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  const askAI = async () => {
    if (!apiKey) return alert("Errore: API Key non configurata su Vercel!");
    if (!query.trim()) return;

    setChat(prev => [...prev, { role: "user", content: query }]);
    setLoading(true);
    const currentQuery = query;
    setQuery("");

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: { 
              parts: [{ text: "Sei un esperto metallurgico. Riferimenti: 1.0503=C45, 1.7225=42CrMo4, 1.4301=AISI304. Rispondi in modo tecnico e conciso." }] 
            },
            contents: [{ parts: [{ text: currentQuery }] }]
          })
        }
      );

      const data = await response.json();
      if (data.error) throw new Error(data.error.message);

      const aiReply = data.candidates[0].content.parts[0].text;
      setChat(prev => [...prev, { role: "ai", content: aiReply }]);
    } catch (err: any) {
      setChat(prev => [...prev, { role: "ai", content: "⚠️ Errore: " + err.message }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: "20px", fontFamily: "Segoe UI, sans-serif", maxWidth: "800px", margin: "auto" }}>
      <h1 style={{ color: "#2c3e50", borderBottom: "2px solid #27ae60" }}>Metallurgy Copilot v1.0 🛠️</h1>
      
      <div style={{ border: "1px solid #ddd", height: "450px", overflowY: "auto", padding: "15px", margin: "20px 0", borderRadius: "8px", background: "#f8f9fa" }}>
        {chat.map((m, i) => (
          <div key={i} style={{ marginBottom: "15px", textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{ display: "inline-block", padding: "10px 15px", borderRadius: "15px", background: m.role === "user" ? "#3498db" : "#ecf0f1", color: m.role === "user" ? "white" : "black" }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && <p style={{ color: "#7f8c8d" }}>Consultazione database metallurgico...</p>}
      </div>

      <div style={{ display: "flex", gap: "10px" }}>
        <input 
          style={{ flex: 1, padding: "12px", borderRadius: "5px", border: "1px solid #ccc" }} 
          value={query} 
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === "Enter" && askAI()}
          placeholder="Chiedi un equivalente o specifica tecnica..."
        />
        <button onClick={askAI} style={{ padding: "10px 25px", background: "#27ae60", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>Invia</button>
      </div>
    </div>
  );
}
