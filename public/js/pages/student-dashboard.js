(async () => {
  if (!(await App.init({ access: 'student', active: 'dashboard' }))) return;
  const u = API.session.user;
  App.$('#who').textContent = `${u.name} · ${u.rollNo || ''}`;
  const msg = App.$('#msg');
  try {
    const list = await API.mySurveys();
    const pending = list.filter(s => s.open && !s.submittedAt);
    const rest = list.filter(s => !(s.open && !s.submittedAt));
    App.$('#counts').innerHTML = [['Pending', pending.length], ['Completed', list.filter(s => s.submittedAt).length], ['Total', list.length]]
      .map(([l, n]) => `<div class="card stat"><span class="num">${n}</span><span class="label">${l}</span></div>`).join('');

    const card = s => `<article class="card survey-item">
      <div><h3>${App.esc(s.title)}</h3><p class="muted small" style="margin:0">${App.esc(s.description || '')}</p>
      <p class="small" style="margin:.3rem 0 0">${s.closesOn ? 'Closes ' + App.fmtDate(s.closesOn) : 'No deadline'}</p></div>
      <div class="row">${s.submittedAt ? `<span class="badge badge-good">Submitted ${App.fmtDate(s.submittedAt)}</span>`
        : s.open ? `<a class="btn btn-primary" href="take-survey.html?id=${s.id}">Start survey<span class="sr-only">: ${App.esc(s.title)}</span></a>`
        : '<span class="badge badge-grey">Closed</span>'}</div></article>`;
    App.$('#pending').innerHTML = pending.length ? pending.map(card).join('') : '<p class="empty card">You have no pending surveys.</p>';
    App.$('#done').innerHTML = rest.length ? rest.map(card).join('') : '<p class="empty card">Nothing here yet.</p>';
  } catch (e) { App.showAlert(msg, e.message); }
})();
