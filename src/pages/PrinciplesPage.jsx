import { useState } from "react";
import { bossRank } from "../domain/principles.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function PrinciplesPage({ state, dispatch }) {
  const [reflection, setReflection] = useState({ keep: "", obstacle: "", retry: "", problemTag: "" });
  const [principle, setPrinciple] = useState({ title: "", rule: "" });

  return (
    <section className="page-stack">
      <SectionTitle title="原則之書" sub="事情發生 → 復盤 → 提煉 → 實戰驗證 → 修正自己" />

      <Panel>
        <h3>今日三題復盤</h3>
        <label>今天最值得保留的是什麼？</label>
        <textarea value={reflection.keep} onChange={(e) => setReflection({ ...reflection, keep: e.target.value })} />
        <label>今天最大的卡點是什麼？</label>
        <textarea value={reflection.obstacle} onChange={(e) => setReflection({ ...reflection, obstacle: e.target.value })} />
        <label>如果再來一次，我會怎麼做？</label>
        <textarea value={reflection.retry} onChange={(e) => setReflection({ ...reflection, retry: e.target.value })} />
        <label>問題標籤（同一問題出現 3 次會形成 Boss）</label>
        <input value={reflection.problemTag} onChange={(e) => setReflection({ ...reflection, problemTag: e.target.value })} placeholder="例如：拖延、熬夜、衝動消費" />
        <button className="primary wide" onClick={() => {
          dispatch({ type: "reflection/add", payload: reflection });
          setReflection({ keep: "", obstacle: "", retry: "", problemTag: "" });
        }}>保存復盤・智慧 +5</button>
      </Panel>

      <Panel>
        <h3>提煉一條自己的原則</h3>
        <input value={principle.title} onChange={(e) => setPrinciple({ ...principle, title: e.target.value })} placeholder="原則名稱" />
        <textarea value={principle.rule} onChange={(e) => setPrinciple({ ...principle, rule: e.target.value })} placeholder="例如：狀態差時，先做五分鐘版本，不等完整狀態。" />
        <button className="primary wide" onClick={() => {
          dispatch({ type: "principle/add", ...principle });
          setPrinciple({ title: "", rule: "" });
        }}>加入原則・智慧 +10</button>
      </Panel>

      <SectionTitle title="我的原則" sub="1–2 次是實驗，3–6 次變穩定，7 次以上成為核心。" />
      <div className="list">
        {state.principles.book.map((item) => (
          <Panel key={item.id}>
            <div className="row between gap"><h3>{item.title}</h3><span className="badge">{item.stage}</span></div>
            <p>{item.rule}</p>
            <div className="tiny muted">已驗證 {item.checks} 次</div>
            <div className="button-grid two">
              <button className="primary" onClick={() => dispatch({ type: "principle/check", id: item.id })}>這次有效・+2 智慧</button>
              <button className="danger-btn" onClick={() => dispatch({ type: "principle/delete", id: item.id })}>刪除</button>
            </div>
          </Panel>
        ))}
        {state.principles.book.length === 0 && <div className="empty">還沒有自己的原則。先從一次真實復盤開始。</div>}
      </div>

      <SectionTitle title="Boss 圖鑑" sub="反覆出現的卡點，不再當成偶發事件。" />
      <div className="list">
        {state.principles.bosses.map((boss) => (
          <Panel key={boss.id} className={boss.status === "defeated" ? "defeated" : "boss"}>
            <div className="row between">
              <div><h3>{boss.tag}</h3><div className="tiny muted">出現 {boss.count} 次・{bossRank(boss.count)}</div></div>
              <span className="badge">{boss.status === "defeated" ? "已擊破" : "交戰中"}</span>
            </div>
            {boss.status !== "defeated" && (
              <button className="primary wide" onClick={() => dispatch({ type: "boss/solve", id: boss.id })}>標記已找到解法・智慧 +10</button>
            )}
          </Panel>
        ))}
        {state.principles.bosses.length === 0 && <div className="empty">同一問題累積三次後，會自動進入 Boss 圖鑑。</div>}
      </div>

      <SectionTitle title="最近復盤" />
      <div className="list">
        {state.principles.reflections.slice(0, 10).map((item) => (
          <Panel key={item.id}>
            <div className="row between"><b>{item.day}</b>{item.problemTag && <span className="tag">{item.problemTag}</span>}</div>
            {item.keep && <p><b>保留：</b>{item.keep}</p>}
            {item.obstacle && <p><b>卡點：</b>{item.obstacle}</p>}
            {item.retry && <p><b>重來：</b>{item.retry}</p>}
          </Panel>
        ))}
      </div>
    </section>
  );
}