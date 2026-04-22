# SaaS Video Skills Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build repository skills for SaaS video directing and script-first RenderSpec validation.

**Architecture:** Add one creative workflow skill and one validation/tooling skill under `skills/`. Keep workflow guidance in `SKILL.md`, move reusable reference material into `references/`, and implement a dependency-free Node validator for RenderSpec preflight checks.

**Tech Stack:** Codex skills, Markdown, Node.js ESM, HyperFrames/SaaSReels RenderSpec JSON.

---

### Task 1: Add Design and Fixtures

**Files:**
- Create: `docs/plans/2026-04-21-saas-video-skills-design.md`
- Create: `docs/plans/2026-04-21-saas-video-skills.md`
- Create: `skills/script-first-validation/fixtures/valid-render-spec.json`
- Create: `skills/script-first-validation/fixtures/invalid-missing-duration.json`
- Create: `skills/script-first-validation/fixtures/invalid-markdown-wrapped.txt`

**Step 1: Write the fixtures**

Create one valid RenderSpec, one valid JSON object with a scene missing `durationFrames`, and one Markdown-wrapped JSON sample.

**Step 2: Run validator before implementation**

Run:

```bash
node skills/script-first-validation/scripts/validate-render-spec.mjs skills/script-first-validation/fixtures/valid-render-spec.json
```

Expected: FAIL because the validator does not exist yet.

### Task 2: Implement RenderSpec Validator

**Files:**
- Create: `skills/script-first-validation/scripts/validate-render-spec.mjs`

**Step 1: Implement minimal CLI**

Read one file path, parse JSON, validate required top-level fields, validate scenes, validate assets, print a structured report, and exit `0` only when there are no errors.

**Step 2: Verify fixtures**

Run:

```bash
node skills/script-first-validation/scripts/validate-render-spec.mjs skills/script-first-validation/fixtures/valid-render-spec.json
node skills/script-first-validation/scripts/validate-render-spec.mjs skills/script-first-validation/fixtures/invalid-missing-duration.json
node skills/script-first-validation/scripts/validate-render-spec.mjs skills/script-first-validation/fixtures/invalid-markdown-wrapped.txt
```

Expected: valid fixture passes; invalid fixtures fail with precise messages.

### Task 3: Write Skills and References

**Files:**
- Modify: `skills/saas-director-engine/SKILL.md`
- Create: `skills/saas-director-engine/references/hooks.md`
- Create: `skills/saas-director-engine/references/seven-soul-elements.md`
- Create: `skills/saas-director-engine/references/render-spec-contract.md`
- Create: `skills/saas-director-engine/references/examples.md`
- Modify: `skills/script-first-validation/SKILL.md`
- Create: `skills/script-first-validation/references/validation-gates.md`
- Create: `skills/script-first-validation/references/common-repairs.md`

**Step 1: Replace scaffold text**

Write concise frontmatter descriptions that start with "Use when..." and contain trigger symptoms only.

**Step 2: Add references**

Keep detailed hook models, seven soul elements, schema rules, validation gates, and repairs in reference files.

### Task 4: Validate Skill Structure and Formatting

**Files:**
- Validate all new skill files.

**Step 1: Run skill validator**

```bash
python C:/Users/801611/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/saas-director-engine
python C:/Users/801611/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/script-first-validation
```

Expected: PASS for both skills.

**Step 2: Run formatting checks**

```bash
bunx oxfmt --check skills/saas-director-engine skills/script-first-validation docs/plans/2026-04-21-saas-video-skills-design.md docs/plans/2026-04-21-saas-video-skills.md
```

Expected: PASS or report only files that need formatting.

### Task 5: Report Remaining Integration Work

**Files:**
- No code changes required.

**Step 1: Summarize**

Report created files, validation output, and the next integration step: wiring `validate-render-spec.mjs` into `packages/saasreels-worker` before enqueue/render.

