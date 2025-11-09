const games = [
  {
    id: "ask-ron",
    codename: "ASK-RON",
    title: "Ask Ron",
    description:
      "Interface directly with Ron’s consciousness. Ask questions, trigger responses, and unlock surprise birthday lore.",
    status: "live",
    tags: ["AI link", "story mode"],
    media: {
      type: "image",
      src: "./img/askron.png",
      alt: "Ask Ron interface holographic preview",
    },
    cta: {
      label: "Engage Terminal",
      href: "./askron/index.html",
    },
  },
  {
    id: "zikaron",
    codename: "ZIKARON",
    title: "Zikaron",
    description:
      "Memory shard flip game. Match Ron’s iconic moments to charge the birthday reactor and unlock gallery bonuses.",
    status: "live",
    tags: ["memory grid", "retro"],
    media: {
      type: "image",
      src: "./img/zikaron.png",
      alt: "Zikaron memory core grid preview",
    },
    cta: {
      label: "Enter Memory Core",
      href: "./zikaron/index.html",
    },
  },
  {
    id: "ronified",
    codename: "RONIFIED",
    title: "Ronified",
    description:
      "Vector-capture dogfight inspired by the arcade classic. Defend Ron’s birthday sectors, reveal intel, and push the high score.",
    status: "live",
    tags: ["arcade", "high score"],
    media: {
      type: "image",
      src: "./img/ronified.png",
      alt: "Ronified vector battlefield preview",
    },
    cta: {
      label: "Enter Sector",
      href: "./volfied/index.html",
    },
  },
  {
    id: "puzzle-relay",
    codename: "PUZZLE",
    title: "Puzzle Relay",
    description:
      "Forty-piece Ronverse jigsaw. Assemble the intel image against the clock and claim leaderboard glory.",
    status: "live",
    tags: ["jigsaw", "speed run"],
    media: {
      type: "image",
      src: "./img/puzzle.png",
      alt: "Puzzle relay dashboard cover art",
    },
    cta: {
      label: "Launch Puzzle",
      href: "./puzzle/index.html",
    },
  },
];

const statusVariant = {
  live: "",
  loading: "loading",
  upcoming: "upcoming",
};

function buildGameCard(game) {
  const card = document.createElement("article");
  card.className = "game-card";
  card.dataset.code = game.codename;
  card.dataset.game = game.id;
  card.setAttribute("tabindex", "0");

  const tagsMarkup = (game.tags ?? [])
    .map((tag) => `<span class="tag">${tag}</span>`)
    .join("");

  const mediaMarkup =
    game.media?.type === "video"
      ? `<video src="${game.media.src}" autoplay muted loop playsinline aria-label="${game.media.alt ?? game.title} preview"></video>`
      : `<img src="${game.media?.src ?? ""}" alt="${game.media?.alt ?? ""}" loading="lazy" />`;

  const statusClass = statusVariant[game.status] ?? "";
  const statusLabel = (game.status ?? "upcoming").replace(/^\w/, (c) =>
    c.toUpperCase()
  );

  card.innerHTML = `
    <header class="card-header">
      <div>
        <p class="status-chip ${statusClass}">${statusLabel}</p>
        <h3 class="card-title">${game.title}</h3>
      </div>
    </header>
    <p class="card-description">
      ${game.description}
    </p>
    <div class="card-tags">${tagsMarkup}</div>
    <figure class="card-media">
      ${mediaMarkup}
    </figure>
    <footer class="card-footer">
      <a class="launch-button" href="${game.cta?.href ?? "#"}">${game.cta?.label ?? "Launch"}</a>
      <span class="card-index">${game.codename}</span>
    </footer>
  `;

  return card;
}

function renderDeck(deckEl) {
  if (!deckEl) return;
  const fragment = document.createDocumentFragment();
  games.forEach((game) => fragment.appendChild(buildGameCard(game)));
  deckEl.innerHTML = "";
  deckEl.appendChild(fragment);
}

function setupStatus(deckEl) {
  const statusTotal = document.querySelector(".status-total");
  const statusCurrent = document.querySelector(".status-current");
  if (statusTotal) statusTotal.textContent = games.length.toString().padStart(2, "0");

  const cards = Array.from(deckEl.querySelectorAll(".game-card"));
  if (!cards.length || !statusCurrent) return;

  const observer = new IntersectionObserver(
    (entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .map((entry) => entry.target)
        .sort((a, b) => a.offsetLeft - b.offsetLeft);

      if (!visible.length) return;
      const card = visible[0];
      const index = cards.indexOf(card);
      if (index >= 0) {
        statusCurrent.textContent = (index + 1).toString().padStart(2, "0");
      }
    },
    {
      root: deckEl,
      threshold: 0.6,
    }
  );

  cards.forEach((card) => observer.observe(card));

  // Fallback for wide layouts where deck isn't scrollable
  statusCurrent.textContent = "01";
}

