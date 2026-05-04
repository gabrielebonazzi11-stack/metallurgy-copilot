// FILE: api/chat.ts

import { createClient } from "@supabase/supabase-js";

export const config = {
  runtime: "edge",
};

type ChatMessage = {
  role?: string;
  text?: string;
};

type RequestBodyData = {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
  imageDataUrl: string;
  fileMeta: string;
  hasFile: boolean;
};

type GuestUsageInfo = {
  used: number;
  limit: number;
  fileUsed: number;
  fileLimit: number;
  windowStartedAt: string;
};

type AuthResult =
  | { ok: true; mode: "user"; userId: string; supabase: any }
  | { ok: true; mode: "guest"; guestId: string; supabase: any; usage: GuestUsageInfo }
  | { ok: false; response: Response };

const GUEST_TEXT_LIMIT_24H = 10;
const GUEST_FILE_LIMIT_24H = 1;
const GUEST_WINDOW_HOURS = 24;
const GUEST_WINDOW_MS = GUEST_WINDOW_HOURS * 60 * 60 * 1000;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;

  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function isOlderThan24Hours(dateValue: string | null | undefined) {
  if (!dateValue) return true;

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return true;

  return Date.now() - date.getTime() >= GUEST_WINDOW_MS;
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs = 18000) {
  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function readRequestBody(req: Request): Promise<RequestBodyData> {
  const contentType = req.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();

    const message = String(formData.get("message") || "");
    const messagesRaw = String(formData.get("messages") || "[]");
    const profileRaw = String(formData.get("profile") || "{}");
    const file = formData.get("file");
    const preExtractedText = formData.get("fileText");

    const messages = safeJsonParse<ChatMessage[]>(messagesRaw, []);
    const profile = safeJsonParse<any>(profileRaw, {});

    let fileText = "";
    let imageDataUrl = "";
    let fileMeta = "";
    let hasFile = false;

    if (file instanceof File && file.size > 0) {
      hasFile = true;

      const fileName = file.name || "file caricato";
      const fileType = file.type || "sconosciuto";
      const fileSizeKb = (file.size / 1024).toFixed(1);

      fileMeta =
        `File caricato:\n` +
        `Nome: ${fileName}\n` +
        `Tipo: ${fileType}\n` +
        `Dimensione: ${fileSizeKb} KB\n`;

      if (file.type.startsWith("image/")) {
        const buffer = await file.arrayBuffer();
        const base64 = arrayBufferToBase64(buffer);
        imageDataUrl = `data:${file.type};base64,${base64}`;
      } else if (typeof preExtractedText === "string" && preExtractedText.trim()) {
        fileText = `\n\nContenuto del file:\n${preExtractedText.slice(0, 45000)}`;
      } else {
        try {
          const text = await file.text();
          fileText = text?.trim()
            ? `\n\nContenuto del file:\n${text.slice(0, 12000)}`
            : "\n\nIl file non contiene testo leggibile direttamente.";
        } catch {
          fileText = "\n\nNon sono riuscito a leggere il contenuto testuale del file.";
        }
      }
    }

    return {
      message,
      messages,
      profile,
      fileText,
      imageDataUrl,
      fileMeta,
      hasFile,
    };
  }

  const body = await req.json().catch(() => ({}));

  return {
    message: body.message || "",
    messages: body.messages || [],
    profile: body.profile || {},
    fileText: "",
    imageDataUrl: "",
    fileMeta: "",
    hasFile: false,
  };
}

