const CARD_IMAGES = [
  "IMG_6881.jpg",
  "IMG_6882.jpg",
  "IMG_6883.jpg",
  "IMG_6884.jpg",
  "IMG_6885.jpg",
  "IMG_6886.jpg",
  "IMG_6887.jpg",
  "Screenshot 2025-11-09 at 20.43.57.png",
  "Screenshot 2025-11-09 at 20.44.05.png",
  "Screenshot 2025-11-09 at 20.44.12.png",
  "Screenshot 2025-11-09 at 20.44.19.png",
  "Screenshot 2025-11-09 at 20.46.28.png",
];

const STORAGE_KEY = "zikaron-leaderboard";
const MAX_LEADERBOARD = 7;

const gridEl = document.querySelector("[data-grid]");
const timerEl = document.querySelector("[data-timer]");
const movesEl = document.querySelector("[data-moves]");
const matchesEl = document.querySelector("[data-matches]");
const resetBtn = document.querySelector("[data-reset]");
const leaderboardList = document.querySelector("[data-leaderboard]");
const dialog = document.querySelector("[data-dialog]");
const dialogForm = document.querySelector("[data-dialog-form]");
const finalMovesEl = document.querySelector("[data-final-moves]");
const finalTimeEl = document.querySelector("[data-final-time]");

const cardTemplate = document.getElementById("card-template");

const state = {
  deck: [],
  revealed: 0,
  moves: 0,
  matches: 0,
  totalPairs: 0,
  firstCard: null,
  secondCard: null,
  lock: false,
  timerId: null,
  startTime: null,
  finalSeconds: null,
};

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildDeck() {
  const selection = shuffle(CARD_IMAGES).slice(0, 6);
  const tiles = selection.flatMap((src) => [
    { id: `${src}-a`, src },
    { id: `${src}-b`, src },
  ]);
  return shuffle(tiles);
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function tickTimer() {
  if (!state.startTime) return;
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  timerEl.textContent = formatTime(elapsed);
}

function startTimer() {
  if (state.timerId) return;
  state.startTime = Date.now();
  tickTimer();
  state.timerId = window.setInterval(tickTimer, 1000);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
  }
  state.timerId = null;
}

function updateStatus() {
  movesEl.textContent = state.moves.toString();
  matchesEl.textContent = `${state.matches}/${state.totalPairs}`;
}

function resetStatusIndicators() {
  timerEl.textContent = "00:00";
  movesEl.textContent = "0";
  matchesEl.textContent = `0/${state.totalPairs}`;
}

function clearBoard() {
  gridEl.innerHTML = "";
}

function createCardTile(tile) {
  const fragment = cardTemplate.content.cloneNode(true);
  const button = fragment.querySelector(".card");
  const image = fragment.querySelector("img");

  button.dataset.cardId = tile.id;
  button.dataset.cardKey = tile.src;
  image.src = `./cards/${tile.src}`;
  image.alt = `Memory shard ${tile.src}`;

  button.addEventListener("click", () => handleCardFlip(button));

  return fragment;
}

function populateBoard() {
  const fragment = document.createDocumentFragment();
  state.deck.forEach((tile) => {
    fragment.appendChild(createCardTile(tile));
  });
  gridEl.appendChild(fragment);
}

function resetState() {
  stopTimer();
  const deck = buildDeck();
  Object.assign(state, {
    deck,
    revealed: 0,
    moves: 0,
    matches: 0,
    totalPairs: deck.length / 2,
    firstCard: null,
    secondCard: null,
    lock: false,
    timerId: null,
    startTime: null,
    finalSeconds: null,
  });
}

function resetGame() {
  if (dialog?.open) {
    dialog.close();
    dialogForm.reset();
  }
  resetState();
  clearBoard();
  populateBoard();
  resetStatusIndicators();
}

function disableCard(card) {
  card.setAttribute("disabled", "true");
}

function enableCard(card) {
  card.removeAttribute("disabled");
}

function flipCard(card) {
  card.dataset.state = "flipped";
}

function hideCard(card) {
  card.dataset.state = "";
}

function markMatched(card) {
  card.dataset.state = "matched";
  disableCard(card);
}

