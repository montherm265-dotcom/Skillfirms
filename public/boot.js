// Runs before anything else. On the homepage, for someone not signed in,
// show the page's built-in top section at once (see #shell in index.html);
// the app swaps it for the live version as soon as it has loaded.
(function () {
  try {
    if (location.pathname !== "/") return;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") > 0) return;
    }
    document.documentElement.classList.add("shell");
  } catch (e) { /* storage blocked: just wait for the app */ }
})();
