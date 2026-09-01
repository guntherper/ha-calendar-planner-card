#!/usr/bin/env node
"use strict";

/**
 * Node-tests voor calendar-planner-card (CalendarPlannerLogic + registratie).
 * Run: node /home/gunther/jarvis-ha/www/test_calendar_planner_logic.js
 */

const fs = require("fs");
const path = require("path");
const vm = require("vm");
const assert = require("assert");

const CARD_CANDIDATES = [
  path.join(__dirname, "..", "diagrammen", "calendar-planner-card.js"),
  path.join(__dirname, "calendar-planner-card.js"),
];
const CARD = CARD_CANDIDATES.find(function (p) { return fs.existsSync(p); }) || CARD_CANDIDATES[0];

let failed = 0;
let passed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("PASS  " + name);
  } catch (err) {
    failed += 1;
    console.log("FAIL  " + name);
    console.log("  " + (err && err.stack ? err.stack.split("\n").slice(0, 4).join("\n  ") : err));
  }
}

if (!fs.existsSync(CARD)) {
  console.log("FAIL  kaart/logica ontbreekt: " + CARD);
  process.exit(1);
}

global.HTMLElement = class HTMLElement {
  constructor() {
    this.shadowRoot = null;
  }
  attachShadow(init) {
    const root = {
      mode: init && init.mode,
      childNodes: [],
      innerHTML: "",
      appendChild: function (el) {
        this.childNodes.push(el);
        return el;
      },
      querySelector: function () {
        return null;
      },
      querySelectorAll: function () {
        return [];
      },
    };
    this.shadowRoot = root;
    return root;
  }
  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {
    return true;
  }
  appendChild() {}
  setAttribute() {}
  getAttribute() {
    return null;
  }
};

global.customElements = {
  _reg: Object.create(null),
  define: function (name, ctor) {
    this._reg[name] = ctor;
  },
  get: function (name) {
    return this._reg[name];
  },
};

global.window = global;
global.document = {
  createElement: function (tag) {
    return {
      tagName: String(tag).toUpperCase(),
      style: { setProperty: function () {} },
      className: "",
      textContent: "",
      innerHTML: "",
      children: [],
      childNodes: [],
      dataset: {},
      classList: { add: function () {}, remove: function () {}, toggle: function () {} },
      _listeners: {},
      _attrs: {},
      appendChild: function (el) {
        this.children.push(el);
        this.childNodes.push(el);
        return el;
      },
      addEventListener: function (type, fn) {
        this._listeners[type] = this._listeners[type] || [];
        this._listeners[type].push(fn);
      },
      setAttribute: function (k, v) {
        this._attrs[k] = v == null ? "" : String(v);
      },
      getAttribute: function (k) {
        return Object.prototype.hasOwnProperty.call(this._attrs, k) ? this._attrs[k] : null;
      },
      querySelector: function () {
        return null;
      },
      querySelectorAll: function () {
        return [];
      },
    };
  },
  createTextNode: function (t) {
    return { nodeType: 3, textContent: String(t), data: String(t) };
  },
};
global.CustomEvent = class CustomEvent {
  constructor(type, init) {
    this.type = type;
    this.detail = init && init.detail;
    this.bubbles = !!(init && init.bubbles);
    this.composed = !!(init && init.composed);
  }
};
global.Node = { TEXT_NODE: 3, ELEMENT_NODE: 1 };

const code = fs.readFileSync(CARD, "utf8");
vm.runInThisContext(code, { filename: CARD });

const L = global.CalendarPlannerLogic;

test("CalendarPlannerLogic is geëxporteerd", function () {
  assert.ok(L, "globalThis.CalendarPlannerLogic ontbreekt");
  assert.equal(typeof L.brusselsDayKey, "function");
  assert.equal(typeof L.isOverdue, "function");
  assert.equal(typeof L.mixDayItems, "function");
  assert.equal(typeof L.groupItemsByDay, "function");
  assert.equal(typeof L.parseDue, "function");
  assert.equal(typeof L.parseEventStart, "function");
  assert.equal(typeof L.formatTime, "function");
  assert.ok(L.DEFAULT_CONFIG);
});

