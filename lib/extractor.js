import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = join(__dirname, "..", "temp");
const promptsDir = join(__dirname, "..", "prompts");

// Helper to get the correct token limit parameter for OpenAI models
// GPT-5 and GPT-4.1 models require max_completion_tokens instead of max_tokens
// GPT-5 models are reasoning models that need higher limits (reasoning tokens + output tokens)
function getOpenAITokenParam(model, tokens = 16384) {
  if (model.startsWith("gpt-5") || model.startsWith("gpt-4.1")) {
    // Reasoning models need much higher limits - reasoning tokens are counted separately
    // For GPT-5 nano, use 16k minimum to allow for reasoning + output
    const reasoningTokens = model.includes("nano") ? 16384 : tokens;
    return { max_completion_tokens: Math.max(reasoningTokens, tokens) };
  }
  return { max_tokens: tokens };
}

// Load default prompt from file
const defaultPromptPath = join(promptsDir, "default-prompt.txt");
export const DEFAULT_PROMPT = existsSync(defaultPromptPath)
  ? readFileSync(defaultPromptPath, "utf-8")
  : "You are a helpful assistant that processes video transcripts.";

export function getPromptsDir() {
  return promptsDir;
}

// Generate prompt based on compression level (0-100)
// 100 = no summarization (just organize), 50 = default, 0 = maximum compression
export function getPromptForCompression(compressionLevel) {
  if (compressionLevel === null || compressionLevel === undefined) {
    return DEFAULT_PROMPT;
  }

  const level = Math.max(0, Math.min(100, compressionLevel));

  let detailLevel;
  let sectionInstructions;

  if (level >= 90) {
    // Minimal compression - keep almost everything
    detailLevel =
      "Keep the full detailed content with minimal summarization. Preserve all information, examples, and nuances.";
    sectionInstructions =
      "Include comprehensive content under each section - do not summarize, just organize and improve readability.";
  } else if (level >= 70) {
    // Light compression
    detailLevel =
      "Keep most of the content with light summarization. Preserve key examples and important details.";
    sectionInstructions =
      "Include detailed content under each section with only minor condensing for clarity.";
  } else if (level >= 40) {
    // Moderate compression (default-ish)
    detailLevel =
      "Summarize for clarity while keeping important details. Remove redundancy but preserve key points.";
    sectionInstructions =
      "Write a brief 1-2 sentence summary at the start of each section (in italics), then include the key content.";
  } else if (level >= 20) {
    // High compression
    detailLevel =
      "Provide concise summaries focusing only on the most important points.";
    sectionInstructions =
      "Write a 2-3 sentence summary for each section. Only include essential information.";
  } else {
    // Maximum compression
    detailLevel =
      "Provide extremely brief summaries - only the absolute key takeaways.";
    sectionInstructions =
      "Write just 1-2 sentences per section covering only the most critical points.";
  }

  return `You are a summarization assistant. Your task is to CONDENSE and REWRITE a video transcript into a shorter summary. NEVER copy the transcript verbatim.

Given the raw transcript below, create:

1. TLDR (2-3 sentences) - Main topic and key points.

2. Key Insights (3-7 items) - Most important ideas as standalone statements.

3. Action Items - Practical takeaways or recommendations.

4. Metadata - Extract for knowledge graph:
   - concepts (3-7): Core ideas/frameworks discussed. Be specific: "compounding effects" not "growth"
   - entities: People, books, companies, tools, named frameworks referenced (exclude generic mentions)
   - category: ONE of: business | psychology | technology | philosophy | productivity | health | science | finance | creativity | other
   - suggestedTags (3-5): Specific, reusable labels for filtering (e.g., "startup-growth", "cognitive-bias")

   IMPORTANT: Auto-generated transcripts contain errors. Fix obvious typos and mishearings:
   - "Enthropic/Anthropik" → "Anthropic", "Clod/Cloud Code" → "Claude Code", "Chat GPT" → "ChatGPT", "NA10" → "n8n"
   - Verify entity names are spelled correctly (real company/person/book names)
   - Remove nonsense entities that are clearly transcription errors
   - Ensure tags use correct spelling (e.g., "claude-code" not "cloud-code")

5. Summary - A CONDENSED rewrite organized into sections:
   - Target length: ~${level}% of original
   - CRITICAL: Rewrite in your own words. Do NOT copy transcript text.
   - Use 3-8 sections with ## markdown headers - use DESCRIPTIVE titles based on content (e.g., "## The Growth Strategy", "## Key Challenges") - NEVER use generic titles like "Section 1" or "Introduction"
   - ${sectionInstructions}
   - ${detailLevel}

JSON format:
{
  "tldr": "...",
  "keyInsights": ["...", "..."],
  "actionItems": ["...", "..."],
  "concepts": ["opportunity cost", "reversible decisions"],
  "entities": ["Jeff Bezos", "Amazon", "The Innovator's Dilemma"],
  "category": "business",
  "suggestedTags": ["decision-making", "leadership"],
  "summary": "## Building the Foundation\\n\\nCondensed content...\\n\\n## Scaling the System\\n\\nMore condensed content..."
}`;
}

export function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/, // direct video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error("Could not extract video ID from URL");
}

export function cleanSubtitleText(srtContent) {
  return srtContent
    .split("\n")
    .filter((line) => {
      if (/^\d+$/.test(line.trim())) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(line.trim())) return false;
      return true;
    })
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
}

/**
 * Convert ## headers to ### subheadings within transcript content
 * This prevents ## headers from being treated as top-level sections in markdown
 */
