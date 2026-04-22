# Validation Gates

The validator is intentionally local and deterministic. It checks the RenderSpec object without network, database, or render side effects.

## JSON Purity

Default mode accepts only pure JSON. Markdown fences, prefaces, and explanatory text fail. `--allow-extract` is only a repair aid.

## Top-Level Schema

Required:

- `fps`: `30` or `60`
- `format`: `16:9`, `9:16`, or `1:1`
- `totalFrames`: positive integer
- `scenes`: non-empty array
- `assets`: object mapping IDs to URL/path strings

## Scene Schema

Required per scene:

- `component`: allowed component
- `mediaElementId`: non-empty string
- `durationFrames`: positive integer
- `params`: object

Optional but checked when present:

- `text.content`, `text.style`, `text.position`
- `narration.audioId`
- `params.secondaryMediaId`
- `params.stockVideoId`
- `params.otherAssetIds`
- `params.pexelsQuery`

## Asset Ownership

Every referenced asset ID must exist in `assets`. This includes secondary assets, stock assets, narration audio, and `globalAssets.bgmId`.

This gate checks references only. It does not:

- fetch Pexels
- verify `PEXELS_API_KEY`
- prove a remote URL is reachable
- download assets into the worker workspace

## Duration Integrity

The sum of `scene.durationFrames` must equal `totalFrames`. Fix this before translation so downstream code does not guess.

## HTML Validation

After RenderSpec-to-HTML translation, run:

```bash
npx hyperframes lint
npx hyperframes validate
```

Do not render MP4 before these pass.
