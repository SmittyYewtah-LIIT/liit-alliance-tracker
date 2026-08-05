# LIIT Daily VS Report Generator

This version adds browser-based OCR for the standard Last War Daily Rank screenshots.

## Run it

Do not open `index.html` directly from a ZIP or with a `file://` URL.

1. Extract the folder.
2. Open the folder in VS Code.
3. Right-click `index.html` and choose **Open with Live Server**.
4. The address should begin with `http://127.0.0.1` or `http://localhost`.

## Daily workflow

1. Enter date, event, scores, and roster size.
2. Upload all Daily Rank screenshots.
3. Click **Extract Members**.
4. Review and correct the extracted table.
5. Enter excused members, if any.
6. Click **Generate Report**.
7. Click **Download PNG**.

OCR runs in the browser using Tesseract.js and therefore needs an internet connection when the page loads. A review step remains intentional because game usernames and screen overlays can occasionally be misread.