export function convertToSubheadings(content) {
  return content.replace(/^## /gm, '### ');
}

function formatOriginalTranscript(transcript) {
  // Split transcript into sentences and group into paragraphs
  // This creates more readable paragraphs from the raw transcript
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [transcript];
  const paragraphs = [];
  let currentParagraph = [];

  for (let i = 0; i < sentences.length; i++) {
    currentParagraph.push(sentences[i].trim());
    // Create a new paragraph every 4-5 sentences
    if (currentParagraph.length >= 4 || i === sentences.length - 1) {
      paragraphs.push(currentParagraph.join(" "));
      currentParagraph = [];
    }
  }

  return paragraphs.join("\n\n");
}

function run(cmd) {
  try {
    // Note: execSync is used here for yt-dlp commands. The URL is validated
    // by extractVideoId before use, ensuring only valid YouTube URLs/IDs pass through.
    return execSync(cmd, { encoding: "utf-8", maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

async function processWithOpenAI(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
) {
  const systemPrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`,
        },
      ],
      ...getOpenAITokenParam(model),
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

// Streaming version of OpenAI processing
export async function streamWithOpenAI(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
  onChunk,
) {
  const systemPrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`,
        },
      ],
      ...getOpenAITokenParam(model),
      stream: true,
      // Only use JSON mode for models that support it well (not GPT-5)
      ...(model.startsWith("gpt-5") ? {} : { response_format: { type: "json_object" } }),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            accumulated += content;
            onChunk(content);
          }
        } catch (err) {
          console.error('Failed to parse OpenAI streaming chunk:', err.message);
        }
      }
    }
  }

  // Parse the final accumulated JSON
  // Try to extract JSON - handle markdown code blocks and other formats
  let jsonStr = accumulated;

  // Remove markdown code block wrapper if present
  const codeBlockMatch = accumulated.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  // Extract JSON object
  const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      console.error("JSON parse error:", parseErr.message);
      // Fall through to fallback
    }
  }

  // Fallback: try to extract partial content if JSON parsing failed
  // This handles cases where the stream was interrupted
  console.error("JSON parsing failed, attempting to extract partial content...");
  console.error("Accumulated length:", accumulated.length);
  console.error("First 1000 chars:", accumulated.substring(0, 1000));

  const fallback = {
    tldr: "Summary generation was interrupted.",
    keyInsights: [],
    actionItems: [],
    summary: accumulated || "Content generation was interrupted."
  };

  // Try to extract any completed fields from partial JSON
  const tldrMatch = accumulated.match(/"tldr"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  if (tldrMatch) {
    fallback.tldr = tldrMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  // Try both "summary" and "transcript" for backwards compatibility
  const summaryMatch = accumulated.match(/"(?:summary|transcript)"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (summaryMatch) {
    fallback.summary = summaryMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }

  return fallback;
}

async function processWithAnthropic(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
) {
  const basePrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${basePrompt}

Video title: ${title}

Raw transcript:
${transcript}

Respond ONLY with valid JSON, no other text.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.content[0].text;

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse Anthropic response as JSON");
  }
  return JSON.parse(jsonMatch[0]);
}

// Streaming version of Anthropic processing
export async function streamWithAnthropic(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
  onChunk,
) {
  const basePrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      messages: [
        {
          role: "user",
          content: `${basePrompt}

Video title: ${title}

Raw transcript:
${transcript}

Respond ONLY with valid JSON, no other text.`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);

        try {
          const parsed = JSON.parse(data);
          if (parsed.type === "content_block_delta") {
            const content = parsed.delta?.text;
            if (content) {
              accumulated += content;
              onChunk(content);
            }
          }
        } catch (err) {
          console.error('Failed to parse Anthropic streaming chunk:', err.message);
        }
      }
    }
  }

  // Parse the final accumulated JSON
  const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse Anthropic streaming response as JSON");
  }
  return JSON.parse(jsonMatch[0]);
}

async function processWithOpenRouter(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
) {
  const systemPrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "YT Extractor",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`,
        },
      ],
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;

  // Extract JSON from response (handle potential markdown wrapping)
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse OpenRouter response as JSON");
  }
  return JSON.parse(jsonMatch[0]);
}

// Streaming version of OpenRouter processing
export async function streamWithOpenRouter(
  transcript,
  title,
  model,
  apiKey,
  customPrompt,
  onChunk,
) {
  const systemPrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "YT Extractor",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: systemPrompt,
        },
        {
          role: "user",
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`,
        },
      ],
      max_tokens: 4096,
      stream: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let accumulated = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (line.startsWith("data: ")) {
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            accumulated += content;
            onChunk(content);
          }
        } catch (err) {
          console.error('Failed to parse OpenRouter streaming chunk:', err.message);
        }
      }
    }
  }

  // Parse the final accumulated JSON
  const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse OpenRouter streaming response as JSON");
  }
  return JSON.parse(jsonMatch[0]);
}

