import { signInAnonymously } from "firebase/auth";
import { get, ref } from "firebase/database";
import { authClient, databaseClient } from "../config/firebase.js";
import { createFreshState, sanitizeState } from "../domain/state.js";
import { principleStage } from "../domain/principles.js";

const ORIGINAL_MAIN_PATH = "sharedSave";
const ORIGINAL_BACKUP_PATH = "sharedBackups";

const taskKeyMap = {
  survival: "lifeline",
  uber: "delivery",
  estate: "brokerage",
  family: "family",
  finance: "money",
  fitness: "movement",
  "calorie-guard": "calorie",
  "low-pressure": "tiny-step",
};

const rewardIdMap = {
  "entertainment-block": "screen-time",
  billiards: "pool-table",
  "family-outdoor": "family-halfday",
  "freedom-halfday": "free-halfday",
};

function unwrap(value) {
  if (!value) return null;
  if (value.data && typeof value.data === "object") return value.data;
  return value;
}

function meaningful(raw) {
  if (!raw) return false;
  return Boolean(
    Number(raw.coins || 0) ||
    Number(raw.exp || 0) ||
    Number(raw.totalTasks || 0) ||
    (raw.reportHistory || []).length ||
    (raw.reflectionHistory || []).length ||
    (raw.principles || []).length ||
    (raw.weightHistory || []).length > 1
  );
}

async function ensureAuth() {
  if (authClient.currentUser) return;
  await signInAnonymously(authClient);
}

async function readBestOriginalRecord() {
  await ensureAuth();

  const liveSnap = await get(ref(databaseClient, ORIGINAL_MAIN_PATH));
  const liveEnvelope = liveSnap.exists() ? liveSnap.val() : null;
  const liveData = unwrap(liveEnvelope);

  if (meaningful(liveData)) {
    return {
      raw: liveData,
      source: "原始共用主檔",
      changedAt: Number(liveEnvelope?.updatedAt || 0),
    };
  }

  const backupSnap = await get(ref(databaseClient, ORIGINAL_BACKUP_PATH));
  if (!backupSnap.exists()) return null;

  const backups = backupSnap.val() || {};
  const candidates = Object.entries(backups)
    .map(([key, value]) => ({
      key,
      envelope: value,
      raw: unwrap(value),
      changedAt: Number(value?.updatedAt || key || 0),
    }))
    .filter((item) => meaningful(item.raw))
    .sort((a, b) => b.changedAt - a.changedAt);

  if (!candidates.length) return null;

  return {
    raw: candidates[0].raw,
    source: "原始雲端備份",
    changedAt: candidates[0].changedAt,
  };
}

function mapTodo(item, prefix) {
  return {
    id: `${prefix}:${item?.id || crypto.randomUUID()}`,
    title: `${item?.title || ""}`.trim(),
    category: item?.category || "生活",
    done: Boolean(item?.done),
    createdAt: item?.createdAt ? new Date(item.createdAt).getTime() || Date.now() : Date.now(),
    carriedFrom: item?.carriedFrom || "",
  };
}

function mapRewardEffect(effect = {}) {
  if (effect.kind === "bonusCoins") {
    return {
      type: "boost",
      amount: Number(effect.amount || 20),
      lanes: Array.isArray(effect.eligibleGroups) ? effect.eligibleGroups : ["支線", "隨機"],
    };
  }

  if (effect.kind === "coupon") {
    return {
      type: "coupon",
      target: rewardIdMap[effect.targetId] || effect.targetId,
      amount: Number(effect.amount || 0),
      days: Number(effect.expiresInDays || 7),
    };
  }

  return { type: "ritual" };
}

function mapDailyReward(item) {
  if (!item?.title) return null;
  return {
    id: item.id || crypto.randomUUID(),
    title: item.title,
    detail: item.description || item.desc || item.villageLine || "",
    pool: item.pool || "small",
    effect: mapRewardEffect(item.effect),
    locked: Boolean(item.locked || item.claimed),
    claimed: Boolean(item.claimed),
    lockedAt: item.lockedAt || "",
    claimedAt: item.claimedAt || "",
  };
}

function mapReports(items = []) {
  return items.map((item) => ({
    day: item.date || item.day || "",
    title: item.title || "歷史戰報",
    taskDone: Number(item.done ?? item.taskDone ?? 0),
    taskTotal: Number(item.total ?? item.taskTotal ?? 0),
    todoDone: Number(item.todoDone || 0),
    todoTotal: Number(item.todoTotal || 0),
    tomorrowTotal: Number(item.tomorrowTotal || 0),
    calorieTotal: Number(item.calorieTotal || 0),
    calorieTarget: Number(item.calorieTarget || 1900),
    rewardTitle: item.rewardTitle || "",
    insightTitle: item.villageInsightTitle || item.insightTitle || "",
    coins: Number(item.coins || 0),
    xp: Number(item.exp || item.xp || 0),
    text: item.report || item.text || "",
  })).filter((item) => item.day);
}

