(async () => {
  if (!(await App.init({ access: 'student', active: 'dashboard' }))) return;
  const id = Number(new URLSearchParams(location.search).get('id'));
  const msg = App.$('#msg'), form = App.$('#surveyForm');
  let survey;
  try { survey = await API.survey(id); } catch (e) { return App.showAlert(msg, e.message); }
  if (!survey.open) return App.showAlert(msg, 'This survey is closed.', 'info');

  const max = App.config.ratingMax, labels = App.config.ratingLabels || [];
  const rated = survey.questions.filter(q => q.type === 'rating');
  const total = rated.length * survey.faculties.length;

  App.$('#head').innerHTML = `<h1>${App.esc(survey.title)}</h1><p class="muted">${App.esc(survey.description)}</p>
    <div class="alert alert-info">Your answers are anonymous. Rate from 1 (${App.esc(labels[0] || 'lowest')}) to ${max} (${App.esc(labels[max - 1] || 'highest')}).</div>`;

  form.innerHTML = survey.faculties.map(f => `<fieldset class="card faculty-block"><legend>${App.esc(f.name)} <span class="muted">— ${App.esc(f.subject)}</span></legend>
    ${survey.questions.map(q => q.type === 'rating' ? `
      <fieldset class="rating-group" data-f="${f.id}" data-q="${q.id}"><legend>${App.esc(q.text)}</legend>
        ${Array.from({ length: max }, (_, i) => i + 1).map(n => `<label class="rate-opt"><input type="radio" name="r-${f.id}-${q.id}" value="${n}" required><span>${n}<span class="sr-only"> out of ${max}${labels[n - 1] ? ', ' + App.esc(labels[n - 1]) : ''}</span></span></label>`).join('')}
      </fieldset>` : `
      <div class="field"><label for="c-${f.id}-${q.id}">${App.esc(q.text)}</label>
        <textarea id="c-${f.id}-${q.id}" maxlength="500" data-f="${f.id}" data-q="${q.id}"></textarea></div>`).join('')}
  </fieldset>`).join('') + `<button class="btn btn-primary btn-block" type="submit">Submit feedback</button>`;
  form.hidden = false; App.$('#progressWrap').hidden = false;

  const update = () => {
    const done = App.$$('.rating-group', form).filter(g => g.querySelector('input:checked')).length;
    App.$('#progressText').textContent = `${done} of ${total} ratings completed`;
    App.$('#progressBar').style.width = (total ? done / total * 100 : 100) + '%';
  };
  form.addEventListener('change', update); update();

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const missing = App.$$('.rating-group', form).find(g => !g.querySelector('input:checked'));
    if (missing) {
      App.showAlert(msg, 'Please answer every rating question. The first unanswered one is highlighted.');
      missing.scrollIntoView({ block: 'center' }); missing.querySelector('input').focus(); return;
    }
    if (!(await App.confirmBox('Submit your feedback? You cannot change it afterwards.', 'Submit'))) return;
    const answers = [
      ...App.$$('.rating-group', form).map(g => ({ facultyId: +g.dataset.f, questionId: +g.dataset.q, rating: +g.querySelector('input:checked').value })),
      ...App.$$('textarea', form).map(t => ({ facultyId: +t.dataset.f, questionId: +t.dataset.q, comment: t.value.trim() }))
    ];
    try {
      await App.busy(form.querySelector('button[type=submit]'), () => API.submitSurvey(id, answers));
      form.hidden = true; App.$('#progressWrap').hidden = true; App.$('#head').hidden = true; msg.hidden = true;
      const t = App.$('#thanks'); t.hidden = false; t.querySelector('h2').tabIndex = -1; t.querySelector('h2').focus();
    } catch (err) { App.showAlert(msg, err.message); window.scrollTo({ top: 0, behavior: 'smooth' }); }
  });
})();
