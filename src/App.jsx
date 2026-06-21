import React, { useEffect, useMemo, useState } from "react";

// v11 起固定使用同一個存檔名稱，後續版本不要改。
const STORAGE_KEY = "life-leveling-main-save";

const LEGACY_STORAGE_KEYS = [
  "life-leveling-v10-auto-report",
  "life-leveling-v9-record-history",
  "life-leveling-v8-battle-report",
  "life-leveling-v7-growth",
  "life-leveling-v6-offline",
  "life-leveling-v5-pwa",
];

const DEFAULT_TASKS = [
  {
    id: "survival",
    taskKey: "survival",
    title: "今日保命開局",
    desc: "喝水、洗臉、打開 App。先讓今天不要斷線。",
    standard: "完成：有喝水、洗臉或打開 App。漂亮完成：順手整理今天第一件事。",
    group: "主線",
    type: "保命任務",
    difficulty: "E",
    coins: 20,
    exp: 10,
    energy: 1,
    attr: "心力",
    attrExp: 10,
    done: false,
  },
  {
    id: "uber",
    taskKey: "uber",
    title: "現金流出車",
    desc: "完成一趟 UberEats，或至少上線接單。目的不是爆賺，是讓現金流不要斷。",
    standard: "完成：上線或完成一趟。漂亮完成：跑滿 2 小時，或今天收入超過 300。",
    group: "主線",
    type: "UberEats",
    difficulty: "C",
    coins: 60,
    exp: 35,
    energy: 12,
    attr: "財力",
    attrExp: 22,
    done: false,
  },
  {
    id: "estate",
    taskKey: "estate",
    title: "房仲不斷線",
    desc: "完成任一件房仲小事：整理客戶、打一通電話、回覆客戶、看社區行情、發短貼文都可以。",
    standard: "完成：碰一件房仲小事。漂亮完成：有實際聯絡客戶、更新資料或產出貼文。",
    group: "主線",
    type: "房仲業務",
    difficulty: "C",
    coins: 70,
    exp: 40,
    energy: 10,
    attr: "財力",
    attrExp: 25,
    done: false,
  },
  {
    id: "family",
    taskKey: "family",
    title: "家庭羈絆",
    desc: "陪老婆或小孩 10 分鐘，或幫家裡做一件小事。",
    standard: "完成：有陪伴或幫忙。漂亮完成：主動讓家人更輕鬆一點。",
    group: "支線",
    type: "家庭守護",
    difficulty: "D",
    coins: 35,
    exp: 20,
    energy: 4,
    attr: "家庭",
    attrExp: 20,
    done: false,
  },
  {
    id: "finance",
    taskKey: "finance",
    title: "財務偵查",
    desc: "記帳一次，知道今天錢流去哪裡就好，不用完美。",
    standard: "完成：記一筆帳。漂亮完成：把今天主要支出都記完。",
    group: "支線",
    type: "還債理財",
    difficulty: "D",
    coins: 35,
    exp: 20,
    energy: 3,
    attr: "財力",
    attrExp: 15,
    done: false,
  },
  {
    id: "fitness",
    taskKey: "fitness",
    title: "簡易健身",
    desc: "伏地挺身、深蹲、散步、伸展都算。重點不是練壯，是讓身體不要停機。",
    standard: "完成：運動 5 分鐘。漂亮完成：運動 15 分鐘以上。",
    group: "支線",
    type: "體能訓練",
    difficulty: "D",
    coins: 40,
    exp: 25,
    energy: 5,
    attr: "體力",
    attrExp: 20,
    done: false,
  },
  {
    id: "low-pressure",
    taskKey: "low-pressure",
    title: "隨機事件：低壓前進",
    desc: "今天任選一件 5 分鐘小事完成：整理桌面、拍素材、讀一頁書、走路 5 分鐘都可以。",
    standard: "完成：做一件 5 分鐘小事。漂亮完成：做完後狀態變清爽一點。",
    group: "隨機",
    type: "開寶箱",
    difficulty: "D",
    coins: 30,
    exp: 15,
    energy: 3,
    attr: "心力",
    attrExp: 12,
    done: false,
  },
];

// v11 經濟系統：小獎每天一次、中獎每週兩次、大獎七天冷卻、基金不設冷卻。
const DEFAULT_REWARDS = [
  {
    id: "reward-1",
    title: "無罪惡感滑手機 15 分鐘",
    cost: 30,
    tag: "小爽",
    tier: "小獎",
    isSystem: true,
  },
  {
    id: "reward-2",
    title: "看小說 30 分鐘",
    cost: 60,
    tag: "小爽",
    tier: "小獎",
    isSystem: true,
  },
  {
    id: "reward-3",
    title: "打電動 1 小時",
    cost: 180,
    tag: "娛樂",
    tier: "中獎",
    isSystem: true,
  },
  {
    id: "reward-4",
    title: "300 元內美食",
    cost: 450,
    tag: "美食",
    tier: "中獎",
    isSystem: true,
  },
  {
    id: "reward-6",
    title: "去打撞球一次",
    cost: 350,
    tag: "娛樂",
    tier: "中獎",
    isSystem: true,
  },
  {
    id: "reward-5",
    title: "真正想吃的餐廳",
    cost: 750,
    tag: "真爽",
    tier: "大獎",
    isSystem: true,
  },
  {
    id: "reward-big-2",
    title: "撞球＋美食半日放鬆",
    cost: 800,
    tag: "真爽",
    tier: "大獎",
    isSystem: true,
  },
  {
    id: "reward-big-3",
    title: "完整娛樂日",
    cost: 900,
    tag: "真爽",
    tier: "大獎",
    isSystem: true,
  },
  {
    id: "reward-7",
    title: "還債基金 +100 元",
    cost: 800,
    tag: "人生目標",
    tier: "目標基金",
    cashValue: 100,
    isSystem: true,
  },
  {
    id: "reward-8",
    title: "家庭小旅行基金 +100 元",
    cost: 1000,
    tag: "家庭",
    tier: "目標基金",
    cashValue: 100,
    isSystem: true,
  },
  {
    id: "reward-9",
    title: "三房兩廳基金 +100 元",
    cost: 1200,
    tag: "人生目標",
    tier: "目標基金",
    cashValue: 100,
    isSystem: true,
  },
];

