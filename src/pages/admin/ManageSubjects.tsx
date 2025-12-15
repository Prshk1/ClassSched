import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState, useRef, useEffect } from "react";

type Program = "SHS" | "TESDA";

type Subject = {
  id: number;
  code?: string;
  name: string;
  units: number;
  // extended types: SHS uses Core | Specialized | Applied; TESDA uses Major | Minor
  type?: "Major" | "Minor" | "Core" | "Specialized" | "Applied";
  departments?: string[]; // e.g. ["IT", "CET"] or strands for SHS
  yearLevels?: string[]; // e.g. ["Grade 11", "Grade 12"] or ["First Year", "Second Year", "Third Year"]
  semester?: "1st Semester" | "2nd Semester" | "All";
  program: Program;
};

const SHS_STRANDS = ["HUMSS", "ABM", "ICT", "HE"];
const TESDA_DEPARTMENTS = ["HRMT", "TTMT", "IT", "CET"];

const SHS_YEARS = ["Grade 11", "Grade 12"];
const TESDA_YEARS = ["First Year", "Second Year", "Third Year"];

const initialSubjects: Subject[] = [
  // Senior High examples
  {
    id: 1,
    code: "SHS-MATH-101",
    name: "Mathematics [MATH 113]",
    units: 3,
    type: "Core",
    departments: ["HUMSS", "ABM", "ICT"],
    yearLevels: ["Grade 11", "Grade 12"],
    semester: "1st Semester",
    program: "SHS",
  },
  {
    id: 2,
    code: "SHS-ENG-113",
    name: "English [ENG 113]",
    units: 3,
    type: "Core",
    departments: ["HUMSS", "HE"],
    yearLevels: ["Grade 11"],
    semester: "1st Semester",
    program: "SHS",
  },
  {
    id: 3,
    code: "SHS-FIL-101",
    name: "Filipino [FIL 101]",
    units: 3,
    type: "Specialized",
    departments: ["ICT"],
    yearLevels: ["Grade 12"],
    semester: "1st Semester",
    program: "SHS",
  },

  // TESDA-based college examples (yearLevels use First/Second/Third Year)
  {
    id: 101,
    code: "TESDA-MMW-101",
    name: "Mathematics in the Modern World",
    units: 3,
    type: "Major",
    departments: ["HRMT"],
    yearLevels: ["First Year"],
    semester: "All",
    program: "TESDA",
  },
  {
    id: 102,
    code: "TESDA-UTS-101",
    name: "Understanding the Self",
    units: 4,
    type: "Major",
    departments: ["TTMT"],
    yearLevels: ["First Year"],
    semester: "All",
    program: "TESDA",
  },
  {
    id: 103,
    code: "TESDA-VGD-101",
    name: "Visual Graphics and Design",
    units: 3,
    type: "Major",
    departments: ["IT"],
    yearLevels: ["First Year"],
    semester: "All",
    program: "TESDA",
  },
];

const pageSizeOptions = [10, 25, 50];

const SUBJECTS_CSV_HEADER = ["id", "code", "name", "units", "type", "departments", "yearLevels", "semester", "program"];

