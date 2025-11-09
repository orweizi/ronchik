const canvas = document.getElementById("gameCanvas");
const ctx = canvas?.getContext("2d", { alpha: true });
const fogCanvas = document.getElementById("fogCanvas");
const fogCtx = fogCanvas?.getContext("2d", { alpha: true });

if (!canvas || !ctx || !fogCanvas || !fogCtx) {
  throw new Error("Ronified sector failed to initialize required canvases.");
}

const hud = {
  coverage: document.querySelector("[data-coverage]"),
  lives: document.querySelector("[data-lives]"),
  level: document.querySelector("[data-level]"),
};

const playfieldEl = document.querySelector(".playfield");
const statusBanner = document.querySelector(".status-banner");
const victoryDrop = document.querySelector("[data-victory-message]");
const restartButton = document.querySelector('[data-action="restart"]');
const touchControls = document.querySelector("[data-touch-controls]");
const joystickBase = document.querySelector("[data-joystick]");
const joystickThumb = document.querySelector("[data-joystick-thumb]");
const coarsePointerQuery = window.matchMedia("(pointer: coarse)");

const CELL_SIZE = 20;
const COLS = canvas.width / CELL_SIZE;
const ROWS = canvas.height / CELL_SIZE;
const TOTAL_PLAYABLE = (COLS - 2) * (ROWS - 2);
const MOVE_INTERVAL = 0.085; // seconds per grid step

const KEY_TO_DIRECTION = new Map([
  ["ArrowUp", { x: 0, y: -1 }],
  ["ArrowDown", { x: 0, y: 1 }],
  ["ArrowLeft", { x: -1, y: 0 }],
  ["ArrowRight", { x: 1, y: 0 }],
  ["w", { x: 0, y: -1 }],
  ["s", { x: 0, y: 1 }],
  ["a", { x: -1, y: 0 }],
  ["d", { x: 1, y: 0 }],
]);

const NEIGHBORS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const LEVELS = [
  { bg: "./bg/1.jpg", target: 0.55, enemySpeed: 95 },
  { bg: "./bg/2.jpg", target: 0.65, enemySpeed: 110 },
  { bg: "./bg/3.jpg", target: 0.75, enemySpeed: 125 },
  { bg: "./bg/4.jpg", target: 0.82, enemySpeed: 140 },
];

const game = {
  levelIndex: 0,
  lives: 3,
  board: [],
  coverageRatio: 0,
  currentDir: { x: 0, y: 0 },
  pendingDir: null,
  moveTimer: 0,
  lastTimestamp: 0,
  gameOver: false,
  victory: false,
};

const playerStart = {
  x: Math.floor(COLS / 2),
  y: ROWS - 1,
};

const player = {
  x: playerStart.x,
  y: playerStart.y,
  drawing: false,
  trail: new Set(),
};

const enemy = {
  x: 0,
  y: 0,
  vx: 0,
  vy: 0,
  radius: CELL_SIZE * 0.38,
};

let bannerTimerId = null;
let joystickPointerId = null;
let joystickActive = false;
let joystickDirection = null;

function queueDirection(direction) {
  if (!direction) return;
  game.pendingDir = { ...direction };
}

function stopMovement() {
  game.currentDir = { x: 0, y: 0 };
  game.pendingDir = null;
}

function centerJoystickThumb() {
  if (!joystickThumb) return;
  joystickThumb.style.setProperty("--dx", "0px");
  joystickThumb.style.setProperty("--dy", "0px");
}

function shouldUseTouchControls() {
  return coarsePointerQuery.matches || (navigator.maxTouchPoints ?? 0) > 0;
}

function inBounds(x, y) {
  return x >= 0 && x < COLS && y >= 0 && y < ROWS;
}

function cellKey(x, y) {
  return y * COLS + x;
}

function createBoard() {
  game.board = Array.from({ length: ROWS }, (_, rowIndex) => {
    const row = new Array(COLS).fill(0);
    if (rowIndex === 0 || rowIndex === ROWS - 1) {
      row.fill(1);
    } else {
      row[0] = 1;
      row[COLS - 1] = 1;
    }
    return row;
  });
}

function resetPlayerPosition() {
  player.x = playerStart.x;
  player.y = playerStart.y;
  player.drawing = false;
  clearActiveTrail(0);
}

