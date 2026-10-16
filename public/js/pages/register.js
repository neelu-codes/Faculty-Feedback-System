(async () => {
  if (API.session.user) return location.replace('index.html');
  if (!(await App.init({ access: 'public', active: 'register' }))) return;
  const c = App.config;
  App.$('#rollLabel').textContent = c.rollNoLabel || 'Roll number';
  App.$('#rollHint').textContent = c.rollNoHint || '';

  const sel = App.$('#classId'), msg = App.$('#msg'), form = App.$('#regForm');
  try {
    const classes = await API.publicClasses();
    sel.innerHTML = classes.length
      ? App.options(classes, 'id', x => `${x.name} (${x.department})`, 'Select your class')
      : '<option value="">No classes set up yet</option>';
  } catch (e) { App.showAlert(msg, e.message); }

  const setErr = (id, text) => { App.$('#' + id + '-err').textContent = text; App.$('#' + id).setAttribute('aria-invalid', !!text); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = id => App.$('#' + id).value.trim();
    setErr('name', v('name').length >= 2 ? '' : 'Enter your full name.');
    setErr('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v('email')) ? '' : 'Enter a valid email address.');
    setErr('rollNo', v('rollNo') ? '' : 'This field is required.');
    setErr('classId', v('classId') ? '' : 'Select your class.');
    const pw = App.$('#password').value;
    setErr('password', pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw) ? '' : 'Use 8+ characters with a letter and a number.');
    setErr('confirm', App.$('#confirm').value === pw ? '' : 'Passwords do not match.');
    const first = form.querySelector('[aria-invalid="true"]'); if (first) return first.focus();
    try {
      await App.busy(form.querySelector('button[type=submit]'), () =>
        API.register({ name: v('name'), email: v('email'), rollNo: v('rollNo'), classId: Number(v('classId')), password: pw }));
      location.href = 'login.html?registered=1';
    } catch (err) { App.showAlert(msg, err.message); }
  });
})();
