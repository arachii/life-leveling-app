import React, { useEffect, useMemo, useState } from "react";

/*
 * 人生打怪村 v12：待辦整合＋村長每日賞賜
 *
 * 設計原則：
 * 1. 人生主線仍給金幣；每日待辦不給金幣，只累積村民印記（每日最多 3 枚）。
 * 2. 每天一張「村長封印賞賜卡」；完成條件後解鎖，再手動領取。
 * 3. 這是本地規則式 AI 村長：不需要 API Key、不會暴露金鑰，也可先驗證是否有感。
 * 4. 繼續沿用固定存檔 key，不切斷 v9～v11 的紀錄。
 */

const STORAGE_KEY = "life-leveling-main-save";
const DAILY_COIN_CAP = 300;
const MAX_REPORTS = 100;

const OLD_STORAGE_KEYS = [
  "life-leveling-v11-economy",
  "life-leveling-v10-auto-report",
  "life-leveling-v9-record-history",
  "life-leveling-v8-battle-report",
  "life-leveling-v7-growth",
  "life-leveling-v6-offline",
  "life-leveling-v5-pwa",
];

function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function loadSavedState() {
  const main = safeParse(localStorage.getItem(STORAGE_KEY));
  if (main) return main;

  for (const key of OLD_STORAGE_KEYS) {
    const old = safeParse(localStorage.getItem(key));
    if (old) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(old));
      return old;
    }
  }

  return null;
}

