import { execSync } from 'child_process';
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const tempDir = join(__dirname, '..', 'temp');

export const DEFAULT_PROMPT = `You are a helpful assistant that processes video transcripts. Given a raw transcript, you will:

1. Write a concise TLDR (2-3 sentences) summarizing the main topic and key points.

2. Extract 3-7 Key Insights - the most important ideas, findings, or perspectives from the video. Each insight should be a clear, standalone statement.

3. List Action Items or Takeaways - practical steps, recommendations, or things the viewer should remember or do. If the video doesn't have actionable content, provide key takeaways instead.

4. Format the transcript into logical sections:
   - Break the content into thematic sections based on topic changes
   - Give each section a descriptive title (use markdown ## headers)
   - Write a brief 1-2 sentence summary at the start of each section (in italics)
   - Keep the detailed content under each section - summarize for clarity but don't oversimplify or lose important details
   - Use proper punctuation and paragraph breaks

Respond in this exact JSON format:
{
  "tldr": "Your 2-3 sentence summary here",
  "keyInsights": ["Insight 1", "Insight 2", "Insight 3"],
  "actionItems": ["Action or takeaway 1", "Action or takeaway 2"],
  "transcript": "## Section Title\\n\\n*Brief section summary.*\\n\\nDetailed content...\\n\\n## Next Section Title\\n\\n..."
}`;

export function extractVideoId(url) {
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

export function cleanSubtitleText(srtContent) {
  return srtContent
    .split('\n')
    .filter(line => {
      if (/^\d+$/.test(line.trim())) return false;
      if (/^\d{2}:\d{2}:\d{2}/.test(line.trim())) return false;
      return true;
    })
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .filter((line, i, arr) => i === 0 || line !== arr[i - 1])
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function sanitizeFilename(title) {
  return title
    .replace(/[<>:"/\\|?*]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
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
      paragraphs.push(currentParagraph.join(' '));
      currentParagraph = [];
    }
  }

  return paragraphs.join('\n\n');
}

function run(cmd) {
  try {
    // Note: execSync is used here for yt-dlp commands. The URL is validated
    // by extractVideoId before use, ensuring only valid YouTube URLs/IDs pass through.
    return execSync(cmd, { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 });
  } catch (e) {
    return null;
  }
}

async function processWithOpenAI(transcript, title, model, apiKey, customPrompt) {
  const systemPrompt = customPrompt || DEFAULT_PROMPT;

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
          content: systemPrompt
        },
        {
          role: 'user',
          content: `Video title: ${title}\n\nRaw transcript:\n${transcript}`
        }
      ],
      max_tokens: 4096,
      response_format: { type: "json_object" }
    })
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error: ${response.status}`);
  }

  const data = await response.json();
  return JSON.parse(data.choices[0].message.content);
}

async function processWithAnthropic(transcript, title, model, apiKey, customPrompt) {
  const basePrompt = customPrompt || DEFAULT_PROMPT;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `${basePrompt}

Video title: ${title}

Raw transcript:
${transcript}

Respond ONLY with valid JSON, no other text.`
        }
      ]
    })
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
    throw new Error('Could not parse Anthropic response as JSON');
  }
  return JSON.parse(jsonMatch[0]);
}

async function processWithLLM(transcript, title, llmConfig) {
  const { provider, model, apiKey, customPrompt } = llmConfig;

  if (!apiKey) {
    return null;
  }

  if (provider === 'openai') {
    return processWithOpenAI(transcript, title, model, apiKey, customPrompt);
  } else if (provider === 'anthropic') {
    return processWithAnthropic(transcript, title, model, apiKey, customPrompt);
  }

  return null;
}

export async function extract(url, llmConfig = null) {
  const videoId = extractVideoId(url);
  mkdirSync(tempDir, { recursive: true });
  const tempPrefix = join(tempDir, videoId);

  // Get metadata
  run(`yt-dlp --write-info-json --skip-download -o "${tempPrefix}" "${url}"`);

  const infoPath = `${tempPrefix}.info.json`;
  if (!existsSync(infoPath)) {
    throw new Error('Failed to fetch video metadata. Check if yt-dlp is installed.');
  }

  const info = JSON.parse(readFileSync(infoPath, 'utf-8'));

  // Try to get subtitles (prefer manual, fallback to auto-generated)
  let transcript = null;

  run(`yt-dlp --write-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`);

  let subPath = `${tempPrefix}.en.srt`;
  if (!existsSync(subPath)) {
    run(`yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${tempPrefix}" "${url}"`);
    subPath = `${tempPrefix}.en.srt`;
  }

  if (existsSync(subPath)) {
    const rawSrt = readFileSync(subPath, 'utf-8');
    transcript = cleanSubtitleText(rawSrt);
  }

  // Process transcript with LLM if config provided
  let llmContent = null;
  if (transcript && llmConfig) {
    try {
      llmContent = await processWithLLM(transcript, info.title, llmConfig);
    } catch (err) {
      console.error('LLM processing error:', err.message);
    }
  }

  // Format output
  const duration = info.duration
    ? `${Math.floor(info.duration / 60)}:${String(info.duration % 60).padStart(2, '0')}`
    : 'Unknown';

  // Split original transcript into paragraphs (roughly every 3-4 sentences)
  const originalTranscriptFormatted = transcript
    ? formatOriginalTranscript(transcript)
    : 'No transcript available for this video.';

  let output = `# ${info.title}

`;

  if (llmContent?.tldr) {
    output += `## TLDR

${llmContent.tldr}

`;
  }

  if (llmContent?.keyInsights?.length > 0) {
    output += `## Key Insights

${llmContent.keyInsights.map(insight => `- ${insight}`).join('\n')}

`;
  }

  if (llmContent?.actionItems?.length > 0) {
    output += `## Action Items & Takeaways

${llmContent.actionItems.map(item => `- ${item}`).join('\n')}

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

${llmContent?.transcript || originalTranscriptFormatted}

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
    videoId
  };
}

export function getTempDir() {
  return tempDir;
}
