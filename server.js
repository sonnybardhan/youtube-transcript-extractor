import express from "express";
import {
  readFileSync,
  readdirSync,
  unlinkSync,
  existsSync,
  statSync,
  writeFileSync,
  mkdirSync,
} from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import {
  extract,
  extractBasic,
  processWithLLMAndFormat,
  reprocessWithLLM,
  getTempDir,
  getPromptsDir,
  DEFAULT_PROMPT,
  getPromptForCompression,
  sanitizeFilename,
  streamWithLLM,
  convertToSubheadings,
} from "./lib/extractor.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const PROMPT_FILE = join(getPromptsDir(), "custom-prompt.txt");

// Load .env file if present
const envPath = join(__dirname, ".env");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf-8")
    .split("\n")
    .forEach((line) => {
      const [key, ...vals] = line.split("=");
      if (key && vals.length) process.env[key.trim()] = vals.join("=").trim();
    });
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, "public")));

// Helper to get API key for a given provider
function getApiKeyForProvider(provider) {
  switch (provider) {
    case "openai":
      return process.env.OPENAI_API_KEY;
    case "anthropic":
      return process.env.ANTHROPIC_API_KEY;
    case "openrouter":
      return process.env.OPENROUTER_API_KEY;
    default:
      return null;
  }
}

// Extract transcript(s) from URL(s) - full extraction
app.post("/api/extract", async (req, res) => {
  const { urls, llm, customPrompt, compressionLevel } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: "urls array is required" });
  }

  // Build LLM config if provider specified
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = getApiKeyForProvider(llm.provider);

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        customPrompt: customPrompt || null,
        compressionLevel: compressionLevel ?? 50,
      };
    }
  }

  const results = [];
  const errors = [];

  for (const url of urls) {
    try {
      const result = await extract(url.trim(), llmConfig);
      results.push({
        url,
        title: result.title,
        filename: result.filename,
        markdown: result.output,
        videoId: result.videoId,
        hasTranscript: result.hasTranscript,
        noTranscriptWarning: result.noTranscriptWarning,
      });
    } catch (err) {
      errors.push({ url, error: err.message });
    }
  }

  res.json({ results, errors });
});

