Truck Work Diary Checker - two rows + graph page version

How to update GitHub:
1. Unzip this file.
2. Open the folder.
3. Upload the files INSIDE this folder to the same GitHub repository root as your current Work Diary app.
4. Commit changes.
5. Wait a few minutes for GitHub Pages.
6. Refresh Safari / Home Screen app. If old app remains cached, delete and re-add the Home Screen icon.

Changes in this version:
- Main diary grid is back to two rows only: Work and Rest.
- Tap Work row to mark work.
- Tap Rest row to mark rest.
- Swipe left/right on the row to fill many blocks.
- Swipe up/down scrolls only.
- New Graph screen added between Work Diary and Settings.
- Graph screen shows the selected day drawn like a paper work diary graph page.
- PDF report export kept.
- CSV / Excel export kept.
- Driver name, licence number, and base time selection kept.

Important:
This is a personal checking helper only. It is not an NHVR-approved Electronic Work Diary and does not replace your official paper diary/EWD.


Driving + PDF close update:
- Added Driving screen back.
- Driving screen has Start Work / Driving now, Start Rest now, and Stop active timer.
- Stop active timer writes the rounded 15-minute blocks into the selected diary.
- PDF report page now has Close / Back to app button.
- Other two-row diary and graph features are kept.


JSON backup update:
- Added Export Backup JSON.
- Added Import Backup JSON.
- Backup restores slots, entries, driver details, licence number, base time, scheme, and settings.
- Keep JSON backup files private because they can contain diary history and driver details.


Backup reminder update:
- Added Backup reminder setting: Off, Daily, Weekly.
- Reminder shows when the app opens and JSON backup is due.
- iPhone/Safari cannot save JSON automatically without user action, so the reminder asks you to export manually.
- Last JSON backup date is shown in Settings.


Share / Save Backup update:
- Added Share / Save Backup JSON button.
- On iPhone this should open the share sheet so you can tap Save to Files and choose the folder.
- Normal Export Backup JSON remains available as direct download.
- Backup reminder now uses Share / Save Backup JSON when supported.


Paper daily sheet + two-up update:
- Graph page redesigned to look closer to the National Work Diary Daily Sheet.
- Added per-day fields: work diary no, page no, number plate, daily check time, fit for duty, and comments.
- Added editable work/rest change rows with odometer and location fields.
- Added two-up driver option with two-up driver details.
- PDF export now uses the new paper sheet preview.


Statistics + base state update:
- Added new Statistics screen.
- Statistics screen shows can-drive estimate, rolling window usage, breaks due, last 7 days, last 14 days, and last finished driving.
- Base time selection is now separated into ACT, NSW, NT, QLD, SA, TAS, VIC, WA like the paper diary.
- Existing paper-style graph page, two-up driver fields, PDF export, CSV export, JSON backup, and share/save backup are kept.


Auto page number update:
- Added Work diary book setup in Settings.
- You can turn Auto page number on/off.
- Set first page date and first page number once.
- App calculates each date's page number automatically.
- You can still manually override a day's page number on the Graph page.
- Added default work diary no and default number plate for new daily sheets.


Two-up helper rules + layout update:
- Added two-up helper rules mode when "I am working with a two-up driver today" is checked.
- Standard two-up helper adds 24h/7d/14d work windows and rest-window warnings.
- BFM two-up helper adds 24h/7d/14d work windows, 82h rest-window warning, and 7-day rest warning.
- Daily sheet details and Work/Rest change details moved from Graph screen to Work Diary screen.
- Removed the old Add paper diary line section from Work Diary screen.
- This is still a personal checking helper, not an NHVR-approved Electronic Work Diary.


Real book PDF update:
- PDF export now uses a fixed SVG layout designed to closely match the National Work Diary Daily Sheet sample.
- The page is generated as one landscape sheet with the same main sections: driver identification, activity details, time grid, totals, signature, and two-up driver identification.
- Odometer and location change details are drawn vertically in the work diary style.


Two-up carry-forward update:
- Added Carry forward two-up driver details setting.
- When enabled, two-up driver details continue onto next daily sheets until the driver unticks two-up or changes the two-up details.
- If two-up is selected but important two-up fields are missing, the app shows a warning.
- Keeps the real-book PDF export and all prior features.


Effective-date defaults update:
- Driver name, licence number, base state, work diary no, truck rego and two-up defaults are now effective from a selected date.
- Previous daily sheets are protected from later setting changes.
- Each daily sheet stores a snapshot of driver/base/truck details when created.
- Future pages update from the effective date forward.


Edit selected page only update:
- Added an "Edit selected page only" section.
- Unlocking it allows driver name, licence, base state, work diary no, page no and truck rego to be corrected for the selected date only.
- Previous and future pages are not changed.
- Added restore-from-defaults button for the selected date only.


Diary error audit update:
- Added Diary error check to Driving screen.
- Checks saved current and past pages for missing details, possible work/rest breaches, missing two-up fields, and missing work/rest change locations.
- Error list shows date, page number, and mistake description.
- Tapping an error opens that page and highlights the problem field/section/block.


Audit suggestions update:
- Diary error check now includes a possible fix suggestion for each error/warning.
- Fatigue-rule warnings explain the first problem time, likely rolling window, and possible ways to correct the record.
- Tapping an error opens the page, highlights the problem, and shows a fix panel on the Work Diary screen.
- No automatic rule-fix is applied; the driver must verify and change records manually.


Rule history / scenario update:
- Added Work option / rule history in Settings with effective date.
- Records Standard/BFM, solo/two-up, and co-driver work option from the effective date forward.
- Old pages are protected; audit/statistics/PDF use the rule record for the selected date where possible.
- Adds audit warnings for BFM to Standard transition if no 48h continuous rest is found before the change.
- Adds audit notes when solo/two-up mode changes or co-driver option is missing.
- Designed for mixed scenarios like Standard solo to BFM solo to BFM two-up and back to solo.


Compliance confidence update:
- Added Compliance Confidence Mode on Driving screen.
- App now warns "Cannot safely calculate" when critical information is missing, especially AFM without certificate conditions.
- Added rest type selection for rest change rows: rest, stationary rest, sleeper berth rest, night rest, 24h rest.
- Major rest checks now use rest type where available instead of assuming all rest is stationary.
- Added audit log for important changes.
- Added stronger audit warnings for missing rest type and missing setup information.
- This update intentionally refuses confident advice when data is incomplete.
