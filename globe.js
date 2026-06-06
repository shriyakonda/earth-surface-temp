// globe.js — Interactive Three.js globe
// Click: camera zooms toward clicked point + stats panel
// Hover: temperature tooltip | Buttons: time period switching

window.addEventListener('load', initGlobe);
let globeSwitchDataset = null;
let clickMarker = null;

async function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  const width  = container.clientWidth;
  const height = container.clientHeight;

  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.set(0, 0, 2.8);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);
  container.style.position = 'relative';

  // Starfield
  const starGeo = new THREE.BufferGeometry();
  const pos = new Float32Array(1500 * 3);
  for (let i = 0; i < pos.length; i++) pos[i] = (Math.random() - 0.5) * 200;
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 })));

  // Lights
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sun = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sun.position.set(5, 3, 5);
  scene.add(sun);

  // Data
  const FILES = {
    jul2020: 'data/lst_jul_2020.json', jan2020: 'data/lst_jan_2020.json',
    jul2003: 'data/lst_jul_2003.json', jul2024: 'data/lst_jul_2024.json',
  };
  const LABELS_MAP = {
    jul2020: 'July 2020', jan2020: 'January 2020',
    jul2003: 'July 2003', jul2024: 'July 2024',
  };

  async function fetchGrid(key) {
    if (window.dataCache && window.dataCache[key]) return window.dataCache[key];
    return fetch(FILES[key]).then(r => r.json());
  }

  let currentGridRef = null;
  let currentKey = 'jul2020';
  try { currentGridRef = await fetchGrid('jul2020'); }
  catch (e) { console.warn('Globe: data load failed', e); return; }

  // Globe
  const globeGeo = new THREE.SphereGeometry(1, 72, 72);
  const globeMat = new THREE.MeshPhongMaterial({
    map: gridToTexture(currentGridRef), shininess: 8,
    specular: new THREE.Color(0x223344),
  });
  const globe = new THREE.Mesh(globeGeo, globeMat);
  scene.add(globe);

  // Atmosphere
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(1.04, 72, 72),
    new THREE.MeshPhongMaterial({ color: 0x2244bb, transparent: true, opacity: 0.07, side: THREE.FrontSide })
  ));

  // Night side
  const nightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.011, 72, 72),
    new THREE.MeshBasicMaterial({ color: 0x000011, transparent: true, opacity: 0.45, side: THREE.BackSide })
  );
  scene.add(nightMesh);

  // Event markers
  const EVENTS_DATA = [
    { id: 'euro2003',       lat: 46.0, lon: 2.0,  color: 0xff4500, dataKey: 'jul2003' },
    { id: 'siberia2020',    lat: 65.0, lon: 100.0, color: 0xff6b00, dataKey: 'jul2020' },
    { id: 'middleeast2024', lat: 26.0, lon: 67.0,  color: 0xcc0000, dataKey: 'jul2024' },
  ];

  const markerMeshes = [];

  function latLonToVec3(lat, lon, radius) {
    const phi   = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
       radius * Math.cos(phi),
       radius * Math.sin(phi) * Math.sin(theta)
    );
  }

  function buildMarkers(activeKey) {
    markerMeshes.forEach(m => globe.remove(m));
    markerMeshes.length = 0;
    EVENTS_DATA.forEach(ev => {
      if (ev.dataKey !== activeKey) return;
      const pos = latLonToVec3(ev.lat, ev.lon, 1.015);
      [
        { geo: new THREE.RingGeometry(0.025, 0.038, 32), mat: new THREE.MeshBasicMaterial({ color: ev.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }) },
        { geo: new THREE.CircleGeometry(0.014, 24),       mat: new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }) },
      ].forEach(({ geo, mat }) => {
        const m = new THREE.Mesh(geo, mat);
        m.position.copy(pos);
        m.lookAt(0, 0, 0); m.rotateY(Math.PI);
        m.userData = { eventId: ev.id, lat: ev.lat, lon: ev.lon };
        globe.add(m); markerMeshes.push(m);
      });
    });
  }
  buildMarkers('jul2020');

