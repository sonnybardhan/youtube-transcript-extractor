import express from 'express';
import { readFileSync, readdirSync, unlinkSync, existsSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { extract, getTempDir, DEFAULT_PROMPT } from './lib/extractor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const PROMPT_FILE = join(__dirname, 'temp', 'custom-prompt.txt');

// Load .env file if present
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

// Extract transcript(s) from URL(s)
app.post('/api/extract', async (req, res) => {
  const { urls, llm, customPrompt } = req.body;

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return res.status(400).json({ error: 'urls array is required' });
  }

  // Build LLM config if provider specified
  let llmConfig = null;
  if (llm?.provider && llm?.model) {
    const apiKey = llm.provider === 'openai'
      ? process.env.OPENAI_API_KEY
      : process.env.ANTHROPIC_API_KEY;

    if (apiKey) {
      llmConfig = {
        provider: llm.provider,
        model: llm.model,
        apiKey,
        customPrompt: customPrompt || null
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
        videoId: result.videoId
      });
    } catch (err) {
      errors.push({ url, error: err.message });
    }
  }

  res.json({ results, errors });
});

// List all extractions in temp/
app.get('/api/history', (_req, res) => {
  const tempDir = getTempDir();

  if (!existsSync(tempDir)) {
    return res.json([]);
  }

  const files = readdirSync(tempDir)
    .filter(f => f.endsWith('.md'))
    .map(filename => {
      const filePath = join(tempDir, filename);
      const stat = statSync(filePath);
      return {
        filename,
        title: filename.replace(/\.md$/, ''),
        date: stat.mtime.toISOString()
      };
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  res.json(files);
});

// Get specific extraction
app.get('/api/history/:filename', (req, res) => {
  const tempDir = getTempDir();
  const filename = req.params.filename;

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  const content = readFileSync(filePath, 'utf-8');
  res.json({ filename, content });
});

// Delete extraction
app.delete('/api/history/:filename', (req, res) => {
  const tempDir = getTempDir();
  const filename = req.params.filename;

  // Prevent path traversal
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }

  const filePath = join(tempDir, filename);

  if (!existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }

  unlinkSync(filePath);
  res.json({ success: true });
});

// Get available API keys status (without exposing the keys)
app.get('/api/config', (_req, res) => {
  res.json({
    hasOpenAI: !!process.env.OPENAI_API_KEY,
    hasAnthropic: !!process.env.ANTHROPIC_API_KEY
  });
});

// Get prompt (default and custom)
app.get('/api/prompt', (_req, res) => {
  let customPrompt = null;
  if (existsSync(PROMPT_FILE)) {
    customPrompt = readFileSync(PROMPT_FILE, 'utf-8');
  }
  res.json({
    defaultPrompt: DEFAULT_PROMPT,
    customPrompt
  });
});

// Save custom prompt
app.post('/api/prompt', (req, res) => {
  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: 'prompt is required' });
  }

  const tempDir = getTempDir();
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  writeFileSync(PROMPT_FILE, prompt);
  res.json({ success: true });
});

// Delete custom prompt (reset to default)
app.delete('/api/prompt', (_req, res) => {
  if (existsSync(PROMPT_FILE)) {
    unlinkSync(PROMPT_FILE);
  }
  res.json({ success: true });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