function spawnEnemy() {
  const levelConfig = LEVELS[game.levelIndex];
  const spawnCol = Math.floor(COLS / 2);
  const spawnRow = Math.floor(ROWS / 2);

  enemy.x = (spawnCol + 0.5) * CELL_SIZE;
  enemy.y = (spawnRow + 0.5) * CELL_SIZE;

  const speed = levelConfig.enemySpeed;
  enemy.vx = (Math.random() > 0.5 ? 1 : -1) * speed;
  enemy.vy = (Math.random() > 0.5 ? 1 : -1) * speed;
}

function updateHud() {
  if (hud.level) {
    hud.level.textContent = String(game.levelIndex + 1).padStart(2, "0");
  }
  if (hud.lives) {
    hud.lives.textContent = String(Math.max(game.lives, 0)).padStart(2, "0");
  }
  if (hud.coverage) {
    const percentage = Math.round(game.coverageRatio * 100);
    hud.coverage.textContent = `${percentage}%`;
  }
}

function setBackgroundImage() {
  const { bg } = LEVELS[game.levelIndex];
  playfieldEl?.style.setProperty("--bg-image", `url('${bg}')`);
}

function clearActiveTrail(fillValue) {
  player.trail.forEach((encoded) => {
    const x = encoded % COLS;
    const y = Math.floor(encoded / COLS);
    if (inBounds(x, y)) {
      game.board[y][x] = fillValue;
    }
  });
  player.trail.clear();
}

function markTrail(x, y) {
  if (!inBounds(x, y)) return;
  const key = cellKey(x, y);
  if (!player.trail.has(key)) {
    player.trail.add(key);
  }
  game.board[y][x] = 2;
}

function startTrail() {
  player.drawing = true;
  player.trail.clear();
  markTrail(player.x, player.y);
}

function finalizeTrail() {
  captureArea();
  player.drawing = false;
  game.currentDir = { x: 0, y: 0 };
}

function captureArea() {
  if (!player.trail.size) {
    clearActiveTrail(0);
    renderFog();
    return;
  }

  const visited = Array.from({ length: ROWS }, () => new Array(COLS).fill(false));
  const queue = [];

  const enemyCol = Math.max(0, Math.min(COLS - 1, Math.floor(enemy.x / CELL_SIZE)));
  const enemyRow = Math.max(0, Math.min(ROWS - 1, Math.floor(enemy.y / CELL_SIZE)));

  if (game.board[enemyRow]?.[enemyCol] !== 1) {
    visited[enemyRow][enemyCol] = true;
    queue.push([enemyCol, enemyRow]);
  }

  while (queue.length) {
    const [cx, cy] = queue.shift();
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (!inBounds(nx, ny)) continue;
      if (visited[ny][nx]) continue;
      if (game.board[ny][nx] !== 0) continue;
      visited[ny][nx] = true;
      queue.push([nx, ny]);
    }
  }

  let newlyClaimed = 0;
  for (let y = 1; y < ROWS - 1; y += 1) {
    for (let x = 1; x < COLS - 1; x += 1) {
      if (game.board[y][x] === 0 && !visited[y][x]) {
        game.board[y][x] = 1;
        newlyClaimed += 1;
      }
    }
  }

  clearActiveTrail(1);
  renderFog();
  updateCoverage();

  if (newlyClaimed > 0) {
    pulseBanner("Territory secured");
  }

  checkForLevelCompletion();
}

function updateCoverage() {
  let claimed = 0;
  for (let y = 1; y < ROWS - 1; y += 1) {
    for (let x = 1; x < COLS - 1; x += 1) {
      if (game.board[y][x] === 1) {
        claimed += 1;
      }
    }
  }

  game.coverageRatio = claimed / TOTAL_PLAYABLE;
  updateHud();
}

function loseLife(reason = "Probe intercepted you") {
  if (game.gameOver) return;

  game.lives -= 1;
  if (game.lives < 0) game.lives = 0;

  clearActiveTrail(0);
  renderFog();
  resetPlayerPosition();
  spawnEnemy();
  updateHud();

  if (game.lives <= 0) {
    game.gameOver = true;
    game.victory = false;
    showBanner(`${reason}. Mission failed – press R to reset.`);
  } else {
    showBanner(`${reason}. ${game.lives} lives remaining.`);
  }
}

