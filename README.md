# Zoomer v0.1.1

Semantic zoom for text — expand or contract content while preserving meaning using AI.

## Features

- **Extrapolate (`→` with text highlighted)**: Add detail and clarity to your selection
- **Distill (`←` with text highlighted)**: Simplify your selection to its core concepts

## Configuration

Rewrites stream from Gemini 3.5 Flash-Lite with minimal thinking for low latency.
Add a [Gemini API key](https://aistudio.google.com/apikey) to `.env.local`:

```env
GEMINI_API_KEY=your_key_here
```

## References

- Shen, J., Marquardt, N., Romat, H., Hinckley, K., Riche, N., & Chevalier, F. (2026). [Texterial: A Text-as-Material Interaction Paradigm for LLM-Mediated Writing](https://arxiv.org/pdf/2603.00452). *Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems*.
