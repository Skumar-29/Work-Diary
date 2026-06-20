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


Cancel/skip page update:
- Added Page status in Daily sheet details: Active, Cancelled/Void, Skipped/Unused.
- Added cancel/skip reason.
- PDF/Graph preview shows a large CANCELLED/SKIPPED watermark and reason.
- Audit treats cancelled/skipped pages separately and does not apply fatigue calculations to that marked page.
- Existing selected-page editing can be used to manually set the next usable page number if a paper page is skipped/cancelled.


Numeric keypad update:
- Odometer fields now use numeric keypad and accept numbers only.
- Page number fields now use numeric keypad and accept numbers only.
- Licence number and truck rego remain text fields because they can contain letters depending on format.


Uppercase number plate update:
- Number plate / truck rego fields automatically convert typed letters to uppercase.
- Applies to daily sheet number plate, default number plate, and selected-page number plate edit.


Numeric licence update:
- Driver licence number fields now open the numeric keypad.
- Licence number fields accept numbers only.
- Applies to main driver licence, selected-page licence, and two-up driver licence.
- Truck rego remains uppercase letters/numbers.


Backup compatibility / migration update:
- Added schema version to JSON backups.
- Added migration layer so older JSON backups are accepted and upgraded safely.
- Missing fields from old backups are filled with safe defaults.
- New data health check button verifies current local data and reports schema version.
- Same localStorage key is kept so updating GitHub files does not intentionally delete phone data.
- Best practice remains: export JSON backup before every update.


Optional audit items update:
- Missing work/rest change location warnings can be marked "Not required".
- Missing odometer reading warnings can be marked "Not required".
- This only hides optional odometer/location audit items and does not affect fatigue-rule errors or important missing details.
- Optional dismissals are saved in JSON backups and can be shown again from the audit list.


Navigation fix update:
- Fixed missing schema constants that could stop app setup and prevent screen buttons from working.
- Added defensive tab switching so navigation still works even if one screen has a render warning.
- Kept optional "Not required" audit items for odometer/location warnings.


Layout, optional audit, page numbering and cancelled-page lock update:
- Rebuilt the real-book SVG/PDF layout with more spacing to avoid overlapping header, graph, totals and two-up sections.
- Fit for Duty not ticked can now be marked Not required, same as optional odometer/location items.
- Open error now uses safer navigation and scrolling/highlighting.
- Auto page numbers now count used book pages, not every calendar day. Full rest days without Work/use-page do not consume a page number.
- Added Use paper page for this day checkbox for manual page use.
- Cancelled/skipped pages lock the Work/Rest grid and timer until changed back to Active.
- NHVR/fatigue calculation logic was not changed in this update.

Patch:
- Swipe/tap Work block edits now immediately update used-page auto numbering.


Visual layout and save toast update:
- Settings forms now stack safely on iPhone, preventing overlapping fields like My work option and First page number.
- Added small auto-hiding Saved toast notification for save actions.
- Rebuilt the PDF/Graph SVG again with a shorter, more balanced layout closer to the sample sheet and less overlap risk.
- Added extra bottom padding so the tab bar does not cover settings content.


Real paper diary layout update:
- Graph/PDF daily sheet rebuilt to better match the uploaded real paper diary photo.
- Left vertical Details of Activities box is contained inside the activities section.
- Top driver identification boxes aligned more cleanly.
- Two-up row separated from the hour number row.
- Bottom two-up driver identification fields aligned to reduce overlap.
- Work diary no, NFV and page number are closer together and displayed in red.
- Added Export this page as PDF button at the bottom of the Graph screen.
- No NHVR calculation/rule logic changed.


Minor real-book layout correction update:
- Removed extra Work/Rest Option text from graph header to avoid overlap with Standard.
- Shrunk/moved the Two-up Driver Signature box so it no longer overlaps the license-issued boxes.
- Made the Driver Name, Date and daily-check boxes slightly thinner for cleaner separation from the row below.
- Updated the Work Diary No pattern to: WORK DIARY NO.  NFV  9912  03, with black label/NFV and red number/page.