function checkEnemyPlayerCollision() {
  const playerCenterX = player.x * CELL_SIZE + CELL_SIZE / 2;
  const playerCenterY = player.y * CELL_SIZE + CELL_SIZE / 2;
  const dx = enemy.x - playerCenterX;
  const dy = enemy.y - playerCenterY;
  const distance = Math.hypot(dx, dy);

  if (distance < enemy.radius * 0.85) {
    loseLife("Probe intercepted you");
  }
}

function handleTrailBreach() {
  if (!player.drawing) return;
  loseLife("Trail compromised");
}

function updateEnemy(dt) {
  const speedMultiplier = 1 + Math.min(game.coverageRatio, 0.6);
  const vx = enemy.vx;
  const vy = enemy.vy;

  let nextX = enemy.x + vx * dt * speedMultiplier;
  let nextY = enemy.y + vy * dt * speedMultiplier;

  let nextCol = Math.floor(nextX / CELL_SIZE);
  let nextRow = Math.floor(nextY / CELL_SIZE);

  const currentCol = Math.floor(enemy.x / CELL_SIZE);
  const currentRow = Math.floor(enemy.y / CELL_SIZE);

  const blockedX =
    !inBounds(nextCol, currentRow) || game.board[currentRow]?.[nextCol] === 1;
  const blockedY =
    !inBounds(currentCol, nextRow) || game.board[nextRow]?.[currentCol] === 1;

  if (blockedX) {
    enemy.vx *= -1;
    nextX = enemy.x + enemy.vx * dt * speedMultiplier;
    nextCol = Math.floor(nextX / CELL_SIZE);
  }

  if (blockedY) {
    enemy.vy *= -1;
    nextY = enemy.y + enemy.vy * dt * speedMultiplier;
    nextRow = Math.floor(nextY / CELL_SIZE);
  }

  enemy.x = Math.max(CELL_SIZE / 2, Math.min(canvas.width - CELL_SIZE / 2, nextX));
  enemy.y = Math.max(CELL_SIZE / 2, Math.min(canvas.height - CELL_SIZE / 2, nextY));

  const cellValue = game.board[nextRow]?.[nextCol];
  if (cellValue === 2) {
    handleTrailBreach();
  }
}

function checkForLevelCompletion() {
  const target = LEVELS[game.levelIndex].target;
  if (game.coverageRatio < target) return;

  if (game.levelIndex >= LEVELS.length - 1) {
    game.gameOver = true;
    game.victory = true;
    showVictoryMessage();
    showBanner("All intel recovered! Press R to replay.");
    return;
  }

  showBanner("Sector cleared. Advancing…", 2400);
  game.levelIndex += 1;
  startLevel({ preserveLives: true });
  pulseBanner(`Entering Sector ${String(game.levelIndex + 1).padStart(2, "0")}`);
}

function applyPendingDirection() {
  if (!game.pendingDir) return;
  const { x, y } = game.pendingDir;

  if (x === 0 && y === 0) {
    game.pendingDir = null;
    return;
  }

  const opposite =
    x === -game.currentDir.x && y === -game.currentDir.y && (game.currentDir.x !== 0 || game.currentDir.y !== 0);

  if (opposite && player.drawing && player.trail.size > 0) {
    // Avoid instant reversal on an active trail to reduce accidental collisions.
    game.pendingDir = null;
    return;
  }

  game.currentDir = { x, y };
  game.pendingDir = null;
}

function stepPlayer() {
  const dir = game.currentDir;
  if (!dir || (dir.x === 0 && dir.y === 0)) {
    return false;
  }

  const nextX = player.x + dir.x;
  const nextY = player.y + dir.y;

  if (!inBounds(nextX, nextY)) {
    game.currentDir = { x: 0, y: 0 };
    return false;
  }

  const cellValue = game.board[nextY][nextX];

  player.x = nextX;
  player.y = nextY;

  if (player.drawing) {
    if (cellValue === 1) {
      finalizeTrail();
    } else {
      markTrail(nextX, nextY);
    }
  } else if (cellValue === 0) {
    startTrail();
  }

  return true;
}

function update(dt) {
  if (game.gameOver) return;

  applyPendingDirection();

  game.moveTimer += dt;
  while (game.moveTimer >= MOVE_INTERVAL) {
    const moved = stepPlayer();
    game.moveTimer -= MOVE_INTERVAL;
    if (!moved) break;
  }

  updateEnemy(dt);
  if (!game.gameOver) {
    checkEnemyPlayerCollision();
  }
}

