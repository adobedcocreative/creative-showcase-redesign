/* add-ad.js — "Add New Ad" form for Creative Showcase 2026.
 * Runs before app.js so localStorage-backed ads are in window.ADS
 * when app.js processes the catalog. */
(function () {
  'use strict';

  var KEY = 'creative_showcase_local_ads';
  var SIZES = ['300x250', '160x600', '728x90'];
  var CAMPAIGN_OPTS = ['Creative Optimization', 'Site Retargeting', 'Geo Targeting', 'Custom Targeting'];
  var FEATURE_OPTS  = ['Single Product', 'Multi Product', 'Count Down', 'Search', 'Click to Call', 'Calendar'];

  // ── 1. Merge persisted local ads into window.ADS before app.js runs ─────────
  try {
    var _saved = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (_saved.length) window.ADS = (window.ADS || []).concat(_saved);
  } catch (_) {}

  // ── 2. Helpers ──────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'ad';
  }

  function getBrandMap() {
    var m = new Map();
    (window.ADS || []).forEach(function (ad) {
      if (!m.has(ad.brand)) m.set(ad.brand, []);
      m.get(ad.brand).push(ad);
    });
    return m;
  }

  function getCategories() {
    var seen = new Set();
    var cats = [];
    (window.ADS || []).forEach(function (ad) {
      if (ad.category && !seen.has(ad.category)) { seen.add(ad.category); cats.push(ad.category); }
    });
    return cats.sort();
  }

  // ── 3. Build modal HTML ─────────────────────────────────────────────────────
  function buildModal() {
    var cats = getCategories();

    var slotsHtml = SIZES.map(function (s) {
      var k = s.replace('x', '-');
      return (
        '<div class="af-slot" id="af-slot-' + k + '">' +
          '<p class="af-slot-sz">' + s + '</p>' +
          '<label class="af-drop" for="af-file-' + k + '">' +
            '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<polyline points="16 16 12 12 8 16"/>' +
              '<line x1="12" y1="12" x2="12" y2="21"/>' +
              '<path d="M20.39 18.39A5 5 0 0018 9h-1.26A8 8 0 103 16.3"/>' +
            '</svg>' +
            '<span>Upload</span>' +
          '</label>' +
          '<input type="file" id="af-file-' + k + '" class="af-file" accept="image/*" data-size="' + s + '">' +
          '<div class="af-thumb" id="af-thumb-' + k + '" hidden>' +
            '<img src="" alt="' + s + ' preview">' +
            '<button type="button" class="af-del" data-size="' + s + '" aria-label="Remove image">&times;</button>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var el = document.createElement('div');
    el.id = 'adform-modal';
    el.className = 'adform-overlay';
    el.hidden = true;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-labelledby', 'adform-heading');

    el.innerHTML =
      '<div class="adform-bg" data-ac></div>' +
      '<div class="adform-panel">' +
        '<div class="adform-hdr">' +
          '<h2 id="adform-heading">Add Creative</h2>' +
          '<button type="button" class="adform-x" data-ac aria-label="Close">&times;</button>' +
        '</div>' +
        '<form id="adform" novalidate autocomplete="off">' +
          '<div class="adform-body">' +

            // Brand
            '<div class="af-field">' +
              '<label for="af-brand">Brand <span class="af-req" aria-hidden="true">*</span></label>' +
              '<select id="af-brand">' +
                '<option value="">— Select or add brand —</option>' +
                '<option value="__new__">＋ New brand…</option>' +
              '</select>' +
            '</div>' +
            '<div class="af-field af-slide" id="af-new-brand" hidden>' +
              '<label for="af-brand-txt">New Brand Name <span class="af-req" aria-hidden="true">*</span></label>' +
              '<input id="af-brand-txt" type="text" placeholder="e.g. Acme Corp">' +
            '</div>' +

            // Title
            '<div class="af-field">' +
              '<label for="af-title">Ad Title <span class="af-req" aria-hidden="true">*</span></label>' +
              '<input id="af-title" type="text" placeholder="e.g. Summer Promo 2026">' +
            '</div>' +

            // Category (only shown when adding a new brand)
            '<div id="af-cat-section" hidden>' +
              '<div class="af-field">' +
                '<label for="af-cat">Category <span class="af-req" aria-hidden="true">*</span></label>' +
                '<select id="af-cat">' +
                  '<option value="">— Select or add category —</option>' +
                  cats.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('') +
                  '<option value="__new__">＋ New category…</option>' +
                '</select>' +
              '</div>' +
              '<div class="af-field af-slide" id="af-new-cat" hidden>' +
                '<label for="af-cat-txt">New Category <span class="af-req" aria-hidden="true">*</span></label>' +
                '<input id="af-cat-txt" type="text" placeholder="e.g. Finance">' +
              '</div>' +
            '</div>' +

            // Campaign types
            '<div class="af-field">' +
              '<label>Campaign Types <span class="af-req" aria-hidden="true">*</span></label>' +
              '<div class="af-checks">' +
                CAMPAIGN_OPTS.map(function (v) {
                  return '<label class="af-chk"><input type="checkbox" name="campaignTypes" value="' + esc(v) + '"><span>' + esc(v) + '</span></label>';
                }).join('') +
              '</div>' +
            '</div>' +

            // Features
            '<div class="af-field">' +
              '<label>Features <span class="af-req" aria-hidden="true">*</span></label>' +
              '<div class="af-checks">' +
                FEATURE_OPTS.map(function (v) {
                  return '<label class="af-chk"><input type="checkbox" name="features" value="' + esc(v) + '"><span>' + esc(v) + '</span></label>';
                }).join('') +
              '</div>' +
            '</div>' +

            // Image slots
            '<div class="af-field">' +
              '<label>Ad Images <span class="af-req" aria-hidden="true">*</span>' +
                '<em class="af-hint"> — upload at least one size</em>' +
              '</label>' +
              '<div class="af-slots">' + slotsHtml + '</div>' +
            '</div>' +

          '</div>' + // /adform-body

          '<div class="adform-ftr">' +
            '<span id="adform-err" class="adform-err" hidden></span>' +
            '<div id="adform-dup-warn" class="adform-dup-warn" hidden>' +
              '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' +
              '<span>Please make sure this ad is not a duplicate before saving.</span>' +
              '<button type="button" class="adform-dup-close" id="adform-dup-cancel" aria-label="Dismiss">&times;</button>' +
            '</div>' +
            '<div class="adform-ftr-btns">' +
              '<button type="button" class="af-btn af-btn--ghost" data-ac>Cancel</button>' +
              '<button type="submit" class="af-btn af-btn--primary" id="adform-submit">Save Ad</button>' +
            '</div>' +
          '</div>' +
        '</form>' +
      '</div>';

    document.body.appendChild(el);
    return el;
  }

  // ── 4. Image state & handlers ───────────────────────────────────────────────
  var imgData = {};

  function loadImage(inp) {
    var size = inp.dataset.size;
    var file = inp.files[0];
    if (!file) return;
    var r = new FileReader();
    r.onload = function (ev) {
      imgData[size] = ev.target.result;
      var k = size.replace('x', '-');
      var thumb = document.getElementById('af-thumb-' + k);
      thumb.querySelector('img').src = ev.target.result;
      thumb.hidden = false;
      document.getElementById('af-slot-' + k).classList.add('af-slot--ok');
    };
    r.readAsDataURL(file);
  }

  function removeImage(size) {
    delete imgData[size];
    var k = size.replace('x', '-');
    var thumb = document.getElementById('af-thumb-' + k);
    thumb.hidden = true;
    thumb.querySelector('img').src = '';
    document.getElementById('af-file-' + k).value = '';
    document.getElementById('af-slot-' + k).classList.remove('af-slot--ok');
  }

  // ── 5. Auto-fill from existing brand ───────────────────────────────────────
  function autoFill(ads) {
    var ref = ads.slice().sort(function (a, b) { return (b.dateKey || 0) - (a.dateKey || 0); })[0];
    if (!ref) return;

    var catSel = document.getElementById('af-cat');
    var catOpts = Array.prototype.slice.call(catSel.options);
    if (ref.category && catOpts.some(function (o) { return o.value === ref.category; })) {
      catSel.value = ref.category;
      document.getElementById('af-new-cat').hidden = true;
    }

    document.querySelectorAll('input[name="campaignTypes"]').forEach(function (cb) {
      cb.checked = (ref.campaignTypes || []).indexOf(cb.value) !== -1;
    });
    document.querySelectorAll('input[name="features"]').forEach(function (cb) {
      cb.checked = (ref.features || []).indexOf(cb.value) !== -1;
    });
  }

  function clearChecks() {
    document.querySelectorAll('input[name="campaignTypes"], input[name="features"]').forEach(function (cb) {
      cb.checked = false;
    });
    document.getElementById('af-cat').value = '';
    document.getElementById('af-new-cat').hidden = true;
  }

  // ── 6. Validation & save ───────────────────────────────────────────────────
  function showErr(msg) {
    var el = document.getElementById('adform-err');
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  var pendingSave = false;

  function showDuplicateWarning() {
    var warn = document.getElementById('adform-dup-warn');
    warn.hidden = false;
    warn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function hideDuplicateWarning() {
    document.getElementById('adform-dup-warn').hidden = true;
    pendingSave = false;
  }

  function save() {
    document.getElementById('adform-err').hidden = true;

    if (!pendingSave) {
      pendingSave = true;
      showDuplicateWarning();
      return;
    }
    hideDuplicateWarning();

    var bSel   = document.getElementById('af-brand');
    var brand  = bSel.value === '__new__'
      ? document.getElementById('af-brand-txt').value.trim()
      : bSel.value;

    var title   = document.getElementById('af-title').value.trim();
    var cSel    = document.getElementById('af-cat');
    var category = cSel.value === '__new__'
      ? document.getElementById('af-cat-txt').value.trim()
      : cSel.value;

    var campaignTypes = Array.prototype.slice
      .call(document.querySelectorAll('input[name="campaignTypes"]:checked'))
      .map(function (c) { return c.value; });
    var features = Array.prototype.slice
      .call(document.querySelectorAll('input[name="features"]:checked'))
      .map(function (c) { return c.value; });

    if (!brand)    { showErr('Brand is required.');    return; }
    if (!title)    { showErr('Ad title is required.'); return; }
    if (!category) { showErr('Category is required.'); return; }
    if (!campaignTypes.length) { showErr('Select at least one Campaign Type.'); return; }
    if (!features.length)      { showErr('Select at least one Feature.'); return; }
    if (!Object.keys(imgData).length) { showErr('Upload at least one ad image.'); return; }

    // Unique ID
    var used = new Set((window.ADS || []).map(function (a) { return a.id; }));
    var base = slug(brand + '_' + title);
    var uid  = base;
    var sfx  = 2;
    while (used.has(uid)) { uid = base + '_' + sfx; sfx++; }

    var sizes = {};
    Object.keys(imgData).forEach(function (k) { sizes[k] = imgData[k]; });

    var ad = {
      id: uid,
      title: title,
      brand: brand,
      category: category,
      campaignTypes: campaignTypes,
      features: features,
      date: new Date().toISOString().slice(0, 10),
      sizes: sizes,
    };

    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list.push(ad);
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
      if (err.name === 'QuotaExceededError') {
        showErr('Browser storage is full. Use smaller images (< 500 KB each) or remove previous local ads.');
        return;
      }
      throw err;
    }

    window.location.reload();
  }

  // ── 7. Delete a local ad ───────────────────────────────────────────────────
  function deleteLocalAd(id) {
    try {
      var list = JSON.parse(localStorage.getItem(KEY) || '[]');
      list = list.filter(function (a) { return a.id !== id; });
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (_) {}
    window.location.reload();
  }

  function addDeleteButtons() {
    try {
      var localIds = new Set(
        JSON.parse(localStorage.getItem(KEY) || '[]').map(function (a) { return a.id; })
      );
      localIds.forEach(function (id) {
        var card = document.querySelector('[data-ad-id="' + id + '"]');
        if (!card) return;
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'card__delete';
        btn.setAttribute('aria-label', 'Delete this ad');
        btn.textContent = '×';
        btn.addEventListener('click', function (e) {
          e.stopPropagation();
          if (confirm('Delete this locally saved ad?')) deleteLocalAd(id);
        });
        card.querySelector('.card__preview').appendChild(btn);
      });
    } catch (_) {}
  }

  // ── 8. Open / close modal ──────────────────────────────────────────────────
  function openModal() {
    document.getElementById('adform-modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    var m = document.getElementById('adform-modal');
    if (!m) return;
    m.hidden = true;
    document.body.style.overflow = '';
    document.getElementById('adform').reset();
    document.getElementById('af-new-brand').hidden   = true;
    document.getElementById('af-cat-section').hidden = true;
    document.getElementById('af-new-cat').hidden     = true;
    document.getElementById('adform-err').hidden      = true;
    document.getElementById('adform-dup-warn').hidden = true;
    pendingSave = false;
    SIZES.forEach(function (s) {
      var k = s.replace('x', '-');
      var t = document.getElementById('af-thumb-' + k);
      if (t) { t.hidden = true; t.querySelector('img').src = ''; }
      var slot = document.getElementById('af-slot-' + k);
      if (slot) slot.classList.remove('af-slot--ok');
    });
    imgData = {};
  }

  // ── 9. Wire events ─────────────────────────────────────────────────────────
  function wireModal() {
    var modal = document.getElementById('adform-modal');
    var bSel  = document.getElementById('af-brand');
    var bm    = getBrandMap();

    // Populate brands
    var newOpt = bSel.querySelector('[value="__new__"]');
    var brands = Array.from(bm.keys()).sort(function (a, b) { return a.localeCompare(b); });
    brands.forEach(function (name) {
      var opt = new Option(name, name);
      bSel.insertBefore(opt, newOpt);
    });

    // Brand select change
    bSel.addEventListener('change', function () {
      var v = bSel.value;
      var isNew = v === '__new__';
      document.getElementById('af-new-brand').hidden   = !isNew;
      document.getElementById('af-cat-section').hidden = !isNew;
      if (v && !isNew) {
        autoFill(bm.get(v) || []);
      } else if (!v) {
        clearChecks();
      } else {
        document.getElementById('af-cat').value = '';
        document.getElementById('af-new-cat').hidden = true;
      }
    });

    // Category select change
    document.getElementById('af-cat').addEventListener('change', function (e) {
      document.getElementById('af-new-cat').hidden = e.target.value !== '__new__';
    });

    // File upload
    modal.querySelectorAll('.af-file').forEach(function (inp) {
      inp.addEventListener('change', function () { loadImage(inp); });
    });

    // Delegated clicks (remove image + close)
    modal.addEventListener('click', function (e) {
      var del = e.target.closest('.af-del');
      if (del) { removeImage(del.dataset.size); return; }
      if (e.target.closest('[data-ac]')) closeModal();
    });

    // Duplicate warning dismiss
    document.getElementById('adform-dup-cancel').addEventListener('click', hideDuplicateWarning);

    // Form submit
    document.getElementById('adform').addEventListener('submit', function (e) {
      e.preventDefault();
      save();
    });

    // Esc to close
    document.addEventListener('keydown', function (e) {
      if (!document.getElementById('adform-modal').hidden && e.key === 'Escape') closeModal();
    });
  }

  // ── 10. Inject button + init ───────────────────────────────────────────────
  function init() {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.id   = 'add-ad-btn';
    btn.className = 'add-ad-btn';
    btn.innerHTML =
      '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
        'stroke-width="3" stroke-linecap="round" aria-hidden="true">' +
        '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>' +
      '</svg>Add Creative';
    btn.addEventListener('click', openModal);

    var topbar = document.querySelector('.topbar');
    if (topbar) {
      var searchDiv = topbar.querySelector('.search');
      if (searchDiv) topbar.insertBefore(btn, searchDiv);
      else topbar.appendChild(btn);
    }

    buildModal();
    wireModal();
    addDeleteButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