function attemptMatch() {
  if (!state.firstCard || !state.secondCard) return;
  const firstKey = state.firstCard.dataset.cardKey;
  const secondKey = state.secondCard.dataset.cardKey;
  state.moves += 1;

  if (firstKey === secondKey) {
    state.matches += 1;
    updateStatus();
    markMatched(state.firstCard);
    markMatched(state.secondCard);
    state.firstCard = null;
    state.secondCard = null;
    state.lock = false;
    if (state.matches === state.totalPairs) {
      handleGameComplete();
    }
  } else {
    updateStatus();
    state.lock = true;
    window.setTimeout(() => {
      hideCard(state.firstCard);
      hideCard(state.secondCard);
      enableCard(state.firstCard);
      enableCard(state.secondCard);
      state.firstCard = null;
      state.secondCard = null;
      state.lock = false;
    }, 900);
  }
}

function handleCardFlip(card) {
  if (state.lock || card.dataset.state === "flipped" || card.dataset.state === "matched") {
    return;
  }
  startTimer();
  flipCard(card);
  disableCard(card);

  if (!state.firstCard) {
    state.firstCard = card;
    return;
  }

  state.secondCard = card;
  attemptMatch();
}

function loadLeaderboard() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (entry) =>
          typeof entry?.name === "string" &&
          typeof entry?.moves === "number" &&
          typeof entry?.seconds === "number"
      )
      .sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.seconds - b.seconds;
      })
      .slice(0, MAX_LEADERBOARD);
  } catch {
    return [];
  }
}

function renderLeaderboard(entries) {
  leaderboardList.innerHTML = "";
  if (!entries.length) {
    const empty = document.createElement("li");
    empty.className = "leaderboard__empty";
    empty.textContent = "No runs logged yet — be the first to charge the core.";
    leaderboardList.appendChild(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const item = document.createElement("li");
    const nameSpan = document.createElement("span");
    nameSpan.innerHTML = `<strong>${index + 1}.</strong> ${entry.name}`;

    const metaSpan = document.createElement("span");
    metaSpan.innerHTML = `<strong>${formatTime(entry.seconds)}</strong> • ${entry.moves} moves`;

    item.appendChild(nameSpan);
    item.appendChild(metaSpan);
    leaderboardList.appendChild(item);
  });
}

function saveLeaderboard(entries) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function openDialog(moves, seconds) {
  finalMovesEl.textContent = moves.toString();
  finalTimeEl.textContent = formatTime(seconds);

  if (typeof dialog?.showModal === "function") {
    dialog.showModal();
  } else {
    const name = window.prompt(
      `Reactor charged in ${formatTime(seconds)} with ${moves} moves! Callsign?`,
      "Commander Ron"
    );
    if (name) {
      persistLeaderboardEntry(name, moves, seconds);
    }
  }
}

function persistLeaderboardEntry(name, moves, seconds) {
  const sanitized = name.trim().slice(0, 24) || "Anonymous";
  const leaderboard = loadLeaderboard();

  leaderboard.push({
    name: sanitized,
    moves,
    seconds,
    recordedAt: new Date().toISOString(),
  });

  leaderboard.sort((a, b) => {
    if (a.moves !== b.moves) return a.moves - b.moves;
    return a.seconds - b.seconds;
  });

  const trimmed = leaderboard.slice(0, MAX_LEADERBOARD);
  saveLeaderboard(trimmed);
  renderLeaderboard(trimmed);
}

function handleGameComplete() {
  stopTimer();
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  state.finalSeconds = elapsed;
  openDialog(state.moves, elapsed);
}

function handleDialogSubmit(event) {
  event.preventDefault();
  const formData = new FormData(dialogForm);
  const name = formData.get("player-name");
  if (typeof name === "string" && name.trim()) {
    const seconds = Number.isFinite(state.finalSeconds)
      ? state.finalSeconds
      : Math.floor((Date.now() - state.startTime) / 1000);
    persistLeaderboardEntry(name, state.moves, seconds);
  }
  dialog.close();
  dialogForm.reset();
}

function handleDialogCancel() {
  dialog.close();
  dialogForm.reset();
}

function boot() {
  resetGame();
  renderLeaderboard(loadLeaderboard());
}

resetBtn?.addEventListener("click", resetGame);
dialogForm?.addEventListener("submit", handleDialogSubmit);
dialog?.addEventListener("close", () => dialogForm.reset());
dialog?.addEventListener("cancel", (event) => {
  event.preventDefault();
  handleDialogCancel();
});

window.addEventListener("DOMContentLoaded", boot);


