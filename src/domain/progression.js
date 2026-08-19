import { ROLE_STEPS, STAT_LABELS, TITLE_STEPS } from "./catalog.js";

function milestoneLabel(level, steps, chapterWord) {
  let selected = steps[0][1];
  for (const [threshold, label] of steps) {
    if (level >= threshold) selected = label;
  }
  if (level >= 100) {
    const chapter = Math.floor((level - 100) / 25) + 1;
    if (chapter > 1) return `${selected}・${chapterWord}${chapter}`;
  }
  return selected;
}

export function playerLevel(xp) {
  return Math.floor(Number(xp || 0) / 100) + 1;
}

export function playerTitle(level) {
  return milestoneLabel(level, TITLE_STEPS, "第");
}

export function nextPlayerTitle(level) {
  const next = TITLE_STEPS.find(([threshold]) => threshold > level);
  if (next) return { level: next[0], title: next[1] };
  const nextLevel = 100 + (Math.floor((level - 100) / 25) + 1) * 25;
  const chapter = Math.floor((nextLevel - 100) / 25) + 1;
  return { level: nextLevel, title: `自己人生的主人・第${chapter}章` };
}

export function roleTitle(level) {
  return milestoneLabel(level, ROLE_STEPS, "第");
}

export function nextRoleTitle(level) {
  const next = ROLE_STEPS.find(([threshold]) => threshold > level);
  if (next) return { level: next[0], title: next[1] };
  const nextLevel = 100 + (Math.floor((level - 100) / 25) + 1) * 25;
  const tier = Math.floor((nextLevel - 100) / 25) + 1;
  return { level: nextLevel, title: `人生村長・第${tier}階` };
}

export function statLevel(xp) {
  return Math.floor(Number(xp || 0) / 50) + 1;
}

export function statTitle(name, xp) {
  const list = STAT_LABELS[name] || ["成長中"];
  const index = Math.min(list.length - 1, statLevel(xp) - 1);
  return list[index];
}