const defaultTasks = [
  {
    id: "survival",
    taskKey: "survival",
    title: "今日保命開局",
    desc: "喝水、洗臉、打開 App。先讓今天不要斷線。",
    standard: "完成：有喝水、洗臉或打開 App。漂亮完成：順手安排今天第一件小事。",
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
    desc: "整理客戶、打一通電話、回覆客戶、看社區行情、發短貼文，任一件都算。",
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
    standard: "完成：記一筆帳。漂亮完成：把主要支出都記完。",
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
    desc: "今天任選一件 5 分鐘小事：整理桌面、拍素材、讀一頁書、走路 5 分鐘都可以。",
    standard: "完成：做一件 5 分鐘小事。漂亮完成：做完後真的讓狀態更清爽。",
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

const rewardShop = [
  {
    id: "billiards",
    title: "去打撞球一次",
    desc: "把撞球當作有意識的放鬆，而不是逃避。",
    level: "中獎",
    cost: 350,
    weeklyLimit: 1,
    cooldownDays: 0,
  },
  {
    id: "treat-meal",
    title: "300 元內自己想吃的一餐",
    desc: "不是亂花，是把一段努力過成有感的日子。",
    level: "中獎",
    cost: 450,
    weeklyLimit: 1,
    cooldownDays: 0,
  },
  {
    id: "family-halfday",
    title: "家庭半日行程",
    desc: "陪伴、出門、走走，讓努力最後回到家。",
    level: "大獎",
    cost: 750,
    weeklyLimit: 0,
    cooldownDays: 7,
  },
  {
    id: "freedom-halfday",
    title: "半日自由時段",
    desc: "安排一段真正由你決定的時間。",
    level: "大獎",
    cost: 800,
    weeklyLimit: 0,
    cooldownDays: 7,
  },
];

const goalFundsMeta = [
  { id: "debt", title: "還債基金", cost: 800, cashValue: 100, hint: "兌換後，真實把 100 元移去還債。" },
  { id: "travel", title: "家庭小旅行基金", cost: 1000, cashValue: 100, hint: "兌換後，真實把 100 元留到旅行帳。" },
  { id: "housing", title: "三房兩廳基金", cost: 1200, cashValue: 100, hint: "兌換後，真實把 100 元移到長期目標。" },
];

const energyOptions = [
  { label: "滿血", value: 100, desc: "今天可以挑戰比較多事件。" },
  { label: "普通", value: 70, desc: "適合穩定推進。" },
  { label: "有點累", value: 50, desc: "事件減量，先不斷線。" },
  { label: "快不行", value: 30, desc: "啟動保命模式。" },
  { label: "崩潰邊緣", value: 15, desc: "只求今天不要完全消失。" },
];

const attrMeta = {
  體力: { short: "體", titles: ["身體重新開機", "能撐住一天", "體力開始回來", "穩定行動者", "耐力型玩家"] },
  智力: { short: "智", titles: ["開始恢復手感", "法條修煉者", "讀書戰線推進中", "穩定學習者", "知識型玩家"] },
  財力: { short: "財", titles: ["開始掌握現金流", "還債戰線士兵", "現金流守門人", "收入推進者", "財務穩定者"] },
  家庭: { short: "家", titles: ["家庭火種守護者", "穩定陪伴者", "家人可靠隊友", "家庭守護者", "家庭核心支柱"] },
  心力: { short: "心", titles: ["火種微弱但還在", "低潮也能回來", "心力守門人", "抗壓修復者", "不斷線的人"] },
  魅力: { short: "魅", titles: ["開始被看見", "專業存在感提升", "個人品牌萌芽", "穩定曝光者", "信任感建立者"] },
};

const playerTitles = [
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

const rewardPools = {
  recovery: [
    {
      id: "handpan-ritual",
      title: "手碟放空儀式",
      description: "今晚獲得 15 分鐘安靜時間：聽手碟、泡茶、躺著放空都可以，但不滑短影音。",
      villageLine: "今天村長不加碼。你把自己穩住，就已經是前進。",
      effect: { kind: "ritual" },
    },
    {
      id: "early-sleep",
      title: "提早收工權",
      description: "今晚可提早 30 分鐘收工，不補進度、不檢討，只做恢復。",
      villageLine: "火種不是靠硬燒，是靠知道什麼時候該補柴。",
      effect: { kind: "ritual" },
    },
    {
      id: "slow-walk",
      title: "慢走清空權",
      description: "今晚可散步 20 分鐘，不算任務，不追步數，只讓腦袋降速。",
      villageLine: "你不是機器。把腦袋空一點，明天才有位置放重要的事。",
      effect: { kind: "ritual" },
    },
  ],
  small: [
    {
      id: "novel-pass",
      title: "小說探索權",
      description: "今晚可安心看小說 30 分鐘，看到時間到就收，不需要再責怪自己。",
      villageLine: "不是每一段時間都要有產值；有些時間是為了讓你撐得更久。",
      effect: { kind: "ritual" },
    },
    {
      id: "game-pass",
      title: "一局遊戲權",
      description: "今晚可安排一局完整遊戲，不邊玩邊焦慮待辦。",
      villageLine: "把娛樂做得乾淨，才不會變成偷來的逃避。",
      effect: { kind: "ritual" },
    },
    {
      id: "drink-pass",
      title: "50 元內小飲料權",
      description: "今天可買一杯 50 元內的飲料或小點心，慢慢喝，不用拿來配焦慮。",
      villageLine: "小小的甜，是提醒你：今天也有好好活著。",
      effect: { kind: "ritual" },
    },
    {
      id: "episode-pass",
      title: "一集影集權",
      description: "今晚可選一集影集或節目，好好看完，不一邊滑手機。",
      villageLine: "真正的休息，不是資訊塞滿，是把注意力放回一件喜歡的事。",
      effect: { kind: "ritual" },
    },
  ],
  boost: [
    {
      id: "tomorrow-support-boost",
      title: "明日支線加成券",
      description: "明天完成第一件支線或隨機任務時，額外 +20 金幣。",
      villageLine: "今天的節奏會替明天鋪路，村長給你一點順風。",
      effect: { kind: "bonusCoins", amount: 20, eligibleGroups: ["支線", "隨機"], remaining: 1 },
    },
    {
      id: "tomorrow-main-boost",
      title: "明日主線加成券",
      description: "明天完成第一件主線任務時，額外 +20 金幣。",
      villageLine: "把主線做穩的人，值得一點真正能往前推的加成。",
      effect: { kind: "bonusCoins", amount: 20, eligibleGroups: ["主線"], remaining: 1 },
    },
  ],
  ticket: [
    {
      id: "billiards-coupon",
      title: "撞球折扣券",
      description: "7 天內兌換「去打撞球一次」時，少花 100 金幣。",
      villageLine: "你有把日子推進，週末就該有一段真正屬於自己的球桌時間。",
      effect: { kind: "coupon", targetId: "billiards", amount: 100, expiresInDays: 7 },
    },
    {
      id: "meal-coupon",
      title: "美食折扣券",
      description: "7 天內兌換「300 元內自己想吃的一餐」時，少花 100 金幣。",
      villageLine: "努力不只要還債，也要偶爾嚐到自己在往前的味道。",
      effect: { kind: "coupon", targetId: "treat-meal", amount: 100, expiresInDays: 7 },
    },
  ],
};

function hashString(input) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicPick(items, seed) {
  return items[seed % items.length];
}

function rewardPoolFromDate(day) {
  const value = hashString(`${day}-v12-village`) % 100;
  if (value < 35) return "recovery";
  if (value < 75) return "small";
  if (value < 90) return "boost";
  return "ticket";
}

function createDailyReward(day = todayKey()) {
  const poolName = rewardPoolFromDate(day);
  const pool = rewardPools[poolName];
  const item = deterministicPick(pool, hashString(`${day}-${poolName}`));

  return {
    ...clone(item),
    date: day,
    pool: poolName,
    claimed: false,
    claimedAt: "",
  };
}

const initialState = {
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
  villageRewardHistory: [],
  lastReport: "尚未有自動戰報。",
  message: "v12 村長模式：主線推進、待辦清空、每天一張封印賞賜卡。",
  tasks: clone(defaultTasks),
  todos: [],
  dailyReward: createDailyReward(),
  pendingBoosts: [],
  coupons: [],
  recoveryUsedDay: "",
  rewardUsage: [],
  goalFunds: { debt: 0, travel: 0, housing: 0 },
  rewards: clone(rewardShop),
  rewardSystemVersion: 12,
  attrs: { 體力: 0, 智力: 0, 財力: 0, 家庭: 0, 心力: 0, 魅力: 0 },
};

function getPlayerTitle(level) {
  let title = playerTitles[0].title;
  for (const item of playerTitles) {
    if (level >= item.level) title = item.title;
  }
  return title;
}

function getNextPlayerTitle(level) {
  return playerTitles.find((item) => item.level > level) || null;
}

function attrLevel(value) {
  return Math.floor(Number(value || 0) / 50) + 1;
}

function attrTitle(name, value) {
  const titles = attrMeta[name]?.titles || ["正在成長"];
  return titles[Math.min(titles.length - 1, attrLevel(value) - 1)];
}

function isSameDefaultTask(task, defaultTask) {
  return (
    task?.taskKey === defaultTask.taskKey ||
    task?.title === defaultTask.title ||
    String(task?.id) === String(defaultTask.id)
  );
}

function mergeDefaultTasks(savedTasks) {
  const current = Array.isArray(savedTasks) ? savedTasks : [];
  const merged = defaultTasks.map((defaultTask) => {
    const previous = current.find((task) => isSameDefaultTask(task, defaultTask));
    return previous ? { ...defaultTask, done: Boolean(previous.done) } : clone(defaultTask);
  });

  const custom = current.filter(
    (task) => !defaultTasks.some((defaultTask) => isSameDefaultTask(task, defaultTask))
  );

  return [...merged, ...custom];
}

function normalizeTodo(todo) {
  return {
    id: todo?.id || `todo-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: String(todo?.title || "").trim(),
    category: todo?.category || "生活",
    done: Boolean(todo?.done),
    createdAt: todo?.createdAt || new Date().toISOString(),
  };
}

function normalizeReward(rawReward, day) {
  if (rawReward && rawReward.date === day && rawReward.title) {
    return {
      ...createDailyReward(day),
      ...rawReward,
      effect: rawReward.effect || createDailyReward(day).effect,
      claimed: Boolean(rawReward.claimed),
    };
  }
  return createDailyReward(day);
}

function normalizeState(raw) {
  const state = { ...initialState, ...(raw || {}) };

  state.day = typeof state.day === "string" ? state.day : todayKey();
  state.tasks = mergeDefaultTasks(state.tasks);
  state.todos = Array.isArray(state.todos)
    ? state.todos.map(normalizeTodo).filter((todo) => todo.title)
    : [];
  state.dailyReward = normalizeReward(state.dailyReward, state.day);
  state.pendingBoosts = Array.isArray(state.pendingBoosts) ? state.pendingBoosts : [];
  state.coupons = Array.isArray(state.coupons) ? state.coupons : [];
  state.rewardUsage = Array.isArray(state.rewardUsage) ? state.rewardUsage : [];
  const sourceRewardVersion = Number(raw?.rewardSystemVersion || 0);
  state.rewards = sourceRewardVersion >= 12 && Array.isArray(state.rewards) && state.rewards.length
    ? state.rewards
    : clone(rewardShop);
  state.rewardSystemVersion = 12;
  state.fireLog = Array.isArray(state.fireLog) ? state.fireLog : [];
  state.reportHistory = Array.isArray(state.reportHistory) ? state.reportHistory : [];
  state.villageRewardHistory = Array.isArray(state.villageRewardHistory) ? state.villageRewardHistory : [];
  state.goalFunds = { ...initialState.goalFunds, ...(state.goalFunds || {}) };
  state.attrs = { ...initialState.attrs, ...(state.attrs || {}) };

  ["coins", "exp", "energy", "todayCoins", "todayExp", "totalTasks", "totalCoinsEarned", "settledDays"].forEach((key) => {
    state[key] = Number(state[key] || 0);
  });

  Object.keys(state.goalFunds).forEach((key) => {
    state.goalFunds[key] = Number(state.goalFunds[key] || 0);
  });

  Object.keys(state.attrs).forEach((key) => {
    state.attrs[key] = Number(state.attrs[key] || 0);
  });

  return state;
}

function getMainDoneCount(tasks) {
  return tasks.filter((task) => task.group === "主線" && task.done).length;
}

function getTodoDoneCount(todos) {
  return todos.filter((todo) => todo.done).length;
}

function getSeals(todos) {
  return Math.min(3, getTodoDoneCount(todos));
}

function hasCoreTriple(tasks) {
  const complete = (type) => tasks.some((task) => task.type === type && task.done);
  return complete("UberEats") && complete("房仲業務") && complete("體能訓練");
}

function getRewardUnlock(state) {
  const mainDone = getMainDoneCount(state.tasks);
  const todoDone = getTodoDoneCount(state.todos);
  const coreTriple = hasCoreTriple(state.tasks);

  if (state.energy <= 30) {
    return {
      unlocked: mainDone >= 1 || todoDone >= 1,
      label: "保命解鎖",
      detail: "完成 1 件人生主線或 1 件今日待辦",
      progress: `${Math.min(1, Math.max(mainDone, todoDone))}/1`,
    };
  }

  if (state.energy >= 80) {
    const regular = mainDone >= 2 && todoDone >= 3;
    return {
      unlocked: regular || coreTriple,
      label: "高輸出解鎖",
      detail: "完成 2 件人生主線＋3 件待辦；或完成 UberEats＋房仲＋健身",
      progress: coreTriple ? "核心三線已完成" : `主線 ${mainDone}/2・待辦 ${Math.min(todoDone, 3)}/3`,
    };
  }

  return {
    unlocked: mainDone >= 1 && todoDone >= 2,
    label: "穩定解鎖",
    detail: "完成 1 件人生主線＋2 件今日待辦",
    progress: `主線 ${Math.min(mainDone, 1)}/1・待辦 ${Math.min(todoDone, 2)}/2`,
  };
}

function getDailyTitle(tasks, todos) {
  const done = tasks.filter((task) => task.done).length;
  const todoDone = getTodoDoneCount(todos);
  const uberDone = tasks.some((task) => task.type === "UberEats" && task.done);
  const estateDone = tasks.some((task) => task.type === "房仲業務" && task.done);
  const familyDone = tasks.some((task) => task.type === "家庭守護" && task.done);
  const fitnessDone = tasks.some((task) => task.type === "體能訓練" && task.done);

  if (done === tasks.length && tasks.length > 0 && todoDone >= 3) return "村務全清者";
  if (uberDone && estateDone && familyDone && fitnessDone && todoDone >= 3) return "四線守住者";
  if (uberDone && estateDone && familyDone) return "三線守住者";
  if (uberDone && estateDone) return "雙線推進者";
  if (todoDone >= 3) return "村務清道夫";
  if (fitnessDone) return "身體有開機";
  if (estateDone) return "房仲戰線未斷";
  if (uberDone) return "現金流有接住";
  if (done >= 3 || todoDone >= 2) return "今天有穩住";
  if (done >= 1 || todoDone >= 1) return "火種未滅";
  return "尚未開局";
}

function getBattleMessage(tasks, todos) {
  const done = tasks.filter((task) => task.done).length;
  const todoDone = getTodoDoneCount(todos);
  const uberDone = tasks.some((task) => task.type === "UberEats" && task.done);
  const estateDone = tasks.some((task) => task.type === "房仲業務" && task.done);
  const familyDone = tasks.some((task) => task.type === "家庭守護" && task.done);
  const fitnessDone = tasks.some((task) => task.type === "體能訓練" && task.done);

  if (done === tasks.length && tasks.length > 0 && todoDone >= 3) {
    return "主線、支線、待辦都接住了。今天不是忙亂，是你真的把生活推進。";
  }
  if (uberDone && estateDone && familyDone && fitnessDone) {
    return "現金流、房仲、家庭、身體都有碰到，這是很好的節奏。";
  }
  if (todoDone >= 3 && done >= 1) {
    return "雜事沒有再堆著，你也把主線碰到了。這種日子很有價值。";
  }
  if (uberDone && estateDone) return "雙線推進成功：今天現金流與房仲都沒有斷。";
  if (todoDone >= 3) return "村務清掉三件以上，明天的你會謝謝今天的你。";
  if (done >= 3 || todoDone >= 2) return "今天有穩住。不是大爆發，但節奏有回來。";
  if (done >= 1 || todoDone >= 1) return "火種未滅。至少有推動一件事，今天就不是歸零。";
  return "還沒開局。先完成一個最小事件，讓今天有一個開始。";
}

function buildReport(state) {
  const done = state.tasks.filter((task) => task.done).length;
  const todoDone = getTodoDoneCount(state.todos);
  const title = getDailyTitle(state.tasks, state.todos);
  const comment = getBattleMessage(state.tasks, state.todos);
  const unlock = getRewardUnlock(state);
  const reward = state.dailyReward || createDailyReward(state.day);

  const mainLines = state.tasks
    .filter((task) => task.group === "主線")
    .map((task) => `- ${task.title}：${task.done ? "完成" : "未完成"}`)
    .join("\n");

  const supportLines = state.tasks
    .filter((task) => task.group !== "主線")
    .map((task) => `- ${task.title}：${task.done ? "完成" : "未完成"}`)
    .join("\n");

  const todoLines = state.todos.length
    ? state.todos.map((todo) => `- ${todo.title}：${todo.done ? "完成" : "未完成"}`).join("\n")
    : "- 今日沒有新增待辦";

  const rewardStatus = reward.claimed
    ? `已領取：${reward.title}`
    : unlock.unlocked
      ? `已解鎖但未領取：${reward.title}`
      : "尚未解鎖封印賞賜卡";

  const report = [
    `日期：${state.day}`,
    `完成主線與任務：${done}/${state.tasks.length}`,
    `完成待辦：${todoDone}/${state.todos.length}（村民印記 ${getSeals(state.todos)}/3）`,
    `今日金幣：+${state.todayCoins}`,
    `今日 EXP：+${state.todayExp}`,
    "",
    "人生主線：",
    mainLines || "- 尚無主線任務",
    "",
    "支線與隨機：",
    supportLines || "- 尚無支線任務",
    "",
    "今日待辦：",
    todoLines,
    "",
    `村長賞賜：${rewardStatus}`,
    `今日稱號：${title}`,
    `系統評語：${comment}`,
  ].join("\n");

  return {
    date: state.day,
    title,
    done,
    total: state.tasks.length,
    todoDone,
    todoTotal: state.todos.length,
    seals: getSeals(state.todos),
    coins: state.todayCoins,
    exp: state.todayExp,
    rewardTitle: reward.claimed || unlock.unlocked ? reward.title : "封印賞賜卡",
    rewardClaimed: Boolean(reward.claimed),
    report,
  };
}

function archiveCurrentDay(state) {
  const reportItem = buildReport(state);
  const alreadySaved = state.reportHistory.some((item) => item.date === state.day);
  const unlock = getRewardUnlock(state);
  const reward = state.dailyReward || createDailyReward(state.day);

  const rewardHistoryItem = {
    date: state.day,
    title: reward.claimed || unlock.unlocked ? reward.title : "封印賞賜卡",
    pool: reward.pool,
    status: reward.claimed ? "已領取" : unlock.unlocked ? "已解鎖未領取" : "未解鎖",
  };

  return {
    ...state,
    reportHistory: [reportItem, ...state.reportHistory.filter((item) => item.date !== state.day)].slice(0, MAX_REPORTS),
    fireLog: [
      ...state.fireLog.filter((item) => item.date !== state.day),
      { date: state.day, done: reportItem.done > 0 || reportItem.todoDone > 0 },
    ].slice(-30),
    villageRewardHistory: [
      rewardHistoryItem,
      ...state.villageRewardHistory.filter((item) => item.date !== state.day),
    ].slice(0, MAX_REPORTS),
    lastReport: reportItem.report,
    settledDays: alreadySaved ? state.settledDays : state.settledDays + 1,
  };
}

function dateAfterDays(day, amount) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() + amount);
  return todayKey(date);
}

function isExpiredCoupon(coupon, day = todayKey()) {
  return coupon.expiresAt && coupon.expiresAt < day;
}

function archiveAndStartNewDay(state) {
  const archived = archiveCurrentDay(state);
  const oldTitle = getDailyTitle(state.tasks, state.todos);
  const newDay = todayKey();

  return {
    ...archived,
    day: newDay,
    tasks: clone(defaultTasks),
    todos: [],
    dailyReward: createDailyReward(newDay),
    energy: 70,
    todayCoins: 0,
    todayExp: 0,
    recoveryUsedDay: "",
    coupons: archived.coupons.filter((coupon) => !isExpiredCoupon(coupon, newDay)),
    message: `昨天的戰報已自動保存：${oldTitle}。今天先清一件待辦，再碰一件主線。`,
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
  return {
    E: "bg-slate-100 text-slate-700",
    D: "bg-emerald-100 text-emerald-700",
    C: "bg-blue-100 text-blue-700",
    B: "bg-amber-100 text-amber-700",
    A: "bg-rose-100 text-rose-700",
  }[level] || "bg-slate-100 text-slate-700";
}

function groupClass(group) {
  return {
    主線: "bg-amber-100 text-amber-800",
    支線: "bg-blue-100 text-blue-700",
    隨機: "bg-purple-100 text-purple-700",
  }[group] || "bg-slate-100 text-slate-700";
}

function taskToneClass(group, done) {
  if (done) return "bg-emerald-950/60 border-emerald-500/80 shadow-[0_0_24px_rgba(16,185,129,0.15)]";
  if (group === "主線") return "bg-slate-800 border-amber-400/35";
  if (group === "隨機") return "bg-slate-800 border-purple-400/35";
  return "bg-slate-800 border-slate-700";
}

function todoCategoryClass(category) {
  return {
    工作: "bg-blue-100 text-blue-800",
    家庭: "bg-emerald-100 text-emerald-800",
    生活: "bg-purple-100 text-purple-800",
  }[category] || "bg-slate-100 text-slate-700";
}

function rewardPoolClass(pool) {
  return {
    recovery: "bg-emerald-300/15 text-emerald-200 border-emerald-300/30",
    small: "bg-blue-300/15 text-blue-200 border-blue-300/30",
    boost: "bg-purple-300/15 text-purple-200 border-purple-300/30",
    ticket: "bg-amber-300/15 text-amber-200 border-amber-300/30",
  }[pool] || "bg-slate-300/10 text-slate-200 border-slate-300/20";
}

function poolLabel(pool) {
  return {
    recovery: "恢復賞賜",
    small: "小爽賞賜",
    boost: "行動加成",
    ticket: "中獎資格",
  }[pool] || "村長賞賜";
}

function shopLevelClass(level) {
  if (level === "大獎") return "bg-amber-100 text-amber-800";
  return "bg-blue-100 text-blue-800";
}

function daysBetween(fromDay, toDay = todayKey()) {
  const from = new Date(`${fromDay}T12:00:00`).getTime();
  const to = new Date(`${toDay}T12:00:00`).getTime();
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

function getActiveCoupon(state, rewardId) {
  return state.coupons.find(
    (coupon) => coupon.targetId === rewardId && !isExpiredCoupon(coupon, state.day) && Number(coupon.remaining || 1) > 0
  );
}

function getRewardAvailability(state, reward) {
  const recentWeek = state.rewardUsage.filter(
    (item) => item.rewardId === reward.id && daysBetween(item.date, state.day) < 7
  );

  if (reward.weeklyLimit && recentWeek.length >= reward.weeklyLimit) {
    return { available: false, reason: "本週已兌換過" };
  }

  if (reward.cooldownDays) {
    const lastLarge = state.rewardUsage
      .filter((item) => item.level === "大獎")
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (lastLarge && daysBetween(lastLarge.date, state.day) < reward.cooldownDays) {
      const left = reward.cooldownDays - daysBetween(lastLarge.date, state.day);
      return { available: false, reason: `大獎冷卻中，還有 ${left} 天` };
    }
  }

  return { available: true, reason: "" };
}

export default function LifeLevelingAppV12() {
  const [state, setState] = useState(() => {
    const saved = loadSavedState();
    const loaded = normalizeState(saved || initialState);
    return loaded.day === todayKey() ? loaded : archiveAndStartNewDay(loaded);
  });

  const [tab, setTab] = useState("today");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [todoFormOpen, setTodoFormOpen] = useState(false);
  const [expandedReportDate, setExpandedReportDate] = useState("");
  const [todoDraft, setTodoDraft] = useState({ title: "", category: "生活" });
  const [taskDraft, setTaskDraft] = useState({ title: "", coins: 30, group: "支線", attr: "心力" });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    function checkNewDay() {
      setState((previous) => (previous.day === todayKey() ? previous : archiveAndStartNewDay(previous)));
    }
    const timer = window.setInterval(checkNewDay, 60 * 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") checkNewDay();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const completedTasks = state.tasks.filter((task) => task.done);
  const completedTodos = state.todos.filter((todo) => todo.done);
  const isSurvival = state.energy <= 30;
  const visibleTasks = useMemo(() => {
    if (!isSurvival) return state.tasks;
    return state.tasks.filter(
      (task) => task.group === "主線" || task.type === "保命任務" || task.type === "體能訓練"
    );
  }, [state.tasks, isSurvival]);

  const usedEnergy = completedTasks.reduce((sum, task) => sum + Number(task.energy || 0), 0);
  const remainingEnergy = Math.max(0, state.energy - usedEnergy);
  const level = Math.floor(state.exp / 100) + 1;
  const expInLevel = state.exp % 100;
  const nextExp = 100 - expInLevel;
  const nextTitle = getNextPlayerTitle(level);
  const dailyTitle = getDailyTitle(state.tasks, state.todos);
  const battleMessage = getBattleMessage(state.tasks, state.todos);
  const unlock = getRewardUnlock(state);
  const reward = state.dailyReward || createDailyReward(state.day);
  const seals = getSeals(state.todos);

  function patch(updater) {
    setState((previous) => {
      const current = previous.day === todayKey() ? previous : archiveAndStartNewDay(previous);
      return typeof updater === "function" ? updater(current) : { ...current, ...updater };
    });
  }

  function consumeEligibleBoost(previous, task) {
    const index = previous.pendingBoosts.findIndex(
      (boost) =>
        Number(boost.remaining || 0) > 0 &&
        Array.isArray(boost.eligibleGroups) &&
        boost.eligibleGroups.includes(task.group)
    );

    if (index < 0) return { bonusCoins: 0, pendingBoosts: previous.pendingBoosts };

    const boost = previous.pendingBoosts[index];
    const next = previous.pendingBoosts
      .map((item, itemIndex) =>
        itemIndex === index ? { ...item, remaining: Number(item.remaining || 1) - 1 } : item
      )
      .filter((item) => Number(item.remaining || 0) > 0);

    return { bonusCoins: Number(boost.amount || 0), pendingBoosts: next };
  }

  function completeTask(id) {
    patch((previous) => {
      const task = previous.tasks.find((item) => item.id === id);
      if (!task || task.done) return previous;

      const boostResult = consumeEligibleBoost(previous, task);
      const remainingCap = Math.max(0, DAILY_COIN_CAP - previous.todayCoins);
      const rawAward = Number(task.coins || 0) + boostResult.bonusCoins;
      const awardedCoins = Math.min(rawAward, remainingCap);
      const capMessage = awardedCoins < rawAward ? "（今日金幣已達上限，部分金幣未計入）" : "";

      return {
        ...previous,
        tasks: previous.tasks.map((item) => (item.id === id ? { ...item, done: true } : item)),
        pendingBoosts: boostResult.pendingBoosts,
        coins: previous.coins + awardedCoins,
        exp: previous.exp + Number(task.exp || task.coins || 0),
        todayCoins: previous.todayCoins + awardedCoins,
        todayExp: previous.todayExp + Number(task.exp || task.coins || 0),
        totalTasks: previous.totalTasks + 1,
        totalCoinsEarned: previous.totalCoinsEarned + awardedCoins,
        attrs: {
          ...previous.attrs,
          [task.attr]: Number(previous.attrs[task.attr] || 0) + Number(task.attrExp || 10),
        },
        message: `完成「${task.title}」：+${awardedCoins} 金幣，${task.attr} +${task.attrExp || 10}${capMessage}`,
      };
    });
  }

  function addTodo() {
    const title = todoDraft.title.trim();
    if (!title) return;
    const todo = {
      id: `todo-${Date.now()}`,
      title,
      category: todoDraft.category,
      done: false,
      createdAt: new Date().toISOString(),
    };
    patch((previous) => ({
      ...previous,
      todos: [...previous.todos, todo],
      message: `已加入今日待辦：「${title}」。待辦不刷金幣，但可累積村民印記。`,
    }));
    setTodoDraft({ title: "", category: "生活" });
    setTodoFormOpen(false);
  }

  function toggleTodo(id) {
    patch((previous) => {
      const target = previous.todos.find((todo) => todo.id === id);
      if (!target) return previous;
      const becomingDone = !target.done;
      const doneAfter = previous.todos.filter((todo) => todo.done && todo.id !== id).length + (becomingDone ? 1 : 0);
      const text = becomingDone
        ? `待辦完成。今日村民印記：${Math.min(3, doneAfter)}/3。`
        : "已取消待辦完成狀態。";
      return {
        ...previous,
        todos: previous.todos.map((todo) => (todo.id === id ? { ...todo, done: becomingDone } : todo)),
        message: text,
      };
    });
  }

  function deleteTodo(id) {
    patch((previous) => ({
      ...previous,
      todos: previous.todos.filter((todo) => todo.id !== id),
      message: "已刪除一件待辦。",
    }));
  }

  function claimVillageReward() {
    patch((previous) => {
      const currentReward = previous.dailyReward || createDailyReward(previous.day);
      const currentUnlock = getRewardUnlock(previous);
      if (!currentUnlock.unlocked) {
        return { ...previous, message: `封印還沒解除：${currentUnlock.detail}` };
      }
      if (currentReward.claimed) {
        return { ...previous, message: "今天的村長賞賜已領取。" };
      }

      let pendingBoosts = previous.pendingBoosts;
      let coupons = previous.coupons;
      const effect = currentReward.effect || {};

      if (effect.kind === "bonusCoins") {
        pendingBoosts = [
          ...previous.pendingBoosts,
          {
            id: `boost-${previous.day}-${currentReward.id}`,
            title: currentReward.title,
            amount: Number(effect.amount || 20),
            eligibleGroups: effect.eligibleGroups || ["支線", "隨機"],
            remaining: Number(effect.remaining || 1),
          },
        ];
      }

      if (effect.kind === "coupon") {
        coupons = [
          ...previous.coupons.filter((coupon) => coupon.id !== `coupon-${previous.day}-${currentReward.id}`),
          {
            id: `coupon-${previous.day}-${currentReward.id}`,
            title: currentReward.title,
            targetId: effect.targetId,
            amount: Number(effect.amount || 100),
            remaining: 1,
            expiresAt: dateAfterDays(previous.day, Number(effect.expiresInDays || 7)),
          },
        ];
      }

      return {
        ...previous,
        dailyReward: {
          ...currentReward,
          claimed: true,
          claimedAt: new Date().toISOString(),
        },
        pendingBoosts,
        coupons,
        message: `村長賞賜已領取：「${currentReward.title}」。${currentReward.description}`,
      };
    });
  }

  function useFreeRecoveryCard() {
    patch((previous) => {
      if (previous.energy > 30) return { ...previous, message: "恢復卡只在能量 30 以下時啟用，平常日先靠正常節奏。" };
      if (previous.recoveryUsedDay === previous.day) return { ...previous, message: "今天已啟用過恢復卡。現在只要好好休息即可。" };
      return {
        ...previous,
        recoveryUsedDay: previous.day,
        message: "恢復卡已啟用：今天可以安心休息 20 分鐘。這不是偷懶，是把明天的自己修回來。",
      };
    });
  }

  function addTask() {
    const title = taskDraft.title.trim();
    if (!title) return;
    const coins = Math.max(1, Number(taskDraft.coins || 30));
    const id = `custom-${Date.now()}`;
    const task = {
      id,
      taskKey: id,
      title,
      desc: "自訂事件：由你自己定義完成條件。",
      standard: "完成：照自己設定的條件完成即可。",
      group: taskDraft.group,
      type: "自訂事件",
      difficulty: coins >= 70 ? "B" : coins >= 40 ? "C" : "D",
      coins,
      exp: coins,
      energy: 5,
      attr: taskDraft.attr,
      attrExp: Math.max(8, Math.round(coins / 2)),
      done: false,
    };
    patch((previous) => ({ ...previous, tasks: [...previous.tasks, task], message: `已新增自訂事件：「${title}」。` }));
    setTaskDraft({ title: "", coins: 30, group: "支線", attr: "心力" });
    setTaskFormOpen(false);
  }

  function deleteTask(id) {
    patch((previous) => {
      const isDefault = defaultTasks.some((task) => task.id === id);
      if (isDefault) {
        return { ...previous, message: "人生主線是固定骨架，不能直接刪除；可用能量模式調整今天做多少。" };
      }
      return { ...previous, tasks: previous.tasks.filter((task) => task.id !== id), message: "已刪除自訂事件。" };
    });
  }

  function repairTasks() {
    patch((previous) => ({ ...previous, tasks: mergeDefaultTasks(previous.tasks), message: "已修復預設人生主線，健身任務也已補回。" }));
    setTab("today");
  }

  function redeemShopReward(rewardItem) {
    patch((previous) => {
      const availability = getRewardAvailability(previous, rewardItem);
      if (!availability.available) return { ...previous, message: availability.reason };

      const coupon = getActiveCoupon(previous, rewardItem.id);
      const discount = coupon ? Number(coupon.amount || 0) : 0;
      const cost = Math.max(0, Number(rewardItem.cost || 0) - discount);
      if (previous.coins < cost) return { ...previous, message: `金幣還差 ${cost - previous.coins}。今天先把主線或待辦往前推一點。` };

      const nextCoupons = coupon
        ? previous.coupons
            .map((item) => (item.id === coupon.id ? { ...item, remaining: Number(item.remaining || 1) - 1 } : item))
            .filter((item) => Number(item.remaining || 0) > 0)
        : previous.coupons;

      return {
        ...previous,
        coins: previous.coins - cost,
        coupons: nextCoupons,
        rewardUsage: [
          { id: `use-${Date.now()}`, rewardId: rewardItem.id, level: rewardItem.level, date: previous.day, cost },
          ...previous.rewardUsage,
        ].slice(0, 100),
        message: `已兌換「${rewardItem.title}」${discount ? `，使用村長折扣 -${discount} 金幣` : ""}。這段放鬆是你賺來的。`,
      };
    });
  }

  function redeemGoalFund(meta) {
    patch((previous) => {
      if (previous.coins < meta.cost) return { ...previous, message: `金幣還差 ${meta.cost - previous.coins}。這是長期目標，不急，但要持續。` };
      return {
        ...previous,
        coins: previous.coins - meta.cost,
        goalFunds: { ...previous.goalFunds, [meta.id]: Number(previous.goalFunds[meta.id] || 0) + meta.cashValue },
        message: `已換算 ${meta.title} +${meta.cashValue} 元。${meta.hint}`,
      };
    });
  }

  function resetToday() {
    patch((previous) => {
      const hasProgress = previous.tasks.some((task) => task.done) || previous.todos.some((todo) => todo.done);
      if (hasProgress) {
        return { ...previous, message: "今天已有完成紀錄，為避免刷金幣與重抽賞賜，不能重置。未完成的待辦可直接刪掉重建。" };
      }
      if (!window.confirm("確定清空今天尚未完成的自訂事件與待辦？固定人生主線與封印賞賜會保留。")) return previous;
      return {
        ...previous,
        tasks: clone(defaultTasks),
        todos: [],
        energy: 70,
        message: "今日清單已整理，固定主線與封印賞賜仍保留。",
      };
    });
  }

  function hardReset() {
    if (!window.confirm("確定全部重來？金幣、等級、待辦、歷史戰報與村長賞賜都會清空。")) return;
    setState(clone(initialState));
    setTab("today");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 bg-slate-900 sm:rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800">
        <header className="p-5 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_38%),linear-gradient(135deg,#1e293b,#020617)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">人生打怪村 v12 村長模式</p>
              <h1 className="text-3xl font-black tracking-tight mt-1">邱顯明 Lv.{level}</h1>
              <div className="inline-flex mt-2 px-3 py-1 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-300 text-sm font-bold">
                {getPlayerTitle(level)}
              </div>
              <p className="text-xs text-slate-500 mt-2">{state.day}</p>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-amber-400/15 border border-amber-300/40 flex items-center justify-center shadow-[0_0_28px_rgba(251,191,36,0.18)]">
              <span className="text-3xl font-black text-amber-300">村</span>
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
            <p className="text-xs text-slate-500 mt-3">每日金幣上限 {DAILY_COIN_CAP}；待辦不刷金幣，只用來解除村長封印。</p>
            {isSurvival && <p className="text-sm text-amber-300 mt-2">保命模式已啟動：今天只要求不斷線。</p>}
          </div>
        </div>

        <nav className="px-4 grid grid-cols-3 gap-2 pb-2 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          {[
            ["today", "今日"],
            ["reward", "賞賜"],
            ["record", "紀錄"],
            ["role", "角色"],
            ["energy", "能量"],
            ["settings", "設定"],
          ].map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)} className={`rounded-2xl px-3 py-3 text-sm font-black transition ${tab === key ? "bg-amber-300 text-slate-950 shadow-[0_0_18px_rgba(251,191,36,0.22)]" : "bg-slate-800 text-slate-300 border border-slate-700"}`}>
              {label}
            </button>
          ))}
        </nav>

        <main className="p-4 pb-24">
          {tab === "today" && (
            <section className="space-y-4">
              <VillageRewardCard reward={reward} unlock={unlock} onClaim={claimVillageReward} />

              {isSurvival && (
                <div className="bg-emerald-950/45 border border-emerald-500/40 rounded-3xl p-4">
                  <p className="font-black text-emerald-200">免費恢復卡</p>
                  <p className="text-sm text-slate-300 mt-1 leading-relaxed">能量太低時，休息不是需要用金幣買的獎勵。今天可以啟用一次 20 分鐘恢復時間。</p>
                  <button onClick={useFreeRecoveryCard} className="w-full mt-3 rounded-2xl bg-emerald-300 text-emerald-950 h-11 font-black">
                    {state.recoveryUsedDay === state.day ? "今天已啟用恢復卡" : "啟用免費恢復卡"}
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-black">人生主線</h2>
                <button onClick={resetToday} className="text-slate-300 rounded-full px-3 py-2 hover:bg-slate-800 text-sm">↻ 重置今日</button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm text-slate-300 leading-relaxed">
                主線才給金幣。今天不必全清，但至少讓 UberEats、房仲、家庭、身體其中幾條線不要全斷。
              </div>

              {visibleTasks.map((task) => <TaskCard key={task.id} task={task} onComplete={completeTask} onDelete={deleteTask} canDelete={!defaultTasks.some((defaultTask) => defaultTask.id === task.id)} />)}

              <button onClick={() => setTaskFormOpen((value) => !value)} className="w-full rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 flex items-center justify-center border border-slate-700">
                ＋ 新增自訂主線／支線
              </button>

              {taskFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <TextInput label="事件名稱" value={taskDraft.title} onChange={(value) => setTaskDraft({ ...taskDraft, title: value })} placeholder="例如：整理一組社區行情" />
                  <TextInput label="金幣" type="number" value={taskDraft.coins} onChange={(value) => setTaskDraft({ ...taskDraft, coins: value })} />
                  <SelectInput label="分類" value={taskDraft.group} onChange={(value) => setTaskDraft({ ...taskDraft, group: value })} options={["主線", "支線", "隨機"]} />
                  <SelectInput label="成長屬性" value={taskDraft.attr} onChange={(value) => setTaskDraft({ ...taskDraft, attr: value })} options={Object.keys(attrMeta)} />
                  <button onClick={addTask} className="w-full bg-amber-300 text-slate-950 rounded-2xl py-3 font-black">加入事件</button>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-black">今日待辦</h2>
                  <p className="text-sm text-slate-400 mt-1">完成不給金幣；每天前 3 件，換成村民印記。</p>
                </div>
                <div className="rounded-2xl bg-amber-300/15 border border-amber-300/25 px-3 py-2 text-center">
                  <div className="text-xs text-slate-400">印記</div>
                  <div className="font-black text-amber-300">{seals}/3</div>
                </div>
              </div>

              {state.todos.length === 0 ? (
                <div className="bg-slate-800 border border-dashed border-slate-600 rounded-3xl p-4 text-sm text-slate-400">想到就記：回客戶、繳費、買奶粉、寄文件、回訊息，都放這裡。做完勾掉就好。</div>
              ) : (
                <div className="space-y-2">
                  {state.todos.map((todo) => <TodoCard key={todo.id} todo={todo} onToggle={toggleTodo} onDelete={deleteTodo} />)}
                </div>
              )}

              <button onClick={() => setTodoFormOpen((value) => !value)} className="w-full rounded-2xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-100 h-12 border border-blue-400/30">
                ＋ 新增今日待辦
              </button>

              {todoFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <TextInput label="待辦名稱" value={todoDraft.title} onChange={(value) => setTodoDraft({ ...todoDraft, title: value })} placeholder="例如：回覆王先生、買奶粉、繳帳單" />
                  <SelectInput label="分類" value={todoDraft.category} onChange={(value) => setTodoDraft({ ...todoDraft, category: value })} options={["工作", "家庭", "生活"]} />
                  <button onClick={addTodo} className="w-full bg-blue-300 text-slate-950 rounded-2xl py-3 font-black">加入今日待辦</button>
                </div>
              )}
            </section>
          )}

          {tab === "reward" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-black">賞賜與目標</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">村長規則</h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2">小爽不再放進金幣商店。每天的即時回饋交給村長賞賜；金幣則留給撞球、美食、家庭時間與真正的人生目標。</p>
              </div>

              {state.pendingBoosts.length > 0 && (
                <div className="bg-purple-950/45 border border-purple-400/35 rounded-3xl p-4">
                  <h3 className="font-black text-purple-200">已持有加成券</h3>
                  {state.pendingBoosts.map((boost) => <p key={boost.id} className="text-sm text-slate-300 mt-2">• {boost.title}：下一個符合條件的任務額外 +{boost.amount} 金幣</p>)}
                </div>
              )}

              {state.coupons.length > 0 && (
                <div className="bg-amber-950/35 border border-amber-400/35 rounded-3xl p-4">
                  <h3 className="font-black text-amber-200">已持有折扣券</h3>
                  {state.coupons.map((coupon) => <p key={coupon.id} className="text-sm text-slate-300 mt-2">• {coupon.title}：兌換指定獎勵少 {coupon.amount} 金幣，至 {coupon.expiresAt}</p>)}
                </div>
              )}

              <div>
                <h3 className="font-black text-lg mb-2">中獎與大獎</h3>
                <div className="space-y-3">
                  {state.rewards.map((rewardItem) => {
                    const availability = getRewardAvailability(state, rewardItem);
                    const coupon = getActiveCoupon(state, rewardItem.id);
                    const cost = Math.max(0, Number(rewardItem.cost) - Number(coupon?.amount || 0));
                    return (
                      <div key={rewardItem.id} className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                        <div className="flex justify-between gap-3">
                          <div className="min-w-0">
                            <span className={`text-xs px-2 py-1 rounded-full font-bold ${shopLevelClass(rewardItem.level)}`}>{rewardItem.level}</span>
                            <h4 className="font-black mt-2">{rewardItem.title}</h4>
                            <p className="text-sm text-slate-400 mt-1">{rewardItem.desc}</p>
                            <p className="text-xs text-amber-300 mt-2">{coupon ? `原價 ${rewardItem.cost}，村長券後 ${cost} 金幣` : `${rewardItem.cost} 金幣`}</p>
                            {!availability.available && <p className="text-xs text-rose-300 mt-1">{availability.reason}</p>}
                          </div>
                          <button disabled={!availability.available} onClick={() => redeemShopReward(rewardItem)} className={`shrink-0 self-center rounded-2xl px-3 py-2 font-black ${availability.available ? "bg-amber-300 text-slate-950" : "bg-slate-700 text-slate-500"}`}>
                            兌換
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <h3 className="font-black text-lg mb-2">目標基金</h3>
                <p className="text-sm text-slate-400 mb-2">這不是畫面數字。每次兌換後，請把真實現金移到相對應的帳戶、信封或記帳分類。</p>
                <div className="space-y-3">
                  {goalFundsMeta.map((meta) => (
                    <div key={meta.id} className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                      <div className="flex justify-between gap-3">
                        <div>
                          <h4 className="font-black">{meta.title}</h4>
                          <p className="text-sm text-slate-400 mt-1">已換算：{state.goalFunds[meta.id] || 0} 元</p>
                          <p className="text-xs text-amber-300 mt-2">{meta.cost} 金幣 → 真實金額 +{meta.cashValue} 元</p>
                        </div>
                        <button onClick={() => redeemGoalFund(meta)} className="shrink-0 self-center rounded-2xl bg-amber-300 text-slate-950 px-3 py-2 font-black">投入</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}

          {tab === "record" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-black">紀錄</h2>
              <div className="grid grid-cols-3 gap-3">
                <RecordBox label="總事件" value={state.totalTasks} />
                <RecordBox label="總金幣" value={state.totalCoinsEarned} />
                <RecordBox label="封存天" value={state.settledDays} />
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">最近 7 天火種</h3>
                <p className="text-sm text-slate-400 mt-1">完成至少一個人生主線或待辦，就是保住火種。</p>
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
                <h3 className="font-black">村長賞賜紀錄</h3>
                {state.villageRewardHistory.length === 0 ? (
                  <p className="text-sm text-slate-400 mt-2">第一天跨日後，村長會把今天的封印賞賜狀態留在這裡。</p>
                ) : (
                  <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                    {state.villageRewardHistory.map((item) => (
                      <div key={item.date} className="flex items-center justify-between gap-3 border-b border-slate-700 pb-2 last:border-0">
                        <div><p className="text-sm font-bold">{item.date}・{item.title}</p><p className="text-xs text-slate-500">{poolLabel(item.pool)}</p></div>
                        <span className="text-xs text-amber-300 shrink-0">{item.status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black mb-3">歷史戰報</h3>
                {state.reportHistory.length === 0 ? (
                  <p className="text-slate-400 text-sm">跨日後會自動封存。App 關掉時，隔天第一次打開也會先存昨天。</p>
                ) : (
                  <div className="max-h-[30rem] overflow-y-auto space-y-3 pr-1">
                    {state.reportHistory.map((item) => {
                      const expanded = expandedReportDate === item.date;
                      return (
                        <button key={item.date} onClick={() => setExpandedReportDate(expanded ? "" : item.date)} className="w-full text-left border-b border-slate-700 pb-3 last:border-0">
                          <div className="flex justify-between items-center gap-3"><span className="font-bold text-white text-sm">{item.date}</span><span className="text-slate-400 text-xs shrink-0">任務 {item.done}/{item.total}・待辦 {item.todoDone}/{item.todoTotal}</span></div>
                          <div className="text-amber-300 text-sm mt-1">{item.title}</div>
                          <div className="text-slate-500 text-xs mt-1">+{item.coins || 0} 金幣 / +{item.exp || 0} EXP / 印記 {item.seals || 0}/3</div>
                          <div className="text-slate-500 text-xs mt-1">村長賞賜：{item.rewardTitle}</div>
                          {expanded && <p className="text-sm text-slate-300 mt-3 whitespace-pre-line leading-relaxed bg-slate-950 rounded-2xl p-3">{item.report}</p>}
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
                <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-300/30 to-blue-400/20 border border-slate-600 flex items-center justify-center mb-3 shadow-[0_0_24px_rgba(251,191,36,0.15)]"><span className="text-3xl font-black text-amber-200">人</span></div>
                <h3 className="text-xl font-black">家庭守護型房仲勇者</h3>
                <p className="text-sm text-amber-300 mt-1">稱號：{getPlayerTitle(level)}</p>
                <p className="text-xs text-slate-400 mt-2">下一稱號：{nextTitle ? ` ${nextTitle.title}（Lv.${nextTitle.level}）` : " 已達目前最高稱號"}</p>
              </div>
              {Object.keys(attrMeta).map((name) => {
                const value = state.attrs[name] || 0;
                const now = value % 50;
                return (
                  <div key={name} className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                    <div className="flex items-center gap-3 mb-2"><span className="text-amber-300 font-black w-5 text-center">{attrMeta[name].short}</span><span className="font-black">{name} Lv.{attrLevel(value)}</span><span className="ml-auto text-slate-400">{value} EXP</span></div>
                    <h3 className="font-bold">{attrTitle(name, value)}</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-2">下一級還差 {50 - now} EXP</p>
                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden"><div className="h-full bg-slate-300" style={{ width: `${now * 2}%` }} /></div>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "energy" && (
            <section className="space-y-3">
              <h2 className="text-2xl font-black">今天的能量</h2>
              <p className="text-slate-400 text-sm">能量會影響村長賞賜的解鎖門檻。狀態低時，系統不是逼你做更多，而是把門檻降到你做得到。</p>
              {energyOptions.map((option) => (
                <button key={option.value} onClick={() => patch({ energy: option.value, message: option.value <= 30 ? "已切換保命模式。村長賞賜只要完成一件事就有機會解鎖。" : `今日能量設定為 ${option.value}。` })} className={`w-full text-left rounded-3xl border p-4 flex justify-between items-center ${state.energy === option.value ? "bg-amber-300 text-slate-950 border-amber-200" : "bg-slate-800 text-slate-100 border-slate-700"}`}>
                  <div><h3 className="font-black">{option.label}</h3><p className={`text-sm ${state.energy === option.value ? "text-slate-700" : "text-slate-400"}`}>{option.desc}</p></div><div className="text-3xl font-black">{option.value}</div>
                </button>
              ))}
            </section>
          )}

          {tab === "settings" && (
            <section className="space-y-3">
              <h2 className="text-2xl font-black">設定</h2>
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4"><h3 className="font-black">v12 村長模式</h3><p className="text-sm text-slate-300 leading-relaxed mt-2">每日待辦只累積印記；每天一張本地規則式村長賞賜卡。先驗證你有沒有感覺，再決定要不要接真正 AI API。</p></div>
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4"><h3 className="font-black">資料儲存</h3><p className="text-sm text-slate-300 leading-relaxed mt-2">固定使用 life-leveling-main-save。v9～v11 的主資料會盡量繼承；新功能會在同一個存檔下增加欄位。</p></div>
              <button onClick={repairTasks} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black">修復預設人生主線</button>
              <button onClick={hardReset} className="w-full rounded-2xl bg-rose-900/80 text-rose-100 h-12 font-bold">全部重來</button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function VillageRewardCard({ reward, unlock, onClaim }) {
  const revealed = unlock.unlocked || reward.claimed;
  return (
    <div className={`rounded-3xl border p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${revealed ? "bg-slate-800 border-amber-400/40" : "bg-slate-900 border-slate-700"}`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="text-sm text-slate-300">AI 村長今日封印賞賜</p>
          <h2 className="text-xl font-black mt-1">{revealed ? reward.title : "？？？封印賞賜卡"}</h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border font-bold ${revealed ? rewardPoolClass(reward.pool) : "bg-slate-700 text-slate-300 border-slate-600"}`}>{revealed ? poolLabel(reward.pool) : "封印中"}</span>
      </div>
      {revealed ? (
        <>
          <p className="text-sm text-slate-300 leading-relaxed mt-3">{reward.description}</p>
          <p className="text-xs text-amber-200/90 mt-3">村長的話：{reward.villageLine}</p>
          <button onClick={onClaim} disabled={reward.claimed} className={`w-full mt-4 rounded-2xl h-12 font-black ${reward.claimed ? "bg-slate-700 text-slate-400" : "bg-amber-300 text-slate-950"}`}>
            {reward.claimed ? "今日賞賜已領取" : "領取村長賞賜"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400 leading-relaxed mt-3">今天先不告訴你是什麼。把該推的主線和待辦推動，村長才會開封。</p>
          <div className="mt-3 rounded-2xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-slate-500">{unlock.label}</p><p className="font-bold text-white mt-1">{unlock.detail}</p><p className="text-xs text-amber-300 mt-2">目前進度：{unlock.progress}</p></div>
        </>
      )}
    </div>
  );
}

function TaskCard({ task, onComplete, onDelete, canDelete }) {
  return (
    <div className={`rounded-3xl border p-4 ${taskToneClass(task.group, task.done)}`}>
      <div className="flex gap-3 items-start">
        <button onClick={() => onComplete(task.id)} className={`mt-1 w-10 h-10 rounded-full flex items-center justify-center border text-lg font-black shrink-0 ${task.done ? "bg-emerald-400 border-emerald-300 text-slate-950" : "border-slate-500 text-slate-500"}`}>✓</button>
        <div className="flex-1 min-w-0">
          <div className="flex gap-2 mb-2 flex-wrap"><span className={`text-xs px-2 py-1 rounded-full font-bold ${groupClass(task.group)}`}>{task.group}</span><span className={`text-xs px-2 py-1 rounded-full font-bold ${difficultyClass(task.difficulty)}`}>{task.difficulty} 級</span><span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{task.type}</span>{task.done && <span className="text-xs px-2 py-1 rounded-full bg-emerald-300 text-emerald-950 font-bold">已完成</span>}</div>
          <h3 className={`font-black text-lg ${task.done ? "line-through text-slate-500" : "text-white"}`}>{task.title}</h3>
          <p className="text-sm text-slate-400 mt-1 leading-relaxed">{task.desc}</p>
          <p className="text-xs text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl p-2 mt-2 font-medium leading-relaxed">完成標準：{task.standard}</p>
          <div className="flex gap-3 text-sm text-slate-400 mt-3 flex-wrap"><span>+{task.coins} 金幣</span><span>+{task.exp} EXP</span><span>{task.attr} +{task.attrExp}</span></div>
        </div>
        {canDelete ? <button onClick={() => onDelete(task.id)} className="text-slate-600 hover:text-rose-400 text-sm p-1 shrink-0">✕</button> : <span className="text-slate-700 text-xs shrink-0">固定</span>}
      </div>
    </div>
  );
}

function TodoCard({ todo, onToggle, onDelete }) {
  return (
    <div className={`rounded-2xl border p-3 flex gap-3 items-center ${todo.done ? "bg-emerald-950/45 border-emerald-500/50" : "bg-slate-800 border-slate-700"}`}>
      <button onClick={() => onToggle(todo.id)} className={`w-9 h-9 rounded-full shrink-0 border font-black ${todo.done ? "bg-emerald-400 border-emerald-300 text-slate-950" : "border-slate-500 text-slate-500"}`}>✓</button>
      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className={`font-bold break-words ${todo.done ? "line-through text-slate-500" : "text-white"}`}>{todo.title}</h3><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${todoCategoryClass(todo.category)}`}>{todo.category}</span></div></div>
      <button onClick={() => onDelete(todo.id)} className="text-slate-600 hover:text-rose-400 p-1">✕</button>
    </div>
  );
}

function StatCard({ label, value }) {
  return <div className="bg-slate-950/50 border border-slate-800 rounded-2xl p-3 text-center"><p className="text-xs text-slate-500 font-bold">{label}</p><p className="text-xl font-black text-white mt-1">{value}</p></div>;
}

function RecordBox({ label, value }) {
  return <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center"><p className="text-xs text-slate-500 font-bold">{label}</p><p className="text-lg font-black text-white mt-1">{value}</p></div>;
}

function TextInput({ label, type = "text", value, onChange, placeholder }) {
  return <div><label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label><input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-amber-400" /></div>;
}

function SelectInput({ label, value, onChange, options }) {
  return <div><label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-amber-400">{options.map((option) => <option key={option} value={option}>{option}</option>)}</select></div>;
}
