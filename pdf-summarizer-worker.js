const MODEL = "@cf/zai-org/glm-4.7-flash";
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_TEXT_CHARS = 140000;
const CHUNK_CHARS = 30000;

const MODE_PROMPTS = {
  summary: "Crie um resumo claro e fiel, destacando apenas as ideias mais importantes.",
  detailed: "Crie um resumo detalhado e bem estruturado, preservando conceitos, argumentos, dados e conclusões importantes.",
  keypoints: "Extraia os pontos-chave do documento em uma lista organizada. Não invente informações.",
  study: "Transforme o conteúdo em notas de estudo organizadas por temas, com conceitos, definições, fatos e relações importantes.",
  simple: "Explique o conteúdo em linguagem simples, mantendo a precisão e sem eliminar ideias essenciais.",
  qa: "Crie perguntas e respostas úteis para revisar o conteúdo. As respostas devem estar fundamentadas exclusivamente no documento.",
  quiz: "Crie um quiz de múltipla escolha baseado exclusivamente no documento. Gere 5 perguntas, cada uma com 4 opções e apenas uma resposta correta. Retorne JSON válido no formato {\"questions\":[{\"question\":\"...\",\"options\":[\"...\",\"...\",\"...\",\"...\"],\"answer\":0,\"explanation\":\"...\"}]}"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": "*"
    }
  });
}

function cleanText(text) {
  return String(text || "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function chunkText(text) {
  const chunks = [];
  for (let i = 0; i < text.length; i += CHUNK_CHARS) {
    chunks.push(text.slice(i, i + CHUNK_CHARS));
  }
  return chunks;
}

function extractModelText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (Array.isArray(result)) return result.map(extractModelText).filter(Boolean).join("\n");
  if (typeof result === "object") {
    if (typeof result.response === "string") return result.response;
    if (typeof result.content === "string") return result.content;
    if (typeof result.text === "string") return result.text;
    if (Array.isArray(result.choices)) {
      return result.choices.map(choice => {
        if (typeof choice?.message?.content === "string") return choice.message.content;
        return typeof choice?.text === "string" ? choice.text : "";
      }).filter(Boolean).join("\n");
    }
  }
  return "";
}

function parseJson(text) {
  try { return JSON.parse(text); } catch {}
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced) {
    try { return JSON.parse(fenced[1]); } catch {}
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return null;
}

async function runTextModel(env, prompt) {
  const result = await env.AI.run(MODEL, {
    messages: [
      {
        role: "system",
        content: "Você é o Nexauren PDF AI. Trabalhe somente com o conteúdo fornecido. Não invente fatos, fontes ou citações. Responda na mesma língua predominante do documento, salvo instrução explícita em contrário."
      },
      { role: "user", content: prompt }
    ],
    max_completion_tokens: 2500
  });
  return extractModelText(result).trim();
}

async function summarizeText(env, text, mode) {
  const instruction = MODE_PROMPTS[mode] || MODE_PROMPTS.summary;
  const chunks = chunkText(text);
  const partials = [];

  for (const chunk of chunks) {
    const partial = await runTextModel(env,
      `${instruction}\n\nConteúdo do PDF:\n---\n${chunk}\n---\nSe o conteúdo for apenas uma parte do documento, preserve os fatos essenciais para uma síntese posterior.`
    );
    if (partial) partials.push(partial);
  }

  if (!partials.length) return "";
  if (partials.length === 1) return partials[0];

  return runTextModel(env,
    `${instruction}\n\nConsolide os seguintes resultados parciais do mesmo PDF em uma única resposta coerente. Remova repetições e não adicione informações que não estejam nos resultados.\n\n${partials.map((p, i) => `PARTE ${i + 1}:\n${p}`).join("\n\n")}`
  );
}

async function convertPdf(env, file) {
  const bytes = await file.arrayBuffer();
  if (!bytes.byteLength) {
    throw new Error("O PDF enviado está vazio.");
  }

  const input = {
    name: file.name || "document.pdf",
    blob: new Blob([bytes], { type: "application/pdf" })
  };

  const result = await env.AI.toMarkdown(input, {
    conversionOptions: {
      output: { format: "text" },
      pdf: { metadata: false }
    }
  });

  const conversion = Array.isArray(result) ? result[0] : result;

  if (!conversion) {
    throw new Error("O serviço de conversão não retornou resultado.");
  }

  if (typeof conversion === "string") {
    return conversion;
  }

  if (conversion.format === "error") {
    throw new Error(`Falha na conversão do PDF: ${conversion.error || "erro desconhecido"}`);
  }

  if (typeof conversion.data === "string") {
    return conversion.data;
  }

  if (typeof conversion.text === "string") {
    return conversion.text;
  }

  if (conversion.data && typeof conversion.data.text === "string") {
    return conversion.data.text;
  }

  throw new Error("A conversão do PDF não retornou texto.");
}

export async function handlePdfSummarizer(req, env) {
  const url = new URL(req.url);
  if (!url.pathname.startsWith("/api/pdf-summarizer")) return null;

  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });
  }

  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  if (!env.AI) return json({ error: "Workers AI não está configurado neste ambiente." }, 503);

  try {
    const form = await req.formData();
    const file = form.get("file");
    const mode = String(form.get("mode") || "summary");

    if (!file || typeof file.arrayBuffer !== "function") return json({ error: "Envie um arquivo PDF." }, 400);

    const fileName = String(file.name || "document.pdf");
    const fileType = String(file.type || "").toLowerCase();
    const fileSize = Number(file.size || 0);

    if (fileType !== "application/pdf" && !fileName.toLowerCase().endsWith(".pdf")) {
      return json({ error: "O arquivo precisa ser um PDF válido." }, 400);
    }
    if (fileSize > MAX_FILE_BYTES) return json({ error: "O PDF excede o limite de 10 MB nesta versão." }, 413);
    if (!MODE_PROMPTS[mode]) return json({ error: "Modo de resposta inválido." }, 400);

    const text = cleanText(await convertPdf(env, file));

    if (!text) {
      return json({ error: "Não foi possível extrair texto deste PDF. Verifique se o PDF contém texto selecionável e tente novamente." }, 422);
    }
    if (text.length > MAX_TEXT_CHARS) {
      return json({ error: "Este PDF é grande demais para esta versão. Use um documento de até aproximadamente 140 mil caracteres." }, 413);
    }

    const result = await summarizeText(env, text, mode);
    if (!result) return json({ error: "A IA não retornou um resultado. Tente novamente." }, 502);

    if (mode === "quiz") {
      const parsed = parseJson(result);
      if (!parsed?.questions?.length) return json({ error: "O modo quiz não conseguiu gerar uma estrutura válida. Tente novamente." }, 502);
      return json({ mode, fileName, result: parsed, characters: text.length });
    }

    return json({ mode, fileName, result, characters: text.length });
  } catch (error) {
    console.error("PDF summarizer error", error?.message || error);
    return json({
      error: "Não foi possível processar o PDF agora.",
      detail: error?.message || "Erro desconhecido"
    }, 500);
  }
}