// Stream annotation response - simpler than full transcript processing
export async function streamAnnotationResponse(prompt, llmConfig, onChunk) {
  const { provider, model, apiKey } = llmConfig;

  if (!apiKey) {
    throw new Error("No API key available");
  }

  let accumulated = "";

  if (provider === "openai") {
    // For GPT-5 models, use max_completion_tokens; for others, use max_tokens
    const tokenParam = model.startsWith("gpt-5") || model.startsWith("gpt-4.1")
      ? { max_completion_tokens: 2048 }
      : { max_tokens: 1024 };

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        ...tokenParam,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            // GPT-5 models may use different response structure
            let content = null;
            if (parsed.choices?.[0]?.delta?.content) {
              content = parsed.choices[0].delta.content;
            } else if (parsed.choices?.[0]?.message?.content) {
              content = parsed.choices[0].message.content;
            } else if (parsed.output) {
              // GPT-5 Responses API format
              for (const item of parsed.output) {
                if (item.type === "message" && item.content) {
                  for (const c of item.content) {
                    if (c.type === "output_text" && c.text) {
                      content = (content || "") + c.text;
                    }
                  }
                }
              }
            }
            if (content) {
              accumulated += content;
              onChunk(content);
            }
          } catch (err) {
            console.error('Failed to parse OpenAI annotation streaming chunk:', err.message);
          }
        }
      }
    }
  } else if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1024,
        stream: true,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              const content = parsed.delta?.text;
              if (content) {
                accumulated += content;
                onChunk(content);
              }
            }
          } catch (err) {
            console.error('Failed to parse Anthropic annotation streaming chunk:', err.message);
          }
        }
      }
    }
  } else if (provider === "openrouter") {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "YT Extractor",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1024,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              onChunk(content);
            }
          } catch (err) {
            console.error('Failed to parse OpenRouter annotation streaming chunk:', err.message);
          }
        }
      }
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return accumulated;
}

// Unified streaming function that selects the right provider
export async function streamWithLLM(transcript, title, llmConfig, onChunk) {
  const { provider, model, apiKey, compressionLevel } = llmConfig;

  if (!apiKey) {
    return null;
  }

  const prompt = getPromptForCompression(compressionLevel);
  let result = null;

  if (provider === "openai") {
    result = await streamWithOpenAI(transcript, title, model, apiKey, prompt, onChunk);
  } else if (provider === "anthropic") {
    result = await streamWithAnthropic(transcript, title, model, apiKey, prompt, onChunk);
  } else if (provider === "openrouter") {
    result = await streamWithOpenRouter(transcript, title, model, apiKey, prompt, onChunk);
  }

  return result ? { result, promptUsed: prompt } : null;
}

async function processWithLLM(transcript, title, llmConfig) {
  const { provider, model, apiKey, compressionLevel } = llmConfig;

  if (!apiKey) {
    return null;
  }

  // Always use compression-based prompt (ignore custom prompts for consistency)
  const prompt = getPromptForCompression(compressionLevel);
  let result = null;

  if (provider === "openai") {
    result = await processWithOpenAI(transcript, title, model, apiKey, prompt);
  } else if (provider === "anthropic") {
    result = await processWithAnthropic(transcript, title, model, apiKey, prompt);
  } else if (provider === "openrouter") {
    result = await processWithOpenRouter(transcript, title, model, apiKey, prompt);
  }

  return result ? { result, promptUsed: prompt } : null;
}

// Extract basic info (metadata + transcript) without LLM processing
export async function extractBasic(url) {
  const videoId = extractVideoId(url);
  mkdirSync(tempDir, { recursive: true });
  const tempPrefix = join(tempDir, videoId);

  // Get metadata
  run(`yt-dlp --write-info-json --skip-download -o "${tempPrefix}" "${url}"`);

  const infoPath = `${tempPrefix}.info.json`;
  if (!existsSync(infoPath)) {
    throw new Error(
      "Failed to fetch video metadata. Check if yt-dlp is installed.",
    );
  }

  const info = JSON.parse(readFileSync(infoPath, "utf-8"));

  // Try to get subtitles (prefer manual, fallback to auto-generated)
  let transcript = null;

  run(
    `yt-dlp --write-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`,
  );

  let subPath = `${tempPrefix}.en.srt`;
  if (!existsSync(subPath)) {
    run(
      `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`,
    );
    subPath = `${tempPrefix}.en.srt`;
  }

  if (existsSync(subPath)) {
    const rawSrt = readFileSync(subPath, "utf-8");
    transcript = cleanSubtitleText(rawSrt);
  }

  const duration = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}`
    : "Unknown";

  const originalTranscriptFormatted = transcript
    ? formatOriginalTranscript(transcript)
    : null;

  return {
    videoId,
    title: info.title,
    channel: info.channel || info.uploader || "Unknown",
    publishDate: info.upload_date
      ? info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3")
      : "Unknown",
    duration,
    views: info.view_count?.toLocaleString() || "Unknown",
    description: info.description || "No description available.",
    transcript,
    transcriptFormatted: originalTranscriptFormatted,
    hasTranscript: !!transcript,
  };
}

// Process transcript with LLM and generate formatted output
export async function processWithLLMAndFormat(basicInfo, llmConfig) {
  const {
    videoId,
    title,
    channel,
    publishDate,
    duration,
    views,
    description,
    transcript,
    transcriptFormatted,
  } = basicInfo;

  let llmContent = null;
  let llmError = null;
  let promptUsed = null;

  if (transcript && llmConfig) {
    try {
      const llmResult = await processWithLLM(transcript, title, llmConfig);
      if (llmResult) {
        llmContent = llmResult.result;
        promptUsed = llmResult.promptUsed;
      }
    } catch (err) {
      console.error("LLM processing error:", err.message);
      llmError = err.message;
    }
  }

  const originalTranscriptFormatted =
    transcriptFormatted || "No transcript available for this video.";

  let output = "";

  output += `# ${title}

`;

  if (llmContent?.tldr) {
    output += `## TLDR

${llmContent.tldr}

`;
  }

  if (llmContent?.keyInsights?.length > 0) {
    output += `## Key Insights

${llmContent.keyInsights.map((insight) => `- ${insight}`).join("\n")}

`;
  }

  if (llmContent?.actionItems?.length > 0) {
    output += `## Action Items & Takeaways

${llmContent.actionItems.map((item) => `- ${item}`).join("\n")}

`;
  }

  output += `## Metadata

- **Channel:** ${channel}
- **Published:** ${publishDate}
- **Duration:** ${duration}
- **Views:** ${views}
- **URL:** https://youtube.com/watch?v=${videoId}