Header and two-up spacing refinement update:
- Reduced spacing between NFV, work diary number and page number to match the paper diary pattern more closely.
- Shifted the full WORK DIARY NO. / NFV / number group slightly to the right.
- Moved the TWO-UP DRIVER'S IDENTIFICATION section slightly downward to stop overlap with the bottom hour row.
- No rule logic or calculations changed.


Defaults/carry-forward fix:
- Fixed base time/state carry-forward from effective date so QLD/VIC/WA etc no longer revert to NSW on following pages.
- Fixed work option carry-forward so BFM/Standard and solo/two-up apply from effective date to following pages.
- Fixed Settings Scheme dropdown so selecting BFM Solo saves into work option history instead of snapping back to Standard.
- Driver details, book setup, truck rego, work diary no and rule history now re-apply forward to non-manually-edited pages.
- Save buttons now show the small auto-hiding Saved toast.
- NHVR calculation/rule formulas were not changed.


Header spacing tightening update:
- Reduced spacing further in the top-right pattern:
  WORK DIARY NO.  NFV  9912  03
- Kept the rest of the graph/PDF layout and all rule calculations unchanged.


NHVR guide calculation redesign:
- Added NHVR Work Diary Guide v1.3 counting engine.
- Short rest rules are counted forward from the end of every rest break.
- 24h and longer periods are counted from relevant major rest-break ends.
- A second relevant major rest inside an existing 24h window does not reset the earlier 24h window; the earlier window remains active until its full end time.
- Added anchored 24h, 7d, 14d and two-up helper checks based on Standard/BFM solo/two-up profiles.
- AFM remains record-only until exact certificate conditions are entered.
- Removed NFV from the Graph/PDF header to match the NHVR daily sheet design.
- Existing visual layout and settings carry-forward preserved.


Compact header update:
- Removed the duplicate/fake iPhone status/time row from the app header.
- Reduced Work Diary header height significantly.
- Kept screen title, selected date, scheme, and previous/today/next date buttons.
- UI-only change; fatigue calculations and NHVR engine unchanged.


Location picker update:
- Added a 📍 current-location button beside Work/Rest change location fields.
- Manual typing remains available.
- Uses iPhone/browser GPS plus online reverse-location lookup to fill a compact NHVR-style place name:
  suburb/town, fuel station/truck stop/rest area name where available, or nearby road/place in remote areas.
- Requires location permission and data connection for automatic lookup.
- If lookup fails, the app leaves the manual box unchanged.
- No NHVR calculation/rule logic changed.


Vehicle / driver registry update:
- Added a new Vehicles screen/tab.
- You can save vehicle rego, fleet/truck name, company/operator, state, start/end date and notes.
- You can save driver/two-up partner name, licence number, licence state, work option, BFM/AFM accreditation number, role, dates and notes.
- Vehicle records can be applied to the current diary page number plate.
- Saved driver records can be applied as the current page's two-up driver.
- Registry data is included in JSON backups/imports.
- Useful for checking past road fines/incidents against the vehicle or two-up driver recorded at that time.
- No NHVR calculation/rule logic changed.


Auto-save registry update:
- Added Auto-save truck rego and two-up driver details from diary pages.
- New truck regos typed on diary pages are saved to Vehicles automatically when the option is ON.
- Two-up driver name/licence/state/work option entered on diary pages is saved to Drivers automatically when the option is ON.
- Duplicate vehicles are matched by rego.
- Duplicate drivers are matched by licence number first, then name.
- Existing manually saved records are protected; auto-save only fills missing details and updates first/last seen dates.
- Registry auto-save setting is included in JSON backup/import.
- No NHVR calculation/rule logic changed.


Usability/performance fix update:
- Work diary number in Graph/PDF header is now black; page number remains red.
- Day-of-week and driver-base state/territory boxes now show an X mark instead of changing selected text colour.
- Manual location input box is wider/taller and easier to type into.
- Current-location picker button is now wired correctly and has a backup reverse-geocode service.
- Auto-save vehicle/driver registry no longer saves partial regos while typing. It runs after Save daily sheet details.
- Added Save daily sheet details button.
- Header stays fixed/sticky while scrolling.
- Removed the calendar icon between previous and next day buttons.
- Swipe selection now restores accidentally selected extra blocks if you reverse direction before lifting your finger.
- Graph preview is reduced by about 20-25% in preview size on the Graph screen; export PDF remains full size.
- Render/update work reduced to improve lag/hanging.
- NHVR fatigue calculation engine unchanged.


