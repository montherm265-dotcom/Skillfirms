// Runs before anything else. For someone not signed in, the homepage and the
// Courses page show their built-in version at once (#shell in index.html);
// the app swaps it for the live version as soon as it has loaded. The
// Courses page also asks for its courses right away, for everyone (the app
// reuses the answer; scripts/shell-courses.src.js draws them first).
(function () {
  try {
    var path = location.pathname.replace(/\/+$/, "") || "/";
    var courses = path === "/courses" && !location.search;
    if (path !== "/" && !courses) return;
    var url = "%%SUPABASE_URL%%", key = "%%SUPABASE_ANON_KEY%%";
    if (courses && url.indexOf("https://") === 0) {
      var w = (window.__catalog = {});
      w.promise = fetch(url + "/rest/v1/skillfirms_courses?status=eq.published&select=" + encodeURIComponent("%%CATALOG_SELECT%%") + "&apikey=" + encodeURIComponent(key))
        .then(function (r) { if (!r.ok) throw new Error("courses " + r.status); return r.json(); });
      w.promise.catch(function () {});
    }
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("sb-") === 0 && k.indexOf("-auth-token") > 0) return;
    }
    if (courses && !window.__catalog) return;
    document.documentElement.classList.add("shell", courses ? "shell-courses" : "shell-home");
  } catch (e) { /* storage blocked: just wait for the app */ }
})();
