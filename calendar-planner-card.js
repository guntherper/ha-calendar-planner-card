/**
 * calendar-planner-card
 * Gezinsagenda en taken in één tijdlijn (vanilla HTMLElement, geen Lit).
 * v1.1.0 — design-implementatie: render-splitsing, design-tokens, rij-grid,
 * dagkop met datumblok, kleur per bron, maandnavigatie, toegankelijkheid.
 */
(function (global) {
  "use strict";

  var VERSION = "1.4.0";
  var DETAIL_UID = 0;
  var TZ_DEFAULT = "Europe/Brussels";
  var CACHE_MS = 60000;

  var DEFAULT_CONFIG = {
    title: "Planner",
    calendars: [],
    todos: [],
    days: 14,
  };

  var CSS = [
    /* 0. basis + design-tokens (overschrijfbaar via HA-thema of style:) */
    ":host { display: block; --cpc-gap: 4px; --cpc-pad-x: 16px; --cpc-row-min: 44px; --cpc-radius: 12px; --cpc-fs-title: 16px; --cpc-fs-daynum: 20px; --cpc-fs-item: 14.5px; --cpc-fs-sub: 12px; --cpc-fs-time: 13px; --cpc-fs-micro: 11px; --cpc-fg: var(--primary-text-color, #212121); --cpc-fg-dim: var(--secondary-text-color, #727272); --cpc-line: var(--divider-color, rgba(127,127,127,.24)); --cpc-surface: var(--card-background-color, #fff); --cpc-hover: rgba(var(--rgb-primary-text-color, 33,33,33), .07); --cpc-press: rgba(var(--rgb-primary-text-color, 33,33,33), .12); --cpc-accent: var(--primary-color, #03a9f4); --cpc-danger: var(--error-color, #d93025); color-scheme: light dark; }",
    ":host([data-dark]) { color-scheme: dark; }",
    ":host([data-compact]) { --cpc-row-min: 36px; --cpc-fs-item: 13.5px; --cpc-pad-x: 12px; }",
    ":host([data-compact]) .cpc-item-sub { display: none; }",
    ":host([data-compact]) .cpc-day { padding-block: 6px 8px; }",
    "ha-card { padding: 0; overflow: hidden; position: relative; background: var(--card-background-color, #fff); color: var(--primary-text-color, #212121); }",
    "ha-icon { --mdc-icon-size: 18px; color: var(--cpc-fg-dim); }",
    ":where(button, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid var(--cpc-accent); outline-offset: 2px; border-radius: 6px; }",
    /* 1. kaartkop */
    ".cpc-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 14px var(--cpc-pad-x) 10px; border-bottom: 1px solid var(--cpc-line); }",
    ".cpc-head-left { min-width: 0; }",
    ".cpc-title { font-size: var(--cpc-fs-title); font-weight: 600; letter-spacing: -.01em; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".cpc-subtitle { font-size: var(--cpc-fs-sub); color: var(--cpc-fg-dim); margin-top: 2px; }",
    ".cpc-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }",
    ".cpc-seg { display: flex; background: var(--cpc-hover); border-radius: 999px; padding: 2px; }",
    ".cpc-seg button { border: 0; background: transparent; font: inherit; font-size: 13px; font-weight: 600; color: var(--cpc-fg-dim); padding: 6px 12px; border-radius: 999px; cursor: pointer; min-height: 32px; }",
    ".cpc-seg button.active { background: var(--cpc-surface); color: var(--cpc-fg); box-shadow: 0 1px 2px rgba(0,0,0,.18); }",
    ".cpc-refresh { width: 40px; height: 40px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 50%; cursor: pointer; color: var(--cpc-fg-dim); }",
    ".cpc-refresh:hover { background: var(--cpc-hover); }",
    ".cpc-refresh.spin ha-icon { animation: cpc-spin .8s linear infinite; }",
    "@keyframes cpc-spin { to { transform: rotate(360deg); } }",
    "@media (prefers-reduced-motion: reduce) { .cpc-refresh.spin ha-icon { animation: none; } }",
    /* 2. body + staten */
    ".cpc-body { padding: 8px 0 12px; }",
    ".cpc-status { padding: 16px; color: var(--cpc-fg-dim); }",
    ".cpc-empty { display: flex; align-items: center; gap: 8px; padding: 10px 0; color: var(--cpc-fg-dim); font-size: var(--cpc-fs-sub); }",
    ".cpc-error { display: flex; flex-direction: column; align-items: center; gap: 8px; }",
    ".cpc-btn { border: 0; background: transparent; color: var(--cpc-fg); cursor: pointer; font: inherit; font-size: 13px; padding: 8px 14px; border-radius: 8px; min-height: 40px; }",
    ".cpc-btn:hover { background: var(--cpc-hover); }",
    ".cpc-btn.danger { background: var(--cpc-danger); color: #fff; font-weight: 600; }",
    ".cpc-btn.danger:hover { background: var(--cpc-danger); }",
    /* 3. dag + dagkop met datumblok */
    ".cpc-day { display: grid; grid-template-columns: 44px 1fr; gap: 0 12px; padding: 10px var(--cpc-pad-x) 12px; }",
    ".cpc-day + .cpc-day { border-top: 1px solid var(--cpc-line); }",
    ".cpc-day[data-weekend] { background: rgba(var(--rgb-primary-text-color,33,33,33), .035); }",
    ".cpc-day-head { display: flex; flex-direction: column; align-items: center; gap: 2px; }",
    ".cpc-day-date { text-align: center; line-height: 1.1; padding-top: 2px; }",
    ".cpc-day-wd { font-size: var(--cpc-fs-micro); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cpc-fg-dim); }",
    ".cpc-day[data-weekend] .cpc-day-wd { color: var(--cpc-fg); }",
    ".cpc-day-num { font-size: var(--cpc-fs-daynum); font-weight: 700; font-variant-numeric: tabular-nums; color: var(--cpc-fg); }",
    ".cpc-day[data-today] .cpc-day-num { color: var(--text-primary-color, #fff); background: var(--cpc-accent); border-radius: 999px; display: inline-block; min-width: 30px; padding: 1px 0; }",
    ".cpc-day[data-today] .cpc-day-wd { color: var(--cpc-accent); }",
    ".cpc-day-meta { font-size: var(--cpc-fs-sub); color: var(--cpc-fg-dim); text-align: center; }",
    ".cpc-day-items { min-width: 0; }",
    ".cpc-count { font-size: var(--cpc-fs-micro); font-weight: 700; color: var(--cpc-fg-dim); background: var(--cpc-hover); border-radius: 999px; padding: 2px 7px; margin-left: 6px; }",
    /* 4. item-rij: [48px tijd/checkbox] [3px balk] [1fr titel+sub] [auto badge] [auto actie] */
    ".cpc-item { display: grid; grid-template-columns: 56px 3px 1fr auto auto; align-items: center; column-gap: 10px; min-height: var(--cpc-row-min); padding: 4px 0; border-radius: 8px; margin-inline: -6px; padding-inline: 6px; --cpc-src: hsl(var(--cpc-src-h, 200) 62% 52%); }",
    ".cpc-item:hover { background: var(--cpc-hover); }",
    ".cpc-item:active { background: var(--cpc-press); }",
    ".cpc-item.overdue { background: rgba(var(--rgb-error-color, 217,48,37), .07); box-shadow: inset 3px 0 0 var(--cpc-danger); }",
    ".cpc-lead { display: flex; align-items: center; justify-content: flex-end; min-width: 0; height: 100%; }",
    ".cpc-time { font-size: var(--cpc-fs-time); font-weight: 600; font-variant-numeric: tabular-nums; color: var(--cpc-fg-dim); text-align: right; }",
    ".cpc-time.allday { font-size: var(--cpc-fs-micro); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; color: var(--cpc-fg-dim); text-align: right; line-height: 1.15; }",
    ".cpc-bar { align-self: stretch; border-radius: 2px; background: var(--cpc-src); margin: 6px 0; }",
    ".cpc-body-col { min-width: 0; }",
    ".cpc-item-title { font-size: var(--cpc-fs-item); font-weight: 500; color: var(--cpc-fg); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".cpc-item-sub { font-size: var(--cpc-fs-sub); color: var(--cpc-fg-dim); display: flex; align-items: center; gap: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }",
    ".cpc-sub-sep { opacity: .6; }",
    ".cpc-item.done .cpc-item-title { text-decoration: line-through; opacity: .5; }",
    ".cpc-badge { font-size: var(--cpc-fs-micro); font-weight: 700; text-transform: uppercase; letter-spacing: .04em; padding: 2px 6px; border-radius: 5px; background: var(--cpc-hover); color: var(--cpc-fg-dim); }",
    ".cpc-badge.danger { background: rgba(var(--rgb-error-color,217,48,37), .16); color: var(--cpc-danger); }",
    ".cpc-check-wrap { display: flex; align-items: center; justify-content: center; width: 48px; min-height: 44px; }",
    ".cpc-cell[data-narrow], .cpc-item[data-narrow] { }",
    ":host([data-narrow]) .cpc-item-title { font-size: 14px; }",
    ":host([data-narrow]) .cpc-row { min-height: 48px; }",
    ":host([data-narrow]) .cpc-day-label { font-size: 10px; }",
    ".cpc-check { width: 20px; height: 20px; margin: 0; accent-color: var(--cpc-src); cursor: pointer; }",
    ".cpc-del { width: 40px; height: 40px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 50%; cursor: pointer; opacity: 0; transition: opacity .12s ease; }",
    ".cpc-item:hover .cpc-del, .cpc-item:focus-within .cpc-del { opacity: 1; }",
    ".cpc-del:hover { background: rgba(var(--rgb-error-color,217,48,37), .12); }",
    ".cpc-del:hover ha-icon { color: var(--cpc-danger); }",
    "@media (hover: none) { .cpc-del { opacity: .6; } }",
    "@media (prefers-reduced-motion: reduce) { .cpc-del { transition: none; } }",
    /* 5. sectie zonder datum */
    ".cpc-section { margin: 8px var(--cpc-pad-x) 0; border: 1px solid var(--cpc-line); border-radius: var(--cpc-radius); overflow: hidden; }",
    ".cpc-section-head { display: flex; width: 100%; align-items: center; justify-content: space-between; min-height: 44px; padding: 8px 12px; background: transparent; border: 0; cursor: pointer; font: inherit; color: inherit; }",
    ".cpc-section-head:hover { background: var(--cpc-hover); }",
    ".cpc-section-label { display: flex; align-items: center; font-weight: 600; }",
    ".cpc-chev { display: flex; transition: transform .15s ease; }",
    ".cpc-section[data-open] .cpc-chev { transform: rotate(180deg); }",
    ".cpc-section-body { padding: 0 10px 8px; }",
    /* 6. nieuwe-taak-composer */
    ".cpc-add { margin: 4px 0 0; padding: 12px var(--cpc-pad-x) 14px; border-top: 1px solid var(--cpc-line); }",
    ".cpc-add-field { display: flex; align-items: center; gap: 8px; background: rgba(var(--rgb-primary-text-color,33,33,33), .05); border: 1px solid transparent; border-radius: 10px; padding: 0 10px; min-height: 44px; transition: border-color .12s, background .12s; }",
    ".cpc-add-field:focus-within { border-color: var(--cpc-accent); background: var(--cpc-surface); }",
    ".cpc-add input[type=text] { flex: 1; min-width: 0; border: 0; background: transparent; font: inherit; font-size: var(--cpc-fs-item); color: inherit; padding: 10px 0; outline: none; }",
    ".cpc-add input::placeholder { color: var(--cpc-fg-dim); }",
    ".cpc-add-plus { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 50%; cursor: pointer; color: var(--cpc-accent); flex-shrink: 0; }",
    ".cpc-add-plus.disabled { opacity: .4; cursor: default; }",
    ".cpc-extra { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; max-height: 0; overflow: hidden; transition: max-height .15s ease; }",
    ".cpc-add-field:focus-within ~ .cpc-extra, .cpc-extra.open { max-height: 96px; }",
    ".cpc-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }",
    ".cpc-chip { border: 1px solid var(--cpc-line); background: transparent; color: var(--cpc-fg-dim); border-radius: 999px; padding: 7px 12px; min-height: 36px; font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }",
    ".cpc-chip:hover { background: var(--cpc-hover); }",
    ".cpc-chip.active, .cpc-chip[aria-pressed=\"true\"] { background: rgba(var(--rgb-primary-color,3,169,244), .14); border-color: var(--cpc-accent); color: var(--cpc-accent); }",
    ".cpc-add input[type=date] { font: inherit; padding: 6px 8px; border: 1px solid var(--cpc-line); border-radius: 8px; background: var(--cpc-surface); color: inherit; }",
    /* 7. maandweergave */
    ".cpc-month-head { display: grid; grid-template-columns: 44px 1fr auto 44px; align-items: center; padding: 6px 10px 10px; font-weight: 600; }",
    ".cpc-month-name { text-align: center; }",
    ".cpc-month-nav { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 50%; cursor: pointer; }",
    ".cpc-month-nav:hover { background: var(--cpc-hover); }",
    ".cpc-month-today { border: 0; background: transparent; color: var(--cpc-accent); font: inherit; font-size: 12px; font-weight: 700; cursor: pointer; min-height: 32px; padding: 0 8px; border-radius: 999px; }",
    ".cpc-month-today:hover { background: var(--cpc-hover); }",
    ".cpc-weekdays, .cpc-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; padding: 0 var(--cpc-pad-x); }",
    ".cpc-weekdays span { text-align: center; font-size: var(--cpc-fs-micro); font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--cpc-fg-dim); padding: 6px 0; }",
    ".cpc-weekdays span.we { color: var(--cpc-fg); }",
    ".cpc-cell { min-height: 48px; border-radius: 10px; padding: 5px 2px 4px; display: flex; flex-direction: column; align-items: center; gap: 3px; background: transparent; border: 0; color: inherit; font: inherit; cursor: pointer; }",
    ".cpc-cell:hover { background: var(--cpc-hover); }",
    ".cpc-cell.out { opacity: 1; color: var(--disabled-text-color, #8f8f8f); }",
    ".cpc-cell.we { background: rgba(var(--rgb-primary-text-color,33,33,33), .035); }",
    ".cpc-cell-num { font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums; width: 26px; height: 26px; display: grid; place-items: center; border-radius: 50%; }",
    ".cpc-cell.today .cpc-cell-num { font-weight: 700; color: var(--cpc-accent); box-shadow: inset 0 0 0 2px var(--cpc-accent); }",
    ".cpc-cell.selected { background: rgba(var(--rgb-primary-color,3,169,244), .12); }",
    ".cpc-cell.selected .cpc-cell-num { background: var(--cpc-accent); color: var(--text-primary-color, #fff); box-shadow: none; }",
    ".cpc-dots { display: flex; justify-content: center; align-items: center; gap: 3px; min-height: 7px; }",
    ".cpc-dot { width: 6px; height: 6px; border-radius: 50%; background: hsl(var(--cpc-src-h, 200) 62% 52%); box-shadow: 0 0 0 1px rgba(0,0,0,.25); }",
    ".cpc-dot.task { border-radius: 2px; width: 6px; height: 6px; }",
    ".cpc-dot.task.overdue { background: var(--cpc-danger); }",
    ".cpc-more { font-size: 9px; font-weight: 700; color: var(--cpc-fg-dim); line-height: 1; }",
    /* 7b. bronlegenda (maandweergave) */
    ".cpc-legend { display: flex; flex-wrap: wrap; gap: 6px 14px; padding: 10px var(--cpc-pad-x) 0; font-size: var(--cpc-fs-micro); color: var(--cpc-fg-dim); }",
    ".cpc-legend-item { display: inline-flex; align-items: center; gap: 5px; }",
    ".cpc-legend-dot { width: 7px; height: 7px; border-radius: 50%; background: hsl(var(--cpc-src-h, 200) 62% 52%); }",
    ".cpc-legend-dot.task { border-radius: 2px; }",
    /* 8. dagdetail (inline paneel) */
    ".cpc-daysheet { margin: 12px var(--cpc-pad-x) 0; border-radius: var(--cpc-radius); background: rgba(var(--rgb-primary-text-color,33,33,33), .05); border: 1px solid var(--cpc-line); padding: 10px 12px 12px; }",
    ".cpc-daysheet-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; font-weight: 600; }",
    ".cpc-daysheet-add { margin-top: 8px; }",
    /* 9. bevestigingsdialoog */
    ".cpc-confirm { position: fixed; inset: 0; z-index: 30; display: grid; place-items: center; padding: 16px; background: rgba(0,0,0,.45); backdrop-filter: blur(2px); }",
    ".cpc-confirm-box { background: var(--ha-card-background, var(--cpc-surface)); border: 1px solid var(--cpc-line); border-radius: var(--cpc-radius); padding: 18px 18px 14px; max-width: 280px; box-shadow: 0 10px 30px rgba(0,0,0,.5), 0 2px 6px rgba(0,0,0,.35); }",
    ".cpc-confirm-box p { margin: 0 0 12px; }",
    ".cpc-confirm-actions { display: flex; gap: 8px; justify-content: flex-end; }",
    /* 12. itemdetail (backdrop + sheet) */
    ".cpc-detail { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center; padding: 24px 12px; background: rgba(0,0,0,.5); overscroll-behavior: contain; }",
    ".cpc-detail-sheet { position: relative; width: 100%; max-width: 560px; max-height: min(80vh, 720px); overflow-y: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; background: var(--ha-card-background, var(--cpc-surface)); color: var(--cpc-fg); border: 1px solid var(--cpc-line); border-radius: var(--cpc-radius); box-shadow: 0 16px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.35); --cpc-src: hsl(var(--cpc-src-h, 200) 62% 52%); }",
    "@media (max-width: 480px) { .cpc-detail { align-items: flex-end; padding: 0; } .cpc-detail-sheet { max-width: none; max-height: 88vh; border-radius: var(--cpc-radius) var(--cpc-radius) 0 0; border-bottom: 0; } }",
    ".cpc-detail-accent { height: 4px; background: var(--cpc-src); border-radius: var(--cpc-radius) var(--cpc-radius) 0 0; }",
    ".cpc-detail-head { display: grid; grid-template-columns: 1fr 44px; gap: 8px; align-items: start; padding: 14px var(--cpc-pad-x) 2px; }",
    ".cpc-detail-title { font-size: 19px; font-weight: 600; line-height: 1.25; letter-spacing: -.01em; overflow-wrap: anywhere; margin: 0; }",
    ".cpc-detail-close { width: 44px; height: 44px; display: grid; place-items: center; border: 0; background: transparent; border-radius: 50%; cursor: pointer; color: var(--cpc-fg-dim); margin-top: -6px; }",
    ".cpc-detail-close:hover { background: var(--cpc-hover); }",
    ".cpc-detail-when { padding: 4px var(--cpc-pad-x) 0; font-size: 14.5px; font-weight: 600; color: var(--cpc-fg); font-variant-numeric: tabular-nums; }",
    ".cpc-detail-when .cpc-when-rel { color: var(--cpc-accent); font-weight: 700; }",
    ".cpc-detail-when.overdue { color: var(--cpc-danger); }",
    ".cpc-detail-badges { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px var(--cpc-pad-x) 0; }",
    ".cpc-detail-body { padding: 12px var(--cpc-pad-x) 4px; display: flex; flex-direction: column; gap: 14px; }",
    ".cpc-detail-row { display: grid; grid-template-columns: 22px 1fr; gap: 10px; align-items: start; min-width: 0; }",
    ".cpc-detail-row ha-icon { margin-top: 1px; }",
    ".cpc-detail-label { font-size: var(--cpc-fs-micro); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--cpc-fg-dim); margin-bottom: 3px; }",
    ".cpc-detail-loc { display: inline-flex; align-items: center; min-height: 44px; margin: -11px 0; padding: 0; border: 0; background: transparent; font: inherit; font-size: var(--cpc-fs-item); color: var(--cpc-accent); text-decoration: none; cursor: pointer; text-align: left; overflow-wrap: anywhere; }",
    ".cpc-detail-loc:hover { text-decoration: underline; }",
    ".cpc-detail-desc { font-size: var(--cpc-fs-item); line-height: 1.55; color: var(--cpc-fg); white-space: pre-wrap; overflow-wrap: anywhere; }",
    ".cpc-detail-desc.collapsed { display: -webkit-box; -webkit-line-clamp: 6; -webkit-box-orient: vertical; overflow: hidden; }",
    ".cpc-detail-more { border: 0; background: transparent; color: var(--cpc-accent); font: inherit; font-size: var(--cpc-fs-sub); font-weight: 600; cursor: pointer; padding: 4px 0; min-height: 32px; text-align: left; }",
    ".cpc-detail-desc a { color: var(--cpc-accent); }",
    ".cpc-detail-src { display: inline-flex; align-items: center; gap: 8px; font-size: var(--cpc-fs-item); color: var(--cpc-fg); }",
    ".cpc-detail-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--cpc-src); flex-shrink: 0; }",
    ".cpc-detail-dot.task { border-radius: 3px; }",
    ".cpc-detail-note { padding: 10px var(--cpc-pad-x) 0; font-size: var(--cpc-fs-sub); color: var(--cpc-fg-dim); }",
    ".cpc-detail-note.ok { color: var(--success-color, #2e7d32); }",
    ".cpc-detail-note.err { color: var(--cpc-danger); }",
    ".cpc-detail-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 14px; padding: 10px var(--cpc-pad-x) 14px; border-top: 1px solid var(--cpc-line); position: sticky; bottom: 0; background: var(--ha-card-background, var(--cpc-surface)); }",
    ".cpc-detail-actions .cpc-btn { min-height: 44px; }",
    ".cpc-detail-spacer { flex: 1 1 auto; }",
    ".cpc-btn.primary { background: rgba(var(--rgb-primary-color,3,169,244), .14); color: var(--cpc-accent); font-weight: 600; }",
    ".cpc-btn.primary:hover { background: rgba(var(--rgb-primary-color,3,169,244), .22); }",
    ".cpc-btn.ghost { border: 1px solid var(--cpc-line); }",
    ".cpc-btn.quiet { color: var(--cpc-fg-dim); }",
    ".cpc-btn[disabled] { opacity: .45; cursor: default; }",
    ".cpc-detail-edit { display: flex; flex-direction: column; gap: 12px; padding: 12px var(--cpc-pad-x) 0; }",
    ".cpc-detail-edit label { display: flex; flex-direction: column; gap: 5px; font-size: var(--cpc-fs-micro); font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--cpc-fg-dim); }",
    ".cpc-detail-edit input { font: inherit; font-size: var(--cpc-fs-item); font-weight: 400; letter-spacing: normal; text-transform: none; color: var(--cpc-fg); background: rgba(var(--rgb-primary-text-color,33,33,33), .05); border: 1px solid var(--cpc-line); border-radius: 10px; padding: 0 12px; min-height: 44px; }",
    ".cpc-detail-edit input:focus { border-color: var(--cpc-accent); background: var(--cpc-surface); }",
    ".cpc-detail-edit textarea { font: inherit; font-size: var(--cpc-fs-item); font-weight: 400; letter-spacing: normal; text-transform: none; color: var(--cpc-fg); background: rgba(var(--rgb-primary-text-color,33,33,33), .05); border: 1px solid var(--cpc-line); border-radius: 10px; padding: 10px 12px; min-height: 88px; resize: vertical; }",
    ".cpc-detail-edit textarea:focus { border-color: var(--cpc-accent); background: var(--cpc-surface); }",
    ".cpc-detail-sheet .cpc-chips { padding: 8px var(--cpc-pad-x) 0; }",
    ".cpc-open { display: block; width: 100%; min-width: 0; margin: 0; padding: 0; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }",
    ".cpc-item[data-openable] { cursor: pointer; }",
    "@media (prefers-reduced-motion: no-preference) { .cpc-detail-sheet { animation: cpc-sheet-in .16s ease-out; } }",
    "@keyframes cpc-sheet-in { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }",
    /* 10. skeleton-laadstaat */
    ".cpc-skel-wrap { padding: 8px var(--cpc-pad-x) 12px; }",
    ".cpc-skel-day { display: grid; grid-template-columns: 44px 1fr; gap: 0 12px; padding: 10px 0 12px; }",
    ".cpc-skel-day + .cpc-skel-day { border-top: 1px solid var(--cpc-line); }",
    ".cpc-skel { background: linear-gradient(90deg, rgba(var(--rgb-primary-text-color,33,33,33),.07) 25%, rgba(var(--rgb-primary-text-color,33,33,33),.14) 37%, rgba(var(--rgb-primary-text-color,33,33,33),.07) 63%); background-size: 400% 100%; border-radius: 6px; height: 12px; animation: cpc-shimmer 1.4s ease infinite; }",
    ".cpc-skel-w { width: 26px; height: 26px; border-radius: 50%; }",
    ".cpc-skel-s { width: 60%; margin-top: 6px; }",
    "@keyframes cpc-shimmer { from { background-position: 100% 0 } to { background-position: 0 0 } }",
    "@media (prefers-reduced-motion: reduce) { .cpc-skel { animation: none; } }",
    /* 11. editor */
    ".cpc-editor { display: flex; flex-direction: column; gap: 10px; padding: 8px 0; }",
    ".cpc-editor label { display: flex; flex-direction: column; gap: 4px; font-size: 13px; }",
    ".cpc-editor input, .cpc-editor textarea { font: inherit; padding: 6px 8px; border: 1px solid var(--cpc-line); border-radius: 6px; background: var(--cpc-surface); color: inherit; }",
  ].join("\n");

  var SHEET = null;
  function sheet() {
    if (!SHEET && typeof CSSStyleSheet !== "undefined" && "replaceSync" in CSSStyleSheet.prototype) {
      try {
        SHEET = new CSSStyleSheet();
        SHEET.replaceSync(CSS);
      } catch (e) {
        SHEET = null;
      }
    }
    return SHEET;
  }

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

  function isAllDayEvent(item) {
    return !!(item && item.start && item.start.date && !item.start.dateTime);
  }

  function mixDayItems(items) {
    var list = Array.isArray(items) ? items : [];
    var allday = [];
    var timed = [];
    var tasks = [];
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      if (isEvent(it)) {
        if (isAllDayEvent(it)) allday.push(it);
        else timed.push(it);
      } else {
        tasks.push(it);
      }
    }
    timed.sort(function (a, b) {
      var sa = parseEventStart(a.start), sb = parseEventStart(b.start);
      var ta = sa ? sa.getTime() : 0, tb = sb ? sb.getTime() : 0;
      return ta - tb;
    });
    return allday.concat(timed).concat(tasks);
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

  function dayWeekdayShort(key) {
    var d = parseDateOnly(key);
    var raw = new Intl.DateTimeFormat("nl-BE", { weekday: "short", timeZone: "UTC" }).format(d);
    return raw ? raw.replace(/\.$/, "") : key;
  }

  function dayNumber(key) {
    return String(parseDateOnly(key).getUTCDate());
  }

  function sourceHue(id) {
    var s = String(id || ""), n = 0;
    for (var i = 0; i < s.length; i++) n = (n * 31 + s.charCodeAt(i)) >>> 0;
    var golden = [200, 12, 145, 45, 275, 330, 95, 175, 25, 305];
    return golden[n % golden.length];
  }

  function itemKey(item) {
    if (!item) return null;
    var src = String(item._source || "");
    if (isEvent(item)) {
      var s = (item.start && (item.start.dateTime || item.start.date)) || "";
      return "e|" + src + "|" + (item.uid || item.recurrence_id || "") + "|" + s + "|" + (item.summary || "");
    }
    return "t|" + src + "|" + (item.uid || item.summary || "");
  }

  function formatDayShort(key) {
    var raw = new Intl.DateTimeFormat("nl-BE", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
      .format(parseDateOnly(key));
    return raw.replace(/\./g, "");
  }

  function relDayLabel(key, todayKey) {
    if (key === todayKey) return "vandaag";
    if (key === addDaysToKey(todayKey, 1)) return "morgen";
    if (key === addDaysToKey(todayKey, -1)) return "gisteren";
    return "";
  }

  function eventEndDate(item) {
    var e = item && item.end;
    if (!e) return null;
    if (typeof e === "string") return parseDue(e);
    if (e.dateTime) return parseDue(e.dateTime);
    if (e.date) return parseDue(e.date);
    return null;
  }

  function formatEventWhen(item, tz, todayKey) {
    var start = parseEventStart(item.start);
    if (!start) return { main: "Datum onbekend", rel: "" };
    var end = eventEndDate(item);
    var sKey = brusselsDayKey(start, tz);
    var rel = relDayLabel(sKey, todayKey);
    if (isAllDayEvent(item)) {
      /* end.date is exclusief: 9→10 sep betekent één dag, 9 sep */
      var eKey = end ? addDaysToKey(brusselsDayKey(end, tz), -1) : sKey;
      if (eKey > sKey) return { main: formatDayShort(sKey) + " – " + formatDayShort(eKey) + " · hele dag", rel: rel };
      return { main: formatDayShort(sKey) + " · hele dag", rel: rel };
    }
    var eKey2 = end ? brusselsDayKey(end, tz) : sKey;
    if (end && eKey2 !== sKey) {
      return { main: formatDayShort(sKey) + " " + formatTime(start, tz) + " – " + formatDayShort(eKey2) + " " + formatTime(end, tz), rel: rel };
    }
    return { main: formatDayShort(sKey) + " · " + formatTime(start, tz) + (end ? " – " + formatTime(end, tz) : ""), rel: rel };
  }

  function stripHtmlish(text) {
    return String(text == null ? "" : text)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/g, "'")
      .replace(/&quot;/g, "\"");
  }

  function appendLinkedText(parent, text) {
    var s = String(text == null ? "" : text);
    var re = /https?:\/\/[^\s<>"']+/g;
    var last = 0, m;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) parent.appendChild(document.createTextNode(s.slice(last, m.index)));
      var url = m[0].replace(/[.,;:!?)\]]+$/, "");
      var a = document.createElement("a");
      a.href = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      a.textContent = url;
      parent.appendChild(a);
      last = m.index + url.length;
    }
    if (last < s.length) parent.appendChild(document.createTextNode(s.slice(last)));
  }

  function matchingOpenTask(tasks, opts) {
    opts = opts || {};
    var title = String(opts.title || "").trim();
    if (!title) return null;
    var entity = opts.entityId || "";
    var dueKey = opts.dueKey || "";
    var matchDay = !!opts.matchDay;
    var tz = opts.tz || TZ_DEFAULT;
    var list = Array.isArray(tasks) ? tasks : [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!t || t.status === "completed") continue;
      if (entity && t._source !== entity) continue;
      if (String(t.summary || "").trim() !== title) continue;
      if (matchDay) {
        var d = parseDue(t.due);
        var tKey = d ? brusselsDayKey(d, tz) : "";
        if (tKey !== dueKey) continue;
      }
      return t;
    }
    return null;
  }

  function nextTrapTarget(list, active, shiftKey) {
    if (!list || !list.length) return null;
    if (shiftKey) {
      if (active === list[0] || list.indexOf(active) === -1) return list[list.length - 1];
      return null;
    }
    if (active === list[list.length - 1]) return list[0];
    return null;
  }

  function trapTab(ev, list) {
    if (!ev || ev.key !== "Tab") return false;
    var target = nextTrapTarget(list, ev.target, !!ev.shiftKey);
    if (!target) return false;
    if (ev.preventDefault) ev.preventDefault();
    if (target.focus) target.focus();
    return true;
  }

  function sheetFocusables(root) {
    if (!root || !root.querySelectorAll) return [];
    var nodes = root.querySelectorAll("a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex=\"-1\"])");
    var out = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (el.disabled) continue;
      if (el.getAttribute && el.getAttribute("tabindex") === "-1") continue;
      out.push(el);
    }
    return out;
  }

  function descriptionNeedsCollapse(text) {
    var str = String(text == null ? "" : text);
    if (str.split(/\n/).length > 6) return true;
    return str.length > 360;
  }

  function sheetSwipeShouldClose(info) {
    if (!info) return false;
    if ((info.scrollTop || 0) > 0) return false;
    var top = info.sheetTop;
    if (typeof top !== "number") return false;
    var fromTop = info.startY >= top && info.startY <= top + 48;
    if (!fromTop) return false;
    var dy = info.endY - info.startY;
    var dx = Math.abs((info.endX || 0) - (info.startX || 0));
    return dy >= 90 && dy > dx;
  }

  function h(tag, className, text) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    if (text != null && text !== "") el.textContent = text;
    return el;
  }

  function icon(name, cls) {
    if (customElements.get("ha-icon")) {
      var el = document.createElement("ha-icon");
      el.setAttribute("icon", name);
      if (cls) el.className = cls;
      return el;
    }
    return h("span", cls, { "mdi:refresh": "↻", "mdi:chevron-down": "▾", "mdi:chevron-left": "‹", "mdi:chevron-right": "›", "mdi:trash-can-outline": "🗑", "mdi:map-marker-outline": "📍", "mdi:plus": "+", "mdi:close": "×", "mdi:text-long": "¶", "mdi:pencil-outline": "✎", "mdi:check": "✓", "mdi:format-list-checks": "☑", "mdi:calendar-blank-outline": "📅" }[name] || "•");
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
      this._detailKey = null;
      this._detailSnap = null;
      this._detailGone = null;
      this._detailEdit = false;
      this._detailTitle = "";
      this._detailDue = "";
      this._detailNote = null;
      this._detailFocused = false;
      this._detailAddList = "";
      this._detailDesc = "";
      this._detailDescOpen = false;
      this._addTitle = "";
      this._addDue = "";
      this._addList = "";
      this._monthOffset = 0;
      this._styleAttached = false;
      this._ro = null;
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

    connectedCallback() {
      this._measureDark();
      if (typeof ResizeObserver !== "undefined") {
        var self = this;
        this._ro = new ResizeObserver(function (entries) {
          var w = entries && entries[0] && entries[0].contentRect ? entries[0].contentRect.width : 0;
          self.toggleAttribute("data-narrow", w > 0 && w < 340);
        });
        this._ro.observe(this);
      }
    }

    disconnectedCallback() {
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
    }

    _luminance(cssColor) {
      if (!cssColor) return null;
      var m = String(cssColor).match(/rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/);
      if (!m) return null;
      return 0.2126 * (Number(m[1]) / 255) + 0.7152 * (Number(m[2]) / 255) + 0.0722 * (Number(m[3]) / 255);
    }

    _measureDark() {
      try {
        var bg = getComputedStyle(this).getPropertyValue("--card-background-color") || "";
        var lum = this._luminance(bg);
        if (lum != null) this.toggleAttribute("data-dark", lum < 0.4);
      } catch (e) {}
    }

    setConfig(config) {
      if (!config) throw new Error("Configuratie ontbreekt");
      this._config = Object.assign({}, DEFAULT_CONFIG, config);
      if (!Array.isArray(this._config.calendars)) this._config.calendars = [];
      if (!Array.isArray(this._config.todos)) this._config.todos = [];
      if (!this._config.days) this._config.days = 14;
      if (!this._addList && this._config.todos.length) this._addList = this._config.todos[0];
      this.toggleAttribute("data-compact", !!this._config.compact);
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
      if (!prev) this._measureDark();
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

    _findItem(key) {
      if (!key) return null;
      var all = this._allItems();
      for (var i = 0; i < all.length; i++) if (itemKey(all[i]) === key) return all[i];
      return null;
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
      try {
        await this._hass.callService("todo", service, data);
      } catch (e) {
        this._detailNote = { type: "err", text: "Actie mislukt — probeer opnieuw" };
        this._render();
        return;
      }
      this._lastFetch = 0;
      await this._fetchAll();
    }

    /* D20: style één keer, per update alleen de kaart vervangen + focus behouden */
    _attachStyle(root) {
      var sh = sheet();
      if (sh && "adoptedStyleSheets" in root) {
        root.adoptedStyleSheets = [sh];
        return;
      }
      var style = document.createElement("style");
      style.textContent = CSS;
      root.appendChild(style);
    }

    _captureFocus() {
      var root = this.shadowRoot;
      if (!root || !root.activeElement) return null;
      var el = root.activeElement;
      var tag = el.tagName;
      var isField = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
      var named = el.getAttribute ? el.getAttribute("data-cpc-field") : null;
      if (!isField && !named) return null;
      var sel = null;
      if (isField) { try { sel = el.selectionStart; } catch (e) {} }
      return { id: named || el.className || tag, sel: sel, value: isField ? el.value : null };
    }

    _restoreFocus(f) {
      if (!f) return;
      var root = this.shadowRoot;
      if (!root) return;
      var el = root.querySelector('[data-cpc-field="' + f.id + '"]');
      if (!el) return;
      if (f.value != null && el.value !== f.value) el.value = f.value;
      try {
        el.focus();
        if (f.sel != null && el.setSelectionRange) el.setSelectionRange(f.sel, f.sel);
      } catch (e) {}
    }

    _render() {
      var root = this.shadowRoot;
      if (!root) return;
      if (!this._styleAttached) {
        this._attachStyle(root);
        this._styleAttached = true;
      }
      var focus = this._captureFocus();
      var card = h("ha-card");
      card.appendChild(this._renderHeader());
      var body = h("div", "cpc-body");
      if (this._loading && !this._events.length && !this._tasks.length) {
        body.appendChild(this._renderSkeleton());
      } else if (this._error) {
        body.appendChild(this._renderError());
      } else if (this._view === "month") {
        body.appendChild(this._renderMonth());
      } else {
        body.appendChild(this._renderTimeline());
      }
      card.appendChild(body);
      if (this._view === "month" && this._selectedDay) {
        card.appendChild(this._renderDaySheet());
      }
      if (this._detailKey) {
        var detail = this._renderDetail();
        if (detail) card.appendChild(detail);
        else {
          this._detailKey = null;
          this._detailSnap = null;
          this._detailGone = null;
          this._detailEdit = false;
          this._detailNote = null;
        }
      }
      if (this._confirmItem) {
        card.appendChild(this._renderConfirm());
      }
      var old = root.querySelector("ha-card");
      if (old) root.removeChild(old);
      root.appendChild(card);
      this._restoreFocus(focus);
    }

    _renderSkeleton() {
      var wrap = h("div", "cpc-skel-wrap");
      for (var i = 0; i < 3; i++) {
        var day = h("div", "cpc-skel-day");
        day.appendChild(h("div", "cpc-skel cpc-skel-w", ""));
        day.appendChild(h("div", "cpc-skel", ""));
        day.appendChild(h("div", "cpc-skel cpc-skel-s", ""));
        wrap.appendChild(day);
      }
      return wrap;
    }

    _renderError() {
      var box = h("div", "cpc-status cpc-error");
      box.appendChild(h("div", "", "Kon gegevens niet laden"));
      var self = this;
      var retry = h("button", "cpc-btn", "Opnieuw");
      retry.type = "button";
      retry.addEventListener("click", function () {
        self._lastFetch = 0;
        self._fetchAll();
      });
      box.appendChild(retry);
      return box;
    }

    _renderHeader() {
      var header = h("div", "cpc-header");
      var left = h("div", "cpc-head-left");
      left.appendChild(h("div", "cpc-title", this._config.title || "Planner"));
      var sub = this._subtitle();
      if (sub) left.appendChild(h("div", "cpc-subtitle", sub));
      header.appendChild(left);
      var actions = h("div", "cpc-actions");
      var self = this;
      var seg = h("div", "cpc-seg");
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
      seg.appendChild(tl);
      seg.appendChild(mo);
      actions.appendChild(seg);
      var rf = h("button", "cpc-refresh" + (this._loading ? " spin" : ""), "");
      rf.type = "button";
      rf.title = "Vernieuwen";
      rf.setAttribute("aria-label", "Vernieuwen");
      rf.appendChild(icon("mdi:refresh"));
      rf.addEventListener("click", function () {
        self._lastFetch = 0;
        self._fetchAll();
      });
      actions.appendChild(rf);
      header.appendChild(actions);
      return header;
    }

    _subtitle() {
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var packed = this._itemsByKey(tz);
      var events = 0;
      var tasks = 0;
      var k;
      for (k in packed.map) {
        var list = packed.map[k];
        for (var i = 0; i < list.length; i++) {
          if (isEvent(list[i])) events++;
          else tasks++;
        }
      }
      for (var u = 0; u < packed.undated.length; u++) {
        if (isEvent(packed.undated[u])) events++;
        else tasks++;
      }
      var parts = [];
      if (events) parts.push(events + (events === 1 ? " afspraak" : " afspraken"));
      if (tasks) parts.push(tasks + (tasks === 1 ? " taak" : " taken"));
      if (!parts.length) return null;
      var month = new Intl.DateTimeFormat("nl-BE", { month: "short", timeZone: "UTC" })
        .format(parseDateOnly(todayKey))
        .replace(/\.$/, "");
      return dayWeekdayShort(todayKey) + " " + dayNumber(todayKey) + " " + month + " · " + parts.join(" · ");
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

    _itemsByKeyWide(tz) {
      var wide = { days: [], undated: [] };
      var all = this._allItems();
      var byKey = Object.create(null);
      var undated = [];
      for (var i = 0; i < all.length; i++) {
        var it = all[i];
        if (it.status === "completed") continue;
        var key = itemDayKey(it, tz);
        if (!key) { undated.push(it); continue; }
        if (!byKey[key]) byKey[key] = [];
        byKey[key].push(it);
      }
      for (var k in byKey) wide.days.push({ key: k, items: mixDayItems(byKey[k]) });
      wide.undated = undated;
      var map = Object.create(null);
      for (var j = 0; j < wide.days.length; j++) {
        map[wide.days[j].key] = wide.days[j].items;
      }
      return { map: map, undated: wide.undated };
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
        if (!items.length && dayKey !== todayKey) continue; /* D22: dode conditie opgeruimd */
        shown += 1;
        wrap.appendChild(this._renderDay(dayKey, items, todayKey, tz, now));
      }
      if (!shown && !packed.undated.length) {
        wrap.appendChild(h("div", "cpc-empty", "Niets gepland in de komende " + days + " dagen"));
      }
      wrap.appendChild(this._renderUndated(packed.undated, tz, now));
      wrap.appendChild(this._renderAddForm());
      return wrap;
    }

    _renderDay(dayKey, items, todayKey, tz, now) {
      var section = h("div", "cpc-day");
      if (dayKey === todayKey) section.setAttribute("data-today", "");
      var dow = parseDateOnly(dayKey).getUTCDay();
      if (dow === 0 || dow === 6) section.setAttribute("data-weekend", "");
      var head = h("div", "cpc-day-head");
      var date = h("div", "cpc-day-date");
      date.appendChild(h("div", "cpc-day-wd", dayWeekdayShort(dayKey)));
      date.appendChild(h("div", "cpc-day-num", dayNumber(dayKey)));
      head.appendChild(date);
      var meta = h("div", "cpc-day-meta");
      var label = formatDayLabel(dayKey, todayKey);
      var month = new Intl.DateTimeFormat("nl-BE", { month: "long", timeZone: "UTC" }).format(parseDateOnly(dayKey));
      meta.appendChild(h("span", "", label === "Vandaag" || label === "Morgen" ? label : month));
      if (items.length) {
        meta.appendChild(h("span", "cpc-count", String(items.length)));
      }
      head.appendChild(meta);
      section.appendChild(head);
      var body = h("div", "cpc-day-items");
      if (!items.length) {
        body.appendChild(h("div", "cpc-empty", dayKey === todayKey ? "Vandaag is vrij" : "Niets gepland"));
      } else {
        for (var i = 0; i < items.length; i++) {
          body.appendChild(this._renderItem(items[i], tz, now));
        }
      }
      section.appendChild(body);
      return section;
    }

    _friendlyName(id) {
      if (this._hass && this._hass.states && this._hass.states[id]) {
        var fn = this._hass.states[id].attributes && this._hass.states[id].attributes.friendly_name;
        if (fn) return fn;
      }
      return id;
    }

    _itemSub(item) {
      var parts = [];
      var src = item._source;
      var name = this._friendlyName(src);
      if (isEvent(item)) {
        parts.push(name);
        if (item.location) {
          var loc = h("span", "cpc-sub-loc");
          loc.appendChild(icon("mdi:map-marker-outline"));
          loc.appendChild(h("span", "", String(item.location)));
          parts.push(loc);
        }
      } else {
        parts.push(name);
      }
      var sub = h("div", "cpc-item-sub");
      for (var i = 0; i < parts.length; i++) {
        if (i > 0) sub.appendChild(h("span", "cpc-sub-sep", "·"));
        if (typeof parts[i] === "string") sub.appendChild(h("span", "", parts[i]));
        else sub.appendChild(parts[i]);
      }
      return sub;
    }

    _renderItem(item, tz, now) {
      var row = h("div", "cpc-item");
      row.style.setProperty("--cpc-src-h", String(sourceHue(item._source)));
      var overdue = !isEvent(item) && isOverdue(item, now, tz);
      if (overdue) row.classList.add("overdue");
      var self = this;
      if (isEvent(item)) {
        var start = parseEventStart(item.start);
        var allDay = !!(item.start && item.start.date && !item.start.dateTime);
        var lead = h("div", "cpc-lead");
        var timeEl = h("span", "cpc-time" + (allDay || !start ? " allday" : ""), allDay || !start ? "Hele dag" : formatTime(start, tz));
        lead.appendChild(timeEl);
        row.appendChild(lead);
        row.appendChild(h("div", "cpc-bar"));
        var bodyCol = h("button", "cpc-open cpc-body-col");
        bodyCol.type = "button";
        bodyCol.setAttribute("data-cpc-field", "row-" + itemKey(item));
        bodyCol.appendChild(h("div", "cpc-item-title", item.summary || ""));
        var sub = this._itemSub(item);
        if (sub) bodyCol.appendChild(sub);
        row.appendChild(bodyCol);
        row.appendChild(h("span", "cpc-badge", ""));
        row.appendChild(h("span", "cpc-del-spacer", ""));
        row.setAttribute("data-openable", "");
        row.addEventListener("click", function () {
          if (row._cpcSwiped) { row._cpcSwiped = false; return; }
          self._openDetail(item);
        });
        return row;
      }
      var wrap = h("label", "cpc-check-wrap");
      wrap.addEventListener("click", function (ev) { ev.stopPropagation(); });
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.className = "cpc-check";
      cb.checked = item.status === "completed";
      cb.setAttribute("aria-label", (item.summary || "taak") + (cb.checked ? " — afgevinkt" : " — afvinken"));
      if (item.uid) cb.setAttribute("data-uid", item.uid);
      var doneTimer = null;
      cb.addEventListener("change", function () {
        if (cb.checked) {
          row.classList.add("done");
          if (doneTimer) clearTimeout(doneTimer);
          doneTimer = setTimeout(function () {
            self._mutate("update_item", {
              entity_id: item._source,
              item: item.uid,
              status: "completed",
            });
          }, 400);
        } else {
          if (doneTimer) clearTimeout(doneTimer);
          self._mutate("update_item", {
            entity_id: item._source,
            item: item.uid,
            status: "needs_action",
          });
        }
      });
      wrap.appendChild(cb);
      row.appendChild(wrap);
      row.appendChild(h("div", "cpc-bar"));
      var bodyCol2 = h("button", "cpc-open cpc-body-col");
      bodyCol2.type = "button";
      bodyCol2.setAttribute("data-cpc-field", "row-" + itemKey(item));
      bodyCol2.appendChild(h("div", "cpc-item-title", item.summary || ""));
      var sub2 = this._itemSub(item);
      if (sub2) bodyCol2.appendChild(sub2);
      bodyCol2.addEventListener("click", function () {
        if (row._cpcSwiped) { row._cpcSwiped = false; return; }
        self._openDetail(item);
      });
      row.appendChild(bodyCol2);
      if (overdue) row.appendChild(h("span", "cpc-badge danger", "Te laat"));
      else row.appendChild(h("span", "cpc-badge", ""));
      var del = h("button", "cpc-del", "");
      del.type = "button";
      del.setAttribute("aria-label", "Taak «" + (item.summary || "") + "» verwijderen");
      del.appendChild(icon("mdi:trash-can-outline"));
      del.addEventListener("click", function (ev) {
        ev.stopPropagation();
        self._confirmItem = item;
        self._render();
      });
      row.appendChild(del);
      this._bindSwipe(row, item);
      return row;
    }

    _bindSwipe(row, item) {
      var self = this;
      var startX = null;
      var startY = null;
      var dx = 0;
      row.addEventListener("touchstart", function (ev) {
        if (ev.changedTouches && ev.changedTouches[0]) {
          startX = ev.changedTouches[0].clientX;
          startY = ev.changedTouches[0].clientY;
          dx = 0;
        }
      }, { passive: true });
      row.addEventListener("touchmove", function (ev) {
        if (startX == null || !ev.changedTouches || !ev.changedTouches[0]) return;
        var t = ev.changedTouches[0];
        var cx = t.clientX - startX;
        var cy = t.clientY - startY;
        if (Math.abs(cy) > Math.abs(cx)) {
          startX = null;
          row.style.transform = "";
          return;
        }
        dx = Math.max(-72, Math.min(0, cx));
        row.style.transform = "translateX(" + dx + "px)";
      }, { passive: true });
      row.addEventListener("touchend", function (ev) {
        if (startX == null) return;
        startX = null;
        row.style.transform = "";
        if (Math.abs(dx) > 6) row._cpcSwiped = true;
        if (dx < -60) {
          self._confirmItem = item;
          self._render();
        }
      }, { passive: true });
    }

    _renderUndated(items, tz, now) {
      var box = h("div", "cpc-section");
      if (!this._undatedOpen) box.setAttribute("data-open", "");
      var self = this;
      var head = h("button", "cpc-section-head");
      head.type = "button";
      head.setAttribute("aria-expanded", this._undatedOpen ? "true" : "false");
      var label = h("span", "cpc-section-label");
      label.appendChild(h("span", "", "Zonder datum"));
      label.appendChild(h("span", "cpc-count", String(items.length)));
      head.appendChild(label);
      var chev = h("span", "cpc-chev");
      chev.appendChild(icon("mdi:chevron-down"));
      head.appendChild(chev);
      head.addEventListener("click", function () {
        self._undatedOpen = !self._undatedOpen;
        self._render();
      });
      box.appendChild(head);
      if (this._undatedOpen && items.length) {
        var body = h("div", "cpc-section-body");
        for (var i = 0; i < items.length; i++) {
          body.appendChild(this._renderItem(items[i], tz, now));
        }
        box.appendChild(body);
      }
      return box;
    }

    _syncAddPlus(plus) {
      if (!plus) return;
      var empty = !(this._addTitle || "").trim();
      plus.classList.toggle("disabled", empty);
      plus.disabled = empty;
    }

    _addTask() {
      var name = (this._addTitle || "").trim();
      var todos = this._config.todos || [];
      if (!name || !todos.length) return;
      var entity = this._addList || todos[0];
      var data = { entity_id: entity, item: name };
      if (this._addDue) data.due_date = this._addDue;
      this._addTitle = "";
      this._addDue = "";
      this._mutate("add_item", data);
    }

    _renderAddForm() {
      var form = h("div", "cpc-add");
      var self = this;
      var field = h("div", "cpc-add-field");
      var plus = h("button", "cpc-add-plus", "");
      plus.type = "button";
      plus.setAttribute("aria-label", "Taak toevoegen");
      plus.appendChild(icon("mdi:plus"));
      plus.addEventListener("click", function () {
        self._addTask();
      });
      var title = document.createElement("input");
      title.type = "text";
      title.placeholder = "Nieuwe taak…";
      title.value = this._addTitle;
      title.setAttribute("data-cpc-field", "add-title");
      title.setAttribute("aria-label", "Nieuwe taak");
      title.addEventListener("input", function () {
        self._addTitle = title.value;
        self._syncAddPlus(plus);
      });
      title.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") self._addTask();
      });
      field.appendChild(plus);
      field.appendChild(title);
      form.appendChild(field);
      this._syncAddPlus(plus);

      var extra = h("div", "cpc-extra" + (this._addDue ? " open" : ""));
      var tz = this._timeZone();
      var todayKey = brusselsDayKey(new Date(), tz);
      var chips = h("div", "cpc-chips");
      var chipToday = h("button", "cpc-chip" + (this._addDue === todayKey ? " active" : ""), "Vandaag");
      chipToday.type = "button";
      chipToday.setAttribute("aria-pressed", this._addDue === todayKey ? "true" : "false");
      chipToday.addEventListener("click", function () {
        self._addDue = self._addDue === todayKey ? "" : todayKey;
        self._render();
      });
      chips.appendChild(chipToday);
      var tomorrowKey = addDaysToKey(todayKey, 1);
      var chipTomorrow = h("button", "cpc-chip" + (this._addDue === tomorrowKey ? " active" : ""), "Morgen");
      chipTomorrow.type = "button";
      chipTomorrow.setAttribute("aria-pressed", this._addDue === tomorrowKey ? "true" : "false");
      chipTomorrow.addEventListener("click", function () {
        self._addDue = self._addDue === tomorrowKey ? "" : tomorrowKey;
        self._render();
      });
      chips.appendChild(chipTomorrow);
      var due = document.createElement("input");
      due.type = "date";
      due.value = this._addDue;
      due.setAttribute("data-cpc-field", "add-due");
      due.setAttribute("aria-label", "Vervaldatum");
      due.addEventListener("input", function () {
        self._addDue = due.value;
        self._render();
      });
      chips.appendChild(due);
      extra.appendChild(chips);

      var todos = this._config.todos || [];
      if (todos.length > 1) {
        var listChips = h("div", "cpc-chips");
        for (var i = 0; i < todos.length; i++) {
          (function (tid) {
            var name = self._friendlyName(tid);
            var chip = h("button", "cpc-chip" + ((self._addList || todos[0]) === tid ? " active" : ""), name);
            chip.type = "button";
            chip.setAttribute("aria-pressed", (self._addList || todos[0]) === tid ? "true" : "false");
            chip.addEventListener("click", function () {
              self._addList = tid;
              self._render();
            });
            listChips.appendChild(chip);
          })(todos[i]);
        }
        extra.appendChild(listChips);
      }
      form.appendChild(extra);
      return form;
    }

    _cellLabel(cell, n) {
      var d = parseDateOnly(cell.key);
      var date = new Intl.DateTimeFormat("nl-BE", { day: "numeric", month: "long", timeZone: "UTC" }).format(d);
      return date + (n ? ", " + n + (n === 1 ? " item" : " items") : "");
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
      var head = h("div", "cpc-month-head");
      var self = this;
      var prev = h("button", "cpc-month-nav", "");
      prev.type = "button";
      prev.setAttribute("aria-label", "Vorige maand");
      prev.appendChild(icon("mdi:chevron-left"));
      prev.addEventListener("click", function () {
        self._monthOffset = (self._monthOffset || 0) - 1;
        self._render();
      });
      head.appendChild(prev);
      head.appendChild(h("div", "cpc-month-name", monthName.charAt(0).toUpperCase() + monthName.slice(1)));
      var todayBtn = h("button", "cpc-month-today", "Vandaag");
      todayBtn.type = "button";
      todayBtn.addEventListener("click", function () {
        self._monthOffset = 0;
        self._selectedDay = null;
        self._render();
      });
      head.appendChild(todayBtn);
      var next = h("button", "cpc-month-nav", "");
      next.type = "button";
      next.setAttribute("aria-label", "Volgende maand");
      next.appendChild(icon("mdi:chevron-right"));
      next.addEventListener("click", function () {
        self._monthOffset = (self._monthOffset || 0) + 1;
        self._render();
      });
      head.appendChild(next);
      wrap.appendChild(head);
      // bronlegenda: één kleurbolletje per gebruikte agenda/lijst (vriendelijke naam)
      var legend = h("div", "cpc-legend");
      var bronnen = [];
      var gezien = Object.create(null);
      var alleItems = this._allItems();
      for (var bi = 0; bi < alleItems.length; bi++) {
        var bsrc = String(alleItems[bi]._source || "");
        if (bsrc && !gezien[bsrc]) {
          gezien[bsrc] = true;
          bronnen.push(bsrc);
        }
      }
      for (var li = 0; li < bronnen.length; li++) {
        var bid = bronnen[li];
        var litem = h("span", "cpc-legend-item");
        var ldot = h("span", "cpc-legend-dot");
        ldot.style.setProperty("--cpc-src-h", String(sourceHue(bid)));
        litem.appendChild(ldot);
        var st = this._hass && this._hass.states && this._hass.states[bid];
        var naam = (st && st.attributes && st.attributes.friendly_name) || bid;
        litem.appendChild(document.createTextNode(naam));
        legend.appendChild(litem);
      }
      if (bronnen.length) wrap.appendChild(legend);
      var wd = h("div", "cpc-weekdays");
      var names = ["ma", "di", "wo", "do", "vr", "za", "zo"];
      for (var i = 0; i < names.length; i++) {
        wd.appendChild(h("span", i >= 5 ? "we" : "", names[i]));
      }
      wrap.appendChild(wd);
      var grid = h("div", "cpc-grid");
      var packed = this._itemsByKeyWide(tz);
      var cells = monthCells(cy, cm);
      for (var c = 0; c < cells.length; c++) {
        (function (cell) {
          var cls = "cpc-cell" + (cell.inMonth ? "" : " out");
          var dow = parseDateOnly(cell.key).getUTCDay();
          if (dow === 0 || dow === 6) cls += " we";
          if (cell.key === todayKey) cls += " today";
          if (cell.key === self._selectedDay) cls += " selected";
          var btn = h("button", cls);
          btn.type = "button";
          if (cell.key === todayKey) btn.setAttribute("aria-current", "date");
          var items = packed.map[cell.key] || [];
          btn.setAttribute("aria-label", self._cellLabel(cell, items.length));
          btn.appendChild(h("div", "cpc-cell-num", String(cell.day)));
          var dots = h("div", "cpc-dots");
          var ordered = [];
          for (var o = 0; o < items.length; o++) {
            if (!isEvent(items[o]) && isOverdue(items[o], now, tz)) ordered.push(items[o]);
          }
          for (var o2 = 0; o2 < items.length; o2++) {
            if (isEvent(items[o2]) || !isOverdue(items[o2], now, tz)) ordered.push(items[o2]);
          }
          var shown = 0;
          var max = 3;
          for (var d = 0; d < ordered.length && shown < max; d++) {
            var it = ordered[d];
            var dot = h("span", "cpc-dot" + (isEvent(it) ? "" : " task") + (!isEvent(it) && isOverdue(it, now, tz) ? " overdue" : ""));
            dot.style.setProperty("--cpc-src-h", String(sourceHue(it._source)));
            dots.appendChild(dot);
            shown++;
          }
          if (items.length > max) dots.appendChild(h("span", "cpc-more", "+" + (items.length - max)));
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

    _renderDaySheet() {
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var sheet = h("div", "cpc-daysheet");
      var head = h("div", "cpc-daysheet-head");
      head.appendChild(h("span", "", formatDayLabel(this._selectedDay, todayKey)));
      var self = this;
      var close = h("button", "cpc-btn", "Sluiten");
      close.type = "button";
      close.addEventListener("click", function () {
        self._selectedDay = null;
        self._render();
      });
      head.appendChild(close);
      sheet.appendChild(head);
      var packed = this._itemsByKeyWide(tz);
      var items = packed.map[this._selectedDay] || [];
      if (!items.length) {
        sheet.appendChild(h("div", "cpc-empty", "Niets gepland"));
      } else {
        for (var i = 0; i < items.length; i++) {
          sheet.appendChild(this._renderItem(items[i], tz, now));
        }
      }
      var addBtn = h("button", "cpc-btn cpc-daysheet-add", "+ taak op deze dag");
      addBtn.type = "button";
      addBtn.addEventListener("click", function () {
        self._addDue = self._selectedDay;
        self._view = "timeline";
        self._selectedDay = null;
        self._render();
        var inp = self.shadowRoot && self.shadowRoot.querySelector('[data-cpc-field="add-title"]');
        if (inp) {
          try {
            inp.focus();
          } catch (e) {}
        }
      });
      sheet.appendChild(addBtn);
      sheet.setAttribute("tabindex", "-1");
      sheet.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          self._selectedDay = null;
          self._render();
        }
      });
      setTimeout(function () {
        try { sheet.focus(); } catch (e) {}
      }, 30);
      return sheet;
    }

    _openDetail(item) {
      if (!item) return;
      this._detailKey = itemKey(item);
      this._detailSnap = item;
      this._detailGone = null;
      this._detailEdit = false;
      this._detailNote = null;
      this._detailFocused = false;
      this._detailDescOpen = false;
      var todosOpen = (this._config && this._config.todos) || [];
      if (!this._detailAddList || todosOpen.indexOf(this._detailAddList) === -1) {
        this._detailAddList = todosOpen[0] || "";
      }
      this._render();
    }

    _closeDetail(returnFocus) {
      var key = this._detailKey;
      this._detailKey = null;
      this._detailSnap = null;
      this._detailGone = null;
      this._detailEdit = false;
      this._detailNote = null;
      this._detailDescOpen = false;
      this._render();
      if (returnFocus !== false && key) {
        var back = this.shadowRoot && this.shadowRoot.querySelector('[data-cpc-field="row-' + key + '"]');
        if (back) { try { back.focus(); } catch (e) {} }
      }
    }

    _detailCloseBtn() {
      var self = this;
      var close = h("button", "cpc-detail-close");
      close.type = "button";
      close.setAttribute("aria-label", "Sluiten");
      close.setAttribute("data-cpc-field", "detail-close");
      close.appendChild(icon("mdi:close"));
      close.addEventListener("click", function () { self._closeDetail(true); });
      return close;
    }

    _appendCollapsibleDesc(col, text) {
      var self = this;
      var raw = stripHtmlish(text);
      var desc = h("div", "cpc-detail-desc" + (!this._detailDescOpen && descriptionNeedsCollapse(raw) ? " collapsed" : ""));
      appendLinkedText(desc, raw);
      col.appendChild(desc);
      if (descriptionNeedsCollapse(raw)) {
        var more = h("button", "cpc-detail-more", this._detailDescOpen ? "Minder tonen" : "Meer tonen");
        more.type = "button";
        more.setAttribute("data-cpc-field", "detail-desc-more");
        more.addEventListener("click", function () {
          self._detailDescOpen = !self._detailDescOpen;
          self._render();
        });
        col.appendChild(more);
      }
    }

    _bindSheetSwipe(sheetEl) {
      var self = this;
      var startY = null;
      var startX = null;
      var sheetTop = 0;
      sheetEl.addEventListener("touchstart", function (ev) {
        if (!ev.touches || !ev.touches.length) return;
        var t = ev.touches[0];
        startY = t.clientY;
        startX = t.clientX;
        try {
          sheetTop = sheetEl.getBoundingClientRect().top;
        } catch (e) {
          sheetTop = 0;
        }
      }, { passive: true });
      sheetEl.addEventListener("touchend", function (ev) {
        if (startY == null) return;
        var t = ev.changedTouches && ev.changedTouches[0];
        if (!t) { startY = null; return; }
        var should = sheetSwipeShouldClose({
          startY: startY,
          startX: startX,
          endY: t.clientY,
          endX: t.clientX,
          sheetTop: sheetTop,
          scrollTop: sheetEl.scrollTop || 0,
        });
        startY = null;
        if (should) self._closeDetail(true);
      }, { passive: true });
    }

    _actionBtn(className, field, iconName, label, handler) {

      var b = h("button", className);
      b.type = "button";
      if (field) b.setAttribute("data-cpc-field", field);
      if (iconName) {
        b.appendChild(icon(iconName));
        b.appendChild(document.createTextNode(" " + label));
      } else {
        b.textContent = label;
      }
      if (handler) b.addEventListener("click", handler);
      return b;
    }

    _detailNoteEl() {
      if (!this._detailNote) return null;
      var note = h("div", "cpc-detail-note " + (this._detailNote.type || ""), this._detailNote.text || "");
      note.setAttribute("role", "status");
      return note;
    }

    _detailTargetList() {
      var todos = (this._config && this._config.todos) || [];
      if (this._detailAddList && todos.indexOf(this._detailAddList) !== -1) return this._detailAddList;
      return todos[0] || "";
    }

    _eventAlreadyInTasks(ev) {
      var entity = this._detailTargetList();
      if (!entity || !ev) return null;
      var tz = this._timeZone();
      var start = parseEventStart(ev.start);
      return matchingOpenTask(this._tasks, {
        title: ev.summary || "",
        entityId: entity,
        dueKey: start ? brusselsDayKey(start, tz) : "",
        matchDay: isAllDayEvent(ev),
        tz: tz,
      });
    }

    _detailAddEventToTasks(ev) {
      var todos = this._config.todos || [];
      if (!todos.length) return;
      if (this._eventAlreadyInTasks(ev)) {
        this._detailNote = { type: "ok", text: "Staat al in je taken" };
        this._render();
        return;
      }
      var entity = this._detailTargetList();
      var tz = this._timeZone();
      var start = parseEventStart(ev.start);
      var data = {
        entity_id: entity,
        item: String(ev.summary || "Afspraak"),
      };
      var key = start ? brusselsDayKey(start, tz) : null;
      if (key) data.due_date = key;
      this._detailNote = { type: "ok", text: "Toegevoegd aan " + this._friendlyName(entity) };
      this._mutate("add_item", data);
    }

    _detailToggleDone() {
      var item = this._findItem(this._detailKey) || this._detailSnap;
      if (!item) return;
      if (this._detailGone === "done") {
        this._detailGone = null;
        this._detailNote = { type: "ok", text: "Teruggezet" };
        this._mutate("update_item", { entity_id: item._source, item: item.uid, status: "needs_action" });
        return;
      }
      this._detailGone = "done";
      this._detailSnap = item;
      this._detailNote = { type: "ok", text: "Afgevinkt." };
      this._mutate("update_item", { entity_id: item._source, item: item.uid, status: "completed" });
    }

    _detailStartEdit() {
      var item = this._findItem(this._detailKey) || this._detailSnap;
      if (!item) return;
      this._detailEdit = true;
      this._detailTitle = item.summary || "";
      var due = parseDue(item.due);
      this._detailDue = due ? brusselsDayKey(due, this._timeZone()) : "";
      this._detailDesc = item.description || "";
      this._detailNote = null;
      this._render();
    }

    _detailCancelEdit() {
      this._detailEdit = false;
      this._detailNote = null;
      this._render();
    }

    _detailSave() {
      var item = this._findItem(this._detailKey);
      if (!item) return;
      var title = (this._detailTitle || "").trim();
      if (!title) { this._detailNote = { type: "err", text: "Titel mag niet leeg zijn" }; this._render(); return; }
      var hadDue = !!parseDue(item.due);
      var data = { entity_id: item._source, item: item.uid, rename: title };
      if (this._detailDue) data.due_date = this._detailDue;
      else if (hadDue) data.due_date = null;
      var desc = (this._detailDesc || "").trim();
      data.description = desc ? desc : null;
      this._detailEdit = false;
      this._detailNote = { type: "ok", text: "Opgeslagen" };
      if (!item.uid) {
        this._detailKey = null;
        this._detailSnap = null;
        this._detailGone = null;
      }
      this._mutate("update_item", data);
    }

    _renderDetail() {
      var key = this._detailKey;
      var item = this._findItem(key);
      if (!item) {
        if (this._detailGone === "done" && this._detailSnap) item = this._detailSnap;
        else return null;
      } else {
        this._detailSnap = item;
        if (this._detailGone && item.status !== "completed") this._detailGone = null;
      }
      var self = this;
      var overlay = h("div", "cpc-detail");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      var titleId = "cpc-det-title-" + (++DETAIL_UID);
      overlay.setAttribute("aria-labelledby", titleId);
      var sheetEl = h("div", "cpc-detail-sheet");
      sheetEl.setAttribute("tabindex", "-1");
      sheetEl.style.setProperty("--cpc-src-h", String(sourceHue(item._source)));
      sheetEl.appendChild(h("div", "cpc-detail-accent"));
      if (isEvent(item)) this._renderDetailEvent(sheetEl, item, titleId);
      else this._renderDetailTask(sheetEl, item, titleId);
      overlay.appendChild(sheetEl);
      this._bindSheetSwipe(sheetEl);
      overlay.addEventListener("click", function (ev) { if (ev.target === overlay) self._closeDetail(true); });
      overlay.addEventListener("keydown", function (ev) {
        if (ev.key === "Tab") {
          trapTab(ev, sheetFocusables(sheetEl));
          return;
        }
        if (ev.key !== "Escape") return;
        ev.stopPropagation();
        if (self._detailEdit) { self._detailCancelEdit(); return; }
        self._closeDetail(true);
      });
      if (!this._detailFocused) {
        this._detailFocused = true;
        setTimeout(function () { try { sheetEl.focus(); } catch (e) {} }, 30);
      }
      return overlay;
    }

    _renderDetailEvent(sheetEl, item, titleId) {
      var self = this;
      var tz = this._timeZone();
      var todayKey = brusselsDayKey(new Date(), tz);
      var head = h("div", "cpc-detail-head");
      var h2 = h("h2", "cpc-detail-title", item.summary || "");
      h2.id = titleId;
      head.appendChild(h2);
      head.appendChild(this._detailCloseBtn());
      sheetEl.appendChild(head);

      var when = formatEventWhen(item, tz, todayKey);
      var whenEl = h("div", "cpc-detail-when");
      whenEl.appendChild(document.createTextNode(when.main));
      if (when.rel) whenEl.appendChild(h("span", "cpc-when-rel", " · " + when.rel));
      sheetEl.appendChild(whenEl);

      var start = parseEventStart(item.start);
      var end = eventEndDate(item);
      var multi = false;
      if (start && end) {
        var sKey = brusselsDayKey(start, tz);
        if (isAllDayEvent(item)) multi = addDaysToKey(brusselsDayKey(end, tz), -1) > sKey;
        else multi = brusselsDayKey(end, tz) !== sKey;
      }
      if (isAllDayEvent(item) || multi) {
        var badges = h("div", "cpc-detail-badges");
        if (isAllDayEvent(item)) badges.appendChild(h("span", "cpc-badge", "Hele dag"));
        if (multi) badges.appendChild(h("span", "cpc-badge", "Meerdaags"));
        sheetEl.appendChild(badges);
      }

      var body = h("div", "cpc-detail-body");
      if (item.location) {
        var locRow = h("div", "cpc-detail-row");
        locRow.appendChild(icon("mdi:map-marker-outline"));
        var loc = document.createElement("a");
        loc.className = "cpc-detail-loc";
        loc.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(String(item.location));
        loc.target = "_blank";
        loc.rel = "noopener noreferrer";
        loc.textContent = String(item.location);
        locRow.appendChild(loc);
        body.appendChild(locRow);
      }
      if (item.description) {
        var dRow = h("div", "cpc-detail-row");
        dRow.appendChild(icon("mdi:text-long"));
        var dCol = h("div");
        dCol.appendChild(h("div", "cpc-detail-label", "Beschrijving"));
        this._appendCollapsibleDesc(dCol, item.description);
        dRow.appendChild(dCol);
        body.appendChild(dRow);
      }
      var sRow = h("div", "cpc-detail-row");
      sRow.appendChild(icon("mdi:calendar-blank-outline"));
      var sCol = h("div");
      sCol.appendChild(h("div", "cpc-detail-label", "Agenda"));
      var src = h("span", "cpc-detail-src");
      src.appendChild(h("span", "cpc-detail-dot"));
      src.appendChild(document.createTextNode(this._friendlyName(item._source)));
      sCol.appendChild(src);
      sRow.appendChild(sCol);
      body.appendChild(sRow);
      sheetEl.appendChild(body);

      var note = this._detailNoteEl();
      if (note) sheetEl.appendChild(note);

      var todos = this._config.todos || [];
      if (todos.length > 1) {
        var listChips = h("div", "cpc-chips");
        for (var ci = 0; ci < todos.length; ci++) {
          (function (tid) {
            var name = self._friendlyName(tid);
            var on = (self._detailTargetList() === tid);
            var chip = h("button", "cpc-chip" + (on ? " active" : ""), name);
            chip.type = "button";
            chip.setAttribute("aria-pressed", on ? "true" : "false");
            chip.setAttribute("data-cpc-field", "detail-list-" + tid);
            chip.addEventListener("click", function () {
              self._detailAddList = tid;
              self._render();
            });
            listChips.appendChild(chip);
          })(todos[ci]);
        }
        sheetEl.appendChild(listChips);
      }

      var actions = h("div", "cpc-detail-actions");
      if (todos.length) {
        var already = this._eventAlreadyInTasks(item);
        var addLabel = already ? "Staat al in je taken" : "Toevoegen aan taken";
        var addBtn = this._actionBtn("cpc-btn primary", "detail-add", "mdi:plus", addLabel, already ? null : function () {
          self._detailAddEventToTasks(item);
        });
        if (already) {
          addBtn.disabled = true;
          addBtn.setAttribute("disabled", "");
        }
        actions.appendChild(addBtn);
      }
      actions.appendChild(h("div", "cpc-detail-spacer"));
      actions.appendChild(this._actionBtn("cpc-btn", "detail-dismiss", null, "Sluiten", function () { self._closeDetail(true); }));
      sheetEl.appendChild(actions);
    }

    _renderDetailTask(sheetEl, item, titleId) {
      var self = this;
      var tz = this._timeZone();
      var now = new Date();
      var todayKey = brusselsDayKey(now, tz);
      var gone = this._detailGone === "done";
      var overdue = !gone && isOverdue(item, now, tz);

      var head = h("div", "cpc-detail-head");
      var h2 = h("h2", "cpc-detail-title", item.summary || "");
      h2.id = titleId;
      head.appendChild(h2);
      head.appendChild(this._detailCloseBtn());
      sheetEl.appendChild(head);

      var whenEl = h("div", "cpc-detail-when" + (overdue ? " overdue" : ""));
      var due = parseDue(item.due);
      if (!due) {
        whenEl.appendChild(document.createTextNode("Geen vervaldatum"));
      } else {
        var dKey = brusselsDayKey(due, tz);
        var rel = relDayLabel(dKey, todayKey);
        whenEl.appendChild(document.createTextNode("Vervalt " + formatDayShort(dKey)));
        if (rel) whenEl.appendChild(h("span", "cpc-when-rel", " · " + rel));
      }
      sheetEl.appendChild(whenEl);

      var badges = h("div", "cpc-detail-badges");
      if (overdue) badges.appendChild(h("span", "cpc-badge danger", "Te laat"));
      badges.appendChild(h("span", "cpc-badge", gone ? "Afgevinkt" : (item.status === "completed" ? "Afgevinkt" : "Open")));
      sheetEl.appendChild(badges);

      var body = h("div", "cpc-detail-body");
      var lRow = h("div", "cpc-detail-row");
      lRow.appendChild(icon("mdi:format-list-checks"));
      var lCol = h("div");
      lCol.appendChild(h("div", "cpc-detail-label", "Lijst"));
      var lsrc = h("span", "cpc-detail-src");
      lsrc.appendChild(h("span", "cpc-detail-dot task"));
      lsrc.appendChild(document.createTextNode(this._friendlyName(item._source)));
      lCol.appendChild(lsrc);
      lRow.appendChild(lCol);
      body.appendChild(lRow);
      if (item.description) {
        var nRow = h("div", "cpc-detail-row");
        nRow.appendChild(icon("mdi:text-long"));
        var nCol = h("div");
        nCol.appendChild(h("div", "cpc-detail-label", "Notitie"));
        this._appendCollapsibleDesc(nCol, item.description);
        nRow.appendChild(nCol);
        body.appendChild(nRow);
      }
      sheetEl.appendChild(body);

      if (this._detailEdit && !gone) {
        var edit = h("div", "cpc-detail-edit");
        var labTitle = document.createElement("label");
        labTitle.appendChild(document.createTextNode("Titel"));
        var titleIn = document.createElement("input");
        titleIn.type = "text";
        titleIn.value = this._detailTitle;
        titleIn.setAttribute("data-cpc-field", "detail-title");
        titleIn.addEventListener("input", function () { self._detailTitle = titleIn.value; });
        titleIn.addEventListener("keydown", function (ev) {
          if (ev.key === "Enter") { ev.preventDefault(); self._detailSave(); }
        });
        labTitle.appendChild(titleIn);
        edit.appendChild(labTitle);
        var labDue = document.createElement("label");
        labDue.appendChild(document.createTextNode("Vervaldatum"));
        var dueIn = document.createElement("input");
        dueIn.type = "date";
        dueIn.value = this._detailDue || "";
        dueIn.setAttribute("data-cpc-field", "detail-due");
        dueIn.addEventListener("input", function () {
          self._detailDue = dueIn.value;
          self._render();
        });
        labDue.appendChild(dueIn);
        edit.appendChild(labDue);
        var labNote = document.createElement("label");
        labNote.appendChild(document.createTextNode("Notitie"));
        var noteIn = document.createElement("textarea");
        noteIn.rows = 3;
        noteIn.value = this._detailDesc || "";
        noteIn.setAttribute("data-cpc-field", "detail-desc");
        noteIn.addEventListener("input", function () { self._detailDesc = noteIn.value; });
        labNote.appendChild(noteIn);
        edit.appendChild(labNote);
        var chips = h("div", "cpc-chips");
        function addChip(label, value) {
          var pressed = value === "" ? !self._detailDue : self._detailDue === value;
          var chip = h("button", "cpc-chip" + (pressed ? " active" : ""), label);
          chip.type = "button";
          chip.setAttribute("aria-pressed", pressed ? "true" : "false");
          chip.addEventListener("click", function () {
            self._detailDue = value;
            self._render();
          });
          chips.appendChild(chip);
        }
        addChip("Vandaag", todayKey);
        addChip("Morgen", addDaysToKey(todayKey, 1));
        addChip("Geen datum", "");
        edit.appendChild(chips);
        sheetEl.appendChild(edit);
      }

      var note = this._detailNoteEl();
      if (note) sheetEl.appendChild(note);

      var actions = h("div", "cpc-detail-actions");
      if (gone) {
        actions.appendChild(this._actionBtn("cpc-btn ghost", "detail-undo", null, "Ongedaan maken", function () { self._detailToggleDone(); }));
        actions.appendChild(h("div", "cpc-detail-spacer"));
        actions.appendChild(this._actionBtn("cpc-btn primary", "detail-dismiss", null, "Sluiten", function () { self._closeDetail(true); }));
      } else if (this._detailEdit) {
        actions.appendChild(this._actionBtn("cpc-btn", "detail-cancel", null, "Annuleren", function () { self._detailCancelEdit(); }));
        actions.appendChild(h("div", "cpc-detail-spacer"));
        actions.appendChild(this._actionBtn("cpc-btn primary", "detail-save", null, "Opslaan", function () { self._detailSave(); }));
      } else {
        actions.appendChild(this._actionBtn("cpc-btn primary", "detail-done", "mdi:check", "Afvinken", function () { self._detailToggleDone(); }));
        actions.appendChild(this._actionBtn("cpc-btn ghost", "detail-edit", "mdi:pencil-outline", "Bewerken", function () { self._detailStartEdit(); }));
        actions.appendChild(h("div", "cpc-detail-spacer"));
        actions.appendChild(this._actionBtn("cpc-btn quiet", "detail-del", "mdi:trash-can-outline", "Verwijderen", function () {
          self._confirmItem = item;
          self._render();
        }));
        actions.appendChild(this._actionBtn("cpc-btn", "detail-dismiss", null, "Sluiten", function () { self._closeDetail(true); }));
      }
      sheetEl.appendChild(actions);
    }

    _renderConfirm() {
      var overlay = h("div", "cpc-confirm");
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      overlay.setAttribute("aria-label", "Taak verwijderen");
      var box = h("div", "cpc-confirm-box");
      var name = this._confirmItem && this._confirmItem.summary ? this._confirmItem.summary : "";
      box.appendChild(h("p", "", "«" + name + "» verwijderen?"));
      var actions = h("div", "cpc-confirm-actions");
      var self = this;
      var cancel = h("button", "cpc-btn", "Annuleren");
      cancel.type = "button";
      cancel.addEventListener("click", function () {
        self._confirmItem = null;
        self._render();
      });
      var ok = h("button", "cpc-btn danger", "Verwijderen");
      ok.type = "button";
      ok.addEventListener("click", function () {
        var item = self._confirmItem;
        self._confirmItem = null;
        if (item && itemKey(item) === self._detailKey) {
          self._detailKey = null;
          self._detailSnap = null;
          self._detailGone = null;
          self._detailEdit = false;
        }
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
      overlay.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape") {
          self._confirmItem = null;
          self._render();
        }
      });
      overlay.addEventListener("click", function (ev) {
        if (ev.target === overlay) {
          self._confirmItem = null;
          self._render();
        }
      });
      setTimeout(function () {
        try {
          cancel.focus();
        } catch (e) {}
      }, 0);
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
    sourceHue: sourceHue,
    itemKey: itemKey,
    formatEventWhen: formatEventWhen,
    matchingOpenTask: matchingOpenTask,
    nextTrapTarget: nextTrapTarget,
    trapTab: trapTab,
    descriptionNeedsCollapse: descriptionNeedsCollapse,
    sheetSwipeShouldClose: sheetSwipeShouldClose,
    dayWeekdayShort: dayWeekdayShort,
    dayNumber: dayNumber,
    VERSION: VERSION,
    DEFAULT_CONFIG: DEFAULT_CONFIG,
  };

  if (typeof console !== "undefined" && console.info) {
    console.info("calendar-planner-card v" + VERSION + " geladen");
  }
})(typeof globalThis !== "undefined" ? globalThis : window);
