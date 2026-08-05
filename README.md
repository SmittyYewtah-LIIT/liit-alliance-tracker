# LIIT Daily VS Report Generator — MVP

This is the first working deterministic template renderer.

## What works now
- Uses the approved 1024×1536 report image as the locked background.
- Updates daily header data, match totals, participation metrics, Top 10, Leadership Follow-Up, and excused names.
- Calculates:
  - Participation = members at or above 3.6M / total alliance members
  - Stretch Goal = 7.2M+
  - Met Minimum = 3.6M–7.199M
  - Below Minimum = 1–3.599M
  - No Participation = 0
- Exports a PNG.
- Accepts screenshot uploads for visual review.

## Run it
Open `index.html` in Chrome or Edge. No installation is required.

For best results, run a tiny local server from this folder:

```bash
python -m http.server 8080
```

Then visit:

```text
http://localhost:8080
```

## Ranking input format
Paste one player per line:

```text
Atlas au Raa, 20196700
kiki 49, 19548150
```

## Next milestone
Add OCR extraction from the uploaded screenshots, followed by a review screen before rendering.
