import React, { Component, ErrorInfo, ReactNode, useMemo, useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText } from "lucide-react";

/** ErrorBoundary to surface render-time errors instead of a blank page */
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // log to console for debugging
    // eslint-disable-next-line no-console
    console.error("Reports ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 20 }}>
          <h2 style={{ color: "crimson" }}>Reports page error</h2>
          <pre style={{ whiteSpace: "pre-wrap", color: "#111" }}>{String(this.state.error.stack ?? this.state.error.message)}</pre>
          <p className="text-sm text-muted-foreground">Paste the above error & stack in the chat so I can fix it.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

/** EventItem shape */
type EventItem = {
  id: string;
  classId?: string;
  day: string;
  start: string;
  end: string;
  subject: string;
  teacher: string;
  room: string;
};

/** Sample events (for testing) */
const SAMPLE_EVENTS: EventItem[] = [
  { id: "1", classId: "grade11-stem1", day: "Monday", start: "8:00 AM", end: "9:00 AM", subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 1" },
  { id: "2", classId: "grade11-stem1", day: "Monday", start: "9:00 AM", end: "10:00 AM", subject: "English", teacher: "Sergs Erl Fulay", room: "Room 2" },
  { id: "3", classId: "grade11-stem2", day: "Monday", start: "8:30 AM", end: "9:30 AM", subject: "Science", teacher: "Christian Jose Mendegorin", room: "Room 1" },
  { id: "4", classId: "grade12-abm1", day: "Tuesday", start: "10:00 AM", end: "12:00 PM", subject: "Accounting", teacher: "Joy Siocon", room: "Room 3" },
  { id: "5", classId: "grade12-humss1", day: "Wednesday", start: "7:45 AM", end: "8:30 AM", subject: "History", teacher: "Christine Salve Demetillo", room: "Room 2" },
];

const FULL_DAY_START = "8:00 AM";
const FULL_DAY_END = "7:00 PM";

/** Safe parser: returns minutes since midnight or NaN (does not throw) */
function parseTimeToMinutesSafe(time?: string): number {
  if (!time || typeof time !== "string") return NaN;
  const m = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return NaN;
  let h = parseInt(m[1], 10);
  const mins = parseInt(m[2], 10);
  const ampm = m[3].toUpperCase();
  if (Number.isNaN(h) || Number.isNaN(mins)) return NaN;
  if (h === 12) h = 0;
  if (ampm === "PM") h += 12;
  return h * 60 + mins;
}

/** duration (minutes) guard */
const durationMinutes = (ev: EventItem) => {
  const s = parseTimeToMinutesSafe(ev.start);
  const e = parseTimeToMinutesSafe(ev.end);
  if (!Number.isFinite(s) || !Number.isFinite(e)) return 0;
  return Math.max(0, e - s);
};

/** CSV helpers */
function toCSV(rows: (string | number)[][]) {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}
function downloadFile(filename: string, content: string) {
  if (typeof window === "undefined") return;
  try {
    const blob = new Blob([content], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("downloadFile error:", err);
  }
}

/** Excel export helper (uses SheetJS xlsx via dynamic import) */
async function exportToExcelFile(filename: string, sheets: { name: string; data: (string | number)[][] }[]) {
  if (typeof window === "undefined") return;
  try {
    const xlsx = await import("xlsx");
    const wb = xlsx.utils.book_new();
    for (const sheet of sheets) {
      // convert 2D array to worksheet
      const ws = xlsx.utils.aoa_to_sheet(sheet.data);
      xlsx.utils.book_append_sheet(wb, ws, sheet.name);
    }
    // write file (in browser this triggers a download)
    xlsx.writeFile(wb, filename);
  } catch (err) {
    console.error("Excel export failed. Make sure 'xlsx' (SheetJS) is installed.", err);
    alert("Excel export failed. Please install the 'xlsx' package (npm i xlsx) or use CSV export.");
  }
}

/** The real Reports page wrapped in an ErrorBoundary */
export default function ReportsPageWithBoundary() {
  return (
    <ErrorBoundary>
      <ReportsPage />
    </ErrorBoundary>
  );
}

/** ReportsPage implementation (kept defensive)
 *
 * Change: include "units" for teachers in schedulingEfficiency and exports.
 * Assumption: 1 unit = 60 minutes (adjust as needed).
 */
function ReportsPage() {
  const [events] = useState<EventItem[]>(SAMPLE_EVENTS);

  // NOTE: use "all" sentinel instead of empty string. Some Select implementations treat "" specially.
  const [selectedReport, setSelectedReport] = useState<"class" | "room" | "efficiency">("class");
  const [filterDay, setFilterDay] = useState<string>("all");
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // --- new pagination state shared across report views ---
  const PAGE_SIZE_OPTIONS = [10, 25, 50];
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // reset page when report or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedReport, filterDay, pageSize]);

  const visibleEvents = useMemo(() => {
    if (filterDay === "all") return events;
    return events.filter((e) => e.day === filterDay);
  }, [events, filterDay]);

  // Class usage
  const classUsage = useMemo(() => {
    const map = new Map<string, { classLabel: string; totalMinutes: number; sessions: number }>();
    visibleEvents.forEach((ev) => {
      const key = ev.classId ?? ev.subject ?? "unassigned";
      const prev = map.get(key) ?? { classLabel: key, totalMinutes: 0, sessions: 0 };
      prev.totalMinutes += Math.max(0, durationMinutes(ev));
      prev.sessions += 1;
      map.set(key, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.totalMinutes - a.totalMinutes);
  }, [visibleEvents]);

  // Room allocation (conflict detection removed)
  const roomAllocation = useMemo(() => {
    const byRoom = new Map<string, { totalMinutes: number; sessions: number }>();

    const buckets = new Map<string, EventItem[]>();
    visibleEvents.forEach((ev) => {
      const key = `${ev.room}||${ev.day}`;
      const arr = buckets.get(key) ?? [];
      arr.push(ev);
      buckets.set(key, arr);
    });

    buckets.forEach((arr) => {
      for (let i = 0; i < arr.length; i++) {
        const a = arr[i];
        const stats = byRoom.get(a.room) ?? { totalMinutes: 0, sessions: 0 };
        stats.totalMinutes += Math.max(0, durationMinutes(a));
        stats.sessions += 1;
        byRoom.set(a.room, stats);
      }
    });

    const rows = Array.from(byRoom.entries()).map(([room, stats]) => ({ room, ...stats }));
    return { rows: rows.sort((a, b) => b.totalMinutes - a.totalMinutes) };
  }, [visibleEvents]);

  // Scheduling efficiency (no longer depends on room conflicts)
  const schedulingEfficiency = useMemo(() => {
    const teacherBuckets = new Map<string, EventItem[]>();
    visibleEvents.forEach((ev) => {
      const arr = teacherBuckets.get(ev.teacher) ?? [];
      arr.push(ev);
      teacherBuckets.set(ev.teacher, arr);
    });

    const teacherStats: {
      teacher: string;
      totalMinutes: number;
      units: number; // units computed as minutes / 60
      activeSpanMinutes: number;
      idleMinutes: number;
      sessions: number;
    }[] = [];

    teacherBuckets.forEach((arr, teacher) => {
      arr.sort((a, b) => {
        const as = parseTimeToMinutesSafe(a.start);
        const bs = parseTimeToMinutesSafe(b.start);
        return (Number.isFinite(as) ? as : 0) - (Number.isFinite(bs) ? bs : 0);
      });
      let total = 0;
      let idle = 0;
      let first = Infinity;
      let last = -Infinity;
      for (let i = 0; i < arr.length; i++) {
        const e = arr[i];
        const s = parseTimeToMinutesSafe(e.start);
        const eMin = parseTimeToMinutesSafe(e.end);
        if (Number.isFinite(s) && Number.isFinite(eMin)) {
          total += Math.max(0, eMin - s);
          if (s < first) first = s;
          if (eMin > last) last = eMin;
        }
        if (i > 0) {
          const prevEnd = parseTimeToMinutesSafe(arr[i - 1].end);
          if (Number.isFinite(s) && Number.isFinite(prevEnd) && s > prevEnd) idle += s - prevEnd;
        }
      }
      const activeSpan = first === Infinity || last === -Infinity ? 0 : last - first;
      const units = Math.round((total / 60) * 100) / 100; // 1 unit = 60 minutes, rounded to 2 decimals
      teacherStats.push({ teacher, totalMinutes: total, units, activeSpanMinutes: activeSpan, idleMinutes: idle, sessions: arr.length });
    });

    const totalScheduledMinutes = visibleEvents.reduce((a, b) => a + Math.max(0, durationMinutes(b)), 0);
    const totalAvailablePerDay = parseTimeToMinutesSafe(FULL_DAY_END) - parseTimeToMinutesSafe(FULL_DAY_START);
    const uniqueDays = new Set(visibleEvents.map((e) => e.day));
    const uniqueRooms = new Set(visibleEvents.map((e) => e.room));
    const approxAvailable = (Number.isFinite(totalAvailablePerDay) ? totalAvailablePerDay : 0) * uniqueDays.size * Math.max(1, uniqueRooms.size);
    const utilization = approxAvailable > 0 ? (totalScheduledMinutes / approxAvailable) * 100 : 0;

    // conflicts removed from this calculation
    const conflictCount = 0;
    const conflictRate = 0;
    const avgIdlePerTeacher = teacherStats.length ? teacherStats.reduce((s, t) => s + t.idleMinutes, 0) / teacherStats.length : 0;

    return { teacherStats, totalScheduledMinutes, approxAvailable, utilization, conflictCount, conflictRate, avgIdlePerTeacher };
  }, [visibleEvents]);

  // Export handlers (conflicts removed from room export)
  const exportClassUsageCSV = () => {
    const rows: (string | number)[][] = [["Class/Section", "Total Minutes", "Sessions"]];
    classUsage.forEach((r) => rows.push([r.classLabel, r.totalMinutes, r.sessions]));
    downloadFile(`class-usage-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };
  const exportRoomAllocationCSV = () => {
    const rows: (string | number)[][] = [["Room", "Total Minutes", "Sessions"]];
    roomAllocation.rows.forEach((r: any) => rows.push([r.room, r.totalMinutes, r.sessions]));
    downloadFile(`room-allocation-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };
  const exportEfficiencyCSV = () => {
    const rows: (string | number)[][] = [["Teacher", "Total Minutes", "Units", "Active Span (min)", "Idle Minutes", "Sessions"]];
    schedulingEfficiency.teacherStats.forEach((t) => rows.push([t.teacher, t.totalMinutes, t.units, t.activeSpanMinutes, t.idleMinutes, t.sessions]));
    rows.push([]);
    rows.push(["Total Scheduled Minutes", schedulingEfficiency.totalScheduledMinutes]);
    rows.push(["Approx Available Minutes (est)", schedulingEfficiency.approxAvailable]);
    rows.push(["Utilization (%)", schedulingEfficiency.utilization.toFixed(2)]);
    rows.push(["Conflict Count", schedulingEfficiency.conflictCount]);
    rows.push(["Conflict Rate (%)", schedulingEfficiency.conflictRate.toFixed(2)]);
    downloadFile(`scheduling-efficiency-${new Date().toISOString().slice(0, 10)}.csv`, toCSV(rows));
  };

  // NEW: Excel export wrappers that prepare the same rows as CSV but send them to SheetJS
  const exportClassUsageExcel = async () => {
    const rows: (string | number)[][] = [["Class/Section", "Total Minutes", "Sessions"]];
    classUsage.forEach((r) => rows.push([r.classLabel, r.totalMinutes, r.sessions]));
    await exportToExcelFile(`class-usage-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: "Class Usage", data: rows }]);
  };

  const exportRoomAllocationExcel = async () => {
    const rows: (string | number)[][] = [["Room", "Total Minutes", "Sessions"]];
    roomAllocation.rows.forEach((r: any) => rows.push([r.room, r.totalMinutes, r.sessions]));
    await exportToExcelFile(`room-allocation-${new Date().toISOString().slice(0, 10)}.xlsx`, [{ name: "Room Allocation", data: rows }]);
  };

  const exportEfficiencyExcel = async () => {
    const rows: (string | number)[][] = [["Teacher", "Total Minutes", "Units", "Active Span (min)", "Idle Minutes", "Sessions"]];
    schedulingEfficiency.teacherStats.forEach((t) => rows.push([t.teacher, t.totalMinutes, t.units, t.activeSpanMinutes, t.idleMinutes, t.sessions]));
    const meta = [
      [],
      ["Total Scheduled Minutes", schedulingEfficiency.totalScheduledMinutes],
      ["Approx Available Minutes (est)", schedulingEfficiency.approxAvailable],
      ["Utilization (%)", schedulingEfficiency.utilization.toFixed(2)],
      ["Conflict Count", schedulingEfficiency.conflictCount],
      ["Conflict Rate (%)", schedulingEfficiency.conflictRate.toFixed(2)],
    ];
    await exportToExcelFile(`scheduling-efficiency-${new Date().toISOString().slice(0, 10)}.xlsx`, [
      { name: "Teacher Summary", data: rows },
      { name: "Summary", data: meta },
    ]);
  };

  // --- Pagination helpers for the current selected report ---
  const getCurrentDatasetLength = () => {
    if (selectedReport === "class") return classUsage.length;
    if (selectedReport === "room") return roomAllocation.rows.length;
    return schedulingEfficiency.teacherStats.length;
  };

  const totalEntries = getCurrentDatasetLength();
  const totalPages = Math.max(1, Math.ceil(totalEntries / pageSize));
  // ensure currentPage is valid
  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * pageSize;
  const endIndexExclusive = Math.min(startIndex + pageSize, totalEntries);

  // paginated slices for each report
  const paginatedClassUsage = classUsage.slice(startIndex, endIndexExclusive);
  const paginatedRoomRows = roomAllocation.rows.slice(startIndex, endIndexExclusive);
  const paginatedTeachers = schedulingEfficiency.teacherStats.slice(startIndex, endIndexExclusive);

  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Reports — Class, Room & Scheduling Efficiency</h1>
            <p className="text-sm text-muted-foreground mt-1">Analytics about class usage, room allocation, and scheduling efficiency.</p>
          </div>

          <div className="flex gap-2 items-center">
            <Select value={selectedReport} onValueChange={(v) => setSelectedReport(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="class">Class Usage</SelectItem>
                <SelectItem value="room">Room Allocation</SelectItem>
                <SelectItem value="efficiency">Scheduling Efficiency</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterDay} onValueChange={(v) => setFilterDay(v)}>
              <SelectTrigger><SelectValue placeholder="All days" /></SelectTrigger>
              <SelectContent>
                {/* use sentinel "all" instead of empty string to avoid Select implementations that reserve "" */}
                <SelectItem value="all">All days</SelectItem>
                {days.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>

            <button
              type="button"
              className="inline-flex items-center rounded-md border px-3 py-1 text-sm shadow-sm hover:bg-muted"
              onClick={() => {
                if (selectedReport === "class") exportClassUsageCSV();
                else if (selectedReport === "room") exportRoomAllocationCSV();
                else exportEfficiencyCSV();
              }}
            >
              <FileText className="mr-2 h-4 w-4" />Export CSV
            </button>

            {/* Excel export button */}
            <button
              type="button"
              className="inline-flex items-center rounded-md border px-3 py-1 text-sm shadow-sm hover:bg-muted"
              onClick={() => {
                if (selectedReport === "class") exportClassUsageExcel();
                else if (selectedReport === "room") exportRoomAllocationExcel();
                else exportEfficiencyExcel();
              }}
              title="Export as Excel (.xlsx)"
            >
              {/* reuse same icon for simplicity */}
              <FileText className="mr-2 h-4 w-4" />Export Excel
            </button>
          </div>
        </div>

        {selectedReport === "class" && (
          <Card>
            <CardHeader>
              <CardTitle>Class Usage</CardTitle>
              <CardDescription>Total scheduled minutes and sessions per class/section</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                {classUsage.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No class usage data</div> : (
                  <>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border-b w-12">#</th>
                          <th className="text-left p-2 border-b">Class / Section</th>
                          <th className="text-right p-2 border-b">Total Minutes</th>
                          <th className="text-right p-2 border-b">Sessions</th>
                          <th className="text-right p-2 border-b">Hours</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedClassUsage.map((r, idx) => (
                          <tr key={r.classLabel}>
                            <td className="p-2 border-b">{startIndex + idx + 1}</td>
                            <td className="p-2 border-b">{r.classLabel}</td>
                            <td className="p-2 border-b text-right">{r.totalMinutes}</td>
                            <td className="p-2 border-b text-right">{r.sessions}</td>
                            <td className="p-2 border-b text-right">{(r.totalMinutes / 60).toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndexExclusive} of {totalEntries} entries
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</button>
                        <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>
                        <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</button>

                        <div className="flex items-center gap-2 ml-4">
                          <label className="text-sm">Show</label>
                          <select value={pageSize} onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }} className="border rounded px-2 py-1">
                            {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="text-sm">entries</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === "room" && (
          <Card>
            <CardHeader>
              <CardTitle>Room Allocation</CardTitle>
              <CardDescription>Which rooms are most used (conflict reporting removed)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto mb-4">
                {roomAllocation.rows.length === 0 ? <div className="p-4 text-sm text-muted-foreground">No room data</div> : (
                  <>
                    <table className="w-full border-collapse text-sm">
                      <thead>
                        <tr>
                          <th className="text-left p-2 border-b w-12">#</th>
                          <th className="text-left p-2 border-b">Room</th>
                          <th className="text-right p-2 border-b">Total Minutes</th>
                          <th className="text-right p-2 border-b">Sessions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRoomRows.map((r, idx) => (
                          <tr key={r.room}>
                            <td className="p-2 border-b">{startIndex + idx + 1}</td>
                            <td className="p-2 border-b">{r.room}</td>
                            <td className="p-2 border-b text-right">{(r as any).totalMinutes}</td>
                            <td className="p-2 border-b text-right">{(r as any).sessions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination Controls */}
                    <div className="mt-4 flex items-center justify-between">
                      <div className="text-sm text-muted-foreground">
                        Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndexExclusive} of {totalEntries} entries
                      </div>

                      <div className="flex items-center gap-2">
                        <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</button>
                        <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>
                        <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</button>

                        <div className="flex items-center gap-2 ml-4">
                          <label className="text-sm">Show</label>
                          <select value={pageSize} onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }} className="border rounded px-2 py-1">
                            {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                          </select>
                          <span className="text-sm">entries</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedReport === "efficiency" && (
          <Card>
            <CardHeader>
              <CardTitle>Scheduling Efficiency</CardTitle>
              <CardDescription>Teacher idle time, utilization and conflict rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4 mb-4">
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Scheduled Minutes</div>
                  <div className="text-xl font-semibold">{schedulingEfficiency.totalScheduledMinutes}</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Utilization (est)</div>
                  <div className="text-xl font-semibold">{schedulingEfficiency.utilization.toFixed(2)}%</div>
                </div>
                <div className="p-3 border rounded">
                  <div className="text-sm text-muted-foreground">Conflict rate</div>
                  <div className="text-xl font-semibold">{schedulingEfficiency.conflictRate.toFixed(2)}%</div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-2">Teacher idle summary</h4>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="p-2 text-left border-b w-12">#</th>
                        <th className="p-2 text-left border-b">Teacher</th>
                        <th className="p-2 text-right border-b">Scheduled (min)</th>
                        <th className="p-2 text-right border-b">Units</th>
                        <th className="p-2 text-right border-b">Active span (min)</th>
                        <th className="p-2 text-right border-b">Idle (min)</th>
                        <th className="p-2 text-right border-b">Sessions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedTeachers.map((t, idx) => (
                        <tr key={t.teacher}>
                          <td className="p-2 border-b">{startIndex + idx + 1}</td>
                          <td className="p-2 border-b">{t.teacher}</td>
                          <td className="p-2 border-b text-right">{t.totalMinutes}</td>
                          <td className="p-2 border-b text-right">{t.units.toFixed(2)}</td>
                          <td className="p-2 border-b text-right">{t.activeSpanMinutes}</td>
                          <td className="p-2 border-b text-right">{t.idleMinutes}</td>
                          <td className="p-2 border-b text-right">{t.sessions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Controls */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Showing {totalEntries === 0 ? 0 : startIndex + 1} to {endIndexExclusive} of {totalEntries} entries
                    </div>

                    <div className="flex items-center gap-2">
                      <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</button>
                      <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>
                      <button className="px-3 py-1 border rounded" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</button>

                      <div className="flex items-center gap-2 ml-4">
                        <label className="text-sm">Show</label>
                        <select value={pageSize} onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }} className="border rounded px-2 py-1">
                          {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <span className="text-sm">entries</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}