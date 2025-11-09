const shell = document.querySelector(".oracle-shell");
const form = document.querySelector("#askForm");
const input = document.querySelector("#promptInput");
const askButton = form?.querySelector(".ask-button");
const avatar = document.querySelector("#ronAvatar");
const responseStage = document.querySelector(".response-stage");
const responseOrb = document.querySelector(".response-orb");
const responseText = document.querySelector("#responseText");

const idleAvatar = avatar?.dataset.idle;
const activeAvatar = avatar?.dataset.active;
const answersSource = "./img/answers";
let answersCache;

const setAvatarState = (state) => {
  if (!avatar) return;
  const desiredSrc = state === "active" ? activeAvatar : idleAvatar;
  if (desiredSrc && avatar.getAttribute("src") !== desiredSrc) {
    avatar.setAttribute("src", desiredSrc);
  }
};

const setButtonState = (isLoading) => {
  if (!askButton) return;
  if (isLoading) {
    askButton.setAttribute("data-state", "loading");
    askButton.disabled = true;
  } else {
    askButton.removeAttribute("data-state");
    askButton.disabled = false;
  }
};

const clearErrorState = () => {
  shell?.classList.remove("has-error");
};

const showError = (message) => {
  if (!responseText || !responseStage || !responseOrb) return;
  shell?.classList.add("has-error");
  responseStage.classList.remove("is-loading");
  responseStage.classList.remove("is-ready");
  responseText.textContent = message;
  revealResponse();
};

const revealResponse = (text) => {
  if (!responseOrb || !responseText) return;
  if (typeof text === "string") {
    responseText.textContent = text;
  }
  responseOrb.classList.remove("is-visible");
  responseOrb.classList.add("is-revealing");
  void responseOrb.offsetWidth;
  responseOrb.classList.remove("is-revealing");
  responseOrb.classList.add("is-visible");
};

const setLoadingState = (isLoading) => {
  if (!responseStage) return;
  if (isLoading) {
    responseStage.classList.add("is-loading");
    responseStage.classList.remove("is-ready");
    shell?.classList.add("is-asking");
  } else {
    responseStage.classList.remove("is-loading");
    shell?.classList.remove("is-asking");
  }
};

const loadAnswers = async () => {
  if (Array.isArray(answersCache) && answersCache.length) {
    return answersCache;
  }

  const response = await fetch(answersSource, { cache: "no-cache" });
  if (!response.ok) {
    throw new Error("הענן של רון לא מגיש תשובות כרגע.");
  }

  const text = await response.text();
  const parsed = text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
    .filter(Boolean);

  if (!parsed.length) {
    throw new Error("רון שכח את כל התשובות שלו. נסו שוב מאוחר יותר.");
  }

  answersCache = parsed;
  return answersCache;
};

const pickAnswer = (answers) => {
  if (!Array.isArray(answers) || !answers.length) {
    throw new Error("אין תשובות זמינות.");
  }
  const index = Math.floor(Math.random() * answers.length);
  return answers[index];
};

const handleSubmit = async (event) => {
  event.preventDefault();
  clearErrorState();

  const prompt = (input?.value || "").trim();
  if (!prompt) {
    showError("לפחות תזרקו מילה. רון לא קורא מחשבות, רק מקנטר.");
    return;
  }

  setButtonState(true);
  setLoadingState(true);
  setAvatarState("active");
  revealResponse("העשן מתעבה...");

  if (responseStage) {
    responseStage.classList.remove("is-ready");
  }

  try {
    const answers = await loadAnswers();
    const answer = pickAnswer(answers);
    revealResponse(answer);
    responseStage?.classList.add("is-ready");
    shell?.classList.add("has-response");
  } catch (error) {
    console.error(error);
    showError(error.message ?? "רון נעלם בעננים. נסו שוב מאוחר יותר.");
  } finally {
    setButtonState(false);
    setLoadingState(false);
    setTimeout(() => setAvatarState("idle"), 480);
  }
};

if (form) {
  form.addEventListener("submit", handleSubmit);
}

if (input) {
  input.addEventListener("input", () => {
    if (shell?.classList.contains("has-error")) {
      clearErrorState();
    }
  });
}

if (document.readyState === "complete") {
  input?.focus({ preventScroll: true });
} else {
  window.addEventListener("load", () => input?.focus({ preventScroll: true }));
}