const ENERGY_OPTIONS = [
  { label: "滿血", value: 100, desc: "今天可以挑戰比較多事件。" },
  { label: "普通", value: 70, desc: "適合穩定推進。" },
  { label: "有點累", value: 50, desc: "事件減量，先不斷線。" },
  { label: "快不行", value: 30, desc: "啟動保命模式。" },
  { label: "崩潰邊緣", value: 15, desc: "只求今天不要完全消失。" },
];

const ATTR_META = {
  體力: { short: "體", titles: ["身體重新開機", "能撐住一天", "體力開始回來", "穩定行動者", "耐力型玩家"] },
  智力: { short: "智", titles: ["開始恢復手感", "法條修煉者", "讀書戰線推進中", "穩定學習者", "知識型玩家"] },
  財力: { short: "財", titles: ["開始掌握現金流", "還債戰線士兵", "現金流守門人", "收入推進者", "財務穩定者"] },
  家庭: { short: "家", titles: ["家庭火種守護者", "穩定陪伴者", "家人可靠隊友", "家庭守護者", "家庭核心支柱"] },
  心力: { short: "心", titles: ["火種微弱但還在", "低潮也能回來", "心力守門人", "抗壓修復者", "不斷線的人"] },
  魅力: { short: "魅", titles: ["開始被看見", "專業存在感提升", "個人品牌萌芽", "穩定曝光者", "信任感建立者"] },
};

const PLAYER_TITLES = [
  { level: 1, title: "剛點燃火種的人" },
  { level: 2, title: "沒有斷線的男人" },
  { level: 3, title: "開始穩定前進" },
  { level: 4, title: "生活節奏修復中" },
  { level: 5, title: "現金流守門人" },
  { level: 6, title: "家庭守護型房仲勇者" },
  { level: 7, title: "低潮也能推進的人" },
  { level: 8, title: "穩定輸出者" },
  { level: 9, title: "人生打怪老手" },
  { level: 10, title: "三房兩廳遠征者" },
  { level: 12, title: "家業雙線推進者" },
  { level: 15, title: "人生主線開拓者" },
];

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function parseDateKey(dateKey) {
  const [y, m, d] = String(dateKey || todayKey()).split("-").map(Number);
  return new Date(y || 2000, (m || 1) - 1, d || 1);
}

function weekKey(dateKey = todayKey()) {
  const date = parseDateKey(dateKey);
  const weekday = date.getDay();
  const diffToMonday = weekday === 0 ? 6 : weekday - 1;
  date.setDate(date.getDate() - diffToMonday);
  return todayKey(date);
}

function dayDifference(fromKey, toKey = todayKey()) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const fromUtc = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toUtc = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toUtc - fromUtc) / 86400000);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParse(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function loadSavedState() {
  const current = safeParse(localStorage.getItem(STORAGE_KEY));
  if (current) return current;

  for (const key of LEGACY_STORAGE_KEYS) {
    const legacy = safeParse(localStorage.getItem(key));
    if (legacy) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(legacy));
      return legacy;
    }
  }

  return null;
}

function createInitialState() {
  return {
    day: todayKey(),
    coins: 0,
    exp: 0,
    energy: 70,
    todayCoins: 0,
    todayExp: 0,
    totalTasks: 0,
    totalCoinsEarned: 0,
    settledDays: 0,
    fireLog: [],
    reportHistory: [],
    redemptionHistory: [],
    goalFunds: {},
    lastReport: "尚未有自動戰報。",
    message: "v11 經濟平衡版：小獎每日一次、中獎每週兩次、大獎七天冷卻。",
    tasks: clone(DEFAULT_TASKS),
    rewards: clone(DEFAULT_REWARDS),
    attrs: { 體力: 0, 智力: 0, 財力: 0, 家庭: 0, 心力: 0, 魅力: 0 },
  };
}

function isSameDefaultTask(task, base) {
  return (
    task?.taskKey === base.taskKey ||
    task?.title === base.title ||
    String(task?.id) === String(base.id)
  );
}

function mergeTasks(savedTasks) {
  const source = Array.isArray(savedTasks) ? savedTasks : [];

  const defaults = DEFAULT_TASKS.map((base) => {
    const old = source.find((task) => isSameDefaultTask(task, base));
    return old ? { ...base, done: Boolean(old.done) } : clone(base);
  });

  const customTasks = source.filter(
    (task) => !DEFAULT_TASKS.some((base) => isSameDefaultTask(task, base))
  );

  return [...defaults, ...customTasks];
}

function isSameDefaultReward(reward, base) {
  return String(reward?.id) === String(base.id) || reward?.title === base.title;
}

function normalizeReward(reward) {
  const tier = reward?.tier || "小獎";
  return {
    id: reward?.id || `reward-${Date.now()}`,
    title: reward?.title || "未命名獎勵",
    cost: Number(reward?.cost || 0),
    tag: reward?.tag || "小爽",
    tier,
    cashValue: Number(reward?.cashValue || 0),
    isSystem: Boolean(reward?.isSystem),
  };
}

function mergeRewards(savedRewards) {
  const source = Array.isArray(savedRewards) ? savedRewards : [];

  const defaults = DEFAULT_REWARDS.map((base) => {
    const old = source.find((reward) => isSameDefaultReward(reward, base));
    return old ? { ...base, isSystem: true } : clone(base);
  });

  const customs = source
    .filter((reward) => !DEFAULT_REWARDS.some((base) => isSameDefaultReward(reward, base)))
    .map((reward) => ({ ...normalizeReward(reward), isSystem: false }));

  return [...defaults, ...customs];
}

function normalizeReportHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && item.date)
    .map((item) => ({
      ...item,
      title: item.title || "尚未開局",
      done: Number(item.done || 0),
      total: Number(item.total || 0),
      coins: Number(item.coins || 0),
      exp: Number(item.exp || 0),
      text: item.text || item.report || "",
    }));
}

function normalizeRedemptionHistory(history) {
  if (!Array.isArray(history)) return [];

  return history
    .filter((item) => item && item.date)
    .map((item) => ({
      id: item.id || `history-${item.date}-${item.title || "reward"}`,
      date: item.date,
      rewardId: item.rewardId || "",
      title: item.title || "未命名獎勵",
      tier: item.tier || "小獎",
      cost: Number(item.cost || 0),
      cashValue: Number(item.cashValue || 0),
    }))
    .slice(0, 300);
}

function normalizeState(raw) {
  const initial = createInitialState();
  const state = { ...initial, ...(raw || {}) };

  state.day = typeof state.day === "string" ? state.day : todayKey();
  state.tasks = mergeTasks(state.tasks);
  state.rewards = mergeRewards(state.rewards);
  state.attrs = { ...initial.attrs, ...(state.attrs || {}) };
  state.fireLog = Array.isArray(state.fireLog) ? state.fireLog : [];
  state.reportHistory = normalizeReportHistory(state.reportHistory);
  state.redemptionHistory = normalizeRedemptionHistory(state.redemptionHistory);
  state.goalFunds = state.goalFunds && typeof state.goalFunds === "object" ? state.goalFunds : {};

  [
    "coins",
    "exp",
    "energy",
    "todayCoins",
    "todayExp",
    "totalTasks",
    "totalCoinsEarned",
    "settledDays",
  ].forEach((key) => {
    state[key] = Number(state[key] || 0);
  });

  if (state.energy <= 0) state.energy = 70;

  return state;
}

function getPlayerTitle(level) {
  let title = PLAYER_TITLES[0].title;
  PLAYER_TITLES.forEach((item) => {
    if (level >= item.level) title = item.title;
  });
  return title;
}

function getNextPlayerTitle(level) {
  return PLAYER_TITLES.find((item) => item.level > level) || null;
}

function attrLevel(value) {
  return Math.floor(Number(value || 0) / 50) + 1;
}

function attrTitle(name, value) {
  const titles = ATTR_META[name]?.titles || ["正在成長"];
  return titles[Math.min(titles.length - 1, attrLevel(value) - 1)];
}

function getDailyTitle(tasks) {
  const done = tasks.filter((task) => task.done).length;
  const uber = tasks.some((task) => task.type === "UberEats" && task.done);
  const estate = tasks.some((task) => task.type === "房仲業務" && task.done);
  const family = tasks.some((task) => task.type === "家庭守護" && task.done);
  const fitness = tasks.some((task) => task.type === "體能訓練" && task.done);

  if (tasks.length > 0 && done === tasks.length) return "今日全清";
  if (uber && estate && family && fitness) return "四線守住者";
  if (uber && estate && family) return "三線守住者";
  if (uber && estate) return "雙線推進者";
  if (fitness) return "身體有開機";
  if (estate) return "房仲戰線未斷";
  if (uber) return "現金流有接住";
  if (done >= 3) return "今天有穩住";
  if (done >= 1) return "火種未滅";
  return "尚未開局";
}

function getBattleMessage(tasks) {
  const done = tasks.filter((task) => task.done).length;
  const total = tasks.length;
  const uber = tasks.some((task) => task.type === "UberEats" && task.done);
  const estate = tasks.some((task) => task.type === "房仲業務" && task.done);
  const family = tasks.some((task) => task.type === "家庭守護" && task.done);
  const fitness = tasks.some((task) => task.type === "體能訓練" && task.done);

  if (total > 0 && done === total) return "今日全清，狀態漂亮。你不是靠爆發，是靠把每條線都接住。";
  if (uber && estate && family && fitness) return "四線守住：現金流、房仲、家庭、身體都有碰到。";
  if (uber && estate && family) return "今日節奏很好：現金流、房仲、家庭都有碰到。";
  if (uber && estate) return "雙線推進成功：今天現金流與房仲都沒有斷。";
  if (fitness) return "身體有開機。哪怕只動 5 分鐘，也是在防止自己停機。";
  if (done >= 3) return "今天有穩住。不是大爆發，但節奏有回來。";
  if (done >= 1) return "火種未滅。至少有做一件事，今天就不是歸零。";
  return "還沒開局。先完成一個 E 級事件，今天就不算完全掉線。";
}

function buildReport(state) {
  const done = state.tasks.filter((task) => task.done).length;
  const title = getDailyTitle(state.tasks);
  const mainLines = state.tasks
    .filter((task) => task.group === "主線")
    .map((task) => `- ${task.title}：${task.done ? "完成" : "未完成"}`)
    .join("\n");
  const supportLines = state.tasks
    .filter((task) => task.group !== "主線")
    .map((task) => `- ${task.title}：${task.done ? "完成" : "未完成"}`)
    .join("\n");

  const text = [
    `日期：${state.day}`,
    `完成事件：${done}/${state.tasks.length}`,
    `今日金幣：+${state.todayCoins}`,
    `今日 EXP：+${state.todayExp}`,
    "",
    "今日主線：",
    mainLines || "- 尚無主線任務",
    "",
    "支線與隨機：",
    supportLines || "- 尚無支線任務",
    "",
    `今日稱號：${title}`,
    `系統評語：${getBattleMessage(state.tasks)}`,
  ].join("\n");

  return {
    date: state.day,
    title,
    done,
    total: state.tasks.length,
    coins: Number(state.todayCoins || 0),
    exp: Number(state.todayExp || 0),
    text,
  };
}