Fast mode performance update:
- Block selection no longer runs full NHVR breach scanning on every grid render.
- Date previous/next now renders the diary screen first and avoids rebuilding graph/audit/statistics.
- Typing in detail fields uses debounced saving and does not rebuild heavy screens on each letter.
- Heavy screens render only when opened: Graph, Driving audit, Statistics, Vehicles, Settings.
- Swipe/tap block edits use fast render and debounced save.
- NHVR fatigue calculation engine unchanged; audit/statistics still run when those screens are opened.


Fast mode v2 fix:
- Fixed Work/Rest change table after location-box enlargement: Rest Type and location picker remain visible via horizontal scroll.
- Added Show automatic location picker button ON/OFF setting.
- Fixed base state/base time saving so VIC/QLD/etc does not revert to NSW after save.
- Saved base state now applies forward to non-manually-edited pages.
- Made the top header fixed to viewport so date and previous/next buttons stay visible while scrolling.
- No NHVR fatigue calculation engine changes.


Work/Rest change details table scroll update:
- Made Work/Rest change details an intentionally wide horizontal-scrolling table, similar to graph preview.
- Added swipe left/right hint.
- Gave proper space to Location, Rest type, Notes and current-location picker button.
- Kept manual typing, location picker ON/OFF, and fast mode.
- No NHVR calculation engine changes.


Breach highlight, sticky columns and comment layout update:
- Restored red breach highlighting on the Work/Rest grid using one NHVR scan per grid render, not one scan per block.
- Time and Activity columns in the Work/Rest change details table now stay frozen/sticky while scrolling left/right.
- Comments / number plate change notes now print inside the correct comments writing area on the Graph/PDF, not over the left label box.
- Long comments are wrapped and safely shortened on the sheet preview/PDF to avoid overlap.
- NHVR fatigue calculation engine unchanged.


Change details table visibility fix:
- Fixed sticky Time and Activity columns showing too dark/black and unreadable.
- Sticky columns now stay light with readable black text in both light and dark iPhone modes.
- Added table visibility/stability safeguards so the Work/Rest change details table does not collapse or disappear leaving only the scrollbar.
- No NHVR calculation engine changes.


Graph refresh/update fix:
- Graph screen now refreshes the selected page data every time Graph is opened.
- Added Refresh page button on Graph screen.
- Added Re-apply current defaults button on Graph screen for when you want the selected page to use current driver/base/truck/work-option defaults.
- Saving driver/base details, book setup, or work option now refreshes the current page immediately so base state and graph details do not stay stale until Safari refresh.
- No NHVR calculation engine changes.


Precise breach highlighting update:
- Red grid highlights now mark only the work blocks where the limit is exceeded, not the whole counted work/rest window.
- Earlier legal work blocks stay green.
- Short-rest and 24h/longer work-limit checks still use the NHVR counting engine, but the display now identifies the first/minimum illegal blocks.
- Missing major-rest requirements are shown in the audit/suggestion text instead of colouring the whole work period red.
- Suggestions now identify the first red block and recommend adding/moving the required rest before continuing from that block.
- NHVR calculation engine structure and limits were preserved; only focus/highlight selection was refined.


Jump to page/date update:
- Added Jump to old page/date section on Work Diary screen.
- You can jump directly by date.
- You can search/open by work diary page number.
- Page-number search matches both spaced and unspaced formats, e.g. 9912 30 matches 991230.
- Page number fields now allow digits and spaces, so you can save formats like 9912 30.
- Licence and odometer fields remain numbers-only.
- Auto page numbering keeps the spacing pattern from the first page number, e.g. 9912 30, 9912 31, 9912 32.
- No NHVR calculation engine changes.


Find modal update:
- Replaced the large Jump to old page/date card with a compact 🔎 Find button near previous/next date controls.
- Find opens a popup/modal with the same jump-by-date and find-by-page-number options.
- Page number spaces like 9912 30 remain supported.
- This saves screen space on the Work Diary page.
- No NHVR calculation engine changes.