test("DEFAULT_CONFIG.days===14, title===Planner", function () {
  assert.strictEqual(L.DEFAULT_CONFIG.days, 14);
  assert.strictEqual(L.DEFAULT_CONFIG.title, "Planner");
  assert.deepStrictEqual(L.DEFAULT_CONFIG.calendars, []);
  assert.deepStrictEqual(L.DEFAULT_CONFIG.todos, []);
});

test("brusselsDayKey 2026-09-01T22:30:00Z → 2026-09-02", function () {
  assert.strictEqual(L.brusselsDayKey("2026-09-01T22:30:00Z"), "2026-09-02");
  assert.strictEqual(L.brusselsDayKey(new Date("2026-09-01T22:30:00Z")), "2026-09-02");
});

test("isOverdue: gisteren+needs_action true; vandaag false; completed false; geen due false", function () {
  const now = new Date("2026-09-01T12:00:00+02:00");
  assert.strictEqual(
    L.isOverdue({ due: "2026-08-31", status: "needs_action" }, now),
    true
  );
  assert.strictEqual(
    L.isOverdue({ due: "2026-09-01", status: "needs_action" }, now),
    false
  );
  assert.strictEqual(
    L.isOverdue({ due: "2026-08-31", status: "completed" }, now),
    false
  );
  assert.strictEqual(L.isOverdue({ status: "needs_action" }, now), false);
});

test("mixDayItems: events vóór taken", function () {
  const mixed = L.mixDayItems([
    { _kind: "task", summary: "Taak 1" },
    { _kind: "event", summary: "Event A" },
    { _kind: "task", summary: "Taak 2" },
    { _kind: "event", summary: "Event B" },
  ]);
  assert.deepStrictEqual(
    mixed.map(function (i) {
      return i.summary;
    }),
    ["Event A", "Event B", "Taak 1", "Taak 2"]
  );
});

test("groupItemsByDay: zelfde dag samen; undated apart", function () {
  const result = L.groupItemsByDay([
    {
      _kind: "event",
      summary: "Tandarts",
      start: { dateTime: "2026-09-01T10:00:00+02:00" },
    },
    { _kind: "task", summary: "Melk", due: "2026-09-01", status: "needs_action" },
    { _kind: "event", summary: "Schoolfeest", start: { date: "2026-09-02" } },
    { _kind: "task", summary: "Boek lezen", status: "needs_action" },
  ]);
  assert.ok(result && Array.isArray(result.days), "result.days moet een array zijn");
  assert.ok(Array.isArray(result.undated), "result.undated moet een array zijn");
  const keys = result.days.map(function (d) {
    return d.key;
  });
  assert.ok(keys.indexOf("2026-09-01") !== -1, "2026-09-01 ontbreekt");
  assert.ok(keys.indexOf("2026-09-02") !== -1, "2026-09-02 ontbreekt");
  const d1 = result.days.find(function (d) {
    return d.key === "2026-09-01";
  });
  assert.deepStrictEqual(
    d1.items.map(function (i) {
      return i.summary;
    }),
    ["Tandarts", "Melk"]
  );
  const d2 = result.days.find(function (d) {
    return d.key === "2026-09-02";
  });
  assert.deepStrictEqual(
    d2.items.map(function (i) {
      return i.summary;
    }),
    ["Schoolfeest"]
  );
  assert.deepStrictEqual(
    result.undated.map(function (i) {
      return i.summary;
    }),
    ["Boek lezen"]
  );
});

test("parseDue: string date, string datetime, {date}, {dateTime}", function () {
  const d1 = L.parseDue("2026-09-01");
  assert.ok(d1, "string date");
  assert.strictEqual(L.brusselsDayKey(d1), "2026-09-01");

  const d2 = L.parseDue("2026-09-01T10:00:00+02:00");
  assert.ok(d2, "string datetime");
  assert.strictEqual(L.brusselsDayKey(d2), "2026-09-01");

  const d3 = L.parseDue({ date: "2026-09-01" });
  assert.ok(d3, "{date}");
  assert.strictEqual(L.brusselsDayKey(d3), "2026-09-01");

  const d4 = L.parseDue({ dateTime: "2026-09-01T22:30:00Z" });
  assert.ok(d4, "{dateTime}");
  assert.strictEqual(L.brusselsDayKey(d4), "2026-09-02");

  assert.strictEqual(L.parseDue(null), null);
  assert.strictEqual(L.parseDue(undefined), null);
});