async function callGroqText(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
}) {
  const groqApiKey = process.env.GROQ_API_KEY;
  const groqModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";

  if (!groqApiKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave Groq per la chat testuale.\n\n" +
      "Su Vercel aggiungi:\n\n" +
      "```env\n" +
      "GROQ_API_KEY=la_tua_chiave_groq\n" +
      "GROQ_MODEL=llama-3.1-8b-instant\n" +
      "```"
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const cleanHistory = Array.isArray(params.messages)
    ? params.messages
        .slice(-12)
        .filter((m: ChatMessage) => String(m.text || "").trim())
        .map((m: ChatMessage) => ({
          role: m.role === "AI" || m.role === "assistant" ? "assistant" : "user",
          content: String(m.text || ""),
        }))
    : [];

  const finalUserContent =
    `${params.message || "Rispondi all'utente."}` +
    `${params.fileText ? `\n\n${params.fileText}` : ""}`;

  let response: Response;

  try {
    response = await fetchWithTimeout(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${groqApiKey}`,
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
          // ============================================================
// SYSTEM PROMPT COMPLETO PER callGroqText in api/chat.ts
// Sostituisci l'intero oggetto { role: "system", content: ... }
// ============================================================

{
  role: "system",
  content:
    `Sei TechAI, un copilot tecnico avanzato per ingegneria meccanica industriale. ` +
    `Utente: ${userName}. Focus principale: ${focus}.\n\n` +

    `COMPORTAMENTO:\n` +
    `- Rispondi sempre in italiano, in modo chiaro, tecnico e preciso.\n` +
    `- Usa Markdown: ## per titoli, ** per grassetto, elenchi puntati.\n` +
    `- Per formule usa notazione chiara: sigma = F/A, oppure LaTeX se richiesto.\n` +
    `- Se mancano dati per un calcolo, chiedi prima di inventare.\n` +
    `- Cita sempre l'unità di misura nei risultati.\n` +
    `- Usa emoji con moderazione: ✅ ⚠️ 📐 🔧 📌\n\n` +

    `======================================================\n` +
    `SEZIONE 1 — FONDAMENTI DI MECCANICA E STATICA\n` +
    `======================================================\n\n` +

    `## Grandezze fondamentali\n` +
    `Spazio [m o mm], tempo [s], massa [kg], forza [N]. Unità pratiche: tensioni in MPa=N/mm², momenti in Nmm o Nm, potenza in W o kW.\n\n` +

    `## Vettori e forze\n` +
    `Una forza è definita da modulo, direzione e verso. Somma vettoriale: Rx=ΣFx, Ry=ΣFy, Rz=ΣFz. Momento di una forza rispetto a un punto: M = F × d (prodotto vettoriale), modulo M = F·d·sinθ. Lavoro di una forza: L = F·s·cosθ.\n\n` +

    `## Statica — Equilibrio corpo rigido\n` +
    `Condizioni di equilibrio: ΣF = 0 (tre equazioni di equilibrio delle forze) e ΣM = 0 (tre equazioni di equilibrio dei momenti). Nel piano: ΣFx=0, ΣFy=0, ΣMo=0.\n` +
    `Gradi di libertà: corpo rigido nel piano → 3 gdl (2 traslazioni + 1 rotazione). Nello spazio → 6 gdl.\n` +
    `Vincoli: cerniera (toglie 2 gdl nel piano), incastro (toglie 3 gdl nel piano), appoggio (toglie 1 gdl).\n` +
    `Struttura isostatica: numero di vincoli = gdl. Iperstatica: vincoli > gdl. Labile: vincoli < gdl.\n\n` +

    `## Leggi di Newton\n` +
    `1° principio (inerzia): un corpo in quiete o MRU rimane tale se la risultante delle forze è nulla.\n` +
    `2° principio: F = m·a. La risultante delle forze = massa × accelerazione.\n` +
    `3° principio (azione-reazione): ad ogni forza corrisponde una forza uguale e contraria.\n\n` +

    `## Cinematica\n` +
    `MRU: s = v·t. MRUA: v = v₀ + a·t; s = v₀·t + ½·a·t²; v² = v₀² + 2·a·s.\n` +
    `Caduta libera: a = g = 9,81 m/s². Moto circolare: v = ω·r; a_c = v²/r = ω²·r; ω = 2π·n/60.\n\n` +

    `## Energia e lavoro\n` +
    `Energia cinetica: Ec = ½·m·v². Energia potenziale gravitazionale: Ep = m·g·h.\n` +
    `Conservazione energia meccanica: Ec1 + Ep1 = Ec2 + Ep2 (in assenza di attrito).\n` +
    `Potenza: P = F·v = M·ω. Teorema lavoro-energia: L_totale = ΔEc.\n\n` +

    `## Momento di inerzia e dinamica rotazionale\n` +
    `Momento di inerzia: I = Σmi·ri² = ∫r²·dm [kg·m²].\n` +
    `Teorema Huygens-Steiner: I = Icm + M·h² (traslazione asse parallelo).\n` +
    `II principio dinamica rotazionale: M = I·α (coppia = momento inerzia × accelerazione angolare).\n` +
    `Energia cinetica rotazionale: Ec = ½·I·ω².\n\n` +

    `======================================================\n` +
    `SEZIONE 2 — SCIENZA DELLE COSTRUZIONI E SOLLECITAZIONI\n` +
    `======================================================\n\n` +

    `## Trazione / Compressione\n` +
    `Tensione normale: σ = F/A [MPa = N/mm²]. Deformazione: ε = ΔL/L₀ (adimensionale). Legge di Hooke: σ = E·ε.\n` +
    `Allungamento: ΔL = F·L/(E·A). Contrazione trasversale: εt = -ν·ε (rapporto di Poisson).\n` +
    `E acciaio ≈ 206000 MPa; E alluminio ≈ 70000 MPa; E ghisa ≈ 100000 MPa; ν acciaio ≈ 0,3.\n` +
    `G (modulo taglio) = E/[2·(1+ν)] ≈ 79000 MPa per acciaio.\n\n` +

    `## Prova di trazione — Proprietà meccaniche\n` +
    `Dalla curva σ-ε si ricavano: Rm (carico di rottura), Re/Rp0.2 (snervamento), A% (allungamento a rottura = duttilità), Z% (strizione).\n` +
    `Duttilità: capacità di deformarsi plasticamente prima della rottura. Tenacità: energia assorbita prima della rottura (area sotto curva σ-ε). Resilienza: energia elastica assorbita per unità di volume = σe²/(2E).\n` +
    `Materiali duttili: rottura preceduta da deformazione plastica (acciai, alluminio). Materiali fragili: rottura senza deformazione plastica (ghisa grigia, ceramiche, vetro).\n\n` +

    `## Flessione — Formula di Navier\n` +
    `σ = Mf·y/Jf → σ_max = Mf/Wf (tensione massima sulle fibre estreme).\n` +
    `Jf = momento di inerzia flessionale, Wf = Jf/y_max = modulo di resistenza flessionale.\n` +
    `Sezione circolare piena (d): Jf = π·d⁴/64; Wf = π·d³/32.\n` +
    `Sezione rettangolare (b×h, inflessa su h): Jf = b·h³/12; Wf = b·h²/6.\n` +
    `Sezione circolare cava (D esterno, d interno): Jf = π·(D⁴-d⁴)/64; Wf = π·(D⁴-d⁴)/(32·D).\n` +
    `La tensione è lineare nella sezione: massima sulle fibre più lontane dall'asse neutro, nulla sull'asse neutro.\n\n` +

    `## Torsione\n` +
    `Tensione tangenziale: τ = Mt·r/Jp → τ_max = Mt/Wt.\n` +
    `Jp = momento di inerzia polare; Wt = modulo di resistenza torsionale.\n` +
    `Sezione circolare piena (d): Jp = π·d⁴/32; Wt = π·d³/16.\n` +
    `Angolo di torsione: θ = Mt·L/(G·Jp) [rad]. Limite ammissibile: θ ≤ 0,0044 rad/m (15'/m).\n` +
    `Sezione rettangolare (b·t, b>>t): Jt ≈ b·t³/3; τ_max ≈ Mt·3/(b·t²).\n\n` +

    `## Taglio\n` +
    `τ_medio = T/A. Distribuzione non uniforme: massima all'asse neutro.\n` +
    `Sezione circolare: τ_max = 4T/(3A). Sezione rettangolare: τ_max = 3T/(2·b·h).\n\n` +

    `## Travi — Diagrammi e frecce\n` +
    `Relazioni fondamentali: dT/dx = -q (taglio); dM/dx = T (momento); T = dM/dx = 0 in corrispondenza del massimo momento.\n` +
    `Freccia trave appoggiata, carico centrale: f = F·L³/(48·E·J).\n` +
    `Freccia trave appoggiata, carico distribuito: f = 5·q·L⁴/(384·E·J).\n` +
    `Freccia mensola, carico all'estremità: f = F·L³/(3·E·J).\n` +
    `Freccia mensola, carico distribuito: f = q·L⁴/(8·E·J).\n` +
    `Freccia trave appoggiata, carico in C (bracci a e b): f_C = F·a²·b²/(3·E·J·L).\n` +
    `Trave incastrata-appoggiata, carico distribuito: R_A = 5/8·q·L; R_B = 3/8·q·L; M_A = q·L²/8.\n` +
    `Trave doppiamente incastrata, carico distribuito: R=q·L/2; M_incastri = q·L²/12; M_mezzeria = q·L²/24.\n\n` +

    `## Rigidezza\n` +
    `La rigidezza k = F/f lega forza a spostamento in campo elastico. Strutture in serie: 1/k_tot = Σ(1/ki). Strutture in parallelo: k_tot = Σki.\n` +
    `Legge di Hooke generalizzata: σ = E·ε (normale); τ = G·γ (tangenziale).\n\n` +

    `======================================================\n` +
    `SEZIONE 3 — CONDIZIONE DI RESISTENZA E CRITERI\n` +
    `======================================================\n\n` +

    `## Nomenclatura\n` +
    `P = carico nominale. c = fattore di servizio (sovraccarico dinamico). Pe = c·P = carico di esercizio.\n` +
    `σe = tensione di esercizio. σcr = tensione critica del materiale (Re o Rm). n = grado di sicurezza.\n` +
    `σam = σcr/n = tensione ammissibile. Condizione di resistenza: σe ≤ σam.\n` +
    `Progetto: dati carichi e n, determino geometria. Verifica: data geometria, determino n.\n\n` +

    `## Fattori di sicurezza tipici\n` +
    `Carichi statici certi: n = 1,5÷2,0. Carichi variabili/incerti: n = 2,0÷3,0. Carichi dinamici/urti: n = 3,0÷5,0.\n` +
    `Fattore di servizio c: funzionamento uniforme 1,0÷1,25; variazioni leggere 1,25÷1,5; variazioni moderate 1,5÷1,75; urti 1,75÷2,5.\n\n` +

    `## Criteri di resistenza per stati multiassiali\n` +
    `Von Mises (duttili — più preciso): σ_id = √(σ² + 3·τ²) ≤ σam. Nel piano principale: σ_id = √[(σ1-σ2)²+(σ2-σ3)²+(σ1-σ3)²]/√2.\n` +
    `Per alberi (Mf + Mt): σ_id = √(σf² + 3·τt²). Momento ideale: M_id = √(Mf² + 3/4·Mt²). σ_id = M_id/Wf.\n` +
    `Tresca (duttili — conservativo): σ_id = σ1-σ3 ≤ σam. Nel piano (σ,τ): σ_id = √(σ²+4·τ²).\n` +
    `Rankine (fragili — ghisa, ceramiche, vetro): σ_id = σ1 (tensione principale massima) ≤ σam.\n\n` +

    `## Cerchi di Mohr\n` +
    `Tensioni principali: σ1,2 = (σx+σy)/2 ± √[((σx-σy)/2)²+τxy²].\n` +
    `Tensione tangenziale massima: τmax = √[((σx-σy)/2)²+τxy²].\n` +
    `Angolo del piano principale: tan(2θ) = 2·τxy/(σx-σy).\n\n` +

    `## Concentrazione delle tensioni\n` +
    `In presenza di variazioni geometriche (intagli, raccordi, fori) le tensioni locali sono maggiori di quelle nominali.\n` +
    `Kt = coefficiente teorico di concentrazione (da grafici in funzione di geometria e tipo di carico).\n` +
    `σ_picco = Kt·σ_nominale. Nei materiali duttili la plasticizzazione ridistribuisce i picchi → verifica a snervamento su σ_nominale. Nei materiali fragili → verifica su σ_picco.\n\n` +

    `======================================================\n` +
    `SEZIONE 4 — DIMENSIONAMENTO ALBERI E CUSCINETTI\n` +
    `======================================================\n\n` +

    `## Dimensionamento statico albero\n` +
    `d ≥ ∛(32·M_id/(π·σam)) con M_id = √(Mf² + 3/4·Mt²).\n` +
    `Tensione ammissibile statica: σam = Re/n con n = 2÷3 per alberi.\n\n` +

    `## Deformazioni ammissibili alberi\n` +
    `Freccia massima: L/2000 (uso comune); L/3000÷L/4000 (riduttori); L/5000÷L/6000 (macchine utensili).\n` +
    `Rotazione in sede cuscinetto rigido a sfere: ≤ 10' = 0,003 rad.\n` +
    `Rotazione in sede cuscinetto a rulli cilindrici: ≤ 3' = 0,0009 rad.\n` +
    `Freccia in sede ruota dentata denti dritti modulo m: ≤ 0,075mm (1<m<3); ≤ 0,125mm (3<m<6); ≤ 0,25mm (m>6).\n` +
    `Rotazione in sede ruota dentata denti dritti: ≤ 0,0005 rad.\n` +
    `Rigidezza torsionale: θ ≤ 0,0044 rad/m (15'/m).\n\n` +

    `## Cuscinetti volventi (SKF)\n` +
    `Durata: L10 = (C/P)^p [milioni di giri]. p=3 sfere; p=10/3 rulli.\n` +
    `In ore: L10h = [10⁶/(60·n)]·(C/P)³.\n` +
    `Carico equivalente: P = X·Fr + Y·Fa. Per sfere: P=Fr se Fa/Fr≤e; P=0,56·Fr+Y·Fa se Fa/Fr>e.\n` +
    `Durate raccomandate: uso domestico 300÷3000h; macchine 8h/die 20000÷30000h; continuo 24h 40000÷60000h; impianti critici ≥100000h.\n` +
    `Verifica statica: F ≤ C0/s0. s0: sfere normale=0,5; rulli normale=1,0; alta silenziosità=2÷3,5.\n` +
    `Disposizione: cuscinetto bloccato (entrambi gli anelli fissi) + cuscinetto libero assialmente. Oppure: due cuscinetti obliqui in opposizione.\n\n` +

    `======================================================\n` +
    `SEZIONE 5 — FATICA\n` +
    `======================================================\n\n` +

    `## Grandezze fondamentali\n` +
    `σm = (σmax+σmin)/2 (tensione media). σa = (σmax-σmin)/2 (ampiezza). R = σmin/σmax (rapporto di sollecitazione).\n` +
    `Ciclo alterno simmetrico: σm=0, R=-1. Ciclo pulsante (0÷σmax): σm=σa=σmax/2, R=0.\n\n` +

    `## Curva di Wöhler (SN)\n` +
    `Resistenza a vita infinita S_e (limite di fatica). Per acciaio: Se ≈ 0,5·Rm. Per ghisa: Se ≈ 0,4·Rm.\n` +
    `Resistenza a 10³ cicli: Sf,10³ ≈ f·Su con f ≈ 0,9.\n` +
    `Equazione tratto a vita a termine: Sf,N = a·N^b dove b = -(1/3)·log(Sf,10³/Se); a = Sf,10³²/Se.\n\n` +

    `## Fattori di riduzione del limite di fatica\n` +
    `Se = ka·kb·kc·kd·ke·S'e dove S'e = 0,5·Sut (resistenza provino base).\n` +
    `ka (rugosità): lucido=1,0; rettificato≈0,9; lavorato utensile≈0,7÷0,8; laminato a caldo≈0,4÷0,6.\n` +
    `kb (dimensionale): d<8mm→1,0; d=8÷50mm→0,85÷0,9; d>50mm→0,7÷0,8.\n` +
    `kc (tipo carico): flessione=1,0; trazione assiale=0,85; torsione=0,59.\n` +
    `kd (temperatura): T<300°C≈1,0; T=400°C≈0,9; T=500°C≈0,75.\n` +
    `ke (affidabilità): 50%=1,0; 90%=0,897; 95%=0,868; 99%=0,814; 99,9%=0,753.\n\n` +

    `## Concentrazione delle tensioni a fatica\n` +
    `Kf = 1 + q·(Kt-1). q = fattore sensibilità all'intaglio = 1/(1+a/r).\n` +
    `Costante a [mm] dipende da Rm: Rm=400MPa→a=0,42; Rm=600MPa→a=0,21; Rm=800MPa→a=0,145; Rm=1000MPa→a=0,094.\n` +
    `In vantaggio di sicurezza: Kf = Kt.\n\n` +

    `## Verifica a fatica — Diagramma di Haigh\n` +
    `Limite di fatica con tensione media: Se,m = Se·(1 - σm/Rm).\n` +
    `Coefficiente di sicurezza a vita infinita: nf = Se,m/σa ≥ 1,5.\n` +
    `Regola di Miner (danno cumulativo): D = Σ(ni/Ni) ≤ 1.\n\n` +

    `======================================================\n` +
    `SEZIONE 6 — TECNOLOGIA MECCANICA\n` +
    `======================================================\n\n` +

    `## Processi di produzione\n` +
    `Lavorazioni a caldo (migrazione materiale): fonderia (colata in sabbia), stampaggio, forgiatura, laminazione, estrusione.\n` +
    `Lavorazioni a freddo: tranciatura/punzonatura, piegatura, imbutitura, trafilatura.\n` +
    `Saldatura eterogenea (brasatura): fonde solo il metallo d'apporto. Saldatura autogena: fonde anche il metallo base (arco elettrico, laser, TIG, MIG/MAG, a resistenza).\n` +
    `Asportazione di truciolo: tornitura (moto taglio rotatorio pezzo), fresatura (moto taglio rotatorio utensile), trapanatura, rettifica.\n` +
    `Additive manufacturing: massima libertà di forma, scarsa precisione dimensionale, costo unitario elevato, lento.\n\n` +

    `## Fonderia\n` +
    `Processo: modello → forma in sabbia → colata → estrazione getto → sbavatura. Precisione bassa, rugosità elevata. Adatta per forme complesse e serie medio-grandi. Materiali: ghise, bronzi, alluminio, acciaio.\n\n` +

    `## Stampaggio\n` +
    `Deformazione plastica a caldo con stampi. Alta resistenza meccanica (fibra orientata), buona finitura, tolleranze medie. Es.: bielle, ganci, alberi a gomito.\n\n` +

    `## Giunzioni saldate\n` +
    `Tipi: testa a testa (piena penetrazione o con cordone d'angolo), a sovrapposizione, a T, d'angolo.\n` +
    `Verifica cordone d'angolo: σeq = √(σ⊥²+τ⊥²+τ∥²) ≤ fu/(βw·γm). βw: S235=0,80; S275=0,85; S355=0,90. γm=1,25.\n` +
    `Sezione resistente: area di gola a×L. La gola a è il lato del triangolo iscritto nel cordone.\n` +
    `Fatica EN3 — Categorie: testa-testa con sovrametallo=90; piena penetrazione=71; cordone d'angolo=36÷50.\n\n` +

    `======================================================\n` +
    `SEZIONE 7 — MATERIALI\n` +
    `======================================================\n\n` +

    `## Acciai — Classificazione\n` +
    `Acciaio = lega Fe-C con C ≤ 2,06%. Ghisa = lega Fe-C con C > 2,06%.\n` +
    `Acciai non legati (o al carbonio): classificati per Rm (es. S235, S355) o per composizione chimica (es. C45 = 0,45% C).\n` +
    `Acciai legati: contengono Cr, Mo, Ni, V, Mn oltre ai limiti. Migliori proprietà meccaniche e temprabilità.\n` +
    `Acciai inossidabili: ≥10,5% Cr. Austenitici (AISI 304/316): non magnetici, ottima corrosione, non temprabile. Martensitici (AISI 420/440): temprabile, meno resistente a corrosione.\n\n` +

    `## Acciai strutturali\n` +
    `S235JR: Rm=360MPa, Re=235MPa, A=22%. S275JR: Rm=430MPa, Re=275MPa. S355JR: Rm=510MPa, Re=355MPa. Buona saldabilità. Uso: strutture saldate, carpenteria, telai.\n\n` +

    `## Acciai da bonifica (costruzione di macchine)\n` +
    `C25: Rm=490÷690, Re=305÷360. C40: Rm=590÷840, Re=370÷490. C45: Rm=640÷870, Re=410÷510 MPa.\n` +
    `41Cr4: Rm=740÷1130, Re=540÷735. 42CrMo4: Rm=740÷1230, Re=510÷835. 39NiCrMo3: Rm=900÷1000, Re=700÷800 MPa.\n` +
    `Bonifica = tempra + rinvenimento → struttura bainitica/martensitica rinvenuta, alta Re, buona tenacità.\n\n` +

    `## Acciai da cementazione\n` +
    `16MnCr5, 16NiCr4: superficie dura (58÷62 HRC) dopo cementazione + tempra, cuore tenace. Uso: ingranaggi, perni.\n\n` +

    `## Acciai automatici\n` +
    `11SMn37, 11SMnPb37 (con piombo), ETG100, 36SMnPb14: alta lavorabilità alle macchine utensili. Scarsa saldabilità e fatica. Uso: minuterie tornite.\n\n` +

    `## Ghise\n` +
    `GJL (grigia lamellare): grafite in lamelle, fragile, ottimo smorzamento vibrazioni, buona lavorabilità.\n` +
    `GJL-200: Rm=200MPa. GJL-250: Rm=250MPa. GJL-300: Rm=300MPa. Scarsa saldabilità.\n` +
    `GJS (sferoidale/nodulare): grafite in sfere, duttile, tenace. GJS-400-15: Rm=400MPa, A=15%. GJS-500-7: Rm=500MPa, A=7%.\n` +
    `Uso ghise: basamenti, carter, corpi macchina, supporti, pulegge.\n\n` +

    `## Leghe di alluminio\n` +
    `E ≈ 70000 MPa (≈1/3 dell'acciaio). Densità ≈ 2700 kg/m³ (1/3 dell'acciaio → alta resistenza specifica).\n` +
    `6082-T6: Rm=310MPa, Re=260MPa. Buona saldabilità e corrosione. Uso generale.\n` +
    `7075-T6: Rm=540MPa, Re=480MPa. Alta resistenza, scarsa saldabilità. Uso aeronautica, racing.\n` +
    `6061-T6: Rm=290MPa, Re=240MPa. Equilibrio generale. 2011-T3: ottima lavorabilità, scarsa saldabilità.\n` +
    `Trattamenti: anodizzazione (protezione), T6 (invecchiamento artificiale per massima resistenza).\n\n` +

    `## Leghe di titanio\n` +
    `Ottima resistenza a corrosione, alta resistenza specifica (Rm/ρ). E ≈ 110000 MPa.\n` +
    `Ti-6Al-4V (Grado 5): Rm≈900MPa, Re≈830MPa. Uso: aeronautica, biomedicale, racing. Lavorabilità difficile, costo elevato.\n\n` +

    `## Polimeri e compositi\n` +
    `Termoplastici (PA66, POM, PTFE, PVC): si fondono al calore, riciclabili. Termoindurenti (epossidici, poliuretano): indurimento irreversibile.\n` +
    `PA66 (Nylon): Rm≈80MPa, buona resistenza ad usura, assorbe umidità. POM (acetalico): Rm≈65MPa, basso attrito, alta stabilità dimensionale. PTFE: Rm≈25MPa, bassissimo attrito, resistenza chimica eccellente.\n` +
    `CFRP (fibra di carbonio): Rm≈600MPa, leggerissimo, anisotropo, non saldabile. Uso strutture leggere ad alta rigidezza.\n\n` +

    `## Ceramiche tecniche\n` +
    `Legami covalenti/ionici. Alta durezza, fragilità, resistenza ad alta temperatura. Allumina (Al2O3), nitruro di silicio (Si3N4), carburo di silicio (SiC). Uso: cuscinetti ceramici, utensili da taglio, rivestimenti.\n\n` +

    `======================================================\n` +
    `SEZIONE 8 — TRASMISSIONI DI POTENZA\n` +
    `======================================================\n\n` +

    `## Relazioni generali\n` +
    `P[kW] = Mt[Nm]·n[giri/min]/9550. Mt[Nm] = 9550·P[kW]/n. ω[rad/s] = 2π·n[giri/min]/60.\n` +
    `Rapporto di trasmissione: i = n1/n2 = z2/z1 = D2/D1.\n\n` +

    `## Ingranaggi cilindrici denti dritti\n` +
    `Modulo: m = dp/z (dp=diam. primitivo, z=num. denti). Angolo pressione standard φ=20°.\n` +
    `Geometria: de = dp+2m; df = dp-7/3·m; ha=m (addendum); hd=7/6·m (dedendum).\n` +
    `Moduli unificati UNI [mm]: 1; 1,25; 1,5; 2; 2,5; 3; 4; 5; 6; 8; 10; 12; 16; 20.\n` +
    `Lewis: m = ∛[2·Mt/(λ·Y·z·k)]. λ=b/m≈10. k=k0·5,6/(5,6+v) [v in m/s].\n` +
    `Y Lewis (φ=20°): z=12→0,245; z=17→0,302; z=20→0,320; z=30→0,358; z=50→0,408; z=∞→0,484.\n` +
    `Materiali ruote dentate: k0 acciaio bonificato≈160÷220 N/mm²; acciaio cementato k0≈200÷300 N/mm².\n` +
    `Verifica pressione fianco: σH = k'·(2Mt/b·dp²)·(1+zmin/zmag) ≤ p0. p0: acciaio bonificato≈500÷650 MPa; cementato≈1200÷1400 MPa.\n\n` +

    `## Ingranaggi denti elicoidali\n` +
    `Modulo normale mn = mf·cosψ (ψ=angolo elica). z_equivalente = z/cos³ψ (per Lewis).\n` +
    `Lewis: mn = ∛[2·Mt·cosψ/(λ·Y·z·k)]. Forza assiale: Wa = Wt·tanψ.\n\n` +

    `## Cinghie trapezoidali\n` +
    `Lunghezza: Lp ≈ 2C+π(D+d)/2+(D-d)²/(4C). Angolo avvolgimento piccola puleggia: θ = π-(D-d)/C.\n` +
    `Tiri: F1-F2 = 2Mt/d. F1·(1-e^(-f·θ)) = F2·(e^(f·θ)-1). Fcentrifuga = m·v².\n` +
    `Sezioni: A(13×8mm, 0,15÷7,5kW, dmin=75mm); B(17×11mm, 0,75÷19kW, dmin=125mm);\n` +
    `C(22×14mm, 11÷75kW, dmin=220mm); D(32×20mm, 37÷186kW, dmin=330mm).\n` +
    `f_efficace trapezoidale ≈ 0,44 (per φ=40°, f=0,15).\n\n` +

    `## Bulloni e collegamenti filettati\n` +
    `Classi: 4.6(Rm=400,Re=240); 5.6(500/300); 6.6(600/360); 8.8(800/640); 10.9(1000/900) [MPa].\n` +
    `A_res [mm²]: M6=20,1; M8=36,6; M10=58; M12=84; M16=157; M20=245; M24=353; M30=561.\n` +
    `Forza precarico: Fp = 0,8·fy·Ares (UNI). Coppia serraggio: Ts = 0,2·Fp·d.\n` +
    `Taglio: Fv,R = 0,6·fu·Ares/γm. Trazione: FT,R = 0,9·Ares·fu/γm. γm=1,25.\n` +
    `Rifollamento: Fb,R = 2,5·fu·d·t/γm.\n\n` +

    `## Linguette\n` +
    `τ = 2T/(w·L·D·n). Pressione contatto: p = 4T/(h·L·D·n) ≤ pam.\n` +
    `pam acciaio bonifica: 100÷150 MPa. pam ghisa GJL: 40÷70 MPa.\n` +
    `Linguette unificate UNI: dimensioni w×h per diametri albero da 6 a 500 mm.\n\n` +

    `## Accoppiamento forzato (interferenza)\n` +
    `Coppia trasmissibile: Mt = μ·p·π·D²·L/2. Pressione minima: pmin ≈ 2T/(π·D²·L·μ).\n` +
    `μ acciaio-acciaio: ≈0,15 unto; ≈0,20 secco.\n\n` +

    `## Contatti hertziani\n` +
    `Cilindro su piano: b = √(2·P·C/(π·L)); p_max = 4P/(π·2b·L); σGuest,max = 0,801·pmax a z0=0,489b.\n` +
    `Sfera su piano: a = ∛(3·P·d·C/8); pmax = 1,5·P/(π·a²); σGuest,max = 0,982·pmax.\n` +
    `C = (1-ν1²)/E1 + (1-ν2²)/E2. Materiali uguali: C = 2(1-ν²)/E.\n\n` +

    `## Tolleranze e accoppiamenti ISO 286\n` +
    `Sede cuscinetto foro: H7. Sede cuscinetto albero rotante carico fisso: k6/m6. Albero con carico rotante: p6/n6.\n` +
    `Accoppiamento scorrevole: H7/f7 o H7/g6. Accoppiamento fisso: H7/s6. Accoppiamento leggero: H7/n6.\n` +
    `Ra raccomandate: superfici grezze 12,5÷25μm; lavorate generiche 3,2÷6,3μm; sedi cuscinetti/tenute 0,8÷1,6μm; O-ring 0,4÷0,8μm; rettificate precisione 0,1÷0,4μm.\n\n` +

    `======================================================\n` +
    `SEZIONE 9 — OLEOIDRAULICA E AUTOMAZIONE A FLUIDO\n` +
    `======================================================\n\n` +

    `## Fluidi oleoidraulici (ISO 6743-4)\n` +
    `Oli minerali: HH (base), HL (antiruggine+antiossidante), HM/HLP (antiusura — uso più comune), HV (alto indice viscosità per temperature variabili).\n` +
    `Fluidi resistenti alla fiamma: HFA (emulsione olio in acqua ≥80% acqua), HFB (emulsione acqua in olio ≥40% acqua), HFC (glicoli in acqua), HFD (sintetici senza acqua).\n` +
    `Proprietà chiave: viscosità cinematica (cSt = mm²/s), indice di viscosità (VI), punto di scorrimento, punto di infiammabilità, incomprimibilità.\n` +
    `Viscosità tipica a 40°C: ISO VG 32, 46, 68. Classificazione ISO VG = viscosità in cSt a 40°C.\n\n` +

    `## Pompe volumetriche\n` +
    `Principio: camera pompante si espande (aspirazione) → si isola → si comprime (mandata). Portata quasi costante, pressione determinata dal circuito.\n` +
    `Tipi: a ingranaggi (semplici, economiche, rumorose); a palette (silenziose, cilindrata variabile); a pistoni assiali/radiali (alta pressione, alta efficienza, costose).\n` +
    `Relazioni teoriche: Q_th = Vg·n [cm³/giro × giri/min = cm³/min → /1000 = L/min].\n` +
    `η_volumetrico: ηv = Qreale/Qth (perdite per fughe interne) ≈ 0,90÷0,98.\n` +
    `η_idromeccanico: ηhm = Mreale/Mteorico (perdite per attriti) ≈ 0,85÷0,95.\n` +
    `η_totale: ηtot = ηv·ηhm ≈ 0,80÷0,92.\n` +
    `Potenza assorbita: P = Q·Δp/ηtot. Coppia teorica: M_th = Vg·Δp/(2π).\n\n` +

    `## Motori oleoidraulici\n` +
    `Convertono energia idraulica in meccanica (inverso della pompa).\n` +
    `ηv motore: ηv = Qth/Qreale (il motore consuma più del teorico per le fughe).\n` +
    `ηhm motore: ηhm = Mreale/Mth (il momento reale è minore per gli attriti).\n` +
    `Relazioni: Vg·Δp = 2π·Mc,m. Potenza meccanica: Pm = Mc,m·ωm = 2π·Mc,m·n.\n\n` +

    `## Attuatori lineari (cilindri idraulici)\n` +
    `Semplice effetto: forza in un solo senso, ritorno a molla o gravità.\n` +
    `Doppio effetto: forza in entrambe le direzioni.\n` +
    `Sezione pistone: As = π·D²/4. Sezione lato stelo: Ar = π·(D²-d²)/4.\n` +
    `Forza estensione: F = p·As - pret·Ar. Forza retrazione: F = p·Ar - pest·As.\n` +
    `Velocità estensione: v = Q/As. Velocità retrazione: v = Q/Ar.\n` +
    `Portata estensione: Q = As·v. Portata retrazione: Q = Ar·v.\n` +
    `Tipi di fissaggio: a flangia, a piedino, a cerniera, a forcella.\n\n` +

    `## Valvole di controllo della pressione\n` +
    `Valvola limitatrice di pressione (VLP): normalmente chiusa, si apre quando p ≥ p_taratura scaricando il flusso al serbatoio. Protegge il circuito dalla sovrapressione. Azionamento diretto o pilotato (minore isteresi).\n` +
    `Valvola riduttrice di pressione: normalmente aperta, mantiene la pressione a valle a un valore costante inferiore alla pressione di monte.\n\n` +

    `## Valvole di controllo della portata\n` +
    `Regolatrici di portata a 2 bocche: strozzano il flusso (Q ∝ √Δp per orifizi). Influenzate dalla variazione di pressione.\n` +
    `Regolatrici di portata a 3 bocche (con compensatore di pressione): mantengono Q costante indipendentemente da Δp. Più precise.\n\n` +

    `## Valvole direzionali (distributori)\n` +
    `Gestiscono la direzione del flusso verso gli attuatori. Designazione: N/M = N bocche / M posizioni.\n` +
    `4/3: 4 bocche (P, T, A, B), 3 posizioni. Centro aperto: P connesso a T a riposo (scarico). Centro chiuso: tutte le bocche chiuse a riposo.\n` +
    `Azionamento: manuale, meccanico, elettrico (solenoide), pneumatico, idraulico (pilotaggio).\n` +
    `Distributori proporzionali: posizione proporzionale al segnale elettrico di comando → controllo continuo velocità/posizione attuatore.\n\n` +

    `## Circuiti oleoidraulici elementari\n` +
    `Schema energetico: serbatoio → pompa → valvola limitatrice pressione → distributore → attuatore → serbatoio.\n` +
    `Circuito con martinetto semplice effetto: VLP protegge, distributore 4/2 controlla uscita/rientro stelo.\n` +
    `Divisore di flusso: divide la portata in parti uguali per sincronizzare due attuatori.\n` +
    `Equazione di continuità: Q = A1·v1 = A2·v2. Bernoulli: p1/ρg + v1²/2g + z1 = p2/ρg + v2²/2g + z2 + hf.\n` +
    `Hagen-Poiseuille (moto laminare): Δp = 128·μ·L·Q/(π·D⁴). Re = ρ·v·D/μ. Laminare: Re<2300; turbolento: Re>4000.\n` +
    `Pressioni tipiche: bassa ≤50bar; media 50÷200bar; alta 200÷350bar; altissima >350bar.\n\n` +

    `======================================================\n` +
    `SEZIONE 10 — TERMODINAMICA E FISICA TECNICA (UNIMORE)\n` +
    `======================================================\n\n` +

    `## Sistema termodinamico\n` +
    `Sistema chiuso: massa costante, scambia solo energia (Q e L). Sistema aperto (volume di controllo): scambia massa ed energia.\n` +
    `Proprietà termodinamiche: pressione p [Pa o bar], temperatura T [K o °C], volume specifico v = 1/ρ [m³/kg], energia interna u [J/kg], entalpia h = u + p·v [J/kg], entropia s [J/(kg·K)].\n` +
    `Conversioni: 1 bar = 10⁵ Pa = 0,1 MPa; 1 atm = 101325 Pa ≈ 1,013 bar; T[K] = T[°C] + 273,15.\n\n` +

    `## I Principio della Termodinamica\n` +
    `Sistema chiuso: Q - L = ΔU (calore assorbito - lavoro compiuto = variazione energia interna).\n` +
    `Sistema aperto stazionario: Q̇ - Ẇ = ṁ·(Δh + Δv²/2 + g·Δz) (bilancio energetico).\n` +
    `Entalpia: h = u + p·v. Per gas ideale: Δh = cp·ΔT; Δu = cv·ΔT.\n` +
    `Energia totale: E = Ec + Ep + U = ½mv² + mgz + U.\n\n` +

    `## II Principio della Termodinamica\n` +
    `Direzione spontanea dei processi: il calore fluisce spontaneamente dal caldo al freddo.\n` +
    `Macchina termica: Lciclo = QC - QF; rendimento η = L/QC = 1 - QF/QC ≤ ηCarnot = 1 - TF/TC.\n` +
    `Ciclo di Carnot: il più efficiente tra due sorgenti. ηCarnot = 1 - TF/TC (T in Kelvin).\n` +
    `Frigorifero: COP_f = QF/L. Pompa di calore: COP_hp = QC/L.\n` +
    `Entropia: dS = δQ_rev/T. Per processo irreversibile: dS > δQ/T. Sistema isolato: ΔS ≥ 0.\n\n` +

    `## Gas ideali\n` +
    `Equazione di stato: p·V = n·R·T (R=8,314 J/(mol·K)) oppure p·v = Rs·T (Rs=R/M).\n` +
    `Aria: Rs=287 J/(kg·K); cp=1005 J/(kg·K); cv=718 J/(kg·K); γ=cp/cv=1,4.\n` +
    `Trasformazioni: isobara (p=cost): Q=m·cp·ΔT; isocora (V=cost): Q=m·cv·ΔT; isoterma (T=cost): L=p·V·ln(V2/V1); adiabatica: p·V^γ=cost.\n\n` +

    `## Sostanze pure — Vapore\n` +
    `Diagramma p-v-T: zona liquido saturo, zona bifase (liquido+vapore), zona vapore surriscaldato.\n` +
    `Titolo vapore (zona bifase): x = m_vapore/m_totale (0≤x≤1). x=0: liquido saturo; x=1: vapore saturo.\n` +
    `Proprietà miste: h = hf + x·hfg (hf=entalpia liquido saturo; hfg=calore latente di vaporizzazione).\n` +
    `Acqua a 1 atm: T_sat=100°C; hfg≈2257 kJ/kg.\n\n` +

    `## Statica dei fluidi\n` +
    `Equazione dell'idrostatica: dp/dz = -γ (γ=ρ·g = peso specifico [N/m³]).\n` +
    `Distribuzione idrostatica: p = p0 + γ·h (h=profondità).\n` +
    `Pressione assoluta = pressione relativa + pressione atmosferica (patm ≈ 101325 Pa ≈ 1,013 bar).\n` +
    `Spinta di Archimede: FA = γfluido·V_immerso (diretta verso l'alto, applicata al baricentro del volume immerso).\n` +
    `Forza idrostatica su superficie piana: F = p_centroide·A (applicata al centro di pressione, più in basso del centroide).\n\n` +

    `## Equazioni di bilancio per fluidi\n` +
    `Continuità: dm_VC/dt = Σṁ_in - Σṁ_out. Regime stazionario: Σṁ_in = Σṁ_out = ρ·A·v.\n` +
    `Bernoulli (fluido ideale, stazionario): p/(ρg) + v²/(2g) + z = costante.\n` +
    `Bernoulli con perdite: p1/(ρg) + v1²/(2g) + z1 = p2/(ρg) + v2²/(2g) + z2 + hf (hf=perdite di carico).\n` +
    `Viscosità dinamica μ [Pa·s]: acqua a 20°C ≈ 10⁻³ Pa·s; olio idraulico ISO VG 46 a 40°C ≈ 0,046 Pa·s.\n` +
    `Viscosità cinematica ν = μ/ρ [m²/s = 10⁶ cSt].\n\n` +

    `======================================================\n` +
    `SEZIONE 11 — TRASMISSIONE DEL CALORE (UNIMORE)\n` +
    `======================================================\n\n` +

    `## Conduzione (Legge di Fourier)\n` +
    `q'' = -λ·(dT/dx) [W/m²] (flusso termico = conduttività × gradiente di temperatura, segno negativo perché il calore va da caldo a freddo).\n` +
    `Flusso di calore: q = λ·A·ΔT/L [W]. Resistenza termica conduzione: Rt = L/(λ·A) [K/W].\n` +
    `Strato piano stazionario: q = λ·A·(T1-T2)/L.\n` +
    `Guscio cilindrico: q = 2π·L·λ·(Ts1-Ts2)/ln(r2/r1). Resistenza cilindrica: Rt = ln(r2/r1)/(2π·L·λ).\n` +
    `Conduttività λ [W/(m·K)]: acciaio≈50; alluminio≈237; rame≈401; aria≈0,026; acqua≈0,6; PTFE≈0,25; mattone≈0,72.\n\n` +

    `## Convezione (Legge di Newton del raffreddamento)\n` +
    `q'' = h·(Ts-T∞) [W/m²]; q = h·A·(Ts-T∞) [W]. Resistenza termica convezione: Rt = 1/(h·A) [K/W].\n` +
    `h = coefficiente convettivo [W/(m²·K)]: conv. libera gas 2÷25; conv. forzata gas 25÷250; conv. forzata liquidi 50÷20000; ebollizione/condensazione 2500÷100000.\n` +
    `Gruppi adimensionali: Nu = h·L/λ (Nusselt); Re = ρ·v·L/μ (Reynolds); Pr = cp·μ/λ (Prandtl).\n` +
    `Convezione naturale: Gr = g·β·ΔT·L³/ν² (Grashof); Ra = Gr·Pr (Rayleigh).\n` +
    `Convezione forzata (Gr/Re²≪1): Nu = f(Re,Pr). Convezione naturale (Gr/Re²≫1): Nu = f(Gr,Pr) = C·Ra^k.\n\n` +

    `## Irraggiamento (Legge di Stefan-Boltzmann)\n` +
    `E = ε·σ·Ts⁴ [W/m²] (corpo reale). σ = 5,67×10⁻⁸ W/(m²·K⁴). ε = emissività (0<ε<1).\n` +
    `Corpo nero: ε=1, massimo emettitore. Legge di Kirchhoff: ε = α (superficie diffusa).\n` +
    `Bilancio: G = G_riflessa + G_assorbita + G_trasmessa → α+ρ+τ=1. Mezzo opaco: α+ρ=1.\n\n` +

    `## Analogia elettrotermica e circuiti termici\n` +
    `Analogia: flusso di calore q ↔ corrente I; differenza di temperatura ΔT ↔ differenza di tensione ΔV; resistenza termica Rt ↔ resistenza elettrica R.\n` +
    `q = ΔT/Rt (analogo a I = ΔV/R). Resistenze in serie: Rt = ΣRi. Resistenze in parallelo: 1/Rt = Σ(1/Ri).\n` +
    `Trasmittanza termica: U = 1/(Rtot·A) [W/(m²·K)]. q = U·A·ΔT.\n\n` +

    `## Scambiatori di calore\n` +
    `Equazione di potenza: q = U·A·ΔTm. Bilancio energetico: q = ṁc·cp,c·(Tc,i-Tc,u) = ṁf·cp,f·(Tf,u-Tf,i).\n` +
    `LMTD (differenza media logaritmica): ΔTml = (ΔT1-ΔT2)/ln(ΔT1/ΔT2).\n` +
    `Equicorrente: ΔT1=Tc,i-Tf,i; ΔT2=Tc,u-Tf,u. Temperatura uscita freddo ≤ temperatura uscita caldo.\n` +
    `Controcorrente: ΔT1=Tc,i-Tf,u; ΔT2=Tc,u-Tf,i. Più efficiente: LMTD_CC > LMTD_EC.\n` +
    `Metodo ε-NTU: ε = Q_reale/Q_max = f(Cr, NTU). NTU = U·A/Cmin. Cr = Cmin/Cmax. Cmin/max = ṁ·cp,min/max.\n\n`,
},
            ...cleanHistory,
            {
              role: "user",
              content: finalUserContent,
            },
          ],
          temperature: 0.4,
          max_tokens: 1200,
        }),
      },
      18000
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout Groq.\n\n" +
        "Il modello testuale non ha risposto entro il limite impostato.\n\n" +
        "Prova a usare questo modello nelle variabili ambiente:\n\n" +
        "```env\n" +
        "GROQ_MODEL=llama-3.1-8b-instant\n" +
        "```"
      );
    }

    throw error;
  }

  const raw = await response.text();
  const data = safeJsonParse<any>(raw, null);

  if (!response.ok) {
    return (
      "⚠️ Il backend ha chiamato Groq, ma Groq ha restituito un errore.\n\n" +
      `Modello usato: ${groqModel}\n` +
      `Codice: ${response.status}\n\n` +
      `Dettaglio: ${raw || "nessun dettaglio ricevuto"}`
    );
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "Ho ricevuto la richiesta, ma Groq non ha restituito una risposta valida."
  );
}

