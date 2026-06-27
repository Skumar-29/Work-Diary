Build: clean-engine-archive-ready-fast-import / schema 58
Service worker: truck-work-diary-v93-instant-grid-refresh

This update keeps the NHVR counted-period calculation engine unchanged and adds instant Work/Rest grid repaint with deferred breach highlighting, deferred change-detail refresh, and delayed idle saving for smoother iPhone use.

BUILD: clean-engine-fast-due-break-planner

Update focus:
- Automatic safe post-update cache cleanup.
- Manual Settings > App updates > Clean App Cache Safely button.
- Old app-file caches/service-worker leftovers are cleared without deleting real diary data, settings, vehicles, drivers or backups.
- Audit list cache reuses results across page changes for smoother screen opening.
- NHVR counted-period engine unchanged.

Truck Work Diary Checker - two rows + graph page version

How to update GitHub:
1. Unzip this file.
2. Open the folder.
3. Upload the files INSIDE this folder to the same GitHub repository root as your current Work Diary app.
4. Commit changes.
5. Wait a few minutes for GitHub Pages.
6. Refresh Safari / Home Screen app. If old app remains cached, delete and re-add the Home Screen icon.

Changes in this version:

Additional changes in this version:
- Stats 14-day accumulated table now follows the Calculate as of date/time, not the header-selected diary date.
- Calculate Statistics As Of Now refreshes the table to the current date/time.
- Current as-of day only counts saved work up to the as-of time.
- Stats screen opens faster by skipping hidden Driving-screen calculations and reducing repeated table scans.
- NHVR counted-period engine unchanged.

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


Find modal v2 fix:
- Fixed Find popup buttons so Go to Date and Find Page jump correctly.
- Fixed X close button and outside-tap close.
- Moved Find button to the left side of the header.
- Centered Work Diary title in the header.
- Reduced Find button font weight/size so it matches the header style better.
- No NHVR calculation engine changes.


Find modal v3 action fix:
- Rebuilt Find popup button handling with event delegation so Safari reliably receives button taps.
- Go to Date now sets the selected date, refreshes the diary page, and closes the popup automatically.
- Find Page now opens the matched page/date, refreshes the diary page, and closes the popup automatically.
- X close button and outside-tap close now work reliably.
- No NHVR calculation engine changes.


Page-number spaces fix:
- Settings Start page no. / First page number now accepts digits and spaces, e.g. 9912 30.
- Diary/page number fields now accept digits and spaces.
- Work diary number fields also preserve digits and spaces where used for book/page formatting.
- Page number search still matches spaced and unspaced versions.
- Licence and odometer fields remain numbers-only.
- No NHVR calculation engine changes.


Diary Book History update:
- Added Diary Book History inside Settings.
- Added Close current diary book option with close date, last page number and notes.
- Added Start new diary book option with new diary number, first page number, start date and notes.
- Auto page numbering now uses the diary book active for that date, so old pages stay linked to the old book and new pages start from the new book.
- Starting a new book automatically closes the previous active book on the day before the new start date.
- JSON backup/import includes diary book history.
- Find page/date works across old and new diary books because calculated page numbers use the correct book period.
- No NHVR fatigue calculation engine changes.


Diary Book History display format update:
- Changed diary book history display to the simpler format:
  Book 1
  Starts: DD/MM/YYYY
  First page: 3333 54
  Closed: DD/MM/YYYY
  Last page: 3333 99
- Active book displays as Book 2 - Active.
- No page-numbering, backup/import, Find, or NHVR calculation logic changed.


History-start / refresh / diary-number update:
- Added Calculation History settings:
  - History starts from date
  - Before this date assume: No work/full rest, Unknown previous history, or Previous history imported.
- Long-period rest/night-rest checks are no longer shown as breaches before the full 7d/14d period has ended.
- If previous history is unknown, long-period checks can show a previous-history-needed warning instead of a false confirmed breach.
- Default work diary number and other work diary number fields now accept letters, numbers and spaces, and auto-uppercase input.
- Page number fields remain digits/spaces only; licence and odometer remain numbers-only.
- Added a small 🔄 refresh button near Find for all screens.
- Changed Settings tab icon to ⚙️.
- NHVR limits and work/rest counting formulas were not changed; this update only improves missing-history handling and UI refresh.


