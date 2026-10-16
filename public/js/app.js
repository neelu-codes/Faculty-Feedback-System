/* ==========================================================
   app.js  -  shared UI: layout, navigation, accessibility toolbar,
   route guard, toasts, dialogs and small helpers.
   Every page calls   App.init({ access, active })   once.
   ========================================================== */
const App = (() => {
  let CONFIG = { collegeName: 'Your College', shortName: 'FFS', projectTitle: 'Faculty Feedback System', ratingMax: 5, ratingLabels: [] };

  const NAV = {
    public:  [['index.html', 'Home', 'home'], ['login.html', 'Login', 'login'], ['register.html', 'Register', 'register']],
    student: [['student-dashboard.html', 'My Surveys', 'dashboard']],
    admin:   [['admin-dashboard.html', 'Dashboard', 'dashboard'], ['admin-academics.html', 'Academics', 'academics'],
              ['admin-questions.html', 'Questions', 'questions'], ['admin-surveys.html', 'Surveys', 'surveys'],
              ['admin-reports.html', 'Reports', 'reports']]
  };

  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  /* ---------- accessibility preferences (saved in the browser) ---------- */
  function applyPrefs() {
    const fs = localStorage.getItem('fbs_fs') || '0', th = localStorage.getItem('fbs_theme') || 'default';
    document.documentElement.dataset.fs = fs;
    if (th === 'contrast') document.documentElement.dataset.theme = 'contrast'; else delete document.documentElement.dataset.theme;
  }
  applyPrefs();

  function a11yBar() {
    const bar = document.createElement('div');
    bar.className = 'a11y-bar no-print';
    bar.innerHTML = `<div class="a11y-inner" role="group" aria-label="Accessibility options">
      <span>Text size:</span>
      <button type="button" data-fs="-1" aria-label="Decrease text size">A−</button>
      <button type="button" data-fs="0" aria-label="Reset text size">A</button>
      <button type="button" data-fs="1" aria-label="Increase text size">A+</button>
      <button type="button" id="contrastBtn" aria-pressed="false">High contrast</button></div>`;
    const cb = $('#contrastBtn', bar);
    const sync = () => cb.setAttribute('aria-pressed', document.documentElement.dataset.theme === 'contrast');
    sync();
    bar.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b) return;
      if (b.dataset.fs !== undefined) {
        let cur = Number(localStorage.getItem('fbs_fs') || 0), n = Number(b.dataset.fs);
        cur = n === 0 ? 0 : Math.max(0, Math.min(2, cur + n));
        localStorage.setItem('fbs_fs', cur);
      } else if (b.id === 'contrastBtn') {
        localStorage.setItem('fbs_theme', document.documentElement.dataset.theme === 'contrast' ? 'default' : 'contrast');
      }
      applyPrefs(); sync();
    });
    return bar;
  }

  /* ---------- layout ---------- */
  function buildLayout(role, active) {
    const user = API.session.user;
    const items = (role === 'public' ? NAV.public : NAV[role] || []).filter(i => !(role === 'public' && user));
    const home = user ? (user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html') : 'index.html';
    const header = document.createElement('header');
    header.className = 'site-header no-print';
    header.innerHTML = `<div class="header-inner">
      <a class="brand" href="${home}"><span class="brand-mark" aria-hidden="true">${esc(CONFIG.shortName.slice(0, 3))}</span>
        <span>${esc(CONFIG.projectTitle)}<small>${esc(CONFIG.collegeName)}</small></span></a>
      <button class="nav-toggle" aria-expanded="false" aria-controls="mainNav">Menu</button>
      <nav class="main-nav" id="mainNav" aria-label="Main"><ul>
        ${items.map(([h, t, k]) => `<li><a href="${h}" ${k === active ? 'aria-current="page"' : ''}>${esc(t)}</a></li>`).join('')}
        ${user ? `<li><span class="user-chip">${esc(user.name)} (${esc(user.role)})</span></li><li><button type="button" id="logoutBtn">Log out</button></li>` : ''}
      </ul></nav></div>`;
    const toggle = $('.nav-toggle', header), nav = $('#mainNav', header);
    toggle.addEventListener('click', () => { const o = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', o); });
    const lo = $('#logoutBtn', header);
    if (lo) lo.addEventListener('click', async () => { await API.logout(); location.href = 'login.html'; });

    const skip = Object.assign(document.createElement('a'), { className: 'skip-link', href: '#main', textContent: 'Skip to main content' });
    const footer = document.createElement('footer');
    footer.className = 'site-footer no-print';
    footer.innerHTML = `<div class="footer-inner"><span>&copy; ${new Date().getFullYear()} ${esc(CONFIG.collegeName)} &middot; ${esc(CONFIG.projectTitle)}</span>
      <span>Feedback is anonymous &middot; <a href="index.html#privacy">Privacy</a>${CONFIG.contactEmail ? ` &middot; <a href="mailto:${esc(CONFIG.contactEmail)}">Contact</a>` : ''}</span></div>`;
    const toast = Object.assign(document.createElement('div'), { id: 'toast-region' });
    toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');

    document.body.prepend(skip, header, a11yBar());
    document.body.append(footer, toast);
    document.title = `${document.title} | ${CONFIG.projectTitle}`;
  }

  /* ---------- init ---------- */
  async function init({ access = 'public', active = '' } = {}) {
    try { CONFIG = { ...CONFIG, ...(await API.config()) }; } catch { /* fall back to defaults */ }
    const user = API.session.user;
    if (access === 'admin' && (!user || user.role !== 'admin')) { location.replace('login.html?need=admin'); return false; }
    if (access === 'student' && (!user || user.role !== 'student')) { location.replace('login.html?need=student'); return false; }
    buildLayout(access === 'public' ? 'public' : access, active);
    $('main')?.setAttribute('tabindex', '-1');
    return true;
  }

  /* ---------- helpers ---------- */
  function toast(msg, type = 'success') {
    const el = Object.assign(document.createElement('div'), { className: 'toast ' + type, textContent: msg });
    $('#toast-region').append(el); setTimeout(() => el.remove(), 4200);
  }
  function confirmBox(message, okText = 'Delete') {
    return new Promise(resolve => {
      const d = document.createElement('dialog');
      d.setAttribute('aria-labelledby', 'cfm-t');
      d.innerHTML = `<h2 id="cfm-t">Please confirm</h2><p>${esc(message)}</p>
        <div class="dialog-actions"><button class="btn" value="no">Cancel</button><button class="btn btn-danger" value="yes">${esc(okText)}</button></div>`;
      d.addEventListener('click', e => { const b = e.target.closest('button'); if (b) d.close(b.value); });
      d.addEventListener('close', () => { resolve(d.returnValue === 'yes'); d.remove(); });
      document.body.append(d); d.showModal();
    });
  }
  // Show a message inside a container's alert box
  function showAlert(el, msg, type = 'error') {
    el.className = 'alert alert-' + type; el.textContent = msg; el.hidden = !msg;
  }
  async function busy(btn, fn) {
    const old = btn.innerHTML; btn.disabled = true; btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Please wait';
    try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = old; }
  }
  const fmtDate = s => s ? new Date(s.replace(' ', 'T') + (s.includes('Z') || s.length <= 10 ? '' : 'Z')).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '-';
  function ratingClass(avg) { const r = avg / CONFIG.ratingMax; return r >= 0.8 ? 'good' : r >= 0.6 ? 'warn' : 'bad'; }
  function ratingLabel(avg) { return { good: 'Excellent', warn: 'Satisfactory', bad: 'Needs improvement' }[ratingClass(avg)]; }
  function bars(rows) { // rows: [{label, value}]  -> accessible bar chart
    if (!rows.length) return '<p class="empty">No ratings yet.</p>';
    return rows.map(r => `<div class="bar-row"><span class="bar-label">${esc(r.label)}</span>
      <div class="bar-track" role="img" aria-label="${esc(r.label)}: ${r.value} out of ${CONFIG.ratingMax}"><div class="bar-fill ${ratingClass(r.value)}" style="width:${(r.value / CONFIG.ratingMax * 100).toFixed(0)}%"></div></div>
      <span class="bar-val">${r.value}</span></div>`).join('');
  }
  function downloadCSV(filename, rows) {
    const cell = v => { v = String(v ?? ''); if (/^[=+\-@]/.test(v)) v = "'" + v; return `"${v.replace(/"/g, '""')}"`; };
    const blob = new Blob(['\ufeff' + rows.map(r => r.map(cell).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
    document.body.append(a); a.click(); a.remove(); URL.revokeObjectURL(a.href);
  }
  function tabs(root, onChange) {
    const btns = $$('[role=tab]', root), panels = btns.map(b => document.getElementById(b.getAttribute('aria-controls')));
    const select = i => { btns.forEach((b, j) => { b.setAttribute('aria-selected', i === j); b.tabIndex = i === j ? 0 : -1; panels[j].hidden = i !== j; }); onChange && onChange(btns[i].dataset.tab); };
    btns.forEach((b, i) => {
      b.addEventListener('click', () => select(i));
      b.addEventListener('keydown', e => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + btns.length) % btns.length; select(n); btns[n].focus(); }
      });
    });
    select(0);
  }
  // Modal form: fields = [{id,label,type:'text'|'select'|'password',value,options:[{v,l}],required}]
  function formDialog(title, fields, onSubmit, okText = 'Save') {
    const d = document.createElement('dialog');
    d.setAttribute('aria-labelledby', 'fd-t');
    d.innerHTML = `<h2 id="fd-t">${esc(title)}</h2><div class="alert alert-error" role="alert" hidden></div>
      <form novalidate>${fields.map(f => `<div class="field"><label for="fd-${f.id}">${esc(f.label)}</label>
        ${f.type === 'select'
          ? `<select id="fd-${f.id}" ${f.required !== false ? 'required' : ''}>${(f.options || []).map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(f.value) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`
          : `<input id="fd-${f.id}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}" ${f.required !== false ? 'required' : ''} autocomplete="off">`}</div>`).join('')}
      <div class="dialog-actions"><button type="button" class="btn" data-cancel>Cancel</button><button type="submit" class="btn btn-primary">${esc(okText)}</button></div></form>`;
    const err = $('.alert', d), form = $('form', d);
    $('[data-cancel]', d).addEventListener('click', () => d.close());
    d.addEventListener('close', () => d.remove());
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const vals = {};
      for (const f of fields) {
        const el = $('#fd-' + f.id, d); vals[f.id] = el.value.trim();
        if (f.required !== false && !vals[f.id]) { showAlert(err, `${f.label} is required.`); return el.focus(); }
      }
      try { await onSubmit(vals); d.close(); } catch (ex) { showAlert(err, ex.message); }
    });
    document.body.append(d); d.showModal();
  }
  const options = (list, valueKey, labelFn, placeholder) =>
    (placeholder ? `<option value="">${esc(placeholder)}</option>` : '') + list.map(x => `<option value="${x[valueKey]}">${esc(labelFn(x))}</option>`).join('');

  return { init, esc, $, $$, toast, confirmBox, showAlert, busy, fmtDate, ratingClass, ratingLabel, bars, downloadCSV, tabs, options, formDialog, get config() { return CONFIG; } };
})();