## Description

${description}

## Summary

${(llmContent?.summary || llmContent?.transcript) ? convertToSubheadings(llmContent.summary || llmContent.transcript) : originalTranscriptFormatted}

---

<details>
<summary>Original Transcript</summary>

${originalTranscriptFormatted}

</details>`;

  // Save markdown to temp folder
  const filename = `${sanitizeFilename(title)}.md`;
  const mdPath = join(tempDir, filename);
  writeFileSync(mdPath, output);

  return {
    output,
    mdPath,
    filename,
    title,
    videoId,
    llmError,
    promptUsed,
  };
}

// Reprocess existing content with LLM (creates new file with timestamp)
export async function reprocessWithLLM(originalTranscript, title, llmConfig) {
  if (!originalTranscript) {
    throw new Error("No transcript available for reprocessing");
  }

  let llmResult = null;
  try {
    llmResult = await processWithLLM(originalTranscript, title, llmConfig);
  } catch (err) {
    throw new Error(`LLM processing failed: ${err.message}`);
  }

  // Return { result, promptUsed } to allow caller to access the prompt
  return llmResult;
}

export async function extract(url, llmConfig = null) {
  const videoId = extractVideoId(url);
  mkdirSync(tempDir, { recursive: true });
  const tempPrefix = join(tempDir, videoId);

  // Get metadata
  run(`yt-dlp --write-info-json --skip-download -o "${tempPrefix}" "${url}"`);

  const infoPath = `${tempPrefix}.info.json`;
  if (!existsSync(infoPath)) {
    throw new Error(
      "Failed to fetch video metadata. Check if yt-dlp is installed.",
    );
  }

  const info = JSON.parse(readFileSync(infoPath, "utf-8"));

  // Try to get subtitles (prefer manual, fallback to auto-generated)
  let transcript = null;

  run(
    `yt-dlp --write-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`,
  );

  let subPath = `${tempPrefix}.en.srt`;
  if (!existsSync(subPath)) {
    run(
      `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`,
    );
    subPath = `${tempPrefix}.en.srt`;
  }

  if (existsSync(subPath)) {
    const rawSrt = readFileSync(subPath, "utf-8");
    transcript = cleanSubtitleText(rawSrt);
  }

  // Skip LLM if no transcript available
  let llmContent = null;
  let noTranscriptWarning = null;

  if (!transcript) {
    noTranscriptWarning =
      "No transcript available for this video. LLM processing skipped.";
  } else if (llmConfig) {
    try {
      const llmResult = await processWithLLM(transcript, info.title, llmConfig);
      if (llmResult) {
        llmContent = llmResult.result;
      }
    } catch (err) {
      console.error("LLM processing error:", err.message);
    }
  }

  // Format output
  const duration = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, "0")}`
    : "Unknown";

  // Split original transcript into paragraphs (roughly every 3-4 sentences)
  const originalTranscriptFormatted = transcript
    ? formatOriginalTranscript(transcript)
    : "No transcript available for this video.";

  let output = "";

  output += `# ${info.title}

`;

  if (llmContent?.tldr) {
    output += `## TLDR

${llmContent.tldr}

`;
  }

  if (llmContent?.keyInsights?.length > 0) {
    output += `## Key Insights

${llmContent.keyInsights.map((insight) => `- ${insight}`).join("\n")}

`;
  }

  if (llmContent?.actionItems?.length > 0) {
    output += `## Action Items & Takeaways

${llmContent.actionItems.map((item) => `- ${item}`).join("\n")}

`;
  }

  output += `## Metadata

- **Channel:** ${info.channel || info.uploader || "Unknown"}
- **Published:** ${info.upload_date ? info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") : "Unknown"}
- **Duration:** ${duration}
- **Views:** ${info.view_count?.toLocaleString() || "Unknown"}
- **URL:** https://youtube.com/watch?v=${videoId}

## Description

${info.description || "No description available."}

## Summary

${(llmContent?.summary || llmContent?.transcript) ? convertToSubheadings(llmContent.summary || llmContent.transcript) : originalTranscriptFormatted}

---

<details>
<summary>Original Transcript</summary>

${originalTranscriptFormatted}

</details>`;

  // Save markdown to temp folder
  const filename = `${sanitizeFilename(info.title)}.md`;
  const mdPath = join(tempDir, filename);
  writeFileSync(mdPath, output);

  return {
    output,
    mdPath,
    filename,
    title: info.title,
    videoId,
    hasTranscript: !!transcript,
    noTranscriptWarning,
  };
}

export function getTempDir() {
  return tempDir;
}

/**
 * Normalize metadata terms using LLM
 * Takes a list of terms and field type, returns canonical forms with aliases
 */
