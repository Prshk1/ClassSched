import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, Edit, Trash2, Archive, Download, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useEffect, useMemo, useRef, useState } from "react";

type Administrator = {
  id: number;
  employeeId?: string; // e.g. "EMP-001"
  name: string;
  email: string;
  role?: "Administrator";
  permissions: string[]; // visible permission labels
  status?: "Active" | "Inactive";
  lastLogin?: string; // ISO string (optional)
  twoFactor?: boolean;
};

const allPermissions = [
  "Dashboard",
  "Schedule Builder",
  "Manage Teachers",
  "Manage Administrators",
  "Manage Sections",
  "Manage Subjects",
  "Manage Rooms",
  "View Schedule",
  "Reports",
];

// Default permissions to be CHECKED when role = Administrator
const defaultAdminPermissions = ["Dashboard", "Schedule Builder", "View Schedule", "Reports"];

const initialAdmins: Administrator[] = [
  {
    id: 101,
    employeeId: "25-0001",
    name: "Christine Salve Demetillo",
    email: "csdemetillo@school.edu",
    role: "Administrator",
    permissions: allPermissions.slice(),
    status: "Active",
    lastLogin: "2025-12-10T08:22:00Z",
    twoFactor: true,
  },
  {
    id: 102,
    employeeId: "EMP-1002",
    name: "Ethel Jacamile",
    email: "ejacamile@school.edu",
    role: "Administrator",
    permissions: defaultAdminPermissions.slice(),
    status: "Active",
    lastLogin: "2025-12-11T10:05:00Z",
    twoFactor: false,
  },
  {
    id: 103,
    employeeId: "EMP-1003",
    name: "Rogelio Cruz",
    email: "rogelio.cruz@school.edu",
    role: "Administrator",
    permissions: ["Dashboard"],
    status: "Inactive",
    lastLogin: "2025-11-21T14:40:00Z",
    twoFactor: false,
  },
];

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const AdminsCSVHeader = [
  "id",
  "employeeId",
  "name",
  "email",
  "role",
  "permissions", // semicolon-separated
  "status",
  "lastLogin",
  "twoFactor",
];

