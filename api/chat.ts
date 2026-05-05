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

type ModelRoute = {
  level: "fast" | "medium" | "hard";
  model: string;
  maxTokens: number;
  timeoutMs: number;
  reason: string;
};

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

function chooseGroqModel(params: {
  message: string;
  messages: ChatMessage[];
  fileText: string;
}): ModelRoute {
  const message = String(params.message || "");
  const fileText = String(params.fileText || "");
  const historyText = Array.isArray(params.messages)
    ? params.messages.map(m => String(m.text || "")).join("\n")
    : "";

  const fullText = `${message}\n${fileText}\n${historyText}`.toLowerCase();

  const fastModel =
    process.env.GROQ_MODEL_FAST ||
    process.env.GROQ_MODEL ||
    "llama-3.1-8b-instant";

  const mediumModel =
    process.env.GROQ_MODEL_MEDIUM ||
    process.env.GROQ_MODEL ||
    fastModel;

  const hardModel =
    process.env.GROQ_MODEL_HARD ||
    process.env.GROQ_MODEL_MEDIUM ||
    process.env.GROQ_MODEL ||
    mediumModel;

  let score = 0;
  const reasons: string[] = [];

  if (fileText.trim().length > 0) {
    score += 4;
    reasons.push("file allegato");
  }

  if (message.length > 1000) {
    score += 2;
    reasons.push("prompt lungo");
  }

  if (fullText.length > 6000) {
    score += 3;
    reasons.push("contesto molto lungo");
  }

  if (
    /errore|error|build|typescript|react|vite|vercel|supabase|api\/chat|codice|script|tsx|ts|javascript|funzione|debug|console|runtime|deploy|backend|frontend/i.test(fullText)
  ) {
    score += 3;
    reasons.push("codice/debug");
  }

  if (
    /calcola|verifica|dimensiona|flessione|torsione|taglio|von mises|tresca|fatica|coefficiente|momento|tensione|formula|meccanica|albero|perno|cuscinetto|linguetta|bullone/i.test(fullText)
  ) {
    score += 2;
    reasons.push("calcolo tecnico");
  }

  if (
    /tavola|disegno tecnico|rugosità|rugosita|tolleranza|gd&t|quota|sezione|cartiglio|materiale|acciaio|c45|42crmo4|aisi|inventor|solidworks/i.test(fullText)
  ) {
    score += 2;
    reasons.push("argomento tecnico");
  }

  if (
    /riassumi|spiega|confronta|analizza|migliora|riscrivi|ottimizza|progetta|scrivimi completo|copia e incolla/i.test(fullText)
  ) {
    score += 1;
    reasons.push("richiesta articolata");
  }

  if (message.length < 180 && score <= 1) {
    return {
      level: "fast",
      model: fastModel,
      maxTokens: 650,
      timeoutMs: 14000,
      reason: "domanda breve/semplice",
    };
  }

  if (score >= 5) {
    return {
      level: "hard",
      model: hardModel,
      maxTokens: 1800,
      timeoutMs: 22000,
      reason: reasons.join(", ") || "richiesta complessa",
    };
  }

  return {
    level: "medium",
    model: mediumModel,
    maxTokens: 1200,
    timeoutMs: 18000,
    reason: reasons.join(", ") || "richiesta media",
  };
}

