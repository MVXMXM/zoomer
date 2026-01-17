# Zoomer

Semantic zoom for text — expand or contract content while preserving meaning using AI.

## Getting Started

1. Install dependencies:
```bash
npm install
```

2. Create a `.env.local` file with your Anthropic API key:
```
ANTHROPIC_API_KEY=your_api_key_here
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3001](http://localhost:3001)

## Features

- **Expand (Zoom Out)**: Add detail and clarity to your text
- **Contract (Zoom In)**: Distill text to its core concepts
- Streaming responses for real-time feedback
- Keyboard shortcuts: Arrow keys to zoom

## Tech Stack

- Next.js 15 with Turbopack
- React 19
- Tailwind CSS v4
- Framer Motion
- Anthropic Claude API
