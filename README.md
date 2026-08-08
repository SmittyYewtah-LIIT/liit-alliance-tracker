# LIIT Daily VS Report Generator — Locked Template Test Build

This build uses a fixed `template.png` background and draws only dynamic report data on top of it.

## Files
- `index.html`
- `styles.css`
- `app.js`
- `template.png`

## Test locally (recommended)
Do **not** double-click `index.html` and run it as a `file://` page.

In VS Code:
1. Open the folder.
2. Install the **Live Server** extension if needed.
3. Right-click `index.html`.
4. Choose **Open with Live Server**.

## GitHub
Replace the existing files in the repository root with these four files and commit them.
If using GitHub Pages, set Pages to deploy from the `main` branch/root.

## Current test workflow
1. Choose the report date.
2. The VS event title auto-populates from the weekday:
   - Monday — Radar Training
   - Tuesday — Base Expansion
   - Wednesday — Age of Science
   - Thursday — Train Heroes
   - Friday — Total Mobilization
   - Saturday — Enemy Buster
3. Enter the opponent and duel scores, or optionally try the Duel Screenshot OCR button.
4. Paste the reviewed roster as `rank,name,points`, one member per line.
5. Enter any excused members.
6. Click **Generate Report**.
7. Click **Download PNG**.

## Important
The Duel OCR button is currently marked **Beta** and should always be reviewed before generating. The report renderer itself is deterministic: it does not use AI image generation and will reuse the same template every time.