Header alignment fix:
- Aligned Find, Refresh, screen title, and previous/next buttons on one row.
- Kept Refresh immediately after Find.
- Center title adjusted slightly to account for the left buttons.
- UI-only change; no data, page numbering, or NHVR calculation logic changed.


Header tight alignment fix:
- Moved the 🔄 refresh button directly beside Find with almost no gap.
- Removed the extra title shift so the screen title is closer to center.
- UI-only change; no data, page numbering, or NHVR calculation logic changed.


No details + refresh/recalculation fix:
- Added compact N/D column before Time in Work/Rest change details.
- N/D, Time and Activity columns are frozen while scrolling left/right.
- N/D is automatically ticked for midnight continuation rows where the activity continues from the previous day.
- Manual N/D can be ticked for rows where odometer/location are not required.
- When N/D is ticked, odometer/location fields and the location picker are disabled for that row.
- Missing odometer/location audit warnings ignore N/D rows only; fatigue checks and rest-type calculations are unchanged.
- Activity wording in the change table now uses Work instead of Work / Driving to save space.
- Added derived-data rebuild/repair to clear stale auto page numbers after blocks are removed and refresh audit/table/page data more reliably.
- NHVR fatigue calculation limits/formulas were not changed.


Smart N/D breaks update:
- Added Short break details settings: Manual only, Smart short-break mode, or Strict.
- Added short break limit: 15/30/45/60 minutes.
- Midnight continuation rows now show Continuation instead of asking for rest type.
- Continuation rows do not create missing rest-type, odometer, or location errors.
- Rest continuation across midnight inherits the previous rest type for major-rest calculations.
- Smart mode auto-selects Rest for short rest rows between work periods.
- Smart mode auto-ticks N/D on the return-to-work row after a short break, while the rest-start row still requires odometer/location.
- Optional odometer/location audit button wording is now Skip.
- NHVR slot-based work/rest and fatigue limit calculations were not changed.


Fatigue short-window repair:
- Added rolling short-rest window checks to catch continuous work even when there is no saved previous rest-end anchor.
- A 10-hour continuous Work selection should now trigger red breach blocks and Driving screen errors under Standard/BFM short-rest rules as applicable.
- This fixes the case where a fresh app/history start allowed long continuous work to stay green.
- Saved diary data, diary book history, N/D logic, and user settings are not reset.
- NHVR rule limits were not weakened; this adds a safer detection path for the existing short-rest limits.


Fatigue engine verification update:
- Fixed a recursion/stale-history problem in rest-type inheritance for automatic midnight continuation rows. This could stop the fatigue checker and leave continuous work green.
- Added/verified rolling short-rest window checks for Standard solo, Standard two-up, and BFM solo short-rest limits.
- Strengthened next-break/active-window calculations so fresh history still shows due-break status.
- Added guarded NHVR engine self-test function for console/debug checks.
- No diary data, N/D smart options, diary book history, page numbering, or UI settings were reset.


Required-rest highlight fix:
- Red blocks now mean "put the required rest here" instead of marking all later work blocks red.
- Short-rest breaches mark only the required rest duration:
  - 15 min = 1 block
  - 30 min = 2 blocks
  - parsed hour rest durations mark the corresponding number of 15-minute blocks.
- Rolling short-window detection is kept so continuous work still triggers breaches from fresh history.
- Previous-date records are still considered by the NHVR engine where available.
- Missing previous history is not treated as old-work unless data exists/settings say it should be imported.
- No N/D, smart short-break, diary-book, page-number, or UI settings were changed.


NHVR engine rebuild + Stats rebuild:
- Replaced the fatigue/break calculation engine with a cleaner 15-minute-block model.
- Short-rest rules now count forward from the end of every rest break, with a virtual clean-start anchor only when Calculation History says there was no prior work.
- 24h and longer periods count forward from the relevant major rest break, not from inside work/rest periods.
- Red blocks now mark only required-rest blocks or the first over-limit block, not all following work.
- Standard solo, Standard two-up, BFM solo and BFM two-up rule profiles are rebuilt from the NHVR work diary tables.
- Rebuilt Stats screen:
  - work remaining / rest required card
  - active counted windows
  - next rest due / 24h period end
  - 24h / 7d / 14d summary
  - BFM long/night work helper
  - last 7 daily summaries
