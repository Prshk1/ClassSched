import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Download, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Room = {
  id: number;
  code?: string;
  name: string;
  type: string;
  capacity: number;
};

const ROOM_TYPES = ["Lecture Room", "Laboratory"];

const initialRooms: Room[] = [
  { id: 1, code: "CL-001", name: "Comlab 1", type: "Laboratory", capacity: 45 },
  { id: 2, code: "CL-002", name: "Comlab 2", type: "Laboratory", capacity: 35 },
  { id: 3, code: "R-001", name: "Room 1", type: "Lecture Room", capacity: 40 },
  { id: 4, code: "R-002", name: "Room 2", type: "Lecture Room", capacity: 40 },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

export default function ManageRooms() {
  // data
  const [rooms, setRooms] = useState<Room[]>(initialRooms);

  // UI: search & filters
  const [query, setQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("");
  const [minCapacity, setMinCapacity] = useState<number | "">("");
  const [maxCapacity, setMaxCapacity] = useState<number | "">("");

  // modal / form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formType, setFormType] = useState<string>(ROOM_TYPES[0]);
  const [formCapacity, setFormCapacity] = useState<number>(30);

  // pagination
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // import file ref
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // derived filtered list
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rooms.filter((r) => {
      if (filterType && r.type !== filterType) return false;
      if (minCapacity !== "" && r.capacity < Number(minCapacity)) return false;
      if (maxCapacity !== "" && r.capacity > Number(maxCapacity)) return false;
      if (!q) return true;
      return (
        String(r.id).includes(q) ||
        (r.code ?? "").toLowerCase().includes(q) ||
        r.name.toLowerCase().includes(q) ||
        (r.type ?? "").toLowerCase().includes(q)
      );
    });
  }, [rooms, query, filterType, minCapacity, maxCapacity]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // modal handlers
  const openAddModal = () => {
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormType(ROOM_TYPES[0]);
    setFormCapacity(30);
    setModalOpen(true);
  };

  const openEditModal = (r: Room) => {
    setEditingId(r.id);
    setFormCode(r.code ?? "");
    setFormName(r.name);
    setFormType(r.type);
    setFormCapacity(r.capacity);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const saveRoom = () => {
    if (!formName.trim()) {
      alert("Please provide a room name.");
      return;
    }
    if (formCapacity <= 0) {
      alert("Capacity must be greater than 0.");
      return;
    }

    const payload: Room = {
      id: editingId ?? Date.now(),
      code: formCode.trim() || undefined,
      name: formName.trim(),
      type: formType,
      capacity: formCapacity,
    };

    if (editingId != null) {
      setRooms((prev) => prev.map((r) => (r.id === editingId ? payload : r)));
    } else {
      setRooms((prev) => [payload, ...prev]);
      setCurrentPage(1);
    }
    closeModal();
  };

  const deleteRoom = (id: number) => {
    if (!confirm("Delete this room? This action cannot be undone.")) return;
    setRooms((prev) => prev.filter((r) => r.id !== id));
  };

  const resetFilters = () => {
    setQuery("");
    setFilterType("");
    setMinCapacity("");
    setMaxCapacity("");
    setCurrentPage(1);
    setPageSize(PAGE_SIZE_OPTIONS[0]);
  };

  // ---------------- CSV / Excel import & export for rooms ----------------
  const escapeCsv = (v: any) => {
    if (v === undefined || v === null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const ROOMS_CSV_HEADER = ["id", "code", "name", "type", "capacity"];

  const exportRoomsCSV = () => {
    const rows = [ROOMS_CSV_HEADER.join(",")];
    for (const r of rooms) {
      rows.push(
        [
          escapeCsv(r.id),
          escapeCsv(r.code ?? ""),
          escapeCsv(r.name),
          escapeCsv(r.type),
          escapeCsv(r.capacity),
        ].join(",")
      );
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rooms.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportRoomsExcel = async () => {
    try {
      const mod = await import("xlsx");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = mod && (mod.default ?? mod);
      const wsData = [
        ROOMS_CSV_HEADER,
        ...rooms.map((r) => [r.id, r.code ?? "", r.name, r.type, r.capacity]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Rooms");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rooms.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      exportRoomsCSV();
    }
  };

  // CSV parse (simple) and normalize
  const parseCSVText = (text: string) => {
    const rows: string[][] = [];
    let i = 0;
    let field = "";
    let row: string[] = [];
    let inQuotes = false;
    while (i < text.length) {
      const ch = text[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < text.length && text[i + 1] === '"') {
            field += '"';
            i += 2;
            continue;
          } else {
            inQuotes = false;
            i++;
            continue;
          }
        } else {
          field += ch;
          i++;
          continue;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
          i++;
          continue;
        }
        if (ch === ",") {
          row.push(field);
          field = "";
          i++;
          continue;
        }
        if (ch === "\r") {
          i++;
          continue;
        }
        if (ch === "\n") {
          row.push(field);
          rows.push(row);
          row = [];
          field = "";
          i++;
          continue;
        }
        field += ch;
        i++;
      }
    }
    if (field !== "" || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  };

  const normalizeImportedRoom = (raw: Record<string, string>): Room => {
    const id = raw["id"] ? Number(raw["id"]) : Date.now() + Math.floor(Math.random() * 1000);
    const room: Room = {
      id,
      code: raw["code"]?.trim() || undefined,
      name: raw["name"]?.trim() || "",
      type: raw["type"]?.trim() || ROOM_TYPES[0],
      capacity: raw["capacity"] ? Number(raw["capacity"]) : 0,
    };
    return room;
  };

  const mergeImportedRooms = (imported: Room[]) => {
    setRooms((prev) => {
      const map = new Map(prev.map((r) => [r.id, r]));
      const result = [...prev];
      for (const it of imported) {
        if (map.has(it.id)) {
          const idx = result.findIndex((r) => r.id === it.id);
          if (idx >= 0) result[idx] = it;
        } else {
          result.unshift(it);
        }
      }
      return result;
    });
    setCurrentPage(1);
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      try {
        const mod = await import("xlsx");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const XLSX: any = mod && (mod.default ?? mod);
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // runtime cast to avoid TS generic issues
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jsonRows = (XLSX.utils.sheet_to_json as any)(ws, { defval: "" }) as Record<string, any>[];
        const imported = jsonRows.map((row) => {
          const raw: Record<string, string> = {};
          for (const k of Object.keys(row)) raw[String(k).trim()] = String(row[k] ?? "");
          return normalizeImportedRoom(raw);
        });
        mergeImportedRooms(imported);
      } catch {
        alert("Unable to parse Excel file. Try CSV or install xlsx.");
      }
    } else {
      const text = await file.text();
      const rows = parseCSVText(text);
      if (rows.length === 0) {
        alert("Empty or invalid CSV file.");
        return;
      }
      const header = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1);
      const imported = dataRows.map((r) => {
        const raw: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) raw[header[i]] = r[i] ?? "";
        return normalizeImportedRoom(raw);
      });
      mergeImportedRooms(imported);
    }
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const onImportClick = () => importInputRef.current?.click();

  // render
  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-0">Rooms</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage rooms and laboratories (import/export supported)</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder="Search rooms..." className="pl-9 pr-4 w-64" />
            </div>

            <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setCurrentPage(1); }} className="border rounded px-2 py-1 text-sm">
              <option value="">All types</option>
              {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>

            <Input type="number" value={String(minCapacity)} onChange={(e) => setMinCapacity(e.target.value === "" ? "" : Number((e.target as HTMLInputElement).value))} placeholder="Min" className="w-20 text-sm" />
            <Input type="number" value={String(maxCapacity)} onChange={(e) => setMaxCapacity(e.target.value === "" ? "" : Number((e.target as HTMLInputElement).value))} placeholder="Max" className="w-20 text-sm" />

            <input ref={importInputRef} type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} style={{ display: "none" }} />

            <Button onClick={() => openAddModal()} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              New Room
            </Button>

            <Button variant="ghost" onClick={onImportClick} className="whitespace-nowrap">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>

            <Button variant="ghost" onClick={() => exportRoomsCSV()} className="whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button variant="ghost" onClick={() => exportRoomsExcel()} className="whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Rooms & Laboratories</CardTitle>
            <CardDescription>Manage rooms</CardDescription>
          </CardHeader>

          <CardContent className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full table-fixed text-sm">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left py-2 pr-3 font-medium w-12">#</th>
                    <th className="text-left py-2 pr-3 font-medium">Room</th>
                    <th className="text-left py-2 pr-3 font-medium">Type</th>
                    <th className="text-center py-2 pr-3 font-medium w-28">Capacity</th>
                    <th className="text-right py-2 pl-3 font-medium w-28">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.length > 0 ? paginated.map((r, idx) => (
                    <tr key={r.id} className="border-t last:border-b hover:bg-muted/50">
                      <td className="py-2 pr-3 font-medium align-top">{(currentPage - 1) * pageSize + idx + 1}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{r.name}</div>
                        {r.code ? <div className="text-xs text-muted-foreground mt-0.5">{r.code}</div> : null}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground align-top">{r.type}</td>
                      <td className="py-2 pr-3 font-medium text-center align-top">{r.capacity}</td>
                      <td className="py-2 pl-3 text-right align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            aria-label="edit"
                            onClick={() => openEditModal(r)}
                            className="p-2 rounded border border-muted/60 hover:border-primary/80"
                            title="Edit room"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button
                            aria-label="delete"
                            onClick={() => deleteRoom(r.id)}
                            className="p-2 rounded text-destructive hover:bg-destructive/10"
                            title="Delete room"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-sm text-muted-foreground">No rooms found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {filtered.length === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, filtered.length)} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>Previous</Button>

                <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>

                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>Next</Button>

                <div className="flex items-center gap-2 ml-4">
                  <label className="text-sm">Show</label>
                  <select value={pageSize} onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }} className="border rounded px-2 py-1">
                    {PAGE_SIZE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span className="text-sm">entries</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingId ? "Edit Room" : "Add Room"}</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code (optional)</label>
                  <Input value={formCode} onChange={(e) => setFormCode((e.target as HTMLInputElement).value)} placeholder="e.g. CL-001" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Room name</label>
                  <Input value={formName} onChange={(e) => setFormName((e.target as HTMLInputElement).value)} placeholder="e.g. Comlab 1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Type</label>
                    <select value={formType} onChange={(e) => setFormType((e.target as HTMLSelectElement).value)} className="w-full border rounded px-3 py-2">
                      {ROOM_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity</label>
                    <Input type="number" value={String(formCapacity)} onChange={(e) => setFormCapacity(Number((e.target as HTMLInputElement).value || 0))} />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                  <Button onClick={saveRoom}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}