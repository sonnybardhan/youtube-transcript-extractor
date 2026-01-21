# YT Extractor - Sitemap

## Pages

### Main Page (`currentPage: 'main'`)
Primary interface with sidebar and content area.

**Sidebar**
| Section | Features |
|---------|----------|
| Header | App logo, version, Explore Metadata button |
| New Extraction | Button to start fresh extraction |
| History List | Search, select-all checkbox, multi-select with Shift+click |
| Bulk Actions | Analyze (2+ selected), Delete selected |
| LLM Settings | Provider dropdown, model selector, compression slider (0-100%) |
| Footer | Theme toggle, Metadata Streamliner button, Settings button |

**Main Content - Input View** (`view: 'input'`)
| Feature | Description |
|---------|-------------|
| URL Input | Multi-line textarea for YouTube URLs (one per line) |
| Extract Button | Triggers extraction (Cmd+Enter shortcut) |
| API Status | Shows if API keys are configured |

**Main Content - Results View** (`view: 'results'`)
| Feature | Description |
|---------|-------------|
| Results Header | Title, reading time, model badge, Rerun LLM button |
| Output Pane | Rendered markdown with collapsible sections |
| Selection Toolbar | Appears on text selection with "Ask LLM" button |
| Annotations | Inline questions/answers persisted per document |

**Info Pane (Right Panel)**
| Tab | Content |
|-----|---------|
| Transcript | Original video transcript |
| Metadata | Channel, publish date, duration, views, description |
| Signal | Category, concepts, entities, suggested tags |
| Related | Videos with shared metadata (auto-linked) |
| Annotations | List of saved annotations with pending annotation stream |

---

### Metadata Explorer Page (`currentPage: 'explorer'`)
Browse and filter all extracted metadata across summaries.

| Feature | Description |
|---------|-------------|
| Back Button | Return to main page |
| Search | Filter terms across all categories |
| Filter Mode Toggle | AND (match all) / OR (match any) |
| Clear All | Reset all selections |
| Rebuild Index | Regenerate metadata index from signal files |
| Concepts Section | Clickable chips to filter by concept |
| Entities Section | Clickable chips to filter by entity |
| Tags Section | Clickable chips to filter by tag |
| Categories Section | Clickable chips to filter by category |
| Matching Files | List of summaries matching selected terms |

---

## Modals

### Prompt Modal (Settings)
| Feature | Description |
|---------|-------------|
| Prompt Editor | Textarea to customize LLM instructions |
| Reset to Default | Restore original prompt |
| Save | Persist custom prompt (Cmd+Enter shortcut) |

### Delete Modal
| Feature | Description |
|---------|-------------|
| Confirmation | Confirm deletion of selected items |
| Cancel/Delete | Action buttons |

### Analyze Modal (Multi-Summary Analysis)
| Feature | Description |
|---------|-------------|
| Selected Count | Shows number of summaries to analyze |
| Prompt Selector | Radio buttons: Similarities, Differences, SaaS Ideas, Unified Summary, Generic |
| Custom Prompt | Optional textarea for custom analysis prompt |
| Run Analysis | Start streaming LLM analysis |
| Response Area | Streaming markdown output |
| Copy to Clipboard | Copy analysis result |
| Save as File | Persist analysis to history |

### Metadata Streamliner Modal
| Phase | Features |
|-------|----------|
| Setup | Shows signal file count, start analysis button |
| Analyzing | Progress indicator with current file being processed |
| Review | Proposed normalizations grouped by type (concepts, entities, tags), select/deselect changes |
| Applying | Progress while applying selected normalizations |
| Complete | Summary of applied changes, close button |

---

## Overlays & Notifications

| Component | Description |
|-----------|-------------|
| Loading Overlay | Full-screen spinner with message, cancel button |
| Toast | Bottom-right notification for success/error messages |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+Enter | Extract URLs (input view) / Save prompt (modal) |
| Escape | Close modals |
| Shift+Click | Range select in history list |

---

## Data Files (temp/)

| Extension | Purpose |
|-----------|---------|
| `.md` | Processed summary |
| `.info.json` | Video metadata |
| `.srt` | Subtitle file |
| `.signal.json` | Extracted metadata (concepts, entities, tags, category) |
| `.annotations.json` | Saved annotations |
| `metadata-index.json` | Cross-reference index |
