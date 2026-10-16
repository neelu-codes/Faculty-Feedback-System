(async () => {
  if (!(await App.init({ access: 'admin', active: 'surveys' }))) return;
  const E = App.esc, msg = App.$('#msg'), bmsg = App.$('#bmsg'), builder = App.$('#builder');
  let surveys = [], classes = [], facs = [], qs = [], editId = null;

  async function load() {
    try {
      [surveys, classes, facs, qs] = await Promise.all([API.surveys(), API.classes(), API.faculties(), API.questions()]);
      renderTable();
    } catch (e) { App.showAlert(msg, e.message); }
  }
  function status(s) {
    if (!s.isActive) return '<span class="badge badge-grey">Closed</span>';
    if (s.closesOn && s.closesOn < new Date().toISOString().slice(0, 10)) return '<span class="badge badge-warn">Expired</span>';
    return '<span class="badge badge-good">Active</span>';
  }
  function renderTable() {
    App.$('#rows').innerHTML = surveys.length ? surveys.map(s => `<tr><td data-label="Title">${E(s.title)}</td><td data-label="Class">${E(s.className)}</td>
      <td data-label="Status">${status(s)}</td><td data-label="Responses">${s.submissions} / ${s.students}</td>
      <td class="actions"><button class="btn btn-sm" data-act="toggle" data-id="${s.id}">${s.isActive ? 'Close' : 'Reopen'}<span class="sr-only"> ${E(s.title)}</span></button>
      <button class="btn btn-sm" data-act="edit" data-id="${s.id}">Edit<span class="sr-only"> ${E(s.title)}</span></button>
      <button class="btn btn-sm btn-danger" data-act="del" data-id="${s.id}">Delete<span class="sr-only"> ${E(s.title)}</span></button></td></tr>`).join('')
      : '<tr><td colspan="5" class="empty">No surveys yet. Click "New survey".</td></tr>';
  }

  function openBuilder(s) {
    editId = s?.id || null; bmsg.hidden = true;
    App.$('#bt').textContent = s ? 'Edit survey' : 'New survey';
    App.$('#title').value = s?.title || ''; App.$('#desc').value = s?.description || ''; App.$('#closes').value = s?.closesOn || '';
    App.$('#classId').innerHTML = App.options(classes, 'id', c => `${c.name} (${c.department})`, 'Select class');
    App.$('#classId').value = s?.classId || '';
    const fSel = new Set((s?.faculties || []).map(f => f.id)), qSel = new Set((s?.questions || []).map(q => q.id));
    App.$('#facList').innerHTML = facs.map(f => `<label class="check-item"><input type="checkbox" name="fac" value="${f.id}" ${fSel.has(f.id) ? 'checked' : ''}><span>${E(f.name)}<span class="hint">${E(f.subject)} · ${E(f.department)}</span></span></label>`).join('') || '<p class="empty">Add faculty in Academics first.</p>';
    App.$('#qList').innerHTML = qs.map(q => `<label class="check-item"><input type="checkbox" name="q" value="${q.id}" ${qSel.has(q.id) ? 'checked' : ''}><span>${E(q.text)}<span class="hint">${q.type === 'rating' ? 'Rating' : 'Comment'} · ${E(q.category)}</span></span></label>`).join('') || '<p class="empty">Add questions first.</p>';
    builder.hidden = false; App.$('#title').focus(); builder.scrollIntoView({ behavior: 'smooth' });
  }
  const closeBuilder = () => { builder.hidden = true; editId = null; App.$('#newBtn').focus(); };

  App.$('#newBtn').addEventListener('click', () => openBuilder());
  App.$('#cancelBtn').addEventListener('click', closeBuilder);
  App.$('#surveyForm').addEventListener('submit', async e => {
    e.preventDefault();
    const data = { title: App.$('#title').value, description: App.$('#desc').value, classId: Number(App.$('#classId').value), closesOn: App.$('#closes').value,
      facultyIds: App.$$('[name=fac]:checked').map(i => +i.value), questionIds: App.$$('[name=q]:checked').map(i => +i.value) };
    try {
      await App.busy(App.$('#saveBtn'), () => editId ? API.updateSurvey(editId, data) : API.addSurvey(data));
      App.toast('Survey saved.'); closeBuilder(); load();
    } catch (err) { App.showAlert(bmsg, err.message); bmsg.scrollIntoView({ block: 'center' }); }
  });

  App.$('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = +b.dataset.id, s = surveys.find(x => x.id === id);
    try {
      if (b.dataset.act === 'toggle') { await API.setSurveyActive(id, !s.isActive); App.toast(s.isActive ? 'Survey closed.' : 'Survey reopened.'); load(); }
      else if (b.dataset.act === 'edit') openBuilder(await API.survey(id));
      else if (await App.confirmBox(`Delete "${s.title}" and all its responses? This cannot be undone.`)) { await API.deleteSurvey(id); App.toast('Deleted.'); load(); }
    } catch (err) { App.toast(err.message, 'error'); }
  });
  load();
})();