function mapReflections(raw) {
  const source = [...(raw.reflectionHistory || [])];

  const today = raw.dailyReflection;
  if (
    today &&
    (today.didRight || today.stuck || today.nextRule || today.bossTag) &&
    !source.some((item) => item.date === today.date && item.savedAt === today.savedAt)
  ) {
    source.unshift(today);
  }

  return source.map((item) => ({
    id: crypto.randomUUID(),
    day: item.date || raw.day || "",
    keep: item.didRight || "",
    obstacle: item.stuck || "",
    retry: item.nextRule || "",
    problemTag: item.bossTag || "",
    createdAt: item.savedAt ? new Date(item.savedAt).getTime() || Date.now() : Date.now(),
  }));
}

function mapPrinciples(items = []) {
  return items.map((item) => {
    const checks = Math.max(Number(item.xp || 0), (item.usageDates || []).length);
    return {
      id: `${item.id || crypto.randomUUID()}`,
      title: item.title || "未命名原則",
      rule: item.title || "",
      checks,
      stage: principleStage(checks),
      createdAt: item.createdAt ? new Date(item.createdAt).getTime() || Date.now() : Date.now(),
      lastCheckedAt: item.usageDates?.length
        ? new Date(`${item.usageDates[item.usageDates.length - 1]}T12:00:00`).getTime()
        : 0,
    };
  });
}

function mapBosses(items = []) {
  return items.map((item) => ({
    id: `${item.id || crypto.randomUUID()}`,
    tag: item.name || "未命名問題",
    count: Math.max(1, (item.dates || []).length),
    status: item.status === "defeated" ? "defeated" : "active",
    createdAt: item.firstSeen ? new Date(`${item.firstSeen}T12:00:00`).getTime() : Date.now(),
    solvedAt: item.status === "defeated"
      ? (item.lastSeen ? new Date(`${item.lastSeen}T12:00:00`).getTime() : Date.now())
      : 0,
  }));
}

