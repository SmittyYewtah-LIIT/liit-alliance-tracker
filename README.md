# LIIT Daily VS Report Generator v3

Test build for the intended daily workflow:

1. Run `index.html` through VS Code **Live Server**.
2. Select all daily ranking screenshots at once (multi-select is enabled).
3. Click **Extract Members**.
4. Review the rank/name/points table and correct OCR mistakes.
5. Upload the Alliance Duel screenshot and click **Read Duel Screenshot (Beta)**, or type opponent/scores manually.
6. Click **Generate Report**.
7. Click **Download PNG**.

## Important
- OCR is still a test feature and may misread stylized player names. The review table is intentionally required before leadership use.
- The app deduplicates overlapping screenshots by rank and reports missing ranks.
- Event title auto-populates from the selected date: Mon Radar Training, Tue Base Expansion, Wed Age of Science, Thu Train Heroes, Fri Total Mobilization, Sat Enemy Buster.
- Reviewed roster data is saved in browser localStorage so refreshing does not erase your work.
