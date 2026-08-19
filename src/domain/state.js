import {
  CORE_TASKS,
  DEFAULT_ENERGY,
  HISTORY_LIMIT,
  STAT_NAMES,
} from "./catalog.js";
import { dayStamp } from "./time.js";
import { reportFor } from "./reports.js";
import { lockRewardIfReady } from "./rewards.js";

function freshTask(item) {
  return {
    id: `core:${item.key}`,
    ...item,
    done: false,
    custom: false,
  };
}

export function createFreshState() {
  const stats = Object.fromEntries(STAT_NAMES.map((name) => [name, 0]));
  return {
    meta: {
      schema: 15,
      day: dayStamp(),
      revision: 1,
      updatedAt: Date.now(),
    },
    profile: {
      name: "邱顯明",
      xp: 0,
      coins: 0,
      wisdom: 0,
      energy: DEFAULT_ENERGY,
      stats,
      totalTasks: 0,
      totalCoins: 0,
      recoveryUsedDay: "",
    },
    today: {
      tasks: CORE_TASKS.map(freshTask),
      todos: [],
      tomorrow: [],
      backlog: [],
      food: [],
      creditedTaskIds: [],
      coinEarned: 0,
      xpEarned: 0,
      rewardCard: null,
      message: "新村落已建立。今天先讓火種亮起來。",
    },
    rewards: {
      boosts: [],
      coupons: [],
      usage: [],
      funds: { debt: 0, trip: 0, home: 0 },
      villageHistory: [],
    },
    health: {
      calorieTarget: 1900,
      warningLimit: 2000,
      currentWeight: 94,
      goalWeight: 69,
      heightCm: 176,
      weightHistory: [],
    },
    principles: {
      reflections: [],
      book: [],
      bosses: [],
    },
    history: {
      reports: [],
      fireLog: [],
    },
  };
}

export function ensureCoreTasks(tasks) {
  const existing = new Map((tasks || []).map((task) => [task.key, task]));
  const repaired = CORE_TASKS.map((definition) => {
    const found = existing.get(definition.key);
    if (!found) return freshTask(definition);
    return { ...freshTask(definition), ...found, custom: false };
  });
  const custom = (tasks || []).filter((task) => task.custom);
  return [...repaired, ...custom];
}

function unfinishedAsBacklog(state) {
  const old = state.today.todos
    .filter((todo) => !todo.done)
    .map((todo) => ({ ...todo, done: false, carriedFrom: state.meta.day }));
  return [...old, ...state.today.backlog].slice(0, 100);
}

export function advanceToToday(state) {
  const today = dayStamp();
  if (state.meta.day === today) return state;

  const report = reportFor(state);
  const lit = report.taskDone + report.todoDone > 0;
  const archivedReward = state.today.rewardCard
    ? {
        day: state.meta.day,
        title: state.today.rewardCard.title,
        pool: state.today.rewardCard.pool,
        status: state.today.rewardCard.claimed ? "已領取" : "未領取",
      }
    : null;

  const movedTomorrow = state.today.tomorrow.map((todo) => ({
    ...todo,
    done: false,
    carriedFrom: "",
  }));

  const next = {
    ...state,
    meta: {
      ...state.meta,
      day: today,
      revision: state.meta.revision + 1,
      updatedAt: Date.now(),
    },
    profile: {
      ...state.profile,
      energy: DEFAULT_ENERGY,
      recoveryUsedDay: "",
    },
    today: {
      tasks: ensureCoreTasks(state.today.tasks).map((task) => ({ ...task, done: false })),
      todos: movedTomorrow,
      tomorrow: [],
      backlog: unfinishedAsBacklog(state),
      food: [],
      creditedTaskIds: [],
      coinEarned: 0,
      xpEarned: 0,
      rewardCard: null,
      message: "昨天已封存。明日待辦已搬進今天。",
    },
    rewards: {
      ...state.rewards,
      boosts: state.rewards.boosts.filter((item) => Number(item.remaining || 0) > 0),
      coupons: state.rewards.coupons.filter((item) => item.expiresAt >= today && Number(item.remaining || 0) > 0),
      villageHistory: archivedReward
        ? [archivedReward, ...state.rewards.villageHistory].slice(0, HISTORY_LIMIT)
        : state.rewards.villageHistory,
    },
    history: {
      reports: [report, ...state.history.reports].slice(0, HISTORY_LIMIT),
      fireLog: [{ day: state.meta.day, lit }, ...state.history.fireLog.filter((x) => x.day !== state.meta.day)].slice(0, HISTORY_LIMIT),
    },
  };
  return lockRewardIfReady(next);
}

export function sanitizeState(candidate) {
  const base = createFreshState();
  if (!candidate || candidate.meta?.schema !== 15) return base;

  const merged = {
    ...base,
    ...candidate,
    meta: { ...base.meta, ...candidate.meta, schema: 15 },
    profile: {
      ...base.profile,
      ...candidate.profile,
      stats: { ...base.profile.stats, ...(candidate.profile?.stats || {}) },
    },
    today: { ...base.today, ...candidate.today },
    rewards: { ...base.rewards, ...candidate.rewards, funds: { ...base.rewards.funds, ...(candidate.rewards?.funds || {}) } },
    health: { ...base.health, ...candidate.health },
    principles: { ...base.principles, ...candidate.principles },
    history: { ...base.history, ...candidate.history },
  };

  merged.today.tasks = ensureCoreTasks(merged.today.tasks);
  return advanceToToday(merged);
}