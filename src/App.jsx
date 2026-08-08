import React, { useEffect, useMemo, useRef, useState } from "react";
import { initializeApp } from "firebase/app";
import { getDatabase, get, onValue, ref as databaseRef, set as databaseSet } from "firebase/database";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";

/*
 * 人生打怪村 v14：原則之書＋三端安靜同步＋減重守門
 *
 * 設計原則：
 * 1. 人生主線仍給金幣；每日待辦不給金幣，只累積村民印記（每日最多 3 枚）。
 * 2. 每天只有一張封印賞賜卡，依日期固定，不可用重整洗卡。
 * 3. 村長會依能量、主線、待辦、核心三線與近期火種，動態產生「村長觀察」與賞賜理由。
 * 4. 村長判讀仍在本機完成；遊戲存檔透過 Firebase Realtime Database 共用，並自動匿名登入。
 * 5. 保留明日待辦與未完成待辦：明日跨日自動移入今日；今天未完成的項目不強塞進明天。
 * 6. 新增每日熱量、飲食與體重趨勢，跨日自動封存。
 * 7. 繼續沿用固定本機存檔 key，安卓、iPad、電腦共用同一份雲端主檔；不用輸入帳號密碼。
 * 8. v14 新增「戰後復盤 → 原則之書 → Boss 圖鑑」：失敗不扣分，轉成智慧值與可驗證的人生原則。
 */

const STORAGE_KEY = "life-leveling-main-save";
const DAILY_COIN_CAP = 300;
const MAX_REPORTS = 100;
const VILLAGE_SYSTEM_VERSION = "14.0";
const DEFAULT_CALORIE_TARGET = 1900;
const DEFAULT_CALORIE_WARNING_LIMIT = 2000;
const DEFAULT_CURRENT_WEIGHT = 94;
const DEFAULT_GOAL_WEIGHT = 69;
const TOMORROW_TODO_LIMIT = 5;
const MAX_REFLECTIONS = 180;
const MAX_PRINCIPLES = 100;
const CLOUD_SAVE_PATH = "sharedSave";
const CLOUD_BACKUP_PATH = "sharedBackups";
const CLOUD_APP_VERSION = "14.0";

const firebaseConfig = {
  apiKey: "AIzaSyAaUE_5mGR7FJsEqjmyFeZPasWfxlEIN3o",
  authDomain: "life-leveling-app-shared.firebaseapp.com",
  databaseURL: "https://life-leveling-app-shared-default-rtdb.firebaseio.com",
  projectId: "life-leveling-app-shared",
  storageBucket: "life-leveling-app-shared.firebasestorage.app",
  messagingSenderId: "337807533967",
  appId: "1:337807533967:web:d3a8ce10f55e0fd7d50dfa",
  measurementId: "G-CBW7MNK9EX",
};

const firebaseApp = initializeApp(firebaseConfig);
const sharedAuth = getAuth(firebaseApp);
const sharedDatabase = getDatabase(firebaseApp);
const sharedSaveReference = databaseRef(sharedDatabase, CLOUD_SAVE_PATH);

function getDeviceId() {
  const key = "life-leveling-device-id";
  const existing = localStorage.getItem(key);
  if (existing) return existing;
  const value = `device-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  localStorage.setItem(key, value);
  return value;
}

function formatSyncTime(value) {
  if (!value) return "尚未同步";
  try {
    return new Date(value).toLocaleString("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "尚未同步";
  }
}

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
    id: "calorie-guard",
    taskKey: "calorie-guard",
    title: "熱量守門",
    desc: "把今天主要吃喝記進熱量頁。不是逼自己挨餓，而是先看清楚總量。",
    standard: "完成：記錄至少 2 筆主要飲食。漂亮完成：主要餐點都有記，並知道今天剩餘熱量。",
    group: "支線",
    type: "熱量管理",
    difficulty: "D",
    coins: 35,
    exp: 25,
    energy: 3,
    attr: "體力",
    attrExp: 18,
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
    id: "entertainment-block",
    title: "完整娛樂時段 2 小時",
    desc: "遊戲、電影或小說選一種，專心享受，不一邊娛樂一邊責怪自己。",
    level: "中獎",
    cost: 250,
    weeklyLimit: 2,
    cooldownDays: 0,
  },
  {
    id: "billiards",
    title: "去打撞球一次",
    desc: "把撞球當作有意識的放鬆，也是一段離開螢幕的活動時間。",
    level: "中獎",
    cost: 350,
    weeklyLimit: 1,
    cooldownDays: 0,
  },
  {
    id: "family-outdoor",
    title: "家庭戶外半日",
    desc: "帶家人散步、逛公園或走走，不必用大餐才算獎勵。",
    level: "大獎",
    cost: 650,
    weeklyLimit: 0,
    cooldownDays: 7,
  },
  {
    id: "freedom-halfday",
    title: "半日自由時段",
    desc: "安排一段真正由你決定的時間，不拿來補工作債。",
    level: "大獎",
    cost: 750,
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
      id: "music-bath-pass",
      title: "音樂熱水澡儀式",
      description: "今晚洗個熱水澡或泡腳 20 分鐘，配手碟或喜歡的音樂，不滑短影音。",
      villageLine: "獎勵不一定要吃進肚子；真正放鬆，身體會知道。",
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
      id: "entertainment-coupon",
      title: "娛樂時段折扣券",
      description: "7 天內兌換「完整娛樂時段 2 小時」時，少花 80 金幣。",
      villageLine: "減重不是把快樂拿掉，而是把快樂從食物之外重新找回來。",
      effect: { kind: "coupon", targetId: "entertainment-block", amount: 80, expiresInDays: 7 },
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

function createRewardFromPool(day, poolName, extra = {}) {
  const pool = rewardPools[poolName] || rewardPools.small;
  const item = deterministicPick(pool, hashString(`${day}-${poolName}`));

  return {
    ...clone(item),
    date: day,
    pool: poolName,
    claimed: false,
    claimedAt: "",
    locked: false,
    lockedAt: "",
    issueMode: "每日抽選",
    ...extra,
  };
}

function createDailyReward(day = todayKey()) {
  return createRewardFromPool(day, rewardPoolFromDate(day));
}

function getRecentFireStreak(fireLog, referenceDay = todayKey()) {
  const logs = Array.isArray(fireLog) ? fireLog : [];
  let streak = 0;
  const cursor = new Date(`${referenceDay}T12:00:00`);
  cursor.setDate(cursor.getDate() - 1);

  while (streak < 30) {
    const key = todayKey(cursor);
    const hasFire = logs.some((item) => item.date === key && item.done);
    if (!hasFire) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

function pickStableLine(lines, seed) {
  return deterministicPick(lines, hashString(seed));
}

function getVillageInsight(state) {
  const tasks = Array.isArray(state.tasks) ? state.tasks : [];
  const todos = Array.isArray(state.todos) ? state.todos : [];
  const mainDone = getMainDoneCount(tasks);
  const todoDone = getTodoDoneCount(todos);
  const seals = getSeals(todos);
  const doneCount = tasks.filter((task) => task.done).length;
  const streak = getRecentFireStreak(state.fireLog, state.day);
  const uberDone = tasks.some((task) => task.type === "UberEats" && task.done);
  const estateDone = tasks.some((task) => task.type === "房仲業務" && task.done);
  const familyDone = tasks.some((task) => task.type === "家庭守護" && task.done);
  const fitnessDone = tasks.some((task) => task.type === "體能訓練" && task.done);
  const coreTriple = hasCoreTriple(tasks);
  const seedBase = `${state.day}-${mainDone}-${todoDone}-${state.energy}-${streak}`;

  if (state.energy <= 30) {
    if (doneCount || todoDone) {
      return {
        key: "survival-progress",
        title: "保命模式守住了",
        label: "先活下來，再談效率",
        message: pickStableLine([
          "今天不需要證明你多厲害。你願意完成一件事，就已經把自己從停機邊緣拉回來。",
          "低能量時還有一點推進，比硬撐到崩掉更有價值。今天先把火種保住。",
          "你沒有逃掉今天。現在最重要的不是加碼，而是把剩下的力氣留給明天。",
        ], `${seedBase}-survival-progress`),
        nextStep: "賞賜領完後，允許自己收工；今天不再追加硬任務。",
        streak,
      };
    }

    return {
      key: "survival-start",
      title: "村長先幫你降難度",
      label: "只要一件事就夠",
      message: pickStableLine([
        "你現在不是懶，是能量太低。村長今天只要你完成一件最小的事。",
        "先別規劃一整天。喝水、洗臉、回一則訊息，任一件完成就算重新上線。",
        "今天的勝利條件很小：讓自己不要完全消失。",
      ], `${seedBase}-survival-start`),
      nextStep: "先完成「今日保命開局」或一件待辦，別跟明天預支力氣。",
      streak,
    };
  }

  if (coreTriple && todoDone >= 3) {
    return {
      key: "high-output",
      title: "高輸出日，村長加碼",
      label: "核心三線＋村務三印記",
      message: pickStableLine([
        "UberEats、房仲、身體三條核心線都碰到了，雜事也沒有繼續堆著。這不是忙，是穩定的推進。",
        "今天你不只完成任務，還把生活裡容易卡住的小事清掉了。這種日子值得被記住。",
        "現金流、職涯、身體與村務同時往前，這是你最需要複製的節奏。",
      ], `${seedBase}-high-output`),
      nextStep: "領取加碼賞賜後，今晚只做恢復；把好節奏留給明天。",
      streak,
    };
  }

  if (uberDone && estateDone && (familyDone || fitnessDone)) {
    return {
      key: "multi-line",
      title: "多線沒有斷",
      label: "現金流、房仲，加上生活主線",
      message: pickStableLine([
        "你今天同時碰到收入、工作與生活，這比只衝一件事更接近你要的長期人生。",
        "不是每件事都做滿，但重要的線都沒有放掉。這種穩定，比偶爾爆發更難也更值錢。",
        "今天的你沒有只顧眼前的錢，也沒有把家和身體整個丟掉。這就是在修復生活節奏。",
      ], `${seedBase}-multi-line`),
      nextStep: "補一到兩件待辦，讓賞賜條件自己打開。",
      streak,
    };
  }

  if (uberDone && estateDone) {
    return {
      key: "cashflow-estate",
      title: "收入雙線推進",
      label: "UberEats＋房仲都沒斷",
      message: pickStableLine([
        "今天現金流和房仲戰線都沒有斷。這不是立刻翻盤，但每一次不斷線都在幫未來累積機會。",
        "你把短期現金流和長期專業同時碰了一下，這是比單純忙碌更有效的安排。",
        "今天有把錢和職涯兩條線接住。接下來只要清兩件小待辦，整天就更完整。",
      ], `${seedBase}-cashflow-estate`),
      nextStep: "新增或完成兩件小待辦，讓腦中的雜音少一點。",
      streak,
    };
  }

  if (todoDone >= 3 && mainDone >= 1) {
    return {
      key: "village-clear",
      title: "村務清得很乾淨",
      label: "三枚印記＋主線已動",
      message: pickStableLine([
        "你把容易拖著的生活小事清掉了，也沒有忘記人生主線。這種日子看似普通，其實很扎實。",
        "待辦不再堆成心理負債，主線也有碰到。今天的你正在替明天減少阻力。",
        "你不是靠一個大爆發，而是把一堆小阻塞逐一拆掉。這才是長期能走下去的做法。",
      ], `${seedBase}-village-clear`),
      nextStep: "賞賜已經值得解鎖；今晚不要再開新坑。",
      streak,
    };
  }

  if (todoDone >= 3) {
    return {
      key: "todo-clear",
      title: "生活阻塞正在被清掉",
      label: "村民印記已滿",
      message: pickStableLine([
        "你把三件待辦清掉，腦袋裡少了幾個一直閃的紅點。這不是小事。",
        "雜事做完不會立刻讓人生變好，但會讓你有空間去做真正重要的事。",
        "今天先把生活的路面掃乾淨，明天主線才跑得動。",
      ], `${seedBase}-todo-clear`),
      nextStep: "再完成一件人生主線，封印賞賜就會打開。",
      streak,
    };
  }

  if (mainDone >= 1 && todoDone >= 2) {
    return {
      key: "steady-unlock",
      title: "穩定門檻已跨過",
      label: "主線與待辦都有碰到",
      message: pickStableLine([
        "你不是只做喜歡的事，也把該處理的事情推了一點。這正是村長要獎勵的節奏。",
        "今天有一條人生主線、也有兩件真實生活待辦。這已經不是待機，而是在前進。",
        "你做的事情不一定華麗，但很接近真正會改變生活的那種努力。",
      ], `${seedBase}-steady-unlock`),
      nextStep: "封印賞賜已可領取，領完就安心休息。",
      streak,
    };
  }

  if (streak >= 3) {
    return {
      key: "streak",
      title: `火種連線第 ${streak} 天`,
      label: "穩定比爆發更稀有",
      message: pickStableLine([
        "你最近沒有斷線。別小看這件事，能回來的人，比一天衝很猛的人更走得遠。",
        "連續幾天都有火種，代表你正在把行動從意志力，慢慢變成生活的一部分。",
        "你不是每天都很強，但你有持續出現。這已經是非常實際的能力。",
      ], `${seedBase}-streak`),
      nextStep: "今天只要再推一件最小事情，就把這條火線接下去。",
      streak,
    };
  }

  if (mainDone || todoDone) {
    return {
      key: "ember",
      title: "火種已點起",
      label: "今天不是歸零",
      message: pickStableLine([
        "事情還沒做很多，但你已經開始。開始本身，就是把拖延的牆敲出第一個洞。",
        "今天有一件事被你推動了。先不要急著批評份量，火種先留下來。",
        "你已經從『想做』跨到『做了一點』。接下來再補一件待辦就很夠了。",
      ], `${seedBase}-ember`),
      nextStep: "補一件主線或待辦，讓今天從火種變成節奏。",
      streak,
    };
  }

  return {
    key: "start",
    title: "村長在等你的第一步",
    label: "今天還沒開局",
    message: pickStableLine([
      "不用把所有事情想完。先做一件 5 分鐘的小事，今天就開始有方向。",
      "真正卡住時，計畫通常沒用；先把一件眼前小事完成，路就會出現。",
      "今天不需要完美待辦表，只需要一個勾勾。",
    ], `${seedBase}-start`),
    nextStep: "完成保命開局，或新增並完成一件最小待辦。",
    streak,
  };
}

function getAdaptiveDailyReward(state) {
  const base = state.dailyReward || createDailyReward(state.day);
  if (base.claimed || base.locked) return base;

  const highOutput = state.energy >= 80 && hasCoreTriple(state.tasks) && getTodoDoneCount(state.todos) >= 3;
  if (state.energy <= 30) {
    return createRewardFromPool(state.day, "recovery", {
      issueMode: "保命覆蓋令",
      overrideReason: "今天能量偏低，村長把一般賞賜改為恢復型賞賜。",
    });
  }

  if (highOutput) {
    const poolName = hashString(`${state.day}-high-output`) % 100 < 65 ? "boost" : "ticket";
    return createRewardFromPool(state.day, poolName, {
      issueMode: "高輸出加碼",
      overrideReason: "你完成了核心三線與三件待辦，村長將今日賞賜升級。",
    });
  }

  return base;
}

function getRewardReason(state, reward) {
  const insight = getVillageInsight(state);
  if (reward?.overrideReason) return reward.overrideReason;

  const reasons = {
    recovery: "村長看到你今天更需要把節奏守住，而不是再用娛樂把自己榨乾，所以發的是恢復型賞賜。",
    small: "你有做事，也需要一點立即而乾淨的回饋；這份小爽不必花金幣，也不需要內疚。",
    boost: "今天的推進值得替明天鋪一點路，所以村長把回饋做成下一步會用到的加成。",
    ticket: "你不是每天都該拿大獎；這張券是把較大的放鬆留給真正有推進的時候。",
  };

  return `${reasons[reward?.pool] || "這份賞賜是村長根據你今天的節奏發出的。"} 今日判讀：${insight.label}。`;
}

const mealTypeOptions = ["早餐", "午餐", "晚餐", "點心", "飲料", "其他"];

function normalizeFoodEntry(entry) {
  return {
    id: entry?.id || `food-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(entry?.name || "").trim(),
    calories: Math.max(0, Number(entry?.calories || 0)),
    mealType: mealTypeOptions.includes(entry?.mealType) ? entry.mealType : "其他",
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
}