function archiveDay(state) {
  const report = buildReport(state);
  const alreadyExists = state.reportHistory.some((item) => item.date === state.day);

  const reportHistory = [
    report,
    ...state.reportHistory.filter((item) => item.date !== state.day),
  ].slice(0, 100);

  const fireLog = [
    ...state.fireLog.filter((item) => item.date !== state.day),
    { date: state.day, done: report.done > 0 },
  ].slice(-30);

  return {
    ...state,
    reportHistory,
    fireLog,
    lastReport: report.text,
    settledDays: alreadyExists ? state.settledDays : state.settledDays + 1,
  };
}

function rolloverToToday(state) {
  const archived = archiveDay(state);
  const title = buildReport(state).title;

  return {
    ...archived,
    day: todayKey(),
    tasks: clone(DEFAULT_TASKS),
    energy: 70,
    todayCoins: 0,
    todayExp: 0,
    message: `昨天的戰報已自動保存：${title}。今天從一個小事件開始。`,
  };
}

function getLast7FireLog(fireLog) {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = todayKey(date);
    const item = fireLog.find((log) => log.date === key);

    return {
      date: key,
      label: `${date.getMonth() + 1}/${date.getDate()}`,
      done: Boolean(item?.done),
    };
  });
}

function difficultyClass(level) {
  const map = {
    E: "bg-slate-100 text-slate-700",
    D: "bg-emerald-100 text-emerald-700",
    C: "bg-blue-100 text-blue-700",
    B: "bg-amber-100 text-amber-700",
    A: "bg-rose-100 text-rose-700",
  };
  return map[level] || map.E;
}

function groupClass(group) {
  const map = {
    主線: "bg-amber-100 text-amber-800",
    支線: "bg-blue-100 text-blue-700",
    隨機: "bg-purple-100 text-purple-700",
  };
  return map[group] || "bg-slate-100 text-slate-700";
}

function tierClass(tier) {
  const map = {
    小獎: "bg-emerald-100 text-emerald-800",
    中獎: "bg-blue-100 text-blue-800",
    大獎: "bg-amber-100 text-amber-800",
    目標基金: "bg-purple-100 text-purple-800",
  };
  return map[tier] || "bg-slate-100 text-slate-700";
}

function taskToneClass(group, done) {
  if (done) return "bg-emerald-950/60 border-emerald-500/80";
  if (group === "主線") return "bg-slate-800 border-amber-400/35";
  if (group === "隨機") return "bg-slate-800 border-purple-400/35";
  return "bg-slate-800 border-slate-700";
}

function rewardRuleText(tier) {
  if (tier === "小獎") return "規則：全體小獎每日最多兌換 1 次。";
  if (tier === "中獎") return "規則：全體中獎每週最多兌換 2 次。";
  if (tier === "大獎") return "規則：兌換任一大獎後，所有大獎冷卻 7 天。";
  return "目標基金：兌換後，建議真的把對應現金轉入專用帳戶。";
}

function getRewardStatus(reward, redemptionHistory) {
  const tier = reward.tier || "小獎";
  const today = todayKey();

  if (tier === "小獎") {
    const count = redemptionHistory.filter(
      (item) => item.tier === "小獎" && item.date === today
    ).length;

    return count >= 1
      ? { allowed: false, reason: "今天的小獎已兌換過，明天再換。" }
      : { allowed: true, reason: "今天還可兌換 1 次小獎。" };
  }

  if (tier === "中獎") {
    const currentWeek = weekKey(today);
    const count = redemptionHistory.filter(
      (item) => item.tier === "中獎" && weekKey(item.date) === currentWeek
    ).length;

    return count >= 2
      ? { allowed: false, reason: "本週中獎已兌換 2 次，下週再來。" }
      : { allowed: true, reason: `本週還可兌換 ${2 - count} 次中獎。` };
  }

  if (tier === "大獎") {
    const latest = redemptionHistory
      .filter((item) => item.tier === "大獎")
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

    if (!latest) return { allowed: true, reason: "大獎可兌換。" };

    const elapsed = dayDifference(latest.date, today);
    if (elapsed < 7) {
      return {
        allowed: false,
        reason: `大獎冷卻中，還要 ${7 - elapsed} 天。`,
      };
    }

    return { allowed: true, reason: "大獎冷卻結束，可兌換。" };
  }

  return { allowed: true, reason: "可兌換，並建議同步做真實資金轉移。" };
}

function getTierUsage(redemptionHistory) {
  const today = todayKey();
  const thisWeek = weekKey(today);
  const smallToday = redemptionHistory.filter(
    (item) => item.tier === "小獎" && item.date === today
  ).length;
  const mediumWeek = redemptionHistory.filter(
    (item) => item.tier === "中獎" && weekKey(item.date) === thisWeek
  ).length;
  const latestBig = redemptionHistory
    .filter((item) => item.tier === "大獎")
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];

  const bigRemain = latestBig ? Math.max(0, 7 - dayDifference(latestBig.date, today)) : 0;

  return {
    smallToday,
    mediumWeek,
    bigRemain,
  };
}

function groupRewardsByTier(rewards) {
  const order = ["小獎", "中獎", "大獎", "目標基金"];
  return order.map((tier) => ({
    tier,
    rewards: rewards.filter((reward) => reward.tier === tier),
  }));
}