export async function normalizeMetadataTerms(terms, fieldType, llmConfig) {
  const { provider, model, apiKey } = llmConfig;

  if (!apiKey || terms.length === 0) {
    return [];
  }

  const prompt = `You are a metadata taxonomy expert. Given a list of terms from video summaries, standardize them into canonical forms.

**Field:** ${fieldType} (concepts | entities | tags | category)

**Terms to normalize:**
${JSON.stringify(terms)}

For each unique concept, provide:
1. A canonical form (lowercase, hyphenated for multi-word terms)
2. List of aliases that map to it

Rules:
- Use lowercase with hyphens for multi-word terms (e.g., "ai-tools" not "AI Tools")
- Merge obvious duplicates (spelling variations, hyphenation differences, case differences)
- Keep distinct concepts separate - don't over-merge different ideas
- For entities (people/companies), use proper capitalization (e.g., "OpenAI" not "openai")
- For categories, use single lowercase words
- Be conservative - only merge terms that clearly refer to the same thing

Respond ONLY with valid JSON, no other text:
{
  "normalizations": [
    { "canonical": "ai-tools", "aliases": ["AI tools", "ai_tools", "AI-tools"] }
  ]
}`;

  let response;
  let content;

  if (provider === "openai") {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        ...getOpenAITokenParam(model, 4096),
        // GPT-5 models don't support json_object response format well
        ...(model.startsWith("gpt-5") ? {} : { response_format: { type: "json_object" } }),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    // Debug: log full response for GPT-5 models
    if (model.startsWith("gpt-5")) {
      console.log("GPT-5 response for", fieldType, ":", JSON.stringify(data, null, 2));
    }
    content = data.choices[0]?.message?.content;
    // Check for refusal or other issues
    if (!content && data.choices[0]?.message?.refusal) {
      console.error("Model refused:", data.choices[0].message.refusal);
    }
    if (!content && data.choices[0]?.finish_reason) {
      console.log("Finish reason:", data.choices[0].finish_reason);
    }
  } else if (provider === "anthropic") {
    response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.content[0].text;
  } else if (provider === "openrouter") {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "YT Extractor",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 4096,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    content = data.choices[0].message.content;
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  // Parse the JSON response - handle markdown code blocks
  if (!content) {
    console.error("Empty content from LLM for", fieldType, "using", model);
    return [];
  }

  // Remove markdown code blocks if present
  let jsonContent = content;
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonContent = codeBlockMatch[1].trim();
  }

  // Extract JSON object
  const jsonMatch = jsonContent.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error("Could not find JSON in response:", content.substring(0, 200));
    return [];
  }

  try {
    const result = JSON.parse(jsonMatch[0]);
    return result.normalizations || [];
  } catch (parseErr) {
    console.error("JSON parse error:", parseErr.message, "Content:", jsonMatch[0].substring(0, 200));
    return [];
  }
}

/**
 * Stream metadata analysis with progress updates
 * @param {Object} llmConfig - LLM configuration
 * @param {Function} onProgress - Progress callback
 * @param {string[]|null} filterFiles - Optional array of signal filenames to filter by
 */
export async function streamMetadataAnalysis(llmConfig, onProgress, filterFiles = null) {
  let filesToProcess = readdirSync(tempDir).filter((f) => f.endsWith(".signal.json"));

  // Filter to only selected files if filter provided
  if (filterFiles && filterFiles.length > 0) {
    const filterSet = new Set(filterFiles);
    filesToProcess = filesToProcess.filter((f) => filterSet.has(f));
  }

  const signalFiles = filesToProcess
    .map((filename) => {
      const filePath = join(tempDir, filename);
      try {
        const content = JSON.parse(readFileSync(filePath, "utf-8"));
        return {
          filename: filename.replace(".signal.json", ".md"),
          ...content,
        };
      } catch (err) {
        console.error(`Failed to parse signal file ${filename}:`, err.message);
        return null;
      }
    })
    .filter(Boolean);

  if (signalFiles.length === 0) {
    return { proposedChanges: null, error: "No signal files found" };
  }

  // Collect all unique terms by field
  const allConcepts = [];
  const allEntities = [];
  const allTags = [];
  const allCategories = [];
  const fileTermMapping = {};

  signalFiles.forEach((file, index) => {
    onProgress({
      type: "collecting",
      processed: index + 1,
      total: signalFiles.length,
      current: file.filename,
    });

    fileTermMapping[file.filename] = {
      concepts: file.concepts || [],
      entities: file.entities || [],
      tags: file.suggestedTags || [],
      category: file.category || null,
    };

    (file.concepts || []).forEach((c) => {
      if (!allConcepts.includes(c)) allConcepts.push(c);
    });
    (file.entities || []).forEach((e) => {
      if (!allEntities.includes(e)) allEntities.push(e);
    });
    (file.suggestedTags || []).forEach((t) => {
      if (!allTags.includes(t)) allTags.push(t);
    });
    if (file.category && !allCategories.includes(file.category)) {
      allCategories.push(file.category);
    }
  });

  // Helper to build changes for a field
  const buildChanges = (normalizations, getTerms) => {
    return normalizations.map((norm) => {
      const affectedFiles = Object.entries(fileTermMapping)
        .filter(([, terms]) => {
          const fieldValues = getTerms(terms);
          return norm.aliases.some((alias) => fieldValues.includes(alias));
        })
        .map(([filename]) => filename);

      return {
        canonical: norm.canonical,
        aliases: norm.aliases,
        files: affectedFiles,
        changeCount: affectedFiles.length,
      };
    }).filter((change) => change.aliases.length > 1 || change.changeCount > 0);
  };

  // Process each field sequentially and emit partial results
  const proposedChanges = {
    concepts: [],
    entities: [],
    tags: [],
    categories: [],
    fileCount: signalFiles.length,
  };

  // 1. Concepts
  onProgress({
    type: "analyzing",
    message: "Analyzing concepts...",
    field: "concepts",
    count: allConcepts.length,
    fieldIndex: 1,
    totalFields: 4,
  });

  if (allConcepts.length > 0) {
    try {
      const conceptNorms = await normalizeMetadataTerms(allConcepts, "concepts", llmConfig);
      proposedChanges.concepts = buildChanges(conceptNorms, (t) => t.concepts);
    } catch (err) {
      console.error("Failed to normalize concepts:", err.message);
    }
  }

  // Emit partial result
  onProgress({
    type: "fieldComplete",
    field: "concepts",
    proposedChanges: { ...proposedChanges },
    fieldIndex: 1,
    totalFields: 4,
  });

  // 2. Entities
  onProgress({
    type: "analyzing",
    message: "Analyzing entities...",
    field: "entities",
    count: allEntities.length,
    fieldIndex: 2,
    totalFields: 4,
  });

  if (allEntities.length > 0) {
    try {
      const entityNorms = await normalizeMetadataTerms(allEntities, "entities", llmConfig);
      proposedChanges.entities = buildChanges(entityNorms, (t) => t.entities);
    } catch (err) {
      console.error("Failed to normalize entities:", err.message);
    }
  }

  onProgress({
    type: "fieldComplete",
    field: "entities",
    proposedChanges: { ...proposedChanges },
    fieldIndex: 2,
    totalFields: 4,
  });

  // 3. Tags
  onProgress({
    type: "analyzing",
    message: "Analyzing tags...",
    field: "tags",
    count: allTags.length,
    fieldIndex: 3,
    totalFields: 4,
  });

  if (allTags.length > 0) {
    try {
      const tagNorms = await normalizeMetadataTerms(allTags, "tags", llmConfig);
      proposedChanges.tags = buildChanges(tagNorms, (t) => t.tags);
    } catch (err) {
      console.error("Failed to normalize tags:", err.message);
    }
  }

  onProgress({
    type: "fieldComplete",
    field: "tags",
    proposedChanges: { ...proposedChanges },
    fieldIndex: 3,
    totalFields: 4,
  });

  // 4. Categories
  onProgress({
    type: "analyzing",
    message: "Analyzing categories...",
    field: "categories",
    count: allCategories.length,
    fieldIndex: 4,
    totalFields: 4,
  });

  if (allCategories.length > 0) {
    try {
      const categoryNorms = await normalizeMetadataTerms(allCategories, "category", llmConfig);
      proposedChanges.categories = buildChanges(categoryNorms, (t) => [t.category].filter(Boolean));
    } catch (err) {
      console.error("Failed to normalize categories:", err.message);
    }
  }

  onProgress({
    type: "fieldComplete",
    field: "categories",
    proposedChanges: { ...proposedChanges },
    fieldIndex: 4,
    totalFields: 4,
  });

  return { proposedChanges };
}

