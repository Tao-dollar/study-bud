/* ===== Nudge · landing.js: the live demo card in the hero ===== */
(function () {
  Nudge.ui.initTheme();

  const items = [
    { what: "Read MTH201, integration by parts", when: "Tonight, 8:00 PM · 45 min" },
    { what: "CSC201 assignment due", when: "Thursday, 11:59 PM" },
    { what: "Revise GST201 past questions", when: "Saturday, 10:00 AM · 1 hr" }
  ];

  const list = document.getElementById("demo-list");
  const note = document.getElementById("demo-note");
  const head = document.getElementById("demo-greeting");
  if (!list) return;

  head.textContent = Nudge.copy.greeting("");
  list.innerHTML = items.map(function (it, i) {
    return '<li class="demo-item">' +
      '<input type="checkbox" id="demo-' + i + '">' +
      '<label for="demo-' + i + '"><span class="what">' + Nudge.ui.esc(it.what) + '</span>' +
      '<span class="when">' + Nudge.ui.esc(it.when) + '</span></label></li>';
  }).join("");

  function update() {
    const boxes = list.querySelectorAll("input");
    const done = list.querySelectorAll("input:checked").length;
    note.textContent = Nudge.copy.progress(done / boxes.length);
  }
  list.addEventListener("change", update);
  update();

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();
})();
