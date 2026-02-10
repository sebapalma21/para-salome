// ===== Config =====
const DEFAULT_IMAGE = "imagen.jpg";
const SHUFFLE_STEPS = 140;

// ===== DOM =====
const container = document.getElementById("puzzle-container");
const message = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const fileInput = document.getElementById("fileInput");
const sizeSelect = document.getElementById("sizeSelect");

// ===== State =====
let size = parseInt(sizeSelect.value, 10);
let tiles = []; // values 0..N*N-1, last is empty
let imageUrl = DEFAULT_IMAGE;
let locked = false;

// board sizing
let boardPx = 300;
let tilePx = 100;

function emptyVal() { return size * size - 1; }
function idxToRC(i) { return { r: Math.floor(i / size), c: i % size }; }
function rcToIdx(r, c) { return r * size + c; }
function isSolved() { return tiles.every((v, i) => v === i); }

function computeSizes() {
  const rect = container.getBoundingClientRect();
  boardPx = Math.round(rect.width);
  tilePx = boardPx / size;
}

function hideWin() { message.style.display = "none"; }
function showWin() { message.style.display = "block"; }

// ===== Rendering =====
function render() {
  computeSizes();
  container.innerHTML = "";
  const bgSize = `${boardPx}px ${boardPx}px`;

  tiles.forEach((tileVal, posIdx) => {
    if (tileVal === emptyVal()) return;

    const { r, c } = idxToRC(posIdx);
    const div = document.createElement("div");
    div.className = "tile";
    div.dataset.posIdx = String(posIdx);

    div.style.width = `${tilePx}px`;
    div.style.height = `${tilePx}px`;
    div.style.left = `${c * tilePx}px`;
    div.style.top = `${r * tilePx}px`;

    // Image slice
    const { r: imgR, c: imgC } = idxToRC(tileVal);
    div.style.backgroundImage = `url("${imageUrl}")`;
    div.style.backgroundSize = bgSize;
    div.style.backgroundPosition = `${-imgC * tilePx}px ${-imgR * tilePx}px`;

    // Drag handlers
    div.addEventListener("pointerdown", onPointerDown);

    container.appendChild(div);
  });
}

// ===== Line move (shift until empty reaches fromIdx) =====
function slideLine(fromIdx) {
  const emptyIdx = tiles.indexOf(emptyVal());
  const a = idxToRC(fromIdx);
  const b = idxToRC(emptyIdx);

  if (a.r !== b.r && a.c !== b.c) return false; // not aligned

  const dr = Math.sign(a.r - b.r);
  const dc = Math.sign(a.c - b.c);

  let curEmpty = emptyIdx;
  while (curEmpty !== fromIdx) {
    const { r, c } = idxToRC(curEmpty);
    const nextIdx = rcToIdx(r + dr, c + dc);
    swap(curEmpty, nextIdx);
    curEmpty = nextIdx;
  }
  return true;
}

function swap(i, j) {
  const t = tiles[i];
  tiles[i] = tiles[j];
  tiles[j] = t;
}

// ===== Shuffle (valid moves -> always solvable) =====
function getAlignedCandidates(emptyIdx) {
  const { r, c } = idxToRC(emptyIdx);
  const out = [];
  for (let cc = 0; cc < size; cc++) if (cc !== c) out.push(rcToIdx(r, cc));
  for (let rr = 0; rr < size; rr++) if (rr !== r) out.push(rcToIdx(rr, c));
  return out;
}

function shufflePuzzle() {
  hideWin();
  locked = true;

  let steps = 0;
  const tick = () => {
    const emptyIdx = tiles.indexOf(emptyVal());
    const cand = getAlignedCandidates(emptyIdx);
    const pick = cand[Math.floor(Math.random() * cand.length)];
    slideLine(pick);
    render();

    steps++;
    if (steps < SHUFFLE_STEPS) {
      requestAnimationFrame(tick);
    } else {
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

// ===== Drag logic (Pointer Events) =====
let drag = null;

function onPointerDown(e) {
  if (locked) return;

  const tileEl = e.currentTarget;
  const fromIdx = parseInt(tileEl.dataset.posIdx, 10);
  const emptyIdx = tiles.indexOf(emptyVal());

  const a = idxToRC(fromIdx);
  const b = idxToRC(emptyIdx);

  // must be aligned to drag toward empty
  const alignedRow = a.r === b.r;
  const alignedCol = a.c === b.c;
  if (!alignedRow && !alignedCol) return;

  // Direction allowed: only toward the empty
  // axis: 'x' or 'y', sign: +1 or -1 in pixel direction
  let axis, sign;
  if (alignedRow) {
    axis = "x";
    sign = (b.c > a.c) ? +1 : -1; // empty is right => drag right
  } else {
    axis = "y";
    sign = (b.r > a.r) ? +1 : -1; // empty is down => drag down
  }

  tileEl.setPointerCapture(e.pointerId);

  drag = {
    pointerId: e.pointerId,
    tileEl,
    fromIdx,
    axis,
    sign,
    startX: e
