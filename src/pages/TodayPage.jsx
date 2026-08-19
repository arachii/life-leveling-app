import { useMemo, useState } from "react";
import { STAT_NAMES } from "../domain/catalog.js";
import { insightFor, seals, tomorrowPlan } from "../domain/rewards.js";
import { remainingEnergy } from "../domain/energy.js";
import { Notice, Panel, SectionTitle } from "../ui/ShellParts.jsx";

function TaskCard({ task, onDone, onDelete }) {
  return (
    <div className={`task-card ${task.done ? "done" : ""}`}>
      <button className="check" onClick={() => onDone(task.id)} disabled={task.done}>✓</button>
      <div className="grow">
        <div className="chips">
          <span>{task.lane}</span><span>{task.rank} 級</span><span>{task.type}</span>
          {task.done && <span className="ok">已完成</span>}
        </div>
        <h3>{task.title}</h3>
        <p>{task.detail}</p>
        <div className="criterion">完成標準：{task.criterion}</div>
        <div className="tiny muted">+{task.coins} 金幣・+{task.xp} EXP・{task.stat} +{task.statXp}・消耗 {task.energyCost}</div>
      </div>
      {task.custom && <button className="icon danger" onClick={() => onDelete(task.id)}>×</button>}
    </div>
  );
}

function Todo({ item, onToggle, onDelete }) {
  return (
    <div className={`todo ${item.done ? "done" : ""}`}>
      <button className="check small" onClick={() => onToggle(item.id)}>✓</button>
      <div className="grow"><b>{item.title}</b><span className="tag">{item.category}</span></div>
      <button className="icon danger" onClick={() => onDelete(item.id)}>×</button>
    </div>
  );
}

