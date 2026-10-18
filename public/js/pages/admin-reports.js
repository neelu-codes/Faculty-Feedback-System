/* ==========================================================
   admin-reports.js - Feedback exports.

   Feedback exports: NO results are shown on screen, the admin only downloads Excel files.
   Filters in this order: 1) Faculty (optional) 2) School 3) Class.
     - Faculty chosen            -> single-faculty report (his school is filled in automatically)
     - No faculty, school        -> school report: every faculty member of that school
     - Nothing chosen            -> all faculty
   Two downloads use the same filters:
     - Averages Excel      (API.downloadAveragesXlsx)  one row per faculty + subject + class
     - All responses Excel (API.downloadResponsesXlsx) one row per individual rating / comment
   ========================================================== */
(async () => {
  if (!(await App.init({ access: 'admin', active: 'reports' }))) return;
  WS.enhance();

  const $ = App.$, E = App.esc, msg = $('#msg');
  let faculties = [], departments = [], classes = [];
  const slug = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const selText = sel => sel.value ? sel.options[sel.selectedIndex].text : '';

  /* ---------- fill the dropdowns ---------- */
  const facultyOptions = deptId => '<option value="">All faculty</option>' +
    App.options(faculties.filter(f => !deptId || String(f.departmentId) === String(deptId)), 'id', f => f.name);
  try {
    [departments, classes, faculties] = await Promise.all([API.departments(), API.classes(), API.faculties()]);
    $('#fFaculty').innerHTML = facultyOptions('');
    $('#fDept').innerHTML = '<option value="">All schools</option>' + App.options(departments, 'id', d => d.name);
    $('#fClass').innerHTML = '<option value="">All classes</option>' + App.options(classes, 'id', c => c.name);
  } catch (e) { return App.showAlert(msg, e.message); }

  /* ================= Feedback exports ================= */
  // Choosing a school narrows the faculty list to that school.
  $('#fDept').addEventListener('change', () => {
    const keep = $('#fFaculty').value;
    $('#fFaculty').innerHTML = facultyOptions($('#fDept').value);
    $('#fFaculty').value = [...$('#fFaculty').options].some(o => o.value === keep) ? keep : '';
  });
  $('#fFaculty').addEventListener('change', () => {
    const f = faculties.find(x => String(x.id) === $('#fFaculty').value);
    if (f && !$('#fDept').value) {
      $('#fDept').value = String(f.departmentId);
    }
  });

  const filters = () => ({
    facultyId: $('#fFaculty').value, departmentId: $('#fDept').value,
    classId: $('#fClass').value
  });

  // File name reflects the selected faculty or school and class.
  const fileName = kind => {
    const f = filters();
    const who = f.facultyId ? selText($('#fFaculty')) : f.departmentId ? selText($('#fDept')) : 'all-faculty';
    return [kind, slug(who), slug(selText($('#fClass')) || 'all-classes')].filter(Boolean).join('-') + '.xlsx';
  };

  function saveWorkbook(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  async function exportAverages() {
    await App.busy($('#exportAvg'), async () => {
      try {
        const blob = await API.downloadAveragesXlsx(filters());
        saveWorkbook(blob, fileName('averages'));
        App.toast('Averages Excel downloaded.');
      } catch (e) { App.toast(e.message, 'error'); }
    });
  }

  async function exportAllResponses() {
    await App.busy($('#exportAll'), async () => {
      try {
        const blob = await API.downloadResponsesXlsx(filters());
        saveWorkbook(blob, fileName('all-responses'));
        App.toast('All responses Excel downloaded.');
      } catch (e) { App.toast(e.message, 'error'); }
    });
  }
  $('#exportAvg').addEventListener('click', exportAverages);
  $('#exportAll').addEventListener('click', exportAllResponses);

  // Clickable action cards
  const bindCard = (cardId, actionFn) => {
    const card = $(cardId);
    if (!card) return;
    card.addEventListener('click', e => {
      if (!e.target.closest('button')) actionFn();
    });
    card.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
        e.preventDefault();
        actionFn();
      }
    });
  };
  bindCard('#cardAvg', exportAverages);
  bindCard('#cardAll', exportAllResponses);
})();

