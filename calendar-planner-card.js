/**
 * calendar-planner-card
 * Gezinsagenda en taken in één tijdlijn (vanilla HTMLElement, geen Lit).
 */
(function (global) {
  "use strict";

  var TZ_DEFAULT = "Europe/Brussels";
  var CACHE_MS = 60000;

  var DEFAULT_CONFIG = {
    title: "Planner",
    calendars: [],
    todos: [],
    days: 14,
  };

  var CSS = [
    ":host { display: block; }",
    "ha-card { padding: 0; overflow: hidden; position: relative; background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121); }",
    ".cpc-header { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 10px 14px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12)); }",
    ".cpc-title { font-size: 16px; font-weight: 600; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".cpc-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }",
    ".cpc-actions button, .cpc-btn { border: 0; background: transparent; color: var(--primary-text-color, #212121); cursor: pointer; font: inherit; font-size: 13px; padding: 4px 8px; border-radius: 6px; }",
    ".cpc-actions button.active, .cpc-btn.primary { background: var(--primary-color, #03a9f4); color: var(--text-primary-color, #fff); }",
    ".cpc-actions button:hover, .cpc-btn:hover { background: var(--secondary-background-color, #f5f5f5); }",
    ".cpc-actions button.active:hover, .cpc-btn.primary:hover { background: var(--primary-color, #03a9f4); }",
    ".cpc-body { padding: 8px 0 12px; }",
    ".cpc-status { padding: 16px; color: var(--secondary-text-color, #727272); }",
    ".cpc-day { padding: 6px 14px 10px; }",
    ".cpc-day + .cpc-day { border-top: 1px solid var(--divider-color, rgba(0,0,0,.08)); }",
    ".cpc-day-label { font-size: 12px; font-weight: 600; text-transform: none; color: var(--secondary-text-color, #727272); margin: 4px 0 6px; }",
    ".cpc-item { display: flex; align-items: center; gap: 8px; padding: 4px 0; min-height: 28px; }",
    ".cpc-item.overdue .cpc-item-title, .cpc-badge { color: var(--error-color, #d93025); }",
    ".cpc-time { font-variant-numeric: tabular-nums; font-size: 12px; color: var(--secondary-text-color, #727272); min-width: 42px; flex-shrink: 0; }",
    ".cpc-item-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".cpc-badge { font-size: 11px; font-weight: 600; flex-shrink: 0; }",
    ".cpc-check { width: 16px; height: 16px; flex-shrink: 0; }",
    ".cpc-trash { opacity: .55; font-size: 14px; line-height: 1; padding: 2px 6px; }",
    ".cpc-section { margin: 8px 14px 0; border: 1px solid var(--divider-color, rgba(0,0,0,.12)); border-radius: 8px; }",
    ".cpc-section-head { display: flex; width: 100%; align-items: center; justify-content: space-between; padding: 8px 10px; background: transparent; border: 0; cursor: pointer; font: inherit; color: inherit; }",
    ".cpc-section-body { padding: 0 10px 8px; }",
    ".cpc-add { margin: 12px 14px 0; padding: 10px; border-top: 1px solid var(--divider-color, rgba(0,0,0,.08)); display: flex; flex-direction: column; gap: 6px; }",
    ".cpc-add-label { font-size: 12px; font-weight: 600; color: var(--secondary-text-color, #727272); }",
    ".cpc-add input, .cpc-add select, .cpc-editor input, .cpc-editor textarea { font: inherit; padding: 6px 8px; border: 1px solid var(--divider-color, rgba(0,0,0,.2)); border-radius: 6px; background: var(--card-background-color, #fff); color: inherit; }",
    ".cpc-add-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }",
    ".cpc-month-head { display: flex; justify-content: center; padding: 4px 14px 8px; font-weight: 600; }",
    ".cpc-weekdays, .cpc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 0 10px; }",
    ".cpc-weekdays span { text-align: center; font-size: 11px; color: var(--secondary-text-color, #727272); padding: 4px 0; }",
    ".cpc-cell { min-height: 44px; border-radius: 8px; padding: 4px 2px; text-align: center; cursor: pointer; background: transparent; border: 0; color: inherit; font: inherit; }",
    ".cpc-cell.out { opacity: .35; }",
    ".cpc-cell.today { background: color-mix(in srgb, var(--primary-color, #03a9f4) 18%, transparent); font-weight: 700; }",
    ".cpc-cell-num { font-size: 13px; }",
    ".cpc-dots { display: flex; justify-content: center; gap: 2px; min-height: 6px; margin-top: 2px; }",
    ".cpc-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--primary-color, #03a9f4); }",
    ".cpc-overlay { position: absolute; inset: 0; background: color-mix(in srgb, var(--card-background-color, #fff) 92%, #000 8%); display: flex; flex-direction: column; z-index: 2; }",
    ".cpc-overlay-head { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-bottom: 1px solid var(--divider-color, rgba(0,0,0,.12)); font-weight: 600; }",
    ".cpc-overlay-body { overflow: auto; padding: 8px 14px 16px; flex: 1; }",
    ".cpc-confirm { position: absolute; inset: 0; background: rgba(0,0,0,.35); display: flex; align-items: center; justify-content: center; z-index: 3; }",
    ".cpc-confirm-box { background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121); padding: 16px; border-radius: 10px; min-width: 200px; box-shadow: 0 8px 24px rgba(0,0,0,.2); }",
    ".cpc-confirm-box p { margin: 0 0 12px; }",
    ".cpc-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }",
    ".cpc-editor { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }",
    ".cpc-editor label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }",
  ].join("\n");

  function pad2(n) {
    return n < 10 ? "0" + n : String(n);
  }

  function brusselsDayKey(input, timeZone) {
    if (input == null || input === "") return null;
    if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    var d = input instanceof Date ? input : new Date(input);
    if (isNaN(d.getTime())) return null;
    var tz = timeZone || TZ_DEFAULT;
    var parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(d);
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    return map.year + "-" + map.month + "-" + map.day;
  }

  function parseDateOnly(s) {
    return new Date(s + "T12:00:00Z");
  }

  function parseDue(due) {
    if (due == null || due === "") return null;
    if (typeof due === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(due)) return parseDateOnly(due);
      var d = new Date(due);
      return isNaN(d.getTime()) ? null : d;
    }
    if (typeof due === "object") {
      if (due.date) return parseDue(due.date);
      if (due.dateTime) return parseDue(due.dateTime);
    }
    return null;
  }

  function parseEventStart(start) {
    if (start == null || start === "") return null;
    if (typeof start === "string") return parseDue(start);
    if (typeof start === "object") {
      if (start.dateTime) return parseDue(start.dateTime);
      if (start.date) return parseDue(start.date);
    }
    return null;
  }

  function formatTime(date, timeZone) {
    if (date == null) return "";
    var d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return "";
    var tz = timeZone || TZ_DEFAULT;
    var parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(d);
    var map = {};
    for (var i = 0; i < parts.length; i++) map[parts[i].type] = parts[i].value;
    return (map.hour || "00") + ":" + (map.minute || "00");
  }

  function isEvent(item) {
    if (!item) return false;
    if (item._kind === "event") return true;
    if (item._kind === "task") return false;
    return !!item.start;
  }

  function mixDayItems(items) {
    var list = Array.isArray(items) ? items : [];
    var events = [];
    var tasks = [];
    for (var i = 0; i < list.length; i++) {
      if (isEvent(list[i])) events.push(list[i]);
      else tasks.push(list[i]);
    }
    return events.concat(tasks);
  }

  function itemDayKey(item, timeZone) {
    if (!item) return null;
    if (isEvent(item)) {
      var start = parseEventStart(item.start);
      return start ? brusselsDayKey(start, timeZone) : null;
    }
    var due = parseDue(item.due);
    return due ? brusselsDayKey(due, timeZone) : null;
  }

  function groupItemsByDay(items, opts) {
    var tz = (opts && opts.timeZone) || TZ_DEFAULT;
    var byKey = Object.create(null);
    var undated = [];
    var list = Array.isArray(items) ? items : [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var key = itemDayKey(item, tz);
      if (!key) {
        undated.push(item);
        continue;
      }
      if (!byKey[key]) byKey[key] = [];
      byKey[key].push(item);
    }
    var keys = Object.keys(byKey).sort();
    var days = [];
    for (var k = 0; k < keys.length; k++) {
      days.push({ key: keys[k], items: mixDayItems(byKey[keys[k]]) });
    }
    return { days: days, undated: undated };
  }

  function isOverdue(item, now, timeZone) {
    if (!item) return false;
    if (item.status === "completed") return false;
    if (item.status !== "needs_action") return false;
    var due = parseDue(item.due);
    if (!due) return false;
    var tz = timeZone || TZ_DEFAULT;
    var dueKey = brusselsDayKey(due, tz);
    var todayKey = brusselsDayKey(now || new Date(), tz);
    if (!dueKey || !todayKey) return false;
    return dueKey < todayKey;
  }

  function addDaysToKey(key, n) {
    var p = key.split("-");
    var dt = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n));
    return dt.getUTCFullYear() + "-" + pad2(dt.getUTCMonth() + 1) + "-" + pad2(dt.getUTCDate());
  }

  function formatDayLabel(key, todayKey) {
    if (key === todayKey) return "Vandaag";
    if (key === addDaysToKey(todayKey, 1)) return "Morgen";
    var d = parseDateOnly(key);
    var raw = new Intl.DateTimeFormat("nl-BE", {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(d);
    return raw ? raw.charAt(0).toUpperCase() + raw.slice(1) : key;
  }

  function h(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null && text !== "") el.textContent = text;
    return el;
  }

  function parseIdLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(function (s) {
        return s.trim();
      })
      .filter(Boolean);
  }

  function monthCells(year, month) {
    var first = new Date(Date.UTC(year, month, 1, 12));
    var offset = (first.getUTCDay() + 6) % 7;
    var cells = [];
    for (var i = 0; i < 42; i++) {
      var dt = new Date(Date.UTC(year, month, 1 - offset + i, 12));
      cells.push({
        key: dt.toISOString().slice(0, 10),
        inMonth: dt.getUTCMonth() === month,
        day: dt.getUTCDate(),
      });
    }
    return cells;
  }

  class CalendarPlannerCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = Object.assign({}, DEFAULT_CONFIG);
      this._hass = null;
      this._events = [];
      this._tasks = [];
      this._loading = false;
      this._error = false;
      this._lastFetch = 0;
      this._entityFingerprint = "";
      this._view = "timeline";
      this._undatedOpen = true;
      this._selectedDay = null;
      this._confirmItem = null;
      this._addTitle = "";
      this._addDue = "";
      this._addList = "";
      this._monthOffset = 0;
    }

    static getConfigElement() {
      return document.createElement("calendar-planner-card-editor");
    }

    static getStubConfig() {
      return {
        title: "Planner",
        calendars: ["calendar.gezin_2", "calendar.jarvisub69_gmail_com"],
        todos: ["todo.gezin_actief", "todo.gezin"],
        days: 14,
      };
    }

    getCardSize() {
      return 6;
    }

    setConfig(config) {
      if (!config) throw new Error("Configuratie ontbreekt");
      this._config = Object.assign({}, DEFAULT_CONFIG, config);
      if (!Array.isArray(this._config.calendars)) this._config.calendars = [];
      if (!Array.isArray(this._config.todos)) this._config.todos = [];
      if (!this._config.days) this._config.days = 14;
      if (this._hass) {
        this._lastFetch = 0;
        this._fetchAll();
      } else {
        this._render();
      }
    }

    set hass(hass) {
      var prev = this._hass;
      this._hass = hass;
      if (!this._config) return;
      var now = Date.now();
      var stale = !this._lastFetch || now - this._lastFetch > CACHE_MS;
      var fp = this._fingerprint(hass);
      var changed = fp !== this._entityFingerprint;
      this._entityFingerprint = fp;
      if (!prev || stale || changed) this._fetchAll();
    }

    get hass() {
      return this._hass;
    }

    _timeZone() {
      var tz = this._hass && this._hass.config && this._hass.config.time_zone;
      return tz || TZ_DEFAULT;
    }

    _fingerprint(hass) {
      var ids = [].concat(this._config.calendars || [], this._config.todos || []);
      var parts = [];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var s = hass && hass.states && hass.states[id];
        parts.push(id + ":" + (s ? String(s.state) + ":" + String(s.last_updated || s.last_changed || "") : ""));
      }
      return parts.join("|");
    }

    _allItems() {
      return this._events.concat(this._tasks);
    }

    async _fetchAll() {
      if (!this._hass) return;
      this._lastFetch = Date.now();
      this._loading = true;
      this._error = false;
      this._render();
      var days = this._config.days || 14;
      var now = new Date();
      var start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      var end = new Date(now.getTime() + Math.max(days, 42) * 24 * 60 * 60 * 1000);
      var startIso = start.toISOString();
      var endIso = end.toISOString();
      var anyOk = false;
      var anyErr = false;
      var events = [];
      var tasks = [];
      var calendars = this._config.calendars || [];
      var todos = this._config.todos || [];
      for (var i = 0; i < calendars.length; i++) {
        var cid = calendars[i];
        if (!cid) continue;
        try {
          var path = "calendars/" + cid + "?start=" + startIso + "&end=" + endIso;
          var resp = await this._hass.callApi("GET", path);
          if (Array.isArray(resp)) {
            for (var j = 0; j < resp.length; j++) {
              events.push(Object.assign({}, resp[j], { _kind: "event", _source: cid }));
            }
          }
          anyOk = true;
        } catch (e) {
          anyErr = true;
        }
      }
      for (var t = 0; t < todos.length; t++) {
        var tid = todos[t];
        if (!tid) continue;
        try {
          var ws = await this._hass.callWS({ type: "todo/item/list", entity_id: tid });
          var items = (ws && ws.items) || [];
          for (var u = 0; u < items.length; u++) {
            var it = items[u];
            if (it.status === "completed") continue;
            tasks.push(Object.assign({}, it, { _kind: "task", _source: tid }));
          }
          anyOk = true;
        } catch (e2) {
          anyErr = true;
        }
      }
      this._events = events;
      this._tasks = tasks;
      this._error = anyErr && !anyOk;
      this._loading = false;
      this._lastFetch = Date.now();
      this._render();
    }

    async _mutate(service, data) {
      if (!this._hass) return;
      await this._hass.callService("todo", service, data);
      this._lastFetch = 0;
      await this._fetchAll();
    }

    _render() {
      var root = this.shadowRoot;
      if (!root) return;
      while (root.firstChild) root.removeChild(root.firstChild);
      var style = document.createElement("style");
      style.textContent = CSS;
      root.appendChild(style);
      var card = h("ha-card");
      card.appendChild(this._renderHeader());
      var body = h("div", "cpc-body");
      if (this._loading && !this._events.length && !this._tasks.length) {
        body.appendChild(h("div", "cpc-status", "Laden…"));
      } else if (this._error) {
        body.appendChild(h("div", "cpc-status", "Kon gegevens niet laden"));
      } else if (this._view === "month") {
        body.appendChild(this._renderMonth());
      } else {
        body.appendChild(this._renderTimeline());
      }
      card.appendChild(body);
      if (this._view === "month" && this._selectedDay) {
        card.appendChild(this._renderDayOverlay());
      }
      if (this._confirmItem) {
        card.appendChild(this._renderConfirm());
      }
      root.appendChild(card);
    }

    _renderHeader() {
      var header = h("div", "cpc-header");
      header.appendChild(h("div", "cpc-title", this._config.title || "Planner"));
      var actions = h("div", "cpc-actions");
      var self = this;
      var tl = h("button", this._view === "timeline" ? "active" : "", "Tijdlijn");
      tl.type = "button";
      tl.addEventListener("click", function () {
        self._view = "timeline";
        self._selectedDay = null;
        self._render();
      });
      var mo = h("button", this._view === "month" ? "active" : "", "Maand");
      mo.type = "button";
      mo.addEventListener("click", function () {
        self._view = "month";
        self._render();
      });
      var rf = h("button", "", "↻");
      rf.type = "button";
      rf.title = "Vernieuwen";
      rf.addEventListener("click", function () {
        self._lastFetch = 0;
        self._fetchAll();
      });
      actions.appendChild(tl);
      actions.appendChild(mo);
      actions.appendChild(rf);
      header.appendChild(actions);
      return header;
    }

    _grouped(tz) {
      return groupItemsByDay(this._allItems(), { timeZone: tz });
    }

    _itemsByKey(tz) {
      var grouped = this._grouped(tz);
      var map = Object.create(null);
      for (var i = 0; i < grouped.days.length; i++) {
        map[grouped.days[i].key] = grouped.days[i].items;
      }
      return { map: map, undated: grouped.undated };
    }

    _renderTimeline() {
      var wrap = h("div", "cpc-timeline");
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var days = this._config.days || 14;
      var packed = this._itemsByKey(tz);
      var keys = [];
      var seen = Object.create(null);
      var k;
      for (k in packed.map) {
        if (k < todayKey) {
          var pastItems = packed.map[k];
          var hasOverdue = false;
          for (var p = 0; p < pastItems.length; p++) {
            if (isOverdue(pastItems[p], now, tz)) {
              hasOverdue = true;
              break;
            }
          }
          if (hasOverdue) {
            keys.push(k);
            seen[k] = true;
          }
        }
      }
      keys.sort();
      for (var i = 0; i < days; i++) {
        var key = addDaysToKey(todayKey, i);
        if (!seen[key]) {
          keys.push(key);
          seen[key] = true;
        }
      }
      var shown = 0;
      for (var d = 0; d < keys.length; d++) {
        var dayKey = keys[d];
        var items = packed.map[dayKey] || [];
        if (!items.length && dayKey !== todayKey && dayKey > todayKey) continue;
        if (!items.length && dayKey !== todayKey) continue;
        shown += 1;
        wrap.appendChild(this._renderDay(dayKey, items, todayKey, tz, now));
      }
      if (!shown && !packed.undated.length) {
        wrap.appendChild(h("div", "cpc-status", "Niets gepland"));
      }
      wrap.appendChild(this._renderUndated(packed.undated, tz, now));
      wrap.appendChild(this._renderAddForm());
      return wrap;
    }

    _renderDay(dayKey, items, todayKey, tz, now) {
      var section = h("div", "cpc-day");
      section.appendChild(h("div", "cpc-day-label", formatDayLabel(dayKey, todayKey)));
      if (!items.length) {
        section.appendChild(h("div", "cpc-status", "Niets gepland"));
        return section;
      }
      for (var i = 0; i < items.length; i++) {
        section.appendChild(this._renderItem(items[i], tz, now));
      }
      return section;
    }

    _renderItem(item, tz, now) {
      var row = h("div", "cpc-item");
      var overdue = !isEvent(item) && isOverdue(item, now, tz);
      if (overdue) row.className = "cpc-item overdue";
      var self = this;
      if (isEvent(item)) {
        var start = parseEventStart(item.start);
        var allDay = !!(item.start && item.start.date && !item.start.dateTime);
        row.appendChild(h("span", "cpc-time", allDay || !start ? "" : formatTime(start, tz)));
        row.appendChild(h("span", "cpc-item-title", item.summary || ""));
      } else {
        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "cpc-check";
        cb.checked = item.status === "completed";
        if (item.uid) cb.setAttribute("data-uid", item.uid);
        cb.addEventListener("change", function () {
          self._mutate("update_item", {
            entity_id: item._source,
            item: item.uid,
            status: cb.checked ? "completed" : "needs_action",
          });
        });
        row.appendChild(cb);
        row.appendChild(h("span", "cpc-item-title", item.summary || ""));
        if (overdue) row.appendChild(h("span", "cpc-badge", "Te laat"));
        var trash = h("button", "cpc-btn cpc-trash", "🗑");
        trash.type = "button";
        trash.title = "Verwijderen";
        trash.addEventListener("click", function () {
          self._confirmItem = item;
          self._render();
        });
        row.appendChild(trash);
        this._bindSwipe(row, item);
      }
      return row;
    }

    _bindSwipe(row, item) {
      var self = this;
      var startX = null;
      row.addEventListener("touchstart", function (ev) {
        if (ev.changedTouches && ev.changedTouches[0]) startX = ev.changedTouches[0].clientX;
      }, { passive: true });
      row.addEventListener("touchend", function (ev) {
        if (startX == null || !ev.changedTouches || !ev.changedTouches[0]) return;
        var dx = ev.changedTouches[0].clientX - startX;
        startX = null;
        if (dx < -60) {
          self._confirmItem = item;
          self._render();
        }
      }, { passive: true });
    }

    _renderUndated(items, tz, now) {
      var box = h("div", "cpc-section");
      var self = this;
      var head = h("button", "cpc-section-head");
      head.type = "button";
      head.appendChild(h("span", "", "Zonder datum"));
      head.appendChild(h("span", "", this._undatedOpen ? "▾" : "▸"));
      head.addEventListener("click", function () {
        self._undatedOpen = !self._undatedOpen;
        self._render();
      });
      box.appendChild(head);
      if (this._undatedOpen) {
        var body = h("div", "cpc-section-body");
        if (!items.length) {
          body.appendChild(h("div", "cpc-status", "Niets gepland"));
        } else {
          for (var i = 0; i < items.length; i++) {
            body.appendChild(this._renderItem(items[i], tz, now));
          }
        }
        box.appendChild(body);
      }
      return box;
    }

    _renderAddForm() {
      var form = h("div", "cpc-add");
      form.appendChild(h("div", "cpc-add-label", "Nieuwe taak"));
      var self = this;
      var title = document.createElement("input");
      title.type = "text";
      title.placeholder = "Nieuwe taak";
      title.value = this._addTitle;
      title.addEventListener("input", function () {
        self._addTitle = title.value;
      });
      form.appendChild(title);
      var row = h("div", "cpc-add-row");
      var due = document.createElement("input");
      due.type = "date";
      due.value = this._addDue;
      due.setAttribute("aria-label", "Vervaldatum");
      due.addEventListener("input", function () {
        self._addDue = due.value;
      });
      row.appendChild(h("span", "", "Vervaldatum"));
      row.appendChild(due);
      var todos = this._config.todos || [];
      var listSel = null;
      if (todos.length > 1) {
        listSel = document.createElement("select");
        for (var i = 0; i < todos.length; i++) {
          var opt = document.createElement("option");
          opt.value = todos[i];
          opt.textContent = todos[i];
          if ((this._addList || todos[0]) === todos[i]) opt.selected = true;
          listSel.appendChild(opt);
        }
        listSel.addEventListener("change", function () {
          self._addList = listSel.value;
        });
        row.appendChild(listSel);
      }
      var addBtn = h("button", "cpc-btn primary", "Toevoegen");
      addBtn.type = "button";
      addBtn.addEventListener("click", function () {
        var name = (self._addTitle || "").trim();
        if (!name || !todos.length) return;
        var entity = self._addList || todos[0];
        var data = { entity_id: entity, item: name };
        if (self._addDue) data.due_date = self._addDue;
        self._addTitle = "";
        self._addDue = "";
        self._mutate("add_item", data);
      });
      row.appendChild(addBtn);
      form.appendChild(row);
      return form;
    }

    _renderMonth() {
      var wrap = h("div", "cpc-month");
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var parts = todayKey.split("-").map(Number);
      var year = parts[0];
      var month = parts[1] - 1 + (this._monthOffset || 0);
      var cursor = new Date(Date.UTC(year, month, 1));
      var cy = cursor.getUTCFullYear();
      var cm = cursor.getUTCMonth();
      var monthName = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric", timeZone: "UTC" }).format(cursor);
      wrap.appendChild(h("div", "cpc-month-head", monthName.charAt(0).toUpperCase() + monthName.slice(1)));
      var wd = h("div", "cpc-weekdays");
      var names = ["ma", "di", "wo", "do", "vr", "za", "zo"];
      for (var i = 0; i < names.length; i++) wd.appendChild(h("span", "", names[i]));
      wrap.appendChild(wd);
      var grid = h("div", "cpc-grid");
      var packed = this._itemsByKey(tz);
      var cells = monthCells(cy, cm);
      var self = this;
      for (var c = 0; c < cells.length; c++) {
        (function (cell) {
          var cls = "cpc-cell" + (cell.inMonth ? "" : " out") + (cell.key === todayKey ? " today" : "");
          var btn = h("button", cls);
          btn.type = "button";
          btn.appendChild(h("div", "cpc-cell-num", String(cell.day)));
          var dots = h("div", "cpc-dots");
          var n = (packed.map[cell.key] || []).length;
          var max = n > 3 ? 3 : n;
          for (var d = 0; d < max; d++) dots.appendChild(h("span", "cpc-dot"));
          btn.appendChild(dots);
          btn.addEventListener("click", function () {
            self._selectedDay = cell.key;
            self._render();
          });
          grid.appendChild(btn);
        })(cells[c]);
      }
      wrap.appendChild(grid);
      return wrap;
    }

    _renderDayOverlay() {
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var overlay = h("div", "cpc-overlay");
      var head = h("div", "cpc-overlay-head");
      head.appendChild(h("span", "", formatDayLabel(this._selectedDay, todayKey)));
      var self = this;
      var close = h("button", "cpc-btn", "Sluiten");
      close.type = "button";
      close.addEventListener("click", function () {
        self._selectedDay = null;
        self._render();
      });
      head.appendChild(close);
      overlay.appendChild(head);
      var body = h("div", "cpc-overlay-body");
      var packed = this._itemsByKey(tz);
      var items = packed.map[this._selectedDay] || [];
      if (!items.length) {
        body.appendChild(h("div", "cpc-status", "Niets gepland"));
      } else {
        for (var i = 0; i < items.length; i++) {
          body.appendChild(this._renderItem(items[i], tz, now));
        }
      }
      overlay.appendChild(body);
      return overlay;
    }

    _renderConfirm() {
      var overlay = h("div", "cpc-confirm");
      var box = h("div", "cpc-confirm-box");
      box.appendChild(h("p", "", "Verwijderen?"));
      var actions = h("div", "cpc-confirm-actions");
      var self = this;
      var cancel = h("button", "cpc-btn", "Annuleren");
      cancel.type = "button";
      cancel.addEventListener("click", function () {
        self._confirmItem = null;
        self._render();
      });
      var ok = h("button", "cpc-btn primary", "Verwijderen");
      ok.type = "button";
      ok.addEventListener("click", function () {
        var item = self._confirmItem;
        self._confirmItem = null;
        if (!item) {
          self._render();
          return;
        }
        self._mutate("remove_item", { entity_id: item._source, item: item.uid });
      });
      actions.appendChild(cancel);
      actions.appendChild(ok);
      box.appendChild(actions);
      overlay.appendChild(box);
      return overlay;
    }
  }

  class CalendarPlannerCardEditor extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._config = Object.assign({}, DEFAULT_CONFIG);
      this._hass = null;
    }

    setConfig(config) {
      this._config = Object.assign({}, DEFAULT_CONFIG, config || {});
      if (!Array.isArray(this._config.calendars)) this._config.calendars = [];
      if (!Array.isArray(this._config.todos)) this._config.todos = [];
      this._render();
    }

    set hass(hass) {
      this._hass = hass;
    }

    _fire(next) {
      this._config = next;
      this.dispatchEvent(
        new CustomEvent("config-changed", {
          detail: { config: Object.assign({}, next) },
          bubbles: true,
          composed: true,
        })
      );
    }

    _render() {
      var root = this.shadowRoot;
      if (!root) return;
      while (root.firstChild) root.removeChild(root.firstChild);
      var style = document.createElement("style");
      style.textContent = CSS;
      root.appendChild(style);
      var wrap = h("div", "cpc-editor");
      var cfg = Object.assign({}, DEFAULT_CONFIG, this._config);
      var self = this;

      function field(labelText, input) {
        var lab = h("label");
        lab.appendChild(h("span", "", labelText));
        lab.appendChild(input);
        wrap.appendChild(lab);
        return input;
      }

      var title = document.createElement("input");
      title.type = "text";
      title.value = cfg.title || "";
      title.addEventListener("input", function () {
        self._fire(Object.assign({}, self._config, { title: title.value }));
      });
      field("Titel", title);

      var cals = document.createElement("textarea");
      cals.rows = 4;
      cals.value = (cfg.calendars || []).join("\n");
      cals.addEventListener("input", function () {
        self._fire(Object.assign({}, self._config, { calendars: parseIdLines(cals.value) }));
      });
      field("Kalenders", cals);

      var todos = document.createElement("textarea");
      todos.rows = 4;
      todos.value = (cfg.todos || []).join("\n");
      todos.addEventListener("input", function () {
        self._fire(Object.assign({}, self._config, { todos: parseIdLines(todos.value) }));
      });
      field("Takenlijsten", todos);

      var days = document.createElement("input");
      days.type = "number";
      days.min = "1";
      days.value = String(cfg.days || 14);
      days.addEventListener("input", function () {
        var n = parseInt(days.value, 10);
        self._fire(Object.assign({}, self._config, { days: n > 0 ? n : 14 }));
      });
      field("Dagen vooruit", days);

      root.appendChild(wrap);
    }
  }

  if (typeof customElements !== "undefined") {
    if (!customElements.get("calendar-planner-card")) {
      customElements.define("calendar-planner-card", CalendarPlannerCard);
    }
    if (!customElements.get("calendar-planner-card-editor")) {
      customElements.define("calendar-planner-card-editor", CalendarPlannerCardEditor);
    }
  }

  if (typeof global.window !== "undefined") {
    global.window.customCards = global.window.customCards || [];
    var already = false;
    for (var i = 0; i < global.window.customCards.length; i++) {
      if (global.window.customCards[i].type === "calendar-planner-card") already = true;
    }
    if (!already) {
      global.window.customCards.push({
        type: "calendar-planner-card",
        name: "Planner",
        description: "Gezinsagenda en taken in één tijdlijn",
        preview: true,
      });
    }
  }

  global.CalendarPlannerLogic = {
    groupItemsByDay: groupItemsByDay,
    isOverdue: isOverdue,
    brusselsDayKey: brusselsDayKey,
    formatTime: formatTime,
    parseEventStart: parseEventStart,
    parseDue: parseDue,
    mixDayItems: mixDayItems,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
  };
})(typeof globalThis !== "undefined" ? globalThis : window);
