# YouTube Transcript Extractor

A local web app and CLI tool that extracts YouTube video metadata and transcripts using `yt-dlp`. Optionally processes transcripts with LLMs (OpenAI or Anthropic) to generate summaries, insights, and structured content.

## Features

- **Video Extraction** - metadata and English subtitles via yt-dlp
- **Progressive Loading** - transcript displays immediately while LLM processes
- **LLM Processing** - TLDR, Key Insights, Action Items, sectioned summaries
- **Detail Level** - adjustable compression (0-100%) for LLM output
- **Rerun LLM** - reprocess any extraction with different settings (creates new file)
- **Web UI** - dark/light mode, history sidebar, collapsible sections, tabbed info panel

## Requirements

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) in PATH
- API keys (optional): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3001
```

## Web UI

- **Sidebar** - LLM settings (provider, model, detail level), history, theme toggle
- **Main Area** - URL input, Extract button, rendered results
- **Right Panel** - Original transcript and metadata tabs (loads instantly)
- **Edit Prompt** - customize LLM instructions (Cmd+Enter to save)

## CLI

```bash
node youtube-extractor.js <YouTube URL> [output.md]
OPENAI_API_KEY="sk-..." node youtube-extractor.js <URL>  # With LLM
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/extract` | Full extraction with optional LLM |
| POST | `/api/extract/basic` | Get transcript/metadata instantly |
| POST | `/api/extract/process` | Process basic info with LLM |
| POST | `/api/reprocess` | Rerun LLM on existing file |
| GET | `/api/history` | List extractions |
| GET/DELETE | `/api/history/:filename` | Get/delete extraction |
| GET/POST/DELETE | `/api/prompt` | Manage custom prompt |
| GET | `/api/config` | Check API key status |

## LLM Models

| Provider | Models |
|----------|--------|
| OpenAI | gpt-4o-mini, gpt-4o |
| Anthropic | claude-sonnet-4-20250514, claude-haiku-4-20250514 |

## License

MIT
