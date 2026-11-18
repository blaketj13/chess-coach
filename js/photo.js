/* 1.6.1 Player photo as the character. ON-DEVICE ONLY: kept in this browser's localStorage under its own key,
   never sent anywhere, never part of progress sync, packs or the journey card. Downscaled to 256px.
   The drawn SVG avatar stays the default and the fallback. */
(function () {
  const KEY = "sc.avatar.photo.v1";
  const SIZE = 256;
  let cache = null;
  try { cache = localStorage.getItem(KEY) || null; } catch (e) { cache = null; }
  const get = () => cache;
  function set(dataUrl) {
    cache = dataUrl || null;
    try { if (cache) localStorage.setItem(KEY, cache); else localStorage.removeItem(KEY); } catch (e) { /* storage full: keep it for this session only */ }
    if (window.UI && window.UI.refresh) window.UI.refresh();
    return !!cache;
  }
  const clear = () => set(null);
  function img(size, cls) {
    if (!cache) return "";
    return `<img class="avatar avatar-photo${cls ? " " + cls : ""}" data-testid="avatar-photo-display" src="${cache}" width="${size}" height="${size}" alt="Your photo">`;
  }
  /** Round crop: drag to move, slider to zoom. Calls done(dataUrl) on "Use photo". */
  function crop(file, done) {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => openCrop(im, (res) => { URL.revokeObjectURL(url); if (res) done(res); });
    im.onerror = () => { URL.revokeObjectURL(url); done(null, "That file isn't an image we can read."); };
    im.src = url;
  }
  function openCrop(im, done) {
    document.querySelectorAll(".overlay.crop-ov").forEach((x) => x.remove());
    const V = 240; // viewport px
    const base = V / Math.min(im.naturalWidth, im.naturalHeight);
    const st = { z: 1, x: 0, y: 0 };
    const ov = document.createElement("div");
    ov.className = "overlay crop-ov";
    ov.innerHTML = `<div class="ov-card" data-testid="avatar-photo-crop"><h2>Frame your photo</h2><p class="muted">Drag to move. Slide to zoom. Stays on this phone.</p>
      <div class="crop-view" id="crop-view" style="width:${V}px;height:${V}px"><canvas id="crop-c" width="${V * 2}" height="${V * 2}" style="width:${V}px;height:${V}px"></canvas></div>
      <input type="range" id="crop-zoom" data-testid="avatar-photo-zoom" min="1" max="3" step="0.01" value="1" aria-label="Zoom">
      <button type="button" class="primary" id="crop-ok" data-testid="avatar-photo-use">Use photo</button>
      <button type="button" class="ghost" id="crop-x">Cancel</button></div>`;
    // One screen at a time: tuck the editor away while framing, bring it back after.
    const under = Array.from(document.querySelectorAll(".overlay")).filter((o) => o !== ov && o.style.visibility !== "hidden");
    under.forEach((o) => { o.style.visibility = "hidden"; });
    const restore = () => under.forEach((o) => { o.style.visibility = ""; });
    document.body.appendChild(ov);
    const c = ov.querySelector("#crop-c"), x = c.getContext("2d");
    function clamp() {
      const s = base * st.z, w = im.naturalWidth * s, h = im.naturalHeight * s;
      const mx = Math.max(0, (w - V) / 2), my = Math.max(0, (h - V) / 2);
      st.x = Math.max(-mx, Math.min(mx, st.x)); st.y = Math.max(-my, Math.min(my, st.y));
    }
    function draw(ctx, out) {
      const k = out / V, s = base * st.z * k;
      const w = im.naturalWidth * s, h = im.naturalHeight * s;
      ctx.clearRect(0, 0, out, out);
      ctx.drawImage(im, out / 2 - w / 2 + st.x * k, out / 2 - h / 2 + st.y * k, w, h);
    }
    const paint = () => { clamp(); draw(x, V * 2); };
    paint();
    let drag = null;
    const view = ov.querySelector("#crop-view");
    view.addEventListener("pointerdown", (e) => { drag = { px: e.clientX, py: e.clientY, x: st.x, y: st.y }; try { view.setPointerCapture(e.pointerId); } catch (er) {} });
    view.addEventListener("pointermove", (e) => { if (!drag) return; st.x = drag.x + e.clientX - drag.px; st.y = drag.y + e.clientY - drag.py; paint(); });
    const end = () => { drag = null; };
    view.addEventListener("pointerup", end); view.addEventListener("pointercancel", end);
    ov.querySelector("#crop-zoom").addEventListener("input", (e) => { st.z = +e.target.value; paint(); });
    ov.querySelector("#crop-ok").addEventListener("click", () => {
      const o = document.createElement("canvas"); o.width = SIZE; o.height = SIZE;
      const ox = o.getContext("2d"); ox.fillStyle = "#1c2a33"; ox.fillRect(0, 0, SIZE, SIZE);
      draw(ox, SIZE);
      ov.remove(); restore();
      done(o.toDataURL("image/jpeg", 0.85));
    });
    ov.querySelector("#crop-x").addEventListener("click", () => { ov.remove(); restore(); done(null); });
    return { state: st, paint };
  }
  window.AvatarPhoto = { get, set, clear, img, crop, KEY, SIZE };
  window.__qa = window.__qa || {};
  window.__qa.avatarPhoto = window.AvatarPhoto;
})();
