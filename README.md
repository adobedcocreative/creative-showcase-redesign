# Creative Showcase 2026

A static gallery of ad screenshots in three sizes (300×250, 160×600, 728×90),
with search + sidebar filtering by **brand**, **campaign type**, **category**,
and **features**. Pure HTML/CSS/JS — no build step, no dependencies, no server.

## Run it
Open `index.html` directly in a browser (double-click), or serve the folder:
```
python3 -m http.server   # then visit http://localhost:8000
```

## Project layout
```
index.html              # markup: top bar, filter sidebar, grid, lightbox, footer
css/style.css           # all styling
js/app.js               # filtering, sorting, rendering, lightbox logic
js/data.js              # the ad catalog (window.ADS = [...]) — edit by hand
images/dynamic/<size>/  # ad screenshots, grouped by size folder
images/                 # logos + favicon
```

## Adding / updating an ad
Everything lives in `js/data.js` — there is no build step.

1. **Add the screenshots** to the size folders, e.g.
   `images/dynamic/300x250/acme_promo_300x250.png` (and/or the 160x600 / 728x90
   versions). You only need the sizes you have.
2. **Add an entry** to the `window.ADS` array in `js/data.js`. A header comment
   at the top of the file shows the template; minimum fields:
   ```js
   {
     "id": "acme_promo",
     "title": "Acme Promo",
     "brand": "Acme Corp",
     "category": "Retail",
     "campaignTypes": ["Site Retargeting"],
     "features": ["Single Product"],
     "date": "2026-06-03",            // YYYY-MM-DD, or null
     "sizes": {
       "300x250": "images/dynamic/300x250/acme_promo_300x250.png",
       "728x90":  "images/dynamic/728x90/acme_promo_728x90.png"
     }
   }
   ```
   `sizeList` and `dateKey` are derived automatically in `app.js`, so you can
   omit them.
3. **Refresh** the page.

## Notes
- **Filter options are data-driven:** the sidebar lists whatever `brand`,
  `category`, `campaignTypes`, and `features` values appear across all ads, with
  counts — so a new value just shows up as a filter.
- **"Newly Added" badge** is shown on the 10 most recent ads by date, always.
  Ads with `date: null` are never badged.
- **Card thumbnail** uses the 300×250 image, falling back to 728×90 then 160×600.
