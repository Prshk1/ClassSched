import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Edit, Trash2, Download, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";

type Program = "SHS" | "TESDA";

type Section = {
  id: number;
  code?: string;
  name: string;
  program: Program;
  strandOrDept?: string;
  yearLevel?: string;
  adviser?: string;
  capacity?: number;
};

const SHS_STRANDS = ["HUMSS", "ABM", "ICT", "HE"];
const TESDA_DEPARTMENTS = ["HRMT", "TTMT", "IT", "CET"];

const SHS_YEARS = ["Grade 11", "Grade 12"];
const TESDA_YEARS = ["First Year", "Second Year", "Third Year"];

const initialSections: Section[] = [
  { id: 1, code: "SHS-11-ICT-01", name: "Grade 11 - ICT 1", program: "SHS", strandOrDept: "ICT", yearLevel: "Grade 11", adviser: "Ms. A", capacity: 40 },
  { id: 2, code: "SHS-12-ABM-01", name: "Grade 12 - ABM 1", program: "SHS", strandOrDept: "ABM", yearLevel: "Grade 12", adviser: "Mr. B", capacity: 35 },
  // Removed "Cohort" naming — TESDA entry uses department code style (e.g. HRMT101)
  { id: 101, code: "HRMT101", name: "HRMT101", program: "TESDA", strandOrDept: "HRMT", yearLevel: "First Year", adviser: "Ms. C", capacity: 30 },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50];

const SECTIONS_CSV_HEADER = ["id", "code", "name", "program", "strandOrDept", "yearLevel", "adviser", "capacity"];

