import {
  CORE_TASKS,
  DAILY_COIN_LIMIT,
  DEFAULT_ENERGY,
  FUND_TARGETS,
  HISTORY_LIMIT,
  SHOP_REWARDS,
  TOMORROW_LIMIT,
} from "../domain/catalog.js";
import { bossFromReflections, createReflection, principleStage } from "../domain/principles.js";
import { activeCoupon, dailyReward, lockRewardIfReady, shopAvailability } from "../domain/rewards.js";
import { createFreshState, ensureCoreTasks } from "../domain/state.js";
import { moveDay } from "../domain/time.js";

function touched(state, patch) {
  const next = typeof patch === "function" ? patch(state) : { ...state, ...patch };
  if (next === state) return state;
  return {
    ...next,
    meta: {
      ...next.meta,
      revision: Number(state.meta.revision || 0) + 1,
      updatedAt: Date.now(),
    },
  };
}

function coreDefinition(key) {
  return CORE_TASKS.find((item) => item.key === key);
}

function applyBoost(state, task) {
  const index = state.rewards.boosts.findIndex(
    (boost) => Number(boost.remaining || 0) > 0 && (boost.lanes || []).includes(task.lane)
  );
  if (index < 0) return { bonus: 0, boosts: state.rewards.boosts };

  const selected = state.rewards.boosts[index];
  const boosts = state.rewards.boosts
    .map((item, i) => i === index ? { ...item, remaining: Number(item.remaining || 1) - 1 } : item)
    .filter((item) => Number(item.remaining || 0) > 0);
  return { bonus: Number(selected.amount || 0), boosts };
}