function renderFog() {
  fogCtx.clearRect(0, 0, fogCanvas.width, fogCanvas.height);
  fogCtx.fillStyle = "rgba(5, 8, 22, 0.88)";
  fogCtx.fillRect(0, 0, fogCanvas.width, fogCanvas.height);

  fogCtx.globalCompositeOperation = "destination-out";
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (game.board[y][x] === 1) {
        fogCtx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
  fogCtx.globalCompositeOperation = "source-over";

  // Add a subtle tint over captured territories for cohesion.
  fogCtx.fillStyle = "rgba(99, 245, 198, 0.08)";
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (game.board[y][x] === 1) {
        fogCtx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }
}

function renderGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Claimed grid visualization
  ctx.fillStyle = "rgba(99, 245, 198, 0.04)";
  for (let y = 0; y < ROWS; y += 1) {
    for (let x = 0; x < COLS; x += 1) {
      if (game.board[y][x] === 1) {
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
  }

  // Active trails
  ctx.fillStyle = "rgba(99, 245, 198, 0.65)";
  player.trail.forEach((encoded) => {
    const x = encoded % COLS;
    const y = Math.floor(encoded / COLS);
    ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
  });

  // Player
  const playerX = player.x * CELL_SIZE;
  const playerY = player.y * CELL_SIZE;
  ctx.fillStyle = player.drawing ? "#63f5c6" : "#7c4dff";
  ctx.fillRect(playerX + 4, playerY + 4, CELL_SIZE - 8, CELL_SIZE - 8);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(playerX + 4, playerY + 4, CELL_SIZE - 8, CELL_SIZE - 8);

  // Enemy probe
  ctx.beginPath();
  ctx.arc(enemy.x, enemy.y, enemy.radius, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 101, 132, 0.92)";
  ctx.fill();
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
  ctx.stroke();
}

function render() {
  renderFog();
  renderGame();
}

function showBanner(message, duration = 2600) {
  if (!statusBanner) return;
  statusBanner.textContent = message;
  statusBanner.classList.add("is-visible");
  if (bannerTimerId) {
    window.clearTimeout(bannerTimerId);
  }
  bannerTimerId = window.setTimeout(() => {
    statusBanner?.classList.remove("is-visible");
  }, duration);
}

function showVictoryMessage() {
  if (!victoryDrop) return;
  victoryDrop.setAttribute("aria-hidden", "false");
  victoryDrop.classList.remove("is-active");
  void victoryDrop.offsetWidth;
  victoryDrop.classList.add("is-active");
}

function hideVictoryMessage() {
  if (!victoryDrop) return;
  victoryDrop.classList.remove("is-active");
  victoryDrop.setAttribute("aria-hidden", "true");
}

function pulseBanner(message) {
  showBanner(message, 1800);
}

function stampYear() {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
}

function startLevel({ preserveLives = false } = {}) {
  if (!preserveLives) {
    game.lives = 3;
    game.levelIndex = 0;
  }

  createBoard();
  resetPlayerPosition();
  spawnEnemy();
  game.coverageRatio = 0;
  game.currentDir = { x: 0, y: 0 };
  game.pendingDir = null;
  game.moveTimer = 0;
  game.gameOver = false;
  game.victory = false;

  hideVictoryMessage();
  setBackgroundImage();
  updateCoverage();
  renderFog();
  renderGame();
  updateHud();
  joystickDirection = null;
  centerJoystickThumb();
}

function restartGame() {
  startLevel();
  showBanner("Systems reset. Secure the sector.");
}

function handleKeydown(event) {
  const key = event.key;
  if (KEY_TO_DIRECTION.has(key)) {
    event.preventDefault();
    if (!game.gameOver) {
      const direction = KEY_TO_DIRECTION.get(key);
      queueDirection(direction);
    }
    return;
  }

  const lowerKey = key.toLowerCase();
  if (KEY_TO_DIRECTION.has(lowerKey)) {
    event.preventDefault();
    if (!game.gameOver) {
      const direction = KEY_TO_DIRECTION.get(lowerKey);
      queueDirection(direction);
    }
    return;
  }

  if (game.gameOver && (key === "r" || key === "R" || key === "Enter" || key === " ")) {
    event.preventDefault();
    restartGame();
  }
}

function handleJoystickStart(event) {
  if (!joystickBase || !shouldUseTouchControls()) return;
  if (event.pointerType === "mouse" && !coarsePointerQuery.matches) return;
  event.preventDefault();
  joystickActive = true;
  joystickPointerId = event.pointerId;
  joystickBase.setPointerCapture?.(event.pointerId);
  joystickThumb?.style.setProperty("transition", "none");
  updateJoystickFromEvent(event);
}

function handleJoystickMove(event) {
  if (!joystickActive || event.pointerId !== joystickPointerId) return;
  event.preventDefault();
  updateJoystickFromEvent(event);
}

function handleJoystickEnd(event) {
  if (!joystickActive || event.pointerId !== joystickPointerId) return;
  joystickActive = false;
  joystickPointerId = null;
  joystickDirection = null;
  joystickBase?.releasePointerCapture?.(event.pointerId);
  joystickThumb?.style.removeProperty("transition");
  centerJoystickThumb();
  stopMovement();
}

function updateJoystickFromEvent(event) {
  if (!joystickBase || !joystickThumb) return;

  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const dx = event.clientX - centerX;
  const dy = event.clientY - centerY;

  const maxDistance = rect.width / 2;
  const rawDistance = Math.hypot(dx, dy);
  const clampedDistance = Math.min(rawDistance, maxDistance);

  const angle = rawDistance === 0 ? 0 : Math.atan2(dy, dx);
  const offsetX = Math.cos(angle) * clampedDistance;
  const offsetY = Math.sin(angle) * clampedDistance;

  joystickThumb.style.setProperty("--dx", `${offsetX}px`);
  joystickThumb.style.setProperty("--dy", `${offsetY}px`);

  const deadZone = maxDistance * 0.28;
  if (clampedDistance <= deadZone) {
    if (joystickDirection) {
      stopMovement();
      joystickDirection = null;
    }
    return;
  }

  const absX = Math.abs(dx);
  const absY = Math.abs(dy);
  const nextDirection =
    absX > absY
      ? dx > 0
        ? { x: 1, y: 0 }
        : { x: -1, y: 0 }
      : dy > 0
      ? { x: 0, y: 1 }
      : { x: 0, y: -1 };

  if (
    !joystickDirection ||
    joystickDirection.x !== nextDirection.x ||
    joystickDirection.y !== nextDirection.y
  ) {
    queueDirection(nextDirection);
    joystickDirection = nextDirection;
  }
}

function updateTouchControlVisibility() {
  if (!touchControls) return;
  if (shouldUseTouchControls()) {
    touchControls.hidden = false;
    touchControls.classList.add("is-active");
  } else {
    touchControls.classList.remove("is-active");
    touchControls.hidden = true;
    joystickActive = false;
    joystickPointerId = null;
    joystickDirection = null;
    centerJoystickThumb();
    stopMovement();
  }
}

function setupTouchControls() {
  if (!touchControls || !joystickBase || !joystickThumb) return;

  updateTouchControlVisibility();

  if (typeof coarsePointerQuery.addEventListener === "function") {
    coarsePointerQuery.addEventListener("change", updateTouchControlVisibility);
  } else if (typeof coarsePointerQuery.addListener === "function") {
    coarsePointerQuery.addListener(updateTouchControlVisibility);
  }

  joystickBase.addEventListener("pointerdown", handleJoystickStart);
  joystickBase.addEventListener("pointermove", handleJoystickMove);
  joystickBase.addEventListener("pointerup", handleJoystickEnd);
  joystickBase.addEventListener("pointercancel", handleJoystickEnd);
  joystickBase.addEventListener("pointerleave", handleJoystickEnd);
}

function gameLoop(timestamp) {
  if (!game.lastTimestamp) {
    game.lastTimestamp = timestamp;
  }
  const delta = (timestamp - game.lastTimestamp) / 1000;
  game.lastTimestamp = timestamp;

  update(delta);
  render();

  window.requestAnimationFrame(gameLoop);
}

restartButton?.addEventListener("click", () => {
  restartGame();
});

document.addEventListener("keydown", handleKeydown, { passive: false });

stampYear();
startLevel();
setupTouchControls();
window.requestAnimationFrame(gameLoop);

