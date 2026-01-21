# YouTube Transcript Extractor

A local web app and CLI tool that extracts YouTube video metadata and transcripts using `yt-dlp`. Optionally processes transcripts with LLMs (OpenAI, Anthropic, or OpenRouter) to generate summaries, insights, and structured content.

## Features

- **Video Extraction** - metadata and English subtitles via yt-dlp
- **Progressive Loading** - transcript displays immediately while LLM processes
- **Streaming Markdown** - inline formatting renders during LLM streaming
- **LLM Processing** - TLDR, Key Insights, Action Items, sectioned summaries
- **Detail Level** - adjustable compression (0-100%) for LLM output
- **Rerun LLM** - reprocess any extraction with different settings
- **Annotations** - highlight text and ask LLM questions about selections
- **Multi-Summary Analysis** - analyze multiple summaries together (similarities, differences, SaaS ideas, unified summary)
- **Metadata Explorer** - browse and filter summaries by concepts, entities, tags, and categories
- **Related Videos** - automatic cross-referencing based on shared metadata
- **Web UI** - React-based, dark/light mode, history sidebar, collapsible sections

## Requirements

- Node.js 18+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp) in PATH
- API keys (optional): `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`

## Quick Start

```bash
npm install
npm start
# Open http://localhost:3001
```

## Web UI

- **Sidebar** - LLM settings (provider, model, detail level), history list with multi-select, theme toggle
- **Main Area** - URL input, Extract button, rendered results with annotations
- **Right Panel** - Original transcript, metadata, and related videos tabs
- **Analyze** - select 2+ summaries and run cross-analysis with predefined or custom prompts
- **Metadata Explorer** - browse all extracted metadata, filter by terms to find related content
- **Edit Prompt** - customize LLM instructions (Cmd+Enter to save)

## CLI

```bash
node youtube-extractor.js <YouTube URL> [output.md]
OPENAI_API_KEY="sk-..." node youtube-extractor.js <URL>  # With LLM
```

## API Endpoints

| Method          | Endpoint                          | Description                       |
| --------------- | --------------------------------- | --------------------------------- |
| POST            | `/api/extract`                    | Full extraction with optional LLM |
| POST            | `/api/extract/basic`              | Get transcript/metadata instantly |
| POST            | `/api/extract/process`            | Process basic info with LLM       |
| POST            | `/api/reprocess`                  | Rerun LLM on existing file        |
| GET             | `/api/history`                    | List extractions                  |
| GET/DELETE      | `/api/history/:filename`          | Get/delete extraction             |
| GET/POST/DELETE | `/api/prompt`                     | Manage custom prompt              |
| POST            | `/api/annotate/stream`            | Stream annotation response        |
| GET/POST/DELETE | `/api/annotations/:filename`      | Manage annotations                |
| POST            | `/api/summaries/analyze/stream`   | Analyze multiple summaries        |
| POST            | `/api/summaries/analyze/save`     | Save analysis result              |
| GET             | `/api/metadata/index`             | Get metadata index                |
| POST            | `/api/metadata/index/rebuild`     | Rebuild metadata index            |
| GET             | `/api/metadata/related/:filename` | Get related videos                |
| GET             | `/api/config`                     | Check API key status              |

## LLM Models

| Provider   | Models                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| OpenAI     | gpt-4o-mini, gpt-4o, gpt-5-nano, gpt-5                                   |
| Anthropic  | claude-sonnet-4, claude-haiku-4                                          |
| OpenRouter | claude-sonnet-4.5, claude-opus-4.5, gpt-5.2, gemini-3-pro, deepseek-v3.2 |

## License

MIT
