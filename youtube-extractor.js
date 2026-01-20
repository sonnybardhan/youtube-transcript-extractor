#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = join(__dirname, 'temp');

// Helper to get the correct token limit parameter for OpenAI models
function getOpenAITokenParam(model, tokens = 4096) {
  if (model.startsWith("gpt-5") || model.startsWith("gpt-4.1")) {
    return { max_completion_tokens: tokens };
  }
  return { max_tokens: tokens };
}

// Load .env file if present
const envPath = join(__dirname, '.env');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  });
}

const url = process.argv[2];
const outputFile = process.argv[3]; // optional

if (!url) {
  console.error('Usage: node youtube-extractor.js <YouTube URL> [output.md]');
  process.exit(1);
}

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/ // direct video ID
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  throw new Error('Could not extract video ID from URL');
}

function cleanSubtitleText(srtContent) {
  // Remove SRT formatting (timestamps, sequence numbers) and clean up
  return srtContent
    .split('\n')
    .filter(line => {
      // Skip sequence numbers (just digits)
      if (/^\d+$/.test(line.trim())) return false;
      // Skip timestamp lines
      if (/^\d{2}:\d{2}:\d{2}/.test(line.trim())) return false;
      return true;
    })
    .map(line => line.trim())
    .filter(line => line.length > 0)
    // Remove duplicate consecutive lines (common in auto-subs)
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .join(' ')
    // Clean up multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

async function processWithLLM(transcript, title) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('OPENAI_API_KEY not set, skipping LLM processing');
    return null;
  }

  console.error('Processing with LLM...');

  const model = 'gpt-4o-mini';
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a helpful assistant that processes video transcripts. Given a raw transcript, you will:
1. Write a concise TLDR (2-3 sentences) summarizing the key points
2. Format the transcript into readable paragraphs with proper punctuation

Respond in this exact JSON format:
{"tldr": "Your summary here", "transcript": "Formatted transcript here"}`
        },
        {
          role: 'user',
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`
        }
      ],
      ...getOpenAITokenParam(model),
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    console.error('LLM API error:', response.status);
    return null;
  }

  const data = await response.json();
  try {
    return JSON.parse(data.choices[0].message.content);
  } catch {
    return null;
  }
}

async function extract(url) {
  const videoId = extractVideoId(url);
  mkdirSync(tempDir, { recursive: true });
  const tempPrefix = join(tempDir, videoId);

  console.error('Fetching metadata...');
  
  // Get metadata
  run(`yt-dlp --write-info-json --skip-download -o "${tempPrefix}" "${url}"`);
  
  const infoPath = `${tempPrefix}.info.json`;
  if (!existsSync(infoPath)) {
    throw new Error('Failed to fetch video metadata. Check if yt-dlp is installed.');
  }
  
  const info = JSON.parse(readFileSync(infoPath, 'utf-8'));
  
  console.error('Fetching transcript...');
  
  // Try to get subtitles (prefer manual, fallback to auto-generated)
  let transcript = null;
  
  // Try manual English subs first
  run(`yt-dlp --write-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`);
  
  let subPath = `${tempPrefix}.en.srt`;
  if (!existsSync(subPath)) {
    // Try auto-generated
    run(`yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`);
    subPath = `${tempPrefix}.en.srt`;
  }
  
  if (existsSync(subPath)) {
    const rawSrt = readFileSync(subPath, 'utf-8');
    transcript = cleanSubtitleText(rawSrt);
  }

  // Process transcript with LLM if available
  let llmContent = null;
  if (transcript) {
    llmContent = await processWithLLM(transcript, info.title);
  }

  // Format output
  const duration = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`
    : 'Unknown';

  let output = `# ${info.title}

`;

  // Add TLDR at the top if available
  if (llmContent?.tldr) {
    output += `## TLDR
${llmContent.tldr}

`;
  }

  output += `## Metadata
- **Channel:** ${info.channel || info.uploader || 'Unknown'}
- **Published:** ${info.upload_date ? info.upload_date.replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3') : 'Unknown'}
- **Duration:** ${duration}
- **Views:** ${info.view_count?.toLocaleString() || 'Unknown'}
- **URL:** https://youtube.com/watch?v=${videoId}

## Description
${info.description || 'No description available.'}

## Transcript
${llmContent?.transcript || transcript || 'No transcript available for this video.'}`;

  // Save markdown to temp folder
  const mdPath = join(tempDir, `${sanitizeFilename(info.title)}.md`);
  writeFileSync(mdPath, output);

  return { output, mdPath };
}

// Main
try {
  const { output, mdPath } = await extract(url);
  console.error(`Saved to: ${mdPath}`);

  if (outputFile) {
    writeFileSync(outputFile, output);
    console.error(`Also written to: ${outputFile}`);
  } else {
    console.log(output);
  }
} catch (e) {
  console.error('Error:', e.message);
  process.exit(1);
}
