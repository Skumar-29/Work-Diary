Truck Work Diary PWA - clean-engine-no-freeze-fast-backup

Schema: 60
Service worker cache: truck-work-diary-v96-no-freeze-fast-backup

This build is based on the smoother instant-grid version and fixes backup import freeze/slowness. It keeps final Work/Rest slots as the source of truth, removes old tap/swipe action history on import when final slots exist, stores future backups in compact slotsCompact format, and does not change the NHVR fatigue calculation engine.

Upload these files to the GitHub Pages root: index.html, app.js, styles.css, manifest.json, service-worker.js, icon-192.png, icon-512.png.
