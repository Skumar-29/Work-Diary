# Verification — 2.0.0-beta.1

## Observed checks

- TypeScript strict build and Vite production build pass.
- 31 domain/storage tests pass: atomic commits and stale-tab rejection, recovery checkpoint, backup checksums/encryption, compact and full record semantics, exact timer persistence, rounding, midnight/DST handling, page lookup/cancellation, invoice arithmetic and overflow pagination, form all-clear semantics and signature ownership, unknown-history handling, major/night-rest anchors and overlapping 24-hour periods.
- 16 end-to-end Chromium journeys pass across phone (440 × 956) and desktop (1280 × 900) contexts. Tests also exercise 320-pixel layout, drag selection/Undo, full stationary rest, offline reload and lazy screens, a repository subpath, legacy import, page 87 → 56, diary-to-invoice route/odometer entry, PDF downloads, real XLSX output, signature drawing/reuse, fresh next-trip answers, table notes, encrypted-note recovery and active timers after reload.
- A simulated storage-full exception is shown to the driver; reloading retains the prior committed record.
- Exported invoice and safe-driving PDFs were rendered and visually inspected. Diary labels were corrected to avoid book/page and location collisions. Long contents continue on added pages rather than disappearing.
- Exported `.xlsx` files reopen with openpyxl and retain the expected 940.50 test invoice total.
- No real customer records are included. Test names, vehicles, codes and signatures are synthetic.

## Open release gates

This is a tested beta, not a claim of universal reliability or NHVR approval.

1. Physical iPhone 16 Pro Max Safari and installed-PWA use: keyboard, finger gestures, screen lock/return, file import/download, camera upload and application update.
2. Physical Android browser/PWA and native email, Messages and WhatsApp PDF hand-off. Local tests verify PDF generation/download; they do not send messages.
3. Real GPS and live reverse-geocoder behavior, including permission refusal and weak reception. Manual location entry is the fallback.
4. Acceptance against the driver’s own representative backups and company-required documents. Synthetic fixtures cannot establish the correctness of every historical backup variation or company acceptance.
5. Independent review of jurisdiction/certificate conditions, rare fatigue/rest combinations and daylight-saving elapsed-time records before relying on planning advice. AFM/ACH are deliberately record-only; historical or incomplete cases remain flagged.

The source and preview can be reviewed now. Production replacement should follow these acceptance checks. The GitHub deployment workflow is manual.
