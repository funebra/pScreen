/* -----------------------------------------------------------
   Funebra™ pScreen — core
   Pure DOM grid engine: state, grid build, painting, helpers.
   Designed to be used by pScreen.scan.js + pScreen.bn.js.

   Export:
     pScreenCore({ root? }) -> app
     app exposes:
       - state (cols, rows, cell, threshold, px[])
       - buildGrid(keep)
       - clear(), invert(), setCell(i,v), toggleCell(i)
       - paintToDOM(), updateMeta()
       - idx(x,y), xy(i)
       - refs: screen, ui elements
----------------------------------------------------------- */

export function pScreenCore(opts = {}) {
  const $ = (id) => document.getElementById(id);

  // --- required element
  const screen = opts.screen || $("screen");
  if (!screen) throw new Error("pScreen.core: #screen element not found.");

  // --- UI bindings (optional but recommended)
  const ui = {
    colsR: $("cols"),
    rowsR: $("rows"),
    cellR: $("cell"),
    thrR: $("thr"),

    colsVal: $("colsVal"),
    rowsVal: $("rowsVal"),
    cellVal: $("cellVal"),
    thrVal: $("thrVal"),

    preset: $("preset"),

    scanBtn: $("scanBtn"),
    clearBtn: $("clearBtn"),
    invertBtn: $("invertBtn"),
    exportBtn: $("exportBtn"),
    resetBtn: $("resetBtn"),

    out: $("out"),
    activePx: $("activePx"),
    bnCount: $("bnCount"),
    com: $("com"),
    sym: $("sym"),

    densityPill: $("densityPill"),
    coordPill: $("coordPill"),
    modePill: $("modePill"),

    ogBtn: $("ogBtn"),
    ogPreview: $("ogPreview")
  };

  // --- state
  const state = {
    cols: ui.colsR ? +ui.colsR.value : 32,
    rows: ui.rowsR ? +ui.rowsR.value : 18,
    cell: ui.cellR ? +ui.cellR.value : 18,
    threshold: ui.thrR ? (+ui.thrR.value / 100) : 0.5,
    px: []
  };

  // --- pointer paint state
  let isDown = false;
  let paintMode = "paint"; // paint | erase
  let lastIndex = -1;

  // --- helpers
  function idx(x, y) { return y * state.cols + x; }
  function xy(i) { return [i % state.cols, Math.floor(i / state.cols)]; }

  function setCSSGrid() {
    screen.style.setProperty("--cols", state.cols);
    screen.style.setProperty("--rows", state.rows);
    screen.style.setProperty("--cell", state.cell + "px");
  }

  function paintToDOM() {
    const nodes = screen.children;
    for (let i = 0; i < nodes.length; i++) {
      const on = state.px[i] >= state.threshold;
      nodes[i].classList.toggle("on", !!on);
    }
  }

  function updateMeta() {
    const total = state.px.length || 0;
    let active = 0;
    for (let i = 0; i < total; i++) if (state.px[i] >= state.threshold) active++;

    if (ui.activePx) ui.activePx.textContent = String(active);

    const density = total ? (active / total) * 100 : 0;
    if (ui.densityPill) ui.densityPill.textContent = `Density: ${density.toFixed(2)}%`;
  }

  function buildGrid(keep = false) {
    setCSSGrid();
    const total = state.cols * state.rows;

    if (!keep || state.px.length !== total) {
      state.px = new Array(total).fill(0);
    }

    screen.innerHTML = "";
    const frag = document.createDocumentFragment();
    for (let i = 0; i < total; i++) {
      const d = document.createElement("div");
      d.className = "px";
      d.dataset.i = String(i);
      frag.appendChild(d);
    }
    screen.appendChild(frag);

    paintToDOM();
    updateMeta();
  }

  function setCell(i, v) {
    if (i < 0 || i >= state.px.length) return;
    state.px[i] = v ? 1 : 0;

    const node = screen.children[i];
    if (node) {
      node.classList.toggle("on", state.px[i] >= state.threshold);
      node.classList.add("hit");
      setTimeout(() => node.classList.remove("hit"), 90);
    }
  }

  function toggleCell(i) {
    setCell(i, state.px[i] ? 0 : 1);
  }

  function clear() {
    state.px.fill(0);
    paintToDOM();
    updateMeta();
  }

  function invert() {
    for (let i = 0; i < state.px.length; i++) state.px[i] = state.px[i] ? 0 : 1;
    paintToDOM();
    updateMeta();
  }

  function setModeFromEvent(e) {
    paintMode = e.shiftKey ? "erase" : "paint";
    if (ui.modePill) ui.modePill.textContent = "Mode: " + (paintMode === "erase" ? "Erase" : "Paint");
  }

  function handlePointerAt(target, e) {
    if (!target || !target.classList.contains("px")) return;
    const i = +target.dataset.i;
    if (i === lastIndex) return;
    lastIndex = i;

    const [x, y] = xy(i);
    if (ui.coordPill) ui.coordPill.textContent = `x: ${x}  y: ${y}`;

    if (e.ctrlKey) {
      toggleCell(i);
    } else {
      setCell(i, paintMode === "paint" ? 1 : 0);
    }

    updateMeta();
  }

  // --- wire pointer painting on the grid
  function bindPaintEvents() {
    screen.addEventListener("pointerdown", (e) => {
      isDown = true;
      lastIndex = -1;
      screen.setPointerCapture(e.pointerId);
      setModeFromEvent(e);
      handlePointerAt(e.target, e);
    });

    screen.addEventListener("pointermove", (e) => {
      if (!isDown) return;
      setModeFromEvent(e);
      handlePointerAt(e.target, e);
    });

    screen.addEventListener("pointerup", () => {
      isDown = false;
      lastIndex = -1;
    });

    screen.addEventListener("mousemove", (e) => {
      const t = e.target;
      if (t && t.classList.contains("px")) {
        const i = +t.dataset.i;
        const [x, y] = xy(i);
        if (ui.coordPill) ui.coordPill.textContent = `x: ${x}  y: ${y}`;
      }
    });
  }

  // --- sliders: update state live
  function syncUI() {
    if (ui.colsVal) ui.colsVal.textContent = String(state.cols);
    if (ui.rowsVal) ui.rowsVal.textContent = String(state.rows);
    if (ui.cellVal) ui.cellVal.textContent = String(state.cell);
    if (ui.thrVal) ui.thrVal.textContent = state.threshold.toFixed(2);
  }

  function bindControls() {
    if (ui.colsR) ui.colsR.addEventListener("input", () => { state.cols = +ui.colsR.value; syncUI(); });
    if (ui.rowsR) ui.rowsR.addEventListener("input", () => { state.rows = +ui.rowsR.value; syncUI(); });
    if (ui.cellR) ui.cellR.addEventListener("input", () => { state.cell = +ui.cellR.value; syncUI(); setCSSGrid(); });
    if (ui.thrR) ui.thrR.addEventListener("input", () => {
      state.threshold = +ui.thrR.value / 100;
      syncUI();
      paintToDOM();
      updateMeta();
    });

    // rebuild grid when rows/cols changes are committed
    if (ui.colsR) ui.colsR.addEventListener("change", () => buildGrid(true));
    if (ui.rowsR) ui.rowsR.addEventListener("change", () => buildGrid(true));

    // quick buttons (core only)
    if (ui.clearBtn) ui.clearBtn.addEventListener("click", () => clear());
    if (ui.invertBtn) ui.invertBtn.addEventListener("click", () => invert());
    if (ui.resetBtn) ui.resetBtn.addEventListener("click", () => {
      buildGrid(false);
      if (ui.out) ui.out.textContent = "";
      if (ui.bnCount) ui.bnCount.textContent = "0";
      if (ui.com) ui.com.textContent = "—";
      if (ui.sym) ui.sym.textContent = "—";
    });
  }

  // --- boot
  bindPaintEvents();
  bindControls();
  syncUI();
  buildGrid(false);

  // seed output box if present
  if (ui.out && !ui.out.textContent.trim()) {
    ui.out.textContent =
`{
  "meta": { "engine": "Funebra™ pScreen", "mode": "pure-dom" },
  "hint": "Draw on the grid → click Scan → bn-points appear here."
}`;
  }

  // public app object
  const app = {
    screen,
    ui,
    state,

    // helpers
    idx, xy,

    // core actions
    setCSSGrid,
    buildGrid,
    paintToDOM,
    updateMeta,
    setCell,
    toggleCell,
    clear,
    invert,

    // paint state (read-only-ish)
    get paintMode() { return paintMode; },
    get isDown() { return isDown; }
  };

  return app;
}

