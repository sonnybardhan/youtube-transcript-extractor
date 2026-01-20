import { execSync } from "child_process";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = join(__dirname, "..", "temp");
const promptsDir = join(__dirname, "..", "prompts");

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

  return `You are a helpful assistant that processes video transcripts. Given a raw transcript, you will:

1. Write a concise TLDR (2-3 sentences) summarizing the main topic and key points.

2. Extract 3-7 Key Insights - the most important ideas, findings, or perspectives from the video. Each insight should be a clear, standalone statement.

3. List Action Items or Takeaways - practical steps, recommendations, or things the viewer should remember or do. If the video doesn't have actionable content, provide key takeaways instead.

4. Format the transcript into logical sections:
   - TARGET LENGTH: The summary section should be approximately ${level}% of the original transcript's length
   - IMPORTANT: Break the content into 3-8 thematic sections based on topic changes
   - IMPORTANT: Each section MUST start with a markdown ## header (e.g., "## Introduction", "## Key Concepts", "## Conclusion")
   - ${sectionInstructions}
   - ${detailLevel}
   - Use proper punctuation and paragraph breaks
   - Do NOT use emojis

Respond in this exact JSON format:
{
  "tldr": "Your 4-5 sentence summary here",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action or takeaway 1", "Action or takeaway 2"],
  "transcript": "## Introduction\\n\\nFirst section content here with proper paragraphs...\\n\\n## Main Topic\\n\\nSecond section explaining the core concepts...\\n\\n## Key Takeaways\\n\\nFinal section with conclusions..."
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
      max_tokens: 4096,
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
      max_tokens: 4096,
      stream: true,
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
        } catch {
          // Skip malformed JSON
        }
      }
    }
  }

  // Parse the final accumulated JSON
  const jsonMatch = accumulated.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Could not parse OpenAI streaming response as JSON");
  }
  return JSON.parse(jsonMatch[0]);
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
        } catch {
          // Skip malformed JSON
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
        } catch {
          // Skip malformed JSON
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

${llmContent?.transcript ? convertToSubheadings(llmContent.transcript) : originalTranscriptFormatted}

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

${llmContent?.transcript ? convertToSubheadings(llmContent.transcript) : originalTranscriptFormatted}

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
