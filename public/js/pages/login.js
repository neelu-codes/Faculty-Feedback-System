(async () => {
  const user = API.session.user;
  if (user) return location.replace(user.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html');
  if (!(await App.init({ access: 'public', active: 'login' }))) return;

  const form = App.$('#loginForm'), msg = App.$('#msg');
  const p = new URLSearchParams(location.search);
  if (p.get('expired')) App.showAlert(msg, 'Your session expired. Please log in again.', 'info');
  else if (p.get('need')) App.showAlert(msg, 'Please log in with the right account to open that page.', 'info');
  else if (p.get('registered')) App.showAlert(msg, 'Account created. You can log in now.', 'success');

  const toggle = App.$('#togglePw'), pw = App.$('#password');
  toggle.addEventListener('click', () => {
    const show = pw.type === 'password'; pw.type = show ? 'text' : 'password';
    toggle.textContent = show ? 'Hide' : 'Show'; toggle.setAttribute('aria-pressed', show);
  });

  const setErr = (id, text) => { App.$('#' + id + '-err').textContent = text; App.$('#' + id).setAttribute('aria-invalid', !!text); };
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = App.$('#email').value.trim(), password = pw.value;
    setErr('email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.');
    setErr('password', password ? '' : 'Enter your password.');
    if (form.querySelector('[aria-invalid="true"]')) return form.querySelector('[aria-invalid="true"]').focus();
    try {
      const u = await App.busy(form.querySelector('button[type=submit]'), () => API.login(email, password));
      location.href = u.role === 'admin' ? 'admin-dashboard.html' : 'student-dashboard.html';
    } catch (err) { App.showAlert(msg, err.message); msg.focus?.(); }
  });
})();
