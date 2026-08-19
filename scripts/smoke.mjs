import { createFreshState, advanceToToday } from "../src/domain/state.js";
import { villageReducer } from "../src/store/reducer.js";
import { caloriesUsed, bmi } from "../src/domain/calories.js";
import { principleStage } from "../src/domain/principles.js";
import { remainingEnergy } from "../src/domain/energy.js";

function ok(condition, message) {
  if (!condition) throw new Error(message);
}

let state = createFreshState();
const first = state.today.tasks[0];
state = villageReducer(state, { type: "task/complete", id: first.id });
ok(state.profile.coins === first.coins, "task reward failed");
ok(state.today.tasks[0].done === true, "task completion failed");
ok(remainingEnergy(state) === 69, "energy consumption failed");

const coins = state.profile.coins;
state = villageReducer(state, { type: "today/reset" });
ok(state.profile.energy === 70, "energy reset failed");
ok(remainingEnergy(state) === 70, "effective energy reset failed");
ok(state.today.tasks[0].done === false, "task reset failed");
state = villageReducer(state, { type: "task/complete", id: first.id });
ok(state.profile.coins === coins, "manual reset allowed duplicate coins");

state = villageReducer(state, { type: "food/add", name: "測試餐", kcal: 500, meal: "午餐" });
ok(caloriesUsed(state.today.food) === 500, "calorie total failed");
ok(bmi(94, 176) > 30, "bmi failed");
ok(principleStage(7) === "核心原則", "principle stages failed");

for (let i = 0; i < 3; i += 1) {
  state = villageReducer(state, {
    type: "reflection/add",
    payload: { keep: "有做", obstacle: "卡住", retry: "先做五分鐘", problemTag: "拖延" },
  });
}
ok(state.principles.bosses.some((boss) => boss.tag === "拖延"), "boss creation failed");

console.log("SMOKE_OK");