function getCalorieTotal(entries) {
  return (Array.isArray(entries) ? entries : []).reduce(
    (sum, entry) => sum + Math.max(0, Number(entry?.calories || 0)),
    0
  );
}

function getCalorieState(total, target, warningLimit = DEFAULT_CALORIE_WARNING_LIMIT) {
  const safeTarget = Math.max(1, Number(target || DEFAULT_CALORIE_TARGET));
  const safeWarning = Math.max(safeTarget, Number(warningLimit || DEFAULT_CALORIE_WARNING_LIMIT));
  const difference = safeTarget - total;
  if (total === 0) {
    return { label: "尚未記錄", message: "先記第一餐，不必一開始就追求百分之百準確。", tone: "empty" };
  }
  if (difference >= 0) {
    return { label: "仍在目標內", message: `今天距離 ${safeTarget} kcal 目標還有約 ${difference} kcal。正常吃，不必刻意餓肚子。`, tone: "good" };
  }
  if (total <= safeWarning) {
    return { label: "超過目標、仍在提醒線內", message: `目前超過目標約 ${Math.abs(difference)} kcal，但尚未超過 ${safeWarning} kcal 提醒線。`, tone: "warn" };
  }
  return { label: "超過今日提醒線", message: `目前已超過 ${safeWarning} kcal 提醒線約 ${total - safeWarning} kcal。留下紀錄，明天回到正常目標，不用補償性挨餓。`, tone: "over" };
}

function calculateBmi(weight, heightCm = 176) {
  const meters = Number(heightCm) / 100;
  if (!meters || !Number(weight)) return 0;
  return Number(weight) / (meters * meters);
}


function createBlankReflection(day = todayKey()) {
  return {
    date: day,
    didRight: "",
    stuck: "",
    nextRule: "",
    bossTag: "",
    savedAt: "",
  };
}

function normalizeReflection(item, fallbackDay = todayKey()) {
  return {
    date: String(item?.date || fallbackDay),
    didRight: String(item?.didRight || ""),
    stuck: String(item?.stuck || ""),
    nextRule: String(item?.nextRule || ""),
    bossTag: String(item?.bossTag || ""),
    savedAt: String(item?.savedAt || ""),
  };
}

function normalizePrinciple(item) {
  const usageDates = Array.isArray(item?.usageDates) ? [...new Set(item.usageDates.filter(Boolean))] : [];
  return {
    id: item?.id || `principle-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    title: String(item?.title || "").trim(),
    category: item?.category || "決策",
    createdAt: item?.createdAt || new Date().toISOString(),
    sourceDate: item?.sourceDate || "",
    usageDates,
    xp: Math.max(Number(item?.xp || usageDates.length || 0), usageDates.length),
  };
}

function normalizeBoss(item) {
  const dates = Array.isArray(item?.dates) ? [...new Set(item.dates.filter(Boolean))] : [];
  return {
    id: item?.id || `boss-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: String(item?.name || "").trim(),
    dates,
    firstSeen: item?.firstSeen || dates[0] || "",
    lastSeen: item?.lastSeen || dates[dates.length - 1] || "",
    status: item?.status === "defeated" ? "defeated" : "active",
  };
}

function principleStage(xp) {
  const value = Number(xp || 0);
  if (value >= 20) return { label: "核心原則", next: "已成為你的核心規則" };
  if (value >= 5) return { label: "穩定原則", next: `再驗證 ${20 - value} 次升為核心原則` };
  return { label: "實驗原則", next: `再驗證 ${5 - value} 次升為穩定原則` };
}

