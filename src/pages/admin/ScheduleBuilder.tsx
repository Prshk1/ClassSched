import React from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Save, Printer, Trash2, Edit, Maximize2, Minimize2, Check, ChevronUp, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { generateSlots, timeSlotsSHS, formatTimeSlot, TimeSlot } from "@/lib/timeUtils";

type SlotData = {
  subject: string;
  teacher: string;
  room: string;
};

// EventItem now supports multi-day events via `days: string[]`
// This lets a single event represent the same schedule across multiple weekdays.
type ChangeRecord = {
  field: string;
  from: any;
  to: any;
  by: string;
  at: string;
};

type EventItem = {
  id: string;
  days: string[]; // one or more weekdays, e.g. ["Monday","Wednesday"]
  start: string;
  end: string;
  subject: string;
  teacher: string;
  room: string;

  // audit fields
  createdBy: string;
  createdAt: string; // ISO
  modifiedBy?: string;
  modifiedAt?: string;
  changes?: ChangeRecord[];
};

const FULL_DAY_START = "8:00 AM";
const FULL_DAY_END = "7:00 PM";

// ROW height in pixels (controls the whole table row height).
const MIN_ROW_PX = 140;

function parseTimeToMinutes(time: string) {
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Invalid time format: ${time}`);
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (h === 12) h = 0;
  if (ampm === "PM") h += 12;
  return h * 60 + mins;
}

const makeId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const getDefaultSchoolYear = (): string => {
  const now = new Date();
  // assume academic year starts in June (adjust if your school uses different cutoff)
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
};

const sampleSubjects = [
  "Mathematics",
  "English",
  "Science",
  "History",
  "Filipino",
  "Computer Science",
];

const sampleTeachers = [
  "Carl Alfred Chan",
  "Sergs Erl Fulay",
  "Christian Jose Mendegorin",
  "Joy Siocon",
  "Ligaya Chan",
];

const sampleRooms = [
  "Room 1",
  "Room 2",
  "Room 3",
  "Computer Lab 1",
  "Computer Lab 2",
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

// Small Clock component (updates every second)
const Clock = () => {
  const [now, setNow] = useState<Date>(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const timeStr = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = now.toLocaleDateString([], { weekday: "short", year: "numeric", month: "short", day: "numeric" });

  return (
    <div className="flex flex-col items-end text-right select-none">
      <div className="text-sm font-medium">{timeStr}</div>
      <div className="text-xs text-muted-foreground">{dateStr}</div>
    </div>
  );
};

// Small accessible toggle switch (circle) — uses an input underneath for accessibility
type ToggleSwitchProps = {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel?: string;
};
const ToggleSwitch = ({ checked, onChange, ariaLabel }: ToggleSwitchProps) => {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel ?? "Toggle"}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex items-center transition-colors duration-150 focus:outline-none ${
        checked ? "bg-emerald-500" : "bg-gray-200 dark:bg-gray-700 border border-border"
      } rounded-full h-6 w-11 p-1`}
      style={{ verticalAlign: "middle" }}
    >
      <span
        className={`bg-white rounded-full h-4 w-4 shadow transform transition-transform duration-150 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
};

// NOTE: for demo purposes we pick a current user constant.
// In a real app this should come from auth context / server.
const CURRENT_USER = typeof window !== "undefined" ? (window as any).__CURRENT_USER ?? "Joy Siocon" : "Joy Siocon";

const ScheduleBuilder = () => {
  const [selectedClass, setSelectedClass] = useState("");
  const [scheduleType, setScheduleType] = useState<"shs" | "tesda">("shs");

  // NEW: school year list + selection and semester state
  const [schoolYears, setSchoolYears] = useState<string[]>(() => {
    const base = new Date().getFullYear();
    const opts: string[] = [];
    for (let i = -2; i <= 2; i++) {
      const start = base + i;
      opts.push(`${start}-${start + 1}`);
    }
    const def = getDefaultSchoolYear();
    if (!opts.includes(def)) opts.unshift(def);
    return opts;
  });
  const [schoolYear, setSchoolYear] = useState<string>(getDefaultSchoolYear());
  const [semester, setSemester] = useState<"first" | "second">("first");

  // add school year UI state
  const [addingYear, setAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState("");

  // TESDA half-hour toggle and per-hour splits
  const [halfHourEnabled, setHalfHourEnabled] = useState(false);
  const [splitHours, setSplitHours] = useState<string[]>([]); // values like "10:00 AM"

  // UI: collapse/expand the intervals selection
  const [intervalsOpen, setIntervalsOpen] = useState(true);

  // hourOptions only on the hour (":00") for toggling which hours split
  const hourOptions = useMemo(() => generateSlots(FULL_DAY_START, FULL_DAY_END, 60).map((s) => s.start), []);

  // halfOptions (30-min boundaries) used in places where we need 30-min choices (kept for potential future UI)
  const halfOptions = useMemo(() => generateSlots(FULL_DAY_START, FULL_DAY_END, 30).map((s) => s.start), []);

  // ensure the intervals panel opens automatically when enabling half-hour mode
  useEffect(() => {
    if (halfHourEnabled) setIntervalsOpen(true);
  }, [halfHourEnabled]);

  // events list (initially empty)
  const [events, setEvents] = useState<EventItem[]>([]);

  // UI state for generation
  const [isGenerating, setIsGenerating] = useState(false);

  // printable/ref for fullscreen/print/pdf: use a dedicated wrapper div so fullscreened element can scroll
  const printableRef = useRef<HTMLDivElement | null>(null);

  // FULLSCREEN state
  const [isFullScreen, setIsFullScreen] = useState(false);

  // compute timeSlots to use in grid and selects:
  const timeSlots: TimeSlot[] = useMemo(() => {
    if (scheduleType === "shs") {
      // Use SHS slots which include break-type slots
      return timeSlotsSHS;
    }
    if (!halfHourEnabled) {
      return generateSlots(FULL_DAY_START, FULL_DAY_END, 60);
    }

    const halfSlots = generateSlots(FULL_DAY_START, FULL_DAY_END, 30);
    if (splitHours.length === 0) return halfSlots;

    const splitHourMinutes = new Set<number>(splitHours.map((h) => parseTimeToMinutes(h)));
    const merged: typeof halfSlots = [];
    let i = 0;
    while (i < halfSlots.length) {
      const slot = halfSlots[i];
      const startMin = parseTimeToMinutes(slot.start);
      const hourStartMin = Math.floor(startMin / 60) * 60;
      if (splitHourMinutes.has(hourStartMin)) {
        merged.push(slot);
        i += 1;
        continue;
      }
      const next = halfSlots[i + 1];
      if (next) {
        const nextStartMin = parseTimeToMinutes(next.start);
        if (nextStartMin === startMin + 30 && Math.floor(nextStartMin / 60) * 60 === hourStartMin) {
          merged.push({ start: slot.start, end: next.end, kind: "teaching" } as any);
          i += 2;
          continue;
        }
      }
      merged.push(slot);
      i += 1;
    }
    return merged;
  }, [scheduleType, halfHourEnabled, splitHours]);

  // WEEK DAYS: include Saturday only for TESDA
  const weekDays = useMemo(
    () => (scheduleType === "tesda" ? ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]),
    [scheduleType]
  );

  // Modal / edit state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form controlled values
  const [formSubject, setFormSubject] = useState<string>("");
  const [formTeacher, setFormTeacher] = useState<string>("");
  const [formRoom, setFormRoom] = useState<string>("");

  const [formDay, setFormDay] = useState<string | null>(null);
  const [formStartTime, setFormStartTime] = useState<string | null>(null);
  const [formEndTime, setFormEndTime] = useState<string | null>(null);

  // Drag selection state (support rectangle selection across days and time slots)
  const [isSelecting, setIsSelecting] = useState(false);
  const [selStartDay, setSelStartDay] = useState<string | null>(null);
  const [selEndDay, setSelEndDay] = useState<string | null>(null);
  const [selStartIndex, setSelStartIndex] = useState<number | null>(null);
  const [selEndIndex, setSelEndIndex] = useState<number | null>(null);
  const ignoreSelectionRef = useRef(false);

  // Modal multi-day creation controls
  const [modalSelectedDays, setModalSelectedDays] = useState<string[] | null>(null);
  const [modalApplyToAll, setModalApplyToAll] = useState<boolean>(true);

  useEffect(() => {
    if (scheduleType !== "tesda") {
      setHalfHourEnabled(false);
      setSplitHours([]);
    }
  }, [scheduleType]);

  // helpers to map times to indices
  const indexOfSlotStart = (time: string) => {
    const t = parseTimeToMinutes(time);
    let idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.start) === t);
    if (idx !== -1) return idx;
    idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.start) <= t && parseTimeToMinutes(s.end) > t);
    if (idx !== -1) return idx;
    idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.start) > t);
    return idx === -1 ? timeSlots.length - 1 : idx;
  };

  const indexOfSlotEnd = (time: string) => {
    const t = parseTimeToMinutes(time);
    let idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.end) === t);
    if (idx !== -1) return idx;
    idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.start) === t);
    if (idx !== -1) {
      return idx > 0 ? idx - 1 : idx;
    }
    idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.start) < t && parseTimeToMinutes(s.end) > t);
    if (idx !== -1) return idx;
    idx = timeSlots.findIndex((s) => parseTimeToMinutes(s.end) > t);
    return idx === -1 ? timeSlots.length - 1 : idx;
  };

  // helper: shallow array equality (order-sensitive)
  function arraysEqual(a: string[], b: string[]) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }

  // Open modal for a rectangular selection: days[] and start/end slot indices.
  const openCreateModalWithRange = (days: string[], startIndex: number, endIndex: number) => {
    const s = Math.min(startIndex, endIndex);
    const e = Math.max(startIndex, endIndex);

    // don't block selection here; validation happens on save.
    const start = timeSlots[s].start;
    const end = timeSlots[e].end;

    // If the selection covers multiple days, prepare modalSelectedDays so we know to create a multi-day event.
    setModalSelectedDays(days.length > 1 ? days : null);
    setModalApplyToAll(days.length > 1);

    setEditingId(null);
    setFormStartTime(start);
    setFormEndTime(end);
    setFormSubject("");
    setFormTeacher("");
    setFormRoom("");

    // default formDay to first day in selection (user can change if desired)
    setFormDay(days[0] ?? null);

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setFormDay(null);
    setFormStartTime(null);
    setFormEndTime(null);
    setFormSubject("");
    setFormTeacher("");
    setFormRoom("");
    setModalSelectedDays(null);
    setModalApplyToAll(true);
  };

  // Helper to check if a time range intersects break slots for a specific day.
  // Friday (for SHS) is allowed to schedule during break slots per requirement.
  const rangeIntersectsBlockedBreak = (startIdx: number, endIdx: number, day: string) => {
    const slice = timeSlots.slice(startIdx, endIdx + 1);
    const hasBreak = slice.some((slot) => slot.kind === "break");
    if (!hasBreak) return false;
    // If SHS and the day is Friday -> allow (Friday doesn't have recess/lunch)
    if (scheduleType === "shs" && day === "Friday") return false;
    // Otherwise break intersects and is blocked
    return true;
  };

  const saveSlot = () => {
    if (!formStartTime || !formEndTime) return;
    if (!formSubject) return;

    const sIdx = indexOfSlotStart(formStartTime);
    const eIdx = indexOfSlotEnd(formEndTime);
    if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) return;

    if (editingId) {
      // edit single event
      setEvents((prev) =>
        prev.map((ev) => {
          if (ev.id !== editingId) return ev;

          // The event being edited might be multi-day; we will preserve ev.days unless UI changed it.
          // In this modal we only provide a single Day select (formDay) -> keep days same unless user picked a different single day.
          const newDays = ev.days.length > 1 ? ev.days : [formDay ?? ev.days[0]];

          // Validate per-day break intersections: if any day is blocked, abort (no change).
          const blocked = newDays.some((d) => rangeIntersectsBlockedBreak(sIdx, eIdx, d));
          if (blocked) {
            alert("The selected time range intersects a break slot for one or more selected days. Adjust times or selection.");
            return ev;
          }

          // compute changes
          const changes: ChangeRecord[] = [];
          const nowISO = new Date().toISOString();
          if (!arraysEqual(ev.days, newDays)) changes.push({ field: "days", from: ev.days, to: newDays, by: CURRENT_USER, at: nowISO });
          if (ev.start !== formStartTime) changes.push({ field: "start", from: ev.start, to: formStartTime, by: CURRENT_USER, at: nowISO });
          if (ev.end !== formEndTime) changes.push({ field: "end", from: ev.end, to: formEndTime, by: CURRENT_USER, at: nowISO });
          if (ev.subject !== formSubject) changes.push({ field: "subject", from: ev.subject, to: formSubject, by: CURRENT_USER, at: nowISO });
          if ((ev.teacher || "TBD") !== (formTeacher || "TBD")) changes.push({ field: "teacher", from: ev.teacher, to: formTeacher || "TBD", by: CURRENT_USER, at: nowISO });
          if ((ev.room || "TBD") !== (formRoom || "TBD")) changes.push({ field: "room", from: ev.room, to: formRoom || "TBD", by: CURRENT_USER, at: nowISO });

          if (changes.length === 0) {
            // nothing changed
            return ev;
          }

          return {
            ...ev,
            days: newDays,
            start: formStartTime,
            end: formEndTime,
            subject: formSubject,
            teacher: formTeacher || "TBD",
            room: formRoom || "TBD",
            modifiedBy: CURRENT_USER,
            modifiedAt: nowISO,
            changes: [...(ev.changes ?? []), ...changes],
          };
        })
      );
    } else {
      // creation paths

      // targetDays depending on modalSelectedDays/modalApplyToAll/formDay
      if (modalSelectedDays && modalApplyToAll) {
        // single multi-day event object with days array
        // Validate: ensure no non-Friday day intersects break slots
        const blocked = modalSelectedDays.some((d) => rangeIntersectsBlockedBreak(sIdx, eIdx, d));
        if (blocked) {
          alert("The selected time range intersects a break slot for one or more selected days. Adjust times or selection.");
          return;
        }

        // avoid exact duplicates: same days array + same details
        const exists = events.some((ev) =>
          arraysEqual(ev.days, modalSelectedDays) &&
          ev.start === formStartTime &&
          ev.end === formEndTime &&
          ev.subject === formSubject &&
          ev.teacher === (formTeacher || "TBD") &&
          ev.room === (formRoom || "TBD")
        );
        if (!exists) {
          const nowISO = new Date().toISOString();
          const newEvent: EventItem = {
            id: makeId(),
            days: modalSelectedDays,
            start: formStartTime,
            end: formEndTime,
            subject: formSubject,
            teacher: formTeacher || "TBD",
            room: formRoom || "TBD",
            createdBy: CURRENT_USER,
            createdAt: nowISO,
          };
          setEvents((prev) => [...prev, newEvent]);
        }
      } else if (modalSelectedDays && !modalApplyToAll) {
        // create separate event per day (preserve previous behavior)
        const newEvents: EventItem[] = [];
        const nowISO = new Date().toISOString();
        modalSelectedDays.forEach((d) => {
          if (rangeIntersectsBlockedBreak(sIdx, eIdx, d)) {
            // skip creation for blocked days (we keep behavior per-day)
            return;
          }
          const exists = events.some((ev) =>
            ev.days.length === 1 &&
            ev.days[0] === d &&
            ev.start === formStartTime &&
            ev.end === formEndTime &&
            ev.subject === formSubject &&
            ev.teacher === (formTeacher || "TBD") &&
            ev.room === (formRoom || "TBD")
          );
          if (!exists) {
            newEvents.push({
              id: makeId(),
              days: [d],
              start: formStartTime,
              end: formEndTime,
              subject: formSubject,
              teacher: formTeacher || "TBD",
              room: formRoom || "TBD",
              createdBy: CURRENT_USER,
              createdAt: nowISO,
            });
          }
        });
        if (newEvents.length) setEvents((prev) => [...prev, ...newEvents]);
      } else {
        // single day creation (use formDay)
        const dayToUse = formDay || weekDays[0];
        if (rangeIntersectsBlockedBreak(sIdx, eIdx, dayToUse)) {
          alert("The selected time range intersects a break slot for the selected day. Adjust times or selection.");
          return;
        }

        const exists = events.some((ev) =>
          ev.days.length === 1 &&
          ev.days[0] === dayToUse &&
          ev.start === formStartTime &&
          ev.end === formEndTime &&
          ev.subject === formSubject &&
          ev.teacher === (formTeacher || "TBD") &&
          ev.room === (formRoom || "TBD")
        );
        if (!exists) {
          const nowISO = new Date().toISOString();
          const newEvent: EventItem = {
            id: makeId(),
            days: [dayToUse],
            start: formStartTime,
            end: formEndTime,
            subject: formSubject,
            teacher: formTeacher || "TBD",
            room: formRoom || "TBD",
            createdBy: CURRENT_USER,
            createdAt: nowISO,
          };
          setEvents((prev) => [...prev, newEvent]);
        }
      }
    }

    closeModal();
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    closeModal();
  };

  // drag handlers (now allow expanding across days)
  const handleCellMouseDown = (day: string, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    // allow starting selection on break cells for Friday in SHS (Friday has no break)
    if (timeSlots[index]?.kind === "break" && !(scheduleType === "shs" && day === "Friday")) return;
    ignoreSelectionRef.current = true;
    setIsSelecting(true);
    setSelStartDay(day);
    setSelEndDay(day);
    setSelStartIndex(index);
    setSelEndIndex(index);
    document.body.style.userSelect = "none";
  };

  // Now when entering another cell (different day or index) we update end markers allowing rectangle selection
  const handleCellMouseEnter = (day: string, index: number) => {
    if (!isSelecting) return;
    // skip entering blocked break cells unless Friday in SHS
    if (timeSlots[index]?.kind === "break" && !(scheduleType === "shs" && day === "Friday")) return;
    setSelEndIndex(index);
    setSelEndDay(day);
  };

  // whether a cell is inside the current rectangular selection
  const isCellSelected = (day: string, idx: number) => {
    if (!isSelecting || selStartIndex === null || selEndIndex === null || selStartDay === null || selEndDay === null) return false;
    const s = Math.min(selStartIndex, selEndIndex);
    const e = Math.max(selStartIndex, selEndIndex);
    const dayIdx = weekDays.indexOf(day);
    const ds = Math.min(weekDays.indexOf(selStartDay), weekDays.indexOf(selEndDay));
    const de = Math.max(weekDays.indexOf(selStartDay), weekDays.indexOf(selEndDay));
    if (dayIdx === -1 || ds === -1 || de === -1) return false;
    return idx >= s && idx <= e && dayIdx >= ds && dayIdx <= de;
  };

  const finalizeSelection = () => {
    if (selStartDay !== null && selEndDay !== null && selStartIndex !== null && selEndIndex !== null) {
      const sIdx = Math.min(selStartIndex, selEndIndex);
      const eIdx = Math.max(selStartIndex, selEndIndex);
      const startDayIdx = weekDays.indexOf(selStartDay);
      const endDayIdx = weekDays.indexOf(selEndDay);
      if (startDayIdx === -1 || endDayIdx === -1) {
        // fallback to single-day
        openCreateModalWithRange([selStartDay!], sIdx, eIdx);
      } else {
        const ds = Math.min(startDayIdx, endDayIdx);
        const de = Math.max(startDayIdx, endDayIdx);
        const daysRange = weekDays.slice(ds, de + 1);
        openCreateModalWithRange(daysRange, sIdx, eIdx);
      }
    }
    setIsSelecting(false);
    setSelStartDay(null);
    setSelEndDay(null);
    setSelStartIndex(null);
    setSelEndIndex(null);
    document.body.style.userSelect = "";
    ignoreSelectionRef.current = false;
  };

  const handleExistingClick = (day: string, startTime: string) => {
    const slotIdx = indexOfSlotStart(startTime);
    const ev = events.find((e) => e.days.includes(day) && indexOfSlotStart(e.start) === slotIdx);
    if (!ev) return;
    setEditingId(ev.id);
    // populate form with first day of event for editing convenience
    setFormDay(ev.days[0] ?? null);
    setFormStartTime(ev.start);
    setFormEndTime(ev.end);
    setFormSubject(ev.subject);
    setFormTeacher(ev.teacher);
    setFormRoom(ev.room);
    // editing a single (maybe multi-day) event -> clear multi-day modal state
    setModalSelectedDays(null);
    setModalApplyToAll(true);
    setModalOpen(true);
  };

  const toggleSplitHour = (hour: string) => {
    setSplitHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]));
  };

  // --- measure table row heights so we can set each event's pixel height explicitly ---
  const tableRef = useRef<HTMLTableElement | null>(null);
  const rowsRef = useRef<Array<HTMLTableRowElement | null>>([]);
  const [rowHeights, setRowHeights] = useState<number[]>([]);

  const measureRowHeights = () => {
    const heights = rowsRef.current.map((r) => {
      if (!r) return MIN_ROW_PX;
      const measured = Math.max(1, Math.round(r.getBoundingClientRect().height));
      return Math.max(measured, MIN_ROW_PX);
    });
    setRowHeights(heights);
  };

  useEffect(() => {
    measureRowHeights();
    if (!tableRef.current) return;
    const obs = new ResizeObserver(() => {
      requestAnimationFrame(measureRowHeights);
    });
    obs.observe(tableRef.current);
    rowsRef.current.forEach((r) => r && obs.observe(r));
    return () => obs.disconnect();
  }, [timeSlots, events]);

  const pxHeightForSpan = (startIdx: number, endIdx: number) => {
    if (!rowHeights || rowHeights.length === 0) {
      const EST = MIN_ROW_PX;
      return (endIdx - startIdx + 1) * EST;
    }
    const slice = rowHeights.slice(startIdx, endIdx + 1);
    return slice.reduce((a, b) => a + b, 0);
  };

  // add new school year handler (simple format validation YYYY-YYYY)
  const addSchoolYear = () => {
    const v = newYearInput.trim();
    if (!/^\d{4}-\d{4}$/.test(v)) {
      alert("Please enter school year in format YYYY-YYYY (e.g. 2025-2026).");
      return;
    }
    if (schoolYears.includes(v)) {
      alert("That school year already exists.");
      return;
    }
    setSchoolYears((prev) => [v, ...prev]);
    setSchoolYear(v);
    setNewYearInput("");
    setAddingYear(false);
  };

  // FULLSCREEN: toggle the printable wrapper into fullscreen (make sure wrapper can scroll)
  const toggleFullScreen = async () => {
    const node = printableRef.current;
    if (!node) {
      alert("Nothing to fullscreen.");
      return;
    }
    try {
      if (document.fullscreenElement === node || (document as any).webkitFullscreenElement === node) {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        }
        setIsFullScreen(false);
      } else {
        // request fullscreen on the wrapper node (which we ensure is a div)
        if ((node as any).requestFullscreen) {
          await (node as any).requestFullscreen();
        } else if ((node as any).webkitRequestFullscreen) {
          await (node as any).webkitRequestFullscreen();
        } else {
          alert("Fullscreen API is not supported in this browser.");
        }
        setIsFullScreen(true);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Fullscreen error:", err);
      alert("Failed to change fullscreen mode.");
    }
  };

  // PRINT: iframe approach (avoids popup blocking)
  const handlePrint = () => {
    const node = printableRef.current;
    if (!node) {
      alert("Nothing to print.");
      return;
    }

    if (typeof window === "undefined") {
      alert("Printing is not available on the server.");
      return;
    }

    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      alert("Unable to open print frame.");
      return;
    }

    const headerHtml = `<div style="margin-bottom:12px;">
      <strong style="font-size:16px;">Schedule Report</strong><br/>
      <span style="font-size:13px;">${selectedClass || "—"} • SY ${schoolYear} • ${semester === "first" ? "1st Sem" : "2nd Sem"}</span>
    </div>`;

    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111827; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e6e6e6; padding: 8px; vertical-align: top; }
        th { background: #f3f4f6; font-weight: 600; text-align: center; }
        .subject { font-weight: 600; color: #0f172a; font-size: 13px; }
        .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
      </style>
    `;

    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Print</title>${styles}</head><body>${headerHtml}${node.innerHTML}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      alert("Unable to open print frame.");
      return;
    }

    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Print error:", err);
        alert("Print failed.");
      } finally {
        setTimeout(() => {
          try { document.body.removeChild(iframe); } catch {}
        }, 500);
      }
    }, 250);
  };

  // SAVE AS PDF: capture printableRef using html2canvas + jsPDF, support multi-page slicing
  const handleSaveAsPdf = async () => {
    const node = printableRef.current;
    if (!node) {
      alert("Nothing to export.");
      return;
    }
    if (typeof window === "undefined") return;

    setIsGenerating(true);
    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = (html2canvasMod as any).default ?? html2canvasMod;

      const jspdfMod = await import("jspdf");
      const jsPDFClass = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default ?? jspdfMod;

      if (!html2canvas || !jsPDFClass) throw new Error("Missing html2canvas or jsPDF");

      const origBg = (node as HTMLElement).style.background;
      if (!origBg) (node as HTMLElement).style.background = "#ffffff";

      const scale = 2;
      const canvas = await html2canvas(node as HTMLElement, { scale, useCORS: true });
      (node as HTMLElement).style.background = origBg;

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDFClass({ orientation: "landscape", unit: "pt", format: "a4" });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const pxToPtRatio = pdfWidth / imgWidthPx;
      const renderedHeightPt = imgHeightPx * pxToPtRatio;
      const pageHeightPx = pdfHeight / pxToPtRatio;

      if (imgHeightPx <= pageHeightPx + 1) {
        pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, renderedHeightPt);
      } else {
        let yOffsetPx = 0;
        let pageIndex = 0;
        while (yOffsetPx < imgHeightPx) {
          const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - yOffsetPx);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidthPx;
          sliceCanvas.height = Math.floor(sliceHeightPx);
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Unable to get canvas context for PDF slice");
          ctx.drawImage(canvas, 0, yOffsetPx, imgWidthPx, sliceCanvas.height, 0, 0, imgWidthPx, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL("image/png");
          const drawHeightPt = sliceCanvas.height * pxToPtRatio;
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", 0, 10, pdfWidth, drawHeightPt);
          yOffsetPx += sliceHeightPx;
          pageIndex += 1;
        }
      }

      const filename = `schedule-${selectedClass || "untitled"}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF export error:", err);
      alert(`Failed to generate PDF: ${(err as Error).message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Persistence: autosave + manual save + reset
  type AutosaveStatus = "idle" | "saving" | "saved" | "error";
  const [autosaveStatus, setAutosaveStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const autosaveTimer = useRef<number | null>(null);

  // New toggle: enable/disable autosave (default ON). Persisted to localStorage.
  const [autosaveEnabled, setAutosaveEnabled] = useState<boolean>(true);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("schedulebuilder:autosaveEnabled");
      if (raw !== null) setAutosaveEnabled(raw === "1");
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("schedulebuilder:autosaveEnabled", autosaveEnabled ? "1" : "0");
    } catch {}
  }, [autosaveEnabled]);

  const makeStorageKey = useCallback(() => {
    const cls = selectedClass || "global";
    return `schedulebuilder:${cls}:${schoolYear}:${semester}`;
  }, [selectedClass, schoolYear, semester]);

  const saveSchedule = useCallback(async () => {
    const key = makeStorageKey();
    setAutosaveStatus("saving");
    try {
      const payload = {
        meta: {
          selectedClass,
          scheduleType,
          schoolYear,
          semester,
        },
        events,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(key, JSON.stringify(payload));
      setLastSavedAt(new Date());
      setAutosaveStatus("saved");
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Save failed:", err);
      setAutosaveStatus("error");
    }
  }, [events, makeStorageKey, selectedClass, scheduleType, schoolYear, semester]);

  // load schedule for current class/year/semester when those change (simple auto-load)
  useEffect(() => {
    const key = makeStorageKey();
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw) as { events?: any[]; savedAt?: string; meta?: any } | null;
      if (parsed?.events && Array.isArray(parsed.events)) {
        // Backwards-compat: allow older single-day items with `day` property
        const normalized: EventItem[] = parsed.events.map((ev) => {
          if (ev.days && Array.isArray(ev.days)) return ev as EventItem;
          if (ev.day) return { ...ev, days: [ev.day], id: ev.id ?? makeId(), createdBy: ev.createdBy ?? "unknown", createdAt: ev.createdAt ?? new Date().toISOString() } as EventItem;
          // fallback
          return { ...ev, days: [ev.day ?? weekDays[0]], id: ev.id ?? makeId(), createdBy: ev.createdBy ?? "unknown", createdAt: ev.createdAt ?? new Date().toISOString() } as EventItem;
        });
        setEvents(normalized);
        if (parsed.savedAt) setLastSavedAt(new Date(parsed.savedAt));
        setAutosaveStatus("saved");
      }
    } catch (err) {
      // ignore parse errors
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClass, schoolYear, semester]);

  // autosave effect (debounced) - only active when autosaveEnabled is true
  useEffect(() => {
    // clear previous timer
    if (autosaveTimer.current) {
      window.clearTimeout(autosaveTimer.current);
      autosaveTimer.current = null;
    }

    if (!autosaveEnabled) {
      // when disabled, ensure status reflects we're not saving automatically
      setAutosaveStatus((prev) => (prev === "saving" ? "idle" : prev));
      return;
    }

    // schedule a save after a short debounce
    autosaveTimer.current = window.setTimeout(() => {
      saveSchedule();
      autosaveTimer.current = null;
    }, 1000);

    return () => {
      if (autosaveTimer.current) {
        window.clearTimeout(autosaveTimer.current);
        autosaveTimer.current = null;
      }
    };
  }, [events, selectedClass, schoolYear, semester, saveSchedule, autosaveEnabled]);

  // manual save handler — show transient success icon (no alert)
  const [manualSaved, setManualSaved] = useState(false);
  const manualSavedTimer = useRef<number | null>(null);

  const handleManualSave = async () => {
    // avoid double-trigger
    if (manualSaved) {
      // reset timer so it stays visible for the same duration from now
      if (manualSavedTimer.current) {
        window.clearTimeout(manualSavedTimer.current);
      }
    }

    await saveSchedule();

    // show check mark state
    setManualSaved(true);
    if (manualSavedTimer.current) {
      window.clearTimeout(manualSavedTimer.current);
    }
    // revert after 2s
    manualSavedTimer.current = window.setTimeout(() => {
      setManualSaved(false);
      manualSavedTimer.current = null;
    }, 2000);
  };

  // Reset confirmation modal state
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);

  // perform reset (actual deletion)
  const doReset = () => {
    const key = makeStorageKey();
    try {
      localStorage.removeItem(key);
    } catch {}
    setEvents([]);
    setAutosaveStatus("idle");
    setLastSavedAt(null);
    setResetConfirmOpen(false);
  };

  // open reset confirmation (replaces previous confirm)
  const openResetConfirm = () => {
    setResetConfirmOpen(true);
  };

  // cancel reset
  const cancelReset = () => {
    setResetConfirmOpen(false);
  };

  // Render reset confirmation modal (placed inside fullscreen area when necessary)
  const renderResetConfirmModal = () => (
    <div className="fixed inset-0 z-60 flex items-center justify-center" role="dialog" aria-modal="true">
      <div className="fixed inset-0 bg-black/50" onClick={cancelReset} aria-hidden="true" />
      <div className="relative z-10 w-11/12 max-w-md bg-card border border-border rounded-lg shadow-lg">
        <div className="p-4 border-b border-border">
          <h3 className="text-lg font-semibold">Confirm Reset</h3>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete all created schedules for the current class, school year and semester?
            This action cannot be undone.
          </p>

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={cancelReset}>Cancel</Button>
            <Button variant="destructive" onClick={doReset}>
              <Trash2 className="h-4 w-4 mr-2" />
              Delete schedules
            </Button>
          </div>
        </div>
      </div>
    </div>
  );

  // Render modal content as a function so it can be placed either inside printableRef (when fullscreen)
  const renderModal = () => {
    const editingEvent = editingId ? events.find((ev) => ev.id === editingId) ?? null : null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
        <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
        <div className="relative z-10 w-11/12 max-w-lg bg-card border border-border rounded-lg shadow-lg">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="text-lg font-semibold">{editingId ? "Edit Slot" : "Create Slot"}</h3>
            <div className="text-sm text-muted-foreground">{formDay && formStartTime && formEndTime ? `${formDay} • ${formStartTime} - ${formEndTime}` : ""}</div>
          </div>

          <div className="p-4 space-y-4">
            {/* When a rectangular selection included multiple days, show an option to apply to all selected days */}
            {modalSelectedDays && modalSelectedDays.length > 1 && (
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Applying to: <span className="font-medium">{modalSelectedDays.join(", ")}</span>
                </div>
                <label className="inline-flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={modalApplyToAll}
                    onChange={(e) => setModalApplyToAll(e.target.checked)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Apply to all selected days (single multi-day entry)</span>
                </label>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1">Day</label>
              <select
                value={formDay ?? ""}
                onChange={(e) => setFormDay(e.target.value || null)}
                className="w-full border rounded px-2 py-2 bg-card"
              >
                <option value="" disabled>Choose day</option>
                {weekDays.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Start Time</label>
                <select
                  value={formStartTime ?? ""}
                  onChange={(e) => setFormStartTime(e.target.value || null)}
                  className="w-full border rounded px-2 py-2 bg-card"
                >
                  <option value="" disabled>Start time</option>
                  {timeSlots.map((s) => {
                    const isBreak = s.kind === "break";
                    // disable break options unless scheduling for Friday in SHS (or multi-day apply includes only Friday)
                    const allowedForFridayOnly = scheduleType === "shs" && (formDay === "Friday" || (modalSelectedDays && modalApplyToAll && modalSelectedDays.length === 1 && modalSelectedDays[0] === "Friday"));
                    const disabled = isBreak && !allowedForFridayOnly;
                    return <option key={s.start} value={s.start} disabled={disabled}>{s.start}{isBreak ? " (break)" : ""}</option>;
                  })}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">End Time</label>
                <select
                  value={formEndTime ?? ""}
                  onChange={(e) => setFormEndTime(e.target.value || null)}
                  className="w-full border rounded px-2 py-2 bg-card"
                >
                  <option value="" disabled>End time</option>
                  {timeSlots.map((s) => {
                    const isBreak = s.kind === "break";
                    const allowedForFridayOnly = scheduleType === "shs" && (formDay === "Friday" || (modalSelectedDays && modalApplyToAll && modalSelectedDays.length === 1 && modalSelectedDays[0] === "Friday"));
                    const disabled = isBreak && !allowedForFridayOnly;
                    return <option key={s.end} value={s.end} disabled={disabled}>{s.end}{isBreak ? " (break)" : ""}</option>;
                  })}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Subject</label>
              <select
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                className="w-full border rounded px-2 py-2 bg-card"
              >
                <option value="" disabled>Choose subject</option>
                {sampleSubjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Teacher</label>
              <select
                value={formTeacher}
                onChange={(e) => setFormTeacher(e.target.value)}
                className="w-full border rounded px-2 py-2 bg-card"
              >
                <option value="">TBD</option>
                {sampleTeachers.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Room</label>
              <select
                value={formRoom}
                onChange={(e) => setFormRoom(e.target.value)}
                className="w-full border rounded px-2 py-2 bg-card"
              >
                <option value="">TBD</option>
                {sampleRooms.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Show audit info when editing */}
            {editingEvent && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div>
                  <strong>Created by:</strong> {editingEvent.createdBy} • <span className="text-muted-foreground">{new Date(editingEvent.createdAt).toLocaleString()}</span>
                </div>
                {editingEvent.modifiedBy && (
                  <div>
                    <strong>Last modified:</strong> {editingEvent.modifiedBy} • <span className="text-muted-foreground">{new Date(editingEvent.modifiedAt!).toLocaleString()}</span>
                  </div>
                )}
                {editingEvent.changes && editingEvent.changes.length > 0 && (
                  <details className="mt-2">
                    <summary className="cursor-pointer">View change history ({editingEvent.changes.length})</summary>
                    <ul className="mt-2 list-disc list-inside text-xs">
                      {editingEvent.changes.map((c, i) => (
                        <li key={i}>
                          <span className="font-medium">{c.field}</span>: <span className="text-muted-foreground">{JSON.stringify(c.from)}</span> → <span className="text-muted-foreground">{JSON.stringify(c.to)}</span> <span className="text-muted-foreground">({c.by} at {new Date(c.at).toLocaleString()})</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="flex gap-2">
                <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                <Button onClick={saveSlot} disabled={!formSubject || !formStartTime || !formEndTime}>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </Button>
              </div>

              {editingId && (
                <Button variant="destructive" onClick={() => editingId && deleteEvent(editingId)}>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // mapping from select value => human readable label for the section indicator
  const classLabels: Record<string, string> = {
    "grade11-stem1": "Grade 11 - HE 1",
    "grade11-stem2": "Grade 11 - ICT 2",
    "grade12-abm1": "Grade 12 - ABM 1",
    "grade12-humss1": "Grade 12 - HUMSS 1",
  };
  const sectionLabel = selectedClass ? (classLabels[selectedClass] ?? selectedClass) : "—";

  // Attach global mouseup listener after selection helpers/finalizeSelection exist
  useEffect(() => {
    const handleMouseUpDoc = () => {
      if (isSelecting) finalizeSelection();
    };
    document.addEventListener("mouseup", handleMouseUpDoc);
    return () => document.removeEventListener("mouseup", handleMouseUpDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting, selStartIndex, selEndIndex, selStartDay, selEndDay, timeSlots]);

  // Keep isFullScreen in sync with document fullscreen state (including escape)
  useEffect(() => {
    const onFsChange = () => {
      const cur = document.fullscreenElement === printableRef.current || (document as any).webkitFullscreenElement === printableRef.current;
      setIsFullScreen(Boolean(cur));
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("webkitfullscreenchange", onFsChange as any);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("webkitfullscreenchange", onFsChange as any);
    };
  }, []);

  // apply theme and copy CSS variables from :root -> printable node
  useEffect(() => {
    const node = () => printableRef.current;
    if (!node()) return;

    const applyThemeAndVars = () => {
      const n = node();
      if (!n) return;
      try {
        const htmlIsDark = document.documentElement.classList.contains("dark");
        if (htmlIsDark) n.classList.add("dark");
        else n.classList.remove("dark");

        const root = document.documentElement;
        const rootStyles = getComputedStyle(root);
        const cssVars: string[] = [];
        for (let i = 0; i < rootStyles.length; i++) {
          const prop = rootStyles[i];
          if (prop && prop.startsWith("--")) cssVars.push(prop);
        }
        cssVars.forEach((name) => {
          const val = rootStyles.getPropertyValue(name);
          if (val !== null && val !== undefined && val !== "") {
            n.style.setProperty(name, val);
          }
        });

        const bodyStyles = getComputedStyle(document.body);
        const bg = bodyStyles.getPropertyValue("background-color");
        const color = bodyStyles.getPropertyValue("color");
        if (bg) n.style.setProperty("background-color", bg);
        if (color) n.style.setProperty("color", color);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("Failed to copy CSS vars to printable node", err);
      }
    };

    applyThemeAndVars();

    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && (m as any).attributeName === "class") {
          applyThemeAndVars();
          break;
        }
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    const moBody = new MutationObserver(() => applyThemeAndVars());
    moBody.observe(document.body, { attributes: true, attributeFilter: ["style", "class"] });

    return () => {
      try {
        const n = node();
        if (n) {
          const rootStyles = getComputedStyle(document.documentElement);
          for (let i = 0; i < rootStyles.length; i++) {
            const prop = rootStyles[i];
            if (prop && prop.startsWith("--")) {
              n.style.removeProperty(prop);
            }
          }
          n.style.removeProperty("background-color");
          n.style.removeProperty("color");
          n.classList.remove("dark");
        }
      } catch {}
      mo.disconnect();
      moBody.disconnect();
    };
  }, []);

  // rendering table...
  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-0">Schedule Builder</h1>
            <p className="text-muted-foreground text-sm mt-1">Create and manage class schedules</p>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="sm:size-default" onClick={handlePrint} disabled={isGenerating}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" size="sm" className="sm:size-default" onClick={handleSaveAsPdf} disabled={isGenerating}>
              <Save className="h-4 w-4 mr-2" />
              {isGenerating ? "Generating..." : "Save as PDF"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
            <CardDescription>Select class, school year and semester</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Updated: Schedule Type on top, Select Class/Section directly below it.
                Other controls remain on the same row for school year + semester. */}
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Type</label>
                <Select value={scheduleType} onValueChange={(v) => setScheduleType(v as "shs" | "tesda")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shs">Senior High School</SelectItem>
                    <SelectItem value="tesda">TESDA-Based College</SelectItem>
                  </SelectContent>
                </Select>

                {/* Select Class/Section moved below Schedule Type as requested */}
                <div className="mt-2">
                  <label className="text-sm font-medium">Select Class/Section</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade11-stem1">Grade 11 - HE 1</SelectItem>
                      <SelectItem value="grade11-stem2">Grade 11 - ICT 2</SelectItem>
                      <SelectItem value="grade12-abm1">Grade 12 - ABM 1</SelectItem>
                      <SelectItem value="grade12-humss1">Grade 12 - HUMSS 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">School Year</label>
                <div className="flex gap-2 items-center">
                  <div className="flex-1">
                    <Select value={schoolYear} onValueChange={(v) => setSchoolYear(v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {schoolYears.map((sy) => <SelectItem key={sy} value={sy}>{sy}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Button variant="ghost" size="sm" onClick={() => setAddingYear((s) => !s)} title="Add school year">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {addingYear && (
                  <div className="mt-2 flex gap-2 items-center">
                    <input
                      value={newYearInput}
                      onChange={(e) => setNewYearInput(e.target.value)}
                      placeholder="e.g. 2025-2026"
                      className="border rounded px-2 py-1 w-40 bg-card"
                    />
                    <Button size="sm" onClick={addSchoolYear}>Add</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setAddingYear(false); setNewYearInput(""); }}>Cancel</Button>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Semester</label>
                <Select value={semester} onValueChange={(v) => setSemester(v as "first" | "second")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="first">First Semester</SelectItem>
                    <SelectItem value="second">Second Semester</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* printable wrapper: attach ref here (a plain div) so fullscreened element is scrollable */}
        <div
          ref={printableRef}
          // when fullscreen make the wrapper take full viewport height and allow scrolling
          style={isFullScreen ? { height: "100vh", width: "100vw", overflow: "auto" } : undefined}
        >
          <Card>
            <CardHeader className="items-start">
              <div className="flex items-start gap-4 w-full">
                <div className="flex-1">
                  <CardTitle>Weekly Schedule Grid</CardTitle>
                  <CardDescription>
                    Drag vertically or horizontally (mousedown + move) to create multi-slot entries across days/time.
                  </CardDescription>
                  <div className="mt-2 text-sm text-muted-foreground">
                    <span className="font-medium">Section:</span> {sectionLabel} &nbsp;•&nbsp; <span className="font-medium">SY</span> {schoolYear} &nbsp;•&nbsp; <span className="font-medium">{semester === "first" ? "1st Sem" : "2nd Sem"}</span>
                  </div>

                  {/* Moved: Half-hour toggle and split options now live inside the Weekly Schedule Grid card */}
                  {scheduleType === "tesda" && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <label className="text-sm font-medium">Half-hour intervals</label>
                          <label className="inline-flex items-center space-x-2">
                            <input
                              type="checkbox"
                              checked={halfHourEnabled}
                              onChange={(e) => setHalfHourEnabled(e.target.checked)}
                              className="h-4 w-4"
                            />
                            <span className="text-xs text-muted-foreground">Enable 30-minute grid</span>
                          </label>

                          {/* Chevron placed next to the checkbox as requested */}
                          <button
                            type="button"
                            aria-expanded={intervalsOpen}
                            aria-label={intervalsOpen ? "Hide intervals selection" : "Show intervals selection"}
                            onClick={() => setIntervalsOpen((s) => !s)}
                            className="p-1 rounded hover:bg-muted/50 ml-1"
                          >
                            {intervalsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      {halfHourEnabled && intervalsOpen && (
                        <div className="mt-2">
                          <p className="text-xs text-muted-foreground">Select hour starts to split into 30‑minute intervals (on the hour):</p>
                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {hourOptions.map((h) => (
                              <label key={h} className="inline-flex items-center gap-2 text-sm">
                                <input
                                  type="checkbox"
                                  checked={splitHours.includes(h)}
                                  onChange={() => toggleSplitHour(h)}
                                  className="h-4 w-4"
                                />
                                <span>{h}</span>
                              </label>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">If none selected, the grid will use uniform 30-minute slots.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="ml-auto flex flex-col items-end gap-2">
                  <div className="hidden sm:block">
                    <Clock />
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {autosaveStatus === "saving" ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                          <span>Saving…</span>
                        </div>
                      ) : autosaveStatus === "saved" && lastSavedAt ? (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Saved at {lastSavedAt.toLocaleTimeString()}</span>
                        </div>
                      ) : autosaveStatus === "error" ? (
                        <div className="flex items-center gap-2 text-destructive">
                          <span className="h-2 w-2 rounded-full bg-destructive" />
                          <span>Save failed</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-muted/50" />
                          <span>Not saved</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <ToggleSwitch
                        checked={autosaveEnabled}
                        onChange={(v) => setAutosaveEnabled(v)}
                        ariaLabel="Enable auto-save"
                      />
                      <span className="text-sm">Auto-save</span>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleManualSave}
                      disabled={autosaveStatus === "saving"}
                      className={manualSaved ? "bg-emerald-600 text-white hover:bg-emerald-700" : ""}
                    >
                      {manualSaved ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Saved
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Save Schedule
                        </>
                      )}
                    </Button>

                    <Button variant="outline" size="sm" onClick={toggleFullScreen}>
                      {isFullScreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
                      {isFullScreen ? "Exit Fullscreen" : "Fullscreen"}
                    </Button>

                    <Button variant="destructive" size="sm" onClick={openResetConfirm} title="Reset schedules for this class/year/semester" disabled={events.length === 0}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent style={isFullScreen ? { flex: "1 1 auto", overflow: "auto" } : undefined}>
              <div className="overflow-x-auto" style={isFullScreen ? { height: "100%" } : undefined}>
                <div className="max-h-[70vh] overflow-auto" style={isFullScreen ? { maxHeight: "none" } : undefined}>
                  <table ref={tableRef} className="w-full table-fixed border-separate border-spacing-0">
                    <thead>
                      <tr>
                        <th className="border border-border bg-muted p-3 text-left font-semibold min-w-[100px]">Time</th>
                        {weekDays.map((day) => (
                          <th key={day} className="border border-border bg-muted p-3 text-center font-semibold min-w-[150px]">
                            {day}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {timeSlots.map((timeSlot, slotIndex) => (
                        <tr
                          key={`${timeSlot.start}-${slotIndex}`}
                          ref={(el) => {
                            rowsRef.current[slotIndex] = el;
                          }}
                          style={{ height: `${MIN_ROW_PX}px` }}
                        >
                          <td className="border border-border p-3 font-medium bg-muted/50 text-sm align-top" style={{ minHeight: MIN_ROW_PX }}>
                            {formatTimeSlot(timeSlot)}
                          </td>
                          {weekDays.map((day) => {
                            // Special case: for SHS Friday should not show recess/lunch as break cells.
                            const isBreakSlot = timeSlot.kind === "break";
                            const treatAsBreak = isBreakSlot && !(scheduleType === "shs" && day === "Friday");

                            if (treatAsBreak) {
                              return (
                                <td key={`${day}-${slotIndex}-break`} className="border border-border p-3 text-center align-middle bg-muted/30 text-muted-foreground italic">
                                  <div className="select-none">{timeSlot.label ?? "Recess"}</div>
                                </td>
                              );
                            }

                            // Find an event that starts at this slot AND includes this day
                            const evStart = events.find((ev) => ev.days.includes(day) && indexOfSlotStart(ev.start) === slotIndex);
                            if (evStart) {
                              // Determine whether this day is the first day of a contiguous block in evStart.days.
                              const dayIdx = weekDays.indexOf(day);
                              if (dayIdx === -1) return null;
                              // If previous day is also part of the event, skip rendering here (previous column will render with colSpan)
                              if (dayIdx > 0 && evStart.days.includes(weekDays[dayIdx - 1])) {
                                return null;
                              }
                              // compute how many columns this event should span (contiguous days)
                              let colSpan = 1;
                              for (let j = dayIdx + 1; j < weekDays.length; j++) {
                                if (evStart.days.includes(weekDays[j])) colSpan++;
                                else break;
                              }

                              const startIdx = indexOfSlotStart(evStart.start);
                              const endIdx = indexOfSlotEnd(evStart.end);
                              const span = Math.max(1, endIdx - startIdx + 1);
                              const pixelHeight = pxHeightForSpan(startIdx, endIdx);

                              return (
                                <td key={day} rowSpan={span} colSpan={colSpan} className="p-0 align-top relative">
                                  <div
                                    className="absolute left-[1px] right-[1px] top-0 box-border bg-primary/10 border border-primary/20 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer flex flex-col justify-between"
                                    onClick={() => handleExistingClick(day, evStart.start)}
                                    style={{ height: pixelHeight }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="font-semibold text-sm text-primary">{evStart.subject}</div>
                                      <div className="flex gap-2">
                                        <button
                                          aria-label="edit"
                                          onClick={(e) => { e.stopPropagation(); handleExistingClick(day, evStart.start); }}
                                          className="p-1 rounded hover:bg-muted/50"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                          aria-label="delete"
                                          onClick={(e) => { e.stopPropagation(); deleteEvent(evStart.id); }}
                                          className="p-1 rounded hover:bg-muted/50"
                                        >
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </button>
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground mt-1">{evStart.teacher}</div>
                                    <Badge variant="secondary" className="mt-1 text-xs">{evStart.room}</Badge>
                                    {/* Audit info intentionally omitted from timetable cells */}
                                  </div>
                                </td>
                              );
                            }

                            const covering = events.find((ev) => {
                              const evStartIdx = indexOfSlotStart(ev.start);
                              const evEndIdx = indexOfSlotEnd(ev.end);
                              return ev.days.includes(day) && evStartIdx < slotIndex && evEndIdx >= slotIndex;
                            });
                            if (covering) {
                              return null;
                            }

                            return (
                              <td
                                key={`${day}-${slotIndex}`}
                                className={`border border-border p-2 align-top min-h-[48px] relative ${isCellSelected(day, slotIndex) ? "bg-primary/10" : ""}`}
                                onMouseDown={(e) => handleCellMouseDown(day, slotIndex, e)}
                                onMouseEnter={() => handleCellMouseEnter(day, slotIndex)}
                                style={{ minHeight: MIN_ROW_PX }}
                              >
                                <button
                                  onClick={() => openCreateModalWithRange([day], slotIndex, slotIndex)}
                                  className="w-full h-full min-h-[48px] border-2 border-dashed border-muted hover:border-primary hover:bg-primary/5 rounded"
                                >
                                  <div className="flex items-center justify-center h-full">
                                    <Plus className="h-4 w-4" />
                                  </div>
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {isFullScreen && modalOpen && renderModal()}
                  {isFullScreen && resetConfirmOpen && renderResetConfirmModal()}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {!isFullScreen && modalOpen && renderModal()}
      {!isFullScreen && resetConfirmOpen && renderResetConfirmModal()}
    </DashboardLayout>
  );
};

export default ScheduleBuilder;