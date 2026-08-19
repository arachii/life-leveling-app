import { REWARD_POOLS, TOMORROW_LIMIT } from "./catalog.js";
import { dayDistance, moveDay } from "./time.js";
import { remainingEnergy } from "./energy.js";

function numberFromText(text) {
  let value = 5381;
  for (const ch of text) value = ((value << 5) + value) ^ ch.charCodeAt(0);
  return Math.abs(value >>> 0);
}

function seededPick(items, seedText) {
  return items[numberFromText(seedText) % items.length];
}

export function completedMain(tasks) {
  return (tasks || []).filter((task) => task.done && task.lane === "主線").length;
}

export function completedTodos(todos) {
  return (todos || []).filter((todo) => todo.done).length;
}

export function seals(todos) {
  return Math.min(3, completedTodos(todos));
}

export function fireStreak(log, today) {
  let streak = 0;
  for (let offset = 0; offset < 60; offset += 1) {
    const day = moveDay(today, -offset);
    if ((log || []).some((item) => item.day === day && item.lit)) streak += 1;
    else break;
  }
  return streak;
}

export function hasCoreTriple(tasks) {
  const done = new Set((tasks || []).filter((task) => task.done).map((task) => task.key));
  return done.has("delivery") && done.has("brokerage") && done.has("family");
}

export function rewardUnlock(state) {
  const main = completedMain(state.today.tasks);
  const todo = completedTodos(state.today.todos);
  const energy = remainingEnergy(state);

  if (energy <= 30) {
    return {
      open: main + todo >= 1,
      label: "保命模式",
      detail: "完成任一件主線或待辦即可解封。",
      progress: `${main + todo}/1`,
    };
  }
  if (main >= 2 || (main >= 1 && todo >= 2) || hasCoreTriple(state.today.tasks)) {
    return {
      open: true,
      label: "穩定推進",
      detail: "今天已達到封印解除條件。",
      progress: `${main} 主線・${todo} 待辦`,
    };
  }
  return {
    open: false,
    label: "尚未解封",
    detail: "完成 2 件主線，或 1 件主線加 2 件待辦。",
    progress: `${main} 主線・${todo} 待辦`,
  };
}

export function insightFor(state) {
  const main = completedMain(state.today.tasks);
  const todo = completedTodos(state.today.todos);
  const energy = remainingEnergy(state);
  const chain = fireStreak(state.history.fireLog, state.meta.day);

  if (energy <= 30) {
    return {
      title: "保住火種",
      tag: "低能量打法",
      message: "今天的勝利不是做很多，而是不要完全消失。",
      question: "現在最小、但真的做得完的一步是什麼？",
    };
  }
  if (main === 0 && todo >= 2) {
    return {
      title: "小事有做，主線還沒碰",
      tag: "避免忙碌替代",
      message: "待辦已經有進度，但最重要的戰線還沒有啟動。",
      question: "哪一件主線只做五分鐘，也能讓今天方向正確？",
    };
  }
  if (hasCoreTriple(state.today.tasks)) {
    return {
      title: "核心三線都亮了",
      tag: "家業雙線",
      message: "現金流、房仲與家庭今天都有碰到，這就是穩定複利的形狀。",
      question: "今天哪個做法最值得明天再複製一次？",
    };
  }
  if (main >= 2) {
    return {
      title: "主線穩定推進",
      tag: "方向正確",
      message: "重要事情已經在動，不需要再用雜事證明自己很忙。",
      question: "接下來是繼續推一件重要事，還是該收工保存體力？",
    };
  }
  if (chain >= 3) {
    return {
      title: "火種連續燃燒",
      tag: `${chain} 天連火`,
      message: "你正在把偶爾做到，變成比較穩定的節奏。",
      question: "哪個小習慣是這段連續性的真正支點？",
    };
  }
  return {
    title: "今天還在開局",
    tag: "先動一格",
    message: "不用等狀態完美，先讓一件真正重要的小事開始。",
    question: "現在做哪一件事，晚上回頭看會覺得今天沒有白過？",
  };
}

export function dailyReward(state) {
  if (state.today.rewardCard) return state.today.rewardCard;

  const energy = remainingEnergy(state);
  const main = completedMain(state.today.tasks);
  const todo = completedTodos(state.today.todos);
  let pool = "small";

  if (energy <= 30) pool = "recovery";
  else if (hasCoreTriple(state.today.tasks) || main >= 3) pool = "coupon";
  else if (main >= 2 || (main >= 1 && todo >= 2)) pool = "boost";

  const reward = seededPick(REWARD_POOLS[pool], `${state.meta.day}:${pool}:15`);
  return {
    ...reward,
    pool,
    locked: false,
    claimed: false,
    lockedAt: "",
    claimedAt: "",
  };
}

export function lockRewardIfReady(state) {
  const unlock = rewardUnlock(state);
  if (!unlock.open || state.today.rewardCard?.locked || state.today.rewardCard?.claimed) return state;
  return {
    ...state,
    today: {
      ...state.today,
      rewardCard: {
        ...dailyReward(state),
        locked: true,
        lockedAt: new Date().toISOString(),
      },
    },
  };
}

export function rewardReason(state) {
  const insight = insightFor(state);
  return `${insight.title}。${insight.message}`;
}

export function shopAvailability(state, reward) {
  const recent = (state.rewards.usage || []).filter(
    (item) => item.rewardId === reward.id && dayDistance(item.day, state.meta.day) < 7
  );
  if (reward.weekly && recent.length >= reward.weekly) return { ok: false, reason: "本週已達兌換上限。" };

  if (reward.cooldown) {
    const lastLarge = (state.rewards.usage || [])
      .filter((item) => item.tier === "大獎")
      .sort((a, b) => b.day.localeCompare(a.day))[0];
    if (lastLarge && dayDistance(lastLarge.day, state.meta.day) < reward.cooldown) {
      return { ok: false, reason: "大獎仍在冷卻期。" };
    }
  }
  return { ok: true, reason: "" };
}

export function activeCoupon(state, rewardId) {
  return (state.rewards.coupons || []).find(
    (coupon) =>
      coupon.target === rewardId &&
      Number(coupon.remaining || 0) > 0 &&
      dayDistance(state.meta.day, coupon.expiresAt) >= 0
  );
}

export function tomorrowPlan(todos) {
  const count = (todos || []).length;
  if (count === 0) return { tone: "empty", title: "明天還有空白", message: "現在不用把明天塞滿，保留處理突發狀況的空間。" };
  if (count >= TOMORROW_LIMIT) return { tone: "full", title: "明日清單已滿", message: "先不要再加，明天從排好的項目開始。" };
  return { tone: "good", title: `明天已有 ${count} 件`, message: "開局方向已經寫好，明天不用重新想一次。" };
}