export function convertOriginalRecord(raw) {
  const base = createFreshState();

  const oldTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
  const currentByKey = new Map(base.today.tasks.map((task) => [task.key, task]));
  const idMap = new Map();
  const usedCurrent = new Set();
  const tasks = [];

  for (const oldTask of oldTasks) {
    const oldKey = oldTask.taskKey || oldTask.id;
    const newKey = taskKeyMap[oldKey];

    if (newKey && currentByKey.has(newKey)) {
      const current = currentByKey.get(newKey);
      const converted = { ...current, done: Boolean(oldTask.done) };
      tasks.push(converted);
      usedCurrent.add(newKey);
      idMap.set(String(oldTask.id), converted.id);
      idMap.set(String(oldKey), converted.id);
      continue;
    }

    const customId = `imported:${oldTask.id || crypto.randomUUID()}`;
    const converted = {
      id: customId,
      key: customId,
      title: oldTask.title || "匯入事件",
      detail: oldTask.desc || "由原始紀錄匯入。",
      criterion: oldTask.standard || "依原本設定完成。",
      lane: oldTask.group || "支線",
      type: oldTask.type || "自訂事件",
      rank: oldTask.difficulty || "D",
      coins: Number(oldTask.coins || 30),
      xp: Number(oldTask.exp || oldTask.coins || 30),
      energyCost: Number(oldTask.energy || 5),
      stat: oldTask.attr || "心力",
      statXp: Number(oldTask.attrExp || 10),
      done: Boolean(oldTask.done),
      custom: true,
    };
    tasks.push(converted);
    idMap.set(String(oldTask.id), customId);
  }

  for (const current of base.today.tasks) {
    if (!usedCurrent.has(current.key)) tasks.push(current);
  }

  const rewarded = (raw.taskRewardedIds || [])
    .map((id) => idMap.get(String(id)) || idMap.get(String(taskKeyMap[id])) || "")
    .filter(Boolean);

  const sourceDay = raw.day || base.meta.day;

  const converted = {
    ...base,
    meta: {
      ...base.meta,
      day: sourceDay,
      revision: Number(base.meta.revision || 0) + 1,
      updatedAt: Date.now(),
    },
    profile: {
      ...base.profile,
      name: "邱顯明",
      xp: Number(raw.exp || 0),
      coins: Number(raw.coins || 0),
      wisdom: Number(raw.wisdom || 0),
      energy: Number(raw.energy || 70),
      stats: { ...base.profile.stats, ...(raw.attrs || {}) },
      totalTasks: Number(raw.totalTasks || 0),
      totalCoins: Number(raw.totalCoinsEarned || 0),
      recoveryUsedDay: raw.recoveryUsedDay || "",
    },
    today: {
      ...base.today,
      tasks,
      todos: (raw.todos || []).map((item) => mapTodo(item, "today")),
      tomorrow: (raw.tomorrowTodos || []).map((item) => ({ ...mapTodo(item, "tomorrow"), done: false })),
      backlog: (raw.backlogTodos || []).map((item) => ({ ...mapTodo(item, "backlog"), done: false })),
      food: (raw.foodEntries || []).map((item) => ({
        id: `food:${crypto.randomUUID()}`,
        name: item.name || "",
        kcal: Number(item.calories || 0),
        meal: item.mealType || "早餐",
        createdAt: item.createdAt ? new Date(item.createdAt).getTime() || Date.now() : Date.now(),
      })).filter((item) => item.name && item.kcal > 0),
      creditedTaskIds: rewarded,
      coinEarned: Number(raw.todayCoins || 0),
      xpEarned: Number(raw.todayExp || 0),
      rewardCard: mapDailyReward(raw.dailyReward),
      message: "原始雲端紀錄已成功匯入 v15。",
    },
    rewards: {
      ...base.rewards,
      boosts: (raw.pendingBoosts || []).map((item) => ({
        id: item.id || crypto.randomUUID(),
        title: item.title || "原始加成",
        amount: Number(item.amount || 20),
        lanes: item.eligibleGroups || ["支線", "隨機"],
        remaining: Number(item.remaining || 1),
      })),
      coupons: (raw.coupons || []).map((item) => ({
        id: item.id || crypto.randomUUID(),
        title: item.title || "原始折扣券",
        target: rewardIdMap[item.targetId] || item.targetId,
        amount: Number(item.amount || 0),
        remaining: Number(item.remaining || 1),
        expiresAt: item.expiresAt || sourceDay,
      })),
      usage: (raw.rewardUsage || []).map((item) => ({
        id: item.id || crypto.randomUUID(),
        rewardId: rewardIdMap[item.rewardId] || item.rewardId,
        tier: item.level || item.tier || "",
        day: item.date || item.day || sourceDay,
        cost: Number(item.cost || 0),
      })),
      funds: {
        debt: Number(raw.goalFunds?.debt || 0),
        trip: Number(raw.goalFunds?.travel || 0),
        home: Number(raw.goalFunds?.housing || 0),
      },
      villageHistory: (raw.villageRewardHistory || []).map((item) => ({
        day: item.date || item.day || "",
        title: item.title || "",
        pool: item.pool || "",
        status: item.status || "",
      })).filter((item) => item.day),
    },
    health: {
      ...base.health,
      calorieTarget: Number(raw.calorieTarget || 1900),
      warningLimit: Number(raw.calorieWarningLimit || 2000),
      currentWeight: Number(raw.currentWeight || 94),
      goalWeight: Number(raw.goalWeight || 69),
      heightCm: Number(raw.heightCm || 176),
      weightHistory: (raw.weightHistory || []).map((item) => ({
        day: item.date || item.day || "",
        weight: Number(item.weight || 0),
      })).filter((item) => item.day && item.weight > 0),
    },
    principles: {
      reflections: mapReflections(raw),
      book: mapPrinciples(raw.principles || []),
      bosses: mapBosses(raw.bossBook || []),
    },
    history: {
      reports: mapReports(raw.reportHistory || []),
      fireLog: (raw.fireLog || []).map((item) => ({
        day: item.date || item.day || "",
        lit: Boolean(item.done ?? item.lit),
      })).filter((item) => item.day),
    },
  };

  return sanitizeState(converted);
}

export async function recoverOriginalCloudRecord() {
  const found = await readBestOriginalRecord();
  if (!found) {
    throw new Error("Firebase 裡找不到可用的原始主檔或備份。");
  }

  const state = convertOriginalRecord(found.raw);
  return {
    state,
    source: found.source,
    changedAt: found.changedAt,
    summary: {
      coins: state.profile.coins,
      xp: state.profile.xp,
      wisdom: state.profile.wisdom,
      reports: state.history.reports.length,
      reflections: state.principles.reflections.length,
      principles: state.principles.book.length,
      bosses: state.principles.bosses.length,
      weights: state.health.weightHistory.length,
    },
  };
}
