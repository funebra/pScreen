/* -----------------------------------------------------------
   Funebra™ pScreen — bn utilities
   Works with pScreen.core.js + pScreen.scan.js

   Adds:
     app.bn = {
       getPoints(), normalize(), transform(),
       toFSC(), fromFSC(), downloadFSC(), copyFSC()
     }

   FSC (Funebra Screen Code) v1 (simple & human readable):
     FSC1;cols=32;rows=18;thr=0.5
     bn0,12,5,1
     bn1,13,5,1
     ...

   Notes:
   - bn IDs always use prefix "bn" (Funebra memory rule)
   - v is intensity (0..1) (currently 0/1 but future-proof)
----------------------------------------------------------- */

export function pScreenBN(app) {
  if (!app || !app.state) throw new Error("pScreen.bn: app/state missing.");

  const ui = app.ui || {};
  const state = app.state;

  function getPoints() {
    // prefer lastScan result from scan module
    if (app.lastScan && Array.isArray(app.lastScan.bnPoints)) return app.lastScan.bnPoints;
    // fallback: if scan exists, run it
    if (typeof app.scan === "function") return app.scan().bnPoints;
    return [];
  }

  function bbox(points) {
    if (!points.length) return { minX:0, minY:0, maxX:0, maxY:0, w:0, h:0 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const w = maxX - minX;
    const h = maxY - minY;
    return { minX, minY, maxX, maxY, w, h };
  }

  function centerOfMass(points) {
    if (!points.length) return { x:0, y:0 };
    let sx = 0, sy = 0;
    for (const p of points) { sx += p.x; sy += p.y; }
    return { x: sx / points.length, y: sy / points.length };
  }

  function normalize(points, options = {}) {
    // Returns new array with normalized coordinates.
    // Default: center to (0,0) and scale to fit inside [-1,1] range.
    const mode = options.mode || "unit"; // "unit" | "grid"
    const useCOM = options.useCOM !== false; // default true
    const keepIds = options.keepIds !== false; // default true

    const pts = points.map(p => ({ ...p }));
    if (!pts.length) return pts;

    const bb = bbox(pts);
    const com = useCOM ? centerOfMass(pts) : { x: (bb.minX + bb.maxX)/2, y: (bb.minY + bb.maxY)/2 };

    // shift to origin
    for (const p of pts) {
      p.x = p.x - com.x;
      p.y = p.y - com.y;
    }

    // scale
    const bb2 = bbox(pts);
    const maxDim = Math.max(Math.abs(bb2.minX), Math.abs(bb2.maxX), Math.abs(bb2.minY), Math.abs(bb2.maxY), 1e-9);

    if (mode === "unit") {
      const s = options.scale || (1 / maxDim); // fit to [-1,1]
      for (const p of pts) { p.x *= s; p.y *= s; }
    } else if (mode === "grid") {
      // map back into grid coordinates (0..cols-1, 0..rows-1) but centered
      const s = options.scale || 1;
      for (const p of pts) { p.x *= s; p.y *= s; }
    }

    if (!keepIds) {
      for (let i = 0; i < pts.length; i++) pts[i].id = "bn" + i;
    }

    return pts;
  }

  function transform(points, t = {}) {
    // translate/scale/rotate around origin
    const tx = t.tx || 0;
    const ty = t.ty || 0;
    const sx = (t.sx == null) ? 1 : t.sx;
    const sy = (t.sy == null) ? sx : t.sy;
    const rot = t.rot || 0; // radians

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);

    return points.map((p, i) => {
      const id = p.id || ("bn" + i);
      let x = p.x * sx;
      let y = p.y * sy;

      // rotate
      const xr = x * cos - y * sin;
      const yr = x * sin + y * cos;

      return {
        id,
        x: xr + tx,
        y: yr + ty,
        v: (p.v == null ? 1 : p.v)
      };
    });
  }

  function toFSC(points, meta = {}) {
    const pts = points || getPoints();
    const header =
      `FSC1;cols=${meta.cols ?? state.cols};rows=${meta.rows ?? state.rows};thr=${meta.threshold ?? state.threshold}`;

    const lines = [header];

    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const id = (p.id && String(p.id).startsWith("bn")) ? p.id : ("bn" + i);
      const x = Number.isFinite(p.x) ? p.x : 0;
      const y = Number.isFinite(p.y) ? p.y : 0;
      const v = Number.isFinite(p.v) ? p.v : 1;

      // Keep compact but readable
      lines.push(`${id},${trimNum(x)},${trimNum(y)},${trimNum(v)}`);
    }
    return lines.join("\n");
  }

  function fromFSC(text) {
    const lines = String(text || "").split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) return { meta: null, bnPoints: [] };

    const head = lines[0];
    if (!head.startsWith("FSC1")) throw new Error("Invalid FSC: missing FSC1 header.");

    // parse header: FSC1;cols=..;rows=..;thr=..
    const meta = {};
    head.split(";").slice(1).forEach(part => {
      const [k, v] = part.split("=");
      if (!k) return;
      meta[k] = (v != null && v !== "" && !isNaN(+v)) ? +v : v;
    });

    const bnPoints = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const parts = line.split(",");
      if (parts.length < 3) continue;

      const id = parts[0] || ("bn" + (i - 1));
      const x = +parts[1];
      const y = +parts[2];
      const v = (parts.length >= 4) ? +parts[3] : 1;

      bnPoints.push({
        id: String(id).startsWith("bn") ? String(id) : ("bn" + (bnPoints.length)),
        x: Number.isFinite(x) ? x : 0,
        y: Number.isFinite(y) ? y : 0,
        v: Number.isFinite(v) ? v : 1
      });
    }

    return { meta, bnPoints };
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  async function copyText(text) {
    if (!navigator.clipboard) throw new Error("Clipboard API not available.");
    await navigator.clipboard.writeText(text);
    return true;
  }

  // small helper to keep FSC numbers short
  function trimNum(n) {
    // keep integers clean, otherwise 4 decimals
    if (Math.abs(n - Math.round(n)) < 1e-10) return String(Math.round(n));
    return Number(n).toFixed(4).replace(/0+$/,"").replace(/\.$/,"");
  }

  // expose on app
  app.bn = {
    getPoints,
    bbox,
    centerOfMass,
    normalize,
    transform,
    toFSC,
    fromFSC,
    downloadFSC(filename = "pscreen.fsc") {
      const fsc = toFSC(getPoints());
      downloadText(fsc, filename);
      return fsc;
    },
    async copyFSC() {
      const fsc = toFSC(getPoints());
      await copyText(fsc);
      return fsc;
    }
  };

  return app;
}

