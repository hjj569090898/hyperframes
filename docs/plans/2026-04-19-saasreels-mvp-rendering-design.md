# Design: SaaSReels MVP Rendering Pipeline

Date: 2026-04-19
Topic: Achieving MVP video generation for SaaSReels using HyperFrames worker.

## Goals

- Implement a "Translator" that converts `RenderSpec` JSON into HyperFrames-compatible HTML/CSS.
- Support 2-3 core scene types: `FocusShot`, `GenerativeDemo`, and `FullScreen`.
- Integrate `@hyperframes/producer` for headless MP4 rendering.
- Maintain a local task-based workflow for fast iteration.

## Architecture

### 1. Translator (`SaasReelsTranslator`)

A service that takes a `RenderSpec` and produces a `workspace` folder containing:
- `index.html`: The main GSAP-driven composition.
- `styles.css`: Visual framing and typography.
- `assets/`: Symlinked or downloaded media files.

#### Component Mapping Matrix:

| SaaSReels Component | HyperFrames Block / Logic | Visual Style |
| :--- | :--- | :--- |
| `FocusShot` | Custom GSAP Zoom + Shadow | Deep focus on product features. |
| `GenerativeDemo` | Window Reveal + Cursor | Showing AI generation or dashboard. |
| `FullScreen` | Scale-to-fill | Impactful background visuals. |

### 2. Rendering Orchestrator

The worker will:
1. Claim a task (Local or Postgres).
2. Invoke `Translator` to build the workspace.
3. Invoke `Producer` to render the MP4.
    - Resolution: 1080x1920 (Portrait) or 1920x1080 (Landscape).
    - Framerate: 30fps.
4. Record the output path in the task result.

## Data Flow

1. **Input**: `task.payload` contains `RenderSpec`.
2. **Translation**:
    - Iterate over `scenes`.
    - Calculate `absStart` and `absDuration` in seconds.
    - Generate `<div class="clip" data-start="..." data-duration="...">` elements.
    - Embed a unified GSAP timeline script that registers with `window.__timelines`.
3. **Execution**: `bun x hyperframes render <workspace_path>`.

## Error Handling

- **Missing Assets**: Log error and fail task.
- **Rendering Timeout**: Kill browser and mark task as failed (retryable).
- **Invalid Spec**: Validate against Zod schema before starting.

## Success Criteria

1. A folder exists in `.tmp/saasreels-worker/tasks/succeeded/<task_id>`.
2. A valid `.mp4` file is present in that folder.
3. The video correctly sequences two or more scenes with text overlays.
