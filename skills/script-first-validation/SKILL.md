---
name: script-first-validation
description: Use when validating or repairing SaaSReels RenderSpecs before enqueueing, materializing a worker workspace, running HyperFrames lint or validate, previewing, rendering, or writing generated scripts into Postgres or R2.
---

# Script First Validation

## Overview

Validate the script before the expensive path. A RenderSpec must pass local structural and semantic checks before enqueue, materialization, HyperFrames validation, preview, render, upload, or database status updates.

## Required Gate

Run the validator on every generated or repaired RenderSpec:

```bash
node skills/script-first-validation/scripts/validate-render-spec.mjs <render-spec-file>
```

Use repair mode only while cleaning model output:

```bash
node skills/script-first-validation/scripts/validate-render-spec.mjs <render-spec-file> --allow-extract
```

`--allow-extract` can recover a JSON object from Markdown-wrapped text, but the final saved spec must pass without that flag.

## Workflow

1. Save the candidate RenderSpec to a local file.
2. Run `validate-render-spec.mjs` without `--allow-extract`.
3. Fix every error. Do not enqueue or render with errors.
4. If the RenderSpec has already been translated to HTML, materialize assets first, then run `npx hyperframes lint` and `npx hyperframes validate`.
5. Treat asset staging as a separate audit. Validation does not fetch Pexels or prove that remote assets are reachable.
6. Enqueue, preview, or render only after both script validation and HTML validation pass.

## Validation Gates

| Gate         | Blocks On                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------ |
| JSON purity  | Markdown wrappers, prefaces, trailing commentary                                                 |
| Schema shape | Missing `fps`, `format`, `totalFrames`, `scenes`, or scene fields                                |
| Field drift  | `type`, `duration`, `scene.content`                                                              |
| Components   | Unknown component names                                                                          |
| Assets       | Missing `mediaElementId`, `secondaryMediaId`, `stockVideoId`, narration audio, or BGM references |
| Duration     | `totalFrames` not matching scene duration sum                                                    |

Detailed gate behavior is in [validation-gates.md](references/validation-gates.md).

## Failure Policy

- Errors are hard blockers. Fix them before any render or database write.
- Warnings require a human or agent decision. They do not pass silently.
- Do not hide validation failures by falling back to mock data unless the user explicitly asks for a mock.
- Do not call AI, Pexels, Postgres, R2, or HyperFrames render to validate JSON structure.
- Do not confuse "the spec is valid" with "the assets are ready." Pexels lookup and remote downloads are runtime concerns, not validation concerns.

## Common Repairs

Use [common-repairs.md](references/common-repairs.md) when a model output fails. Prefer repairing the source RenderSpec and rerunning validation over patching generated HTML.

## Related Skills

- Use `saas-director-engine` before this skill when creating the RenderSpec from a campaign brief.
- Use `hyperframes` and `hyperframes-cli` after this skill when validating materialized HTML.
