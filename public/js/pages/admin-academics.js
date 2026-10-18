/* ==========================================================
  admin-academics.js - Schools, Classes, Faculty and Subjects.

   How the data fits together:
  - A FACULTY member is a teacher with a HOME school.
   - A SUBJECT links a class, a subject name and a teacher. The teacher can
    come from ANY school (e.g. a Mathematics teacher for a Computer Engineering class).
   - Surveys are built from a class's subjects (see admin-surveys.js).

   Features: search + filters, results grouped, live "showing x of y"
   announcements for screen readers, and focus that moves somewhere
   sensible after every change.
   ========================================================== */
(async () => {
  if (!(await App.init({ access: 'admin', active: 'academics' }))) return;
  WS.enhance();

  const $ = App.$, E = App.esc, msg = $('#msg');
  let deps = [], classes = [], facs = [], csubs = [];

  /* ---------- small helpers ---------- */
  const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
  const norm = s => String(s || '').toLowerCase().trim();
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { App.toast(e.message, 'error'); } };
  const debounce = (fn, ms = 250) => { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; };
  const depOpts = () => deps.map(d => ({ v: d.id, l: d.name }));
  // "Dr. Ashok D'souza" -> "AD", "Business" -> "BU"
  const initials = name => {
    const words = name.replace(/^(dr|mr|mrs|ms|smt|sri|shri|prof)\.?\s+/i, '').split(/\s+/).filter(Boolean);
    return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
  };
  const tint = id => 't' + (id % 4);
  // Move keyboard focus after the dialog has closed (a closing dialog restores focus itself first)
  const focusSoon = target => setTimeout(() => (typeof target === 'string' ? $(target) : target)?.focus(), 0);

  /* ---------- building blocks ---------- */
  const acts = (kind, id, name, extra = '') => `<div class="ws-actions">${extra}
    <button type="button" class="btn btn-sm ws-btn-action ws-btn-edit" data-act="edit" data-kind="${kind}" data-id="${id}" title="Edit ${E(name)}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
      <span>Edit</span>
      <span class="sr-only"> ${E(name)}</span>
    </button>
    <button type="button" class="btn btn-sm ws-btn-action ws-btn-delete" data-act="del" data-kind="${kind}" data-id="${id}" title="Delete ${E(name)}">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      <span>Delete</span>
      <span class="sr-only"> ${E(name)}</span>
    </button></div>`;

  const emptyState = (title, text, button) => `<div class="ws-empty"><h3>${title}</h3><p>${text}</p>${button}</div>`;
  const addButton = (kind, label) => `<button type="button" class="btn btn-primary" data-act="add" data-kind="${kind}"><span aria-hidden="true">+</span> ${label}</button>`;
  const gotoButton = (tab, label) => `<button type="button" class="btn btn-primary" data-goto="${tab}">${label}</button>`;
  const needDeptState = what => emptyState('Add a school first', `${what} belong to a school, so create one before adding them.`, gotoButton('dep', 'Go to schools'));

  // "Showing 2 of 5 faculty" is announced politely (the element has role="status")
  function announce(kind, shown, total, one, many) {
    const filtered = $('#q-' + kind).value.trim() || ($('#d-' + kind) && $('#d-' + kind).value);
    $('#s-' + kind).textContent = filtered ? `Showing ${shown} of ${plural(total, one, many)}.` : plural(total, one, many) + '.';
  }

  /* ---------- Schools: one card each ---------- */
  function renderDeps() {
    const raw = $('#q-dep').value.trim(), q = norm(raw);
    const list = deps.filter(d => norm(d.name).includes(q));
    $('#l-dep').innerHTML = !deps.length
      ? emptyState('No schools yet', 'Start here. Classes and faculty are created inside a school.', addButton('dep', 'Add your first school'))
      : !list.length ? `<p class="ws-none">No school matches "${E(raw)}".</p>`
      : `<ul class="ws-cards">${list.map(d => {
          const nc = classes.filter(c => c.departmentId === d.id).length, nf = facs.filter(f => f.departmentId === d.id).length;
          return `<li class="ws-dept"><div class="ws-dept-body"><span class="ws-mono ${tint(d.id)}" aria-hidden="true">${E(initials(d.name))}</span>
            <div class="ws-dept-info"><h3>${E(d.name)}</h3><dl class="ws-facts"><div><dt>Classes</dt><dd>${nc}</dd></div><div><dt>Faculty</dt><dd>${nf}</dd></div></dl></div></div>
            ${acts('dep', d.id, d.name)}</li>`;
        }).join('')}</ul>`;
    announce('dep', list.length, deps.length, 'school');
  }

  /* ---------- Classes, Faculty and Subjects: grouped lists ---------- */
  const rowHtml = {
    cls: c => {
      const n = csubs.filter(x => x.classId === c.id).length;
      const jump = `<button type="button" class="btn btn-sm ws-btn-sub" data-subjects-of="${c.id}">Subjects<span class="sr-only"> of ${E(c.name)}</span></button>`;
      return `<li class="ws-row"><div class="ws-row-main"><span class="ws-name">${E(c.name)}</span>
        <span class="ws-sub">${plural(c.students, 'student')}, ${plural(n, 'subject')}</span></div>${acts('cls', c.id, c.name, jump)}</li>`;
    },
    fac: f => `<tr><td data-label="Faculty"><span class="ws-name">${E(f.name)}</span></td>
        <td data-label="School">${E(f.department)}</td>
        <td data-label="Actions" class="ws-cell-actions">${acts('fac', f.id, f.name)}</td></tr>`,
    sbj: x => {
      const cls = classes.find(c => c.id === x.classId);
      const visiting = cls && cls.departmentId !== x.facultyDepartmentId; // teacher comes from another school
      return `<li class="ws-row"><div class="ws-row-main"><span class="ws-name">${E(x.subject)}</span>
        <span class="ws-sub">Taught by ${E(x.faculty)} (${E(x.facultyDepartment)})${visiting ? ' <span class="ws-badge ws-badge-note">Other school</span>' : ''}</span></div>
        ${acts('sbj', x.id, `${x.subject} for ${x.className}`)}</li>`;
    }
  };
  // what each grouped tab is made of
  const groupText = {
    cls: { noun: 'class', nouns: 'classes', add: 'Add class', plural: 'Classes' },
    fac: { noun: 'faculty member', nouns: 'faculty members', add: 'Add faculty', plural: 'Faculty' },
    sbj: { noun: 'subject', nouns: 'subjects', add: 'Add subject', plural: 'Subjects' }
  };
  const searchText = {
    cls: c => c.name,
    fac: f => `${f.name} ${f.department}`,
    sbj: x => `${x.subject} ${x.faculty}`
  };

  function renderGrouped(kind) {
    const t = groupText[kind];
    const raw = $('#q-' + kind).value.trim(), q = norm(raw), filter = $('#d-' + kind).value;
    const items = { cls: classes, fac: facs, sbj: csubs }[kind];
    const match = i => !q || norm(searchText[kind](i)).includes(q);
    // classes and faculty are grouped by school; subjects are grouped by class
    const parents = kind === 'sbj' ? classes : deps;
    const parentOf = i => kind === 'sbj' ? i.classId : i.departmentId;
    const parentName = p => p.name;

    let html;
    if (!deps.length) html = needDeptState(t.plural);
    else if (kind === 'sbj' && !classes.length) html = emptyState('Add a class first', 'Subjects are set up for a class.', gotoButton('cls', 'Go to classes'));
    else if (kind === 'sbj' && !facs.length) html = emptyState('Add a teacher first', 'Add your teachers, then choose who takes each subject.', gotoButton('fac', 'Go to faculty'));
    else {
      // while searching, hide groups with no match; otherwise keep empty ones so you can add to them
      const groups = parents.filter(p => !filter || String(p.id) === filter)
        .map(p => ({ p, rows: items.filter(i => parentOf(i) === p.id && match(i)) }))
        .filter(g => g.rows.length || !q);
      html = !groups.length ? `<p class="ws-none">No ${t.noun} matches "${E(raw)}".</p>` : groups.map(({ p, rows }) => {
        const body = kind === 'fac'
          ? rows.length ? `<div class="ws-table-wrap"><table class="ws-table">
              <caption class="sr-only">Faculty and school for ${E(parentName(p))}</caption>
              <thead><tr><th scope="col">Faculty</th><th scope="col">School</th><th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
              <tbody>${rows.map(rowHtml.fac).join('')}</tbody></table></div>`
            : '<p class="ws-none">No faculty members in this school yet.</p>'
          : rows.length ? `<ul class="ws-rows">${rows.map(rowHtml[kind]).join('')}</ul>`
            : `<p class="ws-none">No ${t.nouns} in ${kind === 'cls' ? 'this school' : 'this class'} yet.</p>`;
        const addBtn = (kind === 'cls' || kind === 'fac') ? '' : `<button type="button" class="btn btn-sm" data-act="add" data-kind="${kind}" data-preset="${p.id}">${t.add}<span class="sr-only"> to ${E(parentName(p))}</span></button>`;
        return `<section class="ws-group" aria-labelledby="g-${kind}-${p.id}">
          <div class="ws-group-head">
            <h3 id="g-${kind}-${p.id}">${E(parentName(p))}</h3>
            <span class="ws-group-count">${plural(rows.length, t.noun, t.nouns)}</span>
            ${addBtn}
          </div>${body}
        </section>`;
      }).join('');
    }
    $('#l-' + kind).innerHTML = html;
    const shown = items.filter(i => (!filter || String(parentOf(i)) === filter) && match(i)).length;
    announce(kind, shown, items.length, t.noun, t.nouns);
  }

  /* ---------- render everything ---------- */
  function fillFilters() {
    const fill = (id, allLabel, list, label) => {
      const sel = $(id), keep = sel.value;
      sel.innerHTML = `<option value="">${allLabel}</option>` + App.options(list, 'id', label);
      sel.value = list.some(x => String(x.id) === keep) ? keep : '';
    };
    fill('#d-cls', 'All schools', deps, d => d.name);
    fill('#d-fac', 'All schools', deps, d => d.name);
    fill('#d-sbj', 'All classes', classes, c => `${c.name} (${c.department})`);
  }
  function renderAll() {
    $('#c-dep').textContent = deps.length; $('#c-cls').textContent = classes.length;
    $('#c-fac').textContent = facs.length; $('#c-sbj').textContent = csubs.length;
    fillFilters(); renderDeps(); renderGrouped('cls'); renderGrouped('fac'); renderGrouped('sbj');
  }
  async function load() {
    try {
      [deps, classes, facs, csubs] = await Promise.all([API.departments(), API.classes(), API.faculties(), API.classSubjects()]);
      csubs = csubs.map(x => ({ ...x, name: x.subject }));
      renderAll();
    } catch (e) { App.showAlert(msg, e.message); }
  }

  /* ---------- add / edit / delete (same dialogs as before) ---------- */
  const defs = {
    dep: { find: id => deps.find(x => x.id == id), fields: x => [{ id: 'name', label: 'School name', value: x?.name }],
      add: v => {
        if (deps.some(d => norm(d.name) === norm(v.name))) throw new Error('A school with this name already exists.');
        return API.addDepartment(v.name);
      },
      upd: (id, v) => {
        if (deps.some(d => d.id != id && norm(d.name) === norm(v.name))) throw new Error('A school with this name already exists.');
        return API.updateDepartment(id, v.name);
      },
      del: id => API.deleteDepartment(id),
      noun: 'school', warn: 'This also deletes its classes and faculty.' },
    cls: { find: id => classes.find(x => x.id == id),
      fields: (x, pre) => [{ id: 'name', label: 'Class name (e.g. MCA Semester 1)', value: x?.name },
        { id: 'departmentId', label: 'School', type: 'select', options: depOpts(), value: x?.departmentId ?? pre }],
      add: v => {
        if (classes.some(c => c.departmentId === +v.departmentId && norm(c.name) === norm(v.name)))
          throw new Error('A class with this name already exists in this school.');
        return API.addClass({ name: v.name, departmentId: +v.departmentId });
      },
      upd: (id, v) => {
        if (classes.some(c => c.id != id && c.departmentId === +v.departmentId && norm(c.name) === norm(v.name)))
          throw new Error('A class with this name already exists in this school.');
        return API.updateClass(id, { name: v.name, departmentId: +v.departmentId });
      },
      del: id => API.deleteClass(id), noun: 'class', warn: 'Its subjects and surveys will be deleted too.' },
    fac: { find: id => facs.find(x => x.id == id),
      fields: (x, pre) => [{ id: 'name', label: 'Faculty name', value: x?.name },
        { id: 'departmentId', label: 'Home school', type: 'select', options: depOpts(), value: x?.departmentId ?? pre }],
      add: v => {
        if (facs.some(f => f.departmentId === +v.departmentId && norm(f.name) === norm(v.name)))
          throw new Error('A faculty member with this name already exists in this school.');
        return API.addFaculty({ name: v.name, departmentId: +v.departmentId });
      },
      upd: (id, v) => {
        if (facs.some(f => f.id != id && f.departmentId === +v.departmentId && norm(f.name) === norm(v.name)))
          throw new Error('A faculty member with this name already exists in this school.');
        return API.updateFaculty(id, { name: v.name, departmentId: +v.departmentId });
      },
      del: id => API.deleteFaculty(id), noun: 'faculty member', warn: 'Their subjects and feedback responses will be deleted too.' },
    sbj: { find: id => csubs.find(x => x.id == id),
      del: id => API.deleteClassSubject(id), noun: 'subject', warn: 'Surveys that already exist keep their ratings.',
      describe: x => `"${x.subject}" (${x.faculty}) from ${x.className}` }
  };

  /* ---------- subject dialog with searchable & filtered teacher selection ---------- */
  function openSubjectDialog(act, item, preset) {
    const isEdit = act === 'edit';
    const title = isEdit ? 'Edit subject' : 'Add subject';
    const d = document.createElement('dialog');
    d.setAttribute('aria-labelledby', 'sbj-dialog-t');
    d.style.width = 'min(94vw, 32rem)';

    const initialClassId = String(item?.classId ?? preset ?? (classes[0]?.id || ''));
    let selectedFacId = item?.facultyId ? String(item.facultyId) : '';

    d.innerHTML = `<h2 id="sbj-dialog-t">${E(title)}</h2>
      <div class="alert alert-error" role="alert" hidden></div>
      <form novalidate>
        <div class="field">
          <label for="sbj-classId">Class</label>
          <select id="sbj-classId" required>
            ${classes.map(c => `<option value="${c.id}" ${String(c.id) === initialClassId ? 'selected' : ''}>${E(c.name)} (${E(c.department)})</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="sbj-name">Subject name (e.g. Discrete Mathematics)</label>
          <input id="sbj-name" type="text" value="${E(item?.subject || '')}" required autocomplete="off">
        </div>

        <div class="field" style="border:1px solid var(--ws-line);border-radius:.65rem;padding:.85rem;background:var(--ws-surface)">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.5rem">
            <label for="sbj-facultyId" style="margin:0;font-weight:700">Teacher <span class="ws-sub">(from any school)</span></label>
            <span id="sbj-fac-count" class="ws-badge ws-badge-note">${facs.length} available</span>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(11rem,1fr));gap:.6rem;margin-bottom:.5rem">
            <div>
              <label for="sbj-filter-school" style="font-size:.85rem;font-weight:600;margin-bottom:.2rem">Filter by school</label>
              <select id="sbj-filter-school" style="min-height:2.4rem;padding:.3rem .6rem;font-size:.9rem">
                <option value="">All schools</option>
                ${deps.map(dp => `<option value="${dp.id}">${E(dp.name)} (${facs.filter(f => f.departmentId === dp.id).length})</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="sbj-search-teacher" style="font-size:.85rem;font-weight:600;margin-bottom:.2rem">Search teacher name</label>
              <input type="search" id="sbj-search-teacher" placeholder="Type to filter..." autocomplete="off" style="min-height:2.4rem;padding:.3rem .6rem;font-size:.9rem">
            </div>
          </div>

          <div>
            <label for="sbj-facultyId" class="sr-only">Choose teacher</label>
            <select id="sbj-facultyId" required></select>
          </div>
        </div>

        <div class="dialog-actions">
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Save' : 'Add'}</button>
        </div>
      </form>`;

    const err = $('.alert', d), form = $('form', d);
    const classSel = $('#sbj-classId', d);
    const schoolFilterSel = $('#sbj-filter-school', d);
    const searchInput = $('#sbj-search-teacher', d);
    const facSelect = $('#sbj-facultyId', d);
    const countEl = $('#sbj-fac-count', d);

    function renderTeacherList() {
      const schoolVal = schoolFilterSel.value;
      const q = norm(searchInput.value);

      const filtered = facs.filter(f => {
        if (schoolVal && String(f.departmentId) !== schoolVal) return false;
        if (q && !norm(f.name).includes(q) && !norm(f.department).includes(q)) return false;
        return true;
      });

      countEl.textContent = `${filtered.length} ${filtered.length === 1 ? 'teacher' : 'teachers'}`;

      if (!filtered.length) {
        facSelect.innerHTML = `<option value="">No teacher matches filter</option>`;
        return;
      }

      if (schoolVal) {
        facSelect.innerHTML = filtered.map(f =>
          `<option value="${f.id}" ${String(f.id) === String(selectedFacId) ? 'selected' : ''}>${E(f.name)}</option>`
        ).join('');
      } else {
        const grouped = {};
        for (const f of filtered) {
          if (!grouped[f.department]) grouped[f.department] = [];
          grouped[f.department].push(f);
        }
        facSelect.innerHTML = Object.entries(grouped).map(([dept, list]) =>
          `<optgroup label="${E(dept)}">${list.map(f =>
            `<option value="${f.id}" ${String(f.id) === String(selectedFacId) ? 'selected' : ''}>${E(f.name)}</option>`
          ).join('')}</optgroup>`
        ).join('');
      }

      if (filtered.some(f => String(f.id) === String(selectedFacId))) {
        facSelect.value = String(selectedFacId);
      } else {
        selectedFacId = String(filtered[0].id);
        facSelect.value = selectedFacId;
      }
    }

    facSelect.addEventListener('change', () => { selectedFacId = facSelect.value; });
    schoolFilterSel.addEventListener('change', renderTeacherList);
    searchInput.addEventListener('input', renderTeacherList);
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); facSelect.focus(); }
    });

    renderTeacherList();

    $('[data-cancel]', d).addEventListener('click', () => d.close());
    d.addEventListener('close', () => d.remove());

    form.addEventListener('submit', async e => {
      e.preventDefault();
      const clsId = +classSel.value;
      const subjName = $('#sbj-name', d).value.trim();
      const facId = +facSelect.value;

      if (!clsId) { App.showAlert(err, 'Class is required.'); return classSel.focus(); }
      if (!subjName) { App.showAlert(err, 'Subject name is required.'); return $('#sbj-name', d).focus(); }
      if (!facId) { App.showAlert(err, 'Teacher is required.'); return facSelect.focus(); }

      if (csubs.some(s => (!isEdit || s.id !== item.id) && s.classId === clsId && s.facultyId === facId && norm(s.subject) === norm(subjName))) {
        return App.showAlert(err, 'That teacher already takes this subject for this class.');
      }

      try {
        if (isEdit) {
          await API.updateClassSubject(item.id, { classId: clsId, facultyId: facId, subject: subjName });
          App.toast('Saved subject.');
        } else {
          await API.addClassSubject({ classId: clsId, facultyId: facId, subject: subjName });
          App.toast('Added subject.');
        }
        d.close();
        await load();
        focusSoon(isEdit ? `[data-act="edit"][data-kind="sbj"][data-id="${item.id}"]` : `#p-sbj .ws-panel-head .btn-primary`);
      } catch (ex) {
        App.showAlert(err, ex.message);
      }
    });

    document.body.append(d);
    App.makeDraggable(d);
    d.showModal();
    focusSoon(isEdit ? '#sbj-name' : (preset ? '#sbj-name' : '#sbj-classId'));
  }

  document.addEventListener('click', guard(async e => {
    const go = e.target.closest('[data-goto]');
    if (go) { $('#tab-' + go.dataset.goto).click(); return focusSoon('#tab-' + go.dataset.goto); }

    const jump = e.target.closest('[data-subjects-of]');   // "Subjects" button on a class row
    if (jump) { $('#d-sbj').value = jump.dataset.subjectsOf; $('#q-sbj').value = ''; renderGrouped('sbj'); $('#tab-sbj').click(); return focusSoon('#p-sbj .ws-panel-head h2'); }

    const b = e.target.closest('[data-act]'); if (!b) return;
    const kind = b.dataset.kind, d = defs[kind], act = b.dataset.act, id = b.dataset.id, item = id && d.find(id);
    const panelTitle = `#p-${kind} .ws-panel-head h2`;

    if (act === 'add' || act === 'edit') {
      if (kind === 'sbj' && !classes.length) return App.toast('Add a class first.', 'error');
      if (kind === 'sbj' && !facs.length) return App.toast('Add a faculty member first.', 'error');
      if (kind !== 'dep' && kind !== 'sbj' && !deps.length) return App.toast('Add a school first.', 'error');
      // a group's "Add" button, or the filter above the list, pre-selects the school / class in the form
      const preset = b.dataset.preset || ($('#d-' + kind) ? $('#d-' + kind).value : '');
      if (kind === 'sbj') {
        openSubjectDialog(act, item, preset);
        return;
      }
      App.formDialog(`${act === 'add' ? 'Add' : 'Edit'} ${d.noun}`, d.fields(item, preset), async v => {
        await (act === 'add' ? d.add(v) : d.upd(id, v));
        App.toast(`${act === 'add' ? 'Added' : 'Saved'} ${d.noun}.`);
        await load();
        focusSoon(act === 'edit' ? `[data-act="edit"][data-kind="${kind}"][data-id="${id}"]` : `#p-${kind} .ws-panel-head .btn-primary`);
      });
    } else if (act === 'del') {
      const what = d.describe ? d.describe(item) : `"${item.name}"`;
      if (await App.confirmBox(`Delete ${d.noun} ${what}? ${d.warn}`)) {
        await d.del(id); App.toast(`Deleted ${d.noun}.`); await load(); focusSoon(panelTitle);
      } else focusSoon(b.isConnected ? b : panelTitle);
    }
  }));

  /* ---------- search + filters ---------- */
  $('#q-dep').addEventListener('input', debounce(renderDeps));
  ['cls', 'fac', 'sbj'].forEach(kind => {
    $('#q-' + kind).addEventListener('input', debounce(() => renderGrouped(kind)));
    $('#d-' + kind).addEventListener('change', () => renderGrouped(kind));
  });

  const tabNames = { dep: 'schools', cls: 'classes', fac: 'faculty', sbj: 'subjects' };
  const tabTitleSuffix = document.title.replace(/^Academics/, '');
  const tabButtons = App.$$('#tabs [role="tab"]');
  const syncTab = tab => {
    const name = tabNames[tab.dataset.tab];
    if (location.hash !== `#${name}`) history.replaceState(null, '', `${location.pathname}${location.search}#${name}`);
    document.title = `${name[0].toUpperCase()}${name.slice(1)}${tabTitleSuffix}`;
  };

  App.tabs($('#tabs'));
  tabButtons.forEach((tab, index) => {
    tab.addEventListener('click', () => syncTab(tab));
    tab.addEventListener('focus', () => {
      if (tab.getAttribute('aria-selected') === 'true') syncTab(tab);
    });
    tab.addEventListener('keydown', e => {
      if (e.key !== 'Home' && e.key !== 'End') return;
      e.preventDefault();
      const target = tabButtons[e.key === 'Home' ? 0 : tabButtons.length - 1];
      target.focus();
      target.click();
    });
  });
  window.addEventListener('hashchange', () => {
    const tab = tabButtons.find(button => `#${tabNames[button.dataset.tab]}` === location.hash);
    if (tab) tab.click();
  });
  const initialTab = tabButtons.find(button => `#${tabNames[button.dataset.tab]}` === location.hash) || tabButtons[0];
  initialTab.click();
  load();
})();
