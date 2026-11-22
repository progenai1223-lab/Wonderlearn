/* Tillmore basket: the catalogue, the basket store, the drawer, the shop's add buttons and the checkout.
   The basket lives in localStorage when the browser allows it (every read and write in try/catch); without it the
   basket is kept in memory for the page and carried to the checkout in the link (?items=id:qty,...).
   No payment is taken and no card number is ever asked for: the checkout writes an order request to the centre. */
(function () {
  'use strict';

  // every price and product detail here is assumed (data-assumed on the page): the client confirms them
  var CATALOGUE = {
    'y3-term':  { name: 'Year 3 term place', unit: 39600, max: 2 },
    'y4-term':  { name: 'Year 4 term place', unit: 43200, max: 2 },
    'y5-term':  { name: 'Year 5 term place', unit: 47400, max: 2 },
    'easter':   { name: 'Easter 11+ course', unit: 16800, max: 3 },
    'summer':   { name: 'Summer 11+ course', unit: 21450, max: 3 },
    'mock-gl':  { name: 'GL-style mock exam', unit: 3850, max: 4 },
    'mock-cem': { name: 'CEM-style mock exam', unit: 3850, max: 4 },
    'pack-em':  { name: 'English and maths pack', unit: 2495, max: 5 },
    'pack-vr':  { name: 'Reasoning pack', unit: 2495, max: 5 }
  };
  var KEY = 'tillmore-basket-v1';
  var memory = {};
  var storageOk = (function () {
    try { var k = '__tm'; window.localStorage.setItem(k, k); window.localStorage.removeItem(k); return true; } catch (e) { return false; }
  })();

  function gbp(p) { return '£' + (p / 100).toFixed(2); }
  function clean(obj) {
    var out = {};
    Object.keys(obj || {}).forEach(function (id) {
      var item = CATALOGUE[id]; var q = parseInt(obj[id], 10);
      if (item && q > 0) out[id] = Math.min(q, item.max);
    });
    return out;
  }
  function fromLink() {
    try {
      var p = new URLSearchParams(window.location.search).get('items');
      if (!p) return null;
      var o = {}; p.split(',').forEach(function (pair) { var a = pair.split(':'); o[a[0]] = a[1]; });
      return clean(o);
    } catch (e) { return null; }
  }
  function read() {
    if (storageOk) {
      try { var raw = window.localStorage.getItem(KEY); if (raw) return clean(JSON.parse(raw)); } catch (e) { /* fall through */ }
    }
    return clean(memory);
  }
  function write(b) {
    memory = clean(b);
    if (storageOk) { try { window.localStorage.setItem(KEY, JSON.stringify(memory)); } catch (e) { /* memory keeps it */ } }
    render();
  }
  function setQty(id, q) { var b = read(); if (q <= 0) delete b[id]; else b[id] = q; write(b); }
  function add(id) { var b = read(); var item = CATALOGUE[id]; if (!item) return; b[id] = Math.min((b[id] || 0) + 1, item.max); write(b); }
  function count(b) { return Object.keys(b).reduce(function (n, id) { return n + b[id]; }, 0); }
  function total(b) { return Object.keys(b).reduce(function (n, id) { return n + b[id] * CATALOGUE[id].unit; }, 0); }
  function linkParam(b) { return Object.keys(b).map(function (id) { return id + ':' + b[id]; }).join(','); }
  function checkoutHref(b) { var p = linkParam(b); return 'checkout.html' + (p ? '?items=' + encodeURIComponent(p) : ''); }

  // a link carries the basket in (storage off, or a shared link): it wins when the stored basket is empty
  var linked = fromLink();
  if (linked && Object.keys(linked).length && !Object.keys(read()).length) { memory = linked; if (storageOk) { try { localStorage.setItem(KEY, JSON.stringify(linked)); } catch (e) {} } }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { if (k === 'class') n.className = attrs[k]; else n.setAttribute(k, attrs[k]); });
    if (text != null) n.textContent = text;
    return n;
  }

  // one basket line with its stepper and remove button
  function lineNode(id, q) {
    var item = CATALOGUE[id];
    var li = el('li', { class: 'line' });
    li.appendChild(el('span', { class: 'line__name' }, item.name));
    li.appendChild(el('span', { class: 'line__sum', 'data-assumed': '' }, gbp(item.unit * q)));
    li.appendChild(el('span', { class: 'line__unit', 'data-assumed': '' }, gbp(item.unit) + ' each'));
    var ctrl = el('div', { class: 'line__ctrl' });
    var qty = el('div', { class: 'qty', role: 'group', 'aria-label': 'Quantity of ' + item.name });
    var minus = el('button', { type: 'button', 'aria-label': 'One fewer ' + item.name }, '−');
    var input = el('input', { type: 'number', inputmode: 'numeric', min: '1', max: String(item.max), value: String(q), 'aria-label': 'Quantity of ' + item.name });
    var plus = el('button', { type: 'button', 'aria-label': 'One more ' + item.name }, '+');
    if (q >= item.max) plus.disabled = true;
    minus.addEventListener('click', function () { setQty(id, q - 1); });
    plus.addEventListener('click', function () { setQty(id, q + 1); });
    input.addEventListener('change', function () { var v = parseInt(input.value, 10); setQty(id, isNaN(v) ? q : Math.max(0, Math.min(v, item.max))); });
    qty.appendChild(minus); qty.appendChild(input); qty.appendChild(plus);
    var rm = el('button', { type: 'button', class: 'line__remove', 'aria-label': 'Remove ' + item.name }, 'Remove');
    rm.addEventListener('click', function () { setQty(id, 0); });
    ctrl.appendChild(qty); ctrl.appendChild(rm);
    li.appendChild(ctrl);
    return li;
  }
  function fillLines(list, b) {
    // keep the focus on the same control after a re-render
    var a = document.activeElement, key = a && list.contains(a) ? (a.getAttribute('aria-label') || '') : '';
    list.textContent = '';
    Object.keys(b).forEach(function (id) { list.appendChild(lineNode(id, b[id])); });
    if (key) { var back = list.querySelector('[aria-label="' + key.replace(/"/g, '\\"') + '"]'); if (back) back.focus(); }
  }

  // ---------------------------------------------------------------- render everything that shows the basket
  function render() {
    var b = read(), n = count(b), t = total(b);
    document.querySelectorAll('[data-basket-count]').forEach(function (c) {
      c.textContent = String(n);
      if (n) c.removeAttribute('data-empty'); else c.setAttribute('data-empty', '');
    });
    document.querySelectorAll('.basket-btn').forEach(function (btn) { btn.setAttribute('aria-label', 'Basket, ' + n + (n === 1 ? ' item' : ' items')); });
    var drawer = document.getElementById('basket');
    if (drawer) {
      var list = drawer.querySelector('[data-basket-lines]');
      var empty = drawer.querySelector('[data-basket-empty]');
      var foot = drawer.querySelector('[data-basket-foot]');
      fillLines(list, b);
      empty.hidden = n > 0; foot.hidden = n === 0;
      drawer.querySelector('[data-basket-total]').textContent = gbp(t);
      var go = drawer.querySelector('[data-checkout-link]'); if (go) go.setAttribute('href', checkoutHref(b));
    }
    document.querySelectorAll('[data-add]').forEach(function (btn) {
      var id = btn.getAttribute('data-add');
      if (b[id]) btn.setAttribute('data-added', ''); else btn.removeAttribute('data-added');
    });
    if (window.__tmCheckout) window.__tmCheckout(b, t);
  }

  // ---------------------------------------------------------------- the drawer
  function openDrawer() {
    var d = document.getElementById('basket');
    if (!d) { window.location.href = checkoutHref(read()); return; }
    render();
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
  }
  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-basket-open], [data-basket-close], [data-add]') : null;
    if (!t) return;
    if (t.hasAttribute('data-basket-open')) { e.preventDefault(); openDrawer(); }
    else if (t.hasAttribute('data-basket-close')) { var d = document.getElementById('basket'); if (d && d.close) d.close(); else if (d) d.removeAttribute('open'); }
    else if (t.hasAttribute('data-add')) {
      var id = t.getAttribute('data-add'); add(id);
      var note = document.querySelector('[data-add-note]');
      if (note) note.textContent = CATALOGUE[id].name + ' is in your basket. ' + count(read()) + ' in all, ' + gbp(total(read())) + '.';
    }
  });
  // a click on the dimmed page beside the drawer closes it
  document.addEventListener('click', function (e) {
    var d = document.getElementById('basket');
    if (d && e.target === d) { var r = d.getBoundingClientRect(); if (e.clientX < r.left) d.close(); }
  });
  window.addEventListener('storage', function (e) { if (e.key === KEY) render(); });

  // ---------------------------------------------------------------- the checkout page
  var co = document.querySelector('[data-checkout]');
  if (co) {
    var panels = co.querySelectorAll('[data-step]');
    var marks = co.querySelectorAll('[data-step-mark]');
    var form = co.querySelector('#co-form');
    var steps = co.querySelector('.co__steps');
    function show(step, quiet) {
      panels.forEach(function (p) { p.hidden = p.getAttribute('data-step') !== step; });
      marks.forEach(function (m) { if (m.getAttribute('data-step-mark') === step) m.setAttribute('aria-current', 'step'); else m.removeAttribute('aria-current'); });
      if (steps) steps.hidden = step === 'done';
      var h = co.querySelector('[data-step="' + step + '"] .co__title'); if (h && !quiet) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    }
    window.__tmCheckout = function (b, t) {
      var n = count(b);
      var list = co.querySelector('[data-co-lines]'); if (list) fillLines(list, b);
      co.querySelectorAll('[data-co-total]').forEach(function (x) { x.textContent = gbp(t); });
      co.querySelectorAll('[data-co-count]').forEach(function (x) { x.textContent = n + (n === 1 ? ' item' : ' items'); });
      var empty = co.querySelector('[data-co-empty]'); if (empty) empty.hidden = n > 0;
      var full = co.querySelector('[data-co-full]'); if (full) full.hidden = n === 0;
      var sum = co.querySelector('[data-co-summary]');
      if (sum) {
        sum.textContent = '';
        if (!n) { sum.appendChild(el('dt', null, 'Nothing chosen yet')); sum.appendChild(el('dd', null, '')); }
        Object.keys(b).forEach(function (id) {
          sum.appendChild(el('dt', null, b[id] + ' × ' + CATALOGUE[id].name));
          sum.appendChild(el('dd', { 'data-assumed': '' }, gbp(b[id] * CATALOGUE[id].unit)));
        });
      }
      // the basket emptied while on the details step: back to the basket and its empty state
      var cur = co.querySelector('[data-step]:not([hidden])');
      if (!n && cur && cur.getAttribute('data-step') === 'details') show('basket', true);
    };
    co.addEventListener('click', function (e) {
      var go = e.target.closest ? e.target.closest('[data-go]') : null;
      if (!go) return;
      var step = go.getAttribute('data-go');
      if (step === 'details' && !count(read())) return;
      show(step);
    });
    // a fixed field clears its error as it is typed in
    form.querySelectorAll('[required]').forEach(function (f) {
      f.addEventListener(f.tagName === 'SELECT' ? 'change' : 'input', function () { if (f.getAttribute('aria-invalid') === 'true') check(f); });
    });
    function check(f) {
      var v = f.value.trim();
      var ok = v !== '' && (f.type !== 'email' || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v));
      var err = document.getElementById(f.getAttribute('aria-describedby'));
      if (ok) f.removeAttribute('aria-invalid'); else f.setAttribute('aria-invalid', 'true');
      if (err) err.hidden = ok;
      return ok;
    }
    // details: every field checked on submit, each error under its own field, the focus on the first that failed.
    // Only a valid submit opens the order email (the stand-in send) and shows the confirmation.
    // This handler runs before the kit's form handler and stops it, so the form is checked once.
    form.addEventListener('submit', function (e) {
      e.preventDefault(); e.stopImmediatePropagation();
      var status = form.querySelector('[data-co-status]');
      var bad = [];
      form.querySelectorAll('[required]').forEach(function (f) { if (!check(f)) bad.push(f); });
      if (bad.length) { status.textContent = bad.length === 1 ? 'One field needs a fix.' : bad.length + ' fields need a fix.'; bad[0].focus(); return; }
      var b = read();
      if (!count(b)) { status.textContent = 'Your basket is empty.'; show('basket'); return; }
      status.textContent = '';
      var d = {
        parent: form.elements.parent.value.trim(), email: form.elements.email.value.trim(),
        child: form.elements.child.value.trim(), year: form.elements.year.value
      };
      var ref = 'TM-' + Date.now().toString(36).toUpperCase().slice(-6);
      var body = ['Order request ' + ref, '', 'Parent: ' + d.parent, 'Email: ' + d.email, 'Child: ' + d.child + ', ' + d.year, ''];
      Object.keys(b).forEach(function (id) { body.push(b[id] + ' x ' + CATALOGUE[id].name + ': ' + gbp(b[id] * CATALOGUE[id].unit)); });
      body.push('', 'Total: ' + gbp(total(b)), '', 'Online payment is not connected yet. Please reply about payment once the places are confirmed.');
      var href = 'mailto:orders@tillmore.example?subject=' + encodeURIComponent('Order request ' + ref) + '&body=' + encodeURIComponent(body.join('\n'));
      co.querySelector('[data-co-ref]').textContent = ref;
      co.querySelector('[data-co-mail]').setAttribute('href', href);
      co.querySelector('[data-co-final]').textContent = d.child + ' (' + gbp(total(b)) + ')';
      form.reset();
      write({});
      try { window.history.replaceState(null, '', 'checkout.html'); } catch (err) { /* the link may still carry the old basket */ }
      show('done');
      window.location.href = href;
    });
    show('basket', true);
  }

  render();
  window.TillmoreBasket = { add: add, setQty: setQty, read: read, open: openDrawer };
})();
