# RenderSpec Contract

The director output must be a single JSON object.

```json
{
  "fps": 30,
  "format": "16:9",
  "totalFrames": 360,
  "scenes": [
    {
      "component": "HeroContent",
      "mediaElementId": "hero",
      "durationFrames": 90,
      "text": {
        "content": "Launch videos from one URL",
        "style": "headline",
        "position": "center"
      },
      "params": {
        "bgGlowColor": "#050505"
      }
    }
  ],
  "assets": {
    "hero": "https://cdn.example.com/hero.png"
  }
}
```

## Required Top-Level Fields

| Field         | Rule                                             |
| ------------- | ------------------------------------------------ |
| `fps`         | `30` or `60`                                     |
| `format`      | `16:9`, `9:16`, or `1:1`                         |
| `totalFrames` | Positive integer equal to summed scene durations |
| `scenes`      | Non-empty array                                  |
| `assets`      | Map from asset ID to URL/path                    |

## Required Scene Fields

| Field            | Rule                                        |
| ---------------- | ------------------------------------------- |
| `component`      | One allowed component name                  |
| `mediaElementId` | Asset ID from `assets`                      |
| `durationFrames` | Positive integer                            |
| `text.content`   | Non-empty overlay copy when text is present |
| `text.style`     | `headline`, `subhead`, or `caption`         |
| `text.position`  | `top`, `center`, or `bottom`                |
| `params`         | Object, even when empty                     |

## Allowed Components

- `HeroContent`
- `GenerativeDemo`
- `FocusShot`
- `FeatureHighlight`
- `SocialProof`
- `TestimonialSocialProof`
- `UnifiedCTA`
- `SplitScreen`

## Drift Fields To Reject

- `type` -> use `component`
- `duration` -> use `durationFrames`
- `scene.content` -> use `scene.text.content`
