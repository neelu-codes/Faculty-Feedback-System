(async () => {
  if (!(await App.init({ access: 'admin', active: 'reports' }))) return;
  const E = App.esc, msg = App.$('#msg'), max = App.config.ratingMax;
  let surveys = [], perf = [], subs = null;

  try {
    const [sv, deps] = await Promise.all([API.surveys(), API.departments()]);
    surveys = sv;
    App.$('#fSurvey').innerHTML = '<option value="">All surveys</option>' + App.options(sv, 'id', s => s.title);
    App.$('#fDept').innerHTML = '<option value="">All departments</option>' + App.options(deps, 'id', d => d.name);
    App.$('#sSurvey').innerHTML = sv.length ? App.options(sv, 'id', s => s.title) : '<option value="">No surveys</option>';
  } catch (e) { return App.showAlert(msg, e.message); }

  async function loadPerf() {
    App.$('#detail').hidden = true;
    try {
      perf = await API.facultyReport({ surveyId: App.$('#fSurvey').value, departmentId: App.$('#fDept').value });
      App.$('#perfChart').innerHTML = App.bars(perf.map(f => ({ label: f.name, value: f.avg })));
      App.$('#perfRows').innerHTML = perf.length ? perf.map(f => `<tr><td data-label="Faculty">${E(f.name)}</td><td data-label="Subject">${E(f.subject)}</td>
        <td data-label="Responses">${f.responses}</td><td data-label="Average"><strong>${f.avg}</strong> / ${max}</td>
        <td data-label="Rating"><span class="badge badge-${App.ratingClass(f.avg)}">${App.ratingLabel(f.avg)}</span></td>
        <td class="actions"><button class="btn btn-sm" data-id="${f.id}">Details<span class="sr-only"> for ${E(f.name)}</span></button></td></tr>`).join('')
        : '<tr><td colspan="6" class="empty">No responses yet for this selection.</td></tr>';
    } catch (e) { App.showAlert(msg, e.message); }
  }

  App.$('#perfRows').addEventListener('click', async e => {
    const b = e.target.closest('button[data-id]'); if (!b) return;
    try {
      const d = await API.facultyDetail(b.dataset.id, App.$('#fSurvey').value);
      const box = App.$('#detail'), total = d.distribution.reduce((a, x) => a + x.n, 0) || 1;
      box.innerHTML = `<h2 id="dt">${E(d.faculty.name)} <span class="muted">· ${E(d.faculty.subject)}</span></h2>
        <h3>Average by question</h3>${App.bars(d.byQuestion.map(q => ({ label: q.text, value: q.avg })))}
        <h3 style="margin-top:1rem">Rating distribution</h3>
        <div class="table-wrap"><table><thead><tr><th scope="col">Rating</th><th scope="col">Count</th><th scope="col">Share</th></tr></thead><tbody>
        ${Array.from({ length: max }, (_, i) => max - i).map(r => { const n = (d.distribution.find(x => x.rating === r) || {}).n || 0; return `<tr><td>${r}</td><td>${n}</td><td>${(n / total * 100).toFixed(0)}%</td></tr>`; }).join('')}</tbody></table></div>
        <h3 style="margin-top:1rem">Anonymous comments</h3>
        ${d.comments.length ? `<ul>${d.comments.map(c => `<li>${E(c.comment)} <span class="muted small">(${E(c.question)})</span></li>`).join('')}</ul>` : '<p class="muted">No comments.</p>'}`;
      box.hidden = false; box.focus(); box.scrollIntoView({ behavior: 'smooth' });
    } catch (err) { App.toast(err.message, 'error'); }
  });
  App.$('#fSurvey').addEventListener('change', loadPerf);
  App.$('#fDept').addEventListener('change', loadPerf);
  App.$('#exportPerf').addEventListener('click', () => {
    if (!perf.length) return App.toast('Nothing to export.', 'error');
    App.downloadCSV('faculty-performance.csv', [['Faculty', 'Subject', 'Department', 'Responses', 'Average', 'Lowest', 'Highest'],
      ...perf.map(f => [f.name, f.subject, f.department, f.responses, f.avg, f.lowest, f.highest])]);
  });

  async function loadSubs() {
    const id = App.$('#sSurvey').value; if (!id) return;
    try {
      subs = await API.submissionStatus(id);
      const done = subs.students.filter(s => s.submittedAt).length;
      App.$('#subSummary').textContent = `${done} of ${subs.students.length} students have submitted.`;
      App.$('#subRows').innerHTML = subs.students.length ? subs.students.map(s => `<tr><td data-label="Roll no.">${E(s.rollNo)}</td><td data-label="Name">${E(s.name)}</td>
        <td data-label="Status">${s.submittedAt ? `<span class="badge badge-good">Submitted ${App.fmtDate(s.submittedAt)}</span>` : '<span class="badge badge-warn">Pending</span>'}</td></tr>`).join('')
        : '<tr><td colspan="3" class="empty">No students in this class.</td></tr>';
    } catch (e) { App.showAlert(msg, e.message); }
  }
  App.$('#sSurvey').addEventListener('change', loadSubs);
  App.$('#exportSub').addEventListener('click', () => {
    if (!subs) return App.toast('Nothing to export.', 'error');
    App.downloadCSV('submission-status.csv', [['Roll no.', 'Name', 'Status', 'Submitted at'], ...subs.students.map(s => [s.rollNo, s.name, s.submittedAt ? 'Submitted' : 'Pending', s.submittedAt || ''])]);
  });

  App.tabs(App.$('#tabs'), t => { if (t === 'sub' && !subs) loadSubs(); });
  loadPerf();
})();
