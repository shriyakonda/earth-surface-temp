// Wait for the page + libraries to load
window.addEventListener('load', initGlobe);

async function initGlobe() {
  const container = document.getElementById('globe-container');
  const width = container.clientWidth;
  const height = container.clientHeight;

  // Scene + camera + renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
  camera.position.z = 3;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(width, height);
  container.appendChild(renderer.domElement);

  // Load temperature data and build a texture from it
  const data = await fetch('data/lst_jul_2020.json').then(r => r.json());
  const texture = gridToTexture(data);

  // Sphere with the temperature texture
  const geometry = new THREE.SphereGeometry(1, 64, 64);
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const globe = new THREE.Mesh(geometry, material);
  scene.add(globe);

  // Mouse drag to rotate
  let isDragging = false;
  let lastX = 0, lastY = 0;
  let rotX = 0, rotY = 0;

  container.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => isDragging = false);
  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    rotY += (e.clientX - lastX) * 0.005;
    rotX += (e.clientY - lastY) * 0.005;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  // Scroll to zoom
  container.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.position.z += e.deltaY * 0.002;
    camera.position.z = Math.max(1.5, Math.min(5, camera.position.z));
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    globe.rotation.y = rotY;
    globe.rotation.x = rotX;
    renderer.render(scene, camera);
  }
  animate();
}

// Convert your 2D temperature grid into a colored texture for the sphere
function gridToTexture(grid) {
  const rows = grid.length;
  const cols = grid[0].length;

  const canvas = document.createElement('canvas');
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext('2d');

  // Black background for ocean / nulls
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, cols, rows);

  // Fill each cell using same blue->red scale as the flat map
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const t = grid[r][c];
      if (t === null) continue;
      ctx.fillStyle = tempToColorGlobe(t);
      ctx.fillRect(c, r, 1, 1);
    }
  }

  return new THREE.CanvasTexture(canvas);
}

function tempToColorGlobe(t) {
  const min = -25, max = 50;
  const x = Math.max(0, Math.min(1, (t - min) / (max - min)));

  let r, g, b;
  if (x < 0.5) {
    const f = x / 0.5;
    r = Math.round(59 + (245 - 59) * f);
    g = Math.round(76 + (245 - 76) * f);
    b = Math.round(192 + (245 - 192) * f);
  } else {
    const f = (x - 0.5) / 0.5;
    r = Math.round(245 + (180 - 245) * f);
    g = Math.round(245 + (4 - 245) * f);
    b = Math.round(245 + (38 - 245) * f);
  }
  return `rgb(${r},${g},${b})`;
}