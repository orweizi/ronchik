const ROWS = 5;
const COLS = 8;
const TOTAL_PIECES = ROWS * COLS;
const STORAGE_KEY = "ronverse-puzzle-leaderboard";
const MAX_LEADERS = 5;
const IMAGE_SRC = "./PHOTO-2025-07-26-16-27-12.jpg";

const board = document.querySelector("[data-board]");
const pieceBank = document.querySelector("[data-piece-bank]");
const timerEl = document.querySelector("[data-timer]");
const movesEl = document.querySelector("[data-moves]");
const bestEl = document.querySelector("[data-best]");
const statusEl = document.querySelector("[data-status]");
const startButton = document.querySelector('[data-action="start"]');
const resetButton = document.querySelector('[data-action="reset"]');
const playerInput = document.querySelector("[data-player-name]");
const leaderboardList = document.querySelector("[data-leaderboard]");
const yearEl = document.querySelector("[data-year]");

let activePieceId = null;
let movesCount = 0;
let startTimestamp = 0;
let elapsedSeconds = 0;
let timerIntervalId = null;
let isTimerRunning = false;
let gameActive = false;
let puzzleSolved = false;

let leaderboard = loadLeaderboard();

const pieceTemplate = [];
for (let row = 0; row < ROWS; row += 1) {
  for (let col = 0; col < COLS; col += 1) {
    pieceTemplate.push({
      id: `${row}-${col}`,
      row,
      col,
    });
  }
}

init();

function init() {
  if (!board || !pieceBank) return;
  board.style.setProperty("--rows", ROWS.toString());
  board.style.setProperty("--cols", COLS.toString());
  pieceBank.style.setProperty("--rows", ROWS.toString());
  pieceBank.style.setProperty("--cols", COLS.toString());

  attachGlobalEvents();
  prepareStandbyBoard();
  renderLeaderboard();
  updateBestDisplay();
  stampYear();
}

function attachGlobalEvents() {
  if (startButton) {
    startButton.addEventListener("click", () => {
      startNewRun();
    });
  }

  if (resetButton) {
    resetButton.addEventListener("click", () => {
      prepareStandbyBoard();
      setStatus("Board reset. Hit “Start New Run” when ready.");
    });
    resetButton.disabled = true;
  }

  pieceBank.addEventListener("dragover", (event) => {
    if (!gameActive || puzzleSolved) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  });

  pieceBank.addEventListener("dragenter", (event) => {
    if (!gameActive || puzzleSolved) return;
    event.preventDefault();
    pieceBank.classList.add("is-hovered");
  });

  pieceBank.addEventListener("dragleave", () => {
    pieceBank.classList.remove("is-hovered");
  });

  pieceBank.addEventListener("drop", (event) => {
    if (!gameActive || puzzleSolved) return;
    event.preventDefault();
    pieceBank.classList.remove("is-hovered");
    const pieceId = event.dataTransfer.getData("text/plain") || activePieceId;
    if (!pieceId) return;
    const piece = document.querySelector(`[data-piece-id="${pieceId}"]`);
    if (!piece) return;
    const originZone = piece.parentElement?.classList.contains("drop-zone")
      ? piece.parentElement
      : null;
    pieceBank.appendChild(piece);
    piece.removeAttribute("data-placed-row");
    piece.removeAttribute("data-placed-col");
    piece.classList.remove("is-dragging");
    if (originZone) {
      originZone.classList.remove("has-piece", "is-correct", "is-hovered");
    }
    updateBankState();
  });
}

function prepareStandbyBoard() {
  gameActive = false;
  puzzleSolved = false;
  stopTimer();
  movesCount = 0;
  updateMovesDisplay();
  updateTimerDisplay(0);
  startButton.disabled = false;
  resetButton.disabled = true;
  buildBoard();
  populatePieceBank({ enableDrag: false });
  setStatus("Awaiting deployment. Hit “Start New Run” to scramble the pieces.");
}

function startNewRun() {
  gameActive = true;
  puzzleSolved = false;
  movesCount = 0;
  updateMovesDisplay();
  stopTimer();
  updateTimerDisplay(0);
  startButton.disabled = true;
  resetButton.disabled = false;
  buildBoard();
  populatePieceBank({ enableDrag: true, scramble: true });
  setStatus("Mission live. Timer starts on your first correct placement.");
}

function buildBoard() {
  board.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const zone = document.createElement("div");
      zone.className = "drop-zone";
      zone.dataset.row = row.toString();
      zone.dataset.col = col.toString();
      zone.setAttribute("role", "gridcell");
      zone.setAttribute("aria-label", `Row ${row + 1}, column ${col + 1}`);
      zone.addEventListener("dragover", handleZoneDragOver);
      zone.addEventListener("dragenter", handleZoneDragEnter);
      zone.addEventListener("dragleave", handleZoneDragLeave);
      zone.addEventListener("drop", handleZoneDrop);
      fragment.appendChild(zone);
    }
  }
  board.appendChild(fragment);
}

