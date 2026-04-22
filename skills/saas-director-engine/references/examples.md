# Minimal Example

```json
{
  "fps": 30,
  "format": "16:9",
  "totalFrames": 300,
  "scenes": [
    {
      "component": "HeroContent",
      "mediaElementId": "hero",
      "durationFrames": 75,
      "text": {
        "content": "Turn any SaaS page into a launch video",
        "style": "headline",
        "position": "center"
      },
      "params": {
        "bgGlowColor": "#050505"
      }
    },
    {
      "component": "GenerativeDemo",
      "mediaElementId": "dashboard",
      "durationFrames": 120,
      "text": {
        "content": "Show the workflow buyers actually care about",
        "style": "subhead",
        "position": "bottom"
      },
      "params": {
        "bgGlowColor": "#101820"
      }
    },
    {
      "component": "UnifiedCTA",
      "mediaElementId": "hero",
      "durationFrames": 105,
      "text": {
        "content": "Create your campaign today",
        "style": "headline",
        "position": "center"
      },
      "params": {
        "bgGlowColor": "#000000"
      }
    }
  ],
  "assets": {
    "hero": "https://cdn.example.com/hero.png",
    "dashboard": "https://cdn.example.com/dashboard.png"
  }
}
```
