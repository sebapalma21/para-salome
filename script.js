// ===== Config =====
const DEFAULT_IMAGE = "imagen.jpg";
const DRAG_SNAP_THRESHOLD = 0.55; // qué tan cerca para “pegarse” (0..1)

// ===== DOM =====
const container = document.getElementById("puzzle-container");
const message = document.getElementById("message");
const shuffleBtn = document.getElementById("shuffleBtn");
const fileInput = document.getElementById("fileInput");
const sizeSelect = document.getElementById("sizeSelect");

// ===== State =====
let size = parseInt(sizeSelect.value, 10);     // 3 => 3x3
let imageUrl = DEFAULT_IMAGE;

let boardPx = 300;
let tilePx = 100;

// tile id (0..N*N-1) -> cell index (0..N*N-1)
let tileToCell = new Map();
// cell index -> tile id
let cellToTile = new Map();

// dragging
let drag = null;

// ===== Helpers =====
function idxToRC(index) {
  return { r: Math.floor(index / size), c: index % size };
}
function rcToIdx(r, c) {
  return r * size + c;
}
function computeSizes() {
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
function isSolved() {
  for (let tile = 0; tile < size * size; tile++) {
    if (tileToCell.get(tile) !== tile) return false;
  }
  return true;
}

// ===== Init board mapping =====
function initSolved() {
  tileToCell.clear();
  cellToTile.clear();
  for (let i = 0; i < size * size; i++) {
    tileToCell.set(i, i);
    cellToTile.set(i, i);
  }
}

function shuffle() {
  hideWin();
  // Fisher–Yates sobre las celdas, asignando tiles a cells
  const cells = Array.from({ length: size * size }, (_, i) => i);
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cells[i], cells[j]] = [cells[j], cells[i]];
  }

  tileToCell.clear();
  cellToTile.clear();
  for (let tile = 0; tile < size * size; tile++) {
    const cell = cells[tile];
    tileToCell.set(tile, cell);
    cellToTile.set(cell, tile);
  }

  // evita que quede resuelto al tiro
  if (isSolved()) shuffle();

  render();
}

// ===== Rendering =====
function render() {
  computeSizes();
  container.innerHTML = "";

  const bgSize = `${boardPx}px ${boardPx}px`;

  for (let tileId = 0; tileId < size * size; tileId++) {
    const cellIdx = tileToCell.get(tileId);
    const { r, c } = idxToRC(cellIdx);

    const el = document.createElement("div");
    el.className = "tile";
    el.dataset.tileId = String(tileId);

    el.style.width = `${tilePx}px`;
    el.style.height = `${tilePx}px`;
    el.style.left = `${c * tilePx}px`;
    el.style.top = `${r * tilePx}px`;

    // slice de imagen según tileId (NO según cell)
    const { r: imgR, c: imgC } = idxToRC(tileId);
    el.style.backgroundImage = `url("${imageUrl}")`;
    el.style.backgroundSize = bgSize;
    el.style.backgroundPosition = `${-imgC * tilePx}px ${-imgR * tilePx}px`;

    el.addEventListener("pointerdown", onPointerDown);

    container.appendChild(el);
  }
}

// ===== Drag & Drop =====
function onPointerDown(e) {
  const el = e.currentTarget;
  const tileId = parseInt(el.dataset.tileId, 10);

  el.setPointerCapture(e.pointerId);

  const startLeft = parseFloat(el.style.left);
  const startTop = parseFloat(el.style.top);

  drag = {
    pointerId: e.pointerId,
    el,
    tileId,
    startX: e.clientX,
    startY: e.clientY,
    startLeft,
    startTop
  };

  el.style.zIndex = "10";
  el.style.transition = "none";

  el.addEventListener("pointermove", onPointerMove);
  el.addEventListener("pointerup", onPointerUp);
  el.addEventListener("pointercancel", onPointerUp);
}

function onPointerMove(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;

  const dx = e.clientX - drag.startX;
  const dy = e.clientY - drag.startY;

  // mover libre
  drag.el.style.left = `${drag.startLeft + dx}px`;
  drag.el.style.top = `${drag.startTop + dy}px`;
}

function nearestCellFromElement(el) {
  const left = parseFloat(el.style.left);
  const top = parseFloat(el.style.top);

  // centro de la pieza
  const cx = left + tilePx / 2;
  const cy = top + tilePx / 2;

  let c = Math.floor(cx / tilePx);
  let r = Math.floor(cy / tilePx);

  // clamp
  c = Math.max(0, Math.min(size - 1, c));
  r = Math.max(0, Math.min(size - 1, r));

  return rcToIdx(r, c);
}

function snapToCell(el, cellIdx) {
  const { r, c } = idxToRC(cellIdx);
  el.style.left = `${c * tilePx}px`;
  el.style.top = `${r * tilePx}px`;
}

function onPointerUp(e) {
  if (!drag || e.pointerId !== drag.pointerId) return;

  const { el, tileId } = drag;

  el.removeEventListener("pointermove", onPointerMove);
  el.removeEventListener("pointerup", onPointerUp);
  el.removeEventListener("pointercancel", onPointerUp);

  el.style.zIndex = "";
  el.style.transition = "left 160ms ease, top 160ms ease";

  // decidir celda destino
  const targetCell = nearestCellFromElement(el);

  // chequeo de “cercanía” (para que no se pegue raro si sueltas lejos)
  const { r: tr, c: tc } = idxToRC(targetCell);
  const targetLeft = tc * tilePx;
  const targetTop = tr * tilePx;

  const curLeft = parseFloat(el.style.left);
  const curTop = parseFloat(el.style.top);

  const dist = Math.hypot(curLeft - targetLeft, curTop - targetTop);
  const maxDist = tilePx * DRAG_SNAP_THRESHOLD;

  // si está muy lejos, vuelve a su celda original
  if (dist > maxDist) {
    const originalCell = tileToCell.get(tileId);
    snapToCell(el, originalCell);
    drag = null;
    return;
  }

  // si la celda está ocupada, swap
  const otherTile = cellToTile.get(targetCell);
  const fromCell = tileToCell.get(tileId);

  if (otherTile !== undefined && otherTile !== tileId) {
    // swap mappings
    tileToCell.set(tileId, targetCell);
    tileToCell.set(otherTile, fromCell);

    cellToTile.set(targetCell, tileId);
    cellToTile.set(fromCell, otherTile);

    // mover visualmente las dos piezas
    snapToCell(el, targetCell);

    // encontrar el elemento del otro tile y moverlo
    const otherEl = container.querySelector(`.tile[data-tile-id="${otherTile}"]`);
    if (otherEl) snapToCell(otherEl, fromCell);
  } else {
    // celda “libre” (en teoría no pasa, pero por seguridad)
    tileToCell.set(tileId, targetCell);
    cellToTile.set(targetCell, tileId);
    snapToCell(el, targetCell);
  }

  if (isSolved()) setTimeout(showWin, 180);

  drag = null;
}

// ===== Image loading =====
function setImageFromFile(file) {
  const url = URL.createObjectURL(file);
  imageUrl = url;
  hideWin();
  render();
  shuffle();
}

// ===== Init =====
function init() {
  initSolved();
  hideWin();
  render();
  setTimeout(shuffle, 200);
}

// Events
shuffleBtn.addEventListener("click", shuffle);

fileInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (file) setImageFromFile(file);
});

sizeSelect.addEventListener("change", () => {
  size = parseInt(sizeSelect.value, 10);
  init();
});

window.addEventListener("resize", () => render());

init();
