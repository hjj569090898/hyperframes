# Video Generation Design: INeedPrompt

This document outlines the process for generating a video for `https://www.ineed-prompt.com/` by simulating a production workflow.

## Overview
We will seed a project, version, and worker task in the database, then run the `saasreels-worker` to process the task, which triggers AI directing and rendering.

## Domain Analysis: INeedPrompt
- **Product**: AI Prompt Generator/Assistant
- **Key Message**: "Think in concepts, Tab into results."
- **Core Pillars**:
  - Twin Modes: Supplement (completion) & Generate (creation).
  - Model Support: Midjourney, Flux, Sora, GPT, Claude.
  - Integration: Chrome Extension with hotkeys.
  - Context Aware: Understands page content for better prompts.

## Implementation Steps

### 1. Database Seeding (`seed_ineedprompt_task.js`)
We will create a script to insert records into:
- `video_project`: URL info.
- `video_version`: Placeholder for the render spec.
- `project_generation_intents`: The marketing angle and facts we extracted.
- `worker_task`: A `generate_video` task in `queued` status.

### 2. Pipeline Execution
We will run the worker using:
```bash
bun run dev run-once --queue-backend postgres --database-url <DB_URL>
```
The worker will:
1. **Claim** the task.
2. **Direct**: Call `CinematicDirector` to generate a high-fidelity `RenderSpec` based on the URL and intents.
3. **Save**: Persist the `RenderSpec` back to the DB.
4. **Translate**: Convert `RenderSpec` to `index.html` compositions.
5. **Render**: Use Puppeteer + FFmpeg (via `@hyperframes/producer`) to create the `.mp4`.
6. **Upload**: (Optional) Upload to R2 if configured.

## Success Criteria
- [ ] Database contains the new project and successful task.
- [ ] `packages/saasreels-worker/.tmp/saasreels-worker/<task_id>/` contains a valid `index.html` and `.mp4`.
- [ ] The generated video content reflects the INeedPrompt brand and features.

## Questions for User
- Do you want me to use a specific AI provider for the director (e.g. GPT-4o)?
- Should I proceed with the seeding script now?
