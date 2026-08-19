import { ENERGY_PRESETS } from "../domain/catalog.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";
import { remainingEnergy } from "../domain/energy.js";

export default function EnergyPage({ state, dispatch }) {
  const currentEnergy = remainingEnergy(state);
  return (
    <section className="page-stack">
      <SectionTitle title="今天的能量" sub={`目前剩餘 ${currentEnergy}。狀態差時不是逼自己做更多，而是把玩法切成保命模式。`} />
      <div className="list">
        {ENERGY_PRESETS.map((item) => (
          <button
            className={`energy-choice ${state.profile.energy === item.value ? "selected" : ""}`}
            key={item.value}
            onClick={() => dispatch({ type: "energy/set", value: item.value })}
          >
            <div><b>{item.label}</b><p>{item.note}</p></div><strong>{item.value}</strong>
          </button>
        ))}
      </div>
      <Panel>
        <h3>免費恢復卡</h3>
        <p>能量 30 以下可啟用一次。休息不是要花金幣買的。</p>
        <button className="primary wide" disabled={currentEnergy > 30 || state.profile.recoveryUsedDay === state.meta.day} onClick={() => dispatch({ type: "recovery/use" })}>
          {state.profile.recoveryUsedDay === state.meta.day ? "今天已使用" : "啟用 20 分鐘恢復"}
        </button>
      </Panel>
    </section>
  );
}