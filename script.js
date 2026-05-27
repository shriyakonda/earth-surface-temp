// ---- config ----
const FILES = {
  jul2020: 'data/lst_jul_2020.json',
  jan2020: 'data/lst_jan_2020.json',
  jul2003: 'data/lst_jul_2003.json',
  jul2024: 'data/lst_jul_2024.json',
};

const canvas = document.getElementById('heatmap');
const ctx = canvas.getContext('2d');
const tooltip = document.getElementById('tooltip');
const buttons = document.querySelectorAll('.year-btn');

let currentGrid = null;
const dataCache = {};

// ---- color scale: blue -> white -> red ----
// rough mimic of matplotlib's RdYlBu_r
function tempToColor(t) {
  if (t === null || isNaN(t)) return null;
  // clamp temperature between -25 and 50 C
  const min = -25, max = 50;
  const x = Math.max(0, Math.min(1, (t - min) / (max - min)));

  let r, g, b;
  if (x < 0.5) {
    // blue -> white
    const f = x / 0.5;
    r = Math.round(59  + (245 - 59)  * f);
    g = Math.round(76  + (245 - 76)  * f);
    b = Math.round(192 + (245 - 192) * f);
  } else {
    // white -> red
    const f = (x - 0.5) / 0.5;
    r = Math.round(245 + (180 - 245) * f);
    g = Math.round(245 + (4   - 245) * f);
    b = Math.round(245 + (38  - 245) * f);
  }
  return `rgb(${r},${g},${b})`;
}

// ---- draw grid onto canvas ----
function drawGrid(grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const cellW = canvas.width / cols;
  const cellH = canvas.height / rows;

  // background fill (for ocean / null cells)
  ctx.fillStyle = '#e8e8e8';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
      const color = tempToColor(val);
      if (color === null) continue;
      ctx.fillStyle = color;
      ctx.fillRect(c * cellW, r * cellH, cellW + 1, cellH + 1);
    }
  }
}

// ---- load + cache a dataset ----
async function loadDataset(key) {
  if (dataCache[key]) return dataCache[key];
  const res = await fetch(FILES[key]);
  const data = await res.json();
  dataCache[key] = data;
  return data;
}

// ---- switch to a new dataset ----
async function switchTo(key) {
  const grid = await loadDataset(key);
  currentGrid = grid;
  drawGrid(grid);
}

// ---- hover tooltip ----
canvas.addEventListener('mousemove', (e) => {
  if (!currentGrid) return;

  const rect = canvas.getBoundingClientRect();
  // map mouse pos -> canvas internal coords -> grid cell
  const px = (e.clientX - rect.left) * (canvas.width / rect.width);
  const py = (e.clientY - rect.top)  * (canvas.height / rect.height);

  const rows = currentGrid.length;
  const cols = currentGrid[0].length;
  const c = Math.floor(px / (canvas.width / cols));
  const r = Math.floor(py / (canvas.height / rows));

  const val = currentGrid[r] && currentGrid[r][c];

  // lat/lon math: row 0 = +90 lat, last row = -90; col 0 = -180 lon, last col = +180
  const lat = (90 - (r / rows) * 180).toFixed(1);
  const lon = (-180 + (c / cols) * 360).toFixed(1);

  if (val === null || val === undefined || isNaN(val)) {
    tooltip.style.opacity = 0;
    return;
  }

  tooltip.style.opacity = 1;
  tooltip.style.left = (e.clientX - rect.left + 12) + 'px';
  tooltip.style.top  = (e.clientY - rect.top + 12)  + 'px';
  tooltip.innerHTML = `${val}&nbsp;°C<br>${lat}°, ${lon}°`;
});

canvas.addEventListener('mouseleave', () => {
  tooltip.style.opacity = 0;
});

// ---- button handlers ----
buttons.forEach(btn => {
  btn.addEventListener('click', () => {
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchTo(btn.dataset.key);
  });
});

// ---- initial load ----
switchTo('jul2020');