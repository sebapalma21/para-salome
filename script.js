// ===== Config =====
const DEFAULT_IMAGE = "imagen.jpg"; // <- cambia esto si quieres otro nombre por defecto
const SHUFFLE_STEPS = 140;

// ===== DOM =====
const container = document.getElementById("puzzle-container");
const message = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const fileInput = document.getElementById("fileInput");
const sizeSelect = document.getElementById("sizeSelect");

// ===== State =====
let size = parseInt(sizeSelect.value, 10);  // N x N
let tiles = [];                             // board values 0..(N*N-1), last is empty
let emptyVal = () => size * size - 1;
let imageUrl = DEFAULT_IMAGE;
let locked = false;

// We set these from container size
let boardPx = 300;
let tilePx = 100;

// ===== Helpers =====
function idxToRC(index) {
  return { r: Math.floor(index / size), c: index % size };
}

function rcToIdx(r, c) {
  return r * size + c;
}

function inBounds(r, c) {
  return r >= 0 && r < size && c >= 0 && c < size;
}

function isSolved() {
  return tiles.every((v, i) => v === i);
}

function computeSizes() {
  // Use actual rendered size
  const rect = container.getBoundingClientRect();
  boardPx = Math.round(rect.width);
  tilePx = boardPx / size;
}

function hideWin() {
  message.style.display = "none";
}

function showWin() {
  message.style.display = "block";
}

// ===== Rendering =====
function render() {
  computeSizes();
  container.innerHTML = "";

  // Set smooth background scaling based on the board size
  const bgSize = `${boardPx}px ${boardPx}px`;

  tiles.forEach((tileVal, posIdx) => {
    if (tileVal === emptyVal()) return;

    const { r, c } = idxToRC(posIdx);
    const div = document.createElement("div");
    div.className = "tile";

    // Tile dimensions: perfect fit
    div.style.width = `${tilePx}px`;
    div.style.height = `${tilePx}px`;

    // Place tile
    div.style.left = `${c * tilePx}px`;
    div.style.top = `${r * tilePx}px`;

    // Image
    const { r: imgR, c: imgC } = idxToRC(tileVal);
    div.style.backgroundImage = `url("${imageUrl}")`;
    div.style.backgroundSize = bgSize;
    div.style.backgroundPosition = `${-imgC * tilePx}px ${-imgR * tilePx}px`;

    // Interaction
    div.addEventListener("click", () => tryMove(posIdx));

    // Basic swipe support (optional) - works like "tap" unless you swipe toward the empty line
    div.addEventListener("touchstart", (e) => touchStart(e, posIdx), { passive: false });
    div.addEventListener("touchend", (e) => touchEnd(e, posIdx));

    container.appendChild(div);
  });
}

// ===== Movement (slide whole line toward empty if aligned) =====
function getLineMovePath(fromIdx, emptyIdx) {
  const a = idxToRC(fromIdx);
  const b = idxToRC(emptyIdx);

  // Same row -> horizontal shift
  if (a.r === b.r) {
    const path = [];
    const step = a.c < b.c ? 1 : -1;
    for (let c = b.c; c !== a.c; c -= step) {
      // path contains indices to swap with previous toward fromIdx
      path.push(rcToIdx(a.r, c));
    }
    // path like [empty, ..., next to from] — we will shift tiles along it
    return path;
  }

  // Same col -> vertical shift
  if (a.c === b.c) {
    const path = [];
    const step = a.r < b.r ? 1 : -1;
    for (let r = b.r; r !== a.r; r -= step) {
      path.push(rcToIdx(r, a.c));
    }
    return path;
  }

  return null;
}

