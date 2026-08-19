import { useState } from "react";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function RecordsPage({ state }) {
  const [openDay, setOpenDay] = useState("");
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = `${date.getFullYear()}-${`${date.getMonth()+1}`.padStart(2,"0")}-${`${date.getDate()}`.padStart(2,"0")}`;
    const lit = state.history.fireLog.some((item) => item.day === key && item.lit);
    return { key, label: `${date.getMonth()+1}/${date.getDate()}`, lit };
  });

  return (
    <section className="page-stack">
      <SectionTitle title="紀錄" sub="看趨勢，不靠記憶評價自己。" />

      <Panel>
        <h3>最近七天火種</h3>
        <div className="fire-row">
          {days.map((day) => (
            <div key={day.key} className={day.lit ? "lit" : ""}>
              <b>{day.lit ? "火" : "○"}</b><span>{day.label}</span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <h3>村長賞賜紀錄</h3>
        {state.rewards.villageHistory.length === 0 ? <p className="muted">跨日後會留下每日賞賜狀態。</p> :
          state.rewards.villageHistory.slice(0, 20).map((item) => (
            <div className="record-line" key={`${item.day}-${item.title}`}>
              <div><b>{item.day}・{item.title}</b><div className="tiny muted">{item.pool}</div></div>
              <span className="gold">{item.status}</span>
            </div>
          ))}
      </Panel>

      <SectionTitle title="歷史戰報" />
      <div className="list">
        {state.history.reports.map((item) => (
          <Panel key={item.day}>
            <button className="record-button" onClick={() => setOpenDay(openDay === item.day ? "" : item.day)}>
              <div className="row between"><b>{item.day}</b><span className="muted tiny">任務 {item.taskDone}/{item.taskTotal}・待辦 {item.todoDone}/{item.todoTotal}</span></div>
              <div className="gold">{item.title}</div>
              <div className="tiny muted">+{item.coins} 金幣・+{item.xp} EXP・熱量 {item.calorieTotal}/{item.calorieTarget}</div>
            </button>
            {openDay === item.day && <pre className="report-text">{item.text}</pre>}
          </Panel>
        ))}
        {state.history.reports.length === 0 && <div className="empty">跨日後會自動建立第一份戰報。</div>}
      </div>
    </section>
  );
}