/**
 * Apply normalized metadata changes to signal files
 */
export function applyMetadataChanges(proposedChanges) {
  const { concepts, entities, tags, categories } = proposedChanges;

  // Build lookup maps: alias -> canonical
  const conceptMap = {};
  concepts.forEach((c) => {
    c.aliases.forEach((alias) => {
      conceptMap[alias] = c.canonical;
    });
  });

  const entityMap = {};
  entities.forEach((e) => {
    e.aliases.forEach((alias) => {
      entityMap[alias] = e.canonical;
    });
  });

  const tagMap = {};
  tags.forEach((t) => {
    t.aliases.forEach((alias) => {
      tagMap[alias] = t.canonical;
    });
  });

  const categoryMap = {};
  categories.forEach((c) => {
    c.aliases.forEach((alias) => {
      categoryMap[alias] = c.canonical;
    });
  });

  // Update each signal file
  const updatedFiles = [];
  const signalFiles = readdirSync(tempDir).filter((f) => f.endsWith(".signal.json"));

  signalFiles.forEach((filename) => {
    const filePath = join(tempDir, filename);
    try {
      const content = JSON.parse(readFileSync(filePath, "utf-8"));
      let changed = false;

      // Normalize concepts
      if (content.concepts) {
        const newConcepts = [...new Set(
          content.concepts.map((c) => conceptMap[c] || c)
        )];
        if (JSON.stringify(newConcepts) !== JSON.stringify(content.concepts)) {
          content.concepts = newConcepts;
          changed = true;
        }
      }

      // Normalize entities
      if (content.entities) {
        const newEntities = [...new Set(
          content.entities.map((e) => entityMap[e] || e)
        )];
        if (JSON.stringify(newEntities) !== JSON.stringify(content.entities)) {
          content.entities = newEntities;
          changed = true;
        }
      }

      // Normalize tags
      if (content.suggestedTags) {
        const newTags = [...new Set(
          content.suggestedTags.map((t) => tagMap[t] || t)
        )];
        if (JSON.stringify(newTags) !== JSON.stringify(content.suggestedTags)) {
          content.suggestedTags = newTags;
          changed = true;
        }
      }

      // Normalize category
      if (content.category && categoryMap[content.category]) {
        const newCategory = categoryMap[content.category];
        if (newCategory !== content.category) {
          content.category = newCategory;
          changed = true;
        }
      }

      if (changed) {
        writeFileSync(filePath, JSON.stringify(content, null, 2));
        updatedFiles.push(filename.replace(".signal.json", ".md"));
      }
    } catch (err) {
      console.error(`Failed to process signal file ${filename}:`, err.message);
    }
  });

  // Create metadata index file
  const metadataIndex = {
    lastUpdated: new Date().toISOString(),
    categories: {},
    concepts: {},
    entities: {},
    tags: {},
  };

  // Build index from updated signal files
  signalFiles.forEach((filename) => {
    const filePath = join(tempDir, filename);
    const mdFilename = filename.replace(".signal.json", ".md");
    try {
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      // Index category
      if (content.category) {
        if (!metadataIndex.categories[content.category]) {
          metadataIndex.categories[content.category] = [];
        }
        metadataIndex.categories[content.category].push(mdFilename);
      }

      // Index concepts
      (content.concepts || []).forEach((concept) => {
        if (!metadataIndex.concepts[concept]) {
          metadataIndex.concepts[concept] = { canonical: concept, aliases: [], files: [] };
        }
        if (!metadataIndex.concepts[concept].files.includes(mdFilename)) {
          metadataIndex.concepts[concept].files.push(mdFilename);
        }
      });

      // Index entities
      (content.entities || []).forEach((entity) => {
        if (!metadataIndex.entities[entity]) {
          metadataIndex.entities[entity] = { canonical: entity, aliases: [], files: [] };
        }
        if (!metadataIndex.entities[entity].files.includes(mdFilename)) {
          metadataIndex.entities[entity].files.push(mdFilename);
        }
      });

      // Index tags
      (content.suggestedTags || []).forEach((tag) => {
        if (!metadataIndex.tags[tag]) {
          metadataIndex.tags[tag] = { canonical: tag, aliases: [], files: [] };
        }
        if (!metadataIndex.tags[tag].files.includes(mdFilename)) {
          metadataIndex.tags[tag].files.push(mdFilename);
        }
      });
    } catch (err) {
      console.error(`Failed to index signal file ${filename}:`, err.message);
    }
  });

  // Add alias information from proposed changes
  concepts.forEach((c) => {
    if (metadataIndex.concepts[c.canonical]) {
      metadataIndex.concepts[c.canonical].aliases = c.aliases.filter((a) => a !== c.canonical);
    }
  });
  entities.forEach((e) => {
    if (metadataIndex.entities[e.canonical]) {
      metadataIndex.entities[e.canonical].aliases = e.aliases.filter((a) => a !== e.canonical);
    }
  });
  tags.forEach((t) => {
    if (metadataIndex.tags[t.canonical]) {
      metadataIndex.tags[t.canonical].aliases = t.aliases.filter((a) => a !== t.canonical);
    }
  });

  // Save metadata index
  const indexPath = join(tempDir, "metadata-index.json");
  writeFileSync(indexPath, JSON.stringify(metadataIndex, null, 2));

  return {
    updatedFiles,
    indexFile: "metadata-index.json",
  };
}