function tryMove(fromIdx) {
  if (locked) return;

  const emptyIdx = tiles.indexOf(emptyVal());
  const path = getLineMovePath(fromIdx, emptyIdx);
  if (!path) return;

  // Shift tiles toward empty
  // Example path starts with empty index, then positions toward the clicked tile.
  // We rotate values along the line so empty moves to fromIdx.
  const emptyIndexInPath = 0;

  // Build full list of positions from empty to fromIdx
  const positions = [emptyIdx, ...path.slice(1), fromIdx].filter((v, i, arr) => arr.indexOf(v) === i);

  // Actually: easier approach: repeatedly swap empty with the next position toward fromIdx.
  // Determine direction by comparing row/col
  const e = idxToRC(emptyIdx);
  const f = idxToRC(fromIdx);

  const dr = Math.sign(f.r - e.r);
  const dc = Math.sign(f.c - e.c);

  let currentEmpty = emptyIdx;
  while (currentEmpty !== fromIdx) {
    const { r, c } = idxToRC(currentEmpty);
    const nextR = r + dr;
    const nextC = c + dc;
    const nextIdx = rcToIdx(nextR, nextC);
    swap(currentEmpty, nextIdx);
    currentEmpty = nextIdx;
  }

  render();
  if (isSolved()) setTimeout(showWin, 180);
}

function swap(i, j) {
  const t = tiles[i];
  tiles[i] = tiles[j];
  tiles[j] = t;
}

// ===== Shuffle (by doing valid random moves, always solvable) =====
function getNeighborsOfEmpty(emptyIdx) {
  const { r, c } = idxToRC(emptyIdx);
  const neighbors = [];

  // For nicer shuffles: allow moving ANY tile in same row/col, not just adjacent.
  // We'll pick a random tile aligned with empty.
  for (let cc = 0; cc < size; cc++) {
    if (cc !== c) neighbors.push(rcToIdx(r, cc));
  }
  for (let rr = 0; rr < size; rr++) {
    if (rr !== r) neighbors.push(rcToIdx(rr, c));
  }

  return neighbors;
}

function shufflePuzzle() {
  hideWin();
  locked = true;

  let steps = 0;
  const tick = () => {
    const emptyIdx = tiles.indexOf(emptyVal());
    const candidates = getNeighborsOfEmpty(emptyIdx);
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    tryMove(pick);

    steps++;
    if (steps < SHUFFLE_STEPS) {
      requestAnimationFrame(tick);
    } else {
      // If it accidentally ends solved, shuffle a bit more
      if (isSolved()) {
        steps = 0;
        requestAnimationFrame(tick);
        return;
      }
      locked = false;
    }
  };

  requestAnimationFrame(tick);
}

// ===== Touch (swipe toward empty) =====
let startX = null, startY = null;

function touchStart(e, idx) {
  if (locked) return;
  startX = e.touches[0].clientX;
  startY = e.touches[0].clientY;
}

function touchEnd(e, idx) {
  if (startX == null || startY == null) return;

  const endX = e.changedTouches[0].clientX;
  const endY = e.changedTouches[0].clientY;
  const dx = endX - startX;
  const dy = endY - startY;

  // treat as tap if small
  if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
    tryMove(idx);
    startX = startY = null;
    return;
  }

  const emptyIdx = tiles.indexOf(emptyVal());
  const a = idxToRC(idx);
  const b = idxToRC(emptyIdx);

  // if aligned, only allow swipe direction that goes toward the empty
  if (a.r === b.r) {
    if (dx > 0 && a.c < b.c) tryMove(idx);
    if (dx < 0 && a.c > b.c) tryMove(idx);
  } else if (a.c === b.c) {
    if (dy > 0 && a.r < b.r) tryMove(idx);
    if (dy < 0 && a.r > b.r) tryMove(idx);
  }

  startX = startY = null;
}

// ===== Image loading =====
function setImageFromFile(file) {
  const url = URL.createObjectURL(file);
  imageUrl = url;
  hideWin();
  render();
  shufflePuzzle();
}

// ===== Init =====
function init() {
  // create solved board
  tiles = Array.from({ length: size * size }, (_, i) => i);
  hideWin();
  render();
  setTimeout(shufflePuzzle, 250);
}

// Events
shuffleBtn.addEventListener("click", shufflePuzzle);

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) setImageFromFile(file);
});

sizeSelect.addEventListener("change", () => {
  size = parseInt(sizeSelect.value, 10);
  init();
});

// handle resize so it stays crisp
window.addEventListener("resize", () => render());

init();