const ManageAdministrators = () => {
  const [query, setQuery] = useState("");
  const [admins, setAdmins] = useState<Administrator[]>(
    () => initialAdmins.filter((a) => (a.status ?? "Active") === "Active")
  );
  const [archivedAdmins, setArchivedAdmins] = useState<Administrator[]>(
    () => initialAdmins.filter((a) => (a.status ?? "Active") === "Inactive")
  );

  // modal & form
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formEmployeeId, setFormEmployeeId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formRole, setFormRole] = useState<Administrator["role"] | "">("");
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  

  const importInputRef = useRef<HTMLInputElement | null>(null);

  // roles (only Administrator supported)
  const roles = useMemo(() => ["Administrator"] as const, []);

  // filters / grouping
  const [filterRole, setFilterRole] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [groupBy, setGroupBy] = useState<"none" | "role" | "status">("none");
  const [viewArchives, setViewArchives] = useState(false);

  // pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  useEffect(() => {
    setCurrentPage(1);
  }, [query, filterRole, filterStatus, viewArchives, pageSize]);

  // When role changes in the form:
  // - Administrator => defaultAdminPermissions are CHECKED by default
  // - none => leave whatever user has selected (or empty)
  useEffect(() => {
    if (formRole === "Administrator") {
      // set defaults explicitly (not preserving previous selection) as requested
      setFormPermissions(defaultAdminPermissions.slice());
    } else {
      // no role selected: do not automatically set permissions
      setFormPermissions([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formRole]);

  // combined search + filters
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const source = viewArchives ? archivedAdmins : admins;
    return source.filter((a) => {
      const searchMatch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        a.email.toLowerCase().includes(q) ||
        (a.role ?? "").toLowerCase().includes(q) ||
        (a.employeeId ?? "").toLowerCase().includes(q) ||
        String(a.id).includes(q);

      const roleMatch = !filterRole || (a.role ?? "") === filterRole;
      const statusMatch = !filterStatus || (a.status ?? "") === filterStatus;

      return searchMatch && roleMatch && statusMatch;
    });
  }, [query, admins, archivedAdmins, filterRole, filterStatus, viewArchives]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // modal open/close
  const openAddModal = () => {
    setEditingId(null);
    setFormEmployeeId("");
    setFormName("");
    setFormEmail("");
    setFormRole("");
    setFormPermissions([]); // empty until role selected
    setModalOpen(true);
  };

  const openEditModal = (a: Administrator) => {
    setEditingId(a.id);
    setFormEmployeeId(a.employeeId ?? "");
    setFormName(a.name);
    setFormEmail(a.email);
    setFormRole(a.role ?? "");
    // if editing existing admin, start with their saved permissions (role-specific defaults will apply)
    setFormPermissions(Array.from(new Set([...(a.permissions ?? [])])));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  // archive / restore / delete
  const archiveAdmin = (id: number) => {
    if (!confirm("Archive this administrator? Archived administrators are removed from the main list.")) return;
    setAdmins((prev) => {
      const a = prev.find((x) => x.id === id);
      if (!a) return prev;
      const archived = { ...a, status: "Inactive" as Administrator["status"] };
      setArchivedAdmins((ar) => [archived, ...ar]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const permanentlyDeleteFromArchive = (id: number) => {
    if (!confirm("Permanently delete this archived administrator? This cannot be undone.")) return;
    setArchivedAdmins((prev) => prev.filter((a) => a.id !== id));
  };

  const restoreFromArchive = (id: number) => {
    setArchivedAdmins((prev) => {
      const a = prev.find((x) => x.id === id);
      if (!a) return prev;
      const restored = { ...a, status: "Active" as Administrator["status"] };
      setAdmins((ar) => [restored, ...ar]);
      return prev.filter((x) => x.id !== id);
    });
  };

  const togglePermissionInForm = (perm: string) => {
    // allow toggling permissions for Administrator or when no role selected
    setFormPermissions((prev) => (prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]));
  };

  const resetFilters = () => {
    setFilterRole("");
    setFilterStatus("");
    setGroupBy("none");
    setQuery("");
    setCurrentPage(1);
    setPageSize(PAGE_SIZE_OPTIONS[0]);
  };

  // CSV helpers
  const escapeCsv = (value: string | number | undefined) => {
    if (value === undefined || value === null) return "";
    const s = String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const exportToCSV = (useArchives = false) => {
    const source = useArchives ? archivedAdmins : admins;
    const rows = [AdminsCSVHeader.join(",")];
    for (const a of source) {
      const perms = (a.permissions ?? []).join(";");
      const row = [
        escapeCsv(a.id),
        escapeCsv(a.employeeId),
        escapeCsv(a.name),
        escapeCsv(a.email),
        escapeCsv(a.role),
        escapeCsv(perms),
        escapeCsv(a.status),
        escapeCsv(a.lastLogin),
        escapeCsv(a.twoFactor ? "true" : "false"),
      ].join(",");
      rows.push(row);
    }
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `administrators${useArchives ? "-archives" : ""}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportToExcel = async (useArchives = false) => {
    try {
      const XLSX = await import("xlsx");
      const source = useArchives ? archivedAdmins : admins;
      const wsData = [
        AdminsCSVHeader,
        ...source.map((a) => [
          a.id,
          a.employeeId ?? "",
          a.name,
          a.email,
          a.role ?? "",
          (a.permissions ?? []).join(";"),
          a.status ?? "",
          a.lastLogin ?? "",
          a.twoFactor ? "true" : "false",
        ]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Administrators");
      const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([buf], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `administrators${useArchives ? "-archives" : ""}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      exportToCSV(useArchives);
    }
  };

  // CSV parser reused (handles quoted fields)
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
          if (i + 1 < len && text[i + 1] === '"') {
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

    if (field !== "" || inQuotes || row.length > 0) {
      row.push(field);
      rows.push(row);
    }
    return rows;
  };

  const normalizeImportedAdmin = (raw: Record<string, string>) => {
    const permissions = (raw["permissions"] ?? "")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    const id = raw["id"] ? Number(raw["id"]) : Date.now() + Math.floor(Math.random() * 1000);
    const twoFactor = raw["twoFactor"] === "true" || raw["twoFactor"] === "1";
    // Map imported roles to Administrator (only Administrator supported)
    const chosen = permissions.length > 0 ? permissions : defaultAdminPermissions.slice();
    return {
      id,
      employeeId: raw["employeeId"]?.trim() || undefined,
      name: raw["name"]?.trim() || "",
      email: raw["email"]?.trim() || "",
      role: "Administrator",
      permissions: Array.from(new Set(chosen)),
      status: raw["status"] === "Inactive" ? "Inactive" : "Active",
      lastLogin: raw["lastLogin"]?.trim() || undefined,
      twoFactor,
    } as Administrator;
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
      try {
        const XLSX = await import("xlsx");
        const data = await file.arrayBuffer();
        const wb = XLSX.read(data, { type: "array" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
        const imported: Administrator[] = json.map((row) => {
          const raw: Record<string, string> = {};
          for (const k of Object.keys(row)) raw[String(k).trim()] = String(row[k] ?? "");
          return normalizeImportedAdmin(raw);
        });
        mergeImportedAdmins(imported);
      } catch (e) {
        alert("Unable to parse Excel file because 'xlsx' is not available. Please install 'xlsx' or use CSV import.");
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
      const imported: Administrator[] = dataRows.map((r) => {
        const raw: Record<string, string> = {};
        for (let i = 0; i < header.length; i++) raw[header[i]] = r[i] ?? "";
        return normalizeImportedAdmin(raw);
      });
      mergeImportedAdmins(imported);
    }

    if (importInputRef.current) importInputRef.current.value = "";
  };

  const mergeImportedAdmins = (imported: Administrator[]) => {
    setAdmins((prevActive) => {
      const activeMap = new Map(prevActive.map((a) => [a.id, a]));
      const archivedMap = new Map(archivedAdmins.map((a) => [a.id, a]));

      const newActive = [...prevActive];
      const newArchived = [...archivedAdmins];

      for (const ia of imported) {
        if (activeMap.has(ia.id)) {
          const idx = newActive.findIndex((a) => a.id === ia.id);
          if (idx >= 0) {
            if (ia.status === "Inactive") {
              newArchived.unshift({ ...ia, status: "Inactive" });
              newActive.splice(idx, 1);
            } else {
              newActive[idx] = ia;
            }
          }
        } else if (archivedMap.has(ia.id)) {
          const idx = newArchived.findIndex((a) => a.id === ia.id);
          if (idx >= 0) {
            if (ia.status === "Active") {
              newActive.unshift({ ...ia, status: "Active" });
              newArchived.splice(idx, 1);
            } else {
              newArchived[idx] = ia;
            }
          }
        } else {
          if (ia.status === "Inactive") newArchived.unshift(ia);
          else newActive.unshift(ia);
        }
      }

      setArchivedAdmins(newArchived);
      return newActive;
    });
    setViewArchives(false);
    setCurrentPage(1);
  };

  const onImportClick = () => importInputRef.current?.click();

  const saveAdmin = () => {
    if (!formName.trim() || !formEmail.trim()) {
      alert("Please provide name and email.");
      return;
    }

    let finalPermissions: string[] = [];
    if (formRole === "Administrator") {
      finalPermissions = formPermissions.length > 0 ? Array.from(new Set(formPermissions)) : defaultAdminPermissions.slice();
    } else {
      finalPermissions = Array.from(new Set(formPermissions));
    }

    const isEditing = editingId != null;
    if (isEditing) {
      setAdmins((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                employeeId: formEmployeeId.trim() || undefined,
                name: formName.trim(),
                email: formEmail.trim(),
                role: (formRole as Administrator["role"]) || undefined,
                permissions: finalPermissions,
              }
            : a
        )
      );

      setArchivedAdmins((prev) =>
        prev.map((a) =>
          a.id === editingId
            ? {
                ...a,
                employeeId: formEmployeeId.trim() || undefined,
                name: formName.trim(),
                email: formEmail.trim(),
                role: (formRole as Administrator["role"]) || undefined,
                permissions: finalPermissions,
              }
            : a
        )
      );
    } else {
      const newAdmin: Administrator = {
        id: Date.now(),
        employeeId: formEmployeeId.trim() || undefined,
        name: formName.trim(),
        email: formEmail.trim(),
        role: (formRole as Administrator["role"]) || undefined,
        permissions: finalPermissions,
        status: "Active",
      };

      setAdmins((prev) => [newAdmin, ...prev]);
    }

    closeModal();
  };

  const renderRoleBadge = (role?: string) => {
    const base = "inline-flex items-center gap-2 px-2 py-0.5 rounded text-sm";
    if (!role) return <Badge className={`${base} bg-muted text-muted-foreground`}>—</Badge>;
    return <Badge className={`${base} bg-sky-600 text-white`}>{role}</Badge>;
  };

  const renderAdminRow = (a: Administrator) => (
    <tr key={a.id} className="border-t last:border-b hover:bg-muted/50 transition-colors">
      <td className="py-6 pr-6 font-medium">{a.id}</td>
      <td className="py-6 pr-6 text-muted-foreground">{a.employeeId ?? "—"}</td>
      <td className="py-6 pr-6 font-medium">{a.name}</td>
      <td className="py-6 pr-6 text-muted-foreground">{renderRoleBadge(a.role)}</td>
      <td className="py-6 pr-6 text-muted-foreground">{a.email}</td>
      <td className="py-6 pr-6">
        <div className="flex flex-wrap gap-2">
          {(a.permissions ?? []).length === allPermissions.length ? (
            <Badge className="bg-emerald-600 text-white text-xs">All</Badge>
          ) : (a.permissions ?? []).length > 0 ? (
            (a.permissions ?? []).map((p) => (
              <Badge key={p} className="bg-muted text-muted-foreground text-xs">
                {p}
              </Badge>
            ))
          ) : (
            <span className="text-sm text-muted-foreground">—</span>
          )}
        </div>
      </td>
      <td className="py-6 pr-6 text-muted-foreground">{a.lastLogin ? new Date(a.lastLogin).toLocaleString() : "—"}</td>
      <td className="py-6 pr-6">
        <Badge className={`text-xs ${a.status === "Active" ? "bg-emerald-600 text-white" : "bg-muted text-muted-foreground"}`}>
          {a.status ?? "—"}
        </Badge>
      </td>
      <td className="py-6 pl-6 text-right">
        <div className="flex items-center justify-end gap-3">
          <button aria-label="edit" onClick={() => openEditModal(a)} className="p-2 rounded-lg border border-muted/60 hover:border-primary/80 transition-colors" title="Edit administrator">
            <Edit className="h-4 w-4 text-muted-foreground" />
          </button>

          {viewArchives ? (
            <>
              <button aria-label="restore" onClick={() => restoreFromArchive(a.id)} className="p-2 rounded-lg border border-muted/60 hover:border-primary/80 transition-colors" title="Restore administrator">
                <Archive className="h-4 w-4" />
              </button>
              <button aria-label="delete-permanent" onClick={() => permanentlyDeleteFromArchive(a.id)} className="p-2 rounded-lg text-destructive hover:bg-destructive/10 transition-colors" title="Delete permanently">
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          ) : (
            <button aria-label="archive" onClick={() => archiveAdmin(a.id)} className="p-2 rounded-lg text-amber-600 hover:bg-amber-600/10 transition-colors" title="Archive administrator">
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
            <h1 className="text-3xl font-bold mb-1">All Administrators</h1>
            <p className="text-muted-foreground">Manage administrative accounts and roles</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search administrators..." className="pl-9 pr-4 w-80" />
            </div>

            <Button onClick={openAddModal}>
              <Plus className="h-4 w-4 mr-2" />
              Add New
            </Button>

            <Button variant={viewArchives ? "default" : "ghost"} onClick={() => setViewArchives((v) => !v)}>
              {viewArchives ? "Viewing: Archives" : "View Archives"}
            </Button>

            <input ref={importInputRef} type="file" accept=".csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" onChange={(e) => handleImportFile(e.target.files ? e.target.files[0] : null)} style={{ display: "none" }} />
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

        <div className="flex items-center gap-3">
          <select value={filterRole} onChange={(e) => setFilterRole(e.target.value)} className="border rounded px-3 py-2">
            <option value="">All roles</option>
            {roles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="border rounded px-3 py-2">
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

          <select value={groupBy} onChange={(e) => setGroupBy(e.target.value as "none" | "role" | "status")} className="border rounded px-3 py-2">
            <option value="none">Group: None</option>
            <option value="role">Group: Role</option>
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
            <CardTitle className="text-lg">{viewArchives ? "Archives" : "Administrators"}</CardTitle>
            <CardDescription>{viewArchives ? "Archived administrators (inactive). You can restore or permanently delete here." : "Manage administrator accounts, roles and permissions."}</CardDescription>
          </CardHeader>

          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-sm text-muted-foreground">
                    <th className="text-left py-4 pr-6 font-medium">ID</th>
                    <th className="text-left py-4 pr-6 font-medium">Employee ID</th>
                    <th className="text-left py-4 pr-6 font-medium">Name</th>
                    <th className="text-left py-4 pr-6 font-medium">Role</th>
                    <th className="text-left py-4 pr-6 font-medium">Email</th>
                    <th className="text-left py-4 pr-6 font-medium">Permissions</th>
                    <th className="text-left py-4 pr-6 font-medium">Last login</th>
                    <th className="text-left py-4 pr-6 font-medium">Status</th>
                    <th className="text-right py-4 pl-6 font-medium">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {paginated.length > 0 ? (
                    groupBy === "none" ? (
                      paginated.map((a) => renderAdminRow(a))
                    ) : (
                      (() => {
                        const groups = new Map<string, Administrator[]>();
                        for (const a of paginated) {
                          let key = "";
                          if (groupBy === "role") key = a.role ?? "Unspecified";
                          else if (groupBy === "status") key = a.status ?? "Unspecified";
                          else key = "Others";
                          const arr = groups.get(key) ?? [];
                          arr.push(a);
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
                              <td colSpan={9} className="py-3 font-semibold">
                                {groupName} <span className="text-sm text-muted-foreground">({list.length})</span>
                              </td>
                            </tr>,
                            ...list.map((a) => renderAdminRow(a)),
                          ];
                        });
                      })()
                    )
                  ) : (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-sm text-muted-foreground">
                        No administrators found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">Page {Math.min(currentPage, totalPages)} of {totalPages}</div>

              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                  Previous
                </Button>
                <div className="px-3 py-1 border rounded text-sm bg-card">{currentPage}</div>
                <Button variant="ghost" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                  Next
                </Button>

                <div className="flex items-center gap-2 ml-4">
                  <label className="text-sm">Show</label>
                  <select value={pageSize} onChange={(e) => { const v = Number(e.target.value); setPageSize(v); setCurrentPage(1); }} className="border rounded px-2 py-1" aria-label="Select number of entries per page">
                    {PAGE_SIZE_OPTIONS.map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                  <span className="text-sm">entries</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/50" onClick={closeModal} aria-hidden="true" />
          <div className="relative z-10 w-11/12 max-w-lg bg-card border border-border rounded-lg shadow-lg max-h-[90vh] overflow-auto">
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="text-lg font-semibold">{editingId ? "Edit Administrator" : "Add Administrator"}</h3>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Employee ID (e.g. EMP-0001)</label>
                <Input value={formEmployeeId} onChange={(e) => setFormEmployeeId(e.target.value)} placeholder="EMP-0001" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Full name</label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. John Doe" />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <Input value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@school.edu" />
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Role</label>
                  <select value={formRole} onChange={(e) => setFormRole(e.target.value as Administrator["role"] | "")} className="w-full border rounded px-3 py-2">
                    <option value="">-- none --</option>
                    {roles.map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Permissions</label>
                <div className="grid grid-cols-2 gap-2 border rounded p-2 max-h-48 overflow-auto">
                  {allPermissions.map((perm) => {
                    const checked = formPermissions.includes(perm);
                    return (
                      <label key={perm} className="inline-flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePermissionInForm(perm)}
                          className="h-4 w-4"
                        />
                        <span className="text-sm">{perm}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={closeModal}>Cancel</Button>
                  <Button onClick={saveAdmin}>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M19 21H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2z" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 21v-8H7v8" />
                      <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M7 7V3" />
                    </svg>
                    Save
                  </Button>
                </div>

                {editingId && (
                  <>
                    {viewArchives || archivedAdmins.some((x) => x.id === editingId) ? (
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
                      <Button variant="destructive" onClick={() => editingId && archiveAdmin(editingId)}>
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

export default ManageAdministrators;