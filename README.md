# Jay Patel — Selected Work

The portfolio at [www.jayselected.com](https://www.jayselected.com).

Plain HTML, CSS and JavaScript: no framework, no build step, no dependencies.
Whatever is in `main` is what Vercel serves.

## Files

| File | What it holds |
| --- | --- |
| `index.html` | The page. A small inline script in the head sets the theme and the loading screen before first paint. |
| `styles.css` | Everything visual. Every value lives as a token in `:root` at the top; the sections that follow use only tokens. |
| `siteapp.js` | Behaviour, one `initialize…` function per feature, all started from `start()` at the bottom. |
| `images/` | Project images, one folder per project, banners in `banners/`. |
| `fonts/` | The self-hosted fallback font, for devices without Apple's system font. |
| `favicon.png` | The site icon, for the browser tab and the iPhone home screen. |
| `og-image.png` | The image shown when a link to the site is shared. |

## Preview locally

```bash
python3 -m http.server 4173
```

Then open http://localhost:4173.

## The system, in brief

- **Type:** one weight and three sizes (body, small, the greeting at twice the body), with leading always size + 8.
- **Fluid values** grow along one of two tracks in `:root`: `--fluid` for spacing and `--fluid-body` for body text. Each value states its two ends, so retuning means changing two numbers.
- **Motion:** calm and modest throughout, on the eases and durations in `:root`. Everything stops or simplifies under reduced motion.
- **Themes:** light and dark override the same tokens; nothing else changes between them.

## Adding a project

Copy an `<article class="project">` block in `index.html` and change its contents. Two rules:

1. Give every `<img>` its real pixel `width` and `height`, so the page never shifts while images load.
2. Keep `data-enter` on each part, so it fades in as it is scrolled to.

Use `.stack` for a single framed image and `.stack stack-row` for mockups side by side.
