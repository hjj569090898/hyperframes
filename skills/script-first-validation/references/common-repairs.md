# Common Repairs

## Markdown Wrapper

Failure:

```text
input: RenderSpec is wrapped in non-JSON text.
```

Repair: remove all text before and after the JSON object. The final file must pass without `--allow-extract`.

## Field Drift

Failures:

- `scene.type`
- `scene.duration`
- `scene.content`

Repairs:

- Rename `type` to `component`.
- Convert seconds in `duration` to frames and write `durationFrames`.
- Move copy into `text.content` and add `text.style` plus `text.position`.

## Missing Params

Failure:

```text
scenes[n].params: Must be an object.
```

Repair: add `"params": {}` if no component-specific parameters are needed.

## Unknown Component

Failure:

```text
scenes[n].component: Unknown component
```

Repair: choose the closest allowed component from the validator output. Do not invent registry names inside RenderSpec unless the translator supports them.

## Missing Asset

Failure:

```text
References missing asset "..."
```

Repair: either add the asset ID to `assets` or change the scene reference to an existing asset. Do not keep hallucinated IDs.

## Frame Total Mismatch

Failure:

```text
totalFrames: Expected X from scene durations, received Y.
```

Repair: set `totalFrames` to the sum of scene `durationFrames`, or adjust scenes intentionally and rerun validation.
