const GRID_COLS = 3;
const GRID_ROWS = 4;
const TOTAL_TILES = GRID_COLS * GRID_ROWS;
const PUZZLE_IMAGE = "valentines.png";
const YES_LINK = "https://example.com";

const stageEl = document.getElementById("puzzleStage");
const boardEl = document.getElementById("puzzle");
const piecesLayerEl = document.getElementById("piecesLayer");
const shuffleBtn = document.getElementById("shuffleBtn");
const modal = document.getElementById("resultModal");
const yesBtn = document.getElementById("yesBtn");
const noBtn = document.getElementById("noBtn");
const heartLayer = document.getElementById("heartLayer");

let slotToPiece = Array(TOTAL_TILES).fill(null);
let floatingPieces = [];
let piecePositions = new Map();
let selectedPiece = null;
let solvedTriggered = false;
let cachedPieceSize = null;

function shuffleArray(input) {
  const array = [...input];
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function isSolved() {
  return slotToPiece.every((piece, slotIndex) => piece === slotIndex);
}

function createPieceTile(pieceIndex) {
  const piece = document.createElement("button");
  piece.type = "button";
  piece.className = "piece";
  piece.dataset.pieceIndex = String(pieceIndex);
  piece.style.backgroundImage = `url(${PUZZLE_IMAGE})`;
  piece.style.backgroundSize = `${GRID_COLS * 100}% ${GRID_ROWS * 100}%`;

  const row = Math.floor(pieceIndex / GRID_COLS);
  const col = pieceIndex % GRID_COLS;
  piece.style.backgroundPosition = `${(col / (GRID_COLS - 1)) * 100}% ${(row / (GRID_ROWS - 1)) * 100}%`;

  piece.draggable = true;
  piece.addEventListener("dragstart", (event) => {
    event.dataTransfer.setData("text/plain", String(pieceIndex));
    event.dataTransfer.effectAllowed = "move";
  });

  piece.addEventListener("click", () => onPieceSelect(pieceIndex));

  if (selectedPiece === pieceIndex) {
    piece.classList.add("selected");
  }

  return piece;
}

function renderBoard() {
  boardEl.innerHTML = "";

  slotToPiece.forEach((pieceIndex, slotIndex) => {
    const slot = document.createElement("div");
    slot.className = "slot";
    slot.dataset.slotIndex = String(slotIndex);
    slot.setAttribute("role", "gridcell");
    slot.setAttribute("aria-label", `Board slot ${slotIndex + 1}`);

    slot.addEventListener("dragover", (event) => {
      event.preventDefault();
      slot.classList.add("drop-target");
    });

    slot.addEventListener("dragleave", () => {
      slot.classList.remove("drop-target");
    });

    slot.addEventListener("drop", (event) => {
      event.preventDefault();
      slot.classList.remove("drop-target");
      if (solvedTriggered) {
        return;
      }
      const droppedPiece = Number(event.dataTransfer.getData("text/plain"));
      placePieceInSlot(droppedPiece, slotIndex);
    });

    slot.addEventListener("click", () => {
      if (selectedPiece === null || solvedTriggered) {
        return;
      }
      placePieceInSlot(selectedPiece, slotIndex);
    });

    if (pieceIndex !== null) {
      const pieceEl = createPieceTile(pieceIndex);
      pieceEl.style.position = "static";
      slot.appendChild(pieceEl);
      slot.addEventListener("dblclick", () => returnPieceToScatter(slotIndex));
    }

    boardEl.appendChild(slot);
  });
}

function renderFloatingPieces() {
  piecesLayerEl.innerHTML = "";

  floatingPieces.forEach((pieceIndex) => {
    const pieceEl = createPieceTile(pieceIndex);
    pieceEl.classList.add("floating");
    const position = piecePositions.get(pieceIndex);
    if (position) {
      pieceEl.style.left = `${position.x}px`;
      pieceEl.style.top = `${position.y}px`;
      pieceEl.style.setProperty("--rot", `${position.rot}deg`);
    }
    piecesLayerEl.appendChild(pieceEl);
  });
}

function renderPuzzle() {
  renderBoard();
  renderFloatingPieces();
}

function removePieceFromEverywhere(pieceIndex) {
  const floatingPos = floatingPieces.indexOf(pieceIndex);
  if (floatingPos > -1) {
    floatingPieces.splice(floatingPos, 1);
  }

  const slotPos = slotToPiece.indexOf(pieceIndex);
  if (slotPos > -1) {
    slotToPiece[slotPos] = null;
  }
}

function getBoardBoundsWithinStage() {
  const stageRect = stageEl.getBoundingClientRect();
  const boardRect = boardEl.getBoundingClientRect();

  return {
    left: boardRect.left - stageRect.left,
    top: boardRect.top - stageRect.top,
    right: boardRect.right - stageRect.left,
    bottom: boardRect.bottom - stageRect.top,
  };
}

function getPieceDimensions() {
  if (cachedPieceSize) {
    return cachedPieceSize;
  }

  const probe = createPieceTile(0);
  probe.style.visibility = "hidden";
  probe.style.left = "0";
  probe.style.top = "0";
  piecesLayerEl.appendChild(probe);
  const rect = probe.getBoundingClientRect();
  probe.remove();
  cachedPieceSize = { width: rect.width, height: rect.height };
  return cachedPieceSize;
}

function randomScatterPosition() {
  const stageRect = stageEl.getBoundingClientRect();
  const boardBounds = getBoardBoundsWithinStage();
  const pieceSize = getPieceDimensions();

  const margin = 10;
  const edgeGap = 12;
  const maxX = Math.max(margin, stageRect.width - pieceSize.width - margin);
  const maxY = Math.max(margin, stageRect.height - pieceSize.height - margin);

  const edgeBands = [
    {
      side: "top",
      xMin: margin,
      xMax: maxX,
      yMin: margin,
      yMax: Math.max(margin, boardBounds.top - pieceSize.height - edgeGap),
    },
    {
      side: "bottom",
      xMin: margin,
      xMax: maxX,
      yMin: Math.min(maxY, boardBounds.bottom + edgeGap),
      yMax: maxY,
    },
    {
      side: "left",
      xMin: margin,
      xMax: Math.max(margin, boardBounds.left - pieceSize.width - edgeGap),
      yMin: margin,
      yMax: maxY,
    },
    {
      side: "right",
      xMin: Math.min(maxX, boardBounds.right + edgeGap),
      xMax: maxX,
      yMin: margin,
      yMax: maxY,
    },
  ].filter((band) => band.xMax >= band.xMin && band.yMax >= band.yMin);

  const placedRects = Array.from(piecePositions.values());

  for (let i = 0; i < 140; i += 1) {
    const band = edgeBands[Math.floor(Math.random() * edgeBands.length)];
    if (!band) {
      break;
    }

    const x = band.xMin + Math.random() * Math.max(1, band.xMax - band.xMin);
    const y = band.yMin + Math.random() * Math.max(1, band.yMax - band.yMin);
    const overlaps = placedRects.some((placed) => {
      const tooFarX = x + pieceSize.width + 6 < placed.x || x > placed.x + pieceSize.width + 6;
      const tooFarY = y + pieceSize.height + 6 < placed.y || y > placed.y + pieceSize.height + 6;
      return !(tooFarX || tooFarY);
    });

    if (!overlaps) {
      return { x, y, rot: -16 + Math.random() * 32 };
    }
  }

  return {
    x: margin + Math.random() * Math.max(1, maxX - margin),
    y: margin + Math.random() * Math.max(1, maxY - margin),
    rot: -14 + Math.random() * 28,
  };
}

function pushPieceToScatter(pieceIndex) {
  floatingPieces.push(pieceIndex);
  piecePositions.set(pieceIndex, randomScatterPosition());
}

function placePieceInSlot(pieceIndex, slotIndex) {
  if (!Number.isInteger(pieceIndex) || pieceIndex < 0 || pieceIndex >= TOTAL_TILES) {
    return;
  }

  const currentPieceInSlot = slotToPiece[slotIndex];
  removePieceFromEverywhere(pieceIndex);

  if (currentPieceInSlot !== null) {
    pushPieceToScatter(currentPieceInSlot);
  }

  slotToPiece[slotIndex] = pieceIndex;
  selectedPiece = null;
  renderPuzzle();

  if (isSolved()) {
    onSolved();
  }
}

function returnPieceToScatter(slotIndex) {
  const piece = slotToPiece[slotIndex];
  if (piece === null || solvedTriggered) {
    return;
  }

  slotToPiece[slotIndex] = null;
  pushPieceToScatter(piece);
  renderPuzzle();
}

function onPieceSelect(pieceIndex) {
  if (solvedTriggered) {
    return;
  }

  selectedPiece = selectedPiece === pieceIndex ? null : pieceIndex;
  renderPuzzle();
}

function spawnHearts() {
  const count = 60;

  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement("span");
    heart.className = "heart";
    heart.textContent = Math.random() > 0.3 ? "💖" : "💘";
    heart.style.left = `${Math.random() * 100}vw`;
    heart.style.opacity = (0.5 + Math.random() * 0.5).toFixed(2);
    heart.style.animationDuration = `${3.2 + Math.random() * 2.8}s`;
    heart.style.animationDelay = `${Math.random() * 1.2}s`;

    heartLayer.appendChild(heart);
    heart.addEventListener("animationend", () => heart.remove());
  }
}

