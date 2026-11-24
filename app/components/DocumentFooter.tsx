'use client'

import { Github, Moon, Sun } from 'lucide-react'

export function DocumentFooter() {
  function toggleTheme() {
    const root = document.documentElement
    const theme = getComputedStyle(root).colorScheme === 'dark' ? 'light' : 'dark'
    root.dataset.theme = theme
    try {
      localStorage.setItem('zoomer-theme', theme)
    } catch {
      // The theme still works for this page when storage is unavailable.
    }
  }

  return (
    <footer className="document-footer">
      <button type="button" onClick={toggleTheme} aria-label="Toggle light and dark mode" title="Toggle light and dark mode">
        <Moon size={18} className="theme-moon" aria-hidden="true" />
        <Sun size={18} className="theme-sun" aria-hidden="true" />
      </button>
      <span className="document-footer-wordmark" role="img" aria-label="Zoomer" />
      <a href="https://github.com/MVXMXM/zoomer" target="_blank" rel="noopener noreferrer" aria-label="Zoomer on GitHub" title="Zoomer on GitHub">
        <Github size={18} aria-hidden="true" />
      </a>
    </footer>
  )
}
