import { createFreshState, sanitizeState } from "../domain/state.js";

const STATE_KEY = "life-village-v15-state";
const INSTALL_KEY = "life-village-v15-clean-install";

function firstRunCleanup() {
  if (localStorage.getItem(INSTALL_KEY) === "yes") return;
  localStorage.clear();
  localStorage.setItem(INSTALL_KEY, "yes");
}

export function loadState() {
  firstRunCleanup();
  try {
    const raw = localStorage.getItem(STATE_KEY);
    return sanitizeState(raw ? JSON.parse(raw) : createFreshState());
  } catch {
    return createFreshState();
  }
}

export function persistState(state) {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}

export function eraseLocalState() {
  localStorage.removeItem(STATE_KEY);
}