// Basic extraction - returns transcript and metadata instantly (no LLM)
app.post("/api/extract/basic", async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: "url is required" });
  }

  try {
    const basicInfo = await extractBasic(url.trim());
    res.json({
      success: true,
      data: basicInfo,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process with LLM - takes basic info and returns LLM-processed content
app.post("/api/extract/process", async (req, res) => {
  const { basicInfo, llm, customPrompt, compressionLevel } = req.body;

  if (!basicInfo) {
    return res.status(400).json({ error: "basicInfo is required" });
  }

  if (!basicInfo.hasTranscript) {
    return res
      .status(400)
      .json({ error: "No transcript available for LLM processing" });
  }

  // Build LLM config
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = getApiKeyForProvider(llm.provider);

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        customPrompt: customPrompt || null,
        compressionLevel: compressionLevel ?? 50,
      };
    }
  }

  if (!llmConfig) {
    return res.status(400).json({ error: "Valid LLM configuration required" });
  }

  try {
    const result = await processWithLLMAndFormat(basicInfo, llmConfig);
    res.json({
      success: true,
      title: result.title,
      filename: result.filename,
      markdown: result.output,
      videoId: result.videoId,
      llmError: result.llmError,
      promptUsed: result.promptUsed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Process with LLM using streaming SSE
app.post("/api/extract/process/stream", async (req, res) => {
  const { basicInfo, llm, compressionLevel, isRerun } = req.body;

  if (!basicInfo) {
    return res.status(400).json({ error: "basicInfo is required" });
  }

  if (!basicInfo.hasTranscript) {
    return res
      .status(400)
      .json({ error: "No transcript available for LLM processing" });
  }

  // Build LLM config
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = getApiKeyForProvider(llm.provider);

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        compressionLevel: compressionLevel ?? 50,
      };
    }
  }

  if (!llmConfig) {
    return res.status(400).json({ error: "Valid LLM configuration required" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

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

  // Create file immediately so it appears in history right away
  const tempDir = getTempDir();
  let filename;
  if (isRerun) {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    filename = `${sanitizeFilename(title)} (${timestamp}).md`;
  } else {
    filename = `${sanitizeFilename(title)}.md`;
  }
  const mdPath = join(tempDir, filename);

  // Write initial placeholder file
  const initialContent = `# ${title}\n\n*Processing...*\n`;
  writeFileSync(mdPath, initialContent);

  // Send filename immediately so client can add to history
  res.write(`data: ${JSON.stringify({ filename, title, processing: true })}\n\n`);

  try {
    // Stream chunks as SSE events
    const onChunk = (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    };

    // Call streaming LLM function
    const llmResult = await streamWithLLM(transcript, title, llmConfig, onChunk);

    if (!llmResult) {
      res.write(`data: ${JSON.stringify({ error: "LLM processing failed" })}\n\n`);
      res.end();
      return;
    }

    const llmContent = llmResult.result;
    const promptUsed = llmResult.promptUsed;

    // Generate markdown from the result
    const originalTranscriptFormatted =
      transcriptFormatted || "No transcript available for this video.";

    let output = "";

    output += `# ${title}\n\n`;

    if (llmContent?.tldr) {
      output += `## TLDR\n\n${llmContent.tldr}\n\n`;
    }

    if (llmContent?.keyInsights?.length > 0) {
      output += `## Key Insights\n\n${llmContent.keyInsights.map((insight) => `- ${insight}`).join("\n")}\n\n`;
    }

    if (llmContent?.actionItems?.length > 0) {
      output += `## Action Items & Takeaways\n\n${llmContent.actionItems.map((item) => `- ${item}`).join("\n")}\n\n`;
    }

    output += `## Metadata\n\n`;
    output += `- **Channel:** ${channel}\n`;
    output += `- **Published:** ${publishDate}\n`;
    output += `- **Duration:** ${duration}\n`;
    output += `- **Views:** ${views}\n`;
    output += `- **URL:** https://youtube.com/watch?v=${videoId}\n\n`;

    output += `## Description\n\n${description}\n\n`;

    output += `## Summary\n\n${(llmContent?.summary || llmContent?.transcript) ? convertToSubheadings(llmContent.summary || llmContent.transcript) : originalTranscriptFormatted}\n\n`;

    output += `---\n\n<details>\n<summary>Original Transcript</summary>\n\n${originalTranscriptFormatted}\n\n</details>`;

    // Update the file with final content (file was created at start of stream)
    writeFileSync(mdPath, output);

    // Send completion event with parsed markdown
    res.write(
      `data: ${JSON.stringify({
        complete: true,
        markdown: output,
        filename,
        title,
        videoId,
        promptUsed,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Streaming reprocess endpoint
app.post("/api/reprocess/stream", async (req, res) => {
  const { filename, llm, compressionLevel } = req.body;

  if (!filename) {
    return res.status(400).json({ error: "filename is required" });
  }

  const tempDir = getTempDir();
  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  // Read the file and extract original transcript
  const content = readFileSync(filePath, "utf-8");

  const detailsMatch = content.match(
    /<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i,
  );
  if (!detailsMatch) {
    return res
      .status(400)
      .json({ error: "No original transcript found in file" });
  }

  const originalTranscript = detailsMatch[1].trim();

  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(".md", "");

  // Build LLM config
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = getApiKeyForProvider(llm.provider);

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        compressionLevel: compressionLevel ?? 50,
      };
    }
  }

  if (!llmConfig) {
    return res.status(400).json({ error: "Valid LLM configuration required" });
  }

  // Set up SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  try {
    const onChunk = (chunk) => {
      res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
    };

    const llmResult = await streamWithLLM(originalTranscript, title, llmConfig, onChunk);

    if (!llmResult) {
      res.write(`data: ${JSON.stringify({ error: "LLM processing failed" })}\n\n`);
      res.end();
      return;
    }

    const llmContent = llmResult.result;
    const promptUsed = llmResult.promptUsed;

    // Create new filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const baseTitle = title.replace(/ \(\d{4}-\d{2}-\d{2}T.*\)$/, "");
    const newFilename = `${sanitizeFilename(baseTitle)} (${timestamp}).md`;

    // Extract metadata from original file
    const metadataMatch = content.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
    const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);

    // Build new markdown
    let output = "";

    output += `# ${title}\n\n`;

    if (llmContent?.tldr) {
      output += `## TLDR\n\n${llmContent.tldr}\n\n`;
    }

    if (llmContent?.keyInsights?.length > 0) {
      output += `## Key Insights\n\n${llmContent.keyInsights.map((i) => `- ${i}`).join("\n")}\n\n`;
    }

    if (llmContent?.actionItems?.length > 0) {
      output += `## Action Items & Takeaways\n\n${llmContent.actionItems.map((i) => `- ${i}`).join("\n")}\n\n`;
    }

    if (metadataMatch) {
      output += `## Metadata\n\n${metadataMatch[1]}`;
    }

    if (descMatch) {
      output += `## Description\n\n${descMatch[1]}`;
    }

    output += `## Content Breakdown\n\n${(llmContent?.summary || llmContent?.transcript) ? convertToSubheadings(llmContent.summary || llmContent.transcript) : originalTranscript}\n\n---\n\n<details>\n<summary>Original Transcript</summary>\n\n${originalTranscript}\n\n</details>`;

    // Save new file
    const newPath = join(tempDir, newFilename);
    writeFileSync(newPath, output);

    res.write(
      `data: ${JSON.stringify({
        complete: true,
        filename: newFilename,
        markdown: output,
        title,
        promptUsed,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Reprocess existing file through LLM (creates new file)
app.post("/api/reprocess", async (req, res) => {
  const { filename, llm, customPrompt, compressionLevel } = req.body;

  if (!filename) {
    return res.status(400).json({ error: "filename is required" });
  }

  const tempDir = getTempDir();
  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  // Read the file and extract original transcript
  const content = readFileSync(filePath, "utf-8");

  // Extract original transcript from <details> section
  const detailsMatch = content.match(
    /<details>\s*<summary>Original Transcript<\/summary>([\s\S]*?)<\/details>/i,
  );
  if (!detailsMatch) {
    return res
      .status(400)
      .json({ error: "No original transcript found in file" });
  }

  const originalTranscript = detailsMatch[1].trim();

  // Extract title from markdown
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename.replace(".md", "");

  // Build LLM config
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = getApiKeyForProvider(llm.provider);

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        customPrompt: customPrompt || null,
        compressionLevel: compressionLevel ?? 50,
      };
    }
  }

  if (!llmConfig) {
    return res.status(400).json({ error: "Valid LLM configuration required" });
  }

  try {
    const llmResult = await reprocessWithLLM(
      originalTranscript,
      title,
      llmConfig,
    );

    const llmContent = llmResult?.result;
    const promptUsed = llmResult?.promptUsed;

    // Create new filename with timestamp
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const baseTitle = title.replace(/ \(\d{4}-\d{2}-\d{2}T.*\)$/, ""); // Remove old timestamp if present
    const newFilename = `${sanitizeFilename(baseTitle)} (${timestamp}).md`;

    // Extract metadata from original file
    const metadataMatch = content.match(/## Metadata\n\n([\s\S]*?)(?=\n## |$)/);
    const descMatch = content.match(/## Description\n\n([\s\S]*?)(?=\n## |$)/);

    // Build new markdown
    let output = "";

    output += `# ${title}\n\n`;

    if (llmContent?.tldr) {
      output += `## TLDR\n\n${llmContent.tldr}\n\n`;
    }

    if (llmContent?.keyInsights?.length > 0) {
      output += `## Key Insights\n\n${llmContent.keyInsights.map((i) => `- ${i}`).join("\n")}\n\n`;
    }

    if (llmContent?.actionItems?.length > 0) {
      output += `## Action Items & Takeaways\n\n${llmContent.actionItems.map((i) => `- ${i}`).join("\n")}\n\n`;
    }

    if (metadataMatch) {
      output += `## Metadata\n\n${metadataMatch[1]}`;
    }

    if (descMatch) {
      output += `## Description\n\n${descMatch[1]}`;
    }

    output += `## Content Breakdown\n\n${(llmContent?.summary || llmContent?.transcript) ? convertToSubheadings(llmContent.summary || llmContent.transcript) : originalTranscript}\n\n---\n\n<details>\n<summary>Original Transcript</summary>\n\n${originalTranscript}\n\n</details>`;

    // Save new file
    const newPath = join(tempDir, newFilename);
    writeFileSync(newPath, output);

    res.json({
      success: true,
      filename: newFilename,
      markdown: output,
      title,
      promptUsed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List all extractions in temp/
app.get("/api/history", (_req, res) => {
  const tempDir = getTempDir();

  if (!existsSync(tempDir)) {
    return res.json([]);
  }

  const files = readdirSync(tempDir)
    .filter((f) => f.endsWith(".md"))
    .map((filename) => {
      const filePath = join(tempDir, filename);
      const stat = statSync(filePath);
      return {
        filename,
        title: filename.replace(/\.md$/, ""),
        date: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(files);
});

// Get specific extraction
app.get("/api/history/:filename", (req, res) => {
  const tempDir = getTempDir();
  const filename = req.params.filename;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  const content = readFileSync(filePath, "utf-8");
  res.json({ filename, content });
});

// Delete extraction
app.delete("/api/history/:filename", (req, res) => {
  const tempDir = getTempDir();
  const filename = req.params.filename;

  // Prevent path traversal
  if (filename.includes("..") || filename.includes("/")) {
    return res.status(400).json({ error: "Invalid filename" });
  }

  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  unlinkSync(filePath);
  res.json({ success: true });
});

// Get available API keys status (without exposing the keys)
app.get("/api/config", (_req, res) => {
  res.json({
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY,
    hasOpenRouter: !!process.env.OPENROUTER_API_KEY,
  });
});

// Get prompt (default and custom)
app.get("/api/prompt", (_req, res) => {
  let customPrompt = null;
  if (existsSync(PROMPT_FILE)) {
    customPrompt = readFileSync(PROMPT_FILE, "utf-8");
  }
  res.json({
    defaultPrompt: DEFAULT_PROMPT,
    customPrompt,
  });
});

// Save custom prompt
app.post("/api/prompt", (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "prompt is required" });
  }

  const tempDir = getTempDir();
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  writeFileSync(PROMPT_FILE, prompt);
  res.json({ success: true });
});

// Delete custom prompt (reset to default)
app.delete("/api/prompt", (_req, res) => {
  if (existsSync(PROMPT_FILE)) {
    unlinkSync(PROMPT_FILE);
  }
  res.json({ success: true });
});

// Global error handler - ensures all errors return JSON instead of HTML
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 404 handler for API routes - ensures 404s return JSON
app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'API endpoint not found' });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