- Kept N/D, short-break settings, page numbering, diary book history, Find/Refresh, backup/import and smart options unchanged.
- Added console self-test: nhvrEngineSelfTest()


BFM 24h anchor repair:
- Fixed a bug where a major rest ending after the work day could incorrectly become the only 24h anchor.
- This caused the user's BFM 15h45m day to show green even though BFM solo should breach the 14h/24h work limit.
- The engine now keeps a clean-start/previous-major-rest anchor for the current 24h period and uses later major rests for the next period.
- Added a Work Diary alert for the first NHVR helper breach on the selected page.
- Added/updated console self-test: nhvrEngineSelfTest()
- No N/D, diary book, page numbering, vehicle records, Find/Refresh or layout settings were changed.


NHVR engine QA final:
- Fixed long-period fallback anchors: if a relevant major-rest anchor is not available, 24h+ periods are counted from the end of any rest break.
- Added an obvious daily over-limit safety check so a BFM day with more than 14h work or Standard day with more than 12h work cannot stay green.
- Added console self-test: nhvrEngineSelfTest()
- Ran automated scenario tests, including the user's BFM 15h45m and 20h+ screenshots plus a 30-day mixed scenario battery.
- No N/D, smart short-break, diary book history, page numbering, vehicle records, Find/Refresh or graph layout settings were changed.


D-scenario QA update:
- Added the user's D-01 to D-05 test cases to nhvrEngineSelfTest().
- Corrected moving sleeper rest handling:
  - Sleeper berth rest counts for moving-sleeper rules where allowed.
  - Sleeper berth rest no longer counts as stationary rest for rules that specifically require stationary rest.
  - Use Stationary / Night / 24h rest type when the rest must count as stationary.
- Added Standard two-up under-5h moving sleeper berth rest warning for D-05.
- Added 7d/14d rolling safety checks for work-limit ceilings so over-limit long periods cannot stay green if anchor history is unclear.
- Added user screenshot scenarios U-01 and U-02 to QA tests.
- No page numbering, diary book history, N/D, Find/Refresh, graph layout or vehicle records changed.


Change table blank-box fix:
- Fixed Work/rest change details table rendering when the holder was visible but rows were not being displayed.
- If there are no rows, the app now shows a clear message instead of a blank white box.
- Removed forced blank table height/min-height behaviour.
- This update only touches the change-details table display/refresh. It does not change fatigue rules, page numbering, graph layout, N/D logic, vehicle records, or diary history.


Change table render-call fix:
- Fixed the exact issue where the Work Diary screen showed the blank/fallback message because renderDiaryFast did not call renderChangeDetailsEditor.
- Work/rest change details now rebuild whenever the Work Diary screen refreshes.
- Added safe render wrapper and table self-test helper: changeDetailsTableSelfTest().
- If change rows are unexpectedly empty, the table now creates at least the current 00:00 row instead of leaving the box blank.
- This only changes Work/rest change table rendering. Fatigue rules, graph layout, page numbering, N/D logic, vehicle records and diary history are unchanged.


BFM solo 7-day long/night fix:
- Added a focused BFM solo long/night detector.
- It counts rolling 7-day long/night work:
  - all work between 00:00 and 06:00
  - non-night work after 12h work has been reached on that daily sheet/24h page
- If the total exceeds 36h in the rolling 7-day period, the first over-limit block is marked red as an error.
- This specifically fixes the case where previous days have used almost all night hours and the driver starts too early on the next day.
- Added self-test helper: nhvrBfmLongNightSelfTest()
- No graph layout, N/D logic, table logic, page numbering, vehicle records, diary history, settings, or other fatigue rules were changed.


BFM solo 84h checkpoint fix:
- Added a focused BFM solo 84h checkpoint detector.
- It catches the situation where the driver has about 82h work before Sunday, works from 06:00, reaches 84h at 08:00, and must not continue without 24h continuous stationary rest.
- It marks the first over-limit block red.
- It also allows restart after a full 24h continuous no-work/stationary rest, e.g. Sunday evening after stopping Saturday evening.
- The check is BFM solo only and does not change Standard, BFM two-up, graph layout, N/D logic, table logic, page numbering, vehicle records, diary history, settings, or other fatigue rules.
- Added self-test helper: nhvrBfm84CheckpointSelfTest()


