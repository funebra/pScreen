/* -----------------------------------------------------------
   Funebra™ pScreen — scan
   Turns current grid state into a scan payload + bn points.

   Usage:
     import { pScreenScan } from "./src/pScreen.scan.js";
     pScreenScan(app);

   Requires app from pScreen.core.js:
     app.state { cols, rows, cell, threshold, px[] }
     app.idx(x,y), app.xy(i)
     app.ui elements (optional): out, bnCount, com, sym, activePx
----------------------------------------------------------- */

export function pScreenScan(app) {
  if (!app || !app.state) throw new Error("pScreen.scan: app/state missing.");

  const { state } = app;
  const ui = app.ui || {};
  const nowISO = () => new Date().toISOString();

  function symmetryLR() {
    // 1.0 = perfect symmetry. Compare left cell vs mirrored right cell.
    const C = state.cols, R = state.rows;
    if (C < 2) return 1;

    const thr = state.threshold;
    let matches = 0, checks = 0;

    for (let y = 0; y < R; y++) {
      for (let x = 0; x < Math.floor(C / 2); x++) {
        const a = state.px[app.idx(x, y)] >= thr;
        const b = state.px[app.idx(C - 1 - x, y)] >= thr;
        checks++;
        if (a === b) matches++;
      }
    }
    return checks ? (matches / checks) : 1;
  }

  function scan() {
    const thr = state.threshold;
    const total = state.px.length;

    const bnPoints = [];

    let sx = 0, sy = 0, count = 0;

    for (let i = 0; i < total; i++) {
      const v = state.px[i];
      if (v >= thr) {
        const [x, y] = app.xy(i);

        // Funebra rule: bn ids use "bn" prefix
        bnPoints.push({
          id: "bn" + bnPoints.length,
          x, y,
          v
        });

        sx += x;
        sy += y;
        count++;
      }
    }

    const cx = count ? (sx / count) : 0;
    const cy = count ? (sy / count) : 0;

    const sym = symmetryLR();
    const density = total ? (count / total) : 0;

    const payload = {
      meta: {
        engine: "Funebra™ pScreen",
        module: "pScreen.scan.js",
        mode: "pure-dom",
        cols: state.cols,
        rows: state.rows,
        cell: state.cell,
        threshold: state.threshold,
        timestamp: nowISO()
      },
      stats: {
        activePixels: count,
        density,
        centerOfMass: { x: cx, y: cy },
        symmetryLR: sym
      },
      bnPoints
    };

    // UI updates (if elements exist)
    if (ui.bnCount) ui.bnCount.textContent = String(bnPoints.length);
    if (ui.com) ui.com.textContent = count ? `${cx.toFixed(2)}, ${cy.toFixed(2)}` : "—";
    if (ui.sym) ui.sym.textContent = count ? `${(sym * 100).toFixed(1)}%` : "—";
    if (ui.activePx) ui.activePx.textContent = String(count);

    if (ui.out) ui.out.textContent = JSON.stringify(payload, null, 2);

    // Keep last scan on app for other modules (bn.js, og generator, etc.)
    app.lastScan = payload;

    return payload;
  }

  function downloadJSON(payload, filename = "pscreen-scan.json") {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  // Wire buttons if present
  if (ui.scanBtn) {
    ui.scanBtn.addEventListener("click", () => scan());
  }

  if (ui.exportBtn) {
    ui.exportBtn.addEventListener("click", () => {
      const payload = app.lastScan || scan();
      downloadJSON(payload, "pscreen-bn-scan.json");
    });
  }

  // Expose methods on app
  app.scan = scan;
  app.symmetryLR = symmetryLR;
  app.downloadScanJSON = downloadJSON;

  return app;
}

