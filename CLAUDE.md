# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Node.js tool that extracts YouTube video metadata and transcripts using `yt-dlp`. Available as both a CLI tool and a web app. When using LLM processing, generates TLDR summaries, key insights, action items, and organizes transcripts into logical sections with topic headers.

## Requirements

- Node.js (ES modules)
- `yt-dlp` must be installed and available in PATH
- `OPENAI_API_KEY` environment variable (optional, for LLM processing)
- `ANTHROPIC_API_KEY` environment variable (optional, for Anthropic LLM processing)

## Usage

### Web App (Recommended)

```bash
# Install dependencies
npm install

# Start the server
npm start
# or: node server.js

# Open in browser
open http://localhost:3000
```

Features:

- Paste one or multiple YouTube URLs (one per line)
- Choose LLM provider (OpenAI or Anthropic) and model
- Dark/Light mode toggle (persisted to localStorage)
- **Main Content:**
  - TLDR, Key Insights, Action Items, sectioned transcript
  - Collapsible sections for easy navigation
  - Empty sections show "n/a" instead of being hidden
- **Right Info Panel (tabbed):**
  - Transcript tab - original raw transcript
  - Metadata tab - channel, date, duration, views, URL, description
  - Click tabs to expand collapsed panel
- **Sidebar:**
  - History list with delete icons
  - Light/dark mode toggle
  - Settings button
- Edit Prompt button with code editor styling and keyboard shortcuts

### CLI

```bash
# Run directly
node youtube-extractor.js <YouTube URL> [output.md]

# With LLM processing (adds TLDR and formats transcript)
OPENAI_API_KEY="sk-..." node youtube-extractor.js <YouTube URL>

# Or via npm link / global install
yt-extract <YouTube URL> [output.md]
```

Output is always saved to `temp/<video-title>.md`. If no output file argument is specified, also writes to stdout. Progress messages go to stderr.

## Architecture

```
/
├── server.js           # Express API server
├── youtube-extractor.js # Original CLI (still works)
├── public/
│   ├── index.html      # Web UI (dark/light theme)
│   ├── style.css       # Styling with CSS variables
│   └── app.js          # Frontend logic
├── lib/
│   └── extractor.js    # Core extraction logic (shared)
├── temp/               # Stored extractions
├── notes.md            # Development notes and feature ideas
├── package.json
└── .env                # API keys
```

### Core Module (`lib/extractor.js`)

- `extract(url, llmConfig)` - Main extraction function
- `extractVideoId(url)` - Parse YouTube URL/ID
- `cleanSubtitleText(srt)` - Convert SRT to plain text
- `sanitizeFilename(title)` - Safe filename from title
- Supports both OpenAI and Anthropic LLMs

### API Endpoints (`server.js`)

- `POST /api/extract` - Extract from URL(s) with optional LLM config and custom prompt
- `GET /api/history` - List all extractions
- `GET /api/history/:filename` - Get specific extraction
- `DELETE /api/history/:filename` - Delete extraction
- `GET /api/config` - Check which API keys are configured
- `GET /api/prompt` - Get default and custom prompt
- `POST /api/prompt` - Save custom prompt
- `DELETE /api/prompt` - Reset prompt to default

### Files in `temp/`

- `<videoId>.info.json` - raw metadata from yt-dlp
- `<videoId>.en.srt` - raw subtitles
- `<video-title>.md` - final formatted output
- `custom-prompt.txt` - custom LLM prompt (if set)

## LLM Output Structure

When LLM processing is enabled, the output includes:

1. **TLDR** - 2-3 sentence summary
2. **Key Insights** - 3-7 important ideas/findings
3. **Action Items & Takeaways** - practical steps or things to remember
4. **Sectioned Transcript** - content organized by topic with headers and brief summaries
5. **Original Transcript** - preserved in a collapsible `<details>` section

## LLM Options

| Provider  | Models                                            |
| --------- | ------------------------------------------------- |
| OpenAI    | gpt-4o-mini, gpt-4o                               |
| Anthropic | claude-sonnet-4-20250514, claude-haiku-4-20250514 |
