# Marisinglu 🛡️

**Instantly check if a product is safe for celiac disease and gluten intolerance.**

A production-quality MVP mobile web app built with React + Vite.

## Features

- 📸 **Product Scanner** — Barcode & label scanning simulation with real-time analysis
- 🔬 **Ingredient Analyzer** — Paste any ingredient list, detect 40+ hidden gluten markers
- 🗺️ **Safe Restaurants** — Community-verified nearby restaurants with safety badges
- ❤️ **My Pantry** — Saved products, scan history, trusted restaurants

## Tech Stack

- React 18 + Vite
- Lucide React (icons)
- DM Sans (Google Fonts)
- Pure CSS animations

## Getting Started

```bash
npm install
npm run dev
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new)

1. Push this repo to GitHub
2. Import in [Vercel](https://vercel.com/new)
3. Framework preset: **Vite** (auto-detected)
4. Deploy — done ✓

No environment variables required for the MVP.

## Safety Levels

| Level | Color | Meaning |
|-------|-------|---------|
| ✅ SAFE | `#1E8E5A` | Verified gluten-free |
| ⚠️ CAUTION | `#E6A700` | Possible traces or uncertainty |
| ❌ NOT SAFE | `#C44536` | Confirmed gluten risk |

---

Built with ❤️ for the celiac community.
