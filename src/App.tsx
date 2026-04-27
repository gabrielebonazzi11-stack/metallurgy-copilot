import React, { useState, useEffect, useRef } from "react";

// Dati estratti dalle tue tabelle PDF per "addestrare" localmente l'AI
const LOCAL_KNOWLEDGE = `
Tabelle di confronto materiali caricate:
- 1.0503 (C45 DIN) = AISI 1045 = UNI C45 
- 1.7225 (42CrMo4 DIN) = AISI 4140 = UNI 42CrMo4 [cite: 39]
- 1.0401 (C15 DIN) = AISI 1015 = UNI C15 
- 1.3505 (100Cr6 DIN) = AISI 52100 = UNI 100Cr6 [cite: 38]
- Acciaio Inox: 1.4301 = AISI 304 = UNI X5CrNi1810 [cite: 47]
`;

export default function App() {
  const [activeTab, setActiveTab] = useState("materiali");
  const [query, setQuery] = useState("");
  const [chat, setChat] = useState<{ role: string; text: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [chat]);

  const askAI = async (customQuery?: string) => {
    const textToSubmit = customQuery || query;
    if (!apiKey || !textToSubmit.trim() || loading) return;

    const newChat = [...chat, { role: "utente", text: textToSubmit }];
    setChat(newChat);
    setQuery("");
    setLoading(true);

    try {
      const res = await fetch("https://api.api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey.trim()}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `Sei un Copilot per il disegno tecnico. Aiuta l'utente a convertire materiali e parti commerciali. 
              Usa questi dati tecnici come base prioritaria: ${LOCAL_KNOWLEDGE}. 
              Rispondi sempre in modo tabellare o sintetico per facilitare il lavoro del disegnatore.` 
            },
            { role: "user", content: textToSubmit }
          ],
          temperature: 0.2
        }),
      });

      const data = await res.json();
      setChat([...newChat, { role: "AI", text: data.choices[0].message.content }]);
    } catch (e) {
      setChat([...newChat, { role: "AI", text: "⚠️ Errore critico di sistema." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC] text-[#1E293B] font-sans">
      {/* SIDEBAR */}
      <div className="w-64 bg-[#0F172A] text-white flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold tracking-tight">Technical Copilot <span className="text-blue-400">AI</span></h1>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          <button 
            onClick={() => setActiveTab("materiali")}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'materiali' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            📂 Materiali
          </button>
          <button 
            onClick={() => setActiveTab("commerciali")}
            className={`w-full text-left p-3 rounded-lg flex items-center gap-3 transition ${activeTab === 'commerciali' ? 'bg-blue-600' : 'hover:bg-slate-800'}`}
          >
            📦 Commerciali
          </button>
        </nav>
        <div className="p-4 text-xs text-slate-500 border-t border-slate-800">
          Powered by Llama 3.3 & Custom Knowledge
        </div>
      </div>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER STATS */}
        <div className="p-6 grid grid-cols-3 gap-6 bg-white border-bottom shadow-sm">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 uppercase font-bold">Base Materiali</p>
            <p className="text-2xl font-black text-blue-600">159</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 uppercase font-bold">Attivi</p>
            <p className="text-2xl font-black text-green-600">159</p>
          </div>
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
            <p className="text-xs text-slate-500 uppercase font-bold">Fonte</p>
            <p className="text-2xl font-black text-amber-500">Mista</p>
          </div>
        </div>

        {/* INTERFACE AREA */}
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-8 flex flex-col max-w-4xl mx-auto w-full">
            
            {/* CARICA FONTE BOX */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm mb-6 flex justify-between items-center">
              <div>
                <h3 className="font-bold">Fonte prioritaria modificabile</h3>
                <p className="text-sm text-slate-500">Carica le tue dispense tecniche (CSV/Excel)</p>
              </div>
              <button className="bg-green-500 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-600 transition shadow-lg shadow-green-100">
                Carica Fonte
              </button>
            </div>

            {/* CHAT/SEARCH AREA */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
              {chat.length === 0 && (
                <div className="text-center py-20">
                  <p className="text-slate-400 italic">Fai una ricerca per vedere le equivalenze o i dati tecnici...</p>
                </div>
              )}
              {chat.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'utente' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm border ${m.role === 'utente' ? 'bg-blue-600 text-white border-blue-500' : 'bg-white border-slate-200 text-slate-800'}`}>
                    <p className="text-[10px] uppercase font-black mb-1 opacity-70">{m.role === 'AI' ? 'System Output' : 'Input Designer'}</p>
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">{m.text}</div>
                  </div>
                </div>
              ))}
              {loading && <div className="text-blue-500 text-xs animate-pulse font-bold">GENERAZIONE REPORT IN CORSO...</div>}
            </div>

            {/* INPUT FIELD & CHIPS */}
            <div className="space-y-4">
              <div className="flex gap-2">
                {["C45", "1045", "42CrMo4", "4140"].map(chip => (
                  <button 
                    key={chip} 
                    onClick={() => askAI(`Dammi i dati e le equivalenze per ${chip}`)}
                    className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-full text-xs font-semibold text-slate-600 transition"
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="relative">
                <input 
                  className="w-full p-4 pr-16 bg-white border border-slate-200 rounded-2xl shadow-xl outline-none focus:border-blue-500 transition"
                  placeholder="Ask anything (es. Caratteristiche 39NiCrMo3)..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && askAI()}
                />
                <button 
                  onClick={() => askAI()}
                  className="absolute right-3 top-3 bottom-3 bg-[#0F172A] text-white px-4 rounded-xl hover:bg-blue-600 transition"
                >
                  ➜
                </button>
              </div>
            </div>
          </div>

          {/* LISTA LATERALE (Simula la lista caricata nell'immagine) */}
          <div className="w-64 bg-white border-l border-slate-200 p-6 overflow-y-auto">
            <h4 className="text-xs font-black text-slate-400 uppercase mb-4">Base caricata</h4>
            <div className="space-y-3">
              {["C45", "42CrMo4", "AISI 304", "100Cr6", "AISI 431"].map(mat => (
                <div key={mat} className="p-3 bg-slate-50 rounded-lg border border-slate-100 hover:border-blue-300 cursor-pointer transition">
                  <p className="text-sm font-bold text-slate-700">{mat}</p>
                  <p className="text-[10px] text-slate-400">Acciaio legato/inox</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
