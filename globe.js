// globe.js — Interactive Three.js globe
// Features: drag to rotate, scroll to zoom, click for temp tooltip,
//           event marker pins, time period switching, day/night terminator

window.addEventListener('load', initGlobe);

// Called by script.js when the user switches time period on the main map
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
  for (let i = 0; i < starCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.12, transparent: true, opacity: 0.7 });
  scene.add(new THREE.Points(starGeo, starMat));

  // ── Lights ──────────────────────────────────────────────────
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.35);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.2);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  // ── Load initial temperature data ───────────────────────────
  let currentData = null;
  let currentGridRef = null;

  async function fetchGrid(key) {
    const FILES = {
      jul2020: 'data/lst_jul_2020.json',
      jan2020: 'data/lst_jan_2020.json',
      jul2003: 'data/lst_jul_2003.json',
      jul2024: 'data/lst_jul_2024.json',
    };
    // Reuse main map cache if available
    if (window.dataCache && window.dataCache[key]) return window.dataCache[key];
    const res = await fetch(FILES[key]);
    return res.json();
  }

  try {
    currentData = await fetchGrid('jul2020');
    currentGridRef = currentData;
  } catch (e) {
    console.warn('Globe: could not load temperature data', e);
    return;
  }

  // ── Globe mesh ──────────────────────────────────────────────
  const geometry = new THREE.SphereGeometry(1, 72, 72);
  const material = new THREE.MeshPhongMaterial({
    map: gridToTexture(currentData),
    shininess: 8,
    specular: new THREE.Color(0x223344),
  });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // ── Atmosphere glow ─────────────────────────────────────────
  const atmGeo = new THREE.SphereGeometry(1.04, 72, 72);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x2244bb,
    transparent: true,
    opacity: 0.07,
    side: THREE.FrontSide,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  // ── Day/Night terminator ────────────────────────────────────
  // A dark hemisphere on the night side, positioned like a directional shadow
  const nightGeo = new THREE.SphereGeometry(1.011, 72, 72);
  const nightMat = new THREE.MeshBasicMaterial({
    color: 0x000011,
    transparent: true,
    opacity: 0.45,
    side: THREE.BackSide,
  });
  const nightMesh = new THREE.Mesh(nightGeo, nightMat);
  // Position the night side opposite the sun
  nightMesh.rotation.y = Math.PI;
  scene.add(nightMesh);

  // ── Event marker sprites ────────────────────────────────────
  const EVENTS_DATA = [
    { id: 'euro2003',      lat: 46.0, lon: 2.0,   color: 0xff4500, dataKey: 'jul2003' },
    { id: 'siberia2020',   lat: 65.0, lon: 100.0,  color: 0xff6b00, dataKey: 'jul2020' },
    { id: 'middleeast2024',lat: 26.0, lon: 67.0,   color: 0xcc0000, dataKey: 'jul2024' },
  ];

  const LABELS_MAP = {
    jul2020: 'July 2020', jan2020: 'January 2020',
    jul2003: 'July 2003', jul2024: 'July 2024',
  };

  let currentKey = 'jul2020';
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
    // Remove old markers
    markerMeshes.forEach(m => globe.remove(m));
    markerMeshes.length = 0;

    EVENTS_DATA.forEach(ev => {
      if (ev.dataKey !== activeKey) return;
      const pos = latLonToVec3(ev.lat, ev.lon, 1.015);

      // Outer ring
      const ringGeo = new THREE.RingGeometry(0.025, 0.038, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: ev.color, side: THREE.DoubleSide, transparent: true, opacity: 0.85,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(pos);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      ring.rotateY(Math.PI);
      ring.userData = { eventId: ev.id, lat: ev.lat, lon: ev.lon };
      globe.add(ring);
      markerMeshes.push(ring);

      // Center dot
      const dotGeo = new THREE.CircleGeometry(0.014, 24);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(pos);
      dot.lookAt(new THREE.Vector3(0, 0, 0));
      dot.rotateY(Math.PI);
      dot.userData = { eventId: ev.id, lat: ev.lat, lon: ev.lon };
      globe.add(dot);
      markerMeshes.push(dot);
    });
  }

  buildMarkers('jul2020');

  // ── Globe tooltip overlay ───────────────────────────────────
  const globeTooltip = document.createElement('div');
  globeTooltip.style.cssText = `
    position:absolute; background:rgba(10,10,20,0.95); color:#fff;
    padding:8px 14px; border-radius:5px; font-family:Menlo,monospace;
    font-size:13px; pointer-events:none; display:none;
    border:1px solid #333; white-space:nowrap; z-index:50;
  `;
  container.style.position = 'relative';
  container.appendChild(globeTooltip);

  // ── Globe time-period buttons ───────────────────────────────
  const globeControls = document.createElement('div');
  globeControls.style.cssText = `
    position:absolute; bottom:14px; left:50%; transform:translateX(-50%);
    display:flex; gap:8px; z-index:40;
  `;
  const periodKeys = ['jul2003','jan2020','jul2020','jul2024'];
  const globeBtns = {};
  periodKeys.forEach(key => {
    const btn = document.createElement('button');
    btn.textContent = LABELS_MAP[key];
    btn.style.cssText = `
      font-family:inherit; font-size:12px; padding:6px 14px;
      border:1px solid #444; background:rgba(20,20,40,0.85);
      color:#aaa; cursor:pointer; border-radius:4px; transition:all 0.15s;
    `;
    if (key === 'jul2020') {
      btn.style.background = '#b40426';
      btn.style.color = '#fff';
      btn.style.borderColor = '#b40426';
    }
    btn.addEventListener('mouseenter', () => {
      if (key !== currentKey) btn.style.background = 'rgba(40,40,60,0.9)';
    });
    btn.addEventListener('mouseleave', () => {
      if (key !== currentKey) btn.style.background = 'rgba(20,20,40,0.85)';
    });
    btn.addEventListener('click', () => switchGlobeDataset(key));
    globeControls.appendChild(btn);
    globeBtns[key] = btn;
  });
  container.appendChild(globeControls);

  async function switchGlobeDataset(key) {
    currentKey = key;
    // Update button styles
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

  // Expose to script.js so the main map buttons also update the globe
  globeSwitchDataset = switchGlobeDataset;

  // ── Raycaster for click/hover on globe ──────────────────────
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
    // Invert the globe mesh's rotation to get the actual lat/lon
    const local = globe.worldToLocal(point.clone());
    const lat =  90 - Math.acos(local.y / local.length()) * (180 / Math.PI);
    const lon = (Math.atan2(local.z, -local.x) * (180 / Math.PI) - 180 + 360) % 360 - 180;
    return { lat, lon };
  }

  function latLonToGridVal(lat, lon, grid) {
    if (!grid) return null;
    const rows = grid.length;
    const cols = grid[0].length;
    const r = Math.floor((90 - lat) / 180 * rows);
    const c = Math.floor((lon + 180) / 360 * cols);
    if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
    return grid[r][c];
  }

  // Hover → temperature tooltip
  renderer.domElement.addEventListener('mousemove', (e) => {
    if (isDragging) { globeTooltip.style.display = 'none'; return; }
    const hit = getGlobeIntersect(e.clientX, e.clientY);
    if (!hit) { globeTooltip.style.display = 'none'; return; }

    const { lat, lon } = worldPointToLatLon(hit.point);
    const val = latLonToGridVal(lat, lon, currentGridRef);
    const rect = container.getBoundingClientRect();

    if (val === null || isNaN(val)) {
      globeTooltip.innerHTML = `${lat.toFixed(1)}°, ${lon.toFixed(1)}°<br><em style="color:#777">Ocean / no data</em>`;
    } else {
      globeTooltip.innerHTML = `<strong>${val.toFixed(1)} °C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
    }
    globeTooltip.style.display = 'block';
    globeTooltip.style.left = (e.clientX - rect.left + 16) + 'px';
    globeTooltip.style.top  = (e.clientY - rect.top  + 16) + 'px';
  });

  renderer.domElement.addEventListener('mouseleave', () => {
    globeTooltip.style.display = 'none';
  });

  // Click → check for event marker hit, then show flat-map crosshair
  renderer.domElement.addEventListener('click', (e) => {
    const hit = getGlobeIntersect(e.clientX, e.clientY);
    if (!hit) return;

    // Check if we clicked a marker
    if (hit.object.userData && hit.object.userData.eventId) {
      const ev = EVENTS_DATA.find(ev => ev.id === hit.object.userData.eventId);
      if (ev) {
        switchGlobeDataset(ev.dataKey);
        return;
      }
    }

    // Otherwise highlight that lat/lon on the flat map
    const { lat, lon } = worldPointToLatLon(hit.point);
    highlightFlatMap(lat, lon);
  });

  function highlightFlatMap(lat, lon) {
    const flatCanvas = document.getElementById('heatmap');
    if (!flatCanvas) return;
    // Scroll flat map into view
    flatCanvas.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash a crosshair on the flat map at the corresponding pixel
    const rows = currentGridRef ? currentGridRef.length    : 360;
    const cols = currentGridRef ? currentGridRef[0].length : 720;
    const fx = (lon + 180) / 360;
    const fy = (90 - lat) / 180;
    const rect = flatCanvas.getBoundingClientRect();
    const px = fx * rect.width;
    const py = fy * rect.height;

    // Draw a temporary crosshair overlay on the flat canvas
    const ctx = flatCanvas.getContext('2d');
    const cw = flatCanvas.width;
    const ch = flatCanvas.height;
    const cx = fx * cw;
    const cy = fy * ch;

    // Save current image and flash the crosshair
    const snap = ctx.getImageData(0, 0, cw, ch);
    let flashes = 0;
    function flashCrosshair() {
      ctx.putImageData(snap, 0, 0);
      ctx.save();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.moveTo(cx - 20, cy); ctx.lineTo(cx + 20, cy); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cx, cy - 20); ctx.lineTo(cx, cy + 20); ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 10, 0, Math.PI * 2);
      ctx.strokeStyle = '#ffdd00';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
      flashes++;
      if (flashes < 6) setTimeout(() => {
        ctx.putImageData(snap, 0, 0);
        if (flashes < 5) setTimeout(flashCrosshair, 200);
      }, 200);
    }
    flashCrosshair();
  }

  // ── Mouse drag to rotate ────────────────────────────────────
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0, rotY = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX; lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => { isDragging = false; });
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - lastX) * 0.005;
    rotX += (e.clientY - lastY) * 0.005;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = e.clientX; lastY = e.clientY;
  });

  // Touch
  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
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

  // Scroll to zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.003;
    camera.position.z = Math.max(1.4, Math.min(6, camera.position.z));
  });

  // Resize
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // ── Render loop ─────────────────────────────────────────────
  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) rotY += 0.0012;
    globe.rotation.y = rotY;
    globe.rotation.x = rotX;
    // Keep night side opposite the sun light
    nightMesh.rotation.copy(globe.rotation);
    renderer.render(scene, camera);
  }
  animate();
}

// ── Texture builder ─────────────────────────────────────────
function gridToTexture(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const canvas = document.createElement('canvas');
  canvas.width  = cols;
  canvas.height = rows;
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
      data[idx]     = color[0];
      data[idx + 1] = color[1];
      data[idx + 2] = color[2];
      data[idx + 3] = 255;
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
    r = Math.round(59  + (245 - 59)  * f);
    g = Math.round(76  + (245 - 76)  * f);
    b = Math.round(192 + (245 - 192) * f);
  } else {
    const f = (x - 0.5) / 0.5;
    r = Math.round(245 + (180 - 245) * f);
    g = Math.round(245 + (4   - 245) * f);
    b = Math.round(245 + (38  - 245) * f);
  }
  return [r, g, b];
}