function buildTechAiSystemPrompt(params: {
  userName: string;
  focus: string;
  route: ModelRoute;
}) {
  const { userName, focus, route } = params;

  return (
    `Sei TechAI, copilot tecnico per ingegneria meccanica industriale. Utente: ${userName}. Focus: ${focus}.\n` +
    `Modello selezionato automaticamente: ${route.level}. Motivo scelta: ${route.reason}.\n` +
    `Rispondi nella lingua in cui ti viene posta la domanda. Utilizza pochi giri di parole e sii diretto ma esaustivo e completo. Sii tecnico, preciso, ordinato e pratico.\n` +
    `Quando si parla di specifiche dei componenti, rispondi in maniera tecnica e, quando opportuno, scrivi: "fare riferimento a normativa: ...".\n` +
    `Usa Markdown e notazione chiara per formule. Cita sempre le unità di misura. Se mancano dati, chiedi e non inventare. Puoi utilizzare emoji in maniera limitata.\n` +
    `Se la richiesta riguarda codice, dai modifiche precise, copiabili e complete quando l'utente lo chiede. Se chiede un file completo, riscrivi il file completo.\n\n` +

    `## MECCANICA BASE E STATICA\n` +
    `Newton: F=ma. Equilibrio: ΣF=0, ΣM=0. Gdl piano: 3 (2 traslazioni+1 rotazione). Spazio: 6. Isostatica=vincoli necessari e sufficienti.\n` +
    `Cinematica: MRU s=v·t; MRUA v=v0+at, s=v0t+½at², v²=v0²+2as. Caduta libera g=9,81m/s².\n` +
    `Moto circolare: v=ω·r; ac=v²/r=ω²r; ω=2πn/60. Energia cinetica Ec=½mv². Potenziale Ep=mgz.\n` +
    `Momento inerzia: I=Σmi·ri². Huygens-Steiner: I=Icm+Mh². Dinamica rotaz.: M=I·α. Ec_rot=½Iω².\n` +
    `Lavoro: L=F·s·cosθ. Potenza: P=F·v=M·ω. P[kW]=Mt[Nm]·n[giri/min]/9550.\n\n` +

    `## SOLLECITAZIONI E SCIENZA DELLE COSTRUZIONI\n` +
    `E acciaio=206000MPa; E alluminio=70000MPa; E ghisa=100000MPa; ν acciaio=0,3; G acciaio=79000MPa.\n` +
    `Trazione: σ=F/A; ε=ΔL/L0; σ=E·ε; ΔL=FL/(EA). Deformazione trasversale: εt=-ν·ε.\n` +
    `Flessione (Navier): σ=Mf·y/Jf; σmax=Mf/Wf. Sez.circolare: Jf=πd⁴/64; Wf=πd³/32. Sez.rettang. b×h: Jf=bh³/12; Wf=bh²/6. Sez.cava D,d: Jf=π(D⁴-d⁴)/64; Wf=π(D⁴-d⁴)/(32D).\n` +
    `Torsione: τ=Mt·r/Jp; τmax=Mt/Wt. Sez.circolare: Jp=πd⁴/32; Wt=πd³/16. θ=Mt·L/(G·Jp). Limite: θ≤0,0044rad/m.\n` +
    `Taglio: τmedio=T/A. Sez.circolare: τmax=4T/(3A). Sez.rett.: τmax=3T/(2bh).\n` +
    `Frecce travi: appoggiata+carico centrale f=FL³/(48EJ); appoggiata+q_distrib f=5qL⁴/(384EJ); mensola+F f=FL³/(3EJ); mensola+q f=qL⁴/(8EJ). Carico in C (bracci a,b): fC=Fa²b²/(3EJL).\n` +
    `Travi incastrate: R_A=5qL/8, R_B=3qL/8, M_A=qL²/8 (incastro-appoggio+q). Doppio incastro+q: M_incastri=qL²/12; M_mezzeria=qL²/24.\n` +
    `Proprietà materiale dalla prova di trazione: Rm(rottura), Re/Rp0.2(snervamento), A%(duttilità), tenacità=area sotto curva σ-ε, resilienza=σe²/(2E).\n\n` +

    `## CONDIZIONE DI RESISTENZA E CRITERI\n` +
    `σe≤σam=σcr/n. n: statico 1,5÷2; variabile 2÷3; dinamico 3÷5. c(servizio): uniforme 1÷1,25; variabile 1,5÷2,5.\n` +
    `Von Mises (duttili): σid=√(σ²+3τ²)≤σam. Alberi: σid=√(σf²+3τt²); Mid=√(Mf²+¾Mt²); σid=Mid/Wf.\n` +
    `Tresca (duttili): σid=σ1-σ3; piano: σid=√(σ²+4τ²). Rankine (fragili): σid=σ1.\n` +
    `Mohr: σ1,2=(σx+σy)/2±√[((σx-σy)/2)²+τxy²]; τmax=√[((σx-σy)/2)²+τxy²].\n` +
    `Concentrazione tensioni: Kt da grafici; Kf=1+q(Kt-1); q=1/(1+a/r). a[mm]: Rm=600→0,21; Rm=800→0,145; Rm=1000→0,094.\n` +
    `Dim.statico albero: d≥∛(32·Mid/(π·σam)). Freccia max: L/2000 (comune); L/5000 (utensili). θmax sede cuscinetto sfere: 0,003rad; rulli: 0,0009rad.\n\n` +

    `## FATICA\n` +
    `σm=(σmax+σmin)/2; σa=(σmax-σmin)/2; R=σmin/σmax. Alterno simm.: σm=0,R=-1. Pulsante: R=0.\n` +
    `Se≈0,5Rm (acciaio). Se=ka·kb·kc·kd·ke·S'e. ka(rugosità): lucido=1,0; lavorato≈0,7÷0,8. kb(dim): d<8mm→1; d=8÷50mm→0,85÷0,9. kc: flessione=1; trazione=0,85; torsione=0,59. ke: 90%→0,897; 99%→0,814.\n` +
    `Haigh: Se,m=Se·(1-σm/Rm). nf=Se,m/σa≥1,5. Miner: D=Σ(ni/Ni)≤1.\n\n` +

    `## TECNOLOGIA MECCANICA\n` +
    `Lavorazioni: fonderia (colata sabbia, bassa precisione); stampaggio a caldo (alta resistenza meccanica); tranciatura/piegatura/imbutitura (lamiera a freddo); tornitura (moto taglio rotatorio pezzo); fresatura (moto taglio rotatorio utensile); rettifica (alta precisione).\n` +
    `Saldatura autogena: fonde metallo base (arco elettrico MIG/MAG/TIG/elettrodo rivestito, laser, a resistenza). Eterogenea (brasatura): fonde solo metallo d'apporto.\n` +
    `Giunti saldati: testa-testa (piena penetrazione), d'angolo, a T, sovrapposizione.\n` +
    `Cordone d'angolo: σeq=√(σ⊥²+τ⊥²+τ∥²)≤fu/(βw·γm). βw: S235=0,80; S275=0,85; S355=0,90. γm=1,25. Fatica EN3: giunto testa-testa=cat.71÷90; cordone angolo=cat.36÷50.\n` +
    `Additive manufacturing: libertà di forma totale, bassa precisione, costo unitario alto.\n\n` +

    `## MATERIALI\n` +
    `Acciaio=Fe-C con C≤2,06%; Ghisa=Fe-C con C>2,06%.\n` +
    `Strutturali: S235(Rm=360,Re=235); S275(Rm=430,Re=275); S355(Rm=510,Re=355) MPa. Buona saldabilità.\n` +
    `Bonifica: C45(640÷870/410÷510); 41Cr4(740÷1130/540÷735); 42CrMo4(740÷1230/510÷835); 39NiCrMo3(900÷1000/700÷800) [Rm/Re MPa].\n` +
    `Cementazione (superficie dura 58÷62HRC, cuore tenace): 16MnCr5, 16NiCr4. Automatici (alta lavorabilità): 11SMn37, ETG100.\n` +
    `Inox austenitici (non magnetici, non temprabile): AISI304(EN1.4301,Rm=520,Re=210); AISI316L(Rm=500,Re=200) MPa. Inox martensitici (temprabile): AISI420, AISI440C.\n` +
    `Ghise GJL (grigia lamellare, fragile, buon smorzamento): GJL-200(Rm=200); GJL-250(Rm=250); GJL-300(Rm=300). GJS (sferoidale, duttile): GJS-400-15(Rm=400,A=15%); GJS-500-7(Rm=500,A=7%) MPa.\n` +
    `Alluminio (E=70000MPa, ρ=2700kg/m³): 6082-T6(Rm=310,Re=260); 7075-T6(Rm=540,Re=480); 6061-T6(Rm=290,Re=240) MPa.\n` +
    `Titanio Ti-6Al-4V: Rm=900MPa, Re=830MPa, E=110000MPa. Alta resistenza specifica, lavorabilità difficile, costo elevato.\n` +
    `Polimeri: PA66(Nylon,Rm=80MPa,assorbe umidità); POM(acetalico,Rm=65MPa,basso attrito); PTFE(Rm=25MPa,ottima resistenza chimica). CFRP: Rm=600MPa, anisotropo, non saldabile.\n` +
    `Ceramiche tecniche: alta durezza, fragilità, resistenza ad alta T. Al2O3, Si3N4, SiC. Uso: cuscinetti ceramici, utensili.\n\n` +

    `## TRASMISSIONI DI POTENZA\n` +
    `i=n1/n2=z2/z1=D2/D1. Mt[Nm]=9550·P[kW]/n[giri/min].\n` +
    `Ingranaggi denti dritti: m=dp/z; φ=20°; de=dp+2m; df=dp-7/3m. Lewis: m=∛[2Mt/(λYzk)]; λ=b/m≈10; k=k0·5,6/(5,6+v). Y(φ=20°): z=17→0,302; z=20→0,320; z=30→0,358; z=50→0,408. Moduli UNI[mm]: 1;1,25;1,5;2;2,5;3;4;5;6;8;10;12;16;20.\n` +
    `Ingranaggi elicoidali: mn=mf·cosψ; z_eq=z/cos³ψ; Wa=Wt·tanψ.\n` +
    `Cinghie trapezoidali: Lp≈2C+π(D+d)/2+(D-d)²/(4C); θ=π-(D-d)/C; F1-F2=2Mt/d; feff≈0,44 (φ=40°). Sezioni: A(13×8mm,≤7,5kW,dmin=75mm); B(17×11mm,≤19kW,dmin=125mm); C(22×14mm,≤75kW,dmin=220mm); D(32×20mm,≤186kW,dmin=330mm).\n` +
    `Cuscinetti SKF: L10=(C/P)^p Mln giri (p=3 sfere; p=10/3 rulli); L10h=[10⁶/(60n)]·(C/P)³. P=XFr+YFa. Per sfere: P=Fr se Fa/Fr≤e; P=0,56Fr+YFa se Fa/Fr>e. Verifica statica: F≤C0/s0 (s0=0,5 sfere norm.; s0=1,0 rulli norm.). Durata: 20000÷30000h (macchine 8h); 40000÷60000h (continuo).\n` +
    `Bulloni: classi Rm/Re[MPa]: 4.6(400/240); 5.6(500/300); 8.8(800/640); 10.9(1000/900). Ares[mm²]: M6=20,1; M8=36,6; M10=58; M12=84; M16=157; M20=245; M24=353. Fp=0,8·fy·Ares; Ts=0,2·Fp·d. Taglio: Fv,R=0,6·fu·Ares/1,25. Trazione: FT,R=0,9·Ares·fu/1,25.\n` +
    `Linguette: τ=2T/(wLDn); p=4T/(hLDn)≤pam. pam acciaio bonifica=100÷150MPa; ghisa GJL=40÷70MPa.\n` +
    `Interferenza: Mt=μ·p·π·D²·L/2. μ acciaio-acciaio: 0,15 unto; 0,20 secco.\n` +
    `Hertz cilindro: b=√(2PC/(πL)); pmax=4P/(π·2bL); σGuest=0,801·pmax a z0=0,489b. Sfera: a=∛(3PdC/8); pmax=1,5P/(πa²).\n` +
    `Tolleranze ISO 286: sede cuscinetto foro H7; albero rotante k6/m6; scorrevole H7/f7; fisso H7/s6. Ra: superfici generiche 3,2÷6,3μm; sedi cuscin./tenute 0,8÷1,6μm; O-ring 0,4÷0,8μm.\n\n` +

    `## OLEOIDRAULICA\n` +
    `Fluidi (ISO 6743-4): HL(antiruggine); HM/HLP(antiusura—uso comune); HV(alto VI per T variabili). HFA/HFB/HFC/HFD: fluidi resistenti alla fiamma. ISO VG=viscosità cSt a 40°C (tipico: VG32, VG46, VG68).\n` +
    `Pompe volumetriche: a ingranaggi (semplici/economiche); a palette (silenziose, cilindrata variabile); a pistoni assiali/radiali (alta p, alta η). Q_th=Vg·n. ηv=Qreale/Qth≈0,90÷0,98. ηhm≈0,85÷0,95. ηtot=ηv·ηhm. P=QΔp/ηtot. M_th=Vg·Δp/(2π).\n` +
    `Motori idraulici: inverso della pompa. ηv_motore=Qth/Qreale. Vg·Δp=2π·Mc,m. Pm=Mc,m·ωm.\n` +
    `Cilindri: semplice effetto (forza in un senso); doppio effetto (forza in entrambi i sensi). As=πD²/4; Ar=π(D²-d²)/4. F_est=p·As-pret·Ar; F_rit=p·Ar. v_est=Q/As; v_rit=Q/Ar.\n` +
    `Valvole: limitatrice di pressione (VLP, norm.chiusa, protegge da sovrapressione, diretta o pilotata); riduttrice (norm.aperta, mantiene p_valle costante); regolatrice portata 2 bocche (influenzata da Δp); regolatrice 3 bocche con compensatore (Q costante indip.da Δp).\n` +
    `Distributori: N bocche/M posizioni. 4/3: P,T,A,B; 3 posizioni. Centro aperto: P→T a riposo. Centro chiuso: tutto bloccato. Proporzionali: posizione proporzionale al segnale elettrico.\n` +
    `Fluidodinamica: continuità Q=A1v1=A2v2. Bernoulli: p/(ρg)+v²/(2g)+z=cost. Con perdite: +hf. Hagen-Poiseuille (laminare): Δp=128μLQ/(πD⁴). Re=ρvD/μ: laminare<2300; turbolento>4000. Pressioni: bassa≤50bar; media 50÷200bar; alta 200÷350bar.\n\n` +

    `## TERMODINAMICA E FISICA TECNICA\n` +
    `Sistema chiuso: Q-L=ΔU. Sistema aperto stazionario: Q̇-Ẇ=ṁ·(Δh+Δv²/2+gΔz). h=u+pv. Gas ideale: Δh=cpΔT; Δu=cvΔT.\n` +
    `p·v=Rs·T. Aria: Rs=287J/(kgK); cp=1005J/(kgK); cv=718J/(kgK); γ=1,4.\n` +
    `II principio: η=L/QC=1-QF/QC≤ηCarnot=1-TF/TC. Frigorifero: COP=QF/L. Pompa calore: COP=QC/L.\n` +
    `Vapore: titolo x=m_vapore/m_tot. h=hf+x·hfg. Acqua 1atm: Tsat=100°C; hfg=2257kJ/kg.\n` +
    `Statica fluidi: dp/dz=-γ; p=p0+γh (γ=ρg). Archimede: FA=γfluido·Vimmerso. p_ass=p_rel+p_atm (patm≈101325Pa=1,013bar).\n` +
    `Equazione continuità: ṁ=ρAv=cost. Viscosità dinamica μ[Pa·s]: acqua 20°C≈10⁻³; olio VG46 a 40°C≈0,046.\n\n` +

    `## TRASMISSIONE DEL CALORE\n` +
    `Conduzione (Fourier): q=-λA(dT/dx)=λAΔT/L. Rt_cond=L/(λA). Guscio cilindrico: Rt=ln(r2/r1)/(2πLλ).\n` +
    `λ[W/(mK)]: acciaio=50; alluminio=237; rame=401; aria=0,026; acqua=0,607; PTFE=0,25.\n` +
    `Convezione (Newton): q=hA(Ts-T∞). Rt_conv=1/(hA). h[W/(m²K)]: libera gas 2÷25; forzata gas 25÷250; forzata liquidi 50÷20000; ebollizione/condensazione 2500÷100000.\n` +
    `Nu=hL/λ; Re=ρvL/μ; Pr=cpμ/λ; Ra=Gr·Pr; Gr=gβΔTL³/ν².\n` +
    `Irraggiamento: E=ε·σ·T⁴; σ=5,67×10⁻⁸W/(m²K⁴). ε: corpo nero=1; superfici reali 0<ε<1. α+ρ+τ=1; mezzo opaco: α+ρ=1.\n` +
    `Circuiti termici: q=ΔT/Rt (analogo I=ΔV/R). Serie: Rtot=ΣRi. Parallelo: 1/Rtot=Σ(1/Ri). U=1/(Rtot·A).\n` +
    `Scambiatori: q=UAΔTml. LMTD: ΔTml=(ΔT1-ΔT2)/ln(ΔT1/ΔT2). Equicorrente: ΔT1=Tci-Tfi; ΔT2=Tcu-Tfu. Controcorrente: ΔT1=Tci-Tfu; ΔT2=Tcu-Tfi (più efficiente). ε-NTU: ε=Q_reale/Q_max=f(Cr,NTU); NTU=UA/Cmin; Cr=Cmin/Cmax.\n`
  );
}

