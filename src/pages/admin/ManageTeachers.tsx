import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Archive, Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef, useState } from "react";

type Teacher = {
  id: number; // internal numeric id
  schoolId?: string; // school ID like "25-1234" (new)
  name: string;
  email: string;
  subjects: string[]; // assigned subjects
  specialization?: string; // primary specialization (e.g. "Filipino")
  status?: "Active" | "Inactive";
  facultyStatus?: "Full-Time" | "Part-Time";
  advisoryClasses?: string[]; // advisory classes (can be multiple across SHS and TESDA)
};

const existingClassSections = [
  "Grade 11 - STEM 1",
  "Grade 11 - STEM 2",
  "Grade 11 - ABM 1",
  "Grade 12 - HUMSS 1",
  "Grade 12 - ABM 2",
  "TESDA - HVAC Cohort A",
  "TESDA - Welding Cohort B",
];

const allSubjects = [
  "Mathematics",
  "Statistics",
  "English",
  "Literature",
  "Science",
  "Biology",
  "Chemistry",
  "Physics",
  "History",
  "Social Studies",
  "Filipino",
  "Computer Science",
];

// units per subject (used to compute teacher units)
const subjectUnits: Record<string, number> = {
  Mathematics: 3,
  Statistics: 2,
  English: 3,
  Literature: 3,
  Science: 3,
  Biology: 3,
  Chemistry: 3,
  Physics: 3,
  History: 3,
  "Social Studies": 3,
  Filipino: 3,
  "Computer Science": 3,
};

const specializationToSubjects: Record<string, string[]> = {
  Mathematics: ["Mathematics", "Statistics"],
  English: ["English", "Literature"],
  Science: ["Science", "Biology", "Chemistry", "Physics"],
  History: ["History", "Social Studies"],
  Filipino: ["Filipino"],
  "Computer Science": ["Computer Science"],
  Biology: ["Biology"],
  Chemistry: ["Chemistry"],
  Physics: ["Physics"],
};