function populatePieceBank({ enableDrag, scramble = false }) {
  pieceBank.innerHTML = "";
  pieceBank.classList.remove("empty");

  const pieces = scramble ? shuffleArray([...pieceTemplate]) : [...pieceTemplate];

  const fragment = document.createDocumentFragment();
  pieces.forEach(({ id, row, col }) => {
    const piece = document.createElement("div");
    piece.className = "puzzle-piece";
    piece.dataset.pieceId = id;
    piece.dataset.row = row.toString();
    piece.dataset.col = col.toString();
    piece.tabIndex = enableDrag ? 0 : -1;
    piece.draggable = enableDrag;
    piece.style.backgroundImage = `url("${IMAGE_SRC}")`;
    piece.style.setProperty("--rows", ROWS.toString());
    piece.style.setProperty("--cols", COLS.toString());

    const xPercent = COLS > 1 ? (col / (COLS - 1)) * 100 : 0;
    const yPercent = ROWS > 1 ? (row / (ROWS - 1)) * 100 : 0;
    piece.style.backgroundPosition = `${xPercent}% ${yPercent}%`;
    piece.setAttribute("role", "listitem");
    piece.setAttribute("aria-label", `Piece row ${row + 1}, column ${col + 1}`);

    piece.addEventListener("dragstart", handleDragStart);
    piece.addEventListener("dragend", handleDragEnd);
    piece.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        piece.focus();
      }
    });

    fragment.appendChild(piece);
  });

  pieceBank.appendChild(fragment);
  updateBankState();
}

function handleDragStart(event) {
  if (!gameActive || puzzleSolved) {
    event.preventDefault();
    return;
  }
  const piece = event.currentTarget;
  if (!(piece instanceof HTMLElement)) return;
  activePieceId = piece.dataset.pieceId ?? null;
  piece.classList.add("is-dragging");
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", activePieceId ?? "");
}

function handleDragEnd(event) {
  const piece = event.currentTarget;
  if (piece instanceof HTMLElement) {
    piece.classList.remove("is-dragging");
  }
  activePieceId = null;
}

function handleZoneDragOver(event) {
  if (!gameActive || puzzleSolved) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = "move";
}

function handleZoneDragEnter(event) {
  if (!gameActive || puzzleSolved) return;
  const zone = event.currentTarget;
  if (zone instanceof HTMLElement) {
    zone.classList.add("is-hovered");
  }
}

function handleZoneDragLeave(event) {
  const zone = event.currentTarget;
  if (zone instanceof HTMLElement) {
    zone.classList.remove("is-hovered");
  }
}

function handleZoneDrop(event) {
  if (!gameActive || puzzleSolved) return;
  event.preventDefault();
  const zone = event.currentTarget;
  if (!(zone instanceof HTMLElement)) return;
  zone.classList.remove("is-hovered");

  const pieceId = event.dataTransfer.getData("text/plain") || activePieceId;
  if (!pieceId) return;
  const piece = document.querySelector(`[data-piece-id="${pieceId}"]`);
  if (!(piece instanceof HTMLElement)) return;

  const targetRow = zone.dataset.row;
  const targetCol = zone.dataset.col;
  const expectedRow = piece.dataset.row;
  const expectedCol = piece.dataset.col;

  if (zone.firstElementChild && zone.firstElementChild !== piece) {
    const existingPiece = zone.firstElementChild;
    if (existingPiece instanceof HTMLElement) {
      pieceBank.appendChild(existingPiece);
      existingPiece.removeAttribute("data-placed-row");
      existingPiece.removeAttribute("data-placed-col");
    }
  }

  const originZone = piece.parentElement?.classList.contains("drop-zone")
    ? piece.parentElement
    : null;

  zone.appendChild(piece);
  zone.classList.add("has-piece");
  if (originZone && originZone !== zone) {
    originZone.classList.remove("has-piece", "is-correct");
  }

  piece.dataset.placedRow = targetRow ?? "";
  piece.dataset.placedCol = targetCol ?? "";

  if (!isTimerRunning) {
    startTimer();
    setStatus("Timer running. Assemble the Ronverse intel!");
  }

  const isCorrect =
    typeof targetRow !== "undefined" &&
    typeof targetCol !== "undefined" &&
    targetRow === expectedRow &&
    targetCol === expectedCol;

  if (isCorrect) {
    zone.classList.add("is-correct");
  } else {
    zone.classList.remove("is-correct");
  }

  movesCount += 1;
  updateMovesDisplay();
  updateBankState();
  checkForCompletion();
}

