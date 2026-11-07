// Put inline in <head>, before the stylesheets load, so the first paint has the right theme: the user's saved choice,
// else the system setting. Store the choice under the same key when the user changes it.
(function () {
  try {
    var saved = localStorage.getItem('theme');
    var dark = saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  } catch (e) { document.documentElement.dataset.theme = 'light'; }
})();