const initialTeachers: Teacher[] = [
  {
    id: 1,
    schoolId: "25-1001",
    name: "Carl Alfred Chan",
    email: "cachan@school.edu",
    specialization: "Mathematics",
    subjects: ["Mathematics"],
    status: "Active",
    facultyStatus: "Full-Time",
    advisoryClasses: ["Grade 11 - STEM 1"],
  },
  {
    id: 2,
    schoolId: "25-1002",
    name: "Sergs Erl Fulay",
    email: "sefulay@school.edu",
    specialization: "English",
    subjects: ["English"],
    status: "Active",
    facultyStatus: "Part-Time",
    advisoryClasses: ["Grade 12 - HUMSS 1"],
  },
  {
    id: 3,
    schoolId: "25-1003",
    name: "Christian Jose Mendegorin",
    email: "cjmendegorin@school.edu",
    specialization: "Physics",
    subjects: ["Physics"],
    status: "Active",
    facultyStatus: "Full-Time",
    advisoryClasses: [],
  },
  {
    id: 4,
    schoolId: "25-1004",
    name: "Joy Siocon",
    email: "jsiocon@school.edu",
    specialization: "Chemistry",
    subjects: ["Chemistry"],
    status: "Active",
    facultyStatus: "Full-Time",
    advisoryClasses: ["TESDA - HVAC Cohort A"],
  },
  {
    id: 5,
    schoolId: "25-1005",
    name: "Christine Salve Demetillo",
    email: "csdemetillo@school.edu",
    specialization: "Biology",
    subjects: ["Biology"],
    status: "Inactive",
    facultyStatus: "Part-Time",
    advisoryClasses: [],
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const TeachersCSVHeader = [
  "id",
  "schoolId",
  "name",
  "email",
  "specialization",
  "subjects", // semicolon-separated
  "status",
  "facultyStatus",
  "advisoryClasses", // semicolon-separated
];

const ManageTeachers = () => {
  const [query, setQuery] = useState("");
  // active (non-archived) teachers
  const [teachers, setTeachers] = useState<Teacher[]>(
    // move any initial inactive teachers to archived on startup
    () => initialTeachers.filter((t) => (t.status ?? "Active") === "Active")
  );
  // archived teachers (inactive)
  const [archivedTeachers, setArchivedTeachers] = useState<Teacher[]>(
    () => initialTeachers.filter((t) => (t.status ?? "Active") === "Inactive")
  );

  // modal state & form fields
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formSchoolId, setFormSchoolId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formSpecialization, setFormSpecialization] = useState<string | "">("");
  const [formSubjects, setFormSubjects] = useState<string[]>([]);
  const [allowOtherSpecializations, setAllowOtherSpecializations] = useState(false);
  const [allowedOtherSpecs, setAllowedOtherSpecs] = useState<string[]>([]);
  const [formFacultyStatus, setFormFacultyStatus] = useState<Teacher["facultyStatus"]>("Full-Time");

  // filtering & grouping state
  const [filterSpecialization, setFilterSpecialization] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterFaculty, setFilterFaculty] = useState<string>("");
  const [groupBy, setGroupBy] = useState<"none" | "specialization" | "faculty" | "status">("none");
  const [viewArchives, setViewArchives] = useState(false);

  // pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]); // default 10

  // import file input ref
  const importInputRef = useRef<HTMLInputElement | null>(null);

  // advisory autocomplete states
  const [formAdvisoryInput, setFormAdvisoryInput] = useState("");
  const [formAdvisoryClasses, setFormAdvisoryClasses] = useState<string[]>([]);
  const [suggestionsVisible, setSuggestionsVisible] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const suggestionRef = useRef<HTMLDivElement | null>(null);
  const advisoryInputRef = useRef<HTMLInputElement | null>(null);

  const specializations = useMemo(() => Object.keys(specializationToSubjects), []);

  // Reset page when filters/search/viewArchives or pageSize change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterSpecialization, filterStatus, filterFaculty, viewArchives, pageSize]);

  useEffect(() => {
    // click outside to hide suggestions
    const onDocClick = (e: MouseEvent) => {
      if (!suggestionRef.current) return;
      if (
        !suggestionRef.current.contains(e.target as Node) &&
        advisoryInputRef.current &&
        !advisoryInputRef.current.contains(e.target as Node)
      ) {
        setSuggestionsVisible(false);
      }
    };
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, []);

  // advisory input suggestions logic
  useEffect(() => {
    const q = formAdvisoryInput.trim().toLowerCase();
    if (!q) {
      setSuggestions([]);
      setSuggestionsVisible(false);
      return;
    }
    const matches = existingClassSections
      .filter((c) => c.toLowerCase().includes(q) && !formAdvisoryClasses.includes(c))
      .slice(0, 8);
    setSuggestions(matches);
    setSuggestionsVisible(matches.length > 0);
  }, [formAdvisoryInput, formAdvisoryClasses]);

  // combined search + filters (applies to either active list or archives depending on viewArchives)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = viewArchives ? archivedTeachers : teachers;
    return source.filter((t) => {
      // search match
      const searchMatch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.email.toLowerCase().includes(q) ||
        t.subjects.join(" ").toLowerCase().includes(q) ||
        (t.advisoryClasses ?? []).join(" ").toLowerCase().includes(q) ||
        (t.specialization ?? "").toLowerCase().includes(q) ||
        (t.schoolId ?? "").toLowerCase().includes(q) ||
        String(t.id).includes(q);

      // filters
      const specializationMatch = !filterSpecialization || (t.specialization ?? "") === filterSpecialization;
      // status filter UI only presents Active/Inactive now.
      const statusMatch = !filterStatus || (t.status ?? "") === filterStatus;
      const facultyMatch = !filterFaculty || (t.facultyStatus ?? "") === filterFaculty;

      return searchMatch && specializationMatch && statusMatch && facultyMatch;
    });
  }, [query, teachers, archivedTeachers, filterSpecialization, filterStatus, filterFaculty, viewArchives]);

  // pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // specialization subjects (primary)
  const specializationSubjects = useMemo(() => {
    if (!formSpecialization) return [];
    return specializationToSubjects[formSpecialization] ?? [];
  }, [formSpecialization]);

  // subjects from other specializations selected by the user
  const otherSpecs = useMemo(() => {
    return specializations.filter((s) => s !== formSpecialization);
  }, [specializations, formSpecialization]);

  const allowedOtherSubjects = useMemo(() => {
    if (!allowOtherSpecializations) return [];
    const merged = new Set<string>();
    for (const spec of allowedOtherSpecs) {
      const list = specializationToSubjects[spec] ?? [];
      list.forEach((s) => merged.add(s));
    }
    return Array.from(merged);
  }, [allowOtherSpecializations, allowedOtherSpecs]);

  const openAddModal = () => {
    setEditingId(null);
    setFormSchoolId("");
    setFormName("");
    setFormEmail("");
    setFormSpecialization("");
    setFormSubjects([]);
    setAllowOtherSpecializations(false);
    setAllowedOtherSpecs([]);
    setFormFacultyStatus("Full-Time");
    setFormAdvisoryInput("");
    setFormAdvisoryClasses([]);
    setModalOpen(true);
  };

  const openEditModal = (t: Teacher) => {
    // if editing an archived teacher, open modal but editing will operate on archive (allow restore/archive/permanent delete)
    setEditingId(t.id);
    setFormSchoolId(t.schoolId ?? "");
    setFormName(t.name);
    setFormEmail(t.email);
    setFormSpecialization(t.specialization ?? "");
    setFormSubjects(t.subjects ?? []);
    setFormFacultyStatus(t.facultyStatus ?? "Full-Time");
    setFormAdvisoryClasses(t.advisoryClasses ?? []);
    // determine if teacher has subjects from other specializations and pre-select those specs
    const spec = t.specialization;
    if (spec) {
      const specSubs = specializationToSubjects[spec] ?? [];
      const nonSpecSubjects = t.subjects.filter((s) => !specSubs.includes(s));
      const specsContainingNonSpec = new Set<string>();
      nonSpecSubjects.forEach((ns) => {
        for (const [sp, subs] of Object.entries(specializationToSubjects)) {
          if (sp === spec) continue;
          if (subs.includes(ns)) specsContainingNonSpec.add(sp);
        }
      });
      setAllowOtherSpecializations(specsContainingNonSpec.size > 0);
      setAllowedOtherSpecs(Array.from(specsContainingNonSpec));
    } else {
      setAllowOtherSpecializations(false);
      setAllowedOtherSpecs([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSuggestionsVisible(false);
  };

  // helpers to archive / restore / permanently delete
  const archiveTeacher = (id: number) => {
    if (!confirm("Archive this teacher? Archived teachers are removed from the main list and stored in Archives.")) return;
    setTeachers((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev;
      const archived = { ...t, status: "Inactive" as Teacher["status"] };
      setArchivedTeachers((a) => [archived, ...a]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const permanentlyDeleteFromArchive = (id: number) => {
    if (!confirm("Permanently delete this archived teacher? This cannot be undone.")) return;
    setArchivedTeachers((prev) => prev.filter((t) => t.id !== id));
  };

  const restoreFromArchive = (id: number) => {
    setArchivedTeachers((prev) => {
      const t = prev.find((x) => x.id === id);
      if (!t) return prev;
      const restored = { ...t, status: "Active" as Teacher["status"] };
      setTeachers((a) => [restored, ...a]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const saveTeacher = () => {
    if (!formName.trim() || !formEmail.trim() || formSubjects.length === 0) {
      alert("Please provide name, email and at least one assigned subject.");
      return;
    }
    const isEditing = editingId != null;
    if (isEditing) {
      // update active list if present
      setTeachers((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                schoolId: formSchoolId.trim() || undefined,
                name: formName.trim(),
                email: formEmail.trim(),
                specialization: formSpecialization || undefined,
                subjects: formSubjects,
                facultyStatus: formFacultyStatus,
                advisoryClasses: formAdvisoryClasses,
              }
            : t
        )
      );

      // also update archived record if present (do not change status here)
      setArchivedTeachers((prev) =>
        prev.map((t) =>
          t.id === editingId
            ? {
                ...t,
                schoolId: formSchoolId.trim() || undefined,
                name: formName.trim(),
                email: formEmail.trim(),
                specialization: formSpecialization || undefined,
                subjects: formSubjects,
                facultyStatus: formFacultyStatus,
                advisoryClasses: formAdvisoryClasses,
              }
            : t
        )
      );
    } else {
      // creating new teacher always defaults to Active; archiving done via Archive button
      const newTeacher: Teacher = {
        id: Date.now(),
        schoolId: formSchoolId.trim() || undefined,
        name: formName.trim(),
        email: formEmail.trim(),
        specialization: formSpecialization || undefined,
        subjects: formSubjects,
        status: "Active",
        facultyStatus: formFacultyStatus,
        advisoryClasses: formAdvisoryClasses,
      };

      setTeachers((prev) => [newTeacher, ...prev]);
    }

    closeModal();
  };

  const toggleSubjectInForm = (subject: string) => {
    setFormSubjects((prev) => (prev.includes(subject) ? prev.filter((s) => s !== subject) : [...prev, subject]));
  };

  const toggleAllowedOtherSpec = (spec: string) => {
    setAllowedOtherSpecs((prev) => (prev.includes(spec) ? prev.filter((s) => s !== spec) : [...prev, spec]));
  };

  // helper to compute total units for a teacher
  const totalUnits = (subjects: string[]) => {
    return subjects.reduce((acc, s) => acc + (subjectUnits[s] ?? 0), 0);
  };

  // helpers to render badges for subjects (color-coded)
  const renderSubjectBadge = (subject: string, primarySpec?: string, allowedSpecs: string[] = []) => {
    const belongsToPrimary = primarySpec ? (specializationToSubjects[primarySpec] ?? []).includes(subject) : false;
    const belongsToOtherAllowed = allowedSpecs.some((spec) => (specializationToSubjects[spec] ?? []).includes(subject));

    const base = "inline-flex items-center gap-2 px-2 py-0.5 rounded text-sm";
    if (belongsToPrimary) {
      return (
        <Badge key={subject} className={`${base} bg-emerald-600 text-white`}>
          <span>{subject}</span>
          <span className="ml-2 text-xs opacity-80">{subjectUnits[subject] ?? 0}u</span>
        </Badge>
      );
    }
    if (belongsToOtherAllowed) {
      return (
        <Badge key={subject} className={`${base} bg-sky-600 text-white`}>
          <span>{subject}</span>
          <span className="ml-2 text-xs opacity-80">{subjectUnits[subject] ?? 0}u</span>
        </Badge>
      );
    }
    return (
      <Badge key={subject} className={`${base} bg-muted text-muted-foreground`}>
        <span>{subject}</span>
        <span className="ml-2 text-xs opacity-80">{subjectUnits[subject] ?? 0}u</span>
      </Badge>
    );
  };

  const addAdvisoryClass = (value?: string) => {
    const v = (value ?? formAdvisoryInput).trim();
    if (!v) return;
    if (!formAdvisoryClasses.includes(v)) {
      setFormAdvisoryClasses((p) => [...p, v]);
    }
    setFormAdvisoryInput("");
    setSuggestionsVisible(false);
  };

  const removeAdvisoryClass = (c: string) => {
    setFormAdvisoryClasses((p) => p.filter((x) => x !== c));
  };

  // keyboard: Enter to select first suggestion or add exact input
  const onAdvisoryKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions.length > 0) {
        addAdvisoryClass(suggestions[0]);
      } else {
        addAdvisoryClass(formAdvisoryInput);
      }
    } else if (e.key === "ArrowDown") {
      const first = suggestionRef.current?.querySelector<HTMLButtonElement>("button[data-suggestion-index='0']");
      first?.focus();
    }
  };

  const resetFilters = () => {
    setFilterSpecialization("");
    setFilterStatus("");
    setFilterFaculty("");
    setGroupBy("none");
    setQuery("");
    setCurrentPage(1);
    setPageSize(PAGE_SIZE_OPTIONS[0]);
  };

  // CSV/Excel export helpers -------------------------------------------------
  const escapeCsv = (value: string | number | undefined) => {
    if (value === undefined || value === null) return "";
    const s = String(value);
    // if contains comma, newline or quote wrap in quotes and escape quotes
    if (/[",\n\r]/.test(s)) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const exportToCSV = (useArchives = false) => {
    const source = useArchives ? archivedTeachers : teachers;
    const rows = [TeachersCSVHeader.join(",")];
    for (const t of source) {
      const subjects = (t.subjects ?? []).join(";");
      const advisory = (t.advisoryClasses ?? []).join(";");
      const row = [
        escapeCsv(t.id),
        escapeCsv(t.schoolId),
        escapeCsv(t.name),
        escapeCsv(t.email),
        escapeCsv(t.specialization),
        escapeCsv(subjects),
        escapeCsv(t.status),
        escapeCsv(t.facultyStatus),
        escapeCsv(advisory),
      ].join(",");
      rows.push(row);
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teachers${useArchives ? "-archives" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Attempt to export XLSX using sheetjs if available, otherwise fallback to CSV
  const exportToExcel = async (useArchives = false) => {
    try {
      // dynamic import to avoid forcing dependency; works if 'xlsx' is installed
      // npm install xlsx
      // TSX typings not enforced here; if xlsx isn't available, fallback to CSV
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const XLSX = await import("xlsx");
      const source = useArchives ? archivedTeachers : teachers;
      const wsData = [
        TeachersCSVHeader,
        ...source.map((t) => [
          t.id,
          t.schoolId ?? "",
          t.name,
          t.email,
          t.specialization ?? "",
          (t.subjects ?? []).join(";"),
          t.status ?? "",
          t.facultyStatus ?? "",
          (t.advisoryClasses ?? []).join(";"),
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Teachers");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teachers${useArchives ? "-archives" : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      // fallback
      exportToCSV(useArchives);
    }
  };

  // CSV parsing (handles quoted fields and semicolon-separated subfields)
  const parseCSVText = (text: string) => {
    const rows: string[][] = [];
    let i = 0;
    const len = text.length;
    let field = "";
    let row: string[] = [];
    let inQuotes = false;

    while (i < len) {
      const ch = text[i];

      if (inQuotes) {
        if (ch === '"') {
          // peek next char
          if (i + 1 < len && text[i + 1] === '"') {
            // escaped quote
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
          // ignore, handle on \n
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
    // push last field
    if (field !== "" || inQuotes || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  };

  const normalizeImportedTeacher = (raw: Record<string, string>) => {
    const subjects = (raw["subjects"] ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    const advisory = (raw["advisoryClasses"] ?? raw["advisory"] ?? "").split(";").map((s) => s.trim()).filter(Boolean);
    const id = raw["id"] ? Number(raw["id"]) : Date.now() + Math.floor(Math.random() * 1000);
    const t: Teacher = {
      id,
      schoolId: raw["schoolId"]?.trim() || undefined,
      name: raw["name"]?.trim() || "",
      email: raw["email"]?.trim() || "",
      specialization: raw["specialization"]?.trim() || undefined,
      subjects,
      status: (raw["status"] === "Inactive" ? "Inactive" : "Active"),
      facultyStatus: (raw["facultyStatus"] === "Part-Time" ? "Part-Time" : "Full-Time"),
      advisoryClasses: advisory,
    };
    return t;
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      // try to use xlsx if available
      try {
        // dynamic import
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        // transform json rows to Teacher
        const imported: Teacher[] = json.map((row) => {
          const raw: Record<string, string> = {};
          for (const k of Object.keys(row)) {
            raw[String(k).trim()] = String(row[k] ?? "");
          }
          return normalizeImportedTeacher(raw);
        });
        mergeImportedTeachers(imported);
      } catch (e) {
        alert("Unable to parse Excel file because 'xlsx' is not available. Please install 'xlsx' or use CSV import.");
      }
    } else {
      // assume CSV / text
      const text = await file.text();
      const rows = parseCSVText(text);
      if (rows.length === 0) {
        alert("Empty or invalid CSV file.");
        return;
      }
      // treat first row as header
      const header = rows[0].map((h) => h.trim());
      const dataRows = rows.slice(1);
      const imported: Teacher[] = dataRows.map((r) => {
        const raw: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) {
          raw[header[i]] = r[i] ?? "";
        }
        return normalizeImportedTeacher(raw);
      });
      mergeImportedTeachers(imported);
    }
    // reset input
    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  // Merge behavior:
  // - If imported teacher id exists in active list -> update that record
  // - Else if exists in archived -> update archived
  // - Else insert into active if status === Active, or archives if Inactive
  const mergeImportedTeachers = (imported: Teacher[]) => {
    setTeachers((prevActive) => {
      const activeMap = new Map(prevActive.map((t) => [t.id, t]));
      const archivedMap = new Map(archivedTeachers.map((t) => [t.id, t]));

      const newActive = [...prevActive];
      const newArchived = [...archivedTeachers];

      for (const it of imported) {
        if (activeMap.has(it.id)) {
          // update active
          const idx = newActive.findIndex((t) => t.id === it.id);
          if (idx >= 0) {
            if (it.status === "Inactive") {
              // move to archived
              newArchived.unshift({ ...it, status: "Inactive" });
              newActive.splice(idx, 1);
            } else {
              newActive[idx] = it;
            }
          }
        } else if (archivedMap.has(it.id)) {
          // update archived
          const idx = newArchived.findIndex((t) => t.id === it.id);
          if (idx >= 0) {
            if (it.status === "Active") {
              newActive.unshift({ ...it, status: "Active" });
              newArchived.splice(idx, 1);
            } else {
              newArchived[idx] = it;
            }
          }
        } else {
          // new record
          if (it.status === "Inactive") {
            newArchived.unshift(it);
          } else {
            newActive.unshift(it);
          }
        }
      }

      // apply archived changes
      setArchivedTeachers(newArchived);
      return newActive;
    });
    // After import reset to first page and show active list
    setViewArchives(false);
    setCurrentPage(1);
  };

  // Trigger file picker
  const onImportClick = () => {
    importInputRef.current?.click();
  };

  // helper to render a single teacher row (keeps code DRY)
  const renderTeacherRow = (t: Teacher) => (
    <tr key={t.id} className="border-t last:border-b hover:bg-muted/50 transition-colors">
      <td className="py-6 pr-6 font-medium">{t.id}</td>
      <td className="py-6 pr-6 text-muted-foreground">{t.schoolId ?? "—"}</td>
      <td className="py-6 pr-6 font-medium">{t.name}</td>
      <td className="py-6 pr-6 text-muted-foreground">{t.specialization ?? "—"}</td>
      <td className="py-6 pr-6 text-muted-foreground">{t.email}</td>
      <td className="py-6 pr-6">
        <div className="flex flex-wrap gap-2">
          {t.subjects.map((sub) =>
            renderSubjectBadge(
              sub,
              t.specialization,
              Object.keys(specializationToSubjects).filter(
                (spec) => spec !== t.specialization && (specializationToSubjects[spec] ?? []).includes(sub)
              )
            )
          )}
        </div>
      </td>
      <td className="py-6 pr-6 font-medium">{totalUnits(t.subjects)}</td>
      <td className="py-6 pr-6">
        <Badge className={`text-xs ${t.facultyStatus === "Full-Time" ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}`}>
          {t.facultyStatus ?? "—"}
        </Badge>
      </td>
      <td className="py-6 pr-6">
        <div className="flex flex-wrap gap-2">
          {(t.advisoryClasses ?? []).length > 0 ? (
            (t.advisoryClasses ?? []).map((c) => (
              <Badge key={c} className="bg-muted text-muted-foreground text-xs">
                {c}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="py-6 pl-6 text-right">
        <div className="flex items-center justify-end gap-3">
          <button
            aria-label="edit"
            onClick={() => openEditModal(t)}
            className="p-2 rounded-lg border border-muted/60 hover:border-primary/80 transition-colors"
            title="Edit teacher"
          >
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>

          {viewArchives ? (
            // In archives view: allow restore or permanent delete
            <>
              <button
                aria-label="restore"
                onClick={() => restoreFromArchive(t.id)}
                className="p-2 rounded-lg border border-muted/60 hover:border-primary/80 transition-colors"
                title="Restore teacher"
              >
                <Archive className="h-4 w-4" />
              </button>
              <button
                aria-label="delete-permanent"
                onClick={() => permanentlyDeleteFromArchive(t.id)}
                className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors"
                title="Delete permanently"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            // In main view: archive action (instead of delete)
            <button
              aria-label="archive"
              onClick={() => archiveTeacher(t.id)}
              className="p-2 rounded-lg text-amber-600 hover:bg-amber-600/10 transition-colors"
              title="Archive teacher"
            >
              <Archive className="h-4 w-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );

  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-1">All Teachers</h1>
            <p className="text-muted-foreground">A list of all teachers in your school</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search teachers..."
                className="pl-9 pr-4 w-80"
              />
            </div>

            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>

            <Button variant={viewArchives ? "default" : "ghost"} onClick={() => setViewArchives((v) => !v)}>
              {viewArchives ? "Viewing: Archives" : "View Archives"}
            </Button>

            {/* Import / Export */}
            <input
              ref={importInputRef}
              type="file"
              accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
              onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)}
              style={{ display: "none" }}
            />
            <Button variant="ghost" onClick={onImportClick}>
              <Upload className="h-4 w-4 mr-2" />
              Import
            </Button>

            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => exportToCSV(viewArchives)}>
                <Download className="h-4 w-4 mr-2" />
                Export CSV
              </Button>
              <Button variant="ghost" onClick={() => exportToExcel(viewArchives)}>
                <Download className="h-4 w-4 mr-2" />
                Export Excel
              </Button>
            </div>
          </div>
        </div>

        {/* Filters & Grouping Controls */}
        <div className="flex items-center gap-3">
          <select
            value={filterSpecialization}
            onChange={(e) => setFilterSpecialization(e.target.value)}
            className="border rounded px-3 py-2"
          >
            <option value="">All specializations</option>
            {specializations.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded px-3 py-2">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select value={filterFaculty} onChange={(e) => setFilterFaculty(e.target.value)} className="border rounded px-3 py-2">
            <option value="">All faculty types</option>
            <option value="Full-Time">Full-Time</option>
            <option value="Part-Time">Part-Time</option>
          </select>

          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "none" | "specialization" | "faculty" | "status")} className="border rounded px-3 py-2">
            <option value="none">Group: None</option>
            <option value="specialization">Group: Specialization</option>
            <option value="faculty">Group: Faculty status</option>
            <option value="status">Group: Status</option>
          </select>

          <Button variant="ghost" onClick={resetFilters}>
            Reset filters
          </Button>

          <div className="ml-auto text-sm text-muted-foreground">
            Showing {filtered.length === 0 ? 0 : Math.min((currentPage - 1) * pageSize + 1, filtered.length)} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} entries
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{viewArchives ? "Archives" : "Teachers"}</CardTitle>
            <CardDescription>{viewArchives ? "Archived teachers (inactive). You can restore or permanently delete here." : "Manage teacher records."}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left py-4 pr-6 font-medium">ID</th>
                    <th className="text-left py-4 pr-6 font-medium">School ID</th>
                    <th className="text-left py-4 pr-6 font-medium">Name</th>
                    <th className="text-left py-4 pr-6 font-medium">Specialization</th>
                    <th className="text-left py-4 pr-6 font-medium">Email</th>
                    <th className="text-left py-4 pr-6 font-medium">Subjects</th>
                    <th className="text-left py-4 pr-6 font-medium">Units</th>
                    <th className="text-left py-4 pr-6 font-medium">Faculty</th>
                    <th className="text-left py-4 pr-6 font-medium">Advisory</th>
                    <th className="text-right py-4 pl-6 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.length > 0 ? (
                    groupBy === "none" ? (
                      // flat paginated list
                      paginated.map((t) => renderTeacherRow(t))
                    ) : (
                      // grouped view but applied to the paginated subset
                      (() => {
                        const groups = new Map<string, Teacher[]>();
                        for (const t of paginated) {
                          let key = "";
                          if (groupBy === "specialization") key = t.specialization ?? "Unspecified";
                          else if (groupBy === "faculty") key = t.facultyStatus ?? "Unspecified";
                          else if (groupBy === "status") key = t.status ?? "Unspecified";
                          else key = "Others";
                          const arr = groups.get(key) ?? [];
                          arr.push(t);
                          groups.set(key, arr);
                        }
                        const entries = Array.from(groups.entries()).sort((a, b) => {
                          if (a[0] === "Unspecified") return 1;
                          if (b[0] === "Unspecified") return -1;
                          return a[0].localeCompare(b[0]);
                        });

                        return entries.flatMap(([groupName, list]) => {
                          return [
                            <tr key={`group-${groupName}`} className="bg-accent/5">
                              <td colSpan={10} className="py-3 font-semibold">
                                {groupName} <span className="text-sm text-muted-foreground">({list.length})</span>
                              </td>
                            </tr>,
                            ...list.map((t) => renderTeacherRow(t)),
                          ];
                        });
                      })()
                    )
                  ) : (
                    <tr>
                      <td colSpan={10} className="py-10 text-center text-sm text-muted-foreground">
                        No teachers found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Page {Math.min(currentPage, totalPages)} of {totalPages}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                  Previous
                </Button>
                <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>
                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                  Next
                </Button>

                {/* Moved "Show entries" selector next to the pagination (like in ManageSubjects) */}
                <div className="flex items-center gap-2 ml-4">
                  <label className="text-sm">Show</label>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setPageSize(v);
                      setCurrentPage(1); // reset to first page when page size changes
                    }}
                    className="border rounded px-2 py-1"
                    aria-label="Select number of entries per page"
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
      </div>

      {/* Modal for add/edit */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
          {/* modal panel scrollable to avoid content being hidden */}
          <div className="relative z-10 w-11/12 max-w-lg bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit Teacher" : "Add Teacher"}</h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">School ID (e.g. 25-1234)</label>
                <Input value={formSchoolId} onChange={(e) => setFormSchoolId(e.target.value)} placeholder="25-1234" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Dr. Jane Doe" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1">Email</label>
                  <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@school.edu" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Specialization</label>
                <select
                  value={formSpecialization}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormSpecialization(val || "");
                    const allowed = val ? specializationToSubjects[val] ?? [] : [];
                    setFormSubjects((prev) => (val && !allowOtherSpecializations ? prev.filter((s) => allowed.includes(s)) : prev));
                  }}
                  className="w-full border rounded px-3 py-2"
                >
                  <option value="">-- none --</option>
                  {specializations.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Faculty status</label>
                  <select value={formFacultyStatus} onChange={(e) => setFormFacultyStatus(e.target.value as Teacher["facultyStatus"])} className="w-full border rounded px-3 py-2">
                    <option value="Full-Time">Full-Time</option>
                    <option value="Part-Time">Part-Time</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Advisory classes</label>
                <div className="relative">
                  <div className="flex gap-2 mb-2">
                    <input
                      ref={advisoryInputRef}
                      value={formAdvisoryInput}
                      onChange={(e) => setFormAdvisoryInput(e.target.value)}
                      onKeyDown={onAdvisoryKeyDown}
                      placeholder="Type to search existing class/section or add a new one"
                      className="w-full border rounded px-3 py-2 bg-card"
                    />
                    <Button onClick={() => addAdvisoryClass()}>Add</Button>
                  </div>

                  {/* suggestions dropdown */}
                  {suggestionsVisible && suggestions.length > 0 && (
                    <div ref={suggestionRef} className="absolute left-0 right-0 z-20 bg-card border border-border rounded shadow max-h-40 overflow-auto">
                      <ul>
                        {suggestions.map((s, i) => (
                          <li key={s}>
                            <button data-suggestion-index={i} onClick={() => addAdvisoryClass(s)} className="w-full text-left px-3 py-2 hover:bg-muted/50">
                              {s}
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-2">
                  {formAdvisoryClasses.map((c) => (
                    <Badge key={c} className="flex items-center gap-2">
                      <span>{c}</span>
                      <button onClick={() => removeAdvisoryClass(c)} className="ml-1 text-xs opacity-80 hover:opacity-100">
                        ×
                      </button>
                    </Badge>
                  ))}
                  {formAdvisoryClasses.length === 0 && <div className="text-sm text-muted-foreground">No advisory classes assigned</div>}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id="allow-other-specs"
                    type="checkbox"
                    checked={allowOtherSpecializations}
                    onChange={(e) => {
                      setAllowOtherSpecializations(e.target.checked);
                      if (!e.target.checked) setAllowedOtherSpecs([]);
                    }}
                    className="h-4 w-4"
                  />
                  <label htmlFor="allow-other-specs" className="text-sm text-muted-foreground font-medium">
                    Allow assigning subjects from other specializations
                  </label>
                </div>

                {/* If enabled, let user pick which other specializations to allow */}
                {allowOtherSpecializations && (
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-1">Allowed other specializations</div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {otherSpecs.map((spec) => {
                        const checked = allowedOtherSpecs.includes(spec);
                        return (
                          <label key={spec} className="inline-flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={() => toggleAllowedOtherSpec(spec)} className="h-4 w-4" />
                            <span className="text-sm">{spec}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Assigned subjects</label>

                {/* Specialization subjects group */}
                {formSpecialization ? (
                  <div className="mb-3">
                    <div className="text-sm font-medium mb-1">Specialization subjects</div>
                    <div className="grid grid-cols-2 gap-2">
                      {(specializationToSubjects[formSpecialization] ?? []).map((sub) => {
                        const checked = formSubjects.includes(sub);
                        return (
                          <label key={sub} className="inline-flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={checked} onChange={() => toggleSubjectInForm(sub)} className="h-4 w-4" />
                            <span className="text-sm">{sub}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{subjectUnits[sub] ?? 0}u</span>
                            <span className="ml-auto">
                              <Badge className="bg-emerald-600 text-white text-xs">primary</Badge>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                {/* Other specializations' subjects (grouped by specialization) */}
                {allowOtherSpecializations && allowedOtherSpecs.length > 0 && (
                  <div>
                    <div className="text-sm font-medium mb-1">Subjects from allowed other specializations</div>
                    <div className="space-y-3 border rounded p-2 max-h-48 overflow-auto">
                      {allowedOtherSpecs.map((spec) => (
                        <div key={spec}>
                          <div className="text-sm font-medium mb-1">{spec}</div>
                          <div className="grid grid-cols-2 gap-2">
                            {(specializationToSubjects[spec] ?? []).map((sub) => {
                              const checked = formSubjects.includes(sub);
                              return (
                                <label key={sub} className="inline-flex items-center gap-2 cursor-pointer">
                                  <input type="checkbox" checked={checked} onChange={() => toggleSubjectInForm(sub)} className="h-4 w-4" />
                                  <span className="text-sm">{sub}</span>
                                  <span className="ml-2 text-xs text-muted-foreground">{subjectUnits[sub] ?? 0}u</span>
                                  <span className="ml-auto">
                                    <Badge className="bg-sky-600 text-white text-xs">cross</Badge>
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* If no specialization selected and other allowed, show all subjects */}
                {!formSpecialization && allowOtherSpecializations && (
                  <div className="mt-3 grid grid-cols-2 gap-2 border rounded p-2 max-h-48 overflow-auto">
                    {allSubjects.map((sub) => {
                      const checked = formSubjects.includes(sub);
                      return (
                        <label key={sub} className="inline-flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={checked} onChange={() => toggleSubjectInForm(sub)} className="h-4 w-4" />
                          <span className="text-sm">{sub}</span>
                          <span className="ml-2 text-xs text-muted-foreground">{subjectUnits[sub] ?? 0}u</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={closeModal}>
                    Cancel
                  </Button>
                  <Button onClick={saveTeacher}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2z" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7V3" />
                    </svg>
                    Save
                  </Button>
                </div>

                {/* Instead of immediate delete, show Archive button for active teachers or permanent delete/restore for archived */}
                {editingId && (
                  <>
                    {viewArchives || archivedTeachers.some((t) => t.id === editingId) ? (
                      <div className="flex gap-2">
                        <Button variant="default" onClick={() => restoreFromArchive(editingId)}>
                          <Archive className="h-4 w-4 mr-2" />
                          Restore
                        </Button>
                        <Button variant="destructive" onClick={() => permanentlyDeleteFromArchive(editingId)}>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete permanently
                        </Button>
                      </div>
                    ) : (
                      <Button variant="destructive" onClick={() => editingId && archiveTeacher(editingId)}>
                        <Archive className="h-4 w-4 mr-2" />
                        Archive
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ManageTeachers;