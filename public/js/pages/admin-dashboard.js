(async () => {
  if (!(await App.init({ access: 'admin', active: 'dashboard' }))) return;
  try {
    const s = await API.stats();
    App.$('#stats').innerHTML = [['Students', s.students], ['Faculty', s.faculties], ['Active surveys', s.activeSurveys + ' / ' + s.surveys], ['Submissions', s.submissions]]
      .map(([l, n]) => `<div class="card stat"><span class="num">${n}</span><span class="label">${l}</span></div>`).join('');
    App.$('#recent').innerHTML = s.recent.length ? s.recent.map(r => `<tr><td data-label="Survey">${App.esc(r.title)}</td><td data-label="Class">${App.esc(r.className)}</td>
      <td data-label="Responses">${r.submissions} / ${r.students}</td></tr>`).join('') : '<tr><td colspan="3" class="empty">No surveys yet.</td></tr>';
    const overview = await API.submissionOverview();
    App.$('#notSubmittedCount').innerHTML = `Registered but not submitted: <span>${overview.notSubmittedCount}</span>`;
    App.$('#submittedRows').innerHTML = overview.submitted.length ? overview.submitted.map(s => `<tr><td data-label="Roll number">${App.esc(s.rollNo)}</td>
      <td data-label="Department">${App.esc(s.department)}</td></tr>`).join('') : '<tr><td colspan="2" class="empty">No submissions yet.</td></tr>';
  } catch (e) { App.showAlert(App.$('#msg'), e.message); }
})();
