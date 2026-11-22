# Zoomer v0.1.3

Semantic zoom for text — expand or contract content while preserving meaning using AI.

## Features

- **Extrapolate (zoom out `⌘+`)**: Add detail and clarity to your text
- **Distill (zoom in `⌘-`)**: Simplify text to its core concepts

## Setup

Copy `.env.example` to `.env.local`, add your OpenAI API key, then run `npm run dev`.

Zoomer streams rewrites from `gpt-6-luna` with low reasoning effort for lower latency.

## References

- Shen, J., Marquardt, N., Romat, H., Hinckley, K., Riche, N., & Chevalier, F. (2026). [Texterial: A Text-as-Material Interaction Paradigm for LLM-Mediated Writing](https://arxiv.org/pdf/2603.00452). *Proceedings of the 2026 CHI Conference on Human Factors in Computing Systems*.
