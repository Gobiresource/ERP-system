// Put inline in <head>, before the stylesheets load, so the first paint has the right theme. Light is the look everyone
// starts with; dark comes only when the person chose it. The device's own dark setting is not followed. Store the
// choice under the same key when the person changes it.
(function () {
  var dark = false;
  try { dark = localStorage.getItem('theme') === 'dark'; } catch (e) {}
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
})();
