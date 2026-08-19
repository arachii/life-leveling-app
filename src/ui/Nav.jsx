export const TABS = [
  ["today", "今日"],
  ["principles", "原則"],
  ["rewards", "賞賜"],
  ["calories", "熱量"],
  ["records", "紀錄"],
  ["character", "角色"],
  ["energy", "能量"],
  ["settings", "設定"],
];

export default function Nav({ active, onChange }) {
  return (
    <nav className="nav-grid">
      {TABS.map(([key, label]) => (
        <button
          type="button"
          key={key}
          className={active === key ? "active" : ""}
          onClick={() => onChange(key)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}