function bossRank(count) {
  if (count >= 6) return "頭目級";
  if (count >= 3) return "Boss 已成形";
  return "問題蹤跡";
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
  wisdom: 0,
  principleSystemVersion: 14,
  dailyReflection: createBlankReflection(),
  reflectionHistory: [],
  principles: [],
  bossBook: [],
  fireLog: [],
  reportHistory: [],
  villageRewardHistory: [],
  lastReport: "尚未有自動戰報。",
  message: "v14 原則之書：任務拿金幣，復盤與驗證原則拿智慧值；三端仍共用同一份 Firebase 存檔。",
  tasks: clone(defaultTasks),
  todos: [],
  tomorrowTodos: [],
  backlogTodos: [],
  calorieTarget: DEFAULT_CALORIE_TARGET,
  calorieWarningLimit: DEFAULT_CALORIE_WARNING_LIMIT,
  calorieSystemVersion: 132,
  currentWeight: DEFAULT_CURRENT_WEIGHT,
  goalWeight: DEFAULT_GOAL_WEIGHT,
  heightCm: 176,
  foodEntries: [],
  calorieHistory: [],
  weightHistory: [{ date: todayKey(), weight: DEFAULT_CURRENT_WEIGHT }],
  dailyReward: createDailyReward(),
  pendingBoosts: [],
  coupons: [],
  recoveryUsedDay: "",
  rewardUsage: [],
  goalFunds: { debt: 0, travel: 0, housing: 0 },
  rewards: clone(rewardShop),
  rewardSystemVersion: 13,
  villageSystemVersion: VILLAGE_SYSTEM_VERSION,
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
    carriedFrom: todo?.carriedFrom || "",
  };
}

function normalizeReward(rawReward, day) {
  const fallback = createDailyReward(day);
  if (rawReward && rawReward.date === day && rawReward.title) {
    return {
      ...fallback,
      ...rawReward,
      effect: rawReward.effect || fallback.effect,
      claimed: Boolean(rawReward.claimed),
      locked: Boolean(rawReward.locked),
      lockedAt: rawReward.lockedAt || "",
      issueMode: rawReward.issueMode || "每日抽選",
    };
  }
  return fallback;
}