export default function TodayPage({ state, dispatch }) {
  const [todoOpen, setTodoOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);
  const [todo, setTodo] = useState({ title: "", category: "生活", target: "today" });
  const [task, setTask] = useState({ title: "", coins: 30, lane: "支線", stat: "心力" });

  const currentEnergy = remainingEnergy(state);
  const survival = currentEnergy <= 30;
  const visible = useMemo(
    () => survival
      ? state.today.tasks.filter((item) => item.lane === "主線" || item.type === "保命任務" || item.type === "體能訓練")
      : state.today.tasks,
    [state.today.tasks, survival]
  );
  const insight = insightFor(state);
  const plan = tomorrowPlan(state.today.tomorrow);

  return (
    <section className="page-stack">
      <Notice text={state.today.message} />

      <Panel>
        <div className="row between gap">
          <div>
            <div className="muted">今日村長觀察</div>
            <h3>{insight.title}</h3>
            <div className="gold tiny">{insight.tag}</div>
          </div>
          <div className="village-small">村</div>
        </div>
        <p>{insight.message}</p>
        <div className="question">村長問：{insight.question}</div>
        <div className="stat-grid four compact">
          <div><span>主線</span><b>{state.today.tasks.filter((x) => x.done && x.lane === "主線").length}</b></div>
          <div><span>待辦</span><b>{state.today.todos.filter((x) => x.done).length}</b></div>
          <div><span>印記</span><b>{seals(state.today.todos)}/3</b></div>
          <div><span>能量</span><b>{currentEnergy}</b></div>
        </div>
      </Panel>

      {survival && <Panel className="warning"><b>保命模式</b><p>能量偏低，畫面只保留主線、保命與體能任務。</p></Panel>}

      <SectionTitle
        title="今日人生主線"
        sub="固定骨架保留，自訂事件可自由增加。"
        action={<button className="secondary" onClick={() => dispatch({ type: "today/reset" })}>重置今日</button>}
      />
      <div className="list">
        {visible.map((item) => (
          <TaskCard
            key={item.id}
            task={item}
            onDone={(id) => dispatch({ type: "task/complete", id })}
            onDelete={(id) => dispatch({ type: "task/delete", id })}
          />
        ))}
      </div>

      <button className="wide secondary" onClick={() => setTaskOpen(!taskOpen)}>＋ 自訂事件</button>
      {taskOpen && (
        <Panel>
          <div className="form-grid">
            <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} placeholder="事件名稱" />
            <input type="number" value={task.coins} onChange={(e) => setTask({ ...task, coins: e.target.value })} placeholder="金幣" />
            <select value={task.lane} onChange={(e) => setTask({ ...task, lane: e.target.value })}>
              <option>主線</option><option>支線</option><option>隨機</option>
            </select>
            <select value={task.stat} onChange={(e) => setTask({ ...task, stat: e.target.value })}>
              {STAT_NAMES.map((name) => <option key={name}>{name}</option>)}
            </select>
          </div>
          <button className="primary wide" onClick={() => {
            dispatch({ type: "task/add", ...task });
            setTask({ title: "", coins: 30, lane: "支線", stat: "心力" });
            setTaskOpen(false);
          }}>加入事件</button>
        </Panel>
      )}

      <SectionTitle
        title="每日待辦"
        sub="待辦不刷金幣，完成可累積 3 枚村民印記。"
        action={<button className="secondary" onClick={() => setTodoOpen(!todoOpen)}>＋ 新增</button>}
      />
      {todoOpen && (
        <Panel>
          <input value={todo.title} onChange={(e) => setTodo({ ...todo, title: e.target.value })} placeholder="待辦內容" />
          <div className="form-grid two">
            <select value={todo.category} onChange={(e) => setTodo({ ...todo, category: e.target.value })}>
              <option>工作</option><option>家庭</option><option>生活</option>
            </select>
            <select value={todo.target} onChange={(e) => setTodo({ ...todo, target: e.target.value })}>
              <option value="today">今天</option><option value="tomorrow">明天</option>
            </select>
          </div>
          <button className="primary wide" onClick={() => {
            dispatch({ type: "todo/add", ...todo });
            setTodo({ title: "", category: "生活", target: "today" });
            setTodoOpen(false);
          }}>加入待辦</button>
        </Panel>
      )}
      <div className="list">
        {state.today.todos.map((item) => (
          <Todo
            key={item.id}
            item={item}
            onToggle={(id) => dispatch({ type: "todo/toggle", id })}
            onDelete={(id) => dispatch({ type: "todo/delete", id })}
          />
        ))}
        {state.today.todos.length === 0 && <div className="empty">今天還沒有自訂待辦。</div>}
      </div>

      <SectionTitle title="明日待辦" sub={`${state.today.tomorrow.length}/5・跨日後自動搬進今天`} />
      <Panel className={plan.tone === "full" ? "warning" : ""}>
        <b>{plan.title}</b><p>{plan.message}</p>
      </Panel>
      <div className="list">
        {state.today.tomorrow.map((item) => (
          <div className="todo tomorrow" key={item.id}>
            <span className="tomorrow-mark">明</span>
            <div className="grow"><b>{item.title}</b><span className="tag">{item.category}</span></div>
            <button className="icon danger" onClick={() => dispatch({ type: "tomorrow/delete", id: item.id })}>×</button>
          </div>
        ))}
      </div>

      <SectionTitle title="未完成待辦" sub="昨天沒做完的事不強塞到今天，由你決定去哪裡。" />
      <div className="list">
        {state.today.backlog.map((item) => (
          <Panel key={item.id}>
            <div className="row between"><b>{item.title}</b><span className="tag">{item.category}</span></div>
            <div className="tiny muted">原本日期：{item.carriedFrom || "前一日"}</div>
            <div className="button-grid three">
              <button className="primary" onClick={() => dispatch({ type: "backlog/today", id: item.id })}>搬到今天</button>
              <button className="secondary" onClick={() => dispatch({ type: "backlog/tomorrow", id: item.id })}>延到明天</button>
              <button className="danger-btn" onClick={() => dispatch({ type: "backlog/delete", id: item.id })}>刪除</button>
            </div>
          </Panel>
        ))}
        {state.today.backlog.length === 0 && <div className="empty">沒有等待處理的舊待辦。</div>}
      </div>
    </section>
  );
}