async function callOpenRouterVision(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  imageDataUrl: string;
  fileMeta: string;
}) {
  const openRouterKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini";

  if (!openRouterKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave OpenRouter per analizzare immagini/tavole.\n\n" +
      "Su Vercel aggiungi queste variabili ambiente:\n\n" +
      "```env\n" +
      "OPENROUTER_API_KEY=la_tua_chiave_openrouter\n" +
      "OPENROUTER_VISION_MODEL=openai/gpt-4o-mini\n" +
      "```\n\n" +
      "Poi fai Redeploy del progetto."
    );
  }

  const userName = params.profile?.userName || "Utente";
  const focus = params.profile?.focus || "Ingegneria Meccanica";

  const prompt =
    `${params.message || "Analizza questa tavola tecnica meccanica con la massima precisione."}\n\n` +
    `${params.fileMeta ? `${params.fileMeta}\n` : ""}`;

  let response: Response;

  try {
    response = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${openRouterKey}`,
          "HTTP-Referer": "https://project-exdwv.vercel.app",
          "X-Title": "TechAI Metallurgy Copilot",
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: "system",
              content:
                `Sei TechAI Vision, un ingegnere meccanico senior specializzato in disegno tecnico secondo norme ISO 128, ISO 1101, ISO 286 e ISO 1302. ` +
                `Utente: ${userName}. Settore: ${focus}. ` +
                "Il tuo compito è analizzare tavole tecniche meccaniche con la MASSIMA PRECISIONE. " +
                "REGOLE FONDAMENTALI: " +
                "(1) Leggi e cita OGNI valore numerico visibile nella tavola: quote, tolleranze, rugosità Ra/Rz, designazioni filetti, scale. " +
                "(2) NON inventare mai valori: se un numero non è leggibile, scrivi esplicitamente 'non leggibile' o 'non visibile'. " +
                "(3) Identifica errori reali e specifici, non generici. Cita la posizione, per esempio 'quota in alto a destra' o 'vista frontale'. " +
                "(4) Verifica la coerenza interna: le quote si sommano correttamente? Le tolleranze sono compatibili con la lavorazione indicata? " +
                "(5) Controlla sempre: cartiglio completo, numero di viste sufficiente, catena di quote chiusa, datum per GD&T, rugosità su superfici funzionali. " +
                "Rispondi in italiano tecnico preciso.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: prompt,
                },
                {
                  type: "image_url",
                  image_url: {
                    url: params.imageDataUrl,
                  },
                },
              ],
            },
          ],
          temperature: 0.2,
          max_tokens: 1200,
        }),
      },
      18000
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout OpenRouter durante l'analisi immagine.\n\n" +
        `Modello usato: ${model}\n\n` +
        "La funzione ha interrotto la chiamata prima del timeout di Vercel.\n\n" +
        "Controlla che `OPENROUTER_VISION_MODEL` sia un modello vision reale, ad esempio:\n\n" +
        "```env\n" +
        "OPENROUTER_VISION_MODEL=openai/gpt-4o-mini\n" +
        "```"
      );
    }

    throw error;
  }

  const raw = await response.text();
  const data = safeJsonParse<any>(raw, null);

  if (!response.ok) {
    return (
      "⚠️ OpenRouter ha restituito un errore durante l'analisi immagine.\n\n" +
      `Modello usato: ${model}\n` +
      `Codice: ${response.status}\n\n` +
      `Dettaglio: ${raw || "nessun dettaglio ricevuto"}\n\n` +
      "Controlla che la chiave OpenRouter sia valida e che il modello scelto supporti immagini."
    );
  }

  return (
    data?.choices?.[0]?.message?.content ||
    "Ho ricevuto l'immagine, ma OpenRouter non ha restituito una risposta valida."
  );
}

