export function principleStage(checks) {
  if (checks >= 7) return "核心原則";
  if (checks >= 3) return "穩定原則";
  return "實驗原則";
}

export function bossRank(count) {
  if (count >= 10) return "大型 Boss";
  if (count >= 6) return "中型 Boss";
  return "新生 Boss";
}

export function normalizeProblemTag(value) {
  return `${value || ""}`.trim().replace(/\s+/g, " ").slice(0, 24);
}

export function createReflection({ keep, obstacle, retry, problemTag }, day) {
  return {
    id: crypto.randomUUID(),
    day,
    keep: keep.trim(),
    obstacle: obstacle.trim(),
    retry: retry.trim(),
    problemTag: normalizeProblemTag(problemTag),
    createdAt: Date.now(),
  };
}

export function bossFromReflections(reflections, existingBosses) {
  const counts = new Map();
  for (const item of reflections) {
    const tag = normalizeProblemTag(item.problemTag);
    if (!tag) continue;
    counts.set(tag, (counts.get(tag) || 0) + 1);
  }

  const known = new Map((existingBosses || []).map((boss) => [boss.tag, boss]));
  const next = [...(existingBosses || [])];

  for (const [tag, count] of counts) {
    if (count < 3) continue;
    const current = known.get(tag);
    if (current) {
      const index = next.findIndex((boss) => boss.id === current.id);
      next[index] = { ...current, count };
    } else {
      next.unshift({
        id: crypto.randomUUID(),
        tag,
        count,
        status: "active",
        createdAt: Date.now(),
        solvedAt: 0,
      });
    }
  }
  return next;
}