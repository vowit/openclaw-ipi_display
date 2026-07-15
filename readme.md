# OpenClaw Replay Showcase

Single-page static frontend for visualizing the main execution flow of OpenClaw replay cases.

## Features

- Interactive case selection across 5 replay cases
- Focused live-stage replay instead of a fully expanded trace
- Case briefing with original task, injected instruction, and attack goal
- Current-node status transition view
- File-level context for distinguishing different cases
- Auto-play mode for presentation demos

## Project Structure

```text
.
|-- index.html
|-- styles.css
|-- app.js
|-- server.py
`-- data/
    `-- data/
        `-- demo_cases_display.json
```

## Run Locally

```bash
python server.py
```

Then open `http://127.0.0.1:8000`.

## Deploy With GitHub Pages

This repository is ready for GitHub Pages deployment through GitHub Actions.

### What is included

- A Pages deployment workflow at `.github/workflows/deploy-pages.yml`
- Relative asset paths, so the static site works under a GitHub Pages repository URL
- A `.nojekyll` file so GitHub Pages serves the project as plain static files

### Recommended setup

1. Push this repository to GitHub.
2. Make sure your default branch is `main`.
3. In GitHub, open `Settings -> Pages`.
4. Under `Build and deployment`, choose `GitHub Actions`.
5. Push to `main`, or manually run the `Deploy GitHub Pages` workflow.

After deployment, GitHub will provide a Pages URL for the site.

## Notes

- The app loads replay data from `./data/data/demo_cases_display.json`.
- Because the site is fully static, it can also be deployed to Vercel, Netlify, or any static hosting platform.
