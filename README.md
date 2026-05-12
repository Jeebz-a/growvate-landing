# Growvate — AI Automation & Implementation Studio

Marketing landing page for [Growvate](https://growvate.com), an AI automation & implementation studio.

Single-page site with a one-page narrative plus inner pages for case studies and journal posts. Pure static HTML / CSS / vanilla JS — no build step.

## Stack
- HTML5
- Modern CSS (custom properties, grid, clamp, no preprocessor)
- Vanilla JS
- [GSAP](https://gsap.com/) + ScrollTrigger for animation
- [Lenis](https://lenis.darkroom.engineering/) for smooth scroll
- Google Fonts: Space Grotesk + Inter

## Structure
```
index.html              Landing page
case-madrah.html        Case study — Madrah.com
case-operator.html      Case study — Operator.io
case-havene.html        Case study — Havéne
case-vigor.html         Case study — Vigor Beans
post-playbook.html      Blog — 30-day AI implementation playbook
post-powerpoint.html    Blog — Why AI projects die in PowerPoint
post-stack.html         Blog — Our default 2026 AI stack
styles.css              All styles
script.js               All motion + interactions
```

## Local development
```bash
# any static server works — example:
python3 -m http.server 8000
# then open http://localhost:8000
```

## Deployment
Deployed to GitHub Pages — see Pages settings on the repo.

To swap the calendar placeholder for a real scheduling link, edit `index.html` and replace `https://cal.com/growvate` in the `.contact__cal-cta` anchor with your Calendly / Cal.com / Savvycal URL.
