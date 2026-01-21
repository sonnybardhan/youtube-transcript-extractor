# CLAUDE.md

Guidance for Claude Code when working with this repository.

## Overview

Node.js web app + CLI for extracting YouTube transcripts via `yt-dlp`. Optional LLM processing generates TLDR, insights, action items, and sectioned summaries. Features progressive loading, annotations, multi-summary analysis, and metadata cross-referencing.

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
server.js              # Express API server
youtube-extractor.js   # CLI tool
lib/extractor.js       # Core extraction and LLM logic
client/                # React frontend (Vite)
  src/
    context/
      AppContext.jsx   # Global state management
    components/
      Sidebar/         # LLM settings, history list
      Main/            # URL input, results view, info pane
      Modals/          # Prompt editor, delete confirm, analyze modal
      Annotations/     # Selection toolbar, annotation items
      MetadataExplorer/# Browse/filter metadata index
      MetadataStreamliner/ # Normalize metadata across files
      common/          # Toast, loading overlay
    hooks/
      useExtraction.js # Extraction flow
      useAnnotation.js # Text annotation
      useMultiSummaryAnalysis.js # Cross-summary analysis
      useMetadataExplorer.js # Metadata browsing
      useHistory.js    # History management
      useTheme.js      # Dark/light mode
      useToast.js      # Notifications
    utils/
      api.js           # API client functions
      config.js        # LLM model configuration
      markdown.js      # Markdown parsing
      streaming.js     # SSE stream handling
      helpers.js       # Utility functions
temp/                  # Output files (.md, .info.json, .srt, .signal.json, .annotations.json)
prompts/               # Custom prompt storage
```

## Key Functions (`lib/extractor.js`)

- `extract(url, llmConfig)` - Full extraction with optional LLM
- `extractBasic(url)` - Metadata + transcript only (no LLM)
- `processWithLLMAndFormat(basicInfo, llmConfig)` - Process basic info with LLM
- `reprocessWithLLM(transcript, title, llmConfig)` - Re-run LLM on existing content
- `streamAnnotationResponse(...)` - Stream annotation responses
- `analyzeMultipleSummaries(...)` - Cross-analyze multiple summaries
- `buildMetadataIndex()` - Build index from signal files
- `findRelatedVideos(filename)` - Find related videos by shared metadata

## API Endpoints

### Extraction
- `POST /api/extract` - Full extraction `{urls, llm, compressionLevel}`
- `POST /api/extract/basic` - Transcript/metadata only `{url}`
- `POST /api/extract/process` - Process with LLM `{basicInfo, llm, compressionLevel}`
- `POST /api/reprocess` - Rerun LLM `{filename, llm, compressionLevel}`

### History
- `GET /api/history` - List all extractions
- `GET/DELETE /api/history/:filename` - Get/delete extraction
- `GET/POST/DELETE /api/prompt` - Custom prompt management

### Annotations
- `POST /api/annotate/stream` - Stream annotation `{filename, selectedText, section, question, llm}`
- `GET/POST/DELETE /api/annotations/:filename` - Manage saved annotations

### Multi-Summary Analysis
- `POST /api/summaries/analyze/stream` - Stream analysis `{filenames, promptType, customPrompt, llm}`
- `POST /api/summaries/analyze/save` - Save result `{content, title}`

### Metadata
- `GET /api/metadata/index` - Get metadata index
- `POST /api/metadata/index/rebuild` - Rebuild index from signal files
- `GET /api/metadata/related/:filename` - Get related videos
- `GET /api/metadata/preview` - Preview all metadata terms
- `POST /api/metadata/analyze/stream` - Stream metadata normalization

## UI Components

- **Sidebar**: LLM settings (provider, model, detail level), history with multi-select, theme toggle
- **Main**: URL input, results with collapsible sections, annotation support
- **Right Panel**: Tabbed transcript/metadata/related videos
- **Analyze Modal**: Cross-analyze selected summaries (similarities, differences, SaaS ideas, unified)
- **Metadata Explorer**: Browse all metadata, filter by terms, find related content

## LLM Models

- **OpenAI**: gpt-4o-mini, gpt-4o, gpt-5-nano, gpt-5, gpt-4.1-mini, gpt-4.1
- **Anthropic**: claude-sonnet-4, claude-haiku-4
- **OpenRouter**: claude-sonnet-4.5, claude-opus-4.5, claude-haiku-4.5, gpt-5.2, gemini-3-pro, deepseek-v3.2

## Key State (AppContext)

- `currentFile` / `currentContent` - Currently viewed summary
- `history` / `selectedItems` - History list and multi-select
- `annotations` / `pendingAnnotation` - Annotation state
- `analyzeModalOpen` / `analyzeResponse` - Multi-summary analysis
- `metadataIndex` / `explorerSelectedTerms` - Metadata explorer state
- `currentPage` - Page navigation ('main' | 'explorer')

## File Types in temp/

- `.md` - Processed summary markdown
- `.info.json` - Video metadata from yt-dlp
- `.srt` - Subtitle file
- `.signal.json` - Extracted metadata (concepts, entities, tags, category)
- `.annotations.json` - Saved annotations for a summary
- `metadata-index.json` - Cross-reference index of all metadata