test("customElements: calendar-planner-card en editor", function () {
  assert.equal(typeof customElements.get("calendar-planner-card"), "function");
  assert.equal(typeof customElements.get("calendar-planner-card-editor"), "function");
});

test("customCards type calendar-planner-card name Planner", function () {
  assert.ok(Array.isArray(window.customCards));
  const entry = window.customCards.find(function (c) {
    return c.type === "calendar-planner-card";
  });
  assert.ok(entry, "customCards entry ontbreekt");
  assert.strictEqual(entry.name, "Planner");
  assert.strictEqual(entry.preview, true);
});

test("getStubConfig en setConfig gooit zonder config", function () {
  const Card = customElements.get("calendar-planner-card");
  const stub = Card.getStubConfig();
  assert.strictEqual(stub.title, "Planner");
  assert.strictEqual(stub.days, 14);
  assert.deepStrictEqual(stub.calendars, [
    "calendar.gezin_2",
    "calendar.jarvisub69_gmail_com",
  ]);
  assert.deepStrictEqual(stub.todos, ["todo.gezin_actief", "todo.gezin"]);
  const el = new Card();
  assert.throws(function () {
    el.setConfig();
  });
  assert.throws(function () {
    el.setConfig(null);
  });
});

test("getConfigElement → calendar-planner-card-editor", function () {
  const Card = customElements.get("calendar-planner-card");
  const orig = global.document.createElement;
  let requested = null;
  global.document.createElement = function (tag) {
    requested = tag;
    return orig.call(global.document, tag);
  };
  try {
    const node = Card.getConfigElement();
    assert.strictEqual(requested, "calendar-planner-card-editor");
    assert.ok(node);
  } finally {
    global.document.createElement = orig;
  }
});

test("VERSION is 1.4.1", function () {
  assert.strictEqual(L.VERSION, "1.4.1");
});

test("sourceHue: stabiel per id, hue uit gecureerde reeks", function () {
  assert.equal(typeof L.sourceHue, "function");
  const a = L.sourceHue("calendar.gezin_2");
  const b = L.sourceHue("calendar.gezin_2");
  assert.strictEqual(a, b, "zelfde id moet dezelfde hue geven");
  const golden = [200, 12, 145, 45, 275, 330, 95, 175, 25, 305];
  assert.ok(golden.indexOf(a) !== -1, "hue " + a + " staat niet in de gecureerde reeks");
  assert.notStrictEqual(
    L.sourceHue("todo.gezin"),
    L.sourceHue("calendar.gezin_2"),
    "verschillende bronnen moeten (in de praktijk) andere hues krijgen"
  );
  assert.strictEqual(L.sourceHue(""), golden[0], "lege id valt terug op eerste hue");
});

test("dayWeekdayShort/dayNumber 2026-09-01 → di / 1", function () {
  assert.equal(typeof L.dayWeekdayShort, "function");
  assert.equal(typeof L.dayNumber, "function");
  assert.strictEqual(L.dayNumber("2026-09-01"), "1");
  const wd = L.dayWeekdayShort("2026-09-01");
  assert.ok(/^di/i.test(String(wd).replace(".", "")), "verwacht di, kreeg " + wd);
});

test("itemKey: stabiel over kloon; event vs taak", function () {
  assert.equal(typeof L.itemKey, "function");
  const ev = {
    _kind: "event",
    _source: "calendar.gezin_2",
    uid: "u1",
    summary: "Infoavond",
    start: { dateTime: "2026-09-09T16:00:00+02:00" },
  };
  assert.strictEqual(L.itemKey(ev), L.itemKey(Object.assign({}, ev)));
  assert.ok(String(L.itemKey(ev)).indexOf("e|") === 0);
  const t = { _kind: "task", _source: "todo.gezin_actief", uid: "t1", summary: "Turnzak" };
  assert.ok(String(L.itemKey(t)).indexOf("t|") === 0);
  assert.notStrictEqual(L.itemKey(ev), L.itemKey(t));
});