export default function ManageSections() {
  // data
  const [sections, setSections] = useState<Section[]>(initialSections);

  // UI - search & filters
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Program>("SHS");
  const [filterStrandOrDept, setFilterStrandOrDept] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");

  // optional filters
  const [minCapacity, setMinCapacity] = useState<number | "">("");
  const [maxCapacity, setMaxCapacity] = useState<number | "">("");

  // pagination per tab
  const [pageSizeSHS, setPageSizeSHS] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [pageSHS, setPageSHS] = useState<number>(1);
  const [pageSizeTESDA, setPageSizeTESDA] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [pageTESDA, setPageTESDA] = useState<number>(1);

  // modal / form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formProgram, setFormProgram] = useState<Program>("SHS");
  const [formStrandDept, setFormStrandDept] = useState("");
  const [formYearLevel, setFormYearLevel] = useState<string>(SHS_YEARS[0]);
  const [formAdviser, setFormAdviser] = useState("");
  const [formCapacity, setFormCapacity] = useState<number>(30);

  // import ref
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const totalPages = (listLength: number, pageSize: number) => Math.max(1, Math.ceil(listLength / pageSize));

  // derive unique adviser suggestions from existing sections
  const adviserSuggestions = useMemo(() => {
    const set = new Set<string>();
    for (const s of sections) {
      if (s.adviser && s.adviser.trim()) set.add(s.adviser.trim());
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [sections]);

  // filter logic for a program
  const filteredForProgram = (program: Program) => {
    const q = query.trim().toLowerCase();
    return sections.filter((s) => {
      if (s.program !== program) return false;
      if (filterStrandOrDept && (s.strandOrDept ?? "") !== filterStrandOrDept) return false;
      if (filterYear && (s.yearLevel ?? "") !== filterYear) return false;
      if (minCapacity !== "" && (s.capacity ?? 0) < Number(minCapacity)) return false;
      if (maxCapacity !== "" && (s.capacity ?? 0) > Number(maxCapacity)) return false;
      if (!q) return true;
      return (
        (s.name ?? "").toLowerCase().includes(q) ||
        (s.code ?? "").toLowerCase().includes(q) ||
        (s.adviser ?? "").toLowerCase().includes(q) ||
        (s.strandOrDept ?? "").toLowerCase().includes(q)
      );
    });
  };

  const paginate = (list: Section[], page: number, pageSize: number) => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  };

  // modal
  const openAddModal = (program?: Program) => {
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormProgram(program ?? activeTab);
    setFormStrandDept("");
    setFormYearLevel(program === "TESDA" ? TESDA_YEARS[0] : SHS_YEARS[0]);
    setFormAdviser("");
    setFormCapacity(30);
    setModalOpen(true);
  };

  const openEditModal = (s: Section) => {
    setEditingId(s.id);
    setFormCode(s.code ?? "");
    setFormName(s.name);
    setFormProgram(s.program);
    setFormStrandDept(s.strandOrDept ?? "");
    setFormYearLevel(s.yearLevel ?? (s.program === "TESDA" ? TESDA_YEARS[0] : SHS_YEARS[0]));
    setFormAdviser(s.adviser ?? "");
    setFormCapacity(s.capacity ?? 30);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const saveSection = () => {
    if (!formName.trim()) {
      alert("Please provide section name.");
      return;
    }
    const payload: Section = {
      id: editingId ?? Date.now(),
      code: formCode.trim() || undefined,
      name: formName.trim(),
      program: formProgram,
      strandOrDept: formStrandDept || undefined,
      yearLevel: formYearLevel || undefined,
      adviser: formAdviser || undefined,
      capacity: formCapacity || 0,
    };

    if (editingId != null) {
      setSections((prev) => prev.map((p) => (p.id === editingId ? payload : p)));
    } else {
      setSections((prev) => [payload, ...prev]);
      if (payload.program === "SHS") setPageSHS(1);
      else setPageTESDA(1);
    }
    closeModal();
  };

  const deleteSection = (id: number) => {
    if (!confirm("Delete this section/class? This cannot be undone.")) return;
    setSections((prev) => prev.filter((s) => s.id !== id));
  };

  // export helpers
  const escapeCsv = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCSV = (programFilter?: Program | "ALL") => {
    const source = programFilter && programFilter !== "ALL" ? sections.filter((s) => s.program === programFilter) : sections;
    const rows = [SECTIONS_CSV_HEADER.join(",")];
    for (const s of source) {
      rows.push(
        [
          escapeCsv(s.id),
          escapeCsv(s.code ?? ""),
          escapeCsv(s.name),
          escapeCsv(s.program),
          escapeCsv(s.strandOrDept ?? ""),
          escapeCsv(s.yearLevel ?? ""),
          escapeCsv(s.adviser ?? ""),
          escapeCsv(s.capacity ?? 0),
        ].join(",")
      );
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sections${programFilter && programFilter !== "ALL" ? `-${programFilter.toLowerCase()}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async (programFilter?: Program | "ALL") => {
    try {
      const mod = await import("xlsx");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = mod && (mod.default ?? mod);
      const source = programFilter && programFilter !== "ALL" ? sections.filter((s) => s.program === programFilter) : sections;
      const wsData = [
        SECTIONS_CSV_HEADER,
        ...source.map((s) => [s.id, s.code ?? "", s.name, s.program, s.strandOrDept ?? "", s.yearLevel ?? "", s.adviser ?? "", s.capacity ?? 0]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Sections");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sections${programFilter && programFilter !== "ALL" ? `-${programFilter.toLowerCase()}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      exportCSV(programFilter);
    }
  };

  // CSV parse + normalize
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

  const normalizeImported = (raw: Record<string, string>): Section => {
    const id = raw["id"] ? Number(raw["id"]) : Date.now() + Math.floor(Math.random() * 1000);
    return {
      id,
      code: raw["code"]?.trim() || undefined,
      name: raw["name"]?.trim() || "",
      program: (raw["program"] === "TESDA" ? "TESDA" : "SHS"),
      strandOrDept: raw["strandOrDept"]?.trim() || undefined,
      yearLevel: raw["yearLevel"]?.trim() || undefined,
      adviser: raw["adviser"]?.trim() || undefined,
      capacity: raw["capacity"] ? Number(raw["capacity"]) : 0,
    };
  };

  const mergeImported = (imported: Section[]) => {
    setSections((prev) => {
      const map = new Map(prev.map((s) => [s.id, s]));
      const result = [...prev];
      for (const it of imported) {
        if (map.has(it.id)) {
          const idx = result.findIndex((s) => s.id === it.id);
          if (idx >= 0) result[idx] = it;
        } else {
          result.unshift(it);
        }
      }
      return result;
    });
    setActiveTab("SHS");
    setPageSHS(1);
    setPageTESDA(1);
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
        // runtime cast for sheet_to_json
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const jsonRows = (XLSX.utils.sheet_to_json as any)(ws, { defval: "" }) as Record<string, any>[];
        const imported = jsonRows.map((row) => {
          const raw: Record<string, string> = {};
          for (const k of Object.keys(row)) raw[String(k).trim()] = String(row[k] ?? "");
          return normalizeImported(raw);
        });
        mergeImported(imported);
      } catch {
        alert("Unable to parse Excel file. Try CSV.");
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
        return normalizeImported(raw);
      });
      mergeImported(imported);
    }
    if (importInputRef.current) importInputRef.current.value = "";
  };

  const onImportClick = () => importInputRef.current?.click();

  // render table for a program
  const renderTableFor = (program: Program) => {
    const list = filteredForProgram(program);
    const page = program === "SHS" ? pageSHS : pageTESDA;
    const pageSize = program === "SHS" ? pageSizeSHS : pageSizeTESDA;
    const pag = paginate(list, page, pageSize);
    const pages = totalPages(list.length, pageSize);

    return (
      <Card key={program} className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">{program === "SHS" ? "Senior High Sections" : "TESDA Sections"}</CardTitle>
          <CardDescription>{list.length} section{list.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>

        <CardContent className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="text-left py-2 pr-3 font-medium w-12">#</th>
                  <th className="text-left py-2 pr-3 font-medium">Section</th>
                  <th className="text-left py-2 pr-3 font-medium">Strand / Dept</th>
                  <th className="text-left py-2 pr-3 font-medium">Year</th>
                  <th className="text-center py-2 pr-3 font-medium w-20">Capacity</th>
                  <th className="text-right py-2 pl-3 font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pag.length > 0 ? (
                  pag.map((s, idx) => (
                    <tr key={s.id} className="border-t last:border-b hover:bg-muted/50">
                      <td className="py-2 pr-3 font-medium align-top">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="py-2 pr-3">
                        <div className="font-medium">{s.name}</div>
                        {s.code ? <div className="text-xs text-muted-foreground mt-0.5">{s.code}</div> : null}
                        {s.adviser ? <div className="text-xs text-muted-foreground mt-0.5">Adviser: {s.adviser}</div> : null}
                      </td>
                      <td className="py-2 pr-3 text-muted-foreground align-top">{s.strandOrDept ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground align-top">{s.yearLevel ?? "—"}</td>
                      <td className="py-2 pr-3 font-medium text-center align-top">{s.capacity ?? "—"}</td>
                      <td className="py-2 pl-3 text-right align-top">
                        <div className="flex items-center justify-end gap-2">
                          <button aria-label="edit" onClick={() => openEditModal(s)} className="p-2 rounded border border-muted/60 hover:border-primary/80" title="Edit section">
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>
                          <button aria-label="delete" onClick={() => deleteSection(s.id)} className="p-2 rounded text-destructive hover:bg-destructive/10" title="Delete section">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">No sections found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination */}
          <div className="mt-4 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              Page {Math.min(page, pages)} of {pages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  if (program === "SHS") setPageSHS((p) => Math.max(1, p - 1));
                  else setPageTESDA((p) => Math.max(1, p - 1));
                }}
                disabled={page <= 1}
              >
                Previous
              </Button>

              <div className="px-3 py-1 border rounded text-sm bg-card">{page}</div>

              <Button
                variant="ghost"
                onClick={() => {
                  if (program === "SHS") setPageSHS((p) => Math.min(pages, p + 1));
                  else setPageTESDA((p) => Math.min(pages, p + 1));
                }}
                disabled={page >= pages}
              >
                Next
              </Button>

              <div className="flex items-center gap-2 ml-4">
                <label className="text-sm">Show</label>
                <select
                  value={program === "SHS" ? pageSizeSHS : pageSizeTESDA}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    if (program === "SHS") {
                      setPageSizeSHS(v);
                      setPageSHS(1);
                    } else {
                      setPageSizeTESDA(v);
                      setPageTESDA(1);
                    }
                  }}
                  className="border rounded px-2 py-1"
                >
                  {PAGE_SIZE_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
                <span className="text-sm">entries</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  // UI render
  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-0">Sections / Classes</h1>
            <p className="text-muted-foreground text-sm mt-1">Manage section lists for Senior High and TESDA-based programs</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder="Search sections..." className="pl-9 pr-4 w-64" />
            </div>

            <select
              value={filterStrandOrDept}
              onChange={(e) => {
                setFilterStrandOrDept(e.target.value);
                if (activeTab === "SHS") setPageSHS(1);
                else setPageTESDA(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">All Strands / Depts</option>
              {(activeTab === "SHS" ? SHS_STRANDS : TESDA_DEPARTMENTS).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                if (activeTab === "SHS") setPageSHS(1);
                else setPageTESDA(1);
              }}
              className="border rounded px-2 py-1 text-sm"
            >
              <option value="">All Years</option>
              {(activeTab === "SHS" ? SHS_YEARS : TESDA_YEARS).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <Input
              type="number"
              value={String(minCapacity)}
              onChange={(e) => setMinCapacity(e.target.value === "" ? "" : Number((e.target as HTMLInputElement).value))}
              placeholder="Min"
              className="w-20 text-sm"
            />
            <Input
              type="number"
              value={String(maxCapacity)}
              onChange={(e) => setMaxCapacity(e.target.value === "" ? "" : Number((e.target as HTMLInputElement).value))}
              placeholder="Max"
              className="w-20 text-sm"
            />

            <input ref={importInputRef} type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} style={{ display: "none" }} />

            <Button onClick={() => openAddModal(activeTab)} className="whitespace-nowrap">
              <Plus className="h-4 w-4 mr-2" />
              New Section
            </Button>

            <Button variant="ghost" onClick={() => onImportClick()} className="whitespace-nowrap">
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>

            <Button variant="ghost" onClick={() => exportCSV("ALL")} className="whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>

            <Button variant="ghost" onClick={() => exportExcel("ALL")} className="whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              Export Excel
            </Button>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("SHS");
              setFilterStrandOrDept("");
              setFilterYear("");
              setPageSHS(1);
            }}
            className={`px-4 py-2 rounded ${activeTab === "SHS" ? "bg-primary text-white" : "bg-card border border-border"}`}
          >
            Senior High (SHS)
          </button>
          <button
            onClick={() => {
              setActiveTab("TESDA");
              setFilterStrandOrDept("");
              setFilterYear("");
              setPageTESDA(1);
            }}
            className={`px-4 py-2 rounded ${activeTab === "TESDA" ? "bg-primary text-white" : "bg-card border border-border"}`}
          >
            TESDA-based
          </button>
        </div>

        {/* Render selected tab */}
        {activeTab === "SHS" ? renderTableFor("SHS") : renderTableFor("TESDA")}

        {/* Modal for Add / Edit Section */}
        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
            <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-auto">
              <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-semibold">{editingId ? "Edit Section" : "Add Section"}</h3>
              </div>

              <div className="p-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Code (optional)</label>
                  <Input value={formCode} onChange={(e) => setFormCode((e.target as HTMLInputElement).value)} placeholder="e.g. SHS-11-ICT-01 or HRMT101" />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Section name</label>
                  <Input value={formName} onChange={(e) => setFormName((e.target as HTMLInputElement).value)} placeholder="e.g. Grade 11 - ICT 1" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">Program</label>

                    {/* When editing an existing section, don't allow changing the program.
                        Show a read-only badge instead. When adding a new section, show the select. */}
                    {editingId ? (
                      <div>
                        <Badge variant="secondary">{formProgram === "SHS" ? "Senior High (SHS)" : "TESDA-based"}</Badge>
                      </div>
                    ) : (
                      <select value={formProgram} onChange={(e) => {
                        const p = (e.target as HTMLSelectElement).value as Program;
                        setFormProgram(p);
                        setFormStrandDept("");
                        setFormYearLevel(p === "TESDA" ? TESDA_YEARS[0] : SHS_YEARS[0]);
                      }} className="w-full border rounded px-3 py-2">
                        <option value="SHS">Senior High (SHS)</option>
                        <option value="TESDA">TESDA-based</option>
                      </select>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Capacity</label>
                    <Input type="number" value={String(formCapacity)} onChange={(e) => setFormCapacity(Number((e.target as HTMLInputElement).value || 0))} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">{formProgram === "SHS" ? "Strand" : "Department"}</label>
                    <select value={formStrandDept} onChange={(e) => setFormStrandDept((e.target as HTMLSelectElement).value)} className="w-full border rounded px-3 py-2">
                      <option value="">-- none --</option>
                      {(formProgram === "SHS" ? SHS_STRANDS : TESDA_DEPARTMENTS).map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">Year Level</label>
                    <select value={formYearLevel} onChange={(e) => setFormYearLevel((e.target as HTMLSelectElement).value)} className="w-full border rounded px-3 py-2">
                      <option value="">-- none --</option>
                      {(formProgram === "SHS" ? SHS_YEARS : TESDA_YEARS).map((y) => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Adviser (optional)</label>
                  {/* Use a datalist to provide inline suggestions from existing advisers. */}
                  <Input
                    value={formAdviser}
                    onChange={(e) => setFormAdviser((e.target as HTMLInputElement).value)}
                    placeholder="e.g. Mr. Smith"
                    list="advisers-list"
                    aria-autocomplete="list"
                    aria-haspopup="true"
                  />
                  <datalist id="advisers-list">
                    {adviserSuggestions.map((a) => (
                      <option key={a} value={a} />
                    ))}
                  </datalist>
                </div>

                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                  <Button onClick={saveSection}>Save</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}