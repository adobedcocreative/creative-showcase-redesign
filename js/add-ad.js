/* add-ad.js — "Add New Ad" form for Creative Showcase 2026.
 * Fetches API-backed ads and merges them into window.ADS, then loads
 * app.js dynamically so it only ever processes a complete catalog. */
(function () {
  'use strict';

  // Base invoke URL (through the stage), no trailing slash — the code appends
  // '/ads', '/ads/presign', etc. See lambda/add-ad-api/README.md.
  var API_BASE = 'https://3c1u4r7o36.execute-api.us-east-1.amazonaws.com/live';

  var SIZES = ['300x250', '160x600', '728x90'];
  var CAMPAIGN_OPTS = ['Creative Optimization', 'Site Retargeting', 'Geo Targeting', 'Custom Targeting'];
  var FEATURE_OPTS  = ['Single Product', 'Multi Product', 'Count Down', 'Search', 'Click to Call', 'Calendar', 'Mockup'];

  // Ids of ads that came from the API (as opposed to the hand-authored
  // catalog in data.js) — used to decide which cards get a delete button.
  var apiAdIds = new Set();

  // ── 1. Fetch API-backed ads and merge into window.ADS before app.js runs ────
  function loadRemoteAds() {
    var controller = new AbortController();
    var timeout = setTimeout(function () { controller.abort(); }, 5000);
    return fetch(API_BASE + '/ads', { signal: controller.signal })
      .then(function (r) {
        if (!r.ok) throw new Error('Failed to load ads (' + r.status + ')');
        return r.json();
      })
      .then(function (remoteAds) {
        if (remoteAds && remoteAds.length) {
          remoteAds.forEach(function (a) { apiAdIds.add(a.id); });
          window.ADS = (window.ADS || []).concat(remoteAds);
        }
      })
      .catch(function (err) { console.error('Could not load ads from API:', err); })
      .then(function () { clearTimeout(timeout); });
  }

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
          '<input type="file" id="af-file-' + k + '" class="af-file" data-size="' + s + '">' +
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

            // Brand — custom searchable dropdown
            '<div class="af-field">' +
              '<label id="af-brand-lbl">Brand</label>' +
              '<div class="af-bdd" id="af-bdd">' +
                '<button type="button" class="af-bdd-trigger" id="af-bdd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="af-brand-lbl">' +
                  '<span class="af-bdd-val" id="af-bdd-val">— Select or add brand —</span>' +
                  '<svg class="af-bdd-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
                '</button>' +
                '<div class="af-bdd-panel" id="af-bdd-panel" hidden>' +
                  '<div class="af-bdd-search-wrap">' +
                    '<input type="text" class="af-bdd-search" id="af-bdd-search" placeholder="Search brands…" autocomplete="off" aria-label="Search brands">' +
                  '</div>' +
                  '<ul class="af-bdd-list" id="af-bdd-list" role="listbox" aria-labelledby="af-brand-lbl"></ul>' +
                  '<div class="af-bdd-footer">' +
                    '<button type="button" class="af-bdd-create" id="af-bdd-create">＋ Create New Brand</button>' +
                  '</div>' +
                '</div>' +
              '</div>' +
              '<input type="hidden" id="af-brand">' +
            '</div>' +
            '<div class="af-field af-slide" id="af-new-brand" hidden>' +
              '<label for="af-brand-txt">New Brand Name</label>' +
              '<input id="af-brand-txt" type="text" placeholder="e.g. Acme Corp">' +
            '</div>' +

            // Title
            '<div class="af-field">' +
              '<label for="af-title">Ad Title</label>' +
              '<input id="af-title" type="text" placeholder="e.g. Summer Promo 2026">' +
            '</div>' +

            // Category (only shown when adding a new brand)
            '<div id="af-cat-section" hidden>' +
              '<div class="af-field">' +
                '<label id="af-cat-lbl">Category</label>' +
                '<div class="af-bdd" id="af-cdd">' +
                  '<button type="button" class="af-bdd-trigger" id="af-cdd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-labelledby="af-cat-lbl">' +
                    '<span class="af-bdd-val" id="af-cdd-val">— Select or add category —</span>' +
                    '<svg class="af-bdd-chev" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>' +
                  '</button>' +
                  '<div class="af-bdd-panel" id="af-cdd-panel" hidden>' +
                    '<div class="af-bdd-search-wrap">' +
                      '<input type="text" class="af-bdd-search" id="af-cdd-search" placeholder="Search categories…" autocomplete="off" aria-label="Search categories">' +
                    '</div>' +
                    '<ul class="af-bdd-list" id="af-cdd-list" role="listbox" aria-labelledby="af-cat-lbl">' +
                      cats.map(function (c) { return '<li role="option" aria-selected="false" data-val="' + esc(c) + '">' + esc(c) + '</li>'; }).join('') +
                    '</ul>' +
                    '<div class="af-bdd-footer">' +
                      '<button type="button" class="af-bdd-create" id="af-cdd-create">＋ Create New Category</button>' +
                    '</div>' +
                  '</div>' +
                '</div>' +
                '<input type="hidden" id="af-cat">' +
              '</div>' +
              '<div class="af-field af-slide" id="af-new-cat" hidden>' +
                '<label for="af-cat-txt">New Category</label>' +
                '<input id="af-cat-txt" type="text" placeholder="e.g. Finance">' +
              '</div>' +
            '</div>' +

            // Campaign types
            '<div class="af-field">' +
              '<label>Campaign Types</label>' +
              '<div class="af-checks">' +
                CAMPAIGN_OPTS.map(function (v) {
                  return '<label class="af-chk"><input type="checkbox" name="campaignTypes" value="' + esc(v) + '"><span>' + esc(v) + '</span></label>';
                }).join('') +
              '</div>' +
            '</div>' +

            // Features
            '<div class="af-field">' +
              '<label>Features</label>' +
              '<div class="af-checks">' +
                FEATURE_OPTS.map(function (v) {
                  return '<label class="af-chk"><input type="checkbox" name="features" value="' + esc(v) + '"><span>' + esc(v) + '</span></label>';
                }).join('') +
              '</div>' +
            '</div>' +

            // Image slots
            '<div class="af-field">' +
              '<label>Ad Images</label>' +
              '<div class="af-slots">' + slotsHtml + '</div>' +
            '</div>' +

          '</div>' + // /adform-body

          '<div class="adform-ftr">' +
            '<span id="adform-err" class="adform-err" hidden></span>' +
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
  var imgData = {};   // size -> data URL, for the in-modal thumbnail preview
  var imgFiles = {};  // size -> File, uploaded to S3 on save
  var editingAd = null;
  var retainedSizes = {};

  function loadImage(inp) {
    var size = inp.dataset.size;
    var file = inp.files[0];
    if (!file) return;

    var k = size.replace('x', '-');
    var slot = document.getElementById('af-slot-' + k);

    imgFiles[size] = file;
    var r = new FileReader();
    r.onload = function (ev) {
      imgData[size] = ev.target.result;
      var thumb = document.getElementById('af-thumb-' + k);
      thumb.querySelector('img').src = ev.target.result;
      thumb.hidden = false;
      slot.classList.add('af-slot--ok');
    };
    r.readAsDataURL(file);
  }

  function removeImage(size) {
    delete imgData[size];
    delete imgFiles[size];
    delete retainedSizes[size];
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

    if (ref.category && _cddCtrl) {
      var cddList = document.getElementById('af-cdd-list');
      var catLi = cddList && cddList.querySelector('li[data-val="' + ref.category.replace(/"/g, '\\"') + '"]');
      if (catLi) {
        _cddCtrl.setValue(ref.category, ref.category);
        document.getElementById('af-new-cat').hidden = true;
      }
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
    if (_cddCtrl) _cddCtrl.reset();
    document.getElementById('af-new-cat').hidden = true;
  }

  // ── 6. Validation & save ───────────────────────────────────────────────────
  function showErr(msg) {
    var el = document.getElementById('adform-err');
    el.textContent = msg;
    el.hidden = false;
    el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  var _bddCtrl = null;   // brand dropdown controller (set in wireModal)
  var _cddCtrl = null;   // category dropdown controller (set in wireModal)

  var isSaving = false;

  async function save() {
    document.getElementById('adform-err').hidden = true;

    if (isSaving) return;

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

    var headers = { 'Content-Type': 'application/json' };

    var adId = editingAd ? editingAd.id : (window.crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : slug(brand + '_' + title) + '_' + Date.now();

    var submitBtn = document.getElementById('adform-submit');
    isSaving = true;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving…';

    try {
      var files = Object.keys(imgFiles).map(function (size) {
        return { size: size, contentType: imgFiles[size].type || 'application/octet-stream' };
      });

      var sizes = Object.assign({}, retainedSizes);
      if (files.length) {
        var presignRes = await fetch(API_BASE + '/ads/presign', {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({ adId: editingAd ? adId + '/revisions/' + Date.now() : adId, files: files }),
        });
        if (!presignRes.ok) throw new Error('Could not prepare image upload.');
        var presignData = await presignRes.json();

        await Promise.all(presignData.uploads.map(function (u) {
          return fetch(u.uploadUrl, {
            method: 'PUT',
            headers: { 'Content-Type': imgFiles[u.size].type || 'application/octet-stream' },
            body: imgFiles[u.size],
          }).then(function (r) {
            if (!r.ok) throw new Error('Failed to upload ' + u.size + ' image.');
            sizes[u.size] = u.publicUrl;
          });
        }));
      }

      var ad = {
        id: adId,
        title: title,
        brand: brand,
        category: category,
        campaignTypes: campaignTypes,
        features: features,
        date: editingAd ? editingAd.date : new Date().toISOString().slice(0, 10),
        sizes: sizes,
      };

      var createRes = await fetch(API_BASE + '/ads' + (editingAd ? '/' + encodeURIComponent(adId) : ''), {
        method: editingAd ? 'PUT' : 'POST',
        headers: headers,
        body: JSON.stringify(ad),
      });
      if (!createRes.ok) {
        var failure = await createRes.json().catch(function () { return {}; });
        throw new Error(failure.error || 'Could not save ad (' + createRes.status + ').');
      }

      window.location.reload();
    } catch (err) {
      isSaving = false;
      submitBtn.disabled = false;
      submitBtn.textContent = editingAd ? 'Save Changes' : 'Save Ad';
      showErr(err.message || 'Something went wrong while saving. Please try again.');
    }
  }

  // ── 7. Delete an ad ─────────────────────────────────────────────────────────
  function deleteAd(id) {
    fetch(API_BASE + '/ads/' + encodeURIComponent(id), { method: 'DELETE' })
      .then(function (r) {
        if (!r.ok) throw new Error('Delete failed (' + r.status + ')');
        window.location.reload();
      })
      .catch(function (err) { alert('Could not delete ad: ' + err.message); });
  }

  function addDeleteButtons() {
    apiAdIds.forEach(function (id) {
      var card = document.querySelector('[data-ad-id="' + id + '"]');
      if (!card || card.querySelector('.card__edit')) return;
      var editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'card__edit';
      editBtn.title = 'Edit this creative';
      editBtn.setAttribute('aria-label', 'Edit this creative');
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        openEditModal(id);
      });
      editBtn.addEventListener('keydown', function (e) { e.stopPropagation(); });
      card.querySelector('.card__preview').appendChild(editBtn);
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'card__delete';
      btn.title = 'Delete this ad';
      btn.setAttribute('aria-label', 'Delete this ad');
      btn.textContent = '×';
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (confirm('Delete this ad?')) deleteAd(id);
      });
      card.querySelector('.card__preview').appendChild(btn);
    });
  }

  // ── 8. Open / close modal ──────────────────────────────────────────────────
  function openModal() {
    document.getElementById('adform-modal').hidden = false;
    document.body.style.overflow = 'hidden';
  }

  function openEditModal(id) {
    if (!apiAdIds.has(id) || isSaving) return;
    var ad = (window.ADS || []).find(function (item) { return item.id === id; });
    if (!ad) return;
    closeModal();
    editingAd = ad;
    retainedSizes = Object.assign({}, ad.sizes);
    document.getElementById('adform-heading').textContent = 'Edit Creative';
    document.getElementById('adform-submit').textContent = 'Save Changes';
    document.getElementById('af-title').value = ad.title;
    _bddCtrl.setValue(ad.brand, ad.brand);
    _cddCtrl.setValue(ad.category, ad.category);
    document.getElementById('af-cat-section').hidden = false;
    document.querySelectorAll('input[name="campaignTypes"], input[name="features"]').forEach(function (checkbox) {
      checkbox.checked = (ad[checkbox.name] || []).indexOf(checkbox.value) !== -1;
    });
    SIZES.forEach(function (size) {
      if (!retainedSizes[size]) return;
      var key = size.replace('x', '-');
      var thumb = document.getElementById('af-thumb-' + key);
      thumb.querySelector('img').src = retainedSizes[size];
      thumb.hidden = false;
      document.getElementById('af-slot-' + key).classList.add('af-slot--ok');
    });
    openModal();
    document.getElementById('af-title').focus();
  }

  function closeModal() {
    if (isSaving) return;
    var m = document.getElementById('adform-modal');
    if (!m) return;
    m.hidden = true;
    document.body.style.overflow = '';
    document.getElementById('adform').reset();
    // Reset custom dropdowns
    if (_bddCtrl) _bddCtrl.reset();
    if (_cddCtrl) _cddCtrl.reset();
    document.getElementById('af-new-brand').hidden   = true;
    document.getElementById('af-cat-section').hidden = true;
    document.getElementById('af-new-cat').hidden     = true;
    document.getElementById('adform-err').hidden      = true;
    editingAd = null;
    retainedSizes = {};
    document.getElementById('adform-heading').textContent = 'Add Creative';
    document.getElementById('adform-submit').textContent = 'Save Ad';
    SIZES.forEach(function (s) {
      var k = s.replace('x', '-');
      var t = document.getElementById('af-thumb-' + k);
      if (t) { t.hidden = true; t.querySelector('img').src = ''; }
      var slot = document.getElementById('af-slot-' + k);
      if (slot) slot.classList.remove('af-slot--ok');
    });
    imgData = {};
    imgFiles = {};
  }

  // ── 9. Wire events ─────────────────────────────────────────────────────────
  function wireModal() {
    var modal   = document.getElementById('adform-modal');
    var bInput  = document.getElementById('af-brand');      // hidden input, value read by save()
    var bm      = getBrandMap();

    // ── Generic custom dropdown factory ────────────────────────────────────
    function wireDropdown(ids, onSelect) {
      var trigger   = document.getElementById(ids.trigger);
      var valSpan   = document.getElementById(ids.val);
      var panel     = document.getElementById(ids.panel);
      var search    = document.getElementById(ids.search);
      var list      = document.getElementById(ids.list);
      var create    = document.getElementById(ids.create);
      var hidden    = document.getElementById(ids.hidden);
      var placeholder = valSpan.textContent;
      var current   = { val: '', label: '' };

      function filterList(q) {
        q = (q || '').toLowerCase().trim();
        var hasVisible = false;
        list.querySelectorAll('li[data-val]').forEach(function (li) {
          var match = !q || li.dataset.val.toLowerCase().indexOf(q) !== -1;
          li.hidden = !match;
          if (match) hasVisible = true;
        });
        var emptyLi = list.querySelector('.af-bdd-empty');
        if (!hasVisible) {
          if (!emptyLi) {
            emptyLi = document.createElement('li');
            emptyLi.className = 'af-bdd-empty';
            emptyLi.textContent = 'No results found';
            list.appendChild(emptyLi);
          }
          emptyLi.hidden = false;
        } else if (emptyLi) {
          emptyLi.hidden = true;
        }
      }

      function openDd() {
        panel.hidden = false;
        trigger.setAttribute('aria-expanded', 'true');
        search.value = '';
        filterList('');
        search.focus();
      }

      function closeDd() {
        panel.hidden = true;
        trigger.setAttribute('aria-expanded', 'false');
      }

      function updateDisplay(val, label) {
        current = { val: val, label: label };
        hidden.value = val;
        valSpan.textContent = label || placeholder;
        list.querySelectorAll('li[data-val]').forEach(function (li) {
          li.setAttribute('aria-selected', li.dataset.val === val ? 'true' : 'false');
        });
      }

      function selectVal(val, label) {
        updateDisplay(val, label);
        closeDd();
        onSelect(val);
      }

      trigger.addEventListener('click', function () {
        if (panel.hidden) openDd(); else closeDd();
      });

      search.addEventListener('input', function () { filterList(search.value); });
      search.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { closeDd(); trigger.focus(); }
        if (e.key === 'Enter') {
          var visible = list.querySelector('li[data-val]:not([hidden])');
          if (visible) selectVal(visible.dataset.val, visible.dataset.val);
        }
      });

      list.addEventListener('click', function (e) {
        var li = e.target.closest('li[data-val]');
        if (!li || li.classList.contains('af-bdd-empty')) return;
        selectVal(li.dataset.val, li.dataset.val);
      });

      if (create) {
        create.addEventListener('click', function () { selectVal('__new__', ids.createLabel); });
      }

      // Close on outside click
      document.addEventListener('click', function (e) {
        var dd = document.getElementById(ids.dd);
        if (dd && !dd.contains(e.target)) closeDd();
      });

      return {
        reset: function () {
          current = { val: '', label: '' };
          hidden.value = '';
          valSpan.textContent = placeholder;
          search.value = '';
          closeDd();
          list.querySelectorAll('li').forEach(function (li) { li.hidden = false; li.setAttribute('aria-selected', 'false'); });
          var emptyLi = list.querySelector('.af-bdd-empty');
          if (emptyLi) emptyLi.hidden = true;
        },
        setValue: function (val, label) { updateDisplay(val, label); }
      };
    }

    // ── Brand dropdown ──────────────────────────────────────────────────────
    var bddList = document.getElementById('af-bdd-list');
    var brands = Array.from(bm.keys()).sort(function (a, b) { return a.localeCompare(b); });
    brands.forEach(function (name) {
      var li = document.createElement('li');
      li.setAttribute('role', 'option');
      li.setAttribute('aria-selected', 'false');
      li.dataset.val = name;
      li.textContent = name;
      bddList.appendChild(li);
    });

    _bddCtrl = wireDropdown({
      dd: 'af-bdd', trigger: 'af-bdd-trigger', val: 'af-bdd-val',
      search: 'af-bdd-search', panel: 'af-bdd-panel',
      list: 'af-bdd-list', create: 'af-bdd-create', hidden: 'af-brand',
      createLabel: '＋ New brand…'
    }, function (val) {
      var isNew = val === '__new__';
      document.getElementById('af-new-brand').hidden   = !isNew;
      document.getElementById('af-cat-section').hidden = !isNew && !editingAd;
      if (val && !isNew && !editingAd) {
        autoFill(bm.get(val) || []);
      } else if (!val) {
        clearChecks();
      } else if (isNew) {
        if (_cddCtrl) _cddCtrl.reset();
        document.getElementById('af-new-cat').hidden = true;
      }
    });

    // ── Category dropdown ───────────────────────────────────────────────────
    _cddCtrl = wireDropdown({
      dd: 'af-cdd', trigger: 'af-cdd-trigger', val: 'af-cdd-val',
      search: 'af-cdd-search', panel: 'af-cdd-panel',
      list: 'af-cdd-list', create: 'af-cdd-create', hidden: 'af-cat',
      createLabel: '＋ New category…'
    }, function (val) {
      document.getElementById('af-new-cat').hidden = val !== '__new__';
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
  }

  // Loads app.js only once window.ADS holds the full catalog (static +
  // API-backed), then attaches delete buttons once its render() has run —
  // script.onload fires after app.js's top-level code has executed.
  function loadAppScript(cb) {
    var s = document.createElement('script');
    s.src = 'js/app.js';
    s.onload = cb;
    s.onerror = cb; // don't leave the loader stuck up if app.js fails to load
    document.body.appendChild(s);
  }

  function hidePageLoader() {
    var loader = document.getElementById('page-loader');
    if (loader) loader.classList.add('page-loader--hidden');
  }

  function boot() {
    loadRemoteAds().then(function () {
      init();
      loadAppScript(function () {
        addDeleteButtons();
        var grid = document.getElementById('grid');
        if (grid) new MutationObserver(addDeleteButtons).observe(grid, { childList: true });
        hidePageLoader();
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