function normalizeState(raw) {
  const state = { ...initialState, ...(raw || {}) };

  state.day = typeof state.day === "string" ? state.day : todayKey();
  state.tasks = mergeDefaultTasks(state.tasks);
  state.todos = Array.isArray(state.todos)
    ? state.todos.map(normalizeTodo).filter((todo) => todo.title)
    : [];
  state.tomorrowTodos = Array.isArray(state.tomorrowTodos)
    ? state.tomorrowTodos.map((todo) => ({ ...normalizeTodo(todo), done: false })).filter((todo) => todo.title)
    : [];
  state.backlogTodos = Array.isArray(state.backlogTodos)
    ? state.backlogTodos.map((todo) => ({ ...normalizeTodo(todo), done: false })).filter((todo) => todo.title)
    : [];
  state.foodEntries = Array.isArray(state.foodEntries)
    ? state.foodEntries.map(normalizeFoodEntry).filter((entry) => entry.name && entry.calories > 0)
    : [];
  state.calorieHistory = Array.isArray(state.calorieHistory) ? state.calorieHistory : [];
  state.weightHistory = Array.isArray(state.weightHistory) ? state.weightHistory : [];
  const sourceCalorieSystemVersion = Number(raw?.calorieSystemVersion || 0);
  const savedCalorieTarget = Number(state.calorieTarget || DEFAULT_CALORIE_TARGET);
  state.calorieTarget = sourceCalorieSystemVersion < 132 && savedCalorieTarget === 2000
    ? DEFAULT_CALORIE_TARGET
    : Math.max(1200, savedCalorieTarget);
  state.calorieWarningLimit = Math.max(
    state.calorieTarget,
    Number(state.calorieWarningLimit || DEFAULT_CALORIE_WARNING_LIMIT)
  );
  state.calorieSystemVersion = 132;
  state.currentWeight = Number(state.currentWeight || DEFAULT_CURRENT_WEIGHT);
  state.goalWeight = Number(state.goalWeight || DEFAULT_GOAL_WEIGHT);
  state.heightCm = Number(state.heightCm || 176);
  if (!state.weightHistory.length && state.currentWeight) {
    state.weightHistory = [{ date: state.day, weight: state.currentWeight }];
  }
  state.dailyReward = normalizeReward(state.dailyReward, state.day);
  state.pendingBoosts = Array.isArray(state.pendingBoosts) ? state.pendingBoosts : [];
  state.coupons = Array.isArray(state.coupons) ? state.coupons.filter((coupon) => rewardShop.some((reward) => reward.id === coupon.targetId)) : [];
  state.rewardUsage = Array.isArray(state.rewardUsage) ? state.rewardUsage : [];
  const sourceRewardVersion = Number(raw?.rewardSystemVersion || 0);
  state.rewards = sourceRewardVersion >= 13 && Array.isArray(state.rewards) && state.rewards.length
    ? state.rewards
    : clone(rewardShop);
  state.rewardSystemVersion = 13;
  state.villageSystemVersion = VILLAGE_SYSTEM_VERSION;
  state.fireLog = Array.isArray(state.fireLog) ? state.fireLog : [];
  state.reportHistory = Array.isArray(state.reportHistory) ? state.reportHistory : [];
  state.villageRewardHistory = Array.isArray(state.villageRewardHistory) ? state.villageRewardHistory : [];
  state.wisdom = Number(state.wisdom || 0);
  state.principleSystemVersion = 14;
  state.dailyReflection = state.dailyReflection?.date === state.day
    ? normalizeReflection(state.dailyReflection, state.day)
    : createBlankReflection(state.day);
  state.reflectionHistory = Array.isArray(state.reflectionHistory)
    ? state.reflectionHistory.map((item) => normalizeReflection(item)).filter((item) => item.date).slice(0, MAX_REFLECTIONS)
    : [];
  state.principles = Array.isArray(state.principles)
    ? state.principles.map(normalizePrinciple).filter((item) => item.title).slice(0, MAX_PRINCIPLES)
    : [];
  state.bossBook = Array.isArray(state.bossBook)
    ? state.bossBook.map(normalizeBoss).filter((item) => item.name)
    : [];
  state.goalFunds = { ...initialState.goalFunds, ...(state.goalFunds || {}) };
  state.attrs = { ...initialState.attrs, ...(state.attrs || {}) };

  ["coins", "exp", "energy", "todayCoins", "todayExp", "totalTasks", "totalCoinsEarned", "settledDays", "wisdom"].forEach((key) => {
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

function getTomorrowLaunchPlan(todos) {
  const count = Array.isArray(todos) ? todos.length : 0;
  if (count === 0) {
    return {
      title: "明天留白也可以",
      message: "睡前只要放 1～3 件真正要緊的事就夠了。不要把明天排成補債日。",
      tone: "empty",
    };
  }
  if (count <= 3) {
    return {
      title: `明天已安排 ${count} 件`,
      message: "這個份量剛好。明天先從最小的一件開始，不需要一醒來就衝刺。",
      tone: "good",
    };
  }
  return {
    title: `明天已排 ${count} 件`,
    message: "已經夠了，先別再塞新事。留一點空白給突發狀況和真正重要的主線。",
    tone: "full",
  };
}

function makeBacklogTodo(todo, day) {
  return {
    ...normalizeTodo(todo),
    done: false,
    carriedFrom: todo?.carriedFrom || day,
  };
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
  const tomorrowTotal = Array.isArray(state.tomorrowTodos) ? state.tomorrowTodos.length : 0;
  const backlogTotal = Array.isArray(state.backlogTodos) ? state.backlogTodos.length : 0;
  const calorieTotal = getCalorieTotal(state.foodEntries);
  const calorieTarget = Number(state.calorieTarget || DEFAULT_CALORIE_TARGET);
  const title = getDailyTitle(state.tasks, state.todos);
  const comment = getBattleMessage(state.tasks, state.todos);
  const unlock = getRewardUnlock(state);
  const reward = getAdaptiveDailyReward(state);
  const villageInsight = getVillageInsight(state);
  const rewardReason = getRewardReason(state, reward);

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
    `今日熱量：${calorieTotal}/${calorieTarget} kcal`,
    `目前體重：${Number(state.currentWeight || 0).toFixed(1)} kg・目標 ${Number(state.goalWeight || 0).toFixed(1)} kg`,
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
    `明日待辦：已安排 ${tomorrowTotal} 件`,
    `未完成待辦：待處理 ${backlogTotal} 件`,
    "",
    `村長觀察：${villageInsight.title}`, 
    `村長判讀：${villageInsight.message}`,
    `村長下一步：${villageInsight.nextStep}`,
    `村長賞賜：${rewardStatus}`,
    `賞賜理由：${rewardReason}`,
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
    tomorrowTotal,
    backlogTotal,
    calorieTotal,
    calorieTarget,
    currentWeight: Number(state.currentWeight || 0),
    seals: getSeals(state.todos),
    coins: state.todayCoins,
    exp: state.todayExp,
    rewardTitle: reward.claimed || unlock.unlocked ? reward.title : "封印賞賜卡",
    rewardClaimed: Boolean(reward.claimed),
    villageInsightTitle: villageInsight.title,
    villageInsightMessage: villageInsight.message,
    rewardReason,
    report,
  };
}

function archiveCurrentDay(state) {
  const reportItem = buildReport(state);
  const alreadySaved = state.reportHistory.some((item) => item.date === state.day);
  const unlock = getRewardUnlock(state);
  const reward = getAdaptiveDailyReward(state);
  const villageInsight = getVillageInsight(state);

  const rewardHistoryItem = {
    date: state.day,
    title: reward.claimed || unlock.unlocked ? reward.title : "封印賞賜卡",
    pool: reward.pool,
    status: reward.claimed ? "已領取" : unlock.unlocked ? "已解鎖未領取" : "未解鎖",
    insightTitle: villageInsight.title,
    insightMessage: villageInsight.message,
  };

  const calorieTotal = getCalorieTotal(state.foodEntries);
  const calorieHistoryItem = {
    date: state.day,
    total: calorieTotal,
    target: Number(state.calorieTarget || DEFAULT_CALORIE_TARGET),
    entries: state.foodEntries.length,
  };

  return {
    ...state,
    calorieHistory: [
      calorieHistoryItem,
      ...(Array.isArray(state.calorieHistory) ? state.calorieHistory : []).filter((item) => item.date !== state.day),
    ].slice(0, MAX_REPORTS),
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
  const unfinishedToday = state.todos
    .filter((todo) => !todo.done)
    .map((todo) => makeBacklogTodo(todo, state.day));
  const existingBacklog = Array.isArray(state.backlogTodos) ? state.backlogTodos : [];
  const backlogTodos = [...unfinishedToday, ...existingBacklog]
    .filter((todo, index, array) => array.findIndex((item) => item.id === todo.id) === index)
    .map((todo) => ({ ...normalizeTodo(todo), done: false }));
  const todos = (Array.isArray(state.tomorrowTodos) ? state.tomorrowTodos : [])
    .map((todo) => ({ ...normalizeTodo(todo), done: false, carriedFrom: "" }));

  return {
    ...archived,
    day: newDay,
    tasks: clone(defaultTasks),
    todos,
    tomorrowTodos: [],
    backlogTodos,
    foodEntries: [],
    dailyReflection: createBlankReflection(newDay),
    dailyReward: createDailyReward(newDay),
    energy: 70,
    todayCoins: 0,
    todayExp: 0,
    recoveryUsedDay: "",
    coupons: archived.coupons.filter((coupon) => !isExpiredCoupon(coupon, newDay)),
    message: `昨天的戰報已自動保存：${oldTitle}。新的戰後復盤已開啟；明日待辦已搬進今天。`,
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

export default function LifeLevelingAppV14Principles() {
  const [state, setState] = useState(() => {
    const saved = loadSavedState();
    const loaded = normalizeState(saved || initialState);
    return loaded.day === todayKey() ? loaded : archiveAndStartNewDay(loaded);
  });

  const [tab, setTab] = useState("today");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [todoFormOpen, setTodoFormOpen] = useState(false);
  const [expandedReportDate, setExpandedReportDate] = useState("");
  const [todoDraft, setTodoDraft] = useState({ title: "", category: "生活", target: "today" });
  const [taskDraft, setTaskDraft] = useState({ title: "", coins: 30, group: "支線", attr: "心力" });
  const [foodDraft, setFoodDraft] = useState({ name: "", calories: "", mealType: "早餐" });
  const [weightDraft, setWeightDraft] = useState("");
  const [calorieTargetDraft, setCalorieTargetDraft] = useState("");
  const [goalWeightDraft, setGoalWeightDraft] = useState("");
  const [reflectionDraft, setReflectionDraft] = useState(() => ({ ...state.dailyReflection }));
  const [principleDraft, setPrincipleDraft] = useState({ title: "", category: "決策" });
  const [syncStatus, setSyncStatus] = useState("連線中");
  const [cloudExists, setCloudExists] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState("");
  const [syncError, setSyncError] = useState("");
  const [authReady, setAuthReady] = useState(false);
  const [authStatus, setAuthStatus] = useState("匿名連線中");

  const stateReference = useRef(state);
  const applyingRemoteReference = useRef(false);
  const cloudReadyReference = useRef(false);
  const uploadTimerReference = useRef(null);
  const lastCloudJsonReference = useRef("");
  const deviceIdReference = useRef(getDeviceId());

  useEffect(() => {
    setAuthStatus("匿名連線中");

    const unsubscribeAuth = onAuthStateChanged(sharedAuth, async (user) => {
      if (user) {
        setAuthReady(true);
        setAuthStatus("匿名連線完成");
        return;
      }

      try {
        await signInAnonymously(sharedAuth);
      } catch (error) {
        setAuthReady(false);
        setAuthStatus("匿名連線失敗");
        setSyncStatus("連線失敗");
        setSyncError(error?.message || "無法匿名登入 Firebase");
      }
    });

    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    stateReference.current = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (applyingRemoteReference.current) {
      applyingRemoteReference.current = false;
      return;
    }
    if (!authReady || !cloudReadyReference.current) return;

    const stateJson = JSON.stringify(state);
    if (stateJson === lastCloudJsonReference.current) return;

    if (uploadTimerReference.current) window.clearTimeout(uploadTimerReference.current);
    setSyncStatus("同步中");

    uploadTimerReference.current = window.setTimeout(async () => {
      try {
        const currentState = stateReference.current;
        const envelope = {
          data: currentState,
          updatedAt: Date.now(),
          updatedBy: deviceIdReference.current,
          appVersion: CLOUD_APP_VERSION,
        };
        lastCloudJsonReference.current = JSON.stringify(currentState);
        await databaseSet(sharedSaveReference, envelope);
        setCloudExists(true);
        setLastSyncAt(envelope.updatedAt);
        setSyncStatus("已同步");
        setSyncError("");
      } catch (error) {
        setSyncStatus("同步失敗");
        setSyncError(error?.message || "無法寫入 Firebase");
      }
    }, 900);

    return () => {
      if (uploadTimerReference.current) window.clearTimeout(uploadTimerReference.current);
    };
  }, [state, authReady]);

  useEffect(() => {
    if (!authReady) return undefined;

    setSyncStatus("連線中");
    const unsubscribe = onValue(
      sharedSaveReference,
      (snapshot) => {
        const envelope = snapshot.val();
        if (!envelope || !envelope.data) {
          cloudReadyReference.current = false;
          setCloudExists(false);
          setSyncStatus("雲端尚未建立");
          setSyncError("");
          return;
        }

        const loaded = normalizeState(envelope.data);
        const incoming = loaded.day === todayKey() ? loaded : archiveAndStartNewDay(loaded);
        const incomingJson = JSON.stringify(incoming);
        const currentJson = JSON.stringify(stateReference.current);

        cloudReadyReference.current = true;
        setCloudExists(true);
        setLastSyncAt(Number(envelope.updatedAt || Date.now()));
        setSyncStatus("已同步");
        setSyncError("");
        lastCloudJsonReference.current = incomingJson;

        if (incomingJson !== currentJson) {
          applyingRemoteReference.current = true;
          stateReference.current = incoming;
          setState(incoming);
        }
      },
      (error) => {
        cloudReadyReference.current = false;
        setSyncStatus("連線失敗");
        setSyncError(error?.message || "無法讀取 Firebase");
      }
    );
    return () => unsubscribe();
  }, [authReady]);

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

  useEffect(() => {
    setReflectionDraft({ ...state.dailyReflection });
  }, [state.day, state.dailyReflection?.savedAt]);

  // 賞賜一旦解鎖就鎖定，避免調整能量、勾回待辦或重整頁面洗卡。
  useEffect(() => {
    setState((previous) => {
      if (previous.day !== todayKey()) return previous;
      const currentUnlock = getRewardUnlock(previous);
      const original = previous.dailyReward || createDailyReward(previous.day);
      if (!currentUnlock.unlocked || original.claimed || original.locked) return previous;

      const selected = getAdaptiveDailyReward(previous);
      return {
        ...previous,
        dailyReward: {
          ...selected,
          locked: true,
          lockedAt: new Date().toISOString(),
        },
      };
    });
  }, [state.day, state.energy, state.tasks, state.todos]);

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
  const reward = getAdaptiveDailyReward(state);
  const villageInsight = getVillageInsight(state);
  const rewardReason = getRewardReason(state, reward);
  const seals = getSeals(state.todos);
  const mainDoneCount = getMainDoneCount(state.tasks);
  const todoDoneCount = getTodoDoneCount(state.todos);
  const fireStreak = getRecentFireStreak(state.fireLog, state.day);
  const tomorrowPlan = getTomorrowLaunchPlan(state.tomorrowTodos);
  const calorieTotal = getCalorieTotal(state.foodEntries);
  const calorieInfo = getCalorieState(calorieTotal, state.calorieTarget, state.calorieWarningLimit);
  const caloriePercent = Math.min(120, Math.round((calorieTotal / Math.max(1, state.calorieTarget)) * 100));
  const currentBmi = calculateBmi(state.currentWeight, state.heightCm);
  const weightRemaining = Math.max(0, Number(state.currentWeight || 0) - Number(state.goalWeight || 0));
  const activeBossCount = state.bossBook.filter((boss) => boss.status !== "defeated" && boss.dates.length >= 3).length;
  const corePrincipleCount = state.principles.filter((principle) => principleStage(principle.xp).label === "核心原則").length;

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
    const target = todoDraft.target || "today";

    patch((previous) => {
      if (target === "tomorrow" && previous.tomorrowTodos.length >= TOMORROW_TODO_LIMIT) {
        return { ...previous, message: `明日待辦最多先放 ${TOMORROW_TODO_LIMIT} 件。先留白，明天才有處理突發狀況的空間。` };
      }

      const todo = {
        id: `todo-${Date.now()}`,
        title,
        category: todoDraft.category,
        done: false,
        createdAt: new Date().toISOString(),
        carriedFrom: "",
      };

      return target === "tomorrow"
        ? {
            ...previous,
            tomorrowTodos: [...previous.tomorrowTodos, todo],
            message: `已排進明日待辦：「${title}」。跨日後會自動搬到今日。`,
          }
        : {
            ...previous,
            todos: [...previous.todos, todo],
            message: `已加入今日待辦：「${title}」。待辦不刷金幣，但可累積村民印記。`,
          };
    });

    setTodoDraft({ title: "", category: "生活", target: "today" });
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
      message: "已刪除一件今日待辦。",
    }));
  }

  function deleteTomorrowTodo(id) {
    patch((previous) => ({
      ...previous,
      tomorrowTodos: previous.tomorrowTodos.filter((todo) => todo.id !== id),
      message: "已從明日待辦移除。",
    }));
  }

  function moveBacklogToToday(id) {
    patch((previous) => {
      const todo = previous.backlogTodos.find((item) => item.id === id);
      if (!todo) return previous;
      return {
        ...previous,
        backlogTodos: previous.backlogTodos.filter((item) => item.id !== id),
        todos: [...previous.todos, { ...todo, done: false, carriedFrom: todo.carriedFrom || "" }],
        message: `已把「${todo.title}」搬進今日待辦。`,
      };
    });
  }

  function moveBacklogToTomorrow(id) {
    patch((previous) => {
      const todo = previous.backlogTodos.find((item) => item.id === id);
      if (!todo) return previous;
      if (previous.tomorrowTodos.length >= TOMORROW_TODO_LIMIT) {
        return { ...previous, message: `明日待辦最多 ${TOMORROW_TODO_LIMIT} 件，先留一點空白。` };
      }
      return {
        ...previous,
        backlogTodos: previous.backlogTodos.filter((item) => item.id !== id),
        tomorrowTodos: [...previous.tomorrowTodos, { ...todo, done: false }],
        message: `已把「${todo.title}」延到明日待辦。`,
      };
    });
  }

  function deleteBacklogTodo(id) {
    patch((previous) => ({
      ...previous,
      backlogTodos: previous.backlogTodos.filter((todo) => todo.id !== id),
      message: "已刪除一件未完成待辦。",
    }));
  }

  function claimVillageReward() {
    patch((previous) => {
      const currentReward = getAdaptiveDailyReward(previous);
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

  function addFoodEntry() {
    const name = foodDraft.name.trim();
    const calories = Math.round(Number(foodDraft.calories || 0));
    if (!name || calories <= 0) {
      patch((previous) => ({ ...previous, message: "請輸入食物名稱與大於 0 的熱量。" }));
      return;
    }
    patch((previous) => ({
      ...previous,
      foodEntries: [
        ...previous.foodEntries,
        {
          id: `food-${Date.now()}`,
          name,
          calories,
          mealType: foodDraft.mealType,
          createdAt: new Date().toISOString(),
        },
      ],
      message: `已記錄「${name}」${calories} kcal。先求有記，再慢慢求準。`,
    }));
    setFoodDraft({ name: "", calories: "", mealType: foodDraft.mealType });
  }

  function deleteFoodEntry(id) {
    patch((previous) => ({
      ...previous,
      foodEntries: previous.foodEntries.filter((entry) => entry.id !== id),
      message: "已刪除一筆飲食紀錄。",
    }));
  }

  function saveWeight() {
    const weight = Number(weightDraft);
    if (!weight || weight < 30 || weight > 300) {
      patch((previous) => ({ ...previous, message: "請輸入合理的體重數字。" }));
      return;
    }
    patch((previous) => ({
      ...previous,
      currentWeight: weight,
      weightHistory: [
        { date: previous.day, weight },
        ...previous.weightHistory.filter((item) => item.date !== previous.day),
      ].slice(0, MAX_REPORTS),
      message: `今天體重已記錄：${weight.toFixed(1)} kg。看趨勢，不因單日波動責怪自己。`,
    }));
    setWeightDraft("");
  }

  function saveCalorieTarget() {
    const raw = Number(calorieTargetDraft);
    if (!raw) {
      patch((previous) => ({ ...previous, message: "請輸入每日熱量目標。" }));
      return;
    }
    const target = Math.max(1200, Math.min(4000, Math.round(raw)));
    patch((previous) => ({ ...previous, calorieTarget: target, message: `每日熱量目標已調整為 ${target} kcal。` }));
    setCalorieTargetDraft("");
  }

  function saveGoalWeight() {
    const raw = Number(goalWeightDraft);
    if (!raw) {
      patch((previous) => ({ ...previous, message: "請輸入目標體重。" }));
      return;
    }
    const goal = Math.max(40, Math.min(200, raw));
    patch((previous) => ({ ...previous, goalWeight: goal, message: `目標體重已調整為 ${goal.toFixed(1)} kg。` }));
    setGoalWeightDraft("");
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
      const hasProgress = previous.tasks.some((task) => task.done) || previous.todos.some((todo) => todo.done) || previous.foodEntries.length > 0;
      if (hasProgress) {
        return { ...previous, message: "今天已有完成紀錄，為避免刷金幣與重抽賞賜，不能重置。未完成的待辦可直接刪掉重建。" };
      }
      if (!window.confirm("確定清空今天尚未完成的自訂事件與待辦？固定人生主線與封印賞賜會保留。")) return previous;
      return {
        ...previous,
        tasks: clone(defaultTasks),
        todos: [],
        foodEntries: [],
        energy: 70,
        message: "今日清單已整理；明日待辦與未完成待辦不會被清掉。",
      };
    });
  }

  async function uploadLocalAsCloudMain() {
    if (!authReady) {
      setSyncStatus("等待匿名連線");
      setSyncError("Firebase 匿名連線尚未完成，請等幾秒再試。");
      return;
    }
    const current = stateReference.current;
    const confirmed = window.confirm(
      `確定把這台裝置的資料設成三端共用主檔？\n目前金幣：${current.coins}\n目前等級：Lv.${Math.floor(current.exp / 100) + 1}\n\n第一次請只在資料完整的安卓手機執行。`
    );
    if (!confirmed) return;

    setSyncStatus("上傳中");
    try {
      const existingSnapshot = await get(sharedSaveReference);
      if (existingSnapshot.exists()) {
        const backupReference = databaseRef(sharedDatabase, `${CLOUD_BACKUP_PATH}/${Date.now()}`);
        await databaseSet(backupReference, existingSnapshot.val());
      }

      const envelope = {
        data: current,
        updatedAt: Date.now(),
        updatedBy: deviceIdReference.current,
        appVersion: CLOUD_APP_VERSION,
      };
      lastCloudJsonReference.current = JSON.stringify(current);
      cloudReadyReference.current = true;
      await databaseSet(sharedSaveReference, envelope);
      setCloudExists(true);
      setLastSyncAt(envelope.updatedAt);
      setSyncStatus("已同步");
      setSyncError("");
      patch((previous) => ({ ...previous, message: "這台裝置的資料已上傳為三端共用主檔。" }));
    } catch (error) {
      setSyncStatus("上傳失敗");
      setSyncError(error?.message || "無法上傳 Firebase");
    }
  }

  async function downloadCloudMain() {
    if (!authReady) {
      setSyncStatus("等待匿名連線");
      setSyncError("Firebase 匿名連線尚未完成，請等幾秒再試。");
      return;
    }
    setSyncStatus("下載中");
    try {
      const snapshot = await get(sharedSaveReference);
      const envelope = snapshot.val();
      if (!envelope || !envelope.data) {
        setCloudExists(false);
        setSyncStatus("雲端尚未建立");
        setSyncError("");
        return;
      }

      const loaded = normalizeState(envelope.data);
      const incoming = loaded.day === todayKey() ? loaded : archiveAndStartNewDay(loaded);
      const incomingJson = JSON.stringify(incoming);
      lastCloudJsonReference.current = incomingJson;
      applyingRemoteReference.current = true;
      stateReference.current = incoming;
      setState(incoming);
      cloudReadyReference.current = true;
      setCloudExists(true);
      setLastSyncAt(Number(envelope.updatedAt || Date.now()));
      setSyncStatus("已同步");
      setSyncError("");
      setTab("today");
    } catch (error) {
      setSyncStatus("下載失敗");
      setSyncError(error?.message || "無法下載 Firebase");
    }
  }

  function saveDailyReflection() {
    const didRight = String(reflectionDraft.didRight || "").trim();
    const stuck = String(reflectionDraft.stuck || "").trim();
    const nextRule = String(reflectionDraft.nextRule || "").trim();
    const bossTag = String(reflectionDraft.bossTag || "").trim();

    if (!didRight && !stuck && !nextRule) {
      patch((previous) => ({ ...previous, message: "戰後復盤至少寫一項：做對、卡住，或下次原則。" }));
      return;
    }

    patch((previous) => {
      const alreadyRecorded = previous.reflectionHistory.some((item) => item.date === previous.day);
      const record = {
        date: previous.day,
        didRight,
        stuck,
        nextRule,
        bossTag,
        savedAt: new Date().toISOString(),
      };

      let bossBook = previous.bossBook;
      if (bossTag) {
        const normalizedTag = bossTag.toLocaleLowerCase("zh-TW");
        const existing = bossBook.find((boss) => boss.name.toLocaleLowerCase("zh-TW") === normalizedTag);
        if (existing) {
          const dates = existing.dates.includes(previous.day) ? existing.dates : [...existing.dates, previous.day];
          bossBook = bossBook.map((boss) => boss.id === existing.id
            ? { ...boss, dates, firstSeen: boss.firstSeen || dates[0], lastSeen: previous.day }
            : boss
          );
        } else {
          bossBook = [
            {
              id: `boss-${Date.now()}`,
              name: bossTag,
              dates: [previous.day],
              firstSeen: previous.day,
              lastSeen: previous.day,
              status: "active",
            },
            ...bossBook,
          ];
        }
      }

      return {
        ...previous,
        dailyReflection: record,
        reflectionHistory: [record, ...previous.reflectionHistory.filter((item) => item.date !== previous.day)].slice(0, MAX_REFLECTIONS),
        bossBook,
        wisdom: previous.wisdom + (alreadyRecorded ? 0 : 10),
        message: alreadyRecorded
          ? "今日戰後復盤已更新。修改內容不重複刷智慧值。"
          : "完成今日戰後復盤：智慧 +10。失敗已轉成情報，不扣分。",
      };
    });
  }

  function promoteReflectionToPrinciple() {
    patch((previous) => {
      const title = String(previous.dailyReflection?.nextRule || reflectionDraft.nextRule || "").trim();
      if (!title) return { ...previous, message: "先在『下次遇到同類事情，我要怎麼做？』寫下一條規則。" };
      const duplicate = previous.principles.find((item) => item.title.toLocaleLowerCase("zh-TW") === title.toLocaleLowerCase("zh-TW"));
      if (duplicate) return { ...previous, message: `「${title}」已經在原則之書，不重複建立。` };

      const principle = {
        id: `principle-${Date.now()}`,
        title,
        category: "決策",
        createdAt: new Date().toISOString(),
        sourceDate: previous.day,
        usageDates: [],
        xp: 0,
      };
      return {
        ...previous,
        principles: [principle, ...previous.principles].slice(0, MAX_PRINCIPLES),
        wisdom: previous.wisdom + 5,
        message: `已提煉新原則：「${title}」。智慧 +5，接下來靠實際驗證升級。`,
      };
    });
  }

  function addManualPrinciple() {
    const title = String(principleDraft.title || "").trim();
    if (!title) return;
    patch((previous) => {
      const duplicate = previous.principles.find((item) => item.title.toLocaleLowerCase("zh-TW") === title.toLocaleLowerCase("zh-TW"));
      if (duplicate) return { ...previous, message: `「${title}」已經存在。` };
      const principle = {
        id: `principle-${Date.now()}`,
        title,
        category: principleDraft.category || "決策",
        createdAt: new Date().toISOString(),
        sourceDate: "",
        usageDates: [],
        xp: 0,
      };
      return { ...previous, principles: [principle, ...previous.principles].slice(0, MAX_PRINCIPLES), message: `已加入實驗原則：「${title}」。` };
    });
    setPrincipleDraft({ title: "", category: "決策" });
  }

  function markPrincipleUsed(id) {
    patch((previous) => {
      const principle = previous.principles.find((item) => item.id === id);
      if (!principle) return previous;
      if (principle.usageDates.includes(previous.day)) {
        return { ...previous, message: "這條原則今天已驗證過一次，不能靠重複點擊刷智慧值。" };
      }
      const usageDates = [...principle.usageDates, previous.day];
      const xp = Number(principle.xp || 0) + 1;
      const stage = principleStage(xp);
      return {
        ...previous,
        principles: previous.principles.map((item) => item.id === id ? { ...item, usageDates, xp } : item),
        wisdom: previous.wisdom + 2,
        message: `原則驗證 +1、智慧 +2。目前：${stage.label}。`,
      };
    });
  }

  function deletePrinciple(id) {
    patch((previous) => ({
      ...previous,
      principles: previous.principles.filter((item) => item.id !== id),
      message: "已從原則之書移除。",
    }));
  }

  function setBossStatus(id, status) {
    patch((previous) => ({
      ...previous,
      bossBook: previous.bossBook.map((boss) => boss.id === id ? { ...boss, status } : boss),
      message: status === "defeated" ? "這隻 Boss 已標記為破解。之後若再次出現，紀錄仍會保留。" : "Boss 已重新列入戰鬥中。",
    }));
  }

  function hardReset() {
    if (!window.confirm("確定全部重來？這會清空本機資料，並在同步後清空安卓、iPad、電腦共用主檔。")) return;
    setState(clone(initialState));
    setTab("today");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 bg-slate-900 sm:rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800">
        <header className="p-5 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.16),transparent_38%),linear-gradient(135deg,#1e293b,#020617)]">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="min-w-0">
              <p className="text-sm text-slate-400">人生打怪村 v14 原則之書</p>
              <h1 className="text-3xl font-black tracking-tight mt-1">邱顯明 Lv.{level}</h1>
              <div className="inline-flex mt-2 px-3 py-1 rounded-full bg-amber-300/15 border border-amber-300/30 text-amber-300 text-sm font-bold">
                {getPlayerTitle(level)}
              </div>
              <p className="text-xs text-slate-500 mt-2">{state.day}・{syncStatus}</p>
            </div>
            <div className="w-16 h-16 rounded-3xl bg-amber-400/15 border border-amber-300/40 flex items-center justify-center shadow-[0_0_28px_rgba(251,191,36,0.18)]">
              <span className="text-3xl font-black text-amber-300">村</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2">
            <StatCard label="金幣" value={state.coins} />
            <StatCard label="智慧" value={state.wisdom} />
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
            <p className="text-xs text-slate-500 mt-3">每日金幣上限 {DAILY_COIN_CAP}；熱量目標 {calorieTotal}/{state.calorieTarget} kcal，提醒線 {state.calorieWarningLimit} kcal。</p>
            {isSurvival && <p className="text-sm text-amber-300 mt-2">保命模式已啟動：今天只要求不斷線。</p>}
          </div>
        </div>

        <nav className="px-4 grid grid-cols-3 gap-2 pb-2 sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          {[
            ["today", "今日"],
            ["principles", "原則"],
            ["reward", "賞賜"],
            ["calorie", "熱量"],
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
              <VillageRewardCard reward={reward} unlock={unlock} insight={villageInsight} reason={rewardReason} onClaim={claimVillageReward} />
              <VillageInsightCard insight={villageInsight} mainDone={mainDoneCount} todoDone={todoDoneCount} seals={seals} streak={fireStreak} />

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
                ＋ 新增待辦（今天／明天）
              </button>

              {todoFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <TextInput label="待辦名稱" value={todoDraft.title} onChange={(value) => setTodoDraft({ ...todoDraft, title: value })} placeholder="例如：回覆王先生、買奶粉、繳帳單" />
                  <SelectInput label="分類" value={todoDraft.category} onChange={(value) => setTodoDraft({ ...todoDraft, category: value })} options={["工作", "家庭", "生活"]} />
                  <SelectInput label="放進哪一天" value={todoDraft.target} onChange={(value) => setTodoDraft({ ...todoDraft, target: value })} options={[{ value: "today", label: "今天" }, { value: "tomorrow", label: "明天" }]} />
                  <button onClick={addTodo} className="w-full bg-blue-300 text-slate-950 rounded-2xl py-3 font-black">{todoDraft.target === "tomorrow" ? "排進明日待辦" : "加入今日待辦"}</button>
                </div>
              )}

              <div className="pt-2 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">明日待辦</h2>
                  <p className="text-sm text-slate-400 mt-1">睡前先排 1～3 件；跨日後會自動搬進今日，不算今天印記。</p>
                </div>
                <div className="rounded-2xl bg-sky-300/10 border border-sky-300/25 px-3 py-2 text-center shrink-0">
                  <div className="text-xs text-slate-400">已排</div>
                  <div className="font-black text-sky-200">{state.tomorrowTodos.length}/{TOMORROW_TODO_LIMIT}</div>
                </div>
              </div>

              <TomorrowLaunchCard plan={tomorrowPlan} />

              {state.tomorrowTodos.length === 0 ? (
                <div className="bg-slate-800 border border-dashed border-slate-600 rounded-3xl p-4 text-sm text-slate-400">還沒安排也沒關係。睡前想到明天一定要做的事，再放進來就好。</div>
              ) : (
                <div className="space-y-2">
                  {state.tomorrowTodos.map((todo) => <TomorrowTodoCard key={todo.id} todo={todo} onDelete={deleteTomorrowTodo} />)}
                </div>
              )}

              {state.backlogTodos.length > 0 && (
                <div className="pt-2 space-y-2">
                  <div>
                    <h2 className="text-2xl font-black">未完成待辦</h2>
                    <p className="text-sm text-slate-400 mt-1">昨天沒做完的事不會硬塞進今天。你自己決定要搬、延後或刪掉。</p>
                  </div>
                  {state.backlogTodos.map((todo) => <BacklogTodoCard key={todo.id} todo={todo} onToday={moveBacklogToToday} onTomorrow={moveBacklogToTomorrow} onDelete={deleteBacklogTodo} />)}
                </div>
              )}
            </section>
          )}

          {tab === "principles" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-black">原則之書</h2>
                <p className="text-sm text-slate-400 mt-1">流程：事件 → 復盤 → 提煉原則 → 實際驗證。失敗不扣分，能看懂失敗就有價值。</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <RecordBox label="智慧值" value={state.wisdom} />
                <RecordBox label="原則" value={state.principles.length} />
                <RecordBox label="活躍 Boss" value={activeBossCount} />
              </div>

              <div className="bg-slate-800 border border-amber-400/30 rounded-3xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-amber-300 font-bold">每日一次・智慧 +10</p>
                    <h3 className="text-lg font-black mt-1">戰後復盤</h3>
                  </div>
                  <span className="text-xs rounded-full border border-slate-600 px-2 py-1 text-slate-400">{state.day}</span>
                </div>
                <TextAreaInput label="1. 今天做對了什麼？" value={reflectionDraft.didRight} onChange={(value) => setReflectionDraft((draft) => ({ ...draft, didRight: value }))} placeholder="例如：雖然不想打電話，還是先完成第一通。" />
                <TextAreaInput label="2. 今天哪裡卡住／失敗？" value={reflectionDraft.stuck} onChange={(value) => setReflectionDraft((draft) => ({ ...draft, stuck: value }))} placeholder="寫事實，不需要責怪自己。" />
                <TextAreaInput label="3. 下次遇到同類事情，我要怎麼做？" value={reflectionDraft.nextRule} onChange={(value) => setReflectionDraft((draft) => ({ ...draft, nextRule: value }))} placeholder="例如：害怕開始時，只要求自己先做 10 分鐘。" />
                <TextInput label="Boss 標籤（可選，同一問題請用同一名稱）" value={reflectionDraft.bossTag} onChange={(value) => setReflectionDraft((draft) => ({ ...draft, bossTag: value }))} placeholder="例如：拖延、衝動消費、熬夜" />
                <button onClick={saveDailyReflection} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black">保存今日復盤</button>
                {(state.dailyReflection?.nextRule || reflectionDraft.nextRule) && (
                  <button onClick={promoteReflectionToPrinciple} className="w-full rounded-2xl bg-slate-950 text-amber-200 border border-amber-300/30 h-12 font-black">把第 3 題提煉成原則</button>
                )}
                <p className="text-xs text-slate-500 leading-relaxed">同一天修改復盤不會重複加智慧；Boss 標籤一天最多只記 1 次。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500">建立後要靠實際行動驗證</p>
                  <h3 className="text-lg font-black">我的原則</h3>
                </div>
                <TextInput label="新增一條原則" value={principleDraft.title} onChange={(value) => setPrincipleDraft((draft) => ({ ...draft, title: value }))} placeholder="例如：重大決定至少寫出三個方案。" />
                <SelectInput label="分類" value={principleDraft.category} onChange={(value) => setPrincipleDraft((draft) => ({ ...draft, category: value }))} options={["工作", "金錢", "家庭", "健康", "學習", "決策"]} />
                <button onClick={addManualPrinciple} className="w-full rounded-2xl bg-slate-700 text-white h-11 font-black">＋ 加入實驗原則</button>

                {state.principles.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-600 p-4 text-sm text-slate-400">還沒有原則。今晚先做一次戰後復盤，從真實事件裡提煉第一條。</div>
                ) : (
                  <div className="space-y-3 pt-1">
                    {state.principles.map((principle) => {
                      const stage = principleStage(principle.xp);
                      const usedToday = principle.usageDates.includes(state.day);
                      return (
                        <div key={principle.id} className="rounded-2xl bg-slate-950 border border-slate-700 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex gap-2 flex-wrap mb-2">
                                <span className="text-[10px] px-2 py-1 rounded-full bg-blue-300/15 text-blue-200 border border-blue-300/20">{principle.category}</span>
                                <span className="text-[10px] px-2 py-1 rounded-full bg-amber-300/15 text-amber-200 border border-amber-300/20">{stage.label}</span>
                              </div>
                              <h4 className="font-black leading-relaxed">{principle.title}</h4>
                              <p className="text-xs text-slate-500 mt-2">已驗證 {principle.xp} 次・{stage.next}</p>
                            </div>
                            <button onClick={() => deletePrinciple(principle.id)} className="text-slate-600 hover:text-rose-400 p-1">✕</button>
                          </div>
                          <button onClick={() => markPrincipleUsed(principle.id)} disabled={usedToday} className={`w-full mt-3 rounded-xl h-10 text-sm font-black ${usedToday ? "bg-emerald-950 text-emerald-300 border border-emerald-500/30" : "bg-emerald-300 text-emerald-950"}`}>{usedToday ? "今天已照做 ✓" : "今天有照這條原則做"}</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="bg-slate-800 border border-rose-400/25 rounded-3xl p-4 space-y-3">
                <div className="flex items-end justify-between gap-3">
                  <div><p className="text-xs text-rose-300">同名問題重複 3 天＝Boss 成形</p><h3 className="text-lg font-black mt-1">Boss 圖鑑</h3></div>
                  <span className="text-xs text-slate-500">核心原則 {corePrincipleCount}</span>
                </div>
                {state.bossBook.length === 0 ? (
                  <p className="text-sm text-slate-400">目前沒有 Boss 紀錄。復盤時填入問題標籤，系統會自動累積。</p>
                ) : (
                  state.bossBook.map((boss) => {
                    const count = boss.dates.length;
                    const defeated = boss.status === "defeated";
                    return (
                      <div key={boss.id} className={`rounded-2xl border p-3 ${defeated ? "bg-emerald-950/25 border-emerald-500/25" : count >= 3 ? "bg-rose-950/30 border-rose-400/35" : "bg-slate-950 border-slate-700"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div><h4 className="font-black">{boss.name}</h4><p className="text-xs text-slate-400 mt-1">出現 {count} 天・{bossRank(count)}・最近 {boss.lastSeen}</p></div>
                          <span className={`text-xs px-2 py-1 rounded-full ${defeated ? "bg-emerald-300 text-emerald-950" : "bg-rose-300/15 text-rose-200"}`}>{defeated ? "已破解" : "戰鬥中"}</span>
                        </div>
                        <button onClick={() => setBossStatus(boss.id, defeated ? "active" : "defeated")} className="w-full mt-3 rounded-xl bg-slate-800 border border-slate-700 h-9 text-xs font-black">{defeated ? "重新列入戰鬥" : "標記已破解"}</button>
                      </div>
                    );
                  })
                )}
              </div>

              {state.reflectionHistory.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                  <h3 className="font-black">最近復盤</h3>
                  <div className="space-y-3 mt-3">
                    {state.reflectionHistory.slice(0, 7).map((item) => (
                      <div key={item.date} className="rounded-2xl bg-slate-950 border border-slate-700 p-3">
                        <p className="text-xs text-amber-300 font-bold">{item.date}{item.bossTag ? `・Boss：${item.bossTag}` : ""}</p>
                        {item.stuck && <p className="text-sm text-slate-300 mt-2">卡住：{item.stuck}</p>}
                        {item.nextRule && <p className="text-sm text-emerald-200 mt-1">下次：{item.nextRule}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {tab === "reward" && (
            <section className="space-y-4">
              <h2 className="text-2xl font-black">賞賜與目標</h2>
              <VillageInsightCard insight={villageInsight} mainDone={mainDoneCount} todoDone={todoDoneCount} seals={seals} streak={fireStreak} compact />
              <VillageRewardCard reward={reward} unlock={unlock} insight={villageInsight} reason={rewardReason} onClaim={claimVillageReward} compact />
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">村長規則</h3>
                <p className="text-sm text-slate-400 leading-relaxed mt-2">食物不再當主要獎勵。每天的即時回饋交給村長；金幣留給撞球、完整娛樂、家庭戶外時間與人生目標。減重不是取消快樂，而是把快樂從進食之外重新建立。賞賜卡解鎖後就鎖定，重整不能洗卡。</p>
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
                <h3 className="font-black text-lg mb-2">非食物中獎與大獎</h3>
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

          {tab === "calorie" && (
            <section className="space-y-4">
              <div>
                <h2 className="text-2xl font-black">熱量守門</h2>
                <p className="text-sm text-slate-400 mt-1">目標不是每口都算到完美，而是先知道每天大概吃了多少。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm text-slate-400">今日攝取</p>
                    <p className="text-3xl font-black mt-1">{calorieTotal} <span className="text-base text-slate-400">/ {state.calorieTarget} kcal</span></p>
                    <p className="text-xs text-slate-500 mt-1">提醒上限：{state.calorieWarningLimit} kcal</p>
                    <p className={`text-sm mt-2 ${calorieInfo.tone === "good" ? "text-emerald-300" : calorieInfo.tone === "empty" ? "text-slate-400" : "text-amber-300"}`}>{calorieInfo.label}：{calorieInfo.message}</p>
                  </div>
                  <div className="rounded-2xl bg-emerald-300/10 border border-emerald-300/25 px-3 py-2 text-center shrink-0">
                    <div className="text-xs text-slate-400">剩餘</div>
                    <div className="font-black text-emerald-200">{Math.max(0, state.calorieTarget - calorieTotal)}</div>
                  </div>
                </div>
                <div className="h-3 bg-slate-950 rounded-full overflow-hidden mt-4">
                  <div className={`h-full ${caloriePercent <= 100 ? "bg-emerald-400" : "bg-amber-400"}`} style={{ width: `${Math.min(100, caloriePercent)}%` }} />
                </div>
                {caloriePercent > 100 && <p className="text-xs text-amber-300 mt-2">超出目標不扣金幣、不處罰，也不要隔天餓肚子補償。</p>}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <h3 className="font-black">新增飲食</h3>
                <SelectInput label="餐別" value={foodDraft.mealType} onChange={(value) => setFoodDraft({ ...foodDraft, mealType: value })} options={mealTypeOptions} />
                <TextInput label="吃了什麼" value={foodDraft.name} onChange={(value) => setFoodDraft({ ...foodDraft, name: value })} placeholder="例如：雞腿便當、拿鐵、兩顆蛋" />
                <TextInput label="估計熱量 kcal" type="number" value={foodDraft.calories} onChange={(value) => setFoodDraft({ ...foodDraft, calories: value })} placeholder="例如：650" />
                <button onClick={addFoodEntry} className="w-full rounded-2xl bg-emerald-300 text-emerald-950 h-12 font-black">加入今日熱量</button>
              </div>

              <div className="space-y-2">
                <h3 className="font-black text-lg">今日飲食紀錄</h3>
                {state.foodEntries.length === 0 ? (
                  <div className="bg-slate-800 border border-dashed border-slate-600 rounded-3xl p-4 text-sm text-slate-400">先記最容易超量的項目：便當、飲料、宵夜、零食。估算也比完全不記好。</div>
                ) : state.foodEntries.map((entry) => (
                  <div key={entry.id} className="bg-slate-800 border border-slate-700 rounded-2xl p-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold truncate">{entry.name}</p>
                      <p className="text-xs text-slate-400 mt-1">{entry.mealType}・{entry.calories} kcal</p>
                    </div>
                    <button onClick={() => deleteFoodEntry(entry.id)} className="text-slate-500 hover:text-rose-300 px-2">刪</button>
                  </div>
                ))}
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <div className="flex justify-between gap-3 items-start">
                  <div>
                    <h3 className="font-black">體重進度</h3>
                    <p className="text-sm text-slate-400 mt-1">目前 {Number(state.currentWeight).toFixed(1)} kg・目標 {Number(state.goalWeight).toFixed(1)} kg・尚差 {weightRemaining.toFixed(1)} kg</p>
                    <p className="text-xs text-slate-500 mt-1">依身高 {state.heightCm} cm，現在 BMI 約 {currentBmi.toFixed(1)}。看每週趨勢，不看單日水分波動。</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <input type="number" step="0.1" value={weightDraft} onChange={(event) => setWeightDraft(event.target.value)} placeholder="今天體重" className="flex-1 min-w-0 bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-emerald-400" />
                  <button onClick={saveWeight} className="rounded-2xl bg-emerald-300 text-emerald-950 px-4 font-black">記錄</button>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <h3 className="font-black">目標設定</h3>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><TextInput label={`每日熱量目標（目前 ${state.calorieTarget}）`} type="number" value={calorieTargetDraft} onChange={setCalorieTargetDraft} placeholder="例如：1900" /></div>
                  <button onClick={saveCalorieTarget} className="rounded-2xl bg-slate-700 text-white px-4 h-11 font-bold">更新</button>
                </div>
                <div className="flex gap-2 items-end">
                  <div className="flex-1"><TextInput label={`目標體重（目前 ${Number(state.goalWeight).toFixed(1)} kg）`} type="number" value={goalWeightDraft} onChange={setGoalWeightDraft} placeholder="例如：69" /></div>
                  <button onClick={saveGoalWeight} className="rounded-2xl bg-slate-700 text-white px-4 h-11 font-bold">更新</button>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">目前以 1900 kcal 為每日目標、2000 kcal 為提醒線。超過不扣金幣、不判定失敗；先觀察兩週體重平均再調整。這是行為紀錄工具，不是醫療處方。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-black">最近熱量紀錄</h3>
                {state.calorieHistory.length === 0 ? (
                  <p className="text-sm text-slate-400 mt-2">跨日後，今天總熱量會自動封存。</p>
                ) : (
                  <div className="mt-3 space-y-2 max-h-60 overflow-y-auto pr-1">
                    {state.calorieHistory.slice(0, 14).map((item) => (
                      <div key={item.date} className="flex justify-between border-b border-slate-700 pb-2 last:border-0 text-sm">
                        <span>{item.date}</span>
                        <span className={item.total <= item.target ? "text-emerald-300" : "text-amber-300"}>{item.total}/{item.target} kcal</span>
                      </div>
                    ))}
                  </div>
                )}
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
                        <div><p className="text-sm font-bold">{item.date}・{item.title}</p><p className="text-xs text-slate-500">{poolLabel(item.pool)}{item.insightTitle ? `・${item.insightTitle}` : ""}</p></div>
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
                          <div className="text-slate-500 text-xs mt-1">+{item.coins || 0} 金幣 / +{item.exp || 0} EXP / 熱量 {item.calorieTotal || 0}/{item.calorieTarget || state.calorieTarget} / 明日已排 {item.tomorrowTotal || 0} 件</div>
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
              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4"><h3 className="font-black">v14 原則之書</h3><p className="text-sm text-slate-300 leading-relaxed mt-2">保留 v13.3 的三端安靜同步與全部既有資料；新增戰後復盤、智慧值、原則之書與 Boss 圖鑑，全部一起同步。</p></div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div>
                    <h3 className="font-black">三端共用存檔</h3>
                    <p className="text-sm text-slate-300 mt-1">狀態：{syncStatus}</p>
                    <p className="text-xs text-slate-500 mt-1">Firebase：{authStatus}</p>
                    <p className="text-xs text-slate-500 mt-1">{cloudExists ? `上次同步：${formatSyncTime(lastSyncAt)}` : "雲端目前是空的，尚未建立共用主檔。"}</p>
                    {syncError && <p className="text-xs text-rose-300 mt-2 break-words">{syncError}</p>}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full border ${cloudExists ? "bg-emerald-300/10 text-emerald-300 border-emerald-300/30" : "bg-amber-300/10 text-amber-300 border-amber-300/30"}`}>
                    {cloudExists ? "雲端已建立" : "等待首次上傳"}
                  </span>
                </div>
                <div className="rounded-2xl bg-slate-950 border border-slate-700 p-3 text-sm text-slate-300 leading-relaxed">
                  第一次部署後，請先在目前有 1895 金幣與完整紀錄的安卓手機，按「上傳這台資料為主檔」。成功後再開 iPad 和電腦。
                </div>
                <button onClick={uploadLocalAsCloudMain} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black">上傳這台資料為共用主檔</button>
                <button onClick={downloadCloudMain} disabled={!cloudExists} className={`w-full rounded-2xl h-12 font-black ${cloudExists ? "bg-emerald-300 text-emerald-950" : "bg-slate-700 text-slate-500"}`}>下載雲端主檔到這台</button>
                <p className="text-xs text-slate-500 leading-relaxed">雲端主檔建立後，平常每次修改約 1 秒自動同步。兩台同時修改時，以最後寫入的內容為準。</p>
                <p className="text-xs text-emerald-300/80 leading-relaxed">v14 延續匿名驗證，不需要公開整個資料庫，可把 Firebase 規則改成 auth != null，避免公開規則警告信一直寄來。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4"><h3 className="font-black">本機備援</h3><p className="text-sm text-slate-300 leading-relaxed mt-2">仍固定使用 life-leveling-main-save。斷網時可繼續操作，恢復連線後會把最新本機狀態同步到公開共用主檔。</p></div>
              <button onClick={repairTasks} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black">修復預設人生主線</button>
              <button onClick={hardReset} className="w-full rounded-2xl bg-rose-900/80 text-rose-100 h-12 font-bold">全部重來</button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function VillageRewardCard({ reward, unlock, insight, reason, onClaim, compact = false }) {
  const revealed = unlock.unlocked || reward.claimed || reward.locked;
  return (
    <div className={`rounded-3xl border p-4 shadow-[0_12px_30px_rgba(0,0,0,0.22)] ${revealed ? "bg-slate-800 border-amber-400/40" : "bg-slate-900 border-slate-700"}`}>
      <div className="flex justify-between items-start gap-3">
        <div>
          <p className="text-sm text-slate-300">村長今日封印賞賜</p>
          <h2 className="text-xl font-black mt-1">{revealed ? reward.title : "？？？封印賞賜卡"}</h2>
        </div>
        <span className={`text-xs px-2 py-1 rounded-full border font-bold ${revealed ? rewardPoolClass(reward.pool) : "bg-slate-700 text-slate-300 border-slate-600"}`}>{revealed ? poolLabel(reward.pool) : "封印中"}</span>
      </div>
      {revealed ? (
        <>
          {reward.issueMode !== "每日抽選" && <p className="text-xs text-amber-300 mt-2">{reward.issueMode}：{reward.overrideReason}</p>}
          <p className="text-sm text-slate-300 leading-relaxed mt-3">{reward.description}</p>
          {!compact && <p className="text-xs text-amber-200/90 mt-3">村長的話：{reward.villageLine}</p>}
          <div className="mt-3 rounded-2xl bg-slate-950/70 border border-slate-700 p-3">
            <p className="text-xs text-slate-500">為什麼是這張卡</p>
            <p className="text-sm text-slate-300 leading-relaxed mt-1">{reason}</p>
          </div>
          <button onClick={onClaim} disabled={reward.claimed} className={`w-full mt-4 rounded-2xl h-12 font-black ${reward.claimed ? "bg-slate-700 text-slate-400" : "bg-amber-300 text-slate-950"}`}>
            {reward.claimed ? "今日賞賜已領取" : "領取村長賞賜"}
          </button>
        </>
      ) : (
        <>
          <p className="text-sm text-slate-400 leading-relaxed mt-3">今天先不告訴你是什麼。卡片會在解鎖當下鎖定，重整也不會換。</p>
          <div className="mt-3 rounded-2xl bg-slate-950 border border-slate-800 p-3"><p className="text-xs text-slate-500">{unlock.label}</p><p className="font-bold text-white mt-1">{unlock.detail}</p><p className="text-xs text-amber-300 mt-2">目前進度：{unlock.progress}</p></div>
          {!compact && <p className="text-xs text-slate-500 mt-3">村長目前判讀：{insight.title}。{insight.nextStep}</p>}
        </>
      )}
    </div>
  );
}

function VillageInsightCard({ insight, mainDone, todoDone, seals, streak, compact = false }) {
  return (
    <div className="rounded-3xl bg-slate-800 border border-slate-700 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm text-slate-300">今日村長觀察</p>
          <h3 className="text-lg font-black mt-1">{insight.title}</h3>
          <p className="text-xs text-amber-300 mt-1">{insight.label}</p>
        </div>
        <span className="text-2xl">村</span>
      </div>
      <p className="text-sm text-slate-300 leading-relaxed mt-3">{insight.message}</p>
      {!compact && <div className="mt-3 rounded-2xl bg-slate-950/70 border border-slate-700 p-3"><p className="text-xs text-slate-500">村長建議的下一步</p><p className="text-sm font-bold text-white mt-1">{insight.nextStep}</p></div>}
      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <MiniVillageStat label="主線" value={mainDone} />
        <MiniVillageStat label="待辦" value={todoDone} />
        <MiniVillageStat label="印記" value={`${seals}/3`} />
        <MiniVillageStat label="連火" value={streak ? `${streak}天` : "0"} />
      </div>
    </div>
  );
}

function MiniVillageStat({ label, value }) {
  return <div className="rounded-xl bg-slate-950 border border-slate-800 p-2"><p className="text-[10px] text-slate-500">{label}</p><p className="text-sm font-black text-amber-200 mt-1">{value}</p></div>;
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

function TomorrowTodoCard({ todo, onDelete }) {
  return (
    <div className="rounded-2xl border border-sky-400/30 bg-sky-950/25 p-3 flex gap-3 items-center">
      <div className="w-9 h-9 rounded-full shrink-0 border border-sky-300/35 text-sky-200 flex items-center justify-center font-black">明</div>
      <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className="font-bold break-words text-white">{todo.title}</h3><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${todoCategoryClass(todo.category)}`}>{todo.category}</span></div><p className="text-xs text-sky-200/80 mt-1">跨日後會自動搬進今日待辦</p></div>
      <button onClick={() => onDelete(todo.id)} className="text-slate-500 hover:text-rose-400 p-1">✕</button>
    </div>
  );
}

function BacklogTodoCard({ todo, onToday, onTomorrow, onDelete }) {
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-950/20 p-3">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full shrink-0 border border-rose-300/35 text-rose-200 flex items-center justify-center font-black">待</div>
        <div className="flex-1 min-w-0"><div className="flex items-center gap-2"><h3 className="font-bold break-words text-white">{todo.title}</h3><span className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ${todoCategoryClass(todo.category)}`}>{todo.category}</span></div><p className="text-xs text-slate-500 mt-1">原本：{todo.carriedFrom || "昨天"}</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <button onClick={() => onToday(todo.id)} className="rounded-xl bg-blue-300 text-slate-950 px-2 py-2 text-xs font-black">搬到今天</button>
        <button onClick={() => onTomorrow(todo.id)} className="rounded-xl bg-sky-300/15 text-sky-100 border border-sky-300/30 px-2 py-2 text-xs font-black">延到明天</button>
        <button onClick={() => onDelete(todo.id)} className="rounded-xl bg-slate-800 text-slate-300 border border-slate-700 px-2 py-2 text-xs font-black">刪除</button>
      </div>
    </div>
  );
}

function TomorrowLaunchCard({ plan }) {
  const tone = plan.tone === "good" ? "border-emerald-400/35 bg-emerald-950/25" : plan.tone === "full" ? "border-amber-400/35 bg-amber-950/25" : "border-slate-700 bg-slate-800";
  return (
    <div className={`rounded-3xl border p-4 ${tone}`}>
      <p className="text-sm text-slate-300">村長的明日開局提醒</p>
      <h3 className="font-black text-lg mt-1">{plan.title}</h3>
      <p className="text-sm text-slate-300 leading-relaxed mt-2">{plan.message}</p>
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

function TextAreaInput({ label, value, onChange, placeholder }) {
  return <div><label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label><textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-400 resize-none" /></div>;
}

function SelectInput({ label, value, onChange, options }) {
  return <div><label className="block text-xs text-slate-400 mb-1 font-bold">{label}</label><select value={value} onChange={(event) => onChange(event.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 h-11 text-sm text-white focus:outline-none focus:border-amber-400">{options.map((option) => { const optionValue = typeof option === "string" ? option : option.value; const optionLabel = typeof option === "string" ? option : option.label; return <option key={optionValue} value={optionValue}>{optionLabel}</option>; })}</select></div>;
}
