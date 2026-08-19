import { caloriesUsed } from "./calories.js";
import { completedMain, completedTodos, dailyReward, insightFor } from "./rewards.js";

export function reportFor(state) {
  const taskDone = state.today.tasks.filter((task) => task.done).length;
  const todoDone = completedTodos(state.today.todos);
  const calorieTotal = caloriesUsed(state.today.food);
  const insight = insightFor(state);
  const reward = dailyReward(state);

  const title =
    taskDone >= 5 ? "高輸出日" :
    completedMain(state.today.tasks) >= 2 ? "主線推進日" :
    taskDone + todoDone > 0 ? "火種未斷" : "休整日";

  return {
    day: state.meta.day,
    title,
    taskDone,
    taskTotal: state.today.tasks.length,
    todoDone,
    todoTotal: state.today.todos.length,
    coins: state.today.coinEarned,
    xp: state.today.xpEarned,
    calorieTotal,
    calorieTarget: state.health.calorieTarget,
    tomorrowTotal: state.today.tomorrow.length,
    rewardTitle: reward.claimed ? reward.title : "未領取",
    insightTitle: insight.title,
    text: [
      `今日：${taskDone}/${state.today.tasks.length} 任務，${todoDone}/${state.today.todos.length} 待辦。`,
      `獲得 ${state.today.coinEarned} 金幣、${state.today.xpEarned} EXP。`,
      `熱量 ${calorieTotal}/${state.health.calorieTarget} kcal。`,
      `村長觀察：${insight.title}。`,
    ].join("\n"),
  };
}

export function dailyHeadline(state) {
  const report = reportFor(state);
  if (report.taskDone + report.todoDone === 0) return "今天還沒開始，先做一件最小的事。";
  if (report.taskDone >= 5) return "今天輸出很高，接下來要顧續航，不必再硬加碼。";
  if (report.taskDone >= 3) return "今天主線有推進，節奏正在形成。";
  return "火種還在，今天不是零分。";
}