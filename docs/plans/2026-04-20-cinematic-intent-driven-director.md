# Intent-Driven Cinematic Director Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Refactor CinematicDirector to strictly enforce user-provided intents (slogan, points, assets) fetched from the database.

**Architecture:** Extend the `AdEvidencePackage` contract to carry user intents, refine the Director's system prompt to prioritize these directives, and update the Web-to-Engine bridge to inject this data.

**Tech Stack:** TypeScript, Zod, OpenAI/Director API.

---

### Task 1: Update AdEvidencePackage Contract

**Files:**
- Modify: `d:\toTheSea\saasreels-web\packages\contracts\src\protocols\adEvidencePackage.ts`

**Step 1: Add new fields to Zod Schema**

```typescript
export const AdEvidencePackageSchema = z.object({
  productName: z.string().min(1),
  productUrl: z.string().url().optional(),
  angle: AdAngleSchema,
  callToAction: z.string().default('Start free trial'),
  evidence: z.array(AdEvidenceFactSchema).min(1),
  // New Intent Fields
  slogan: z.string().optional(),
  mustIncludePoints: z.array(z.string()).optional(),
  preferredAssetIds: z.array(z.string()).optional(),
});
```

**Step 2: Commit**

```bash
git add packages/contracts/src/protocols/adEvidencePackage.ts
git commit -m "feat(contracts): add intent fields to AdEvidencePackage"
```

---

### Task 2: Refine CinematicDirector Prompt Logic

**Files:**
- Modify: `d:\toTheSea\SaaSReels\saasreels-engine\src\director\v5\cinematicDirector.ts`

**Step 1: Update buildAdAngleDirectorContext**
Add logic to include slogan and points in the prompt context.

```typescript
export function buildAdAngleDirectorContext(
  input: AdEvidencePackage | null | undefined
): string {
  if (!input) return '';
  
  const facts = input.evidence.map((item) => `- [${item.type}] ${item.fact}`).join('\n');
  const sloganSection = input.slogan ? `## USER INTENT: SLOGAN\n- MANDATORY: Use exactly "${input.slogan}" in a prominent HeroShot or CTAShot headline layer.\n` : '';
  const pointsSection = input.mustIncludePoints?.length ? `## USER INTENT: CORE POINTS\n- MANDATORY: Ensure all these points are covered in the video: ${input.mustIncludePoints.join(', ')}\n` : '';

  return `
${sloganSection}
${pointsSection}
## 6. Ad Evidence Package
- Product: ${input.productName}
- Angle: ${input.angle}
- CTA: ${input.callToAction}
- Evidence facts:
${facts}
`;
}
```

**Step 2: Update System Prompt**
Add a strict directive about slogans.

```typescript
// Around line 125
- [ ] IF a slogan is provided in the User Intent section, it MUST appear exactly in at least one shot.
```

**Step 3: Commit**

```bash
git add saasreels-engine/src/director/v5/cinematicDirector.ts
git commit -m "feat(engine): enforce user intents in CinematicDirector prompt"
```

---

### Task 3: Bridge Web Intents to Engine CLI

**Files:**
- Modify: `d:\toTheSea\saasreels-web\src\shared\services\local-video-generator.ts`

**Step 1: Fetch Intents from Database**
In `runLocalGeneration`, fetch the `project_generation_intents` for the current project.

```typescript
// Fetch intents before writing evidencePath
const [intents] = await db
  .select()
  .from(projectGenerationIntents)
  .where(eq(projectGenerationIntents.projectId, job.projectId))
  .limit(1);

const enhancedEvidence = {
  ...job.evidencePackage,
  slogan: intents?.slogan,
  mustIncludePoints: intents?.mustIncludePoints ? JSON.parse(intents.mustIncludePoints) : undefined,
  preferredAssetIds: intents?.preferredAssetIds ? JSON.parse(intents.preferredAssetIds) : undefined,
};

fs.writeFileSync(evidencePath, JSON.stringify(enhancedEvidence, null, 2), 'utf-8');
```

**Step 2: Commit**

```bash
git add src/shared/services/local-video-generator.ts
git commit -m "feat(web): inject database intents into local generator pipeline"
```

---

### Task 4: End-to-End Verification

**Step 1: Create Mock Intent Package**
Create a test file `test-intent-package.json` with a specific slogan and points.

**Step 2: Run CLI directly**
Run: `npx tsx src/cli/v5.ts --url "https://example.com" --evidence-json test-intent-package.json --output ./output/test-intent`

**Step 3: Verify Output**
Check `cinematicScript.json` for the slogan and points.

**Step 4: Commit and Cleanup**

```bash
git commit -m "test: verify intent-driven generation"
```
