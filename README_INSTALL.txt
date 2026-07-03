Truck Work Diary PWA - clean-engine-window-end-theme-refresh

Upload these files to the GitHub Pages app folder/root:
- index.html
- styles.css
- app.js
- manifest.json
- service-worker.js
- icon-192.png
- icon-512.png

Build: clean-engine-window-end-theme-refresh
Schema: 62
Cache: truck-work-diary-v98-window-end-theme-refresh

Main changes:
- Adds a compact 24h counted-window helper row under Total Work / Total Rest.
- Shows 24h window start/end, worked time in that counted window, and remaining/balance work time.
- Adds Settings > App appearance with Default / Light / Dark options.
- Keeps NHVR counted-period calculation engine unchanged.
- Keeps no-freeze fast backup/import base.

After upload, open the app and use Settings > App updates > Clean App Cache Safely if the old version remains cached.

Additional v62 changes:
- 24h helper row prefers the window that ends on the selected diary date, so 1 Jul shows 30 Jun -> 1 Jul.
- Stats break-due boxes use light readable backgrounds even when iPhone dark mode is on.
- Graph page auto-refreshes on previous/next/date changes without needing the Refresh button.
- Date navigation uses lighter refresh paths for faster app response.
