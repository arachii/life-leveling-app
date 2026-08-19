export function caloriesUsed(entries) {
  return (entries || []).reduce((sum, item) => sum + Number(item.kcal || 0), 0);
}

export function calorieBand(total, target, warning) {
  const goal = Number(target || 1900);
  const ceiling = Number(warning || 2000);
  if (total <= goal) {
    return { tone: "good", label: "在目標內", remaining: goal - total };
  }
  if (total <= ceiling) {
    return { tone: "watch", label: "接近警戒線", remaining: ceiling - total };
  }
  return { tone: "high", label: "超過警戒線", remaining: total - ceiling };
}

export function bmi(weight, heightCm) {
  const h = Number(heightCm || 0) / 100;
  if (!h || !weight) return 0;
  return Number((Number(weight) / (h * h)).toFixed(1));
}