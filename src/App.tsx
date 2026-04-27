import React, { useState } from "react";
export default function App() {
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  const askAI = async () => {
    if (!apiKey || !query.trim()) return;
    const newChat = [...chat, { role: "user", text: query }];
    setChat(newChat); setQuery(""); setLoading(true);
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system_instruction: { parts: [{ text: "Esperto metallurgico. 1.0503=C45, 1.7225=42CrMo4." }] }, contents: [{ parts: [{ text: query }] }] })
      });
      const data = await res.json();
      setChat([...newChat, { role: "ai", text: data.candidates[0].content.parts[0].text }]);
    } catch (e) { setChat([...newChat, { role: "ai", text: "Errore connessione" }]); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ padding: "20px", fontFamily: "sans-serif" }}>
      <h1>Metallurgy Copilot</h1>
      <div style={{ border: "1px solid #ccc", height: "400px", overflowY: "auto", padding: "10px", marginBottom: "10px" }}>
        {chat.map((m, i) => <p key={i}><b>{m.role}:</b> {m.text}</p>)}
      </div>
      <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI()} />
      <button onClick={askAI}>Invia</button>
    </div>
  );
}
