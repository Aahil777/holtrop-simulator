# Holtrop–Mennen Resistance Simulator

Interactive ship resistance estimate using the Holtrop–Mennen (1982) method:

    RT = RF(1+k1) + RAPP + RW + RB + RTR + RA

The calculation lives in `holtrop.py`. The page runs that same file in the browser
with [Pyodide](https://pyodide.org), so the site is fully static and needs no server code.

| File | Role |
|---|---|
| `holtrop.py` | The eight-step method, validity ranges, speed sweep. Runs from the CLI too. |
| `test_holtrop.py` | Checks the engine against the course-notes worked example (1791.6 kN at 25 kn). |
| `runner.html` | The Python iframe: loads Pyodide, runs `holtrop.py` under `sys.settrace`, replays the executed lines. |
| `index.html`, `app.js`, `style.css` | Controls, ship/wave canvas, charts, step table, validity check. |

## Run locally

```bash
python3 -m http.server 8765
```

Then open http://localhost:8765. A server is needed because the page fetches `holtrop.py`.
Opening `index.html` straight from disk won't work.

```bash
python3 holtrop.py               # worked example table
python3 -m unittest test_holtrop # regression test against the notes
```

## Deploy to Vercel

This is a static site. No build step and no `vercel.json` are needed.

```bash
npx vercel          # preview deployment
npx vercel --prod   # production
```

You can also push the folder to GitHub and import it in the Vercel dashboard
(Framework preset: **Other**, no build command, output directory `.`).