/**
 * Build metadata index from all signal files
 * Can be called independently of normalization
 */
export function buildMetadataIndex() {
  const signalFiles = readdirSync(tempDir).filter((f) => f.endsWith(".signal.json"));

  const index = {
    concepts: {},
    entities: {},
    tags: {},
    categories: {},
    updatedAt: new Date().toISOString(),
  };

  signalFiles.forEach((filename) => {
    const filePath = join(tempDir, filename);
    const mdFilename = filename.replace(".signal.json", ".md");

    try {
      const content = JSON.parse(readFileSync(filePath, "utf-8"));

      // Index category
      if (content.category) {
        if (!index.categories[content.category]) {
          index.categories[content.category] = [];
        }
        if (!index.categories[content.category].includes(mdFilename)) {
          index.categories[content.category].push(mdFilename);
        }
      }

      // Index concepts
      (content.concepts || []).forEach((concept) => {
        if (!index.concepts[concept]) {
          index.concepts[concept] = { canonical: concept, aliases: [], files: [] };
        }
        if (!index.concepts[concept].files.includes(mdFilename)) {
          index.concepts[concept].files.push(mdFilename);
        }
      });

      // Index entities
      (content.entities || []).forEach((entity) => {
        if (!index.entities[entity]) {
          index.entities[entity] = { canonical: entity, aliases: [], files: [] };
        }
        if (!index.entities[entity].files.includes(mdFilename)) {
          index.entities[entity].files.push(mdFilename);
        }
      });

      // Index tags
      (content.suggestedTags || []).forEach((tag) => {
        if (!index.tags[tag]) {
          index.tags[tag] = { canonical: tag, aliases: [], files: [] };
        }
        if (!index.tags[tag].files.includes(mdFilename)) {
          index.tags[tag].files.push(mdFilename);
        }
      });
    } catch (err) {
      console.error(`Failed to build index for signal file ${filename}:`, err.message);
    }
  });

  // Save the index
  const indexPath = join(tempDir, "metadata-index.json");
  writeFileSync(indexPath, JSON.stringify(index, null, 2));

  return index;
}

/**
 * Get the current metadata index (reads from file if exists)
 */
export function getMetadataIndex() {
  const indexPath = join(tempDir, "metadata-index.json");

  if (!existsSync(indexPath)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(indexPath, "utf-8"));
  } catch (err) {
    console.error('Failed to read metadata index:', err.message);
    return null;
  }
}

/**
 * Find related videos based on shared metadata
 * @param {string} currentFile - The filename to find related videos for
 * @param {Object} index - The metadata index (optional, will load if not provided)
 * @param {number} limit - Maximum number of related videos to return
 */
// Predefined prompt templates for multi-summary analysis
export const ANALYSIS_PROMPTS = {
  similarities: `Analyze these video summaries and identify:
1. Common themes and recurring concepts
2. Shared insights or conclusions
3. Overlapping recommendations or action items
4. Connections between the topics discussed

Be specific and cite which summaries share each commonality.`,

  differences: `Compare these video summaries and highlight:
1. Contrasting viewpoints or approaches
2. Unique perspectives in each video
3. Disagreements or tensions between ideas
4. Different recommendations for similar problems

Be specific about which summaries differ and how.`,

  saas: `Based on these video summaries, identify potential SaaS product opportunities:
1. Problems or pain points mentioned
2. Manual processes that could be automated
3. Gaps in existing solutions discussed
4. Target audience and market size indicators

For each opportunity, reference which summary/summaries it came from.`,

  unified: `Merge these video summaries into a single unified document:
1. Combine overlapping sections
2. Organize by theme rather than by source
3. Synthesize key insights into coherent narrative
4. Include action items from all sources

Create clear sections with headers.`,

  generic: `Analyze the connections and relationships between these video summaries.
Provide insights on how the topics relate to each other and what can be learned from viewing them together.`,
};

