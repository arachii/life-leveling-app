import { useState } from "react";
import { MEAL_TYPES } from "../domain/catalog.js";
import { bmi, calorieBand, caloriesUsed } from "../domain/calories.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function CaloriesPage({ state, dispatch }) {
  const [food, setFood] = useState({ name: "", kcal: "", meal: "早餐" });
  const [weight, setWeight] = useState("");
  const total = caloriesUsed(state.today.food);
  const band = calorieBand(total, state.health.calorieTarget, state.health.warningLimit);
  const percent = Math.min(120, Math.round(total / state.health.calorieTarget * 100));
  const currentBmi = bmi(state.health.currentWeight, state.health.heightCm);

  return (
    <section className="page-stack">
      <SectionTitle title="熱量守門" sub="目標不是挨餓，是看清楚總量。" />
      <Panel>
        <div className="row between"><h3>{total} / {state.health.calorieTarget} kcal</h3><span className={`badge ${band.tone}`}>{band.label}</span></div>
        <div className="bar calorie"><span style={{ width: `${percent}%` }} /></div>
        <p className="muted tiny">
          {band.tone === "good" ? `距目標還有 ${band.remaining} kcal` :
           band.tone === "watch" ? `距警戒線還有 ${band.remaining} kcal` :
           `超過警戒線 ${band.remaining} kcal`}
        </p>
      </Panel>

      <Panel>
        <h3>新增飲食</h3>
        <div className="form-grid">
          <input value={food.name} onChange={(e) => setFood({ ...food, name: e.target.value })} placeholder="食物 / 飲料" />
          <input type="number" value={food.kcal} onChange={(e) => setFood({ ...food, kcal: e.target.value })} placeholder="kcal" />
          <select value={food.meal} onChange={(e) => setFood({ ...food, meal: e.target.value })}>
            {MEAL_TYPES.map((item) => <option key={item}>{item}</option>)}
          </select>
        </div>
        <button className="primary wide" onClick={() => {
          dispatch({ type: "food/add", ...food });
          setFood({ name: "", kcal: "", meal: food.meal });
        }}>記錄</button>
      </Panel>

      <div className="list">
        {state.today.food.map((item) => (
          <div className="todo" key={item.id}>
            <span className="tag">{item.meal}</span>
            <div className="grow"><b>{item.name}</b></div>
            <b>{item.kcal} kcal</b>
            <button className="icon danger" onClick={() => dispatch({ type: "food/delete", id: item.id })}>×</button>
          </div>
        ))}
      </div>

      <SectionTitle title="體重趨勢" />
      <Panel>
        <div className="stat-grid three">
          <div><span>目前</span><b>{state.health.currentWeight} kg</b></div>
          <div><span>目標</span><b>{state.health.goalWeight} kg</b></div>
          <div><span>BMI</span><b>{currentBmi || "-"}</b></div>
        </div>
        <div className="row gap">
          <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} placeholder="今天體重" />
          <button className="primary" onClick={() => { dispatch({ type: "health/weight", value: weight }); setWeight(""); }}>保存</button>
        </div>
        <div className="tiny muted">距目標約 {Math.max(0, state.health.currentWeight - state.health.goalWeight).toFixed(1)} kg。看週趨勢，不責怪單日波動。</div>
      </Panel>

      <div className="list">
        {state.health.weightHistory.slice(0, 14).map((item) => (
          <div className="todo" key={item.day}><span>{item.day}</span><b className="grow right">{item.weight.toFixed(1)} kg</b></div>
        ))}
      </div>
    </section>
  );
}