type OpenAiContentPart =
  | { type: "input_text"; text: string }
  | { type: "input_file"; filename: string; file_data: string; detail?: "low" | "high" | "auto" }
  | { type: "input_image"; image_url: string; detail?: "low" | "high" | "auto" };

type OpenAiResponseBody = {
  status?: string;
  incomplete_details?: { reason?: string };
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

type CreateJsonResponseArgs = {
  content: OpenAiContentPart[];
  schemaName: string;
  schema?: Record<string, unknown>;
  maxOutputTokens?: number;
};

export function getOpenAiModel() {
  return normalizeOpenAiModel(process.env.GPT_MODEL || process.env.OPENAI_MODEL);
}

export function getOpenAiApiKey() {
  return process.env.GPT_API_KEY || process.env.OPENAI_API_KEY || "";
}

export async function createOpenAiJsonResponse(args: CreateJsonResponseArgs) {
  const apiKey = getOpenAiApiKey();
  if (!apiKey) throw new Error("GPT_API_KEY가 설정되지 않아 AI 요청을 실행할 수 없습니다.");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAiModel(),
      input: [{ role: "user", content: args.content }],
      max_output_tokens: args.maxOutputTokens || 12000,
      text: {
        format: args.schema
          ? { type: "json_schema", name: args.schemaName, schema: args.schema, strict: false }
          : { type: "json_object" },
      },
    }),
  });

  const bodyText = await response.text();
  if (!response.ok) {
    console.error("OpenAI request failed", response.status, bodyText.slice(0, 1000));
    throw new Error("AI 요청에 실패했습니다.");
  }

  let body: OpenAiResponseBody;
  try {
    body = JSON.parse(bodyText) as OpenAiResponseBody;
  } catch {
    console.error("Invalid OpenAI response body", bodyText.slice(0, 1000));
    throw new Error("AI 응답을 해석하지 못했습니다.");
  }

  if (body.status === "incomplete") {
    console.error("Incomplete OpenAI response", body.incomplete_details || {}, bodyText.slice(0, 1000));
    throw new Error(body.incomplete_details?.reason === "max_output_tokens" ? "AI 응답이 너무 길어 중단되었습니다." : "AI 응답이 완료되지 않았습니다.");
  }

  const text = extractOpenAiOutputText(body);
  if (!text) {
    console.error("Empty OpenAI response body", bodyText.slice(0, 1000));
    throw new Error("AI 응답이 비어 있습니다.");
  }

  return parseJsonFromText(text);
}

export function makeOpenAiFileDataUrl(mediaType: string, buffer: Buffer) {
  return `data:${mediaType};base64,${buffer.toString("base64")}`;
}

function extractOpenAiOutputText(body: OpenAiResponseBody) {
  if (typeof body.output_text === "string") return body.output_text;
  for (const item of body.output || []) {
    for (const content of item.content || []) {
      if ((content.type === "output_text" || content.type === "text") && content.text) return content.text;
    }
  }
  return "";
}

function parseJsonFromText(text: string) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const json = extractJsonObject(text);
    if (!json) throw new Error("JSON object not found in OpenAI response");
    try {
      return JSON.parse(json);
    } catch {
      console.error("Invalid JSON output from OpenAI", {
        message: error instanceof Error ? error.message : String(error),
        length: text.length,
        head: text.slice(0, 500),
        tail: text.slice(-500),
      });
      throw error;
    }
  }
}

function extractJsonObject(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : "";
}

function normalizeOpenAiModel(value?: string) {
  const model = value?.trim();
  if (!model) return "gpt-5.1";
  const compact = model.toLowerCase().replace(/\s+/g, "");
  const aliases: Record<string, string> = {
    "5": "gpt-5",
    "gpt5": "gpt-5",
    "5.1": "gpt-5.1",
    "gpt5.1": "gpt-5.1",
    "5mini": "gpt-5-mini",
    "gpt5mini": "gpt-5-mini",
    "5nano": "gpt-5-nano",
    "gpt5nano": "gpt-5-nano",
  };
  if (aliases[compact]) return aliases[compact];
  if (/^5(?:\.\d+)?$/.test(compact)) {
    console.warn(`Unsupported OPENAI_MODEL shorthand "${model}". Falling back to gpt-5.1.`);
    return "gpt-5.1";
  }
  return model;
}