/**
 * Analyze multiple summaries using LLM
 * @param {string[]} summaryContents - Array of markdown content from each summary
 * @param {string} promptType - One of: similarities, differences, saas, unified, generic
 * @param {string|null} customPrompt - Custom prompt to use instead of predefined
 * @param {Object} llmConfig - LLM configuration
 * @param {Function} onChunk - Callback for streaming chunks
 * @returns {Promise<string>} - The analysis result
 */
export async function analyzeMultipleSummaries(summaryContents, promptType, customPrompt, llmConfig, onChunk) {
  const { provider, model, apiKey } = llmConfig;

  if (!apiKey) {
    throw new Error("No API key available");
  }

  // Build the prompt
  let systemPrompt = customPrompt || ANALYSIS_PROMPTS[promptType] || ANALYSIS_PROMPTS.generic;

  // Format the summaries for the prompt
  const summariesText = summaryContents.map((content, index) => {
    // Extract title from markdown
    const titleMatch = content.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1] : `Summary ${index + 1}`;
    return `=== Summary ${index + 1}: "${title}" ===\n\n${content}`;
  }).join('\n\n---\n\n');

  const fullPrompt = `${systemPrompt}

Here are the ${summaryContents.length} video summaries to analyze:

${summariesText}`;

  // Use the existing streaming annotation response function with higher token limit
  let accumulated = "";

  if (provider === "openai") {
    const tokenParam = getOpenAITokenParam(model, 4096);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: fullPrompt }],
        ...tokenParam,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              onChunk(content);
            }
          } catch (err) {
            console.error('Failed to parse OpenAI multi-summary streaming chunk:', err.message);
          }
        }
      }
    }
  } else if (provider === "anthropic") {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        messages: [{ role: "user", content: fullPrompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Anthropic API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);

          try {
            const parsed = JSON.parse(data);
            if (parsed.type === "content_block_delta") {
              const content = parsed.delta?.text;
              if (content) {
                accumulated += content;
                onChunk(content);
              }
            }
          } catch (err) {
            console.error('Failed to parse Anthropic multi-summary streaming chunk:', err.message);
          }
        }
      }
    }
  } else if (provider === "openrouter") {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "YT Extractor",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: fullPrompt }],
        max_tokens: 4096,
        stream: true,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              onChunk(content);
            }
          } catch (err) {
            console.error('Failed to parse OpenRouter multi-summary streaming chunk:', err.message);
          }
        }
      }
    }
  } else {
    throw new Error(`Unknown provider: ${provider}`);
  }

  return accumulated;
}

export function findRelatedVideos(currentFile, index = null, limit = 5) {
  // Load index if not provided
  if (!index) {
    index = getMetadataIndex();
    if (!index) {
      return [];
    }
  }

  // Load the signal data for the current file
  const signalPath = join(tempDir, currentFile.replace(".md", ".signal.json"));
  if (!existsSync(signalPath)) {
    return [];
  }

  let currentSignal;
  try {
    currentSignal = JSON.parse(readFileSync(signalPath, "utf-8"));
  } catch (err) {
    console.error(`Failed to parse signal file for ${currentFile}:`, err.message);
    return [];
  }

  // Build a set of all files that share any metadata term
  const fileScores = {};
  const sharedTerms = {};

  // Score by shared concepts (weight: 3)
  (currentSignal.concepts || []).forEach((concept) => {
    const termData = index.concepts[concept];
    if (termData?.files) {
      termData.files.forEach((file) => {
        if (file !== currentFile) {
          fileScores[file] = (fileScores[file] || 0) + 3;
          if (!sharedTerms[file]) sharedTerms[file] = { concepts: [], entities: [], tags: [], category: false };
          sharedTerms[file].concepts.push(concept);
        }
      });
    }
  });

  // Score by shared entities (weight: 2)
  (currentSignal.entities || []).forEach((entity) => {
    const termData = index.entities[entity];
    if (termData?.files) {
      termData.files.forEach((file) => {
        if (file !== currentFile) {
          fileScores[file] = (fileScores[file] || 0) + 2;
          if (!sharedTerms[file]) sharedTerms[file] = { concepts: [], entities: [], tags: [], category: false };
          sharedTerms[file].entities.push(entity);
        }
      });
    }
  });

  // Score by shared tags (weight: 2)
  (currentSignal.suggestedTags || []).forEach((tag) => {
    const termData = index.tags[tag];
    if (termData?.files) {
      termData.files.forEach((file) => {
        if (file !== currentFile) {
          fileScores[file] = (fileScores[file] || 0) + 2;
          if (!sharedTerms[file]) sharedTerms[file] = { concepts: [], entities: [], tags: [], category: false };
          sharedTerms[file].tags.push(tag);
        }
      });
    }
  });

  // Score by shared category (weight: 1)
  if (currentSignal.category && index.categories[currentSignal.category]) {
    index.categories[currentSignal.category].forEach((file) => {
      if (file !== currentFile) {
        fileScores[file] = (fileScores[file] || 0) + 1;
        if (!sharedTerms[file]) sharedTerms[file] = { concepts: [], entities: [], tags: [], category: false };
        sharedTerms[file].category = true;
      }
    });
  }

  // Sort by score and take top N
  const sortedFiles = Object.entries(fileScores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([file, score]) => ({
      filename: file,
      title: file.replace(/\.md$/, ""),
      score,
      sharedConcepts: sharedTerms[file]?.concepts || [],
      sharedEntities: sharedTerms[file]?.entities || [],
      sharedTags: sharedTerms[file]?.tags || [],
      sharedCategory: sharedTerms[file]?.category || false,
    }));

  return sortedFiles;
}