function addClickMarker(lat, lon) {
  if (clickMarker) {
    globe.remove(clickMarker.outerRing);
    globe.remove(clickMarker.ring);
    globe.remove(clickMarker.dot);
  }
  const pos = latLonToVec3(lat, lon, 1.018);

  // Outer faint ring
  const outerRing = new THREE.Mesh(
    new THREE.RingGeometry(0.038, 0.055, 32),
    new THREE.MeshBasicMaterial({ color: 0xff6b00, side: THREE.DoubleSide, transparent: true, opacity: 0.4 })
  );
  outerRing.position.copy(pos);
  outerRing.lookAt(new THREE.Vector3(0, 0, 0));
  outerRing.rotateY(Math.PI);
  globe.add(outerRing);

  // Inner ring
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.025, 0.038, 32),
    new THREE.MeshBasicMaterial({ color: 0xff6b00, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
  );
  ring.position.copy(pos);
  ring.lookAt(new THREE.Vector3(0, 0, 0));
  ring.rotateY(Math.PI);
  globe.add(ring);

  // Inner dot
  const dot = new THREE.Mesh(
    new THREE.CircleGeometry(0.014, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  dot.position.copy(pos);
  dot.lookAt(new THREE.Vector3(0, 0, 0));
  dot.rotateY(Math.PI);
  globe.add(dot);

  clickMarker = { outerRing, ring, dot };
}

  // ── Tooltip ────────────────────────────────────────────────
  const globeTooltip = document.createElement('div');
  globeTooltip.style.cssText = `
    position:absolute; background:rgba(10,10,20,0.95); color:#fff;
    padding:8px 14px; border-radius:5px; font-family:Menlo,monospace;
    font-size:13px; pointer-events:none; display:none;
    border:1px solid #333; white-space:nowrap; z-index:50;
  `;
  container.appendChild(globeTooltip);

  // ── Stats Panel ────────────────────────────────────────────
  const statsPanel = document.createElement('div');
  statsPanel.style.cssText = `
    position:absolute; top:14px; right:14px; width:220px;
    background:rgba(10,10,24,0.97); border:1px solid #333;
    border-radius:8px; padding:16px; font-family:Georgia,serif;
    color:#ddd; z-index:60; transform:translateX(260px);
    transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
    box-shadow:0 4px 24px rgba(0,0,0,0.7);
  `;
  statsPanel.innerHTML = `
    <div id="sp-close" style="position:absolute;top:10px;right:12px;cursor:pointer;color:#666;font-size:16px;">✕</div>
    <div id="sp-title"  style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;"></div>
    <div id="sp-coords" style="font-size:11px;color:#777;font-family:Menlo,monospace;margin-bottom:12px;"></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Temperature here</div>
        <div id="sp-temp" style="font-size:22px;font-weight:700;color:#fff;"></div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Regional avg (±10°)</div>
        <div id="sp-avg" style="font-size:16px;color:#aaa;"></div>
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Regional range</div>
        <div id="sp-range" style="font-size:14px;color:#aaa;"></div>
      </div>
      <div id="sp-event" style="margin-top:6px;padding:8px;border-radius:4px;font-size:12px;display:none;line-height:1.5;"></div>
    </div>
    <div style="margin-top:12px;">
      <button id="sp-reset" style="font-family:inherit;font-size:12px;padding:6px 14px;
        background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;cursor:pointer;width:100%;">
        ← Reset View
      </button>
    </div>
  `;
  container.appendChild(statsPanel);

  function showStatsPanel(lat, lon, val) {
    const grid = currentGridRef;
    let sum = 0, count = 0, minV = Infinity, maxV = -Infinity;
    if (grid) {
      const rows = grid.length, cols = grid[0].length;
      const r0 = Math.max(0, Math.floor((90-(lat+10))/180*rows));
      const r1 = Math.min(rows-1, Math.floor((90-(lat-10))/180*rows));
      const c0 = Math.max(0, Math.floor((lon-10+180)/360*cols));
      const c1 = Math.min(cols-1, Math.floor((lon+10+180)/360*cols));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const v = grid[r][c];
        if (v === null || isNaN(v)) continue;
        sum += v; count++;
        if (v < minV) minV = v;
        if (v > maxV) maxV = v;
      }
    }
    const avg   = count > 0 ? (sum/count).toFixed(1) : '—';
    const range = count > 0 ? `${minV.toFixed(1)} to ${maxV.toFixed(1)} °C` : '—';

    document.getElementById('sp-title').textContent  = roughRegionName(lat, lon);
    document.getElementById('sp-coords').textContent = `${lat.toFixed(1)}°, ${lon.toFixed(1)}° · ${LABELS_MAP[currentKey]}`;
    document.getElementById('sp-temp').textContent   = val !== null && !isNaN(val) ? `${val.toFixed(1)} °C` : 'Ocean or masked pixel';
    document.getElementById('sp-temp').style.color   = val !== null && !isNaN(val) ? tempToHex(val) : '#777';
    document.getElementById('sp-avg').textContent    = count > 0 ? `${avg} °C` : 'No data';
    document.getElementById('sp-range').textContent  = range;

    const near = EVENTS_DATA.find(ev => ev.dataKey === currentKey && Math.abs(ev.lat-lat)<15 && Math.abs(ev.lon-lon)<20);
    const spEvent = document.getElementById('sp-event');
    if (near) {
      const info = { euro2003:{name:'2003 European Heat Wave',color:'#ff4500'}, siberia2020:{name:'2020 Siberian Heat Wave',color:'#ff6b00'}, middleeast2024:{name:'2024 South Asia Heat',color:'#cc0000'} }[near.id];
      spEvent.style.cssText += `display:block;border-left:3px solid ${info.color};padding-left:8px;color:#bbb;`;
      spEvent.innerHTML = `<strong style="color:${info.color}">${info.name}</strong><br>This area was affected.`;
    } else {
      spEvent.style.display = 'none';
    }
    statsPanel.style.transform = 'translateX(0)';
  }

  function hideStatsPanel() {
    statsPanel.style.transform = "translateX(260px)";
    setTimeout(() => {
      document.getElementById("sp-title").textContent  = "";
      document.getElementById("sp-coords").textContent = "";
      document.getElementById("sp-temp").textContent   = "";
      document.getElementById("sp-avg").textContent    = "";
      document.getElementById("sp-range").textContent  = "";
      document.getElementById("sp-event").style.display = "none";
    }, 400);
  }

  function roughRegionName(lat, lon) {
    // Arctic / Greenland
    if (lat > 70)  return lon > -60 && lon < 30 ? "Greenland" : lon > 30 ? "Siberian Arctic" : "Canadian Arctic";
    // Russia / Siberia
    if (lat > 50 && lon > 30 && lon < 180)  return "Russia / Siberia";
    // Canada / Alaska
    if (lat > 50 && lon > -170 && lon < -50) return "Canada / Alaska";
    // Europe
    if (lat > 35 && lat < 72 && lon > -12 && lon < 40) return "Europe";
    // North America
    if (lat > 15 && lat < 55 && lon > -130 && lon < -60) return "North America";
    // Central America
    if (lat > 5 && lat < 25 && lon > -95 && lon < -60) return "Central America";
    // Caribbean
    if (lat > 10 && lat < 28 && lon > -85 && lon < -55) return "Caribbean";
    // South America
    if (lon > -85 && lon < -32 && lat < 15) return "South America";
    // North Africa / Sahara
    if (lat > 15 && lat < 38 && lon > -18 && lon < 40) return "North Africa";
    // West Africa
    if (lat > -5 && lat < 20 && lon > -18 && lon < 15) return "West Africa";
    // East Africa / Horn
    if (lat > -15 && lat < 20 && lon > 32 && lon < 52) return "East Africa";
    // Central Africa
    if (lat > -15 && lat < 10 && lon > 10 && lon < 32) return "Central Africa";
    // Southern Africa
    if (lat < -15 && lon > 10 && lon < 42) return "Southern Africa";
    // Middle East
    if (lat > 12 && lat < 40 && lon > 32 && lon < 60) return "Middle East";
    // Central Asia
    if (lat > 35 && lat < 55 && lon > 50 && lon < 80) return "Central Asia";
    // South Asia
    if (lat > 5 && lat < 38 && lon > 60 && lon < 92) return "South Asia";
    // Southeast Asia
    if (lat > -12 && lat < 28 && lon > 92 && lon < 142) return "Southeast Asia";
    // East Asia
    if (lat > 18 && lat < 55 && lon > 100 && lon < 148) return "East Asia";
    // Japan / Korea
    if (lat > 30 && lat < 48 && lon > 128 && lon < 148) return "Japan / Korea";
    // Australia
    if (lat < -10 && lat > -45 && lon > 110 && lon < 155) return "Australia";
    // New Zealand
    if (lat < -30 && lon > 165 && lon < 180) return "New Zealand";
    // Pacific Islands
    if (lon > 140 || lon < -130) return "Pacific Ocean region";
    // Fallback to coordinates
    return `${Math.abs(lat).toFixed(0)}°${lat>=0?"N":"S"}, ${Math.abs(lon).toFixed(0)}°${lon>=0?"E":"W"}`;
  }

  function tempToHex(t) {
    if (t < 0)  return '#6699ff';
    if (t < 15) return '#aaddff';
    if (t < 25) return '#ffffaa';
    if (t < 35) return '#ffaa44';
    return '#ff3322';
  }

  document.getElementById('sp-close').addEventListener('click', resetView);
  document.getElementById('sp-reset').addEventListener('click', resetView);

  // ── Camera state ───────────────────────────────────────────
  // Instead of rotating the globe, we move the camera toward the clicked point.
  let isZoomed = false;
  let autoRotate = true;

  // Camera target position (lerped toward each frame)
  const camTarget = new THREE.Vector3(0, 0, 2.8);
  const camLookAt = new THREE.Vector3(0, 0, 0);
  const camTargetLookAt = new THREE.Vector3(0, 0, 0);

  function flyToPoint(worldPoint) {
    // Move camera to 1.6x distance along the direction of the hit point
    const dir = worldPoint.clone().normalize();
    camTarget.copy(dir.multiplyScalar(1.65));
    camTargetLookAt.copy(worldPoint); // look at the surface point
    autoRotate = false;
    isZoomed = true;
  }

  function resetView() {
    camTarget.set(0, 0, 2.8);
    camTargetLookAt.set(0, 0, 0);
    autoRotate = true;
    isZoomed = false;
    hideStatsPanel();
    globeTooltip.style.display = 'none';
    if (clickMarker) {
      globe.remove(clickMarker.outerRing);
      globe.remove(clickMarker.ring);
      globe.remove(clickMarker.dot);
      clickMarker = null;
    }
  }

  // ── Time period buttons ────────────────────────────────────
  const globeControls = document.createElement('div');
  globeControls.style.cssText = `
    position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
    display:flex; gap:8px; z-index:40;
  `;
  const globeBtns = {};
  Object.keys(LABELS_MAP).forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = LABELS_MAP[key];
    btn.style.cssText = `font-family:inherit;font-size:12px;padding:6px 14px;
      border:1px solid #444;background:rgba(20,20,40,0.85);color:#aaa;
      cursor:pointer;border-radius:4px;transition:all 0.15s;`;
    if (key === 'jul2020') { btn.style.background='#b40426'; btn.style.color='#fff'; btn.style.borderColor='#b40426'; }
    btn.addEventListener('click', () => switchGlobeDataset(key));
    globeControls.appendChild(btn);
    globeBtns[key] = btn;
  });
  container.appendChild(globeControls);

  async function switchGlobeDataset(key) {
    currentKey = key;
    Object.entries(globeBtns).forEach(([k,b]) => {
      b.style.background  = k===key ? '#b40426' : 'rgba(20,20,40,0.85)';
      b.style.color       = k===key ? '#fff'    : '#aaa';
      b.style.borderColor = k===key ? '#b40426' : '#444';
    });
    currentGridRef = await fetchGrid(key);
    globeMat.map = gridToTexture(currentGridRef);
    globeMat.map.needsUpdate = true;
    buildMarkers(key);
  }
  globeSwitchDataset = switchGlobeDataset;

  // ── Raycaster ──────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse2 = new THREE.Vector2();

  function getHit(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse2.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    mouse2.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse2, camera);
    // Only intersect the globe sphere itself
    const hits = raycaster.intersectObject(globe);
    return hits.length > 0 ? hits[0] : null;
  }

  // Convert a world-space point ON the globe surface to lat/lon.
  // Since the globe rotates, we convert to globe local space first.
  function hitToLatLon(hit) {
    const local = globe.worldToLocal(hit.point.clone());
    const len = local.length();
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, local.y / len))) * (180 / Math.PI);
    const theta = Math.atan2(local.z, -local.x);           // -PI to +PI
    const rawLon = theta * (180 / Math.PI) - 180;          // -360 to 0
    const lon = ((rawLon + 180 + 360) % 360) - 180;        // wrap to -180..+180
    return { lat, lon };
  }

  function latLonToGridVal(lat, lon) {
    const grid = currentGridRef;
    if (!grid) return null;
    const rows = grid.length, cols = grid[0].length;
    // clamp to valid range
    const latC = Math.max(-90, Math.min(90, lat));
    const lonC = Math.max(-180, Math.min(179.9, lon));
    const r = Math.floor((90 - latC) / 180 * rows);
    const c = Math.floor((lonC + 180) / 360 * cols);
    const val = grid[Math.min(r, rows-1)][Math.min(c, cols-1)];
    return val === undefined ? null : val;
  }

  // Hover tooltip
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) { globeTooltip.style.display='none'; return; }
    const hit = getHit(e.clientX, e.clientY);
    if (!hit) { globeTooltip.style.display='none'; return; }
    const { lat, lon } = hitToLatLon(hit);
    const val = latLonToGridVal(lat, lon);
    const rect = container.getBoundingClientRect();
    globeTooltip.innerHTML = val !== null && !isNaN(val)
      ? `<strong>${val.toFixed(1)} °C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`
      : `${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br><em style="color:#777">Ocean / no data</em>`;
    globeTooltip.style.display = 'block';
    globeTooltip.style.left = (e.clientX - rect.left + 16) + 'px';
    globeTooltip.style.top  = (e.clientY - rect.top  + 16) + 'px';
  });
  renderer.domElement.addEventListener('mouseleave', () => { globeTooltip.style.display='none'; });

  // Click
  renderer.domElement.addEventListener('click', (e) => {
    if (isDragging) return;
    const hit = getHit(e.clientX, e.clientY);
    if (!hit) return;

    if (isZoomed) { resetView(); return; }

    // Marker hit?
    if (hit.object.userData && hit.object.userData.eventId) {
      const ev = EVENTS_DATA.find(ev => ev.id === hit.object.userData.eventId);
      if (ev) { switchGlobeDataset(ev.dataKey); return; }
    }

    const { lat, lon } = hitToLatLon(hit);
    const val = latLonToGridVal(lat, lon);

    flyToPoint(hit.point);
    globeTooltip.style.display = 'none';
    addClickMarker(lat, lon); 
    showStatsPanel(lat, lon, val);
  });

  // Hint
  const hint = document.createElement('div');
  hint.style.cssText = `position:absolute;top:12px;left:50%;transform:translateX(-50%);
    font-family:Menlo,monospace;font-size:11px;color:#555;pointer-events:none;
    white-space:nowrap;z-index:40;`;
  hint.textContent = 'Click anywhere to zoom in · Click again to reset';
  container.appendChild(hint);

  // ── Drag to rotate ─────────────────────────────────────────
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0, rotY = 0;

  container.addEventListener('mousedown', (e) => { isDragging=true; lastX=e.clientX; lastY=e.clientY; });
  window.addEventListener('mouseup', () => { isDragging=false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - lastX) * 0.005;
    rotX += (e.clientY - lastY) * 0.005;
    rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotX));
    lastX = e.clientX; lastY = e.clientY;
  });

  container.addEventListener('touchstart', (e) => { isDragging=true; lastX=e.touches[0].clientX; lastY=e.touches[0].clientY; });
  container.addEventListener('touchmove', (e) => {
    if (!isDragging) return; e.preventDefault();
    rotY += (e.touches[0].clientX-lastX)*0.005;
    rotX += (e.touches[0].clientY-lastY)*0.005;
    rotX = Math.max(-Math.PI/2, Math.min(Math.PI/2, rotX));
    lastX=e.touches[0].clientX; lastY=e.touches[0].clientY;
  }, { passive:false });
  container.addEventListener('touchend', () => { isDragging=false; });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    const d = camera.position.length() + e.deltaY * 0.003;
    const clamped = Math.max(1.4, Math.min(6, d));
    camTarget.copy(camera.position.clone().normalize().multiplyScalar(clamped));
  });

  window.addEventListener('resize', () => {
    const w=container.clientWidth, h=container.clientHeight;
    camera.aspect=w/h; camera.updateProjectionMatrix(); renderer.setSize(w,h);
  });

  // ── Render loop ────────────────────────────────────────────
  const EASE = 0.06;
  const _lookAt = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    // Globe rotation
    if (autoRotate && !isDragging) rotY += 0.0012;
    globe.rotation.x = rotX;
    globe.rotation.y = rotY;
    nightMesh.rotation.copy(globe.rotation);

    // Smooth camera position
    camera.position.lerp(camTarget, EASE);

    // Smooth camera lookAt
    _lookAt.lerp(camTargetLookAt, EASE);
    camera.lookAt(_lookAt);

    renderer.render(scene, camera);
  }
  animate();
}

