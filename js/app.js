/* Creative Showcase 2026 — filtering + rendering.
 * Reads window.ADS from js/data.js (hand-maintained ad catalog). */
(function () {
  'use strict';

  const ADS = (window.ADS || []).slice();
  const SIZE_ORDER = ['300x250', '160x600', '728x90'];

  // Derive the convenience fields so hand-written entries can omit them:
  //   sizeList — available sizes in canonical order, from the `sizes` keys
  //   dateKey  — sortable number from the "YYYY-MM-DD" date (0 if no date)
  for (const a of ADS) {
    a.campaignTypes = a.campaignTypes || [];
    a.features = a.features || [];
    if (!a.sizeList) a.sizeList = SIZE_ORDER.filter((s) => a.sizes && a.sizes[s]);
    if (a.dateKey == null) {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(a.date || '');
      a.dateKey = m ? Number(m[1] + m[2] + m[3]) * 100 : 0;
    }
  }

  // Flag the most recent ads as "Newly Added": within 90 days of the latest ad
  // date in the dataset (relative, so it stays meaningful as data is refreshed).
  (function markNew() {
    const top10 = new Set(
      ADS.filter((a) => a.dateKey > 0)
        .sort((a, b) => b.dateKey - a.dateKey)
        .slice(0, 10)
        .map((a) => a.id)
    );
    for (const a of ADS) a.isNew = top10.has(a.id);
  })();

  // Active filter state. Sizes/categories/brands are sets of selected values.
  const state = {
    q: '',
    sort: 'newest',
    categories: new Set(),
    campaignTypes: new Set(),
    features: new Set(),
    brands: new Set(),
    brandQuery: '',
  };

  const el = {
    search: document.getElementById('search'),
    count: document.getElementById('count'),
    clear: document.getElementById('clear'),
    facetCategory: document.getElementById('facet-category'),
    facetCampaign: document.getElementById('facet-campaign'),
    facetFeature: document.getElementById('facet-feature'),
    facetBrand: document.getElementById('facet-brand'),
    brandSearch: document.getElementById('brand-search'),
    brand: document.getElementById('brand'),
    sort: document.getElementById('sort'),
    grid: document.getElementById('grid'),
    empty: document.getElementById('empty'),
    lightbox: document.getElementById('lightbox'),
    lbTitle: document.getElementById('lb-title'),
    lbBrand: document.getElementById('lb-brand'),
    lbCategory: document.getElementById('lb-category'),
    lbCampaign: document.getElementById('lb-campaign'),
    lbFeatures: document.getElementById('lb-features'),
    lbStage: document.getElementById('lb-stage'),
    lbSizeLabel: document.getElementById('lb-size-label'),
    lbDots: document.getElementById('lb-dots'),
    lbPrev: document.getElementById('lb-prev'),
    lbNext: document.getElementById('lb-next'),
  };

  // --- Build facet value lists with counts ---
  function countBy(getValues) {
    const map = new Map();
    for (const ad of ADS) {
      for (const v of getValues(ad)) map.set(v, (map.get(v) || 0) + 1);
    }
    return map;
  }

  const categoryCounts = countBy((ad) => [ad.category]);
  const campaignCounts = countBy((ad) => ad.campaignTypes);
  const featureCounts = countBy((ad) => ad.features);
  const brandCounts = countBy((ad) => [ad.brand]);

  // Show campaign-type and feature options in a stable, meaningful order
  // (matching the generator's rule order) rather than alphabetical.
  const CAMPAIGN_ORDER = ['Creative Optimization', 'Site Retargeting', 'Geo Targeting', 'Custom Targeting'];
  const FEATURE_ORDER = ['Single Product', 'Multi Product', 'Count Down', 'Search', 'Click to Call', 'Calendar'];

  // --- Matching ---
  function matches(ad) {
    if (state.categories.size && !state.categories.has(ad.category)) return false;
    if (state.campaignTypes.size && !ad.campaignTypes.some((c) => state.campaignTypes.has(c))) return false;
    if (state.features.size && !ad.features.some((f) => state.features.has(f))) return false;
    if (state.brands.size && !state.brands.has(ad.brand)) return false;
    if (state.q) {
      const hay = (ad.title + ' ' + ad.brand + ' ' + ad.category).toLowerCase();
      if (!state.q.split(/\s+/).every((t) => hay.includes(t))) return false;
    }
    return true;
  }

  // Thumbnail preference: 300x250, then fall back to 728x90, then 160x600.
  const THUMB_ORDER = ['300x250', '728x90', '160x600'];
  function previewSize(ad) {
    return THUMB_ORDER.find((s) => ad.sizes[s]) || ad.sizeList[0];
  }

  // Undated ads (dateKey 0) always sort last for date-based orders.
  const byBrand = (a, b) => a.brand.localeCompare(b.brand) || a.title.localeCompare(b.title);
  const SORTS = {
    brand: byBrand,
    newest: (a, b) => (b.dateKey - a.dateKey) || byBrand(a, b),
    oldest: (a, b) => ((a.dateKey || Infinity) - (b.dateKey || Infinity)) || byBrand(a, b),
  };

  // --- Render results ---
  function render() {
    const visible = ADS.filter(matches).sort(SORTS[state.sort] || byBrand);
    el.count.textContent = '(' + visible.length + ' of ' + ADS.length + ')';
    el.grid.innerHTML = '';
    el.empty.hidden = visible.length !== 0;

    const frag = document.createDocumentFragment();
    for (const ad of visible) {
      const size = previewSize(ad);
      const card = document.createElement('article');
      card.className = 'card';
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.dataset.adId = ad.id;

      const campaignTags = ad.campaignTypes
        .map((c) => '<span class="tag tag--campaign">' + escapeHtml(c) + '</span>')
        .join('');

      const badge = ad.isNew ? '<span class="card__badge">Newly Added</span>' : '';
      card.innerHTML =
        '<div class="card__preview">' + badge + '<img loading="lazy" src="' + ad.sizes[size] +
        '" alt="' + escapeAttr(ad.title) + ' (' + size + ')"></div>' +
        '<div class="card__body">' +
        '<h3 class="card__title">' + escapeHtml(ad.title) + '</h3>' +
        '<div class="card__brand">' + escapeHtml(ad.brand) + '</div>' +
        '<div class="card__tags"><span class="tag tag--cat">' + escapeHtml(ad.category) + '</span>' +
        campaignTags + '</div>' +
        '</div>';

      card.addEventListener('click', () => openLightbox(ad));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(ad); }
      });
      frag.appendChild(card);
    }
    el.grid.appendChild(frag);
  }

  // --- Facet checkbox rendering ---
  function renderFacet(container, counts, selectedSet, order) {
    const entries = order
      ? order.filter((v) => counts.has(v)).map((v) => [v, counts.get(v)])
      : [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    container.innerHTML = '';
    if (!entries.length) {
      container.innerHTML = '<div class="opt opt--empty">No matches</div>';
      return;
    }
    for (const [value, n] of entries) {
      const label = document.createElement('label');
      label.className = 'opt';
      label.innerHTML =
        '<input type="checkbox"' + (selectedSet.has(value) ? ' checked' : '') + '>' +
        '<span class="opt__label">' + escapeHtml(value) + '</span>' +
        '<span class="opt__n">' + n + '</span>';
      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) selectedSet.add(value);
        else selectedSet.delete(value);
        render();
      });
      container.appendChild(label);
    }
  }

  function renderBrandFacet() {
    let counts = brandCounts;
    if (state.brandQuery) {
      counts = new Map(
        [...brandCounts].filter(([b]) => b.toLowerCase().includes(state.brandQuery))
      );
    }
    renderFacet(el.facetBrand, counts, state.brands);
  }

  // --- Lightbox (size carousel) ---
  let lbAd = null;
  let lbIndex = 0;

  function renderSlide() {
    const s = lbAd.sizeList[lbIndex];
    const [w, h] = s.split('x');
    // Wide leaderboard (728x90) and tall skyscraper (160x600) are capped so
    // they don't dominate the panel.
    let frameCls = 'lb-size__frame';
    if (Number(w) > 360) frameCls += ' lb-size__frame--wide';
    if (Number(h) > 360) frameCls += ' lb-size__frame--tall';
    el.lbStage.innerHTML =
      '<div class="' + frameCls + '"><img src="' + lbAd.sizes[s] +
      '" width="' + w + '" height="' + h + '"' +
      ' alt="' + escapeAttr(lbAd.title) + ' (' + s + ')"></div>';
    el.lbSizeLabel.textContent = s;

    // Dots reflect position; arrows wrap around so there's no dead end.
    el.lbDots.innerHTML = lbAd.sizeList
      .map((sz, i) =>
        '<button class="lb-dot' + (i === lbIndex ? ' is-active' : '') +
        '" data-i="' + i + '" aria-label="Show ' + sz + '">' + sz + '</button>')
      .join('');

    const single = lbAd.sizeList.length <= 1;
    el.lbPrev.hidden = single;
    el.lbNext.hidden = single;
    el.lbDots.hidden = single;
  }

  function step(delta) {
    const n = lbAd.sizeList.length;
    lbIndex = (lbIndex + delta + n) % n;
    renderSlide();
  }

  function openLightbox(ad) {
    lbAd = ad;
    lbIndex = 0;
    el.lbTitle.textContent = ad.title;
    el.lbBrand.textContent = ad.brand;
    el.lbCategory.textContent = ad.category;
    el.lbCampaign.textContent = ad.campaignTypes.length ? ad.campaignTypes.join(', ') : '—';
    el.lbFeatures.textContent = ad.features.length ? ad.features.join(', ') : '—';
    renderSlide();
    el.lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
  }
  function closeLightbox() {
    el.lightbox.hidden = true;
    document.body.style.overflow = '';
    lbAd = null;
  }

  el.lbPrev.addEventListener('click', () => step(-1));
  el.lbNext.addEventListener('click', () => step(1));
  el.lbDots.addEventListener('click', (e) => {
    const btn = e.target.closest('.lb-dot');
    if (btn) { lbIndex = Number(btn.dataset.i); renderSlide(); }
  });

  // --- Helpers ---
  function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, '&quot;');
  }
  const debounce = (fn, ms) => {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
  };

  // --- Wire up events ---
  el.search.addEventListener('input', debounce((e) => {
    state.q = e.target.value.trim().toLowerCase();
    render();
  }, 120));

  el.sort.addEventListener('change', (e) => {
    state.sort = e.target.value;
    render();
  });

  el.brandSearch.addEventListener('input', debounce((e) => {
    state.brandQuery = e.target.value.trim().toLowerCase();
    renderBrandFacet();
  }, 120));

  el.clear.addEventListener('click', () => {
    state.q = '';
    state.brandQuery = '';
    state.categories.clear();
    state.campaignTypes.clear();
    state.features.clear();
    state.brands.clear();
    el.search.value = '';
    el.brandSearch.value = '';
    paintFacets();
    render();
  });

  function refreshContent() {
    window.location.reload();
  }
  el.brand.addEventListener('click', refreshContent);
  el.brand.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); refreshContent(); }
  });

  el.lightbox.addEventListener('click', (e) => {
    if (e.target.hasAttribute('data-close')) closeLightbox();
  });
  document.addEventListener('keydown', (e) => {
    if (el.lightbox.hidden) return;
    if (e.key === 'Escape') closeLightbox();
    else if (e.key === 'ArrowLeft' && lbAd) step(-1);
    else if (e.key === 'ArrowRight' && lbAd) step(1);
  });

  // --- Initial paint ---
  function paintFacets() {
    renderFacet(el.facetCategory, categoryCounts, state.categories);
    renderFacet(el.facetCampaign, campaignCounts, state.campaignTypes, CAMPAIGN_ORDER);
    renderFacet(el.facetFeature, featureCounts, state.features, FEATURE_ORDER);
    renderBrandFacet();
  }
  paintFacets();
  render();
})();