export default function LifeLevelingAppPrototype() {
  const [state, setState] = useState(() => {
    const loaded = normalizeState(loadSavedState());
    return loaded.day === todayKey() ? loaded : rolloverToToday(loaded);
  });

  const [tab, setTab] = useState("today");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [rewardFormOpen, setRewardFormOpen] = useState(false);
  const [expandedReportDate, setExpandedReportDate] = useState("");
  const [newTask, setNewTask] = useState({
    title: "",
    coins: 30,
    group: "支線",
    attr: "心力",
  });
  const [newReward, setNewReward] = useState({
    title: "",
    cost: 60,
    tag: "小爽",
    tier: "小獎",
    cashValue: 0,
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    function checkDate() {
      setState((previous) => {
        if (previous.day === todayKey()) return previous;
        return rolloverToToday(previous);
      });
    }

    const intervalId = window.setInterval(checkDate, 60 * 1000);

    function onVisibilityChange() {
      if (document.visibilityState === "visible") checkDate();
    }

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const completedTasks = state.tasks.filter((task) => task.done);
  const isSurvival = state.energy <= 30;

  const visibleTasks = useMemo(() => {
    if (!isSurvival) return state.tasks;

    return state.tasks.filter(
      (task) =>
        task.group === "主線" ||
        task.type === "保命任務" ||
        task.type === "體能訓練"
    );
  }, [state.tasks, isSurvival]);

  const usedEnergy = completedTasks.reduce(
    (sum, task) => sum + Number(task.energy || 0),
    0
  );
  const remainingEnergy = Math.max(0, state.energy - usedEnergy);
  const level = Math.floor(state.exp / 100) + 1;
  const expInLevel = state.exp % 100;
  const nextExp = 100 - expInLevel;
  const nextTitle = getNextPlayerTitle(level);
  const dailyTitle = getDailyTitle(state.tasks);
  const battleMessage = getBattleMessage(state.tasks);
  const todayPreview = buildReport(state);
  const tierUsage = getTierUsage(state.redemptionHistory);
  const rewardGroups = groupRewardsByTier(state.rewards);
  const maxDailyCoins = DEFAULT_TASKS.reduce((sum, task) => sum + task.coins, 0);
  const reserveHint = Math.floor(state.coins * 0.3);

  function patch(updater) {
    setState((previous) => {
      const current = previous.day === todayKey() ? previous : rolloverToToday(previous);
      return typeof updater === "function" ? updater(current) : { ...current, ...updater };
    });
  }

  function completeTask(id) {
    patch((previous) => {
      const task = previous.tasks.find((item) => item.id === id);
      if (!task || task.done) return previous;

      return {
        ...previous,
        tasks: previous.tasks.map((item) =>
          item.id === id ? { ...item, done: true } : item
        ),
        coins: previous.coins + Number(task.coins || 0),
        exp: previous.exp + Number(task.exp || 0),
        todayCoins: previous.todayCoins + Number(task.coins || 0),
        todayExp: previous.todayExp + Number(task.exp || 0),
        totalTasks: previous.totalTasks + 1,
        totalCoinsEarned: previous.totalCoinsEarned + Number(task.coins || 0),
        attrs: {
          ...previous.attrs,
          [task.attr]: Number(previous.attrs[task.attr] || 0) + Number(task.attrExp || 10),
        },
        message: `完成「${task.title}」：+${task.coins} 金幣，${task.attr} +${task.attrExp || 10}。`,
      };
    });
  }

  function deleteTask(id) {
    patch((previous) => ({
      ...previous,
      tasks: previous.tasks.filter((task) => task.id !== id),
      message: "已刪除一個事件。",
    }));
  }

  function repairTasks() {
    patch((previous) => ({
      ...previous,
      tasks: mergeTasks(previous.tasks),
      message: "已修復預設任務，簡易健身也已補回。",
    }));
    setTab("today");
  }

  function addTask() {
    const title = newTask.title.trim();
    if (!title) return;

    const coins = Number(newTask.coins || 30);
    const id = `custom-${Date.now()}`;

    patch((previous) => ({
      ...previous,
      tasks: [
        ...previous.tasks,
        {
          id,
          taskKey: id,
          title,
          desc: "自訂事件：由你自己指定完成條件。",
          standard: "完成：照你自己設定的條件完成即可。",
          group: newTask.group,
          type: "自訂事件",
          difficulty: coins >= 70 ? "B" : coins >= 40 ? "C" : "D",
          coins,
          exp: coins,
          energy: 5,
          attr: newTask.attr,
          attrExp: Math.max(8, Math.round(coins / 2)),
          done: false,
        },
      ],
      message: `已新增事件：「${title}」。`,
    }));

    setNewTask({ title: "", coins: 30, group: "支線", attr: "心力" });
    setTaskFormOpen(false);
  }

  function addReward() {
    const title = newReward.title.trim();
    if (!title) return;

    const id = `reward-${Date.now()}`;
    patch((previous) => ({
      ...previous,
      rewards: [
        ...previous.rewards,
        {
          id,
          title,
          cost: Number(newReward.cost || 60),
          tag: newReward.tag || "小爽",
          tier: newReward.tier || "小獎",
          cashValue: Number(newReward.cashValue || 0),
          isSystem: false,
        },
      ],
      message: `已新增 ${newReward.tier}：「${title}」。`,
    }));

    setNewReward({ title: "", cost: 60, tag: "小爽", tier: "小獎", cashValue: 0 });
    setRewardFormOpen(false);
  }

  function deleteReward(id) {
    patch((previous) => ({
      ...previous,
      rewards: previous.rewards.filter((reward) => reward.id !== id),
      message: "已刪除自訂獎勵。",
    }));
  }

  function redeemReward(reward) {
    patch((previous) => {
      const status = getRewardStatus(reward, previous.redemptionHistory);

      if (!status.allowed) {
        return { ...previous, message: status.reason };
      }

      if (previous.coins < reward.cost) {
        return {
          ...previous,
          message: `金幣還差 ${reward.cost - previous.coins}，先打一個小事件就好。`,
        };
      }

      const record = {
        id: `redeem-${Date.now()}`,
        date: todayKey(),
        rewardId: reward.id,
        title: reward.title,
        tier: reward.tier || "小獎",
        cost: Number(reward.cost || 0),
        cashValue: Number(reward.cashValue || 0),
      };

      const nextGoalFunds = { ...previous.goalFunds };
      if (reward.tier === "目標基金") {
        nextGoalFunds[reward.id] = Number(nextGoalFunds[reward.id] || 0) + Number(reward.cashValue || 0);
      }

      const goalMessage = reward.tier === "目標基金"
        ? `已兌換：${reward.title}。記得真的把 ${reward.cashValue || 0} 元移到對應基金。`
        : `已兌換：${reward.title}。這是你賺來的。`;

      return {
        ...previous,
        coins: previous.coins - Number(reward.cost || 0),
        redemptionHistory: [record, ...previous.redemptionHistory].slice(0, 300),
        goalFunds: nextGoalFunds,
        message: goalMessage,
      };
    });
  }

  function useRecoveryCard() {
    patch((previous) => ({
      ...previous,
      message: "恢復卡已啟用：今天可以休息、降速、睡覺，不用再拿金幣交換休息資格。",
    }));
  }

  function resetTodayTasks() {
    if (!window.confirm("確定重置今天任務？今天的完成狀態會清空。")) return;

    patch((previous) => ({
      ...previous,
      tasks: clone(DEFAULT_TASKS),
      energy: 70,
      todayCoins: 0,
      todayExp: 0,
      message: "今日任務已重置。跨日後會自動保存當天紀錄。",
    }));
  }

  function hardReset() {
    if (!window.confirm("確定全部重來？金幣、等級、歷史戰報、獎勵紀錄都會清空。")) return;
    setState(createInitialState());
    setTab("today");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 bg-slate-900 sm:rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800">
        <header className="p-5 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_38%),linear-gradient(135deg,#1e293b,#020617)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">人生打怪村 v11 經濟平衡版</p>
              <h1 className="text-3xl font-black tracking-tight mt-1">邱顯明 Lv.{level}</h1>
              <div className="inline-flex mt-2 px-3 py-1 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-300 text-sm font-bold">
                {getPlayerTitle(level)}
              </div>
              <p className="text-xs text-slate-500 mt-2">{state.day}</p>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-amber-400/15 border border-amber-300/40 flex items-center justify-center shadow-[0_0_28px_rgba(251,191,36,0.18)]">
              <span className="text-3xl font-black text-amber-300">火</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="金幣" value={state.coins} />
            <StatCard label="能量" value={remainingEnergy} />
            <StatCard label="完成" value={`${completedTasks.length}/${visibleTasks.length}`} />
          </div>

          <div className="mt-5 bg-slate-950/40 border border-slate-700/70 rounded-3xl p-4">
            <div className="flex justify-between text-xs text-slate-400 mb-2">
              <span>角色升級</span>
              <span>{expInLevel}/100 EXP，還差 {nextExp}</span>
            </div>
            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-amber-300 to-yellow-400" style={{ width: `${expInLevel}%` }} />
            </div>
            <p className="text-xs text-slate-400 mt-3">
              下一稱號：
              <span className="text-amber-300 font-bold ml-1">
                {nextTitle ? `${nextTitle.title}（Lv.${nextTitle.level}）` : "已達目前最高稱號"}
              </span>
            </p>
          </div>
        </header>

        <div className="p-4 pb-2">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)]">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm text-slate-300">今日戰報</p>
              <span className="text-xs px-2 py-1 rounded-full bg-amber-300/15 text-amber-300 border border-amber-300/20">{dailyTitle}</span>
            </div>
            <p className="text-base font-bold text-white leading-relaxed">{battleMessage}</p>
            <p className="text-xs text-slate-500 mt-3">自動封存已開啟：跨日後，昨天的紀錄會自動保存。</p>
            {isSurvival && <p className="text-sm text-amber-300 mt-2">保命模式已啟動：今天只要求不斷線。</p>}
          </div>
        </div>

        <nav className="px-4 grid grid-cols-3 gap-2 pb-2 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          {[
            ["today", "今日"],
            ["energy", "能量"],
            ["reward", "獎勵"],
            ["record", "紀錄"],
            ["role", "角色"],
            ["settings", "設定"],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-2xl px-3 py-3 text-sm font-black transition ${tab === key ? "bg-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.22)]" : "bg-slate-800 text-slate-300 border border-slate-700"}`}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="p-4 pb-24">
          {tab === "today" && (
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">今日事件</h2>
                <button onClick={resetTodayTasks} className="text-slate-300 rounded-full px-3 py-2 hover:bg-slate-800 flex items-center gap-1">↻ 重置</button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm text-slate-300 leading-relaxed">
                正常日目標約 150～220 金幣；全部完成上限 {maxDailyCoins}。今天不用全清，只求主線不掉線。
              </div>

              {visibleTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={completeTask} onDelete={deleteTask} />
              ))}

              <button
                onClick={() => setTaskFormOpen((value) => !value)}
                className="w-full rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 flex items-center justify-center gap-2 border border-slate-700"
              >
                ＋ 新增自訂事件
              </button>

              {taskFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <Input label="事件名稱" value={newTask.title} onChange={(value) => setNewTask({ ...newTask, title: value })} placeholder="例如：打給一位老客戶" />
                  <Input label="金幣" type="number" value={newTask.coins} onChange={(value) => setNewTask({ ...newTask, coins: value })} />
                  <Select label="分類" value={newTask.group} onChange={(value) => setNewTask({ ...newTask, group: value })} options={["主線", "支線", "隨機"]} />
                  <Select label="成長屬性" value={newTask.attr} onChange={(value) => setNewTask({ ...newTask, attr: value })} options={Object.keys(ATTR_META)} />
                  <button onClick={addTask} className="w-full bg-amber-300 text-slate-950 rounded-2xl py-3 font-black">加入事件</button>
                </div>
              )}
            </section>
          )}

          {tab === "energy" && (
            <section className="space-y-3">
              <h2 className="text-2xl font-black">今天的能量</h2>
              <p className="text-slate-400 text-sm">先承認狀態，再安排事件。狀態低不是失敗，是換打法。</p>

              {ENERGY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => patch({ energy: option.value, message: option.value <= 30 ? "已切換成保命模式，今天只求不斷線。" : `今日能量設定為 ${option.value}。` })}
                  className={`w-full text-left rounded-3xl border p-4 flex justify-between items-center ${state.energy === option.value ? "bg-amber-300 text-slate-950 border-amber-200" : "bg-slate-800 text-slate-100 border-slate-700"}`}
                >
                  <div>
                    <h3 className="font-black">{option.label}</h3>
                    <p className={`text-sm ${state.energy === option.value ? "text-slate-700" : "text-slate-400"}`}>{option.desc}</p>
                  </div>
                  <div className="text-3xl font-black">{option.value}</div>
                </button>
              ))}

              <div className="bg-emerald-950/40 border border-emerald-700 rounded-3xl p-4">
                <h3 className="font-black text-emerald-200">恢復卡：不用花金幣</h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">睡覺、躺平、看醫生、減量，不是獎勵，也不需要先賺到資格。能量低時直接啟用。</p>
                <button onClick={useRecoveryCard} className="w-full mt-3 rounded-2xl bg-emerald-300 text-emerald-950 h-11 font-black">啟用恢復卡</button>
              </div>
            </section>
          )}

          {tab === "reward" && (
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">獎勵商店</h2>
                <button onClick={() => setRewardFormOpen((value) => !value)} className="rounded-full bg-slate-800 px-3 py-2 text-sm border border-slate-700">＋ 新增</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <InfoBox label="建議保留" value={`${reserveHint} 金幣`} note="約現有金幣的 30%" />
                <InfoBox label="今日收入" value={`+${state.todayCoins}`} note="正常日 150～220" />
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">本期兌換額度</h3>
                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <MiniRule label="小獎" value={`${tierUsage.smallToday}/1`} note="今天" />
                  <MiniRule label="中獎" value={`${tierUsage.mediumWeek}/2`} note="本週" />
                  <MiniRule label="大獎" value={tierUsage.bigRemain ? `${tierUsage.bigRemain}天` : "可換"} note="冷卻" />
                </div>
              </div>

              {rewardFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <Input label="獎勵名稱" value={newReward.title} onChange={(value) => setNewReward({ ...newReward, title: value })} placeholder="例如：吃一餐牛排" />
                  <Input label="花費金幣" type="number" value={newReward.cost} onChange={(value) => setNewReward({ ...newReward, cost: value })} />
                  <Select label="獎勵層級" value={newReward.tier} onChange={(value) => setNewReward({ ...newReward, tier: value })} options={["小獎", "中獎", "大獎", "目標基金"]} />
                  <Select label="標籤" value={newReward.tag} onChange={(value) => setNewReward({ ...newReward, tag: value })} options={["小爽", "娛樂", "真爽", "美食", "家庭", "人生目標"]} />
                  {newReward.tier === "目標基金" && <Input label="實際轉入金額" type="number" value={newReward.cashValue} onChange={(value) => setNewReward({ ...newReward, cashValue: value })} placeholder="例如：100" />}
                  <button onClick={addReward} className="w-full bg-amber-300 text-slate-950 rounded-2xl py-3 font-black">加入獎勵</button>
                </div>
              )}

              {rewardGroups.map(({ tier, rewards }) => (
                rewards.length > 0 && (
                  <div key={tier} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h3 className="font-black">{tier}</h3>
                      <span className="text-xs text-slate-500">{rewardRuleText(tier)}</span>
                    </div>
                    {rewards.map((reward) => {
                      const status = getRewardStatus(reward, state.redemptionHistory);
                      const goalTotal = Number(state.goalFunds[reward.id] || 0);
                      return (
                        <RewardCard
                          key={reward.id}
                          reward={reward}
                          status={status}
                          goalTotal={goalTotal}
                          onRedeem={redeemReward}
                          onDelete={deleteReward}
                        />
                      );
                    })}
                  </div>
                )
              ))}
            </section>
          )}

          {tab === "record" && (
            <section className="space-y-3">
              <h2 className="text-2xl font-black">自動戰報紀錄</h2>

              <div className="grid grid-cols-3 gap-3">
                <RecordBox label="總事件" value={state.totalTasks} />
                <RecordBox label="總金幣" value={state.totalCoinsEarned} />
                <RecordBox label="封存天" value={state.settledDays} />
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">今天暫存戰報</h3>
                <p className="text-amber-300 text-sm mt-2">{todayPreview.title}</p>
                <p className="text-sm text-slate-400 mt-1">完成 {todayPreview.done}/{todayPreview.total}，目前 +{todayPreview.coins} 金幣 / +{todayPreview.exp} EXP</p>
                <p className="text-xs text-slate-500 mt-2">這筆會在跨日後自動封存到歷史戰報。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">最近 7 天火種</h3>
                <div className="grid grid-cols-7 gap-2 mt-3">
                  {getLast7FireLog(state.fireLog).map((day) => (
                    <div key={day.date} className="bg-slate-950 border border-slate-800 rounded-2xl p-2 text-center">
                      <div className={`font-black ${day.done ? "text-amber-300" : "text-slate-600"}`}>{day.done ? "火" : "○"}</div>
                      <div className="text-[10px] text-slate-500 mt-1">{day.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black mb-3">歷史戰報</h3>
                {state.reportHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">尚未跨日封存。明天第一次打開 App 時，今天的紀錄會自動出現在這裡。</p>
                ) : (
                  <div className="max-h-[28rem] overflow-y-auto space-y-3 pr-1">
                    {state.reportHistory.map((item, index) => {
                      const isOpen = expandedReportDate === item.date;
                      return (
                        <button key={`${item.date}-${index}`} onClick={() => setExpandedReportDate(isOpen ? "" : item.date)} className="w-full text-left border-b border-slate-700 pb-3 last:border-0">
                          <div className="flex justify-between items-center gap-3">
                            <span className="font-bold text-white text-sm">{item.date}</span>
                            <span className="text-slate-400 text-xs shrink-0">完成 {item.done}/{item.total}</span>
                          </div>
                          <div className="text-amber-300 text-sm mt-1">{item.title}</div>
                          <div className="text-slate-500 text-xs mt-1">+{item.coins} 金幣 / +{item.exp} EXP</div>
                          {isOpen && <p className="text-sm text-slate-300 mt-3 whitespace-pre-line leading-relaxed bg-slate-950 rounded-2xl p-3">{item.text}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          )}

          {tab === "role" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-black">角色成長</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 text-center">
                <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-300/30 to-blue-400/20 border border-slate-600 flex items-center justify-center mb-3">
                  <span className="text-3xl font-black text-amber-200">人</span>
                </div>
                <h3 className="text-xl font-black">家庭守護型房仲勇者</h3>
                <p className="text-sm text-amber-300 mt-1">稱號：{getPlayerTitle(level)}</p>
                <p className="text-xs text-slate-400 mt-2">下一稱號：{nextTitle ? `${nextTitle.title}（Lv.${nextTitle.level}）` : "已達目前最高稱號"}</p>
              </div>

              {Object.keys(ATTR_META).map((name) => {
                const value = Number(state.attrs[name] || 0);
                const progress = value % 50;
                return (
                  <div key={name} className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-amber-300 font-black w-5 text-center">{ATTR_META[name].short}</span>
                      <span className="font-black">{name} Lv.{attrLevel(value)}</span>
                      <span className="ml-auto text-slate-400">{value} EXP</span>
                    </div>
                    <h3 className="font-bold">{attrTitle(name, value)}</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-2">下一級還差 {50 - progress} EXP</p>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300" style={{ width: `${progress * 2}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "settings" && (
            <section className="space-y-3">
              <h2 className="text-2xl font-black">設定</h2>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">版本</h3>
                <p className="text-sm text-slate-300 leading-relaxed mt-2">v11 經濟平衡版：每日金幣上限 290，獎勵分小、中、大、目標基金，並加入兌換冷卻與使用額度。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">任務修復</h3>
                <p className="text-sm text-slate-300 leading-relaxed mt-2">如果沒有看到「簡易健身」或某個預設任務，按這個按鈕會補回來。</p>
                <button onClick={repairTasks} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black mt-3">修復今日任務</button>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">資料儲存</h3>
                <p className="text-sm text-slate-300 leading-relaxed mt-2">資料儲存在目前瀏覽器。後續升版都沿用固定主存檔，避免紀錄消失。</p>
              </div>

              <button onClick={hardReset} className="w-full rounded-2xl bg-rose-900/80 text-rose-100 h-12 font-bold">全部重來</button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete, onDelete }) {
  return (
    <div className={`rounded-3xl border p-4 ${taskToneClass(task.group, task.done)}`}>
      <div className="flex gap-3 items-start">
        <button
          onClick={() => onComplete(task.id)}
          className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center border text-lg font-black shrink-0 ${task.done ? "bg-emerald-400 border-emerald-300 text-slate-950" : "border-slate-500 text-slate-500"}`}
        >
          ✓
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex gap-2 mb-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${groupClass(task.group)}`}>{task.group}</span>
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${difficultyClass(task.difficulty)}`}>{task.difficulty} 級</span>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{task.type}</span>
            {task.done && <span className="text-xs px-2 py-1 rounded-full bg-emerald-300 text-emerald-950 font-bold">已完成</span>}
          </div>

          <h3 className={`font-black text-lg ${task.done ? "line-through text-slate-500" : "text-white"}`}>{task.title}</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{task.desc}</p>
          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 mt-2 font-medium leading-relaxed">完成標準：{task.standard}</p>
          <div className="flex gap-3 text-sm text-slate-400 mt-3 flex-wrap">
            <span>+{task.coins} 金幣</span>
            <span>+{task.exp} EXP</span>
            <span>{task.attr} +{task.attrExp}</span>
          </div>
        </div>

        <button onClick={() => onDelete(task.id)} className="text-slate-600 hover:text-rose-400 text-sm p-1 shrink-0">✕</button>
      </div>
    </div>
  );
}

function RewardCard({ reward, status, goalTotal, onRedeem, onDelete }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
      <div className="flex justify-between gap-3">
        <div className="min-w-0">
          <div className="flex gap-2 flex-wrap">
            <span className={`text-xs px-2 py-1 rounded-full font-bold ${tierClass(reward.tier)}`}>{reward.tier}</span>
            <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{reward.tag}</span>
          </div>
          <h3 className="font-black mt-2 break-words">{reward.title}</h3>
          <p className="text-sm text-slate-400 mt-1">需要 {reward.cost} 金幣</p>
          <p className={`text-xs mt-2 ${status.allowed ? "text-emerald-300" : "text-rose-300"}`}>{status.reason}</p>
          {reward.tier === "目標基金" && (
            <p className="text-xs text-amber-300 mt-1">已累積換算：{goalTotal} 元</p>
          )}
        </div>

        <div className="flex flex-col gap-2 shrink-0">
          <button
            onClick={() => onRedeem(reward)}
            className={`rounded-2xl px-3 py-2 font-black ${status.allowed ? "bg-amber-300 text-slate-950" : "bg-slate-700 text-slate-400"}`}
          >
            兌換
          </button>
          {!reward.isSystem && <button onClick={() => onDelete(reward.id)} className="rounded-2xl bg-slate-700 text-slate-300 px-3 py-2">刪</button>}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 text-center">
      <p className="text-xs text-slate-500 font-bold">{label}</p>
      <p className="text-xl font-black text-white mt-1">{value}</p>
    </div>
  );
}

function RecordBox({ label, value }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center">
      <p className="text-xs text-slate-500 font-bold">{label}</p>
      <p className="text-lg font-black text-white mt-1">{value}</p>
    </div>
  );
}

function InfoBox({ label, value, note }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-black text-lg mt-1">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{note}</p>
    </div>
  );
}

function MiniRule({ label, value, note }) {
  return (
    <div className="bg-slate-950 border border-slate-800 rounded-2xl p-2">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className="font-black mt-1">{value}</p>
      <p className="text-[10px] text-slate-500 mt-1">{note}</p>
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-amber-400"
      />
    </div>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-amber-400"
      >
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </div>
  );
}
