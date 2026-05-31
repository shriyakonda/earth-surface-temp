// globe.js — Three.js rotating globe with temperature texture
// Drag to rotate, scroll to zoom.

window.addEventListener('load', initGlobe);

async function initGlobe() {
  const container = document.getElementById('globe-container');
  if (!container) return;

  const width  = container.clientWidth;
  const height = container.clientHeight;

  // Scene / camera / renderer
  const scene    = new THREE.Scene();
  const camera   = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 2.8;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(width, height);
  renderer.setPixelRatio(window.devicePixelRatio);
  container.appendChild(renderer.domElement);

  // Starfield background
  const starGeo = new THREE.BufferGeometry();
  const starCount = 1200;
  const positions = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount * 3; i++) {
    positions[i] = (Math.random() - 0.5) * 200;
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const starMat = new THREE.PointsMaterial({ color: 0xffffff, size: 0.15, transparent: true, opacity: 0.6 });
  scene.add(new THREE.Points(starGeo, starMat));

  // Load temperature data
  let data;
  try {
    data = await fetch('data/lst_jul_2020.json').then(r => r.json());
  } catch (e) {
    console.warn('Globe: could not load temperature data', e);
    return;
  }

  const texture  = gridToTexture(data);

  // Globe mesh
  const geometry = new THREE.SphereGeometry(1, 72, 72);
  const material = new THREE.MeshPhongMaterial({
    map: texture,
    shininess: 5,
    specular: new THREE.Color(0x222244),
  });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Atmosphere glow (additive blending)
  const atmGeo = new THREE.SphereGeometry(1.04, 72, 72);
  const atmMat = new THREE.MeshPhongMaterial({
    color: 0x2244aa,
    transparent: true,
    opacity: 0.08,
    side: THREE.FrontSide,
  });
  scene.add(new THREE.Mesh(atmGeo, atmMat));

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
  scene.add(ambientLight);
  const sunLight = new THREE.DirectionalLight(0xfff5e0, 1.1);
  sunLight.position.set(5, 3, 5);
  scene.add(sunLight);

  // Mouse drag to rotate
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0, rotY = 0;
  let velX = 0, velY = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    velX = 0; velY = 0;
  });

  window.addEventListener('mouseup', () => { isDragging = false; });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    velY = dx * 0.005;
    velX = dy * 0.005;
    rotY += velY;
    rotX += velX;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = e.clientX;
    lastY = e.clientY;
  });

  // Touch support
  container.addEventListener('touchstart', (e) => {
    isDragging = true;
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  });
  container.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const dx = e.touches[0].clientX - lastX;
    const dy = e.touches[0].clientY - lastY;
    rotY += dx * 0.005;
    rotX += dy * 0.005;
    rotX = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotX));
    lastX = e.touches[0].clientX;
    lastY = e.touches[0].clientY;
  }, { passive: false });
  container.addEventListener('touchend', () => { isDragging = false; });

  // Scroll to zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.003;
    camera.position.z = Math.max(1.4, Math.min(6, camera.position.z));
  });

  // Resize handler
  window.addEventListener('resize', () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });

  // Render loop — auto-slow-rotate when not dragging
  function animate() {
    requestAnimationFrame(animate);
    if (!isDragging) {
      rotY += 0.0015;
      velX *= 0.95;
      velY *= 0.95;
    }
    globe.rotation.y = rotY;
    globe.rotation.x = rotX;
    renderer.render(scene, camera);
  }
  animate();
}

// Convert 2D temperature grid into a Three.js texture
function gridToTexture(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const canvas = document.createElement('canvas');
  canvas.width  = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  // Ocean / null background
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