Smart major rest classification:
- Added Settings > Smart major rest classification.
- Less than 7h continuous rest stays normal Rest.
- Solo 7h+ continuous rest auto-counts as Stationary rest, or Night rest if it qualifies in the 10pm-8am window.
- Two-up 7h+ continuous rest auto-counts as Sleeper berth rest and shows a skippable Driving screen reminder.
- 24h+ continuous rest auto-counts as 24h rest unless manually overridden.
- Manual rest type choices still override auto choices.
- Sleeper berth rest no longer counts as stationary rest; Stationary/Night/24h are stationary.
- This focused update keeps the BFM long/night and 84h checkpoint fixes unchanged.
- Added self-test helper: smartMajorRestSelfTest()


Stats 14-day accumulated hours table:
- Added compact scrollable table to Stats screen.
- Columns: Date, Work, Acc, Left, Major, L/N, L/N 7d, L/N Left, Warn.
- Shows 14 rows ending on selected date.
- BFM solo shows long/night planning values and 84h checkpoint remaining.
- BFM two-up / Standard solo / Standard two-up show rolling work planning values while L/N columns show dash.
- Date column is frozen. Table is horizontally scrollable for readability.
- This is display-only and does not change fatigue breach detection, graph layout, N/D, page numbering, vehicle records, diary history or settings.
- Added self-test helper: stats14DayTableSelfTest()


Update button + backup prompt flow:
- Added Settings > App updates.
- Check for Update checks the deployed app.js build using a no-cache request.
- Before updating, the app asks: Save Backup or Skip Backup.
- Save Backup starts JSON backup save/share first, then shows Update App Now.
- Skip Backup directly shows Update App Now with a warning.
- Update App Now clears cached app files only, updates service worker/cache, and reloads the app.
- Force Reload App Files uses the same backup prompt and cache refresh flow.
- Diary data, settings, vehicle records, book history, N/D data and saved records are not cleared.
- Added current app version display and appUpdateButtonSelfTest().


PWA header safe + remove legacy Stats card:
- Fixed installed Home Screen/PWA header overlap without changing Safari layout, app width, zoom, or grid scale.
- The fix runs only when the app is opened as a Home Screen/standalone PWA.
- Removed the old "Last 7 days / 14 days" Stats card because the compact 14-day accumulated table replaces it.
- Kept the compact 14-day accumulated table.
- Kept update button, smart major rest, BFM long/night, BFM 84h checkpoint, graph, N/D, page numbering, diary history and settings.
- No fatigue rule calculations were changed.
- Added self-test helper: pwaHeaderSafeSelfTest()


PWA content push-down fix:
- Added a real small top spacer under the header only when opened from iPhone Home Screen / standalone PWA.
- This physically pushes Diary, Driving, Stats, Graph, Vehicles and Settings content a little lower so it is not hidden under the header.
- Safari browser layout is unchanged.
- No app width, zoom, grid scale, or global scroll behaviour changed.
- Kept the compact 14-day Stats table and removed the old 7-day/14-day stats card from the previous update.
- No fatigue rules, BFM long/night, BFM 84h checkpoint, smart major rest, update button, N/D, page numbering, diary history or settings were changed.
- Added self-test helper: pwaContentPushDownSelfTest()


Service worker no-redirect fix:
- Fixed iPhone/PWA error: "Response served by service worker has redirections."
- The service worker no longer caches "./" or any redirected response.
- Navigation/app launch now safely loads index.html and falls back to a non-redirect cached index.html.
- Old app caches are deleted on activation, but diary data and localStorage are not cleared.
- Added helper: repairServiceWorkerRedirectIssue()
- If the broken old service worker prevents the app from opening, open the GitHub Pages link in Safari and use Force Reload App Files. If it still cannot open, clear website data for this domain once, then reopen.


Landscape compact mode:
- Added a display-only compact layout when the iPhone is rotated horizontally.
- Portrait mode is unchanged.
- Landscape mode reduces top header height, bottom nav height, labels and padding so more of the diary grid/stats table is visible.
- It does not change app width, zoom, grid calculations, fatigue rules, service worker no-redirect fix, BFM long/night, BFM 84h checkpoint, smart major rest, stats table data, update button, N/D, page numbering, diary history or settings.
- Added self-test helper: landscapeCompactSelfTest()