async function callGroqText(params: {
  message: string;
  messages: ChatMessage[];
  profile: any;
  fileText: string;
}) {
  const groqApiKey = process.env.GROQ_API_KEY;

  const route = chooseGroqModel({
    message: params.message,
    messages: params.messages,
    fileText: params.fileText,
  });

  const groqModel = route.model;

  if (!groqApiKey) {
    return (
      "⚠️ Backend collegato, ma manca la chiave Groq per la chat testuale.\n\n" +
      "Su Vercel aggiungi:\n\n" +
      "```env\n" +
      "GROQ_API_KEY=la_tua_chiave_groq\n" +
      "GROQ_MODEL_FAST=llama-3.1-8b-instant\n" +
      "GROQ_MODEL_MEDIUM=llama-3.3-70b-versatile\n" +
      "GROQ_MODEL_HARD=llama-3.3-70b-versatile\n" +
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
            {
              role: "system",
              content: buildTechAiSystemPrompt({
                userName,
                focus,
                route,
              }),
            },
            ...cleanHistory,
            {
              role: "user",
              content: finalUserContent,
            },
          ],
          temperature: route.level === "fast" ? 0.35 : route.level === "medium" ? 0.4 : 0.3,
          max_tokens: route.maxTokens,
        }),
      },
      route.timeoutMs
    );
  } catch (error: any) {
    if (error?.name === "AbortError") {
      return (
        "⚠️ Timeout Groq.\n\n" +
        "Il modello testuale non ha risposto entro il limite impostato.\n\n" +
        `Livello scelto: ${route.level}\n` +
        `Modello usato: ${groqModel}\n` +
        `Motivo scelta: ${route.reason}\n\n` +
        "Se succede spesso, usa un modello più veloce per GROQ_MODEL_HARD oppure riduci la cronologia inviata."
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
      `Livello scelto: ${route.level}\n` +
      `Motivo scelta: ${route.reason}\n` +
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
        groqModelFallback: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
        groqModelFast: process.env.GROQ_MODEL_FAST || "llama-3.1-8b-instant",
        groqModelMedium:
          process.env.GROQ_MODEL_MEDIUM ||
          process.env.GROQ_MODEL ||
          "llama-3.1-8b-instant",
        groqModelHard:
          process.env.GROQ_MODEL_HARD ||
          process.env.GROQ_MODEL_MEDIUM ||
          process.env.GROQ_MODEL ||
          "llama-3.1-8b-instant",
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