function setupNavigation(deckEl) {
  const prevBtn = document.querySelector(".deck-controls .prev");
  const nextBtn = document.querySelector(".deck-controls .next");
  if (!prevBtn || !nextBtn) return;

  const scrollByAmount = () => deckEl.clientWidth * 0.85;

  prevBtn.addEventListener("click", () => {
    deckEl.scrollBy({ left: -scrollByAmount(), behavior: "smooth" });
  });
  nextBtn.addEventListener("click", () => {
    deckEl.scrollBy({ left: scrollByAmount(), behavior: "smooth" });
  });
}

function syncDeckMode(deckEl) {
  const mq = window.matchMedia("(min-width: 960px)");
  const updateMode = () => {
    deckEl.dataset.mode = mq.matches ? "grid" : "carousel";
  };
  updateMode();
  mq.addEventListener("change", updateMode);
}

function wireKeyboardScroll(deckEl) {
  deckEl.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      deckEl.scrollBy({ left: deckEl.clientWidth * 0.85, behavior: "smooth" });
      event.preventDefault();
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      deckEl.scrollBy({ left: -deckEl.clientWidth * 0.85, behavior: "smooth" });
      event.preventDefault();
    }
  });
}

function initBriefingLogs() {
  const trigger = document.querySelector(".secondary-cta");
  const overlay = document.getElementById("briefing-overlay");
  if (!trigger || !overlay) return;

  trigger.setAttribute("aria-controls", "briefing-overlay");
  trigger.setAttribute("aria-expanded", "false");

  const closeTargets = overlay.querySelectorAll("[data-briefing-close]");
  const list = overlay.querySelector(".briefing-list");
  const scrollRegion = overlay.querySelector(".briefing-scroll");
  const confettiStage = overlay.querySelector(".confetti-stage");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

  let logsCache = null;
  let loadPromise = null;
  let lastFocusedElement = null;
  let confettiTimeoutId;

  const focusableSelector =
    'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

  overlay.setAttribute("aria-hidden", "true");

  const escapeHtml = (value) =>
    value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const setBusy = (isBusy) => {
    if (!scrollRegion) return;
    scrollRegion.setAttribute("aria-busy", isBusy ? "true" : "false");
  };

  const showLoading = () => {
    if (!list) return;
    list.innerHTML = '<li class="briefing-placeholder">Decrypting transmissions&hellip;</li>';
  };

  const showError = () => {
    if (!list) return;
    list.innerHTML =
      '<li class="briefing-placeholder">Signal jammed. Retry in a moment.</li>';
  };

  const renderLogs = (lines) => {
    if (!list) return;
    if (!lines.length) {
      list.innerHTML = '<li class="briefing-placeholder">No transmissions logged yet.</li>';
      return;
    }
    const markup = lines
      .map((line, index) => {
        const label = (index + 1).toString().padStart(2, "0");
        return `<li><span class="briefing-index">${label}</span><span class="briefing-text">${escapeHtml(
          line
        )}</span></li>`;
      })
      .join("");
    list.innerHTML = markup;
  };

  const loadLogs = async () => {
    if (logsCache) return logsCache;
    if (!loadPromise) {
      loadPromise = fetch("./img/briefing_logs")
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to load briefing logs: ${response.status}`);
          }
          return response.text();
        })
        .then((text) => {
          const lines = text
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          logsCache = lines;
          return lines;
        })
        .catch((error) => {
          loadPromise = null;
          throw error;
        });
    }
    return loadPromise;
  };

  const getFocusableElements = () =>
    Array.from(overlay.querySelectorAll(focusableSelector)).filter((element) => {
      if (!(element instanceof HTMLElement)) return false;
      return (
        !element.hasAttribute("disabled") &&
        element.tabIndex !== -1 &&
        element.offsetParent !== null
      );
    });

  const handleTransitionEnd = (event) => {
    if (event.target !== overlay || event.propertyName !== "opacity") return;
    if (!overlay.classList.contains("is-active")) {
      overlay.hidden = true;
      overlay.removeEventListener("transitionend", handleTransitionEnd);
    }
  };

  function closeOverlay() {
    if (!overlay.classList.contains("is-active")) return;
    overlay.classList.remove("is-active");
    overlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-briefing-open");
    trigger.setAttribute("aria-expanded", "false");
    overlay.addEventListener("transitionend", handleTransitionEnd);
    overlay.removeEventListener("keydown", handleKeydown);
    window.clearTimeout(confettiTimeoutId);
    if (confettiStage) {
      confettiStage.classList.remove("is-active");
      confettiStage.innerHTML = "";
    }
    if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
      window.setTimeout(() => {
        try {
          lastFocusedElement.focus({ preventScroll: true });
        } catch (error) {
          lastFocusedElement.focus();
        }
      }, 0);
    }
  }

  const handleKeydown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      closeOverlay();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = getFocusableElements();
    if (!focusable.length) {
      event.preventDefault();
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey) {
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const launchConfetti = () => {
    if (!confettiStage || reducedMotionQuery.matches) return;
    confettiStage.innerHTML = "";
    const pieceCount = window.innerWidth < 680 ? 60 : 110;
    for (let index = 0; index < pieceCount; index += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.setProperty("--x", `${Math.random() * 100}%`);
      piece.style.setProperty("--delay", `${Math.random() * 0.45}s`);
      piece.style.setProperty("--duration", `${2.6 + Math.random() * 1.8}s`);
      piece.style.setProperty("--hue", `${Math.floor(Math.random() * 360)}`);
      piece.style.setProperty("--sat", `${65 + Math.random() * 25}%`);
      piece.style.setProperty("--size", `${10 + Math.random() * 10}px`);
      piece.style.setProperty("--length", `${18 + Math.random() * 18}px`);
      piece.style.setProperty("--drift", `${Math.random() * 160 - 80}px`);
      piece.style.setProperty("--scale", (0.7 + Math.random() * 0.6).toFixed(2));
      confettiStage.appendChild(piece);
    }
    confettiStage.classList.add("is-active");
    window.clearTimeout(confettiTimeoutId);
    confettiTimeoutId = window.setTimeout(() => {
      confettiStage.classList.remove("is-active");
      confettiStage.innerHTML = "";
    }, 3600);
  };

  async function openOverlay() {
    if (overlay.classList.contains("is-active")) return;
    lastFocusedElement =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;

    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-briefing-open");
    trigger.setAttribute("aria-expanded", "true");
    showLoading();
    setBusy(true);
    overlay.addEventListener("keydown", handleKeydown);
    if (scrollRegion) {
      scrollRegion.scrollTop = 0;
    }

    requestAnimationFrame(() => {
      overlay.classList.add("is-active");
      launchConfetti();
    });

    try {
      const logs = await loadLogs();
      renderLogs(logs);
    } catch (error) {
      console.error(error);
      showError();
    } finally {
      setBusy(false);
    }

    const closeButton = overlay.querySelector(".briefing-close");
    closeButton?.focus({ preventScroll: true });
  }

  trigger.addEventListener("click", () => {
    void openOverlay();
  });

  closeTargets.forEach((control) => {
    control.addEventListener("click", (event) => {
      event.preventDefault();
      closeOverlay();
    });
  });
}

function initBirthdayPing() {
  const pingButton = document.querySelector(".ghost-cta");
  const hologram = document.querySelector(".hero-hologram");
  const frame = hologram?.querySelector(".holo-frame");
  if (!pingButton || !hologram || !frame) return;

  let resetTimer;

  const triggerAnimation = () => {
    hologram.classList.remove("is-animating");
    // Force a reflow so the animation can be retriggered even if it is already active.
    void hologram.offsetWidth;
    hologram.classList.add("is-animating");

    window.clearTimeout(resetTimer);
    resetTimer = window.setTimeout(() => {
      hologram.classList.remove("is-animating");
    }, 2900);
  };

  pingButton.addEventListener("click", triggerAnimation);

  frame.addEventListener("animationend", (event) => {
    if (event.animationName !== "frameLift") return;
    window.clearTimeout(resetTimer);
    hologram.classList.remove("is-animating");
  });
}

function stampYear() {
  const yearEl = document.querySelector("[data-year]");
  if (yearEl) {
    yearEl.textContent = new Date().getFullYear();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const deckEl = document.querySelector(".game-deck");
  renderDeck(deckEl);
  setupStatus(deckEl);
  setupNavigation(deckEl);
  wireKeyboardScroll(deckEl);
  syncDeckMode(deckEl);
  initBriefingLogs();
  stampYear();
  initBirthdayPing();
});