NHVR counted-period engine fix:
- Added focused counted-period patch for Standard solo, Standard two-up, BFM solo and BFM two-up.
- Work-limit breaches are no longer based on diary-date total.
- 24h / 7d / 14d work-limit checks now use active counted periods started from the relevant major rest break.
- Overlapping old/new 24h periods are checked together. A new major rest can start a new counted period, but the old period still restricts work until it finishes.
- Red block for work-limit breach is now the first 15-minute block where cumulative work exceeds the limit.
- BFM solo long/night now counts midnight-6am work plus work above 12h in an active counted 24h period, not just above 12h on the diary date.
- Removed the previous daily-sheet safety false positive for high daily totals when counted 24h periods are still legal.
- Keeps existing rest requirement checks, night rest checks, 84h checkpoint, smart major rest, stats table, service-worker fix, landscape mode, update button, graph, N/D, page numbering, diary history and settings.
- Added self-test helper: nhvrCountedPeriodEngineSelfTest()


Performance cache fix:
- Added caching for repeated fatigue calculations during app open/render/Stats.
- Cached activity lookups, work-between-window counts, rest-break anchors, counted-period anchors, long/night totals, breach results by date, breach slot sets and Stats 14-day rows.
- Cache is cleared automatically when diary data/settings are saved or blocks are changed.
- This is a speed-only patch and does not change the NHVR counted-period algorithm or any fatigue rule limits.
- Keeps counted-period engine, service-worker fix, landscape mode, smart major rest, Stats table, graph, N/D, page numbering, diary history, update button and settings.
- Added self-test helper: performanceCacheSelfTest()


Clean engine-test final update:
- Added Settings > Engine test system with Run Engine Test and Clear Test Report.
- Engine test runs scenario helpers without changing diary data and reports PASS/FAIL inside the app.
- Removed duplicate Stats > Driving limits card. The main "Can work" card and compact 14-day accumulated table remain.
- Removed duplicate Short break details settings UI.
- Short break detail handling is now automatic internally: smart mode ON, less than 7h threshold, matching Smart major rest classification.
- Kept NHVR counted-period engine, performance cache, service-worker no-redirect fix, landscape mode, smart major rest, stats table, graph, N/D, page numbering, diary history, update button and settings.
- Added self-test helper: cleanFinalAppSelfTest()


Rest-default + performance fix update (clean-engine-rest-default-perf-fix):
- Blank days / dates with no Work blocks are always counted as continuous Rest from the app/new diary setup.
- The old Calculation History choice for No work / Unknown previous history has been removed from Settings.
- The Work option / rule history screen no longer asks for a separate Rule effective from date; saving uses the selected page/date forward.
- Driving audit wording changed from Open error to Fix.
- No Work recorded reminders now show Fix and No Work. No Work confirms full rest, removes accidental page consumption, and hides the reminder.
- Stats 14-day accumulated table dark-mode readability fixed.
- Performance cache improved to reduce slow screen opening and repeated audit/stat calculations.
- NHVR counted-period calculation logic was not intentionally changed in this update.

DIARY NUMBER LETTERS FIX
- Fixed New work diary no setup field so it accepts letters/alphabets as well as numbers.
- Removed the incorrect page-number-only filter from the work diary number box.
- Added uppercase text handling to work diary number fields.
- Page number fields still remain numbers/spaces only.
- NHVR counted-period engine unchanged.


Fast due-break planner update (clean-engine-fast-due-break-planner):
- Schema 53. Performance-focused update; NHVR counted-period fatigue engine is not relaxed.
- Stats screen now opens with lazy/deferred rendering and a clearer Breaks due planner.
- Breaks due shows short-rest due times, 24h period work/rest status, BFM long/night remaining, 7d/14d windows and BFM 84h checkpoint.
- Page/date navigation no longer clears fatigue caches just for moving between days.
- Service worker cache v89 clears older app-file caches while preserving real diary data/settings in browser storage.


Build: clean-engine-archive-ready-fast-import / schema 58
Adds compact backup/storage format for fast import/export and long-term performance. NHVR fatigue calculation engine unchanged.
