import { nextRoleTitle, playerLevel, playerTitle, roleTitle, statLevel, statTitle } from "../domain/progression.js";
import { STAT_NAMES } from "../domain/catalog.js";
import { Panel, SectionTitle } from "../ui/ShellParts.jsx";

export default function CharacterPage({ state }) {
  const level = playerLevel(state.profile.xp);
  const nextRole = nextRoleTitle(level);

  return (
    <section className="page-stack">
      <SectionTitle title="角色成長" />
      <Panel className="character-card">
        <div className="avatar">人</div>
        <h2>{roleTitle(level)}</h2>
        <div className="gold">稱號：{playerTitle(level)}</div>
        <div className="tiny muted">下一階位：{nextRole.title}（Lv.{nextRole.level}）</div>
      </Panel>

      <div className="list">
        {STAT_NAMES.map((name) => {
          const xp = Number(state.profile.stats[name] || 0);
          const progress = xp % 50;
          return (
            <Panel key={name}>
              <div className="row between"><b>{name} Lv.{statLevel(xp)}</b><span className="muted">{xp} EXP</span></div>
              <h3>{statTitle(name, xp)}</h3>
              <div className="bar"><span style={{ width: `${progress * 2}%` }} /></div>
              <div className="tiny muted">下一級還差 {50 - progress} EXP</div>
            </Panel>
          );
        })}
      </div>
    </section>
  );
}