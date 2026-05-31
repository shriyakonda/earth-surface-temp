// ============================================================
// CONFIG & DATA
// ============================================================
const FILES = {
  jul2020: 'data/lst_jul_2020.json',
  jan2020: 'data/lst_jan_2020.json',
  jul2003: 'data/lst_jul_2003.json',
  jul2024: 'data/lst_jul_2024.json',
};

const LABELS = {
  jul2020: 'July 2020',
  jan2020: 'January 2020',
  jul2003: 'July 2003',
  jul2024: 'July 2024',
};

// ============================================================
// EXTREME WEATHER EVENTS
// ============================================================
const EVENTS = [
  {
    id: 'euro2003',
    title: '2003 European Heat Wave',
    date: 'August 2003',
    dataKey: 'jul2003',
    lat: 46.0,
    lon: 2.0,
    markerLat: 46.0,
    markerLon: 2.0,
    color: '#ff4500',
    deaths: '~70,000',
    description: 'The deadliest heat wave in European recorded history. France alone lost over 14,000 people in two weeks. Land surface temperatures across Western Europe exceeded 50°C in some areas — heat that emergency services and hospitals were completely unprepared for.',
    impact: 'France, Germany, Italy, Spain, Portugal',
  },
  {
    id: 'siberia2020',
    title: '2020 Siberian Heat Wave',
    date: 'June–July 2020',
    dataKey: 'jul2020',
    lat: 65.0,
    lon: 100.0,
    markerLat: 65.0,
    markerLon: 100.0,
    color: '#ff6b00',
    deaths: 'Widespread ecological damage',
    description: 'Siberia recorded temperatures over 38°C — 18°C above the long-term average. The permafrost thawed, releasing stored methane. Massive wildfires swept through Siberian forests. Scientists called it "undeniably alarming." This anomaly was virtually impossible without human-caused climate change.',
    impact: 'Siberia, Arctic Circle',
  },
  {
    id: 'middleeast2024',
    title: '2024 South Asia & Middle East Heat',
    date: 'May–July 2024',
    dataKey: 'jul2024',
    lat: 26.0,
    lon: 67.0,
    markerLat: 26.0,
    markerLon: 67.0,
    color: '#cc0000',
    deaths: '1,300+ in Pakistan alone',
    description: 'Record-breaking heat struck Pakistan, India, and the Gulf in 2024. Pakistan\'s Jacobabad regularly exceeded 52°C surface temperatures. Outdoor workers, the elderly, and the poor bore the greatest burden. In many of these areas, air conditioning is not an option — the heat itself is a class issue.',
    impact: 'Pakistan, India, Saudi Arabia, Iran',
  },
];

// ============================================================
// COLOR SCALES
// ============================================================
function tempToColor(t) {
  if (t === null || isNaN(t)) return null;
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
  return [r, g, b];  // ← array, not string
}        // ← closes the function  (this was missing)

function anomalyToColor(delta) {
  if (delta === null || isNaN(delta)) return null;
  const range = 15;
  const x = Math.max(-1, Math.min(1, delta / range));
  let r, g, b;
  if (x < 0) {
    // cooler: white -> blue
    const f = -x;
    r = Math.round(255 + (30  - 255) * f);
    g = Math.round(255 + (100 - 255) * f);
    b = Math.round(255 + (200 - 255) * f);
  } else {
    // warmer: white -> red
    const f = x;
    r = Math.round(255 + (200 - 255) * f);
    g = Math.round(255 + (30  - 255) * f);
    b = Math.round(255 + (30  - 255) * f);
  }
  return [r, g, b];
}

