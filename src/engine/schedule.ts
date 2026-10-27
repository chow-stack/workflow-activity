export type Frequency = "hour" | "day" | "week";

export interface ScheduleConfig {
  frequency: Frequency;
  time: string; // "HH:MM"
  weekday: number; // 0 = Sunday, used when frequency = week
}

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
export const short = (d: number) => WEEKDAYS[d].slice(0, 3);
const pad = (n: number) => String(n).padStart(2, "0");

function parseTime(t: string): { h: number; m: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec((t ?? "").trim());
  if (!m) return { h: 0, m: 0 };
  return { h: Math.min(23, Number(m[1])), m: Math.min(59, Number(m[2])) };
}

export interface Fire {
  fired_at: string; // "Mon 08:00"
  weekday: string; // "Monday"
  time: string; // "08:00"
}

/** Every time the schedule fires inside the simulated window. */
export function fireTimes(cfg: ScheduleConfig, window: { startWeekday: number; days: number }): Fire[] {
  const { h, m } = parseTime(cfg.time);
  const fires: Fire[] = [];
  for (let d = 0; d < window.days; d++) {
    const wd = (window.startWeekday + d) % 7;
    const hours = cfg.frequency === "hour" ? [...Array(24).keys()] : [h];
    if (cfg.frequency === "week" && wd !== Number(cfg.weekday)) continue;
    for (const hh of hours) {
      const time = `${pad(hh)}:${pad(m)}`;
      fires.push({ fired_at: `${short(wd)} ${time}`, weekday: WEEKDAYS[wd], time });
    }
  }
  return fires;
}

export function describeSchedule(cfg: ScheduleConfig): string {
  const { h, m } = parseTime(cfg.time);
  const t = `${pad(h)}:${pad(m)}`;
  if (cfg.frequency === "hour") return `Every hour at :${pad(m)}`;
  if (cfg.frequency === "day") return `Every day at ${t}`;
  return `Every ${WEEKDAYS[Number(cfg.weekday)] ?? "week"} at ${t}`;
}
