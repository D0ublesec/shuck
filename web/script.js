document.getElementById('year').textContent = new Date().getFullYear();

document.querySelector('.menu-toggle')?.addEventListener('click', () => {
  const nav = document.querySelector('.nav');
  if (nav) nav.classList.toggle('open');
});

document.getElementById('themeToggle')?.addEventListener('click', () => {
  var root = document.documentElement;
  var next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('shuck-theme', next); } catch (e) {}
});