test("formatEventWhen: eendaags hele-dag, meerdaags, tijdsgebonden", function () {
  assert.equal(typeof L.formatEventWhen, "function");
  const one = L.formatEventWhen(
    { start: { date: "2026-09-09" }, end: { date: "2026-09-10" } },
    "Europe/Brussels",
    "2026-09-08"
  );
  assert.ok(/hele dag/i.test(one.main), "eendaags moet 'hele dag' tonen: " + one.main);
  assert.ok(one.main.indexOf("10") === -1, "exclusieve einddatum mag niet als 10 sep: " + one.main);
  assert.strictEqual(one.rel, "morgen");

  const multi = L.formatEventWhen(
    { start: { date: "2026-09-09" }, end: { date: "2026-09-12" } },
    "Europe/Brussels",
    "2026-09-09"
  );
  assert.ok(/hele dag/i.test(multi.main), "meerdaags hele dag: " + multi.main);
  assert.ok(/11/.test(multi.main), "exclusief 12 sep → tot 11 sep: " + multi.main);
  assert.strictEqual(multi.rel, "vandaag");

  const timed = L.formatEventWhen(
    {
      start: { dateTime: "2026-09-09T16:00:00+02:00" },
      end: { dateTime: "2026-09-09T17:00:00+02:00" },
    },
    "Europe/Brussels",
    "2026-09-09"
  );
  assert.ok(/16:00/.test(timed.main) && /17:00/.test(timed.main), "tijdvenster: " + timed.main);
  assert.strictEqual(timed.rel, "vandaag");
});

test("detail-open-state: _openDetail zet sleutel, _closeDetail wist hem", function () {
  const Card = customElements.get("calendar-planner-card");
  const el = new Card();
  el._config = Object.assign({}, L.DEFAULT_CONFIG, { todos: ["todo.gezin_actief"] });
  const ev = {
    _kind: "event",
    _source: "calendar.gezin_2",
    uid: "abc",
    summary: "Infoavond eerste jaar",
    start: { dateTime: "2026-09-09T16:00:00+02:00" },
  };
  el._events = [ev];
  el._tasks = [];
  el._render = function () {};
  el._openDetail(ev);
  assert.ok(el._detailKey, "_detailKey moet gezet zijn");
  assert.strictEqual(el._detailKey, L.itemKey(ev));
  assert.strictEqual(el._findItem(el._detailKey), ev);
  el._closeDetail(false);
  assert.strictEqual(el._detailKey, null);
  assert.strictEqual(el._detailSnap, null);
  assert.strictEqual(el._detailGone, null);
});

test("checkbox-label stopt click-propagatie (detail opent niet)", function () {
  const Card = customElements.get("calendar-planner-card");
  const el = new Card();
  el._config = Object.assign({}, L.DEFAULT_CONFIG, { todos: ["todo.gezin_actief"] });
  const item = {
    _kind: "task",
    _source: "todo.gezin_actief",
    uid: "t1",
    summary: "Turnzak wassen",
    status: "needs_action",
  };
  const row = el._renderItem(item, "Europe/Brussels", new Date("2026-09-01T12:00:00+02:00"));
  function findByClass(node, cls) {
    if (!node) return null;
    if (node.className && String(node.className).split(/\s+/).indexOf(cls) !== -1) return node;
    const kids = node.children || [];
    for (let i = 0; i < kids.length; i++) {
      const f = findByClass(kids[i], cls);
      if (f) return f;
    }
    return null;
  }
  const wrap = findByClass(row, "cpc-check-wrap");
  assert.ok(wrap, "cpc-check-wrap ontbreekt");
  assert.ok(wrap._listeners && wrap._listeners.click && wrap._listeners.click.length, "geen click-listener op label");
  let stopped = false;
  wrap._listeners.click[0]({ stopPropagation: function () { stopped = true; } });
  assert.ok(stopped, "click op checkbox-label moet stopPropagation aanroepen");
});

test("Toevoegen aan taken: payload heeft item + due_date", function () {
  const Card = customElements.get("calendar-planner-card");
  const el = new Card();
  el._config = Object.assign({}, L.DEFAULT_CONFIG, { todos: ["todo.gezin_actief"] });
  el._addList = "todo.gezin_actief";
  el._hass = {
    config: { time_zone: "Europe/Brussels" },
    states: { "todo.gezin_actief": { attributes: { friendly_name: "Gezin actief" } } },
  };
  el._render = function () {};
  let captured = null;
  el._mutate = function (service, data) {
    captured = { service: service, data: data };
  };
  const ev = {
    _kind: "event",
    summary: "Infoavond eerste jaar",
    start: { dateTime: "2026-09-09T16:00:00+02:00" },
  };
  el._detailAddEventToTasks(ev);
  assert.ok(captured, "geen mutate-aanroep");
  assert.strictEqual(captured.service, "add_item");
  assert.strictEqual(captured.data.entity_id, "todo.gezin_actief");
  assert.strictEqual(captured.data.item, "Infoavond eerste jaar");
  assert.strictEqual(captured.data.due_date, "2026-09-09");
});

