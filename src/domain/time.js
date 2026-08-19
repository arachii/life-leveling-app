export function dayStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function moveDay(dayText, offset) {
  const source = new Date(`${dayText}T12:00:00`);
  source.setDate(source.getDate() + offset);
  return dayStamp(source);
}

export function dayDistance(older, newer) {
  const a = new Date(`${older}T12:00:00`).getTime();
  const b = new Date(`${newer}T12:00:00`).getTime();
  return Math.floor((b - a) / 86400000);
}

export function prettySyncTime(value) {
  if (!value) return "尚未同步";
  const date = new Date(Number(value));
  return Number.isNaN(date.getTime())
    ? "時間未知"
    : date.toLocaleString("zh-TW", { hour12: false });
}