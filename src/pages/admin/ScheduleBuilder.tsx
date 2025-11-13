import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Printer, Trash2, Edit, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { generateSlots, timeSlotsSHS, formatTimeSlot, TimeSlot } from "@/lib/timeUtils";

type SlotData = {
  subject: string;
  teacher: string;
  room: string;
};

type EventItem = {
  id: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  teacher: string;
  room: string;
};

type SavedSchedule = {
  id: string;
  name: string;
  scheduleType: "shs" | "tesda";
  classId: string;
  schoolYear: string;
  semester: "first" | "second";
  events: EventItem[];
  savedAt: string;
};

const FULL_DAY_START = "8:00 AM";
const FULL_DAY_END = "7:00 PM";

// ROW height in pixels (controls the whole table row height).
const MIN_ROW_PX = 140;

/* ----- sample data ----- */
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
/* ----- end sample data ----- */

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
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const start = month >= 6 ? year : year - 1;
  return `${start}-${start + 1}`;
};

const SCHEDULES_KEY = "app:savedSchedules:v1";

const ScheduleBuilder = () => {
  const [selectedClass, setSelectedClass] = useState("");
  const [scheduleType, setScheduleType] = useState<"shs" | "tesda">("shs");

  // school year list and selection
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

  // add school year UI
  const [addingYear, setAddingYear] = useState(false);
  const [newYearInput, setNewYearInput] = useState("");

  // TESDA half-hour toggle and per-hour splits
  const [halfHourEnabled, setHalfHourEnabled] = useState(false);
  const [splitHours, setSplitHours] = useState<string[]>([]); // values like "10:00 AM"

  // hourOptions only on the hour (":00") for toggling which hours split
  const hourOptions = useMemo(() => generateSlots(FULL_DAY_START, FULL_DAY_END, 60).map((s) => s.start), []);

  // halfOptions (30-min boundaries) used in places where we need 30-min choices
  const halfOptions = useMemo(() => generateSlots(FULL_DAY_START, FULL_DAY_END, 30).map((s) => s.start), []);

  // events list (initially empty)
  const [events, setEvents] = useState<EventItem[]>([]);

  // saved schedules
  const [savedSchedules, setSavedSchedules] = useState<SavedSchedule[]>([]);

  // printable ref for print/export/pdf
  const printableRef = useRef<HTMLDivElement | null>(null);

  // compute timeSlots to use in grid and selects:
  const timeSlots: TimeSlot[] = useMemo(() => {
    if (scheduleType === "shs") return timeSlotsSHS;
    if (!halfHourEnabled) return generateSlots(FULL_DAY_START, FULL_DAY_END, 60);

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

  // Drag selection state
  const [isSelecting, setIsSelecting] = useState(false);
  const [selDay, setSelDay] = useState<string | null>(null);
  const [selStartIndex, setSelStartIndex] = useState<number | null>(null);
  const [selEndIndex, setSelEndIndex] = useState<number | null>(null);
  const ignoreSelectionRef = useRef(false);

  useEffect(() => {
    if (scheduleType !== "tesda") {
      setHalfHourEnabled(false);
      setSplitHours([]);
    }
  }, [scheduleType]);

  useEffect(() => {
    const saved = localStorage.getItem(SCHEDULES_KEY);
    if (saved) {
      try {
        setSavedSchedules(JSON.parse(saved) as SavedSchedule[]);
      } catch {
        setSavedSchedules([]);
      }
    }
  }, []);

  useEffect(() => {
    const handleMouseUpDoc = () => {
      if (isSelecting) finalizeSelection();
    };
    document.addEventListener("mouseup", handleMouseUpDoc);
    return () => document.removeEventListener("mouseup", handleMouseUpDoc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelecting, selStartIndex, selEndIndex, selDay, timeSlots]);

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

  const openCreateModalWithRange = (day: string, startIndex: number, endIndex: number) => {
    const s = Math.min(startIndex, endIndex);
    const e = Math.max(startIndex, endIndex);

    // block creating on break slots
    const anyBreakInRange = timeSlots.slice(s, e + 1).some((slot) => slot.kind === "break");
    if (anyBreakInRange) {
      // simply don't open modal when selection includes a break
      return;
    }

    const start = timeSlots[s].start;
    const end = timeSlots[e].end;

    const coveringEvent = events.find((ev) => {
      const evStartIdx = indexOfSlotStart(ev.start);
      const evEndIdx = indexOfSlotEnd(ev.end);
      return ev.day === day && evStartIdx <= s && evEndIdx >= e;
    });

    setEditingId(coveringEvent ? coveringEvent.id : null);
    setFormDay(day);
    setFormStartTime(start);
    setFormEndTime(end);

    if (coveringEvent) {
      setFormSubject(coveringEvent.subject);
      setFormTeacher(coveringEvent.teacher);
      setFormRoom(coveringEvent.room);
    } else {
      setFormSubject("");
      setFormTeacher("");
      setFormRoom("");
    }

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
  };

  const saveSlot = () => {
    if (!formDay || !formStartTime || !formEndTime) return;
    if (!formSubject) return;

    // prevent saving events that overlap break slots
    const sIdx = indexOfSlotStart(formStartTime);
    const eIdx = indexOfSlotEnd(formEndTime);
    if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) return;
    const intersectsBreak = timeSlots.slice(sIdx, eIdx + 1).some((slot) => slot.kind === "break");
    if (intersectsBreak) {
      // do not allow saving across break slots
      return;
    }

    if (editingId) {
      setEvents((prev) =>
        prev.map((ev) =>
          ev.id === editingId
            ? { ...ev, day: formDay!, start: formStartTime!, end: formEndTime!, subject: formSubject, teacher: formTeacher || "TBD", room: formRoom || "TBD" }
            : ev
        )
      );
    } else {
      const newEvent: EventItem = {
        id: makeId(),
        day: formDay,
        start: formStartTime,
        end: formEndTime,
        subject: formSubject,
        teacher: formTeacher || "TBD",
        room: formRoom || "TBD",
      };
      setEvents((prev) => [...prev, newEvent]);
    }

    closeModal();
  };

  const deleteEvent = (id: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== id));
    closeModal();
  };

  // drag handlers
  const handleCellMouseDown = (day: string, index: number, e: React.MouseEvent) => {
    e.preventDefault();
    // if the slot is a break, do not start selection
    if (timeSlots[index]?.kind === "break") return;
    ignoreSelectionRef.current = true;
    setIsSelecting(true);
    setSelDay(day);
    setSelStartIndex(index);
    setSelEndIndex(index);
    document.body.style.userSelect = "none";
  };

  const handleCellMouseEnter = (day: string, index: number) => {
    if (!isSelecting) return;
    if (day !== selDay) return;
    // don't extend selection into break slots
    if (timeSlots[index]?.kind === "break") return;
    setSelEndIndex(index);
  };

  const finalizeSelection = () => {
    if (selDay !== null && selStartIndex !== null && selEndIndex !== null) {
      openCreateModalWithRange(selDay, selStartIndex, selEndIndex);
    }
    setIsSelecting(false);
    setSelDay(null);
    setSelStartIndex(null);
    setSelEndIndex(null);
    document.body.style.userSelect = "";
    ignoreSelectionRef.current = false;
  };

  const isCellSelected = (day: string, idx: number) => {
    if (!isSelecting || !selDay || selStartIndex === null || selEndIndex === null) return false;
    if (day !== selDay) return false;
    const s = Math.min(selStartIndex, selEndIndex);
    const e = Math.max(selStartIndex, selEndIndex);
    return idx >= s && idx <= e;
  };

  const handleExistingClick = (day: string, startTime: string) => {
    const slotIdx = indexOfSlotStart(startTime);
    const ev = events.find((e) => e.day === day && indexOfSlotStart(e.start) === slotIdx);
    if (!ev) return;
    setEditingId(ev.id);
    setFormDay(ev.day);
    setFormStartTime(ev.start);
    setFormEndTime(ev.end);
    setFormSubject(ev.subject);
    setFormTeacher(ev.teacher);
    setFormRoom(ev.room);
    setModalOpen(true);
  };

  const toggleSplitHour = (hour: string) => {
    setSplitHours((prev) => (prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]));
  };

  // rendering helpers
  const eventStartingAt = (day: string, slotIndex: number) =>
    events.find((ev) => ev.day === day && indexOfSlotStart(ev.start) === slotIndex);

  const eventCovering = (day: string, slotIndex: number) =>
    events.find((ev) => {
      const evStartIdx = indexOfSlotStart(ev.start);
      const evEndIdx = indexOfSlotEnd(ev.end);
      return ev.day === day && evStartIdx < slotIndex && evEndIdx >= slotIndex;
    });

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

  // --- Save / Load schedules (localStorage) ---
  const saveScheduleToStorage = (schedule: SavedSchedule[]) => {
    localStorage.setItem(SCHEDULES_KEY, JSON.stringify(schedule));
    setSavedSchedules(schedule);
  };

  const handleSaveSchedule = () => {
    const nameDefault = `${selectedClass || "untitled"} • ${schoolYear} • ${semester === "first" ? "1st" : "2nd"} • ${new Date().toISOString().slice(0, 10)}`;
    const name = window.prompt("Save schedule as (name):", nameDefault);
    if (!name) return;
    const s: SavedSchedule = {
      id: makeId(),
      name,
      scheduleType,
      classId: selectedClass,
      schoolYear,
      semester,
      events,
      savedAt: new Date().toISOString(),
    };
    const updated = [s, ...savedSchedules];
    saveScheduleToStorage(updated);
    alert("Schedule saved.");
  };

  const handleLoadSchedule = (id: string) => {
    const sched = savedSchedules.find((s) => s.id === id);
    if (!sched) return;
    if (events.length > 0 && !confirm("Loading a saved schedule will replace the current grid. Continue?")) return;
    setScheduleType(sched.scheduleType);
    setSelectedClass(sched.classId);
    setSchoolYear(sched.schoolYear);
    setSemester(sched.semester);
    setEvents(sched.events);
    alert(`Loaded schedule: ${sched.name}`);
  };

  const handleDeleteSaved = (id: string) => {
    if (!confirm("Delete this saved schedule?")) return;
    const updated = savedSchedules.filter((s) => s.id !== id);
    saveScheduleToStorage(updated);
  };

  // PRINT: iframe approach (avoids popup blocking)
  const handlePrint = () => {
    const node = printableRef.current;
    if (!node) {
      alert("Nothing to print.");
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

    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = (html2canvasMod as any).default ?? html2canvasMod;

      const jspdfMod = await import("jspdf");
      const jsPDFClass = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default ?? jspdfMod;

      if (!html2canvas || !jsPDFClass) throw new Error("Missing html2canvas or jsPDF");

      // temporarily ensure white background for PDF clarity
      const origBg = (node as HTMLElement).style.background;
      if (!origBg) (node as HTMLElement).style.background = "#ffffff";

      const scale = 2;
      const canvas = await html2canvas(node as HTMLElement, { scale, useCORS: true });
      // restore background
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
        // slice vertically
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
    }
  };

  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Schedule Builder</h1>
            <p className="text-muted-foreground">
              Create and manage class schedules
              {selectedClass ? ` • ${selectedClass}` : ""}
              {schoolYear ? ` • SY ${schoolYear}` : ""}
              {semester ? ` • ${semester === "first" ? "1st Sem" : "2nd Sem"}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>

            <Button size="sm" onClick={handleSaveAsPdf}>
              <Download className="h-4 w-4 mr-2" />
              Save as PDF
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Configuration</CardTitle>
            <CardDescription>Select class, school year and semester</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-4">
                <div>
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
                </div>

                <div>
                  <label className="text-sm font-medium">Select Class/Section</label>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="grade11-stem1">Grade 11 - STEM 1</SelectItem>
                      <SelectItem value="grade11-stem2">Grade 11 - STEM 2</SelectItem>
                      <SelectItem value="grade12-abm1">Grade 12 - ABM 1</SelectItem>
                      <SelectItem value="grade12-humss1">Grade 12 - HUMSS 1</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">School Year</label>
                  <div className="flex gap-2 items-center">
                    <div className="flex-1">
                      <Select value={schoolYear} onValueChange={(v) => setSchoolYear(v)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolYears.map((sy) => (
                            <SelectItem key={sy} value={sy}>{sy}</SelectItem>
                          ))}
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

                <div>
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
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Schedule Grid</CardTitle>
            <CardDescription>
              Drag vertically (mousedown + move) to create a multi-slot entry. The grid reflects split hours you selected.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto" ref={printableRef}>
              <div className="max-h-[70vh] overflow-auto">
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
                          // If this slot is a break (SHS recess/lunch), render a non-interactive break cell
                          if (timeSlot.kind === "break") {
                            return (
                              <td key={`${day}-${slotIndex}-break`} className="border border-border p-3 text-center align-middle bg-muted/30 text-muted-foreground italic">
                                <div className="select-none">{timeSlot.label ?? "Recess"}</div>
                              </td>
                            );
                          }

                          const evStart = eventStartingAt(day, slotIndex);
                          if (evStart) {
                            const startIdx = indexOfSlotStart(evStart.start);
                            const endIdx = indexOfSlotEnd(evStart.end);
                            const span = Math.max(1, endIdx - startIdx + 1);
                            const pixelHeight = pxHeightForSpan(startIdx, endIdx);
                            return (
                              <td key={day} rowSpan={span} className="p-0 align-top relative">
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
                                </div>
                              </td>
                            );
                          }

                          // if this slot is covered by an event that started earlier, skip rendering a td (rowSpan from above)
                          const covering = eventCovering(day, slotIndex);
                          if (covering) {
                            return null;
                          }

                          // otherwise render the empty cell / add button (disabled for break slots above)
                          return (
                            <td
                              key={`${day}-${slotIndex}`}
                              className={`border border-border p-2 align-top min-h-[48px] relative ${isCellSelected(day, slotIndex) ? "bg-primary/10" : ""}`}
                              onMouseDown={(e) => handleCellMouseDown(day, slotIndex, e)}
                              onMouseEnter={() => handleCellMouseEnter(day, slotIndex)}
                              style={{ minHeight: MIN_ROW_PX }}
                            >
                              <button
                                onClick={() => openCreateModalWithRange(day, slotIndex, slotIndex)}
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
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Saved schedules quick loader */}
        {savedSchedules.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Saved Schedules</CardTitle>
              <CardDescription>Load or delete previously saved schedules</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 items-center">
                <Select value={savedSchedules[0]?.id ?? ""} onValueChange={(v) => handleLoadSchedule(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose saved schedule to load" />
                  </SelectTrigger>
                  <SelectContent>
                    {savedSchedules.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <div className="flex gap-2">
                  {savedSchedules.map((s) => (
                    <div key={s.id} className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleLoadSchedule(s.id)}>{s.name}</Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteSaved(s.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" role="dialog" aria-modal="true">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
          <div className="relative z-10 w-11/12 max-w-lg bg-card border border-border rounded-lg shadow-lg">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit Slot" : "Create Slot"}</h3>
              <div className="text-sm text-muted-foreground">
                {schoolYear && semester ? `SY ${schoolYear} • ${semester === "first" ? "1st Sem" : "2nd Sem"}` : ""}
              </div>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Day</label>
                <Select value={formDay ?? ""} onValueChange={(v) => setFormDay(v || null)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select day" />
                  </SelectTrigger>
                  <SelectContent>
                    {weekDays.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <Select value={formStartTime ?? ""} onValueChange={(v) => setFormStartTime(v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Start time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.filter(s => s.kind !== "break").map((s) => <SelectItem key={s.start} value={s.start}>{s.start}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">End Time</label>
                  <Select value={formEndTime ?? ""} onValueChange={(v) => setFormEndTime(v || null)}>
                    <SelectTrigger>
                      <SelectValue placeholder="End time" />
                    </SelectTrigger>
                    <SelectContent>
                      {timeSlots.filter(s => s.kind !== "break").map((s) => <SelectItem key={s.end} value={s.end}>{s.end}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Subject</label>
                <Select value={formSubject} onValueChange={(v) => setFormSubject(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose subject" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleSubjects.map((sub) => <SelectItem key={sub} value={sub}>{sub}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Teacher</label>
                <Select value={formTeacher} onValueChange={(v) => setFormTeacher(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleTeachers.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Room</label>
                <Select value={formRoom} onValueChange={(v) => setFormRoom(v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose room" />
                  </SelectTrigger>
                  <SelectContent>
                    {sampleRooms.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                  <Button onClick={saveSlot} disabled={!formSubject || !formDay || !formStartTime || !formEndTime}>
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
      )}
    </DashboardLayout>
  );
};

export default ScheduleBuilder;