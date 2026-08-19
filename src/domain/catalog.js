export const DAILY_COIN_LIMIT = 300;
export const TOMORROW_LIMIT = 5;
export const HISTORY_LIMIT = 100;
export const DEFAULT_ENERGY = 70;

export const CORE_TASKS = [
  {
    key: "lifeline",
    title: "今日開機",
    detail: "喝水、整理自己，讓今天先上線。",
    criterion: "至少完成一個讓自己進入狀態的小動作。",
    lane: "主線",
    type: "保命任務",
    rank: "E",
    coins: 20,
    xp: 10,
    energyCost: 1,
    stat: "心力",
    statXp: 10,
  },
  {
    key: "delivery",
    title: "現金流出車",
    detail: "上線接單或完成外送，維持現金流節奏。",
    criterion: "有上線即可；有完成趟次或跑一段時間更好。",
    lane: "主線",
    type: "UberEats",
    rank: "C",
    coins: 60,
    xp: 35,
    energyCost: 12,
    stat: "財力",
    statXp: 22,
  },
  {
    key: "brokerage",
    title: "房仲推進",
    detail: "碰一件房仲工作：客戶、物件、行情、開發或內容都可以。",
    criterion: "至少完成一個能讓案件或客戶往前走的動作。",
    lane: "主線",
    type: "房仲業務",
    rank: "C",
    coins: 70,
    xp: 40,
    energyCost: 10,
    stat: "財力",
    statXp: 25,
  },
  {
    key: "family",
    title: "家庭連結",
    detail: "陪伴家人或主動處理一件家務。",
    criterion: "讓家人感受到你有在場，或替家裡減少一點負擔。",
    lane: "支線",
    type: "家庭守護",
    rank: "D",
    coins: 35,
    xp: 20,
    energyCost: 4,
    stat: "家庭",
    statXp: 20,
  },
  {
    key: "money",
    title: "財務盤點",
    detail: "記錄今天的錢流向，不求完整，先求看得見。",
    criterion: "至少記一筆主要收入或支出。",
    lane: "支線",
    type: "還債理財",
    rank: "D",
    coins: 35,
    xp: 20,
    energyCost: 3,
    stat: "財力",
    statXp: 15,
  },
  {
    key: "movement",
    title: "身體維護",
    detail: "散步、伸展、深蹲、伏地挺身或其他簡單活動。",
    criterion: "至少活動 5 分鐘；15 分鐘以上算漂亮完成。",
    lane: "支線",
    type: "體能訓練",
    rank: "D",
    coins: 40,
    xp: 25,
    energyCost: 5,
    stat: "體力",
    statXp: 20,
  },
  {
    key: "calorie",
    title: "熱量守門",
    detail: "把今天主要吃喝記下來，先看清楚再調整。",
    criterion: "至少記兩筆主要飲食。",
    lane: "支線",
    type: "熱量管理",
    rank: "D",
    coins: 35,
    xp: 25,
    energyCost: 3,
    stat: "體力",
    statXp: 18,
  },
  {
    key: "tiny-step",
    title: "五分鐘小事件",
    detail: "整理、閱讀、散步、素材或任何五分鐘可完成的小事。",
    criterion: "做完一個能讓狀態更清楚的小動作。",
    lane: "隨機",
    type: "開寶箱",
    rank: "D",
    coins: 30,
    xp: 15,
    energyCost: 3,
    stat: "心力",
    statXp: 12,
  },
];

export const ENERGY_PRESETS = [
  { value: 100, label: "滿血", note: "適合挑戰較多事件。" },
  { value: 70, label: "普通", note: "穩定推進即可。" },
  { value: 50, label: "有點累", note: "縮小目標，保留主線。" },
  { value: 30, label: "快不行", note: "啟動保命模式。" },
  { value: 15, label: "崩潰邊緣", note: "今天只求不要完全掉線。" },
];

export const STAT_NAMES = ["體力", "智力", "財力", "魅力", "家庭", "心力"];

export const STAT_LABELS = {
  體力: ["身體重新啟動", "能穩定活動", "體力回升", "身體守門人", "耐力型玩家"],
  智力: ["開始恢復手感", "知識修煉者", "學習推進中", "穩定學習者", "知識型玩家"],
  財力: ["看見現金流", "還債戰線推進", "現金流守門人", "收入推進者", "財務穩定者"],
  魅力: ["開始被看見", "專業存在感", "個人品牌萌芽", "穩定曝光者", "信任建立者"],
  家庭: ["家庭火種守護", "穩定陪伴", "可靠隊友", "家庭守護者", "家庭核心支柱"],
  心力: ["火種還在", "低潮能回來", "心力守門人", "抗壓修復者", "不斷線的人"],
};

