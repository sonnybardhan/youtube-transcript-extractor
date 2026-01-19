# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

A Node.js CLI tool that extracts YouTube video metadata and transcripts using `yt-dlp`. Outputs formatted markdown with title, channel, publish date, duration, views, description, and transcript.

## Requirements

- Node.js (ES modules)
- `yt-dlp` must be installed and available in PATH
- `OPENAI_API_KEY` environment variable (optional, for LLM processing)

## Usage

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

Single-file CLI (`youtube-extractor.js`):
- Extracts video ID from various YouTube URL formats
- Uses `yt-dlp` to fetch metadata JSON and subtitles (prefers manual English subs, falls back to auto-generated)
- Parses SRT format to clean plaintext transcript
- If `OPENAI_API_KEY` is set, uses GPT-4o-mini to generate a TLDR and format the transcript
- Outputs structured markdown

Files are saved to `temp/` directory:
- `<videoId>.info.json` - raw metadata from yt-dlp
- `<videoId>.en.srt` - raw subtitles
- `<video-title>.md` - final formatted output