export function villageReducer(state, action) {
  switch (action.type) {
    case "replace":
      return action.state;

    case "task/complete":
      return touched(state, (current) => {
        const task = current.today.tasks.find((item) => item.id === action.id);
        if (!task || task.done) return current;

        const alreadyCredited = current.today.creditedTaskIds.includes(task.id);
        const boost = alreadyCredited ? { bonus: 0, boosts: current.rewards.boosts } : applyBoost(current, task);
        const rawCoins = alreadyCredited ? 0 : Number(task.coins || 0) + boost.bonus;
        const room = Math.max(0, DAILY_COIN_LIMIT - current.today.coinEarned);
        const coins = Math.min(rawCoins, room);
        const xp = alreadyCredited ? 0 : Number(task.xp || 0);
        const statXp = alreadyCredited ? 0 : Number(task.statXp || 0);

        const next = {
          ...current,
          profile: {
            ...current.profile,
            coins: current.profile.coins + coins,
            xp: current.profile.xp + xp,
            totalTasks: current.profile.totalTasks + (alreadyCredited ? 0 : 1),
            totalCoins: current.profile.totalCoins + coins,
            stats: {
              ...current.profile.stats,
              [task.stat]: Number(current.profile.stats[task.stat] || 0) + statXp,
            },
          },
          today: {
            ...current.today,
            tasks: current.today.tasks.map((item) => item.id === task.id ? { ...item, done: true } : item),
            creditedTaskIds: alreadyCredited ? current.today.creditedTaskIds : [...current.today.creditedTaskIds, task.id],
            coinEarned: current.today.coinEarned + coins,
            xpEarned: current.today.xpEarned + xp,
            message: alreadyCredited
              ? `「${task.title}」已重新標記完成；本日獎勵已領過，不重複計算。`
              : `完成「${task.title}」：+${coins} 金幣、+${xp} EXP。`,
          },
          rewards: { ...current.rewards, boosts: boost.boosts },
        };
        return lockRewardIfReady(next);
      });

    case "task/add":
      return touched(state, (current) => {
        const title = `${action.title || ""}`.trim();
        if (!title) return current;
        const coins = Math.max(1, Math.round(Number(action.coins || 30)));
        const id = `custom:${crypto.randomUUID()}`;
        const task = {
          id,
          key: id,
          title,
          detail: "自訂事件，由自己決定完成方式。",
          criterion: "達到自己設定的完成條件即可。",
          lane: action.lane || "支線",
          type: "自訂事件",
          rank: coins >= 70 ? "B" : coins >= 40 ? "C" : "D",
          coins,
          xp: coins,
          energyCost: 5,
          stat: action.stat || "心力",
          statXp: Math.max(8, Math.round(coins / 2)),
          done: false,
          custom: true,
        };
        return { ...current, today: { ...current.today, tasks: [...current.today.tasks, task], message: `已新增「${title}」。` } };
      });

    case "task/delete":
      return touched(state, (current) => {
        const task = current.today.tasks.find((item) => item.id === action.id);
        if (!task?.custom) return { ...current, today: { ...current.today, message: "固定主線不可刪除。" } };
        return { ...current, today: { ...current.today, tasks: current.today.tasks.filter((item) => item.id !== action.id), message: "自訂事件已刪除。" } };
      });

    case "task/repair":
      return touched(state, (current) => ({
        ...current,
        today: { ...current.today, tasks: ensureCoreTasks(current.today.tasks), message: "固定人生主線已完整重建。" },
      }));

    case "todo/add":
      return touched(state, (current) => {
        const title = `${action.title || ""}`.trim();
        if (!title) return current;
        const item = {
          id: `todo:${crypto.randomUUID()}`,
          title,
          category: action.category || "生活",
          done: false,
          createdAt: Date.now(),
          carriedFrom: "",
        };
        if (action.target === "tomorrow") {
          if (current.today.tomorrow.length >= TOMORROW_LIMIT) {
            return { ...current, today: { ...current.today, message: `明日最多先排 ${TOMORROW_LIMIT} 件。` } };
          }
          return { ...current, today: { ...current.today, tomorrow: [...current.today.tomorrow, item], message: `「${title}」已排到明天。` } };
        }
        const next = { ...current, today: { ...current.today, todos: [...current.today.todos, item], message: `「${title}」已加入今日待辦。` } };
        return lockRewardIfReady(next);
      });

    case "todo/toggle":
      return touched(state, (current) => {
        const next = {
          ...current,
          today: {
            ...current.today,
            todos: current.today.todos.map((item) => item.id === action.id ? { ...item, done: !item.done } : item),
            message: "待辦狀態已更新。",
          },
        };
        return lockRewardIfReady(next);
      });

    case "todo/delete":
      return touched(state, (current) => ({
        ...current,
        today: { ...current.today, todos: current.today.todos.filter((item) => item.id !== action.id), message: "今日待辦已刪除。" },
      }));

    case "tomorrow/delete":
      return touched(state, (current) => ({
        ...current,
        today: { ...current.today, tomorrow: current.today.tomorrow.filter((item) => item.id !== action.id), message: "明日待辦已移除。" },
      }));

    case "backlog/today":
      return touched(state, (current) => {
        const item = current.today.backlog.find((todo) => todo.id === action.id);
        if (!item) return current;
        return {
          ...current,
          today: {
            ...current.today,
            backlog: current.today.backlog.filter((todo) => todo.id !== action.id),
            todos: [...current.today.todos, { ...item, done: false }],
            message: `「${item.title}」已搬回今天。`,
          },
        };
      });

    case "backlog/tomorrow":
      return touched(state, (current) => {
        const item = current.today.backlog.find((todo) => todo.id === action.id);
        if (!item) return current;
        if (current.today.tomorrow.length >= TOMORROW_LIMIT) {
          return { ...current, today: { ...current.today, message: `明日清單已達 ${TOMORROW_LIMIT} 件。` } };
        }
        return {
          ...current,
          today: {
            ...current.today,
            backlog: current.today.backlog.filter((todo) => todo.id !== action.id),
            tomorrow: [...current.today.tomorrow, { ...item, done: false }],
            message: `「${item.title}」已延到明天。`,
          },
        };
      });

    case "backlog/delete":
      return touched(state, (current) => ({
        ...current,
        today: { ...current.today, backlog: current.today.backlog.filter((todo) => todo.id !== action.id), message: "未完成待辦已刪除。" },
      }));

    case "energy/set":
      return touched(state, (current) => {
        const next = {
          ...current,
          profile: { ...current.profile, energy: Number(action.value) },
          today: { ...current.today, message: Number(action.value) <= 30 ? "保命模式已啟動。" : `今日能量設定為 ${action.value}。` },
        };
        return lockRewardIfReady(next);
      });

    case "recovery/use":
      return touched(state, (current) => {
        if (current.profile.energy > 30) {
          return { ...current, today: { ...current.today, message: "恢復卡只在能量 30 以下時使用。" } };
        }
        if (current.profile.recoveryUsedDay === current.meta.day) {
          return { ...current, today: { ...current.today, message: "今天已使用過恢復卡。" } };
        }
        return {
          ...current,
          profile: { ...current.profile, recoveryUsedDay: current.meta.day },
          today: { ...current.today, message: "恢復卡啟用：今天可以安心休息二十分鐘。" },
        };
      });

    case "reward/claim":
      return touched(state, (current) => {
        const card = current.today.rewardCard || dailyReward(current);
        if (!card.locked) return { ...current, today: { ...current.today, message: "封印還沒有解除。" } };
        if (card.claimed) return current;

        let boosts = current.rewards.boosts;
        let coupons = current.rewards.coupons;
        if (card.effect?.type === "boost") {
          boosts = [...boosts, {
            id: crypto.randomUUID(),
            title: card.title,
            amount: Number(card.effect.amount || 20),
            lanes: card.effect.lanes || ["支線"],
            remaining: 1,
          }];
        }
        if (card.effect?.type === "coupon") {
          coupons = [...coupons, {
            id: crypto.randomUUID(),
            title: card.title,
            target: card.effect.target,
            amount: Number(card.effect.amount || 0),
            remaining: 1,
            expiresAt: moveDay(current.meta.day, Number(card.effect.days || 7)),
          }];
        }
        return {
          ...current,
          today: {
            ...current.today,
            rewardCard: { ...card, claimed: true, claimedAt: Date.now() },
            message: `賞賜已領取：「${card.title}」。`,
          },
          rewards: { ...current.rewards, boosts, coupons },
        };
      });

    case "shop/redeem":
      return touched(state, (current) => {
        const reward = SHOP_REWARDS.find((item) => item.id === action.id);
        if (!reward) return current;
        const availability = shopAvailability(current, reward);
        if (!availability.ok) return { ...current, today: { ...current.today, message: availability.reason } };
        const coupon = activeCoupon(current, reward.id);
        const discount = coupon ? Number(coupon.amount || 0) : 0;
        const price = Math.max(0, reward.cost - discount);
        if (current.profile.coins < price) {
          return { ...current, today: { ...current.today, message: `還差 ${price - current.profile.coins} 金幣。` } };
        }
        const coupons = coupon
          ? current.rewards.coupons.map((item) => item.id === coupon.id ? { ...item, remaining: item.remaining - 1 } : item).filter((item) => item.remaining > 0)
          : current.rewards.coupons;
        return {
          ...current,
          profile: { ...current.profile, coins: current.profile.coins - price },
          rewards: {
            ...current.rewards,
            coupons,
            usage: [{ id: crypto.randomUUID(), rewardId: reward.id, tier: reward.tier, day: current.meta.day, cost: price }, ...current.rewards.usage].slice(0, HISTORY_LIMIT),
          },
          today: { ...current.today, message: `已兌換「${reward.title}」${discount ? `，折抵 ${discount} 金幣` : ""}。` },
        };
      });

    case "fund/redeem":
      return touched(state, (current) => {
        const fund = FUND_TARGETS.find((item) => item.id === action.id);
        if (!fund) return current;
        if (current.profile.coins < fund.coinCost) {
          return { ...current, today: { ...current.today, message: `還差 ${fund.coinCost - current.profile.coins} 金幣。` } };
        }
        return {
          ...current,
          profile: { ...current.profile, coins: current.profile.coins - fund.coinCost },
          rewards: { ...current.rewards, funds: { ...current.rewards.funds, [fund.id]: Number(current.rewards.funds[fund.id] || 0) + fund.cash } },
          today: { ...current.today, message: `${fund.title} +${fund.cash} 元。${fund.note}` },
        };
      });

    case "food/add":
      return touched(state, (current) => {
        const name = `${action.name || ""}`.trim();
        const kcal = Math.round(Number(action.kcal || 0));
        if (!name || kcal <= 0) return { ...current, today: { ...current.today, message: "請輸入食物名稱與熱量。" } };
        const food = { id: crypto.randomUUID(), name, kcal, meal: action.meal || "早餐", createdAt: Date.now() };
        return { ...current, today: { ...current.today, food: [...current.today.food, food], message: `已記錄 ${name}，${kcal} kcal。` } };
      });

    case "food/delete":
      return touched(state, (current) => ({
        ...current,
        today: { ...current.today, food: current.today.food.filter((item) => item.id !== action.id), message: "飲食紀錄已刪除。" },
      }));

    case "health/weight":
      return touched(state, (current) => {
        const weight = Number(action.value);
        if (weight < 30 || weight > 300) return { ...current, today: { ...current.today, message: "體重數字不合理。" } };
        const history = [{ day: current.meta.day, weight }, ...current.health.weightHistory.filter((item) => item.day !== current.meta.day)].slice(0, HISTORY_LIMIT);
        return {
          ...current,
          health: { ...current.health, currentWeight: weight, weightHistory: history },
          today: { ...current.today, message: `體重已記錄：${weight.toFixed(1)} kg。` },
        };
      });

    case "health/settings":
      return touched(state, (current) => ({
        ...current,
        health: {
          ...current.health,
          calorieTarget: Math.max(1200, Math.min(4000, Math.round(Number(action.calorieTarget || current.health.calorieTarget)))),
          warningLimit: Math.max(1300, Math.min(4500, Math.round(Number(action.warningLimit || current.health.warningLimit)))),
          goalWeight: Math.max(40, Math.min(200, Number(action.goalWeight || current.health.goalWeight))),
          heightCm: Math.max(120, Math.min(230, Number(action.heightCm || current.health.heightCm))),
        },
        today: { ...current.today, message: "健康設定已更新。" },
      }));

    case "reflection/add":
      return touched(state, (current) => {
        const reflection = createReflection(action.payload, current.meta.day);
        if (!reflection.keep && !reflection.obstacle && !reflection.retry) return current;
        const reflections = [reflection, ...current.principles.reflections].slice(0, 100);
        const bosses = bossFromReflections(reflections, current.principles.bosses);
        return {
          ...current,
          profile: { ...current.profile, wisdom: current.profile.wisdom + 5 },
          principles: { ...current.principles, reflections, bosses },
          today: { ...current.today, message: "今日復盤已保存，智慧 +5。" },
        };
      });

    case "principle/add":
      return touched(state, (current) => {
        const title = `${action.title || ""}`.trim();
        const rule = `${action.rule || ""}`.trim();
        if (!title || !rule) return current;
        const item = { id: crypto.randomUUID(), title, rule, checks: 0, stage: "實驗原則", createdAt: Date.now(), lastCheckedAt: 0 };
        return {
          ...current,
          profile: { ...current.profile, wisdom: current.profile.wisdom + 10 },
          principles: { ...current.principles, book: [item, ...current.principles.book].slice(0, 100) },
          today: { ...current.today, message: "新原則已加入，智慧 +10。" },
        };
      });

    case "principle/check":
      return touched(state, (current) => ({
        ...current,
        profile: { ...current.profile, wisdom: current.profile.wisdom + 2 },
        principles: {
          ...current.principles,
          book: current.principles.book.map((item) => {
            if (item.id !== action.id) return item;
            const checks = item.checks + 1;
            return { ...item, checks, stage: principleStage(checks), lastCheckedAt: Date.now() };
          }),
        },
        today: { ...current.today, message: "原則已完成一次實戰驗證，智慧 +2。" },
      }));

    case "principle/delete":
      return touched(state, (current) => ({
        ...current,
        principles: { ...current.principles, book: current.principles.book.filter((item) => item.id !== action.id) },
      }));

    case "boss/solve":
      return touched(state, (current) => ({
        ...current,
        profile: { ...current.profile, wisdom: current.profile.wisdom + 10 },
        principles: {
          ...current.principles,
          bosses: current.principles.bosses.map((boss) => boss.id === action.id ? { ...boss, status: "defeated", solvedAt: Date.now() } : boss),
        },
        today: { ...current.today, message: "Boss 已標記擊破，智慧 +10。" },
      }));

    case "today/reset":
      return touched(state, (current) => ({
        ...current,
        profile: { ...current.profile, energy: DEFAULT_ENERGY },
        today: {
          ...current.today,
          tasks: current.today.tasks.map((task) => ({ ...task, done: false })),
          message: "今日任務已重整：能量回到 70。金幣、EXP、待辦、熱量、賞賜與已領任務紀錄全部保留。",
        },
      }));

    case "all/reset":
      return createFreshState();

    default:
      return state;
  }
}