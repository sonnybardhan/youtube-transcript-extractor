# YouTube Transcript Extractor

A local web app and CLI tool that extracts YouTube video metadata and transcripts using `yt-dlp`. Optionally processes transcripts with LLMs (OpenAI or Anthropic) to generate summaries, insights, and well-structured content.

## Features

- **Video Extraction** - metadata (title, channel, date, duration, views, description) and English subtitles
- **LLM Processing** (optional) - generates:
  - TLDR summary (2-3 sentences)
  - Key Insights (3-7 important ideas)
  - Action Items & Takeaways
  - Sectioned transcript with topic headers and summaries
- **Original Transcript Preserved** - collapsible section with raw transcript split into paragraphs
- **Web UI** with:
  - History sidebar (independent scrolling)
  - Rendered markdown output
  - Customizable LLM prompt editor
  - Support for multiple URLs at once
- **CLI tool** for quick command-line usage
- **Multiple LLM Providers** - OpenAI and Anthropic support

## Requirements

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) installed and available in PATH
- API keys (optional, for LLM features):
  - `OPENAI_API_KEY` for OpenAI models
  - `ANTHROPIC_API_KEY` for Anthropic models

## Installation

```bash
# Clone the repository
git clone <repository-url>
cd YoutubeExtractor

# Install dependencies
npm install

# Configure API keys (optional)
cp .env.example .env
# Edit .env and add your API keys
```

## Usage

### Web App

```bash
# Start the server
npm start

# Or specify a custom port
PORT=3001 npm start
```

Open http://localhost:3000 (or your custom port) in your browser.

**Web UI Features:**

- Paste one or multiple YouTube URLs (one per line)
- Select LLM provider and model (or use raw transcript)
- Click "Extract" to process
- View rendered markdown output with:
  - TLDR, Key Insights, Action Items (when using LLM)
  - Sectioned transcript with topic headers
  - Collapsible original transcript
- Browse extraction history in the sidebar (scrolls independently)
- Click history items to view past extractions
- **Edit Prompt** button to customize LLM instructions
  - Modify how transcripts are summarized and formatted
  - Reset to default prompt anytime

### CLI

```bash
# Basic extraction (outputs to stdout and saves to temp/)
node youtube-extractor.js <YouTube URL>

# Save to specific file
node youtube-extractor.js <YouTube URL> output.md

# With LLM processing
OPENAI_API_KEY="sk-..." node youtube-extractor.js <YouTube URL>
```

## Configuration

Create a `.env` file in the project root:

```env
OPENAI_API_KEY=sk-your-openai-key
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key
```

### Available LLM Models

| Provider  | Models                                            |
| --------- | ------------------------------------------------- |
| OpenAI    | gpt-4o-mini, gpt-4o                               |
| Anthropic | claude-sonnet-4-20250514, claude-haiku-4-20250514 |

## Project Structure

```
/
├── server.js              # Express API server
├── youtube-extractor.js   # CLI tool
├── lib/
│   └── extractor.js       # Core extraction logic
├── public/
│   ├── index.html         # Web UI
│   ├── style.css          # Styling
│   └── app.js             # Frontend logic
├── temp/                  # Stored extractions
│   ├── *.md               # Extracted transcripts
│   ├── *.info.json        # Video metadata
│   ├── *.en.srt           # Raw subtitles
│   └── custom-prompt.txt  # Custom LLM prompt (if set)
├── package.json
├── .env                   # API keys
└── README.md
```

## API Endpoints

| Method | Endpoint                 | Description                       |
| ------ | ------------------------ | --------------------------------- |
| POST   | `/api/extract`           | Extract transcript(s) from URL(s) |
| GET    | `/api/history`           | List all extractions              |
| GET    | `/api/history/:filename` | Get specific extraction           |
| DELETE | `/api/history/:filename` | Delete extraction                 |
| GET    | `/api/config`            | Check configured API keys         |
| GET    | `/api/prompt`            | Get default and custom prompt     |
| POST   | `/api/prompt`            | Save custom prompt                |
| DELETE | `/api/prompt`            | Reset prompt to default           |

### Extract Request Example

```bash
curl -X POST http://localhost:3000/api/extract \
  -H "Content-Type: application/json" \
  -d '{
    "urls": ["https://youtube.com/watch?v=VIDEO_ID"],
    "llm": {
      "provider": "openai",
      "model": "gpt-4o-mini"
    }
  }'
```

## Output Format

Extracted transcripts are saved as markdown files with the following structure:

```markdown
# Video Title

## TLDR

(2-3 sentence summary of the video)

## Key Insights

- Insight 1: Important finding or perspective
- Insight 2: Another key idea from the video
- Insight 3: Additional insight

## Action Items & Takeaways

- Practical step or recommendation
- Thing to remember or do

## Metadata

- **Channel:** Channel Name
- **Published:** 2024-01-15
- **Duration:** 10:30
- **Views:** 1,234,567
- **URL:** https://youtube.com/watch?v=VIDEO_ID

## Description

(Video description)

## Transcript

## Section Title

*Brief summary of this section.*

Detailed content organized into logical sections with proper
paragraph breaks and punctuation...

## Another Section

*What this section covers.*

More content...

---

<details>
<summary>Original Transcript</summary>

(Raw transcript split into paragraphs for readability)

</details>
```

**Note:** When using LLM processing, both the formatted transcript (with sections) and the original transcript are preserved. The original is available in a collapsible section at the bottom.

## License

MIT