test("N1 matchingOpenTask: open zelfde titel in doellijst; hele-dag zelfde dag", function () {
  assert.equal(typeof L.matchingOpenTask, "function");
  const tasks = [
    { _kind: "task", _source: "todo.gezin_actief", summary: "Infoavond", status: "needs_action", due: "2026-09-09" },
    { _kind: "task", _source: "todo.gezin", summary: "Infoavond", status: "needs_action", due: "2026-09-09" },
    { _kind: "task", _source: "todo.gezin_actief", summary: "Ander", status: "needs_action", due: "2026-09-09" },
    { _kind: "task", _source: "todo.gezin_actief", summary: "Infoavond", status: "completed", due: "2026-09-09" },
    { _kind: "task", _source: "todo.gezin_actief", summary: "Infoavond", status: "needs_action", due: "2026-09-10" },
  ];
  const hit = L.matchingOpenTask(tasks, {
    title: "Infoavond",
    entityId: "todo.gezin_actief",
    dueKey: "2026-09-09",
    matchDay: true,
    tz: "Europe/Brussels",
  });
  assert.ok(hit, "hele-dag: zelfde titel + dag in doellijst moet matchen");
  assert.strictEqual(hit.due, "2026-09-09");

  const otherDay = L.matchingOpenTask(tasks, {
    title: "Infoavond",
    entityId: "todo.gezin_actief",
    dueKey: "2026-09-11",
    matchDay: true,
    tz: "Europe/Brussels",
  });
  assert.strictEqual(otherDay, null, "hele-dag: andere dag mag niet matchen");

  const otherList = L.matchingOpenTask(tasks, {
    title: "Infoavond",
    entityId: "todo.niet_bestaand",
    dueKey: "2026-09-09",
    matchDay: true,
    tz: "Europe/Brussels",
  });
  assert.strictEqual(otherList, null, "andere lijst mag niet matchen");

  const timed = L.matchingOpenTask(tasks, {
    title: "Infoavond",
    entityId: "todo.gezin_actief",
    dueKey: "2026-09-11",
    matchDay: false,
    tz: "Europe/Brussels",
  });
  assert.ok(timed, "tijdsgebonden event: alleen titel in doellijst telt");
});

test("N5 nextTrapTarget: Tab-cyclus eerste/laatste", function () {
  assert.equal(typeof L.nextTrapTarget, "function");
  const list = ["a", "b", "c"];
  assert.strictEqual(L.nextTrapTarget(list, "c", false), "a", "Tab op laatste → eerste");
  assert.strictEqual(L.nextTrapTarget(list, "a", true), "c", "Shift+Tab op eerste → laatste");
  assert.strictEqual(L.nextTrapTarget(list, "b", false), null, "Tab in het midden niet vangen");
  assert.strictEqual(L.nextTrapTarget(list, "b", true), null, "Shift+Tab in het midden niet vangen");
  assert.strictEqual(L.nextTrapTarget(list, "x", true), "c", "Shift+Tab buiten de lijst → laatste");
  assert.strictEqual(L.nextTrapTarget([], "a", false), null);
  assert.equal(typeof L.trapTab, "function");
  let prevented = false;
  let focused = null;
  const first = { id: "first", focus: function () { focused = "first"; } };
  const last = { id: "last", focus: function () { focused = "last"; } };
  const trapped = L.trapTab(
    { key: "Tab", shiftKey: false, target: last, preventDefault: function () { prevented = true; } },
    [first, last]
  );
  assert.strictEqual(trapped, true);
  assert.ok(prevented);
  assert.strictEqual(focused, "first");
  assert.strictEqual(L.trapTab({ key: "Escape", target: last }, [first, last]), false);
});

console.log("");
console.log(passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
