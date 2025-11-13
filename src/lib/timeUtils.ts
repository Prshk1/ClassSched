// Utility functions for time formatting and generating time slots
export type TimeSlot = { start: string; end: string; kind?: "teaching" | "break"; label?: string };

/**
 * Parse a time string like "7:45 AM" into minutes since midnight.
 */
const parseTime = (time: string) => {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Invalid time format: ${time}`);
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (h === 12) h = 0;
  if (ampm === "PM") h += 12;
  return h * 60 + mins;
};

/**
 * Format minutes-since-midnight back into "h:mm AM/PM"
 */
const formatTime = (totalMinutes: number) => {
  totalMinutes = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
  let h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m.toString().padStart(2, "0")} ${ampm}`;
};

/**
 * Generate uniform slots using a fixed step (30 or 60 minutes).
 * Returned slots are marked as kind: "teaching" by default.
 */
export const generateSlots = (start: string, end: string, stepMinutes = 60): TimeSlot[] => {
  const startMin = parseTime(start);
  const endMin = parseTime(end);
  const normalizedEndMin = endMin <= startMin ? endMin + 24 * 60 : endMin;

  const slots: TimeSlot[] = [];
  let cursor = startMin;
  while (cursor + stepMinutes <= normalizedEndMin) {
    slots.push({ start: formatTime(cursor), end: formatTime(cursor + stepMinutes), kind: "teaching" });
    cursor += stepMinutes;
  }
  return slots;
};

/**
 * Generate slots with custom break intervals (breaks can be any length).
 * Use this for SHS where you want 60-minute teaching slots but specific breaks inserted.
 *
 * - fullStart/fullEnd: day window
 * - stepMinutes: the default slot size outside breaks (e.g. 60)
 * - breaks: array of { start, end, stepMinutes?: number, label?: string } where stepMinutes is the size used inside the break
 *
 * Returned slots will be annotated with kind: "break" and label when they fall inside a break range.
 */
export const generateSlotsWithBreaks = (
  fullStart: string,
  fullEnd: string,
  stepMinutes = 60,
  breaks: Array<{ start: string; end: string; stepMinutes?: number; label?: string }> = []
): TimeSlot[] => {
  const startMin = parseTime(fullStart);
  const endMin = parseTime(fullEnd);
  const normalizedEndMin = endMin <= startMin ? endMin + 24 * 60 : endMin;

  // convert breaks to minute ranges and clamp, keep label
  const breakRanges: Array<[number, number, number, string?]> = breaks
    .map((b) => {
      const s = parseTime(b.start);
      const e = parseTime(b.end);
      const ns = s <= startMin ? s + 24 * 60 : s;
      const ne = e <= startMin ? e + 24 * 60 : e;
      return [ns, ne, b.stepMinutes ?? (ne - ns), b.label] as [number, number, number, string?];
    })
    .filter(([ns, ne]) => ne > startMin && ns < normalizedEndMin)
    .map(([ns, ne, st, lb]) => [Math.max(ns, startMin), Math.min(ne, normalizedEndMin), st, lb] as [number, number, number, string?]);

  if (breakRanges.length === 0) {
    return generateSlots(fullStart, fullEnd, stepMinutes);
  }

  // merge overlapping/adjacent break ranges (use smallest stepMinutes among merged if conflicting, and keep a combined label when possible)
  breakRanges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number, number, string?]> = [];
  for (const [s, e, st, lb] of breakRanges) {
    if (merged.length === 0) {
      merged.push([s, e, st, lb]);
    } else {
      const last = merged[merged.length - 1];
      if (s <= last[1]) {
        // overlap/adjacent -> extend end and pick the minimum stepMinutes (shortest),
        // combine label if labels differ (prefer first label)
        last[1] = Math.max(last[1], e);
        last[2] = Math.min(last[2], st);
        if (!last[3] && lb) last[3] = lb;
      } else {
        merged.push([s, e, st, lb]);
      }
    }
  }

  // iterate and create slots: use break step when cursor is inside a merged break; otherwise default stepMinutes
  const slots: TimeSlot[] = [];
  let cursor = startMin;
  while (cursor < normalizedEndMin) {
    const br = merged.find(([s, e]) => cursor >= s && cursor < e);
    const step = br ? br[2] : stepMinutes;
    const next = Math.min(cursor + step, normalizedEndMin);
    if (next > cursor) {
      if (br) {
        // inside a break range -> mark as break and use br[3] as label if present
        slots.push({ start: formatTime(cursor), end: formatTime(next), kind: "break", label: br[3] ?? "Break" });
      } else {
        slots.push({ start: formatTime(cursor), end: formatTime(next), kind: "teaching" });
      }
    }
    cursor = next;
  }

  return slots;
};

/**
 * Prebuilt set for SHS:
 * - hourly teaching slots but with morning recess, lunch break, and afternoon recess.
 * - SHS day ends at 5:15 PM as requested.
 *
 * Recesses per your request:
 *  - morning recess: 9:45 AM - 10:00 AM (15 minutes)
 *  - lunch: 12:00 PM - 1:00 PM (60 minutes)
 *  - afternoon recess: 3:00 PM - 3:15 PM (15 minutes)
 */
export const timeSlotsSHS: TimeSlot[] = generateSlotsWithBreaks(
  "7:45 AM",
  "5:15 PM",
  60,
  [
    { start: "9:45 AM", end: "10:00 AM", stepMinutes: 15, label: "Morning Recess" },
    { start: "12:00 PM", end: "1:00 PM", stepMinutes: 60, label: "Lunch" },
    { start: "3:00 PM", end: "3:15 PM", stepMinutes: 15, label: "Afternoon Recess" },
  ]
);

export const formatTimeRange = (start: string, end: string) => {
  return `${start} - ${end}`;
};

export const formatTimeSlot = (slot: { start: string; end: string }) => {
  return formatTimeRange(slot.start, slot.end);
};