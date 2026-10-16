(async () => {
  if (!(await App.init({ access: 'admin', active: 'questions' }))) return;
  const E = App.esc, msg = App.$('#msg'); let qs = [];
  const typeOpts = [{ v: 'rating', l: 'Rating (1 to ' + App.config.ratingMax + ')' }, { v: 'text', l: 'Comment (free text)' }];
  const fields = q => [{ id: 'text', label: 'Question', value: q?.text }, { id: 'type', label: 'Type', type: 'select', options: typeOpts, value: q?.type || 'rating' },
    { id: 'category', label: 'Category (e.g. Teaching)', value: q?.category || 'General' }];

  function render() {
    App.$('#rows').innerHTML = qs.length ? qs.map(q => `<tr><td data-label="Question">${E(q.text)}</td>
      <td data-label="Type"><span class="badge ${q.type === 'rating' ? 'badge-good' : 'badge-grey'}">${q.type === 'rating' ? 'Rating' : 'Comment'}</span></td>
      <td data-label="Category">${E(q.category)}</td>
      <td class="actions"><button class="btn btn-sm" data-act="edit" data-id="${q.id}">Edit<span class="sr-only"> question</span></button>
      <button class="btn btn-sm btn-danger" data-act="del" data-id="${q.id}">Delete<span class="sr-only"> question</span></button></td></tr>`).join('')
      : '<tr><td colspan="4" class="empty">No questions found.</td></tr>';
  }
  async function load() { try { qs = await API.questions(); render(); } catch (e) { App.showAlert(msg, e.message); } }

  App.$('#addBtn').addEventListener('click', () => App.formDialog('Add question', fields(), async v => { await API.addQuestion(v); App.toast('Question added.'); load(); }));
  App.$('#rows').addEventListener('click', async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const q = qs.find(x => x.id == b.dataset.id);
    if (b.dataset.act === 'edit') App.formDialog('Edit question', fields(q), async v => { await API.updateQuestion(q.id, v); App.toast('Saved.'); load(); });
    else if (await App.confirmBox(`Delete this question? "${q.text}"`)) {
      try { await API.deleteQuestion(q.id); App.toast('Deleted.'); load(); } catch (err) { App.toast(err.message, 'error'); }
    }
  });
  load();
})();
