import React, { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "life-leveling-v7-growth";

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const defaultTasks = [
  {
    id: 1,
    title: "今日保命開局",
    desc: "喝水、洗臉、打開 App。先讓今天不要斷線。",
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
    id: 2,
    title: "現金流出車",
    desc: "完成一趟 UberEats，或至少上線接單。目的不是爆賺，是讓現金流不要斷。",
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
    id: 3,
    title: "房仲不斷線",
    desc: "完成任一件房仲小事：整理一筆客戶、打一通電話、回覆客戶、看一個社區行情、發一篇短貼文都可以。",
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
    id: 4,
    title: "家庭羈絆",
    desc: "陪老婆或小孩 10 分鐘，或幫家裡做一件小事。",
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
    id: 5,
    title: "財務偵查",
    desc: "記帳一次，知道今天錢流去哪裡就好，不用完美。",
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
    id: 6,
    title: "隨機事件：低壓前進",
    desc: "今天任選一件 5 分鐘小事完成：整理桌面、拍素材、讀一頁書、走路 5 分鐘都可以。",
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

const defaultRewards = [
  { id: 1, title: "無罪惡感滑手機 15 分鐘", cost: 40, tag: "小爽" },
  { id: 2, title: "看小說 30 分鐘", cost: 100, tag: "小爽" },
  { id: 3, title: "打電動 1 小時", cost: 180, tag: "娛樂" },
  { id: 4, title: "300 元美食", cost: 500, tag: "美食" },
  { id: 5, title: "無罪惡感躺平半天", cost: 650, tag: "真爽" },
  { id: 6, title: "去打撞球一次", cost: 1000, tag: "真爽" },
  { id: 7, title: "還債基金 +100 元", cost: 1000, tag: "人生目標" },
  { id: 8, title: "家庭小旅行基金 +100 元", cost: 1000, tag: "家庭" },
  { id: 9, title: "三房兩廳基金 +100 元", cost: 1200, tag: "人生目標" },
];

const energyOptions = [
  { label: "滿血", value: 100, desc: "今天可以挑戰比較多事件。" },
  { label: "普通", value: 70, desc: "適合穩定推進。" },
  { label: "有點累", value: 50, desc: "事件減量，先不斷線。" },
  { label: "快不行", value: 30, desc: "啟動保命模式。" },
  { label: "崩潰邊緣", value: 15, desc: "只求今天不要完全消失。" },
];

const attrMeta = {
  體力: {
    short: "體",
    titles: ["身體重新開機", "能撐住一天", "體力開始回來", "穩定行動者", "耐力型玩家"],
  },
  智力: {
    short: "智",
    titles: ["開始恢復手感", "法條修煉者", "讀書戰線推進中", "穩定學習者", "知識型玩家"],
  },
  財力: {
    short: "財",
    titles: ["開始掌握現金流", "還債戰線士兵", "現金流守門人", "收入推進者", "財務穩定者"],
  },
  家庭: {
    short: "家",
    titles: ["家庭火種守護者", "穩定陪伴者", "家人可靠隊友", "家庭守護者", "家庭核心支柱"],
  },
  心力: {
    short: "心",
    titles: ["火種微弱但還在", "低潮也能回來", "心力守門人", "抗壓修復者", "不斷線的人"],
  },
  魅力: {
    short: "魅",
    titles: ["開始被看見", "專業存在感提升", "個人品牌萌芽", "穩定曝光者", "信任感建立者"],
  },
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
];

function getPlayerTitle(level) {
  let title = playerTitles[0].title;
  for (const item of playerTitles) {
    if (level >= item.level) title = item.title;
  }
  return title;
}

function attrLevel(value) {
  return Math.floor(value / 50) + 1;
}

function attrTitle(name, value) {
  const titles = attrMeta[name]?.titles || ["正在成長"];
  return titles[Math.min(titles.length - 1, attrLevel(value) - 1)];
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

function rewardClass(tag) {
  if (tag === "真爽" || tag === "人生目標") return "bg-amber-100 text-amber-800";
  if (tag === "家庭") return "bg-emerald-100 text-emerald-800";
  if (tag === "美食") return "bg-rose-100 text-rose-700";
  return "bg-purple-100 text-purple-700";
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
  lastReport: "還沒有結算紀錄。",
  message: "v7 成長版：每天不斷線，慢慢升級。",
  tasks: defaultTasks,
  rewards: defaultRewards,
  attrs: { 體力: 0, 智力: 0, 財力: 0, 家庭: 0, 心力: 0, 魅力: 0 },
};

function normalizeLoadedState(raw) {
  const base = { ...initialState, ...(raw || {}) };
  base.tasks = Array.isArray(base.tasks) ? base.tasks : clone(defaultTasks);
  base.rewards = Array.isArray(base.rewards) ? base.rewards : clone(defaultRewards);
  base.attrs = { ...initialState.attrs, ...(base.attrs || {}) };
  return base;
}

function resetDailyFields(state) {
  return {
    ...state,
    day: todayKey(),
    tasks: clone(defaultTasks),
    energy: 70,
    todayCoins: 0,
    todayExp: 0,
    message: "新的一天開始，先做一件最小的事，讓自己不要斷線。",
  };
}

function getLast7FireLog(fireLog) {
  return Array.from({ length: 7 }).map((_, index) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - index));
    const key = d.toISOString().slice(0, 10);
    const item = fireLog.find((x) => x.date === key);
    return {
      date: key,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      done: Boolean(item?.done),
    };
  });
}

export default function LifeLevelingAppPrototype() {
  const [state, setState] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const loaded = saved ? normalizeLoadedState(JSON.parse(saved)) : clone(initialState);
      return loaded.day !== todayKey() ? resetDailyFields(loaded) : loaded;
    } catch {
      return clone(initialState);
    }
  });

  const [tab, setTab] = useState("today");
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [rewardFormOpen, setRewardFormOpen] = useState(false);

  const [newTask, setNewTask] = useState({
    title: "",
    coins: 30,
    group: "支線",
    attr: "心力",
  });

  const [newReward, setNewReward] = useState({
    title: "",
    cost: 100,
    tag: "小爽",
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const completed = state.tasks.filter((task) => task.done);
  const isSurvival = state.energy <= 30;

  const visibleTasks = useMemo(() => {
    if (!isSurvival) return state.tasks;
    return state.tasks
      .filter((task) => task.group === "主線" || task.type === "保命任務" || task.difficulty === "D")
      .slice(0, 4);
  }, [state.tasks, isSurvival]);

  const usedEnergy = completed.reduce((sum, task) => sum + Number(task.energy || 0), 0);
  const remainingEnergy = Math.max(0, state.energy - usedEnergy);

  const level = Math.floor(state.exp / 100) + 1;
  const expInLevel = state.exp % 100;
  const nextExp = 100 - expInLevel;

  function patch(updater) {
    setState((prev) => {
      const current = prev.day !== todayKey() ? resetDailyFields(prev) : prev;
      return typeof updater === "function" ? updater(current) : { ...current, ...updater };
    });
  }

  function completeTask(id) {
    patch((prev) => {
      const task = prev.tasks.find((x) => x.id === id);
      if (!task || task.done) return prev;

      const nextTasks = prev.tasks.map((item) => {
        if (item.id !== id) return item;
        return { ...item, done: true };
      });

      return {
        ...prev,
        tasks: nextTasks,
        coins: prev.coins + Number(task.coins || 0),
        exp: prev.exp + Number(task.exp || task.coins || 0),
        todayCoins: prev.todayCoins + Number(task.coins || 0),
        todayExp: prev.todayExp + Number(task.exp || task.coins || 0),
        totalTasks: prev.totalTasks + 1,
        totalCoinsEarned: prev.totalCoinsEarned + Number(task.coins || 0),
        attrs: {
          ...prev.attrs,
          [task.attr]: Number(prev.attrs[task.attr] || 0) + Number(task.attrExp || 10),
        },
        message: `完成「${task.title}」，獲得 ${task.coins} 金幣，${task.attr} 成長 +${task.attrExp || 10}。`,
      };
    });
  }

  function deleteTask(id) {
    patch((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== id),
      message: "已刪除一個事件。",
    }));
  }

  function addTask() {
    const title = newTask.title.trim();
    if (!title) return;

    const coins = Number(newTask.coins || 30);

    const task = {
      id: Date.now(),
      title,
      desc: "自訂事件：由你自己指定完成條件。",
      group: newTask.group,
      type: "自訂事件",
      difficulty: coins >= 70 ? "B" : coins >= 40 ? "C" : "D",
      coins,
      exp: coins,
      energy: 5,
      attr: newTask.attr,
      attrExp: Math.max(8, Math.round(coins / 2)),
      done: false,
    };

    patch((prev) => ({
      ...prev,
      tasks: [...prev.tasks, task],
      message: `已新增事件：「${title}」。`,
    }));

    setNewTask({ title: "", coins: 30, group: "支線", attr: "心力" });
    setTaskFormOpen(false);
  }

  function addReward() {
    const title = newReward.title.trim();
    if (!title) return;

    const reward = {
      id: Date.now(),
      title,
      cost: Number(newReward.cost || 100),
      tag: newReward.tag || "小爽",
    };

    patch((prev) => ({
      ...prev,
      rewards: [...prev.rewards, reward],
      message: `已新增獎勵：「${title}」。`,
    }));

    setNewReward({ title: "", cost: 100, tag: "小爽" });
    setRewardFormOpen(false);
  }

  function deleteReward(id) {
    patch((prev) => ({
      ...prev,
      rewards: prev.rewards.filter((reward) => reward.id !== id),
      message: "已刪除一個獎勵。",
    }));
  }

  function redeemReward(reward) {
    patch((prev) => {
      if (prev.coins < reward.cost) {
        return {
          ...prev,
          message: `金幣還差 ${reward.cost - prev.coins}，先打一個小事件就好。`,
        };
      }

      return {
        ...prev,
        coins: prev.coins - reward.cost,
        message: `已兌換：${reward.title}。這是你賺來的。`,
      };
    });
  }

  function settleToday() {
    patch((prev) => {
      const done = prev.tasks.filter((task) => task.done).length;
      const mainDone = prev.tasks.some((task) => task.group === "主線" && task.done);
      const uberDone = prev.tasks.some((task) => task.type === "UberEats" && task.done);
      const estateDone = prev.tasks.some((task) => task.type === "房仲業務" && task.done);

      let title = "今日稱號：明天再開局";
      let comment = "今天先記錄，明天從一個 E 級事件開始。";

      if (done >= 1) {
        title = "今日稱號：火種還在的人";
        comment = "至少有做一件事，今天就不是歸零。";
      }

      if (mainDone) {
        title = "今日稱號：主線沒有斷線";
        comment = "今天有推進主線，人生沒有完全停住。";
      }

      if (uberDone && estateDone) {
        title = "今日稱號：現金流與房仲雙線推進";
        comment = "今天 UberEats 和房仲都有碰到，這是很好的不斷線節奏。";
      }

      const report = [
        `日期：${prev.day}`,
        `完成事件：${done}/${prev.tasks.length}`,
        `今日收入：+${prev.todayCoins} 金幣`,
        `今日 EXP：+${prev.todayExp}`,
        title,
        `系統評語：${comment}`,
      ].join("\n");

      const fireLog = [
        ...prev.fireLog.filter((x) => x.date !== prev.day),
        { date: prev.day, done: done > 0 },
      ].slice(-30);

      setTab("record");

      return {
        ...prev,
        settledDays: prev.settledDays + 1,
        fireLog,
        lastReport: report,
        message: done > 0 ? "今日結算完成：火種保住了。" : "今日結算完成：明天再來。",
      };
    });
  }

  function newDay() {
    patch((prev) => resetDailyFields(prev));
  }

  function hardReset() {
    if (!window.confirm("確定全部重來？金幣、等級、紀錄都會清空。")) return;
    setState(clone(initialState));
    setTab("today");
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex justify-center sm:p-4 overflow-x-hidden">
      <div className="w-full max-w-md min-h-screen sm:min-h-0 bg-slate-900 sm:rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800">
        <header className="p-5 bg-gradient-to-br from-slate-800 to-slate-950">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-slate-400">人生打怪村 v7 成長版</p>
              <h1 className="text-2xl font-bold tracking-tight">邱顯明 Lv.{level}</h1>
              <p className="text-sm text-amber-300 mt-1">{getPlayerTitle(level)}</p>
              <p className="text-xs text-slate-500 mt-1">{state.day}</p>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-amber-400/15 border border-amber-300/30 flex items-center justify-center">
              <span className="text-2xl font-black text-amber-300">火</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <StatCard label="金幣" value={state.coins} />
            <StatCard label="能量" value={remainingEnergy} />
            <StatCard label="完成" value={`${completed.length}/${visibleTasks.length}`} />
          </div>

          <div className="mt-4">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>角色升級</span>
              <span>
                {expInLevel}/100 EXP，還差 {nextExp}
              </span>
            </div>

            <div className="h-3 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-300" style={{ width: `${expInLevel}%` }} />
            </div>
          </div>
        </header>

        <div className="p-4 pb-2">
          <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
            <p className="text-sm text-slate-300">系統訊息</p>
            <p className="text-base font-medium text-white mt-1 whitespace-pre-line">{state.message}</p>
            {isSurvival && (
              <p className="text-sm text-amber-300 mt-2">保命模式已啟動：今天只要求不斷線。</p>
            )}
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
              className={`rounded-full px-3 py-2 text-sm font-semibold ${
                tab === key ? "bg-amber-300 text-slate-950" : "bg-slate-800 text-slate-300"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <main className="p-4 pb-24">
          {tab === "today" && (
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">今日事件</h2>
                <button
                  onClick={newDay}
                  className="text-slate-300 rounded-full px-3 py-2 hover:bg-slate-800 flex items-center gap-1"
                >
                  <span>↻</span> 新的一天
                </button>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3 text-sm text-slate-300 leading-relaxed">
                今天只求不斷線：UberEats 有出車一點、房仲有碰一下、家庭有顧到、自己還在。
              </div>

              {visibleTasks.map((task) => (
                <TaskCard key={task.id} task={task} onComplete={completeTask} onDelete={deleteTask} />
              ))}

              <button
                onClick={() => setTaskFormOpen((v) => !v)}
                className="w-full rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 h-12 flex items-center justify-center gap-2"
              >
                <span>＋</span> 新增自訂事件
              </button>

              {taskFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <Input
                    label="事件名稱"
                    value={newTask.title}
                    onChange={(v) => setNewTask({ ...newTask, title: v })}
                    placeholder="例如：打給一位老客戶"
                  />

                  <Input
                    label="金幣"
                    type="number"
                    value={newTask.coins}
                    onChange={(v) => setNewTask({ ...newTask, coins: v })}
                  />

                  <Select
                    label="分類"
                    value={newTask.group}
                    onChange={(v) => setNewTask({ ...newTask, group: v })}
                    options={["主線", "支線", "隨機"]}
                  />

                  <Select
                    label="成長屬性"
                    value={newTask.attr}
                    onChange={(v) => setNewTask({ ...newTask, attr: v })}
                    options={Object.keys(attrMeta)}
                  />

                  <button onClick={addTask} className="w-full bg-amber-300 text-slate-950 rounded-2xl py-3 font-black">
                    加入事件
                  </button>
                </div>
              )}

              <button onClick={settleToday} className="w-full rounded-2xl bg-amber-300 text-slate-950 h-12 font-black">
                今日結算
              </button>
            </section>
          )}

          {tab === "energy" && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">今天的能量</h2>
              <p className="text-slate-400 text-sm">先承認狀態，再安排事件。狀態低不是失敗，是換打法。</p>

              {energyOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() =>
                    patch({
                      energy: option.value,
                      message:
                        option.value <= 30
                          ? "已切換成保命模式，今天只求不斷線。"
                          : `今日能量設定為 ${option.value}。`,
                    })
                  }
                  className={`w-full text-left rounded-3xl border p-4 flex justify-between items-center ${
                    state.energy === option.value
                      ? "bg-amber-300 text-slate-950 border-amber-200"
                      : "bg-slate-800 text-slate-100 border-slate-700"
                  }`}
                >
                  <div>
                    <h3 className="font-bold">{option.label}</h3>
                    <p className={`text-sm ${state.energy === option.value ? "text-slate-700" : "text-slate-400"}`}>
                      {option.desc}
                    </p>
                  </div>

                  <div className="text-2xl font-black">{option.value}</div>
                </button>
              ))}
            </section>
          )}

          {tab === "reward" && (
            <section className="space-y-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">獎勵商店</h2>
                <button
                  onClick={() => setRewardFormOpen((v) => !v)}
                  className="rounded-full bg-slate-800 px-3 py-2 text-sm"
                >
                  ＋ 新增
                </button>
              </div>

              <p className="text-slate-400 text-sm">金幣要能換到真正想要的東西，才會有動力。</p>

              {rewardFormOpen && (
                <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                  <Input
                    label="獎勵名稱"
                    value={newReward.title}
                    onChange={(v) => setNewReward({ ...newReward, title: v })}
                    placeholder="例如：吃一餐牛排"
                  />

                  <Input
                    label="花費金幣"
                    type="number"
                    value={newReward.cost}
                    onChange={(v) => setNewReward({ ...newReward, cost: v })}
                  />

                  <Select
                    label="標籤"
                    value={newReward.tag}
                    onChange={(v) => setNewReward({ ...newReward, tag: v })}
                    options={["小爽", "娛樂", "真爽", "美食", "家庭", "人生目標"]}
                  />

                  <button onClick={addReward} className="w-full bg-amber-300 text-slate-950 rounded-2xl py-3 font-black">
                    加入獎勵
                  </button>
                </div>
              )}

              {state.rewards.map((reward) => (
                <div
                  key={reward.id}
                  className="bg-slate-800 border border-slate-700 rounded-3xl p-4 flex justify-between items-center gap-3"
                >
                  <div>
                    <span className={`text-xs px-2 py-1 rounded-full ${rewardClass(reward.tag)}`}>
                      {reward.tag}
                    </span>
                    <h3 className="font-semibold mt-2">{reward.title}</h3>
                    <p className="text-sm text-slate-400">需要 {reward.cost} 金幣</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => redeemReward(reward)}
                      className="rounded-2xl bg-amber-300 text-slate-950 px-3 py-2 font-bold"
                    >
                      兌換
                    </button>

                    <button
                      onClick={() => deleteReward(reward.id)}
                      className="rounded-2xl bg-slate-700 text-slate-300 px-3 py-2"
                    >
                      刪
                    </button>
                  </div>
                </div>
              ))}
            </section>
          )}

          {tab === "record" && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">累積戰績</h2>

              <div className="grid grid-cols-3 gap-3">
                <RecordBox label="總事件" value={state.totalTasks} />
                <RecordBox label="總金幣" value={state.totalCoinsEarned} />
                <RecordBox label="結算天" value={state.settledDays} />
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-bold">最近 7 天火種</h3>
                <p className="text-sm text-slate-400 mt-1">有完成至少一個事件就是保住火種。</p>

                <div className="grid grid-cols-7 gap-2 mt-3">
                  {getLast7FireLog(state.fireLog).map((day) => (
                    <div key={day.date} className="bg-slate-950 border border-slate-800 rounded-2xl p-2 text-center">
                      <div className={`font-black ${day.done ? "text-amber-300" : "text-slate-600"}`}>
                        {day.done ? "火" : "○"}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-1">{day.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                <h3 className="font-bold">最近一次結算</h3>
                <p className="text-sm text-slate-300 mt-2 whitespace-pre-line leading-relaxed">{state.lastReport}</p>
              </div>
            </section>
          )}

          {tab === "role" && (
            <section className="space-y-4">
              <h2 className="text-xl font-bold">角色成長</h2>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-5 text-center">
                <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-br from-amber-300/30 to-blue-400/20 border border-slate-600 flex items-center justify-center mb-3">
                  <span className="text-3xl font-black text-amber-200">人</span>
                </div>

                <h3 className="text-xl font-bold">家庭守護型房仲勇者</h3>
                <p className="text-sm text-slate-400 mt-1">稱號：{getPlayerTitle(level)}</p>
              </div>

              {Object.keys(attrMeta).map((name) => {
                const value = state.attrs[name] || 0;
                const now = value % 50;

                return (
                  <div key={name} className="bg-slate-800 border border-slate-700 rounded-3xl p-4">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-amber-300 font-black w-5 text-center">{attrMeta[name].short}</span>
                      <span className="font-semibold">
                        {name} Lv.{attrLevel(value)}
                      </span>
                      <span className="ml-auto text-slate-400">{value} EXP</span>
                    </div>

                    <h3 className="font-bold">{attrTitle(name, value)}</h3>
                    <p className="text-xs text-slate-400 mt-1 mb-2">下一級還差 {50 - now} EXP</p>

                    <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-300" style={{ width: `${now * 2}%` }} />
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {tab === "settings" && (
            <section className="space-y-3">
              <h2 className="text-xl font-bold">設定</h2>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <h3 className="font-bold">版本</h3>
                <p className="text-sm text-slate-300 leading-relaxed">v7 成長版：取消橫向滑動、從 0 金幣開始、升級稱號更明確。</p>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-3xl p-4 space-y-3">
                <h3 className="font-bold">資料儲存</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  目前資料存在本機瀏覽器。換手機或清除瀏覽資料會消失；之後可以再升級雲端同步。
                </p>
              </div>

              <button onClick={hardReset} className="w-full rounded-2xl bg-rose-900/80 text-rose-100 h-12 font-bold">
                全部重來
              </button>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}

function TaskCard({ task, onComplete, onDelete }) {
  return (
    <div>
      <div className={`rounded-3xl border p-4 ${task.done ? "bg-emerald-950/50 border-emerald-700" : "bg-slate-800 border-slate-700"}`}>
        <div className="flex gap-3 items-start">
          <button
            onClick={() => onComplete(task.id)}
            className={`mt-1 w-9 h-9 rounded-full flex items-center justify-center border ${
              task.done ? "bg-emerald-400 border-emerald-300 text-slate-950" : "border-slate-500 text-slate-500"
            }`}
          >
            ✓
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex gap-2 mb-2 flex-wrap">
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${groupClass(task.group)}`}>
                {task.group}
              </span>
              <span className={`text-xs px-2 py-1 rounded-full font-bold ${difficultyClass(task.difficulty)}`}>
                {task.difficulty} 級
              </span>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-700 text-slate-300">{task.type}</span>
            </div>

            <h3 className={`font-semibold ${task.done ? "line-through text-slate-400" : "text-white"}`}>
              {task.title}
            </h3>

            <p className="text-sm text-slate-400 mt-1 leading-relaxed break-words">{task.desc}</p>

            <div className="flex gap-3 text-sm text-slate-400 mt-2 flex-wrap">
              <span>+{task.coins} 金幣</span>
              <span>+{task.exp} EXP</span>
              <span>
                {task.attr} +{task.attrExp}
              </span>
            </div>
          </div>

          <button onClick={() => onDelete(task.id)} className="text-slate-500 hover:text-rose-300 p-1">
            刪
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-slate-800/80 rounded-2xl p-3 border border-slate-700">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-bold text-lg">{value}</p>
    </div>
  );
}

function RecordBox({ label, value }) {
  return (
    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-3 text-center">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="text-2xl font-black mt-1">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = "text", placeholder = "" }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-400">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 text-slate-100 outline-none focus:border-amber-300"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-400">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-2xl bg-slate-950 border border-slate-700 px-4 py-3 text-slate-100 outline-none focus:border-amber-300"
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}