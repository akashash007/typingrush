# Typing Rush — React + Vite + Tailwind

A fast, juicy typing game built with React (Vite) and Tailwind CSS.  
Type falling words to destroy them. Use **power words** and switch **modes** to crank the chaos. Fully mobile-ready.

## ✨ Features

- **4 Modes**: Easy (stage-based word lists), Medium, Hard, **Extreme** (double words like `car bike`)
- **Powers (guaranteed every 15 spawns)**:
  - `SLOW` → bullet-time (0.2× speed; spawn rate slows too)
  - `POWER` → +1 heart when you type it fully
- **True Pause**: game loop fully stops; SLOW timer doesn’t drain while paused
- **Per-Mode High Scores**: stored in `localStorage` (`easy`, `medium`, `hard`, `extreme`)
- **Mobile Responsive**: sticky typing bar, safe-area padding, responsive word sizes
- **Confetti**: small pop when beating the current mode’s high; big blast on new best at Game Over

---

## 🚀 Quick start

> Requirements: Node **18+**

```bash
# 1) Create + install (if you haven't already)
npm create vite@latest
# choose React + JavaScript
cd <your-project>
npm install