export const TITLE_STEPS = [
  [1, "剛點燃火種的人"],
  [2, "沒有斷線的男人"],
  [3, "開始穩定前進"],
  [4, "生活節奏修復中"],
  [5, "現金流守門人"],
  [6, "家庭守護型房仲勇者"],
  [7, "低潮也能推進的人"],
  [8, "穩定輸出者"],
  [9, "人生打怪老手"],
  [10, "三房兩廳遠征者"],
  [12, "家業雙線推進者"],
  [15, "人生主線開拓者"],
  [18, "節奏掌控者"],
  [20, "自我管理鍛造者"],
  [25, "人生解題者"],
  [30, "原則初成者"],
  [35, "原則實踐者"],
  [40, "系統建立者"],
  [45, "長期主義者"],
  [50, "人生掌舵者"],
  [55, "家業並進者"],
  [60, "穩定複利者"],
  [65, "風浪守序者"],
  [70, "人生架構師"],
  [75, "自我治理者"],
  [80, "原則鍛造師"],
  [85, "世代守護者"],
  [90, "原則傳承者"],
  [95, "長線守望者"],
  [100, "自己人生的主人"],
];

export const ROLE_STEPS = [
  [1, "火種村民"],
  [10, "人生冒險者"],
  [20, "家庭守護型房仲勇者"],
  [30, "原則鍛造師"],
  [40, "人生系統工匠"],
  [50, "人生掌舵者"],
  [60, "家業領航者"],
  [70, "長期複利行者"],
  [80, "人生架構師"],
  [90, "自我治理者"],
  [100, "人生村長"],
];

export const SHOP_REWARDS = [
  { id: "screen-time", title: "完整娛樂時段 2 小時", detail: "選遊戲、電影或小說，好好享受，不一邊休息一邊責怪自己。", tier: "中獎", cost: 250, weekly: 2, cooldown: 0 },
  { id: "pool-table", title: "去打撞球一次", detail: "離開螢幕，安排一段真正的休閒。", tier: "中獎", cost: 350, weekly: 1, cooldown: 0 },
  { id: "family-halfday", title: "家庭戶外半日", detail: "散步、公園或走走，不需要用大餐才算獎勵。", tier: "大獎", cost: 650, weekly: 0, cooldown: 7 },
  { id: "free-halfday", title: "半日自由時段", detail: "一段由自己決定、也不拿來補工作債的時間。", tier: "大獎", cost: 750, weekly: 0, cooldown: 7 },
];

export const FUND_TARGETS = [
  { id: "debt", title: "還債基金", coinCost: 800, cash: 100, note: "兌換後把 100 元真的移去還債。" },
  { id: "trip", title: "家庭小旅行基金", coinCost: 1000, cash: 100, note: "兌換後把 100 元留進旅行預算。" },
  { id: "home", title: "三房兩廳基金", coinCost: 1200, cash: 100, note: "兌換後把 100 元放進長期居住目標。" },
];

export const MEAL_TYPES = ["早餐", "午餐", "晚餐", "點心", "飲料"];

export const REWARD_POOLS = {
  recovery: [
    { id: "quiet-15", title: "安靜十五分鐘", detail: "聽音樂、泡茶或單純放空，不滑短影音。", effect: { type: "ritual" } },
    { id: "finish-early", title: "提早收工權", detail: "今晚提前半小時收尾，不補工作債。", effect: { type: "ritual" } },
    { id: "slow-walk", title: "慢走清空權", detail: "散步二十分鐘，不追步數，只讓腦袋降速。", effect: { type: "ritual" } },
  ],
  small: [
    { id: "novel-30", title: "小說探索權", detail: "安心看小說三十分鐘，時間到就收。", effect: { type: "ritual" } },
    { id: "game-round", title: "完整一局遊戲", detail: "專心玩一局，不邊玩邊焦慮待辦。", effect: { type: "ritual" } },
    { id: "hot-shower", title: "熱水澡儀式", detail: "洗澡或泡腳二十分鐘，讓身體真正休息。", effect: { type: "ritual" } },
    { id: "episode", title: "一集影集權", detail: "完整看一集，不同時滑手機。", effect: { type: "ritual" } },
  ],
  boost: [
    { id: "side-boost", title: "明日支線加成券", detail: "明天第一個支線或隨機事件額外 +20 金幣。", effect: { type: "boost", amount: 20, lanes: ["支線", "隨機"] } },
    { id: "main-boost", title: "明日主線加成券", detail: "明天第一個主線事件額外 +20 金幣。", effect: { type: "boost", amount: 20, lanes: ["主線"] } },
  ],
  coupon: [
    { id: "pool-discount", title: "撞球折扣券", detail: "七天內兌換撞球少花 100 金幣。", effect: { type: "coupon", target: "pool-table", amount: 100, days: 7 } },
    { id: "screen-discount", title: "娛樂折扣券", detail: "七天內兌換娛樂時段少花 80 金幣。", effect: { type: "coupon", target: "screen-time", amount: 80, days: 7 } },
  ],
};