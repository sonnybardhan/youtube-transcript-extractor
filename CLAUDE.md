# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Overview

Node.js web app + CLI for extracting YouTube transcripts via `yt-dlp`. Optional LLM processing generates TLDR, insights, action items, and sectioned summaries. Features progressive loading - transcript displays immediately while LLM processes.

## Requirements

- Node.js (ES modules), `yt-dlp` in PATH
- Optional: `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY` in `.env`

## Commands

```bash
npm install && npm start  # Web app at http://localhost:3001
node youtube-extractor.js <URL> [output.md]  # CLI
```

## Architecture

```
server.js            # Express API
youtube-extractor.js # CLI tool
lib/extractor.js     # Core logic (extract, extractBasic, processWithLLMAndFormat)
public/              # Web UI
  index.html         # Main HTML
  style.css          # Styles
  js/                # ES modules
    app.js           # Entry point, event listeners
    config.js        # LLM model configuration
    state.js         # Application state management
    elements.js      # DOM element references
    api.js           # API calls (config, prompt)
    history.js       # History list management
    extraction.js    # Extraction and LLM processing
    views.js         # View rendering, info pane, streaming markdown parsing
    markdown.js      # Markdown parsing, collapsible sections
    ui.js            # Theme, loading, modal, toast
    utils.js         # Utility functions
temp/                # Output files (.md, .info.json, .srt)
```

## Key Functions (`lib/extractor.js`)

- `extract(url, llmConfig)` - Full extraction with optional LLM
- `extractBasic(url)` - Metadata + transcript only (no LLM)
- `processWithLLMAndFormat(basicInfo, llmConfig)` - Process basic info with LLM
- `reprocessWithLLM(transcript, title, llmConfig)` - Re-run LLM on existing content

## API Endpoints

- `POST /api/extract` - Full extraction with `{urls, llm, compressionLevel}`
- `POST /api/extract/basic` - Get transcript/metadata instantly `{url}`
- `POST /api/extract/process` - Process with LLM `{basicInfo, llm, compressionLevel}`
- `POST /api/reprocess` - Rerun LLM on file `{filename, llm, compressionLevel}`
- `GET/DELETE /api/history/:filename` - Manage extractions
- `GET/POST/DELETE /api/prompt` - Custom prompt management

## UI Components

- **Sidebar**: LLM settings (provider, model, detail level), history list, theme toggle
- **Main**: URL input, results with collapsible sections, rerun button
- **Right Panel**: Tabbed transcript/metadata (displays immediately via progressive loading)

## LLM Models

- **OpenAI**: gpt-4o-mini, gpt-4o
- **Anthropic**: claude-sonnet-4, claude-haiku-4
- **OpenRouter**: claude-sonnet-4.5, claude-opus-4.5, claude-haiku-4.5, gpt-5.2, gemini-3-pro, deepseek-v3.2

## UI State

- `currentModel` tracks which LLM generated the current summary (displayed next to reading time)
