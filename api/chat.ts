export const config = {
  runtime: "edge",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

export default async function handler(req: Request) {
  if (req.method === "GET") {
    return json({
      ok: true,
      message: "API /api/chat funzionante",
    });
  }

  if (req.method !== "POST") {
    return json({
      ok: false,
      error: "Metodo non consentito",
    }, 405);
  }

  return json({
    answer:
      "✅ Backend collegato correttamente.\n\n" +
      "Questa è una risposta di test da `/api/chat`.\n\n" +
      "Ora il frontend riesce a parlare con il backend. Dopo aggiungiamo la key e la chiamata AI vera.",
  });
}