// ── Texture builder ────────────────────────────────────────
function gridToTexture(grid) {
  const rows=grid.length, cols=grid[0].length;
  const c=document.createElement('canvas');
  c.width=cols; c.height=rows;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#050510'; ctx.fillRect(0,0,cols,rows);
  const img=ctx.createImageData(cols,rows);
  const d=img.data;
  for (let r=0;r<rows;r++) for (let cc=0;cc<cols;cc++) {
    const t=grid[r][cc]; if (t===null) continue;
    const col=tempToColorGlobe(t), idx=(r*cols+cc)*4;
    d[idx]=col[0]; d[idx+1]=col[1]; d[idx+2]=col[2]; d[idx+3]=255;
  }
  ctx.putImageData(img,0,0);
  return new THREE.CanvasTexture(c);
}

function tempToColorGlobe(t) {
  const x=Math.max(0,Math.min(1,(t+25)/75));
  let r,g,b;
  if (x<0.5) { const f=x/0.5; r=Math.round(59+(245-59)*f); g=Math.round(76+(245-76)*f); b=Math.round(192+(245-192)*f); }
  else { const f=(x-0.5)/0.5; r=Math.round(245+(180-245)*f); g=Math.round(245+(4-245)*f); b=Math.round(245+(38-245)*f); }
  return [r,g,b];
}