(async () => {
  if (!(await App.init({ access: 'public', active: 'home' }))) return;
  const t = document.getElementById('tagline');
  if (App.config.tagline) t.textContent = App.config.tagline;
})();
