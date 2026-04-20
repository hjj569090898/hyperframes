# Design: Cinematic Intent-Driven Director

Date: 2026-04-20
Topic: Refactoring CinematicDirector to strictly enforce user-provided intents (slogan, points, assets).

## Goals

- Enable users to override AI-generated scripts with specific branding (Slogan).
- Ensure core product advantages (Must-include points) are not missed by the AI.
- Allow users to pin specific visual assets (screenshots/videos) to their preferred narrative moments.

## Architecture

### 1. Contract Extension (`AdEvidencePackage`)

Inject user intents into the existing `AdEvidencePackage` schema.

```typescript
export interface AdEvidencePackage {
  // Existing fields...
  slogan?: string;
  mustIncludePoints?: string[];
  preferredAssetIds?: string[];
}
```

### 2. System Prompt Refinement

Update `CINEMATIC_DIRECTOR_SYSTEM_PROMPT` in `saasreels-engine` to recognize and prioritize "User Directives".

- **Slogan Constraint**: If provided, the slogan MUST be featured in at least one high-impact Shot (HeroShot or CTAShot).
- **Points Constraint**: All `mustIncludePoints` must be represented either as `overlay` text or explicitly described in the visual `layers`.
- **Narrative Autonomy**: While constraints are strict, the AI maintains autonomy over *where* and *how* to blend these into the 60-second narrative flow to maintain cinematic quality.

### 3. Prompt Construction

Enhance `generateUserPrompt` in `CinematicDirector.ts` to transform the new fields into actionable AI instructions.

| Field | AI Instruction Transformation |
| :--- | :--- |
| `slogan` | "Brand Voice: Use exactly '[SLOGAN]' in a headline layer." |
| `mustIncludePoints` | "Narrative Pillars: Ensure each point is covered: [POINTS]." |
| `preferredAssetIds` | "Asset Anchors: Prioritize using elements [IDS] for core shots." |

## Data Flow

1. **Web (saasreels-web)**: Fetch intents from `project_generation_intents` DB table.
2. **Bridge**: Populate `AdEvidencePackage` and pass it to the local generator CLI (`v5.ts`).
3. **Engine (saasreels-engine)**: 
    - `v5.ts` reads the package.
    - `CinematicDirector` builds the constrained prompt.
    - AI generates a `CinematicScript` that respects the tokens.
4. **Validation**: Final check ensures the slogan exists in the output JSON.

## Success Criteria

1. Generated `CinematicScript` contains the exact `slogan` in at least one shot.
2. All `mustIncludePoints` are reflected in the script's textual or visual elements.
3. Script structure remains valid against the existing V5 Zod schemas.
