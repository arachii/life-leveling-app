import { playerLevel, playerTitle, nextPlayerTitle } from "../domain/progression.js";
import { caloriesUsed } from "../domain/calories.js";
import { dailyHeadline } from "../domain/reports.js";
import { remainingEnergy } from "../domain/energy.js";

export function Header({ state, syncStatus }) {
  const level = playerLevel(state.profile.xp);
  const next = nextPlayerTitle(level);
  const done = state.today.tasks.filter((task) => task.done).length;

  return (
    <header className="hero">
      <div className="hero-top">
        <div>
          <div className="eyebrow">人生打怪村 v15</div>
          <h1>{state.profile.name} Lv.{level}</h1>
          <span className="title-pill">{playerTitle(level)}</span>
          <div className="muted tiny">{state.meta.day}・{syncStatus}</div>
        </div>
        <div className="village-mark">村</div>
      </div>

      <div className="stat-grid four">
        <MiniStat label="金幣" value={state.profile.coins} />
        <MiniStat label="智慧" value={state.profile.wisdom} />
        <MiniStat label="能量" value={remainingEnergy(state)} />
        <MiniStat label="完成" value={`${done}/${state.today.tasks.length}`} />
      </div>

      <div className="level-box">
        <div className="row between tiny muted">
          <span>角色升級</span>
          <span>{state.profile.xp % 100}/100 EXP・還差 {100 - (state.profile.xp % 100)}</span>
        </div>
        <div className="bar"><span style={{ width: `${state.profile.xp % 100}%` }} /></div>
        <div className="tiny muted">下一稱號：<b className="gold">{next.title}（Lv.{next.level}）</b></div>
      </div>

      <div className="battle-line">
        <div className="row between">
          <span className="muted">今日戰報</span>
          <span className="badge">{done >= 4 ? "雙線推進者" : "火種守門"}</span>
        </div>
        <strong>{dailyHeadline(state)}</strong>
        <div className="tiny muted">今日金幣 {state.today.coinEarned}/300・熱量 {caloriesUsed(state.today.food)}/{state.health.calorieTarget} kcal</div>
      </div>
    </header>
  );
}

export function MiniStat({ label, value }) {
  return <div className="mini-stat"><span>{label}</span><b>{value}</b></div>;
}

export function Panel({ children, className = "" }) {
  return <div className={`panel ${className}`}>{children}</div>;
}

export function SectionTitle({ title, sub, action }) {
  return (
    <div className="section-title">
      <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
      {action}
    </div>
  );
}

export function Notice({ text }) {
  if (!text) return null;
  return <div className="notice">{text}</div>;
}