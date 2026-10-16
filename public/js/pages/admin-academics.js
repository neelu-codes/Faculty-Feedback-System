(async () => {
  if (!(await App.init({ access: 'admin', active: 'academics' }))) return;
  const msg = App.$('#msg'), E = App.esc;
  let deps = [], classes = [], facs = [], studs = [];
  const depOpts = () => deps.map(d => ({ v: d.id, l: d.name }));
  const guard = fn => async (...a) => { try { await fn(...a); } catch (e) { App.toast(e.message, 'error'); } };

  const table = (id, head, rows, empty) => `<div class="card"><div class="table-wrap"><table class="stack"><thead><tr>${head.map(h => `<th scope="col">${h}</th>`).join('')}<th scope="col"><span class="sr-only">Actions</span></th></tr></thead>
    <tbody>${rows || `<tr><td colspan="${head.length + 1}" class="empty">${empty}</td></tr>`}</tbody></table></div></div>`;
  const acts = (kind, id, name) => `<td class="actions"><button class="btn btn-sm" data-act="edit" data-kind="${kind}" data-id="${id}">Edit<span class="sr-only"> ${E(name)}</span></button>
    <button class="btn btn-sm btn-danger" data-act="del" data-kind="${kind}" data-id="${id}">Delete<span class="sr-only"> ${E(name)}</span></button></td>`;
  const bar = (title, btn) => `<div class="row spread" style="margin-bottom:.75rem"><h2 style="margin:0">${title}</h2>${btn}</div>`;

  function render() {
    App.$('#p-dep').innerHTML = bar('Departments', '<button class="btn btn-primary" data-act="add" data-kind="dep">Add department</button>') +
      table('dep', ['Name'], deps.map(d => `<tr><td data-label="Name">${E(d.name)}</td>${acts('dep', d.id, d.name)}</tr>`).join(''), 'No departments yet.');
    App.$('#p-cls').innerHTML = bar('Classes', '<button class="btn btn-primary" data-act="add" data-kind="cls">Add class</button>') +
      table('cls', ['Class', 'Department', 'Students'], classes.map(c => `<tr><td data-label="Class">${E(c.name)}</td><td data-label="Department">${E(c.department)}</td><td data-label="Students">${c.students}</td>${acts('cls', c.id, c.name)}</tr>`).join(''), 'No classes yet.');
    App.$('#p-fac').innerHTML = bar('Faculty', '<button class="btn btn-primary" data-act="add" data-kind="fac">Add faculty</button>') +
      table('fac', ['Name', 'Subject', 'Department'], facs.map(f => `<tr><td data-label="Name">${E(f.name)}</td><td data-label="Subject">${E(f.subject)}</td><td data-label="Department">${E(f.department)}</td>${acts('fac', f.id, f.name)}</tr>`).join(''), 'No faculty yet.');
    App.$('#p-stu').innerHTML = bar('Students', `<span class="muted small">${studs.length} registered</span>`) +
      table('stu', ['Name', 'Roll no.', 'Email', 'Class'], studs.map(s => `<tr><td data-label="Name">${E(s.name)}</td><td data-label="Roll no.">${E(s.rollNo)}</td><td data-label="Email">${E(s.email)}</td><td data-label="Class">${E(s.className || '-')}</td>
        <td class="actions"><button class="btn btn-sm" data-act="reset" data-kind="stu" data-id="${s.id}">Reset password<span class="sr-only"> for ${E(s.name)}</span></button>
        <button class="btn btn-sm btn-danger" data-act="del" data-kind="stu" data-id="${s.id}">Delete<span class="sr-only"> ${E(s.name)}</span></button></td></tr>`).join(''), 'No students have registered yet.');
  }
  async function load() {
    try { [deps, classes, facs, studs] = await Promise.all([API.departments(), API.classes(), API.faculties(), API.students()]); render(); }
    catch (e) { App.showAlert(msg, e.message); }
  }

  const defs = {
    dep: { find: id => deps.find(x => x.id == id), fields: x => [{ id: 'name', label: 'Department name', value: x?.name }],
      add: v => API.addDepartment(v.name), upd: (id, v) => API.updateDepartment(id, v.name), del: id => API.deleteDepartment(id), noun: 'department',
      warn: 'This also deletes its classes and faculty.' },
    cls: { find: id => classes.find(x => x.id == id), fields: x => [{ id: 'name', label: 'Class name (e.g. MCA Semester 1)', value: x?.name }, { id: 'departmentId', label: 'Department', type: 'select', options: depOpts(), value: x?.departmentId }],
      add: v => API.addClass({ name: v.name, departmentId: +v.departmentId }), upd: (id, v) => API.updateClass(id, { name: v.name, departmentId: +v.departmentId }), del: id => API.deleteClass(id), noun: 'class',
      warn: 'Its surveys will be deleted too.' },
    fac: { find: id => facs.find(x => x.id == id), fields: x => [{ id: 'name', label: 'Faculty name', value: x?.name }, { id: 'subject', label: 'Subject', value: x?.subject }, { id: 'departmentId', label: 'Department', type: 'select', options: depOpts(), value: x?.departmentId }],
      add: v => API.addFaculty({ ...v, departmentId: +v.departmentId }), upd: (id, v) => API.updateFaculty(id, { ...v, departmentId: +v.departmentId }), del: id => API.deleteFaculty(id), noun: 'faculty member',
      warn: 'Their feedback responses will be deleted too.' },
    stu: { find: id => studs.find(x => x.id == id), del: id => API.deleteStudent(id), noun: 'student', warn: 'Their account and submission record will be removed.' }
  };

  document.addEventListener('click', guard(async e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const d = defs[b.dataset.kind], act = b.dataset.act, id = b.dataset.id, item = id && d.find(id);
    if (act === 'add' || act === 'edit') {
      if (b.dataset.kind !== 'dep' && !deps.length) return App.toast('Add a department first.', 'error');
      App.formDialog(`${act === 'add' ? 'Add' : 'Edit'} ${d.noun}`, d.fields(item), async v => {
        await (act === 'add' ? d.add(v) : d.upd(id, v)); App.toast('Saved.'); await load();
      });
    } else if (act === 'del') {
      if (await App.confirmBox(`Delete ${d.noun} "${item.name}"? ${d.warn}`)) { await d.del(id); App.toast('Deleted.'); await load(); }
    } else if (act === 'reset') {
      App.formDialog(`Reset password for ${item.name}`, [{ id: 'password', label: 'New password (8+ chars, letter and number)', type: 'password' }],
        async v => { await API.resetStudentPassword(id, v.password); App.toast('Password reset. Tell the student the new password.'); }, 'Reset');
    }
  }));
  App.tabs(App.$('#tabs'));
  load();
})();