function onSolved() {
  solvedTriggered = true;
  spawnHearts();
  modal.classList.remove("hidden");
  modal.setAttribute("aria-hidden", "false");
}

function moveNoButton() {
  const btnRect = noBtn.getBoundingClientRect();

  const maxX = window.innerWidth - btnRect.width - 8;
  const maxY = window.innerHeight - btnRect.height - 8;

  const x = Math.max(0, Math.random() * maxX);
  const y = Math.max(0, Math.random() * maxY);

  noBtn.style.position = "fixed";
  noBtn.style.left = `${x}px`;
  noBtn.style.top = `${y}px`;
}

function setupNoButtonEscape() {
  noBtn.addEventListener("mouseenter", moveNoButton);
  noBtn.addEventListener("click", (event) => {
    event.preventDefault();
    moveNoButton();
  });
  noBtn.addEventListener("touchstart", (event) => {
    event.preventDefault();
    moveNoButton();
  });
}

function setupYesButton() {
  yesBtn.addEventListener("click", () => {
    window.open(YES_LINK, "_blank", "noopener,noreferrer");
  });
}

function shufflePuzzle() {
  selectedPiece = null;
  solvedTriggered = false;
  slotToPiece = Array(TOTAL_TILES).fill(null);
  floatingPieces = [];
  piecePositions = new Map();
  cachedPieceSize = null;

  modal.classList.add("hidden");
  modal.setAttribute("aria-hidden", "true");
  noBtn.style.position = "absolute";
  noBtn.style.left = "60%";
  noBtn.style.top = "0";

  const randomPieces = shuffleArray([...Array(TOTAL_TILES).keys()]);
  renderBoard();
  randomPieces.forEach((pieceIndex) => pushPieceToScatter(pieceIndex));
  renderPuzzle();
}

shuffleBtn.addEventListener("click", shufflePuzzle);
window.addEventListener("resize", () => {
  if (floatingPieces.length === 0) {
    return;
  }

  cachedPieceSize = null;
  piecePositions = new Map();
  floatingPieces.forEach((pieceIndex) => {
    piecePositions.set(pieceIndex, randomScatterPosition());
  });
  renderPuzzle();
});

setupNoButtonEscape();
setupYesButton();
shufflePuzzle();
