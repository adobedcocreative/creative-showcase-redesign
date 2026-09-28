# Creative Showcase 2026

A gallery of ad screenshots in three sizes (300×250, 160×600, 728×90), with
search + sidebar filtering by **brand**, **campaign type**, **category**, and
**features**. The frontend itself is static HTML/CSS/JS — no build step, no
frontend dependencies — but the "Add Creative" feature talks to a small AWS
backend (API Gateway + Lambda + DynamoDB + S3) so ads can also be added
without editing code. See [Ad catalog: two sources](#ad-catalog-two-sources)
below.

## Run it
Open `index.html` directly in a browser (double-click), or serve the folder:
```
python3 -m http.server   # then visit http://localhost:8000
```
"Add Creative" / delete-ad buttons call a live API (`API_BASE` in
`js/add-ad.js`); they'll work from a local server the same as in production.

## Project layout
```
index.html              # markup: top bar, filter sidebar, grid, lightbox, footer
css/style.css           # all styling
js/app.js               # filtering, sorting, rendering, lightbox logic
js/data.js              # the hand-authored ad catalog (window.ADS = [...])
js/add-ad.js            # fetches API-backed ads, "Add Creative" modal, delete buttons
lambda/add-ad-api/       # backend for "Add Creative" — see its own README for
                         # routes, env vars, DynamoDB item shape, deployment notes
images/dynamic/<size>/  # ad screenshots, grouped by size folder
images/                 # logos + favicon
```

## Ad catalog: two sources
The gallery you see is the union of two independent sources, merged
client-side on every page load — neither generates the other:

- **`js/data.js`** — the hand-authored catalog, edited by hand and deployed as
  a static file. See "Adding / updating an ad" below.
- **DynamoDB (via the "Add Creative" button)** — ads added through the UI are
  written to a DynamoDB table and their images uploaded directly to S3 via the
  Lambda API in `lambda/add-ad-api/`. These ads also get a delete (×) button on
  hover, wired to the same API.

If the API is unreachable, `js/add-ad.js` logs the error to the console and
the page still renders normally with just the `data.js` ads.

## Adding / updating an ad by hand
For ads you want checked into the repo (as opposed to added via the UI):

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
- **Image size warning:** the "Add Creative" form flags (non-blocking) when an
  uploaded image's pixel dimensions don't match its slot (e.g. a 300×250 slot
  fed a 250×300 image).
- **Deploying `js/data.js` / the static site to S3 does not touch DynamoDB.**
  They're separate stores merged at runtime — redeploying the static site
  changes only the hand-authored half of the catalog.
