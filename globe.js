// globe.js — Interactive Three.js globe
// Click: fly-to zoom + regional stats panel
// Hover: temperature tooltip
// Buttons: time period switching (synced with main map)
// Event markers: clickable pins

window.addEventListener('load', initGlobe);
let globeSwitchDataset = null;

async function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  const width  = container.clientWidth;
  const height = container.clientHeight;

  // ── Scene / Camera / Renderer ──────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 2.8;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // ── Starfield ───────────────────────────────────────────────
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1500;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) positions[i] = (Math.random() - 0.5) * 200;
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 })));

  // ── Lights ──────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  // ── Data loading ────────────────────────────────────────────
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
    const res = await fetch(FILES[key]);
    return res.json();
  }

  let currentGridRef = null;
  let currentKey = 'jul2020';

  try {
    currentGridRef = await fetchGrid('jul2020');
  } catch (e) {
    console.warn('Globe: could not load data', e);
    return;
  }

  // ── Globe mesh ──────────────────────────────────────────────
  const geometry = new THREE.SphereGeometry(1, 72, 72);
  const material = new THREE.MeshPhongMaterial({
    map: gridToTexture(currentGridRef),
    shininess: 8,
    specular: new THREE.Color(0x223344),
  });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Atmosphere
  const atmMat = new THREE.MeshPhongMaterial({ color: 0x2244bb, transparent: true, opacity: 0.07, side: THREE.FrontSide });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.04, 72, 72), atmMat));

  // Night side
  const nightMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1.011, 72, 72),
    new THREE.MeshBasicMaterial({ color: 0x000011, transparent: true, opacity: 0.45, side: THREE.BackSide })
  );
  scene.add(nightMesh);

  // ── Event markers ───────────────────────────────────────────
  const EVENTS_DATA = [
    { id: 'euro2003',       lat: 46.0, lon: 2.0,   color: 0xff4500, dataKey: 'jul2003' },
    { id: 'siberia2020',    lat: 65.0, lon: 100.0,  color: 0xff6b00, dataKey: 'jul2020' },
    { id: 'middleeast2024', lat: 26.0, lon: 67.0,   color: 0xcc0000, dataKey: 'jul2024' },
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
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.025, 0.038, 32),
        new THREE.MeshBasicMaterial({ color: ev.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
      );
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.rotateY(Math.PI);
      ring.userData = { eventId: ev.id, lat: ev.lat, lon: ev.lon };
      globe.add(ring);
      markerMeshes.push(ring);

      const dot = new THREE.Mesh(
        new THREE.CircleGeometry(0.014, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
      );
      dot.position.copy(pos);
      dot.lookAt(new THREE.Vector3(0, 0, 0));
      dot.rotateY(Math.PI);
      dot.userData = { eventId: ev.id, lat: ev.lat, lon: ev.lon };
      globe.add(dot);
      markerMeshes.push(dot);
    });
  }
  buildMarkers('jul2020');

  // ── Tooltip ─────────────────────────────────────────────────
  const globeTooltip = document.createElement('div');
  globeTooltip.style.cssText = `
    position:absolute; background:rgba(10,10,20,0.95); color:#fff;
    padding:8px 14px; border-radius:5px; font-family:Menlo,monospace;
    font-size:13px; pointer-events:none; display:none;
    border:1px solid #333; white-space:nowrap; z-index:50;
  `;
  container.style.position = 'relative';
  container.appendChild(globeTooltip);

  // ── Regional Stats Panel ────────────────────────────────────
  const statsPanel = document.createElement('div');
  statsPanel.style.cssText = `
    position:absolute; top:14px; right:14px; width:220px;
    background:rgba(10,10,24,0.97); border:1px solid #333;
    border-radius:8px; padding:16px; font-family:Georgia,serif;
    color:#ddd; z-index:60; transform:translateX(260px);
    transition:transform 0.4s cubic-bezier(0.16,1,0.3,1);
    box-shadow: 0 4px 24px rgba(0,0,0,0.7);
  `;
  statsPanel.innerHTML = `
    <div id="sp-close" style="position:absolute;top:10px;right:12px;cursor:pointer;color:#666;font-size:16px;line-height:1;">✕</div>
    <div id="sp-title"  style="font-size:13px;font-weight:700;color:#fff;margin-bottom:4px;"></div>
    <div id="sp-coords" style="font-size:11px;color:#777;font-family:Menlo,monospace;margin-bottom:12px;"></div>
    <div style="display:flex;flex-direction:column;gap:8px;">
      <div class="sp-stat">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Temperature here</div>
        <div id="sp-temp" style="font-size:22px;font-weight:700;color:#fff;"></div>
      </div>
      <div class="sp-stat">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Regional avg (±10°)</div>
        <div id="sp-avg"  style="font-size:16px;color:#aaa;"></div>
      </div>
      <div class="sp-stat">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:2px;">Regional range</div>
        <div id="sp-range" style="font-size:14px;color:#aaa;"></div>
      </div>
      <div id="sp-event" style="margin-top:6px;padding:8px;border-radius:4px;font-size:12px;display:none;line-height:1.5;"></div>
    </div>
    <div style="margin-top:12px;">
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:#666;margin-bottom:6px;">Back out</div>
      <button id="sp-reset" style="font-family:inherit;font-size:12px;padding:6px 14px;
        background:#1a1a2e;color:#aaa;border:1px solid #333;border-radius:4px;cursor:pointer;width:100%;">
        ← Reset View
      </button>
    </div>
  `;
  container.appendChild(statsPanel);

  document.getElementById('sp-close').addEventListener('click', resetView);
  document.getElementById('sp-reset').addEventListener('click', resetView);

  function showStatsPanel(lat, lon, val) {
    // Compute regional stats in a ±10° bounding box
    const grid = currentGridRef;
    let sum = 0, count = 0, minV = Infinity, maxV = -Infinity;
    if (grid) {
      const rows = grid.length, cols = grid[0].length;
      const r0 = Math.max(0, Math.floor((90 - (lat + 10)) / 180 * rows));
      const r1 = Math.min(rows - 1, Math.floor((90 - (lat - 10)) / 180 * rows));
      const c0 = Math.max(0, Math.floor((lon - 10 + 180) / 360 * cols));
      const c1 = Math.min(cols - 1, Math.floor((lon + 10 + 180) / 360 * cols));
      for (let r = r0; r <= r1; r++) {
        for (let c = c0; c <= c1; c++) {
          const v = grid[r][c];
          if (v === null || isNaN(v)) continue;
          sum += v; count++;
          if (v < minV) minV = v;
          if (v > maxV) maxV = v;
        }
      }
    }

    const avg   = count > 0 ? (sum / count).toFixed(1) : '—';
    const range = count > 0 ? `${minV.toFixed(1)} to ${maxV.toFixed(1)} °C` : '—';

    // Region name (very rough)
    const regionName = roughRegionName(lat, lon);

    document.getElementById('sp-title').textContent  = regionName;
    document.getElementById('sp-coords').textContent = `${lat.toFixed(1)}°, ${lon.toFixed(1)}° · ${LABELS_MAP[currentKey]}`;
    document.getElementById('sp-temp').textContent   = val !== null && !isNaN(val) ? `${val.toFixed(1)} °C` : 'No data';
    document.getElementById('sp-temp').style.color   = val !== null && !isNaN(val) ? tempToHex(val) : '#777';
    document.getElementById('sp-avg').textContent    = count > 0 ? `${avg} °C` : 'No data';
    document.getElementById('sp-range').textContent  = range;

    // Nearest event
    const nearestEvent = EVENTS_DATA.find(ev => ev.dataKey === currentKey &&
      Math.abs(ev.lat - lat) < 15 && Math.abs(ev.lon - lon) < 20);
    const spEvent = document.getElementById('sp-event');
    if (nearestEvent) {
      const evInfo = {
        euro2003:       { name: '2003 European Heat Wave', color: '#ff4500' },
        siberia2020:    { name: '2020 Siberian Heat Wave', color: '#ff6b00' },
        middleeast2024: { name: '2024 South Asia Heat',    color: '#cc0000' },
      }[nearestEvent.id];
      spEvent.style.display = 'block';
      spEvent.style.borderLeft = `3px solid ${evInfo.color}`;
      spEvent.style.paddingLeft = '8px';
      spEvent.style.color = '#bbb';
      spEvent.innerHTML = `<strong style="color:${evInfo.color}">${evInfo.name}</strong><br>This area was affected.`;
    } else {
      spEvent.style.display = 'none';
    }

    statsPanel.style.transform = 'translateX(0)';
  }

  function hideStatsPanel() {
    statsPanel.style.transform = 'translateX(260px)';
  }

  // Rough region name from lat/lon
  function roughRegionName(lat, lon) {
    if (lat > 60)  return lon > 30 && lon < 180 ? 'Siberia / Arctic' : 'Northern Canada / Arctic';
    if (lat > 35 && lon > -15 && lon < 40)  return 'Europe';
    if (lat > 20 && lon > 40 && lon < 75)   return 'Middle East';
    if (lat > 5  && lon > 65 && lon < 100)  return 'South Asia';
    if (lat > 15 && lon > 100 && lon < 145) return 'East Asia';
    if (lat > 25 && lon > -130 && lon < -60) return 'North America';
    if (lat < 0  && lon > -85 && lon < -35) return 'South America';
    if (lat > -5 && lon > -20 && lon < 55)  return 'Africa';
    if (lat < -10 && lon > 110 && lon < 155) return 'Australia';
    return `${Math.abs(lat).toFixed(0)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(0)}°${lon >= 0 ? 'E' : 'W'}`;
  }

  function tempToHex(t) {
    if (t < 0)  return '#6699ff';
    if (t < 15) return '#aaddff';
    if (t < 25) return '#ffffaa';
    if (t < 35) return '#ffaa44';
    return '#ff3322';
  }

  // ── Camera fly-to animation ─────────────────────────────────
  let isZoomed = false;
  let autoRotate = true;
  let rotX = 0, rotY = 0;
  let targetRotX = 0, targetRotY = 0;
  let targetZoom = 2.8;
  let currentZoom = 2.8;
  let animating = false;

  function flyTo(lat, lon) {
    // To face a lat/lon toward the camera (+Z), we need to rotate the globe
    // so that point ends up pointing at us.
    const phi   = (90 - lat) * (Math.PI / 180);   // colatitude
    const theta = (lon + 180) * (Math.PI / 180);   // longitude offset

    // rotX tilts the globe so the latitude is centered
    targetRotX = -(Math.PI / 2 - phi);
    // rotY spins the globe so the longitude faces the camera
    targetRotY = theta;

    targetZoom = 1.55;
    autoRotate = false;
    isZoomed = true;
    animating = true;
  }

  function resetView() {
    targetZoom = 2.8;
    targetRotX = 0;
    rotX = 0;
    autoRotate = true;
    isZoomed = false;
    animating = false;
    hideStatsPanel();
    globeTooltip.style.display = 'none';
  }

  // ── Globe time-period buttons ───────────────────────────────
  const globeControls = document.createElement('div');
  globeControls.style.cssText = `
    position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
    display:flex; gap:8px; z-index:40;
  `;
  const globeBtns = {};
  Object.keys(LABELS_MAP).forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = LABELS_MAP[key];
    btn.style.cssText = `
      font-family:inherit; font-size:12px; padding:6px 14px;
      border:1px solid #444; background:rgba(20,20,40,0.85);
      color:#aaa; cursor:pointer; border-radius:4px; transition:all 0.15s;
    `;
    if (key === 'jul2020') { btn.style.background = '#b40426'; btn.style.color = '#fff'; btn.style.borderColor = '#b40426'; }
    btn.addEventListener('click', () => switchGlobeDataset(key));
    globeControls.appendChild(btn);
    globeBtns[key] = btn;
  });
  container.appendChild(globeControls);

  async function switchGlobeDataset(key) {
    currentKey = key;
    Object.entries(globeBtns).forEach(([k, b]) => {
      b.style.background  = k === key ? '#b40426' : 'rgba(20,20,40,0.85)';
      b.style.color       = k === key ? '#fff'    : '#aaa';
      b.style.borderColor = k === key ? '#b40426' : '#444';
    });
    const grid = await fetchGrid(key);
    currentGridRef = grid;
    material.map = gridToTexture(grid);
    material.map.needsUpdate = true;
    buildMarkers(key);
  }
  globeSwitchDataset = switchGlobeDataset;

  // ── Raycaster ───────────────────────────────────────────────
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function getGlobeIntersect(clientX, clientY) {
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x =  ((clientX - rect.left) / rect.width)  * 2 - 1;
    mouse.y = -((clientY - rect.top)  / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObject(globe, true);
    return hits.length > 0 ? hits[0] : null;
  }

  function worldPointToLatLon(point) {
    // Convert world-space hit point into the globe's LOCAL space,
    // which correctly undoes the current rotation.
    const local = point.clone().applyEuler(
      new THREE.Euler(-globe.rotation.x, -globe.rotation.y, 0, 'YXZ')
    );
    const len = local.length();
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, local.y / len))) * (180 / Math.PI);
    const lon = (Math.atan2(local.z, -local.x) * (180 / Math.PI) - 180 + 360) % 360 - 180;
    return { lat, lon };
  }

  function latLonToGridVal(lat, lon, grid) {
    if (!grid) return null;
    const rows = grid.length, cols = grid[0].length;
    const r = Math.floor((90 - lat) / 180 * rows);
    const c = Math.floor((lon + 180) / 360 * cols);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return grid[r][c];
  }

  // Hover tooltip
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) { globeTooltip.style.display = 'none'; return; }
    const hit = getGlobeIntersect(e.clientX, e.clientY);
    if (!hit) { globeTooltip.style.display = 'none'; return; }
    const { lat, lon } = worldPointToLatLon(hit.point);
    const val = latLonToGridVal(lat, lon, currentGridRef);
    const rect = container.getBoundingClientRect();
    globeTooltip.innerHTML = val !== null && !isNaN(val)
      ? `<strong>${val.toFixed(1)} °C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`
      : `${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br><em style="color:#777">Ocean / no data</em>`;
    globeTooltip.style.display = 'block';
    globeTooltip.style.left = (e.clientX - rect.left + 16) + 'px';
    globeTooltip.style.top  = (e.clientY - rect.top  + 16) + 'px';
  });
  renderer.domElement.addEventListener('mouseleave', () => { globeTooltip.style.display = 'none'; });

  // Click → fly-to + stats
  renderer.domElement.addEventListener('click', (e) => {
    if (isDragging) return;
    const hit = getGlobeIntersect(e.clientX, e.clientY);
    if (!hit) return;

    // If already zoomed in, reset first
    if (isZoomed) { resetView(); return; }

    const { lat, lon } = worldPointToLatLon(hit.point);
    const val = latLonToGridVal(lat, lon, currentGridRef);

    // Check marker hit
    if (hit.object.userData && hit.object.userData.eventId) {
      const ev = EVENTS_DATA.find(ev => ev.id === hit.object.userData.eventId);
      if (ev) { switchGlobeDataset(ev.dataKey); return; }
    }

    flyTo(lat, lon);
    showStatsPanel(lat, lon, val);
    globeTooltip.style.display = 'none';
  });

  // Hint text
  const hint = document.createElement('div');
  hint.style.cssText = `
    position:absolute; top:12px; left:50%; transform:translateX(-50%);
    font-family:Menlo,monospace; font-size:11px; color:#555;
    pointer-events:none; white-space:nowrap; z-index:40;
    transition: opacity 0.3s;
  `;
  hint.textContent = 'Click anywhere to zoom in · Click again to reset';
  container.appendChild(hint);

  // ── Mouse drag ──────────────────────────────────────────────
  let isDragging = false;
  let lastX = 0, lastY = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true; lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - lastX) * 0.005;
    rotX += (e.clientY - lastY) * 0.005;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = e.clientX; lastY = e.clientY;
    if (isZoomed) { targetRotX = rotX; targetRotY = rotY; }
  });

  container.addEventListener('touchstart', (e) => {
    isDragging = true; lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  });
  container.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    rotY += (e.touches[0].clientX - lastX) * 0.005;
    rotX += (e.touches[0].clientY - lastY) * 0.005;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
  }, { passive: false });
  container.addEventListener('touchend', () => { isDragging = false; });

  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    targetZoom += e.deltaY * 0.003;
    targetZoom = Math.max(1.4, Math.min(6, targetZoom));
  });

  window.addEventListener('resize', () => {
    const w = container.clientWidth, h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ── Render loop ─────────────────────────────────────────────
  const EASE = 0.08;

  function animate() {
    requestAnimationFrame(animate);

    // Auto-rotate when not zoomed / dragging
    if (autoRotate && !isDragging) rotY += 0.0012;

    // Smooth camera zoom
    currentZoom += (targetZoom - currentZoom) * EASE;
    camera.position.z = currentZoom;

    // Smooth rotation toward target when flying
    if (animating) {
      rotX += (targetRotX - rotX) * EASE;
      rotY += (targetRotY - rotY) * EASE;
      if (Math.abs(targetRotX - rotX) < 0.001 && Math.abs(targetRotY - rotY) < 0.001) animating = false;
    }

    globe.rotation.x = rotX;
    globe.rotation.y = rotY;
    nightMesh.rotation.copy(globe.rotation);
    renderer.render(scene, camera);
  }
  animate();
}

// ── Texture builder ──────────────────────────────────────────
function gridToTexture(grid) {
  const rows = grid.length, cols = grid[0].length;
  const canvas = document.createElement('canvas');
  canvas.width = cols; canvas.height = rows;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, cols, rows);
  const imageData = ctx.createImageData(cols, rows);
  const data = imageData.data;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      const color = tempToColorGlobe(t);
      const idx = (r * cols + c) * 4;
      data[idx] = color[0]; data[idx+1] = color[1]; data[idx+2] = color[2]; data[idx+3] = 255;
    }
  }
  ctx.putImageData(imageData, 0, 0);
  return new THREE.CanvasTexture(canvas);
}

function tempToColorGlobe(t) {
  const min = -25, max = 50;
  const x = Math.max(0, Math.min(1, (t - min) / (max - min)));
  let r, g, b;
  if (x < 0.5) {
    const f = x / 0.5;
    r = Math.round(59  + (245-59)  * f);
    g = Math.round(76  + (245-76)  * f);
    b = Math.round(192 + (245-192) * f);
  } else {
    const f = (x - 0.5) / 0.5;
    r = Math.round(245 + (180-245) * f);
    g = Math.round(245 + (4-245)   * f);
    b = Math.round(245 + (38-245)  * f);
  }
  return [r, g, b];
}