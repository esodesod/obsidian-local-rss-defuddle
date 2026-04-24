# Project Summary

## Overall Goal
Add a **target CSS selectors (include)** feature to the Obsidian RSS plugin that allows users to narrow fetched article HTML to specific elements (like `#innhold`) before defuddle processing.

## Key Project Context
- **Project**: Obsidian plugin for downloading RSS feed articles to local markdown files
- **Build system**: `npx tsc -noEmit -skipLibCheck && node esbuild.config.mjs production`
- **Key dependencies**: `defuddle` (content extraction), `linkedom` (DOM parsing), `sanitize-html`
- **i18n**: English, Japanese, French locales supported

## Architecture & Processing Pipeline
The article content processing pipeline in `UpdateFeeds.saveRssItem()`:
```
1. Fetch full page HTML via FeedFetcher.fetchHtml()
2. removeSelectors → strip unwanted elements (e.g., .lp_related, .authors)
3. keepElementsBySelectors(targetSelectors) → pre-filter to target elements
4. Resize images (if configured)
5. defuddle (no contentSelector) → HTML to Markdown conversion
6. Template rendering → Markdown file creation
```

## Key Technical Decisions

### `keepElementsBySelectors` Pre-Filter Over Defuddle's `contentSelector`
**Decision**: Use a custom `keepElementsBySelectors()` pre-filter before defuddle rather than passing `targetSelectors` to defuddle's `contentSelector` option.

**Why**: Defuddle's `contentSelector` only accepts a single CSS selector and picks the first match. When the user provided multiple selectors like `div.u-phn,div.c-drp`, only one element was kept. The `keepElementsBySelectors` function handles multiple selectors correctly by retaining all matching elements and their siblings.

**How to apply**: Pass `targetSelectors` through `keepElementsBySelectors()` as a pre-filter step; do not forward to defuddle's `contentSelector`.

### `keepElementsBySelectors` Implementation Fix
**Decision**: Extract matched elements into a fresh `<body>` rather than mutating the existing DOM in-place.

**Why**: The previous implementation had a backwards containment bug: it checked `kept.contains(child)` when iterating body children, which only kept body-level children that were *ancestors* of matched elements. This dropped matched elements nested deeper in the DOM. The new approach extracts all matched elements (and their ancestors up to body) into a new `<body>`, preserving siblings regardless of nesting depth.

**How to apply**: When fixing DOM filtering utilities, prefer extract-into-fresh-container over in-place mutation to avoid stale node references.

### Full Page HTML Handling
**Decision**: Extract `body.innerHTML` from full page HTML before re-wrapping for defuddle.

**Why**: Full page HTML from `fetchHtml()` contains its own `<html><body>` tags. Double-wrapping created nested, invalid DOM structures where defuddle's content extraction could fail.

**How to apply**: `htmlToMarkdown()` extracts body content first, then re-wraps in a clean `<html><body>` structure.

### Test Coverage
**Decision**: Added 12 new tests for `keepElementsBySelectors` and `removeElementsBySelectors` (145 total tests, all passing).

**How to apply**: These tests cover edge cases including nested matches, multiple selectors, and the backwards containment bug that was fixed.

## Recent Changes Summary

| File | Change |
|------|--------|
| `src/types/Settings.ts` | Added `targetSelectors` to `Feed`, `ResolvedFeedSettings`, `LocalRssSettings`, `DEFAULT_SETTINGS` |
| `src/utils/htmlProcessor.ts` | Fixed `keepElementsBySelectors()` — now extracts matched elements into a fresh `<body>` instead of mutating in-place; `htmlToMarkdown()` no longer passes `contentSelector` to defuddle |
| `src/services/FeedSettingsResolver.ts` | Resolves `targetSelectors` with per-feed override → global fallback |
| `src/services/ArticleRenderer.ts` | `render()` accepts optional `targetSelector` param, passes to `htmlToMarkdown()` |
| `src/usecases/UpdateFeeds.ts` | Re-inserted `keepElementsBySelectors(targetSelectors)` into pipeline after `removeSelectors`; removed `contentSelector` from defuddle call |
| `src/ui/EditFeedModal.ts` | Added UI input field for `targetSelectors` in feed edit modal |
| `src/adapters/i18n/locales/en.ts`, `ja.ts`, `fr.ts` | Added translations for `targetSelectors`, `targetSelectorsDesc`, `targetSelectorsPlaceholder` |
| Test files | Added 12 tests for `keepElementsBySelectors` and `removeElementsBySelectors` |

## User's Working Configuration
- **Target selector**: `#innhold` (NRK article main content ID) — also tested with multiple selectors like `div.u-phn,div.c-drp`
- **Remove selectors**: `.lp_related,.authors,.article-dateline,.link__container`
- Both features work together — `targetSelectors` narrows to main content, `removeSelectors` cleans remaining noise

---

## Summary Metadata
**Update time**: 2026-04-24T07:13:40.020Z