async function checkAuthAndRateLimit(
  req: Request,
  usageRequest: { hasFile: boolean }
): Promise<AuthResult> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return {
      ok: false,
      response: jsonResponse({ error: "Supabase server non configurato." }, 500),
    };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const authHeader = req.headers.get("authorization");
  const guestId = req.headers.get("x-guest-id");

  if (!authHeader && guestId) {
    const cleanGuestId = guestId.trim();

    if (!cleanGuestId || cleanGuestId.length < 8 || cleanGuestId.length > 120) {
      return {
        ok: false,
        response: jsonResponse({ error: "Guest ID non valido." }, 400),
      };
    }

    const { data: existingGuest, error: selectError } = await supabase
      .from("guest_usage")
      .select("guest_id, ai_requests_used, ai_requests_limit, file_uploads_used, file_uploads_limit, window_started_at")
      .eq("guest_id", cleanGuestId)
      .maybeSingle();

    if (selectError) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Errore controllo limite ospite.",
            detail: selectError.message,
          },
          500
        ),
      };
    }

    const nowIso = new Date().toISOString();

    if (!existingGuest) {
      const { error: insertError } = await supabase
        .from("guest_usage")
        .insert({
          guest_id: cleanGuestId,
          ai_requests_used: 0,
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_used: 0,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          window_started_at: nowIso,
          updated_at: nowIso,
        });

      if (insertError) {
        return {
          ok: false,
          response: jsonResponse(
            {
              error: "Errore creazione profilo ospite.",
              detail: insertError.message,
            },
            500
          ),
        };
      }

      return {
        ok: true,
        mode: "guest",
        guestId: cleanGuestId,
        supabase,
        usage: {
          used: 0,
          limit: GUEST_TEXT_LIMIT_24H,
          fileUsed: 0,
          fileLimit: GUEST_FILE_LIMIT_24H,
          windowStartedAt: nowIso,
        },
      };
    }

    let used = Number(existingGuest.ai_requests_used || 0);
    let limit = Number(existingGuest.ai_requests_limit || GUEST_TEXT_LIMIT_24H);
    let fileUsed = Number(existingGuest.file_uploads_used || 0);
    let fileLimit = Number(existingGuest.file_uploads_limit || GUEST_FILE_LIMIT_24H);
    let windowStartedAt = String(existingGuest.window_started_at || nowIso);

    if (isOlderThan24Hours(windowStartedAt)) {
      used = 0;
      limit = GUEST_TEXT_LIMIT_24H;
      fileUsed = 0;
      fileLimit = GUEST_FILE_LIMIT_24H;
      windowStartedAt = nowIso;

      const { error: resetError } = await supabase
        .from("guest_usage")
        .update({
          ai_requests_used: 0,
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_used: 0,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          window_started_at: nowIso,
          updated_at: nowIso,
        })
        .eq("guest_id", cleanGuestId);

      if (resetError) {
        return {
          ok: false,
          response: jsonResponse(
            {
              error: "Errore reset limite ospite.",
              detail: resetError.message,
            },
            500
          ),
        };
      }
    } else if (limit !== GUEST_TEXT_LIMIT_24H || fileLimit !== GUEST_FILE_LIMIT_24H) {
      limit = GUEST_TEXT_LIMIT_24H;
      fileLimit = GUEST_FILE_LIMIT_24H;

      await supabase
        .from("guest_usage")
        .update({
          ai_requests_limit: GUEST_TEXT_LIMIT_24H,
          file_uploads_limit: GUEST_FILE_LIMIT_24H,
          updated_at: nowIso,
        })
        .eq("guest_id", cleanGuestId);
    }

    if (used >= limit) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Limite ospite raggiunto",
            used,
            limit,
            fileUsed,
            fileLimit,
            resetAfterHours: GUEST_WINDOW_HOURS,
          },
          403
        ),
      };
    }

    if (usageRequest.hasFile && fileUsed >= fileLimit) {
      return {
        ok: false,
        response: jsonResponse(
          {
            error: "Limite file ospite raggiunto",
            used,
            limit,
            fileUsed,
            fileLimit,
            resetAfterHours: GUEST_WINDOW_HOURS,
          },
          403
        ),
      };
    }

    return {
      ok: true,
      mode: "guest",
      guestId: cleanGuestId,
      supabase,
      usage: {
        used,
        limit,
        fileUsed,
        fileLimit,
        windowStartedAt,
      },
    };
  }

  if (!authHeader) {
    return {
      ok: false,
      response: jsonResponse({ error: "Token mancante. Effettua il login oppure entra come ospite." }, 401),
    };
  }

  const token = authHeader.replace("Bearer ", "").trim();

  if (!token) {
    return {
      ok: false,
      response: jsonResponse({ error: "Token non valido." }, 401),
    };
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return {
      ok: false,
      response: jsonResponse({ error: "Sessione non valida. Effettua di nuovo il login." }, 401),
    };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, plan, ai_requests_used, ai_requests_limit")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return {
      ok: false,
      response: jsonResponse({ error: "Profilo utente non trovato." }, 404),
    };
  }

  if (profile.ai_requests_used >= profile.ai_requests_limit) {
    return {
      ok: false,
      response: jsonResponse(
        {
          error: "Limite AI raggiunto",
          plan: profile.plan,
          used: profile.ai_requests_used,
          limit: profile.ai_requests_limit,
        },
        403
      ),
    };
  }

  return {
    ok: true,
    mode: "user",
    userId: user.id,
    supabase,
  };
}

