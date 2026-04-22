# Duration Strategy

Choose the total duration after choosing the job the video must do.

## Mode Selection

| Mode                   | Use When                                                                     | Typical Duration | Scene Count |
| ---------------------- | ---------------------------------------------------------------------------- | ---------------- | ----------- |
| `hook-ad`              | The goal is stop-scroll attention, paid social, or a compressed CTA cut      | 12-20s           | 4-5         |
| `landing-page-summary` | The goal is to explain a homepage, offer, positioning, or a few key sections | 20-35s           | 5-7         |
| `product-demo`         | The goal is walkthrough, onboarding, product tour, or multi-step explanation | 30-50s           | 6-9         |

## Decision Rules

1. If the user gives an explicit duration, honor it unless it makes the brief impossible.
2. If the brief says demo, walkthrough, onboarding, or explainer, bias toward `product-demo`.
3. If the input is a source URL and no shorter ad objective is stated, default to `landing-page-summary`.
4. Increase duration when must-include points, page sections, or proof beats would otherwise be rushed.
5. Decrease duration only when the brief is clearly hook-first and can survive aggressive compression.

## Pacing Guidance

- `hook-ad`: one idea per beat, fast transitions, no more than one proof beat
- `landing-page-summary`: enough time to introduce the pain, solution, proof, and CTA cleanly
- `product-demo`: slower explanatory pacing, more on-screen product evidence, fewer slogan-only scenes

## Failure Signals

- Everything feels like taglines and nothing explains the page
- CTA appears before the product is understandable
- The script tries to cover five sections in 15 seconds
- Important proof or product shots never get enough screen time
