(function () {
  "use strict";

  var MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  // event types
  var VALID_TYPES = ["meeting", "guest", "social"];

  var root = document.querySelector("[data-calendar]");
  if (!root) return;

  var titleEl = root.querySelector("[data-calendar-title]");
  var gridEl = root.querySelector("[data-calendar-grid]");
  var noteEl = root.querySelector("[data-calendar-note]");
  var prevBtn = root.querySelector("[data-calendar-prev]");
  var nextBtn = root.querySelector("[data-calendar-next]");
  var todayBtn = root.querySelector("[data-calendar-today]");
  var locationEl = document.querySelector("[data-calendar-location]");

  var scriptEl = document.currentScript;
  var dataUrl = scriptEl
    ? new URL("events.json", scriptEl.src).href
    : "assets/events.json";

  var byDate = Object.create(null); // "YYYY-MM-DD" -> [event, ...]
  var eventDates = []; // sorted list of date keys that have events

  var now = new Date();
  var todayKey = dateKey(now.getFullYear(), now.getMonth(), now.getDate());
  var view = { year: now.getFullYear(), month: now.getMonth() };

  
  // helpers
  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function dateKey(year, month, day) {
    return year + "-" + pad2(month + 1) + "-" + pad2(day);
  }

  function daysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  function longDate(year, month, day) {
    return new Date(year, month, day).toLocaleDateString(undefined, {
      weekday: "long", month: "long", day: "numeric"
    });
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // loading
  function load() {
    fetch(dataUrl, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.json();
      })
      .then(function (data) {
        index(data && data.events);
        if (locationEl && data && data.meetingLocation) {
          locationEl.textContent = data.meetingLocation;
        }
        openInitialMonth();
        render();
      })
      .catch(showLoadError);
  }

  function index(events) {
    if (!Array.isArray(events)) return;

    events.forEach(function (event) {
      if (!event || typeof event.date !== "string") return;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(event.date)) return;

      if (!byDate[event.date]) byDate[event.date] = [];
      byDate[event.date].push(event);
    });

    eventDates = Object.keys(byDate).sort();
  }

  function openInitialMonth() {
    if (monthHasEvents(view.year, view.month)) return;

    var next = firstDateOnOrAfter(todayKey);
    if (!next) return;

    view.year = Number(next.slice(0, 4));
    view.month = Number(next.slice(5, 7)) - 1;
  }

  function monthHasEvents(year, month) {
    var prefix = year + "-" + pad2(month + 1) + "-";
    return eventDates.some(function (key) {
      return key.indexOf(prefix) === 0;
    });
  }

  function firstDateOnOrAfter(key) {
    for (var i = 0; i < eventDates.length; i++) {
      if (eventDates[i] >= key) return eventDates[i];
    }
    return null;
  }

  function showLoadError(err) {
    if (window.console) window.console.error("[BPM calendar]", err);
    if (!noteEl) return;

    noteEl.textContent =
      "Couldn't load the event list. If you're previewing this page straight " +
      "from your hard drive, run it through a local server instead (see README).";
    noteEl.hidden = false;
  }

  // rendering
  function render() {
    renderTitle();
    renderGrid();
    renderNote();
  }

  function renderTitle() {
    if (!titleEl) return;
    titleEl.textContent = MONTH_NAMES[view.month] + " ";
    titleEl.appendChild(el("span", "calendar-year", String(view.year)));
  }

  function renderGrid() {
    if (!gridEl) return;
    gridEl.textContent = "";

    var total = daysInMonth(view.year, view.month);
    var startCol = new Date(view.year, view.month, 1).getDay(); // 0 = Sunday
    var weeks = Math.ceil((startCol + total) / 7);
    var day = 1;

    for (var w = 0; w < weeks; w++) {
      var row = document.createElement("tr");

      for (var col = 0; col < 7; col++) {
        var isPadding = (w === 0 && col < startCol) || day > total;
        row.appendChild(isPadding ? emptyCell() : dayCell(day++));
      }

      gridEl.appendChild(row);
    }
  }

  function emptyCell() {
    var cell = document.createElement("td");
    cell.className = "is-empty";
    return cell;
  }

  function dayCell(day) {
    var cell = document.createElement("td");
    var key = dateKey(view.year, view.month, day);

    if (key === todayKey) cell.className = "is-today";
    cell.appendChild(el("span", "calendar-day", pad2(day)));

    (byDate[key] || []).forEach(function (event) {
      cell.appendChild(eventPill(event, day));
    });

    return cell;
  }

  function eventPill(event, day) {
    var type = VALID_TYPES.indexOf(event.type) > -1 ? event.type : "meeting";
    var isLink = typeof event.url === "string" && event.url !== "";
    var pill = document.createElement(isLink ? "a" : "span");

    pill.className = "event event--" + type;
    if (isLink) pill.href = event.url;

    pill.appendChild(
      el("span", "visually-hidden", longDate(view.year, view.month, day) + ": ")
    );
    pill.appendChild(document.createTextNode(event.title || "Event"));

    if (event.time) {
      pill.appendChild(el("span", "event-time", event.time));
    }

    pill.title = [
      longDate(view.year, view.month, day),
      event.title,
      event.time,
      event.location
    ].filter(Boolean).join(" · ");

    return pill;
  }

  function renderNote() {
    if (!noteEl) return;

    noteEl.textContent = "";
    noteEl.hidden = true;

    if (monthHasEvents(view.year, view.month)) return;

    noteEl.hidden = false;
    noteEl.appendChild(
      document.createTextNode(
        "Nothing scheduled for " + MONTH_NAMES[view.month] + " " + view.year + "."
      )
    );

    var lastOfMonth = dateKey(
      view.year, view.month, daysInMonth(view.year, view.month)
    );
    var upcoming = firstDateOnOrAfter(lastOfMonth) ||
      firstDateOnOrAfter(todayKey);

    if (!upcoming || upcoming <= lastOfMonth) return;

    var year = Number(upcoming.slice(0, 4));
    var month = Number(upcoming.slice(5, 7)) - 1;
    var jump = el(
      "button", "calendar-jump", "Jump to " + MONTH_NAMES[month] + " " + year
    );

    jump.type = "button";
    jump.addEventListener("click", function () {
      view.year = year;
      view.month = month;
      render();
    });

    noteEl.appendChild(jump);
  }

  // controls 
  function shiftMonth(delta) {
    var next = new Date(view.year, view.month + delta, 1);
    view.year = next.getFullYear();
    view.month = next.getMonth();
    render();
  }

  if (prevBtn) {
    prevBtn.addEventListener("click", function () { shiftMonth(-1); });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () { shiftMonth(1); });
  }

  if (todayBtn) {
    todayBtn.addEventListener("click", function () {
      view.year = now.getFullYear();
      view.month = now.getMonth();
      render();
    });
  }

  render(); // draw the empty grid immediately, then fill it in
  load();
})();