async function incrementUserUsage(supabase: any, userId: string) {
  if (!userId || !supabase) return;

  const { data, error: readError } = await supabase
    .from("profiles")
    .select("ai_requests_used, ai_requests_limit")
    .eq("id", userId)
    .single();

  if (readError || !data) {
    console.error("Errore lettura usage utente:", readError);
    return;
  }

  const profile = data as { ai_requests_used: number; ai_requests_limit: number };

  const { error: updateError } = await supabase
    .from("profiles")
    .update({ ai_requests_used: profile.ai_requests_used + 1 })
    .eq("id", userId);

  if (updateError) {
    console.error("Errore update usage utente:", updateError);
  }
}

async function incrementGuestUsage(supabase: any, guestId: string, hasFile: boolean) {
  if (!guestId || !supabase) {
    return {
      used: 0,
      limit: GUEST_TEXT_LIMIT_24H,
      fileUsed: 0,
      fileLimit: GUEST_FILE_LIMIT_24H,
      windowStartedAt: new Date().toISOString(),
    };
  }

  const { data, error: readError } = await supabase
    .from("guest_usage")
    .select("ai_requests_used, ai_requests_limit, file_uploads_used, file_uploads_limit, window_started_at")
    .eq("guest_id", guestId)
    .single();

  if (readError || !data) {
    console.error("Errore lettura usage ospite:", readError);
    return {
      used: 0,
      limit: GUEST_TEXT_LIMIT_24H,
      fileUsed: 0,
      fileLimit: GUEST_FILE_LIMIT_24H,
      windowStartedAt: new Date().toISOString(),
    };
  }

  const used = Number(data.ai_requests_used || 0) + 1;
  const fileUsed = Number(data.file_uploads_used || 0) + (hasFile ? 1 : 0);
  const limit = Number(data.ai_requests_limit || GUEST_TEXT_LIMIT_24H);
  const fileLimit = Number(data.file_uploads_limit || GUEST_FILE_LIMIT_24H);
  const windowStartedAt = String(data.window_started_at || new Date().toISOString());

  const { error: updateError } = await supabase
    .from("guest_usage")
    .update({
      ai_requests_used: used,
      file_uploads_used: fileUsed,
      updated_at: new Date().toISOString(),
    })
    .eq("guest_id", guestId);

  if (updateError) {
    console.error("Errore update usage ospite:", updateError);
  }

  return {
    used,
    limit,
    fileUsed,
    fileLimit,
    windowStartedAt,
  };
}