function updateBankState() {
  if (!pieceBank) return;
  const remaining = pieceBank.querySelectorAll(".puzzle-piece").length;
  pieceBank.classList.toggle("empty", remaining === 0);
}

function updateMovesDisplay() {
  if (!movesEl) return;
  movesEl.textContent = movesCount.toString().padStart(3, "0");
}

function startTimer() {
  stopTimer();
  isTimerRunning = true;
  startTimestamp = performance.now();
  timerIntervalId = window.setInterval(() => {
    elapsedSeconds = Math.floor((performance.now() - startTimestamp) / 1000);
    updateTimerDisplay(elapsedSeconds);
  }, 250);
}

function stopTimer() {
  if (timerIntervalId !== null) {
    window.clearInterval(timerIntervalId);
  }
  timerIntervalId = null;
  isTimerRunning = false;
  return elapsedSeconds;
}

function updateTimerDisplay(totalSeconds) {
  elapsedSeconds = totalSeconds;
  if (!timerEl) return;
  timerEl.textContent = formatTime(totalSeconds);
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safeSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function checkForCompletion() {
  if (!board || puzzleSolved) return;
  const zones = Array.from(board.querySelectorAll(".drop-zone"));
  const solved = zones.every((zone) => {
    const piece = zone.querySelector(".puzzle-piece");
    if (!(piece instanceof HTMLElement)) return false;
    return (
      piece.dataset.row === zone.dataset.row &&
      piece.dataset.col === zone.dataset.col
    );
  });

  if (solved && zones.length === TOTAL_PIECES) {
    handleCompletion();
  }
}

function handleCompletion() {
  puzzleSolved = true;
  const finalTime = stopTimer();
  setStatus(
    `Mission accomplished! Completed in ${formatTime(finalTime)} with ${movesCount} moves.`
  );
  startButton.disabled = false;
  resetButton.disabled = true;
  gameActive = false;

  const callSign = sanitizeName(playerInput?.value) || "Anon Operative";
  const entry = {
    name: callSign,
    time: finalTime,
    moves: movesCount,
    timestamp: Date.now(),
  };
  recordScore(entry);
  renderLeaderboard();
  updateBestDisplay();
}

function sanitizeName(value) {
  return (value ?? "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function setStatus(message) {
  if (!statusEl) return;
  statusEl.textContent = message;
}

function loadLeaderboard() {
  if (typeof window === "undefined" || !window.localStorage) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) =>
          entry &&
          typeof entry === "object" &&
          typeof entry.name === "string" &&
          Number.isFinite(entry.time) &&
          Number.isFinite(entry.moves)
      )
      .slice(0, MAX_LEADERS);
  } catch (error) {
    console.warn("Failed to parse leaderboard", error);
    return [];
  }
}

function recordScore(entry) {
  leaderboard.push(entry);
  leaderboard.sort((a, b) => {
    if (a.time === b.time) {
      return a.moves - b.moves || a.timestamp - b.timestamp;
    }
    return a.time - b.time;
  });
  leaderboard = leaderboard.slice(0, MAX_LEADERS);
  saveLeaderboard();
}

function saveLeaderboard() {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(leaderboard));
  } catch (error) {
    console.warn("Unable to save leaderboard", error);
  }
}

function renderLeaderboard() {
  if (!leaderboardList) return;
  leaderboardList.innerHTML = "";

  if (!leaderboard.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard-empty";
    empty.textContent = "No completed runs logged. Be the first operatives on the board.";
    leaderboardList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  leaderboard.forEach((entry, index) => {
    const item = document.createElement("li");
    item.className = "leaderboard-entry";

    const name = document.createElement("span");
    name.className = "name";
    name.textContent = `${index + 1}. ${entry.name}`;

    const meta = document.createElement("span");
    meta.className = "meta";

    const time = document.createElement("span");
    time.textContent = `⏱ ${formatTime(entry.time)}`;

    const moves = document.createElement("span");
    moves.textContent = `Moves ${entry.moves}`;

    meta.append(time, moves);
    item.append(name, meta);
    fragment.appendChild(item);
  });

  leaderboardList.appendChild(fragment);
}

function updateBestDisplay() {
  if (!bestEl) return;
  if (!leaderboard.length) {
    bestEl.textContent = "--:--";
    return;
  }
  bestEl.textContent = formatTime(leaderboard[0].time);
}

function shuffleArray(source) {
  for (let index = source.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [source[index], source[swapIndex]] = [source[swapIndex], source[index]];
  }
  return source;
}

function stampYear() {
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear().toString();
  }
}

