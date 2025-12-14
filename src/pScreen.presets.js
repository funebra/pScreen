/* -----------------------------------------------------------
   Funebra™ pScreen — presets
   Restores the old "Pattern" dropdown behavior after modularization.

   Usage:
     import { pScreenPresets } from "./src/pScreen.presets.js";
     pScreenPresets(app);
----------------------------------------------------------- */

export function pScreenPresets(app){
  const ui = app.ui || {};
  if(!ui.preset) return app;

  function applyPreset(kind){
    // clear but keep grid
    app.clear();

    const C = app.state.cols;
    const R = app.state.rows;

    const set = (x,y)=>{
      if(x<0 || x>=C || y<0 || y>=R) return;
      app.state.px[app.idx(x,y)] = 1;
    };

    const midX = (C-1)/2;
    const midY = (R-1)/2;

    if(kind === "diag"){
      const n = Math.min(C,R);
      for(let i=0;i<n;i++) set(i,i);
    }

    if(kind === "smile"){
      // two eyes
      set(Math.floor(C*0.30), Math.floor(R*0.35));
      set(Math.floor(C*0.70), Math.floor(R*0.35));
      // mouth arc
      for(let x=0;x<C;x++){
        const dx = (x-midX)/(C/2);
        const y = Math.round(midY + (dx*dx) * (R*0.18));
        set(x,y);
      }
      // cheeks
      set(Math.floor(C*0.22), Math.floor(R*0.55));
      set(Math.floor(C*0.78), Math.floor(R*0.55));
    }

    if(kind === "ring"){
      const rad = Math.min(C,R)*0.33;
      for(let y=0;y<R;y++){
        for(let x=0;x<C;x++){
          const dx = x-midX, dy = y-midY;
          const d = Math.sqrt(dx*dx + dy*dy);
          if(Math.abs(d-rad) < 0.6) set(x,y);
        }
      }
    }

    if(kind === "noise"){
      for(let i=0;i<app.state.px.length;i++){
        app.state.px[i] = (Math.random() > 0.75) ? 1 : 0;
      }
    }

    if(kind.startsWith("word:")){
      drawWord(kind.split(":")[1] || "BN", set, C, R);
    }

    app.paintToDOM();
    app.updateMeta();
  }

  function drawWord(text, set, C, R){
    const font = {
      "B":[
        "11110",
        "10001",
        "11110",
        "10001",
        "10001",
        "10001",
        "11110",
      ],
      "N":[
        "10001",
        "11001",
        "10101",
        "10011",
        "10001",
        "10001",
        "10001",
      ],
      "2":[
        "11110",
        "00001",
        "00001",
        "11110",
        "10000",
        "10000",
        "11111",
      ],
      "7":[
        "11111",
        "00001",
        "00010",
        "00100",
        "01000",
        "01000",
        "01000",
      ],
      "4":[
        "10010",
        "10010",
        "10010",
        "11111",
        "00010",
        "00010",
        "00010",
      ],
      "1":[
        "00100",
        "01100",
        "00100",
        "00100",
        "00100",
        "00100",
        "01110",
      ]
    };

    const chars = (""+text).toUpperCase().split("").filter(c=>font[c]);
    if(!chars.length) return;

    const charW = 5, charH = 7, gap = 1;
    const totalW = chars.length*charW + (chars.length-1)*gap;

    const startX = Math.floor((C - totalW)/2);
    const startY = Math.floor((R - charH)/2);

    let x0 = startX;
    for(const ch of chars){
      const bmp = font[ch];
      for(let y=0;y<charH;y++){
        for(let x=0;x<charW;x++){
          if(bmp[y][x] === "1") set(x0+x, startY+y);
        }
      }
      x0 += charW + gap;
    }
  }

  // wire dropdown
  ui.preset.addEventListener("change", ()=>{
    const v = ui.preset.value;
    if(v && v !== "none") applyPreset(v);
    ui.preset.value = "none";
  });

  // expose
  app.presets = { applyPreset };
  return app;
}