export default async function handler(req: Request) {
  if (req.method === "GET") {
    return jsonResponse({
      ok: true,
      message: "API /api/chat funzionante",
      env: {
        hasGroqKey: Boolean(process.env.GROQ_API_KEY),
        groqModel: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        hasOpenRouterKey: Boolean(process.env.OPENROUTER_API_KEY),
        openRouterVisionModel: process.env.OPENROUTER_VISION_MODEL || "openai/gpt-4o-mini",
        hasSupabase: Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY),
        guestTextLimit24h: GUEST_TEXT_LIMIT_24H,
        guestFileLimit24h: GUEST_FILE_LIMIT_24H,
        guestWindowHours: GUEST_WINDOW_HOURS,
      },
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo non consentito. Usa POST." }, 405);
  }

  try {
    const body = await readRequestBody(req);

    const auth = await checkAuthAndRateLimit(req, {
      hasFile: body.hasFile,
    });

    if (!auth.ok) {
      return auth.response;
    }

    const answer = body.imageDataUrl
      ? await callOpenRouterVision({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          imageDataUrl: body.imageDataUrl,
          fileMeta: body.fileMeta,
        })
      : await callGroqText({
          message: body.message,
          messages: body.messages,
          profile: body.profile,
          fileText: body.fileText,
        });

    let usage: any = null;

    if (auth.mode === "user") {
      await incrementUserUsage(auth.supabase, auth.userId);
    } else {
      usage = await incrementGuestUsage(auth.supabase, auth.guestId, body.hasFile);
    }

    return jsonResponse({
      answer,
      mode: auth.mode,
      usage,
    });
  } catch (error: any) {
    return jsonResponse(
      {
        answer:
          "⚠️ Errore interno nella rotta `/api/chat`.\n\n" +
          `Dettaglio tecnico: ${error?.message || "errore sconosciuto"}`,
      },
      500
    );
  }
}