const ManageSubjects = () => {
  // UI / search
  const [query, setQuery] = useState("");

  // data
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects);

  // modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [formUnits, setFormUnits] = useState<number>(3);
  const [formType, setFormType] = useState<Subject["type"]>("Core");
  // use arrays for departments/yearLevels in the modal (easier to manage suggestions/tags)
  const [formDepartmentsList, setFormDepartmentsList] = useState<string[]>([]);
  const [formDeptInput, setFormDeptInput] = useState("");
  const [formYearsList, setFormYearsList] = useState<string[]>([]);
  const [formYearInput, setFormYearInput] = useState("");
  const [formSemester, setFormSemester] = useState<Subject["semester"]>("All");
  const [formProgram, setFormProgram] = useState<Program>("SHS");

  // filters (per active tab)
  const [filterDepartment, setFilterDepartment] = useState<string>("");
  const [filterType, setFilterType] = useState<string>("");
  const [filterYear, setFilterYear] = useState<string>("");
  const [filterSemester, setFilterSemester] = useState<string>("");

  // UI tab (separate pages for SHS and TESDA)
  const [activeTab, setActiveTab] = useState<Program>("SHS");

  // independent pagination per tab
  const [pageSizeSHS, setPageSizeSHS] = useState<number>(pageSizeOptions[0]);
  const [pageSHS, setPageSHS] = useState<number>(1);
  const [pageSizeTESDA, setPageSizeTESDA] = useState<number>(pageSizeOptions[0]);
  const [pageTESDA, setPageTESDA] = useState<number>(1);

  // derived filter options from data (only show relevant options for active tab)
  const shsDepartments = SHS_STRANDS;
  const tesdaDepartments = TESDA_DEPARTMENTS;

  const allYears = useMemo(() => {
    const setY = new Set<string>();
    subjects.forEach((s) => (s.yearLevels ?? []).forEach((y) => setY.add(y)));
    // ensure SHS/TESDA canonical years are included
    SHS_YEARS.forEach((y) => setY.add(y));
    TESDA_YEARS.forEach((y) => setY.add(y));
    return Array.from(setY).sort();
  }, [subjects]);

  const allSemesters = useMemo(() => {
    const setS = new Set<string>();
    subjects.forEach((s) => s.semester && setS.add(s.semester));
    return Array.from(setS).sort();
  }, [subjects]);

  // program-specific type options
  const shsTypeOptions = ["Core", "Specialized", "Applied"];
  const tesdaTypeOptions = ["Major", "Minor"];

  // reset page when filters/search/page size change for relevant tab
  const resetPageForActiveTab = () => {
    if (activeTab === "SHS") setPageSHS(1);
    else setPageTESDA(1);
  };

  const resetFilters = () => {
    setFilterDepartment("");
    setFilterType("");
    setFilterYear("");
    setFilterSemester("");
    setQuery("");
    resetPageForActiveTab();
  };

  // Filtering + searching for a given program
  const filteredForProgram = (program: Program) => {
    const q = query.trim().toLowerCase();
    return subjects.filter((s) => {
      if (s.program !== program) return false;
      if (filterDepartment) {
        if (!s.departments || !s.departments.some((d) => d.toLowerCase() === filterDepartment.toLowerCase())) return false;
      }
      if (filterType) {
        if ((s.type ?? "").toLowerCase() !== filterType.toLowerCase()) return false;
      }
      if (filterYear) {
        if (!s.yearLevels || !s.yearLevels.some((y) => y.toLowerCase() === filterYear.toLowerCase())) return false;
      }
      if (filterSemester) {
        if (((s.semester ?? "") as string).toLowerCase() !== filterSemester.toLowerCase()) return false;
      }
      if (!q) return true;
      if (s.name.toLowerCase().includes(q)) return true;
      if ((s.code ?? "").toLowerCase().includes(q)) return true;
      if ((s.departments ?? []).some((d) => d.toLowerCase().includes(q))) return true;
      if ((s.type ?? "").toLowerCase().includes(q)) return true;
      return false;
    });
  };

  // pagination helpers
  const totalPages = (listLength: number, pageSize: number) => Math.max(1, Math.ceil(listLength / pageSize));
  const paginate = (list: Subject[], page: number, pageSize: number) => {
    const start = (page - 1) * pageSize;
    return list.slice(start, start + pageSize);
  };

  // --------------- suggestion helpers for modal (departments & year levels) ---------------
  const deptSuggestionList = (program: Program) => (program === "SHS" ? shsDepartments : tesdaDepartments);
  const yearSuggestionList = (program: Program) => (program === "SHS" ? SHS_YEARS : TESDA_YEARS);

  const addDepartment = (value?: string) => {
    const raw = (value ?? formDeptInput).trim();
    if (!raw) return;
    // avoid duplicates (case-insensitive)
    const existing = formDepartmentsList.some((d) => d.toLowerCase() === raw.toLowerCase());
    if (!existing) setFormDepartmentsList((p) => [...p, raw]);
    setFormDeptInput("");
  };

  const removeDepartment = (d: string) => {
    setFormDepartmentsList((p) => p.filter((x) => x !== d));
  };

  const addYearLevel = (value?: string) => {
    const raw = (value ?? formYearInput).trim();
    if (!raw) return;
    const existing = formYearsList.some((y) => y.toLowerCase() === raw.toLowerCase());
    if (!existing) setFormYearsList((p) => [...p, raw]);
    setFormYearInput("");
  };

  const removeYearLevel = (y: string) => {
    setFormYearsList((p) => p.filter((x) => x !== y));
  };

  // --------------- modal handlers ---------------
  const openAddModal = (program?: Program) => {
    setEditingId(null);
    setFormCode("");
    setFormName("");
    setFormUnits(3);
    setFormType(program === "TESDA" ? "Major" : "Core");
    setFormDepartmentsList([]);
    setFormDeptInput("");
    setFormYearsList([]);
    setFormYearInput("");
    setFormSemester("All");
    if (program) setFormProgram(program);
    setModalOpen(true);
  };

  const openEditModal = (s: Subject) => {
    setEditingId(s.id);
    setFormCode(s.code ?? "");
    setFormName(s.name);
    setFormUnits(s.units);
    setFormType(s.type ?? (s.program === "TESDA" ? "Major" : "Core"));
    setFormDepartmentsList([... (s.departments ?? [])]);
    setFormDeptInput("");
    setFormYearsList([... (s.yearLevels ?? [])]);
    setFormYearInput("");
    setFormSemester(s.semester ?? "All");
    setFormProgram(s.program);
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const saveSubject = () => {
    if (!formName.trim()) {
      alert("Please provide subject name");
      return;
    }
    const departments = [...formDepartmentsList];
    const years = [...formYearsList];

    if (editingId != null) {
      setSubjects((prev) =>
        prev.map((p) =>
          p.id === editingId
            ? {
                ...p,
                code: formCode.trim() || p.code,
                name: formName.trim(),
                units: formUnits,
                type: formType,
                departments,
                yearLevels: years,
                semester: formSemester,
                program: formProgram,
              }
            : p
        )
      );
    } else {
      const newSubject: Subject = {
        id: Date.now(),
        code: formCode.trim() || `SUB-${Date.now().toString().slice(-4)}`,
        name: formName.trim(),
        units: formUnits,
        type: formType,
        departments,
        yearLevels: years,
        semester: formSemester,
        program: formProgram,
      };
      setSubjects((prev) => [newSubject, ...prev]);
      // reset relevant page so new item is visible
      if (formProgram === "SHS") setPageSHS(1);
      else setPageTESDA(1);
    }
    closeModal();
  };

  const deleteSubject = (id: number) => {
    if (!confirm("Delete this subject? This action cannot be undone.")) return;
    setSubjects((prev) => prev.filter((s) => s.id !== id));
  };

  // --------------- IMPORT / EXPORT IMPLEMENTATION ---------------
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const escapeCsv = (v: any) => {
    if (v == null) return "";
    const s = String(v);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportCSV = (programFilter?: Program | "ALL") => {
    const source = programFilter && programFilter !== "ALL" ? subjects.filter((s) => s.program === programFilter) : subjects;
    const rows = [SUBJECTS_CSV_HEADER.join(",")];
    for (const s of source) {
      rows.push(
        [
          escapeCsv(s.id),
          escapeCsv(s.code ?? ""),
          escapeCsv(s.name),
          escapeCsv(s.units ?? 0),
          escapeCsv(s.type ?? ""),
          escapeCsv((s.departments ?? []).join("|")), // use pipe inside cell to keep commas available
          escapeCsv((s.yearLevels ?? []).join("|")),
          escapeCsv(s.semester ?? ""),
          escapeCsv(s.program),
        ].join(",")
      );
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `subjects${programFilter && programFilter !== "ALL" ? `-${programFilter.toLowerCase()}` : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportExcel = async (programFilter?: Program | "ALL") => {
    try {
      const mod = await import("xlsx");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const XLSX: any = mod && (mod.default ?? mod);
      const source = programFilter && programFilter !== "ALL" ? subjects.filter((s) => s.program === programFilter) : subjects;
      const wsData = [
        SUBJECTS_CSV_HEADER,
        ...source.map((s) => [
          s.id,
          s.code ?? "",
          s.name,
          s.units ?? 0,
          s.type ?? "",
          (s.departments ?? []).join("|"),
          (s.yearLevels ?? []).join("|"),
          s.semester ?? "",
          s.program,
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Subjects");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `subjects${programFilter && programFilter !== "ALL" ? `-${programFilter.toLowerCase()}` : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      exportCSV(programFilter);
    }
  };

  // CSV parser (robust, handles quoted fields) - same logic used in sections example
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

  const normalizeImported = (raw: Record<string, string>): Subject => {
    const id = raw["id"] ? Number(raw["id"]) : Date.now() + Math.floor(Math.random() * 1000);
    const departments = raw["departments"] ? String(raw["departments"]).split("|").map((d) => d.trim()).filter(Boolean) : [];
    const yearLevels = raw["yearLevels"] ? String(raw["yearLevels"]).split("|").map((y) => y.trim()).filter(Boolean) : [];
    const program = raw["program"] && String(raw["program"]).toUpperCase() === "TESDA" ? "TESDA" : "SHS";
    return {
      id,
      code: raw["code"]?.trim() || undefined,
      name: raw["name"]?.trim() || "",
      units: raw["units"] ? Number(raw["units"]) : 0,
      type: (raw["type"] as Subject["type"]) || undefined,
      departments,
      yearLevels,
      semester: (raw["semester"] as Subject["semester"]) || "All",
      program,
    };
  };

  const mergeImported = (imported: Subject[]) => {
    setSubjects((prev) => {
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

  // render table for a program (uses its own pagination)
  const renderProgramTable = (program: Program) => {
    const list = filteredForProgram(program);
    const page = program === "SHS" ? pageSHS : pageTESDA;
    const pageSize = program === "SHS" ? pageSizeSHS : pageSizeTESDA;
    const paginated = paginate(list, page, pageSize);
    const pages = totalPages(list.length, pageSize);

    return (
      <Card className="mb-6" key={program}>
        <CardHeader>
          <CardTitle>{program === "SHS" ? "Senior High Subjects" : "TESDA-based College Subjects"}</CardTitle>
          <CardDescription>{list.length} subject{list.length !== 1 ? "s" : ""}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-sm text-muted-foreground">
                  <th className="text-left py-4 pr-6 font-medium">#</th>
                  <th className="text-left py-4 pr-6 font-medium">Subject</th>
                  <th className="text-left py-4 pr-6 font-medium">Units</th>
                  <th className="text-left py-4 pr-6 font-medium">Type</th>
                  <th className="text-left py-4 pr-6 font-medium">Department / Strand</th>
                  <th className="text-left py-4 pr-6 font-medium">Year Level</th>
                  <th className="text-left py-4 pr-6 font-medium">Semester</th>
                  <th className="text-right py-4 pl-6 font-medium">Action</th>
                </tr>
              </thead>

              <tbody>
                {paginated.length > 0 ? (
                  paginated.map((s, idx) => (
                    <tr key={s.id} className="border-t last:border-b hover:bg-muted/50 transition-colors align-top">
                      <td className="py-6 pr-6 font-medium">{(page - 1) * pageSize + idx + 1}</td>
                      <td className="py-6 pr-6">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs text-muted-foreground">{s.code ?? ""}</div>
                      </td>
                      <td className="py-6 pr-6">{s.units}</td>
                      <td className="py-6 pr-6">{s.type ?? "—"}</td>
                      <td className="py-6 pr-6">
                        {(s.departments ?? []).length > 0 ? (s.departments ?? []).join(", ") : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-6 pr-6">
                        {(s.yearLevels ?? []).length > 0 ? (s.yearLevels ?? []).join(", ") : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-6 pr-6">{s.semester ?? "All"}</td>
                      <td className="py-6 pl-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            aria-label="edit-subject"
                            onClick={() => openEditModal(s)}
                            className="p-2 rounded-lg border border-muted/60 hover:border-primary/80 transition-colors"
                            title="Edit subject"
                          >
                            <Edit className="h-4 w-4 text-muted-foreground" />
                          </button>

                          <button
                            aria-label="delete-subject"
                            onClick={() => deleteSubject(s.id)}
                            className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                            title="Delete subject"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      No subjects found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* pagination controls for this program */}
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

              {/* page size control for this program */}
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
                  {pageSizeOptions.map((o) => (
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

  // UI
  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Manage Subjects</h1>
            <p className="text-muted-foreground">Separate pages for Senior High (SHS) and TESDA-based programs. Use filters to narrow the list.</p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={() => openAddModal(activeTab)}>
              <Plus className="h-4 w-4 mr-2" />
              Add New Subject
            </Button>

            <input ref={importInputRef} type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} style={{ display: "none" }} />

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

        {/* Tabs */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              setActiveTab("SHS");
              // clear department/type and reset page for the tab
              setFilterDepartment("");
              setFilterType("");
              resetPageForActiveTab();
            }}
            className={`px-4 py-2 rounded ${activeTab === "SHS" ? "bg-primary text-white" : "bg-card border border-border"}`}
          >
            Senior High (SHS)
          </button>
          <button
            onClick={() => {
              setActiveTab("TESDA");
              setFilterDepartment("");
              setFilterType("");
              resetPageForActiveTab();
            }}
            className={`px-4 py-2 rounded ${activeTab === "TESDA" ? "bg-primary text-white" : "bg-card border border-border"}`}
          >
            TESDA-based College
          </button>
        </div>

        {/* Filters area (values adapt to the active tab) */}
        <div className="bg-card border border-border rounded p-4">
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterDepartment}
              onChange={(e) => {
                setFilterDepartment(e.target.value);
                resetPageForActiveTab();
              }}
              className="border rounded px-3 py-2"
            >
              <option value="">All {activeTab === "SHS" ? "Strands / Departments" : "Departments"}</option>
              {(activeTab === "SHS" ? shsDepartments : tesdaDepartments).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value);
                resetPageForActiveTab();
              }}
              className="border rounded px-3 py-2"
            >
              <option value="">All Types</option>
              {(activeTab === "SHS" ? shsTypeOptions : tesdaTypeOptions).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={filterYear}
              onChange={(e) => {
                setFilterYear(e.target.value);
                resetPageForActiveTab();
              }}
              className="border rounded px-3 py-2"
            >
              <option value="">All Years</option>
              {(activeTab === "SHS" ? SHS_YEARS : TESDA_YEARS).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                resetPageForActiveTab();
              }}
              className="border rounded px-3 py-2"
            >
              <option value="">All Semester</option>
              {allSemesters.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <div className="relative ml-auto flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    resetPageForActiveTab();
                  }}
                  placeholder="Search subjects..."
                  className="pl-9 pr-4 w-72"
                />
              </div>

              <Button variant="ghost" onClick={resetFilters}>
                Reset filters
              </Button>
            </div>
          </div>
        </div>

        {/* Render only the selected tab's table */}
        {activeTab === "SHS" ? renderProgramTable("SHS") : renderProgramTable("TESDA")}
      </div>

      {/* Modal for add/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
          <div className="relative z-10 w-11/12 max-w-lg bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit Subject" : "Add Subject"}</h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Code (optional)</label>
                <Input value={formCode} onChange={(e) => setFormCode(e.target.value)} placeholder="e.g. MATH-101" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Algebra" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Units</label>
                  <Input type="number" value={String(formUnits)} onChange={(e) => setFormUnits(Number(e.target.value || 0))} />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={formType}
                    onChange={(e) => setFormType(e.target.value as Subject["type"])}
                    className="w-full border rounded px-3 py-2"
                  >
                    {(formProgram === "SHS" ? shsTypeOptions : tesdaTypeOptions).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  {formProgram === "SHS" ? "Strands (pick or type, press Enter)" : "Departments (pick or type, press Enter)"}
                </label>

                {/* department suggestions + chips */}
                <div className="mb-2">
                  <div className="flex gap-2 items-center">
                    <input
                      value={formDeptInput}
                      onChange={(e) => setFormDeptInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addDepartment();
                        }
                      }}
                      placeholder={formProgram === "SHS" ? "e.g. HUMSS" : "e.g. HRMT"}
                      className="w-full border rounded px-3 py-2"
                    />
                    <Button onClick={() => addDepartment()}>Add</Button>
                  </div>

                  {/* suggestions */}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {deptSuggestionList(formProgram)
                      .filter((d) => !formDepartmentsList.some((sel) => sel.toLowerCase() === d.toLowerCase()))
                      .filter((d) => d.toLowerCase().includes(formDeptInput.trim().toLowerCase()))
                      .slice(0, 8)
                      .map((d) => (
                        <button
                          key={d}
                          onClick={() => addDepartment(d)}
                          className="text-xs px-2 py-1 border rounded bg-card hover:bg-muted/50"
                        >
                          {d}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formDepartmentsList.map((d) => (
                    <Badge key={d} className="flex items-center gap-2">
                      <span>{d}</span>
                      <button onClick={() => removeDepartment(d)} className="ml-1 text-xs opacity-80 hover:opacity-100">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {formDepartmentsList.length === 0 && <div className="text-sm text-muted-foreground">No departments/strands selected</div>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Year Levels (pick or type, press Enter)</label>
                <div className="mb-2">
                  <div className="flex gap-2 items-center">
                    <input
                      value={formYearInput}
                      onChange={(e) => setFormYearInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addYearLevel();
                        }
                      }}
                      placeholder={formProgram === "SHS" ? "e.g. Grade 11" : "e.g. First Year"}
                      className="w-full border rounded px-3 py-2"
                    />
                    <Button onClick={() => addYearLevel()}>Add</Button>
                  </div>

                  {/* suggestions */}
                  <div className="mt-1 flex flex-wrap gap-2">
                    {yearSuggestionList(formProgram)
                      .filter((y) => !formYearsList.some((sel) => sel.toLowerCase() === y.toLowerCase()))
                      .filter((y) => y.toLowerCase().includes(formYearInput.trim().toLowerCase()))
                      .slice(0, 8)
                      .map((y) => (
                        <button key={y} onClick={() => addYearLevel(y)} className="text-xs px-2 py-1 border rounded bg-card hover:bg-muted/50">
                          {y}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {formYearsList.map((y) => (
                    <Badge key={y} className="flex items-center gap-2">
                      <span>{y}</span>
                      <button onClick={() => removeYearLevel(y)} className="ml-1 text-xs opacity-80 hover:opacity-100">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {formYearsList.length === 0 && <div className="text-sm text-muted-foreground">No year levels selected</div>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Semester</label>
                  <select value={formSemester} onChange={(e) => setFormSemester(e.target.value as Subject["semester"])} className="w-full border rounded px-3 py-2">
                    <option value="All">All</option>
                    <option value="1st Semester">1st Semester</option>
                    <option value="2nd Semester">2nd Semester</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Program</label>
                  <select
                    value={formProgram}
                    onChange={(e) => {
                      const p = e.target.value as Program;
                      setFormProgram(p);
                      // adapt type default and clear department/year suggestions to match new program
                      setFormType(p === "TESDA" ? "Major" : "Core");
                      setFormDepartmentsList([]);
                      setFormYearsList([]);
                    }}
                    className="w-full border rounded px-3 py-2"
                  >
                    <option value="SHS">Senior High (SHS)</option>
                    <option value="TESDA">TESDA-based College</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button variant="ghost" onClick={closeModal}>
                  Cancel
                </Button>
                <Button onClick={saveSubject}>Save</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ManageSubjects;