// ============================================================
// CANVAS DRAW HELPERS
// ============================================================
function drawGridToCanvas(canvas, grid, colorFn) {
  const rows = grid.length;
  const cols = grid[0].length;
  const ctx = canvas.getContext('2d');
  const imageData = ctx.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  ctx.fillStyle = '#0a0a2a';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const val = grid[r][c];
      const color = colorFn(val);
      if (!color) continue;

      // Map grid cell to canvas pixels
      const x0 = Math.floor((c / cols) * canvas.width);
      const x1 = Math.floor(((c + 1) / cols) * canvas.width);
      const y0 = Math.floor((r / rows) * canvas.height);
      const y1 = Math.floor(((r + 1) / rows) * canvas.height);

      for (let py = y0; py < y1; py++) {
        for (let px = x0; px < x1; px++) {
          const idx = (py * canvas.width + px) * 4;
          data[idx]     = color[0];
          data[idx + 1] = color[1];
          data[idx + 2] = color[2];
          data[idx + 3] = 255;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

// ============================================================
// DATA CACHE & LOADER
// ============================================================
const dataCache = {};

async function loadDataset(key) {
  if (dataCache[key]) return dataCache[key];
  const res = await fetch(FILES[key]);
  const data = await res.json();
  dataCache[key] = data;
  return data;
}

// ============================================================
// LAT/LON <-> PIXEL HELPERS
// ============================================================
function latLonToCanvasXY(lat, lon, canvas, rows, cols) {
  const c = (lon + 180) / 360 * cols;
  const r = (90 - lat) / 180 * rows;
  const x = (c / cols) * canvas.width;
  const y = (r / rows) * canvas.height;
  return { x, y };
}

function canvasXYToLatLon(px, py, canvas, rows, cols) {
  const c = (px / canvas.width) * cols;
  const r = (py / canvas.height) * rows;
  const lon = (c / cols) * 360 - 180;
  const lat = 90 - (r / rows) * 180;
  return { lat, lon };
}

function canvasXYToGridVal(px, py, canvas, grid) {
  const rows = grid.length;
  const cols = grid[0].length;
  const c = Math.floor((px / canvas.width) * cols);
  const r = Math.floor((py / canvas.height) * rows);
  if (r < 0 || r >= rows || c < 0 || c >= cols) return null;
  return grid[r][c];
}

// ============================================================
// SECTION 1: MAIN MAP
// ============================================================
const mainCanvas = document.getElementById('heatmap');
const mainCtx = mainCanvas.getContext('2d');
const mainTooltip = document.getElementById('tooltip');
const mainButtons = document.querySelectorAll('.year-btn');
let currentGrid = null;
let currentKey = 'jul2020';

async function switchMainMap(key) {
  currentKey = key;
  const grid = await loadDataset(key);
  currentGrid = grid;
  drawGridToCanvas(mainCanvas, grid, (t) => {
    const c = tempToColor(t);
    return c;
  });
  // Re-draw event markers on top if events section is active
  drawMainEventMarkers();
}

function drawMainEventMarkers() {
  // draw subtle pulse markers on main map for events matching current period
  const ctx = mainCtx;
  EVENTS.forEach(ev => {
    if (ev.dataKey !== currentKey) return;
    const { x, y } = latLonToCanvasXY(
      ev.markerLat, ev.markerLon, mainCanvas,
      currentGrid ? currentGrid.length : 360,
      currentGrid ? currentGrid[0].length : 720
    );
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fill();
    ctx.strokeStyle = ev.color;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  });
}

mainCanvas.addEventListener('mousemove', (e) => {
  if (!currentGrid) return;
  const rect = mainCanvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (mainCanvas.width / rect.width);
  const py = (e.clientY - rect.top) * (mainCanvas.height / rect.height);
  const val = canvasXYToGridVal(px, py, mainCanvas, currentGrid);
  const { lat, lon } = canvasXYToLatLon(px, py, mainCanvas, currentGrid.length, currentGrid[0].length);

  if (val === null || val === undefined || isNaN(val)) {
    mainTooltip.style.opacity = 0;
    return;
  }
  mainTooltip.style.opacity = 1;
  mainTooltip.style.left = (e.clientX - rect.left + 12) + 'px';
  mainTooltip.style.top  = (e.clientY - rect.top  + 12) + 'px';
  mainTooltip.innerHTML = `<strong>${val.toFixed(1)}&nbsp;°C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
});

mainCanvas.addEventListener('mouseleave', () => { mainTooltip.style.opacity = 0; });

mainButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    mainButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    switchMainMap(btn.dataset.key);
  });
});

switchMainMap('jul2020');

// ============================================================
// SECTION 2: EXTREME EVENT MARKERS
// ============================================================
const eventCanvas = document.getElementById('event-map');
const eventTooltip = document.getElementById('event-tooltip');
const eventsGrid = document.getElementById('events-grid');
const eventCaption = document.getElementById('event-map-caption');
let activeEventKey = null;
let eventGrid = null;

// Build event cards
EVENTS.forEach(ev => {
  const card = document.createElement('div');
  card.className = 'event-card';
  card.dataset.id = ev.id;
  card.innerHTML = `
    <div class="event-card-dot" style="background:${ev.color}"></div>
    <div class="event-card-body">
      <div class="event-card-title">${ev.title}</div>
      <div class="event-card-date">${ev.date}</div>
      <div class="event-card-region">${ev.impact}</div>
    </div>
  `;
  card.addEventListener('click', () => selectEvent(ev));
  eventsGrid.appendChild(card);
});

async function selectEvent(ev) {
  // Highlight card
  document.querySelectorAll('.event-card').forEach(c => c.classList.remove('active'));
  document.querySelector(`.event-card[data-id="${ev.id}"]`).classList.add('active');

  // Load data + draw
  const grid = await loadDataset(ev.dataKey);
  eventGrid = grid;
  activeEventKey = ev.dataKey;

  drawGridToCanvas(eventCanvas, grid, (t) => tempToColor(t));
  drawEventMarkers(ev);

  // Update caption
  eventCaption.innerHTML = `<strong>${ev.title}</strong> — ${ev.date}. Showing ${LABELS[ev.dataKey]}. ${ev.description}`;
  eventCaption.style.borderLeft = `3px solid ${ev.color}`;
  eventCaption.style.paddingLeft = '12px';
  eventCaption.style.marginTop = '10px';
}

function drawEventMarkers(activeEvent) {
  const ctx = eventCanvas.getContext('2d');
  const rows = eventGrid.length;
  const cols = eventGrid[0].length;

  EVENTS.forEach(ev => {
    if (ev.dataKey !== activeEventKey) return;
    const { x, y } = latLonToCanvasXY(ev.markerLat, ev.markerLon, eventCanvas, rows, cols);
    const isActive = ev.id === activeEvent.id;

    ctx.save();
    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, isActive ? 16 : 10, 0, Math.PI * 2);
    ctx.strokeStyle = ev.color;
    ctx.lineWidth = isActive ? 3 : 2;
    ctx.globalAlpha = isActive ? 0.6 : 0.4;
    ctx.stroke();

    // Inner dot
    ctx.beginPath();
    ctx.arc(x, y, isActive ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? '#fff' : ev.color;
    ctx.globalAlpha = 1;
    ctx.fill();
    ctx.strokeStyle = ev.color;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  });
}

eventCanvas.addEventListener('mousemove', (e) => {
  if (!eventGrid) return;
  const rect = eventCanvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (eventCanvas.width / rect.width);
  const py = (e.clientY - rect.top)  * (eventCanvas.height / rect.height);
  const val = canvasXYToGridVal(px, py, eventCanvas, eventGrid);
  const { lat, lon } = canvasXYToLatLon(px, py, eventCanvas, eventGrid.length, eventGrid[0].length);

  if (val === null || isNaN(val)) { eventTooltip.style.opacity = 0; return; }
  eventTooltip.style.opacity = 1;
  eventTooltip.style.left = (e.clientX - rect.left + 12) + 'px';
  eventTooltip.style.top  = (e.clientY - rect.top  + 12) + 'px';
  eventTooltip.innerHTML = `<strong>${val.toFixed(1)}&nbsp;°C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
});
eventCanvas.addEventListener('mouseleave', () => { eventTooltip.style.opacity = 0; });

// Auto-select first event
selectEvent(EVENTS[0]);

// ============================================================
// SECTION 3: SIDE-BY-SIDE COMPARISON
// ============================================================
const leftCanvas  = document.getElementById('map-left');
const rightCanvas = document.getElementById('map-right');
const leftSelect  = document.getElementById('left-select');
const rightSelect = document.getElementById('right-select');
const leftLabel   = document.getElementById('left-label');
const rightLabel  = document.getElementById('right-label');
const compareTooltip    = document.getElementById('compare-tooltip');
const cmpLeftPeriod     = document.getElementById('cmp-left-period');
const cmpRightPeriod    = document.getElementById('cmp-right-period');
const cmpLeftTemp       = document.getElementById('cmp-left-temp');
const cmpRightTemp      = document.getElementById('cmp-right-temp');
const cmpCoords         = document.getElementById('cmp-coords');
const crosshairLeft     = document.getElementById('crosshair-left');
const crosshairRight    = document.getElementById('crosshair-right');

let leftGrid  = null;
let rightGrid = null;

async function loadCompareMap(side, key) {
  const grid = await loadDataset(key);
  if (side === 'left') {
    leftGrid = grid;
    leftLabel.textContent = LABELS[key];
    drawGridToCanvas(leftCanvas, grid, (t) => tempToColor(t));
  } else {
    rightGrid = grid;
    rightLabel.textContent = LABELS[key];
    drawGridToCanvas(rightCanvas, grid, (t) => tempToColor(t));
  }
}

function syncedHover(e, sourceCanvas, sourceGrid, otherCanvas, otherGrid) {
  if (!sourceGrid || !otherGrid) return;
  const rect = sourceCanvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (sourceCanvas.width / rect.width);
  const py = (e.clientY - rect.top)  * (sourceCanvas.height / rect.height);

  // Fraction position (0-1)
  const fx = px / sourceCanvas.width;
  const fy = py / sourceCanvas.height;

  const leftVal  = canvasXYToGridVal(fx * leftCanvas.width,  fy * leftCanvas.height,  leftCanvas,  leftGrid);
  const rightVal = canvasXYToGridVal(fx * rightCanvas.width, fy * rightCanvas.height, rightCanvas, rightGrid);

  const rows = sourceGrid.length;
  const cols = sourceGrid[0].length;
  const { lat, lon } = canvasXYToLatLon(px, py, sourceCanvas, rows, cols);

  // Position crosshairs on both canvases
  const leftRect  = leftCanvas.getBoundingClientRect();
  const rightRect = rightCanvas.getBoundingClientRect();

  crosshairLeft.style.left = (fx * 100) + '%';
  crosshairLeft.style.top  = (fy * 100) + '%';
  crosshairLeft.classList.remove('hidden');

  crosshairRight.style.left = (fx * 100) + '%';
  crosshairRight.style.top  = (fy * 100) + '%';
  crosshairRight.classList.remove('hidden');

  // Shared tooltip
  cmpLeftPeriod.textContent  = leftLabel.textContent;
  cmpRightPeriod.textContent = rightLabel.textContent;
  cmpLeftTemp.textContent    = leftVal  !== null && !isNaN(leftVal)  ? leftVal.toFixed(1)  + ' °C' : 'No data';
  cmpRightTemp.textContent   = rightVal !== null && !isNaN(rightVal) ? rightVal.toFixed(1) + ' °C' : 'No data';
  cmpCoords.textContent      = `${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;

  // Show delta color hint
  if (leftVal !== null && rightVal !== null && !isNaN(leftVal) && !isNaN(rightVal)) {
    const delta = rightVal - leftVal;
    cmpRightTemp.style.color = delta > 0 ? '#ff4444' : delta < 0 ? '#4488ff' : '#ccc';
    cmpLeftTemp.style.color  = '#ccc';
  }

  compareTooltip.classList.remove('hidden');
}

function clearSyncedHover() {
  crosshairLeft.classList.add('hidden');
  crosshairRight.classList.add('hidden');
  compareTooltip.classList.add('hidden');
}

leftCanvas.addEventListener('mousemove',  (e) => syncedHover(e, leftCanvas,  leftGrid,  rightCanvas, rightGrid));
rightCanvas.addEventListener('mousemove', (e) => syncedHover(e, rightCanvas, rightGrid, leftCanvas,  leftGrid));
leftCanvas.addEventListener('mouseleave',  clearSyncedHover);
rightCanvas.addEventListener('mouseleave', clearSyncedHover);

leftSelect.addEventListener('change',  () => loadCompareMap('left',  leftSelect.value));
rightSelect.addEventListener('change', () => loadCompareMap('right', rightSelect.value));

// Initial load
loadCompareMap('left',  'jul2020');
loadCompareMap('right', 'jul2024');

// ============================================================
// SECTION 4: ANOMALY MAP
// ============================================================
const anomalyCanvas      = document.getElementById('anomaly-map');
const anomalyTooltip     = document.getElementById('anomaly-tooltip');
const anomalyBaseSelect  = document.getElementById('anomaly-base');
const anomalyCmpSelect   = document.getElementById('anomaly-compare');
const anomalyBtn         = document.getElementById('anomaly-btn');
const anomalyCaption     = document.getElementById('anomaly-caption');
const anomalyPlaceholder = document.getElementById('anomaly-placeholder');
let anomalyGrid = null;

function computeAnomaly(gridA, gridB) {
  // Returns gridA - gridB (compare minus base)
  return gridA.map((row, r) =>
    row.map((val, c) => {
      const base = gridB[r] && gridB[r][c];
      if (val === null || base === null || isNaN(val) || isNaN(base)) return null;
      return val - base;
    })
  );
}

anomalyBtn.addEventListener('click', async () => {
  const baseKey = anomalyBaseSelect.value;
  const cmpKey  = anomalyCmpSelect.value;

  if (baseKey === cmpKey) {
    anomalyCaption.textContent = 'Please select two different time periods.';
    return;
  }

  anomalyBtn.textContent = 'Loading…';
  anomalyBtn.disabled = true;

  const [baseGrid, cmpGrid] = await Promise.all([loadDataset(baseKey), loadDataset(cmpKey)]);
  anomalyGrid = computeAnomaly(cmpGrid, baseGrid);

  anomalyPlaceholder.style.display = 'none';
  drawGridToCanvas(anomalyCanvas, anomalyGrid, (d) => anomalyToColor(d));

  anomalyCaption.textContent = `Showing ${LABELS[cmpKey]} minus ${LABELS[baseKey]}. Red = warmer in ${LABELS[cmpKey]}, Blue = cooler.`;
  anomalyBtn.textContent = 'Show Anomaly';
  anomalyBtn.disabled = false;
});

anomalyCanvas.addEventListener('mousemove', (e) => {
  if (!anomalyGrid) return;
  const rect = anomalyCanvas.getBoundingClientRect();
  const px = (e.clientX - rect.left) * (anomalyCanvas.width / rect.width);
  const py = (e.clientY - rect.top)  * (anomalyCanvas.height / rect.height);
  const val = canvasXYToGridVal(px, py, anomalyCanvas, anomalyGrid);
  const { lat, lon } = canvasXYToLatLon(px, py, anomalyCanvas, anomalyGrid.length, anomalyGrid[0].length);

  if (val === null || isNaN(val)) { anomalyTooltip.style.opacity = 0; return; }
  anomalyTooltip.style.opacity = 1;
  anomalyTooltip.style.left = (e.clientX - rect.left + 12) + 'px';
  anomalyTooltip.style.top  = (e.clientY - rect.top  + 12) + 'px';
  const sign = val >= 0 ? '+' : '';
  anomalyTooltip.innerHTML = `<strong>${sign}${val.toFixed(1)}&nbsp;°C</strong><br>${lat.toFixed(1)}°, ${lon.toFixed(1)}°`;
});
anomalyCanvas.addEventListener('mouseleave', () => { anomalyTooltip.style.opacity = 0; });