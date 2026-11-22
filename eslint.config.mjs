import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

export default defineConfig([
  ...nextVitals,
  ...nextTypeScript,
  // The existing editor and animation loop coordinate mutable state through refs.
  {
    files: [
      'app/components/ArticleContent.tsx',
      'app/components/WordBlurOverlay.tsx',
      'app/lib/useArticleEditor.ts',
    ],
    rules: { 'react-hooks/refs': 'off' },
  },
  {
    files: [
      'app/components/WordBlurOverlay.tsx',
      'app/components/ZoomWorkspace.tsx',
      'app/lib/useArticleEditor.ts',
    ],
    rules: { 'react-hooks/set-state-in-effect': 'off' },
  },
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
])
