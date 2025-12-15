import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Calendar,
  Users,
  BookOpen,
  School,
  CalendarCheck,
  BarChart,
  UserCircle,
  LogOut,
  ChevronLeft,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

interface SidebarProps {
  userRole: "admin" | "teacher" | "student";
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
}

// Inline teaching icon used for "Manage Sections"
const TeachingIcon = ({ className, ...props }: React.SVGProps<SVGSVGElement>) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.6"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
    {...props}
  >
    <circle cx="4.5" cy="4.5" r="1.6" />
    <path d="M4.5 6.5v2.5c0 .6.5 1 1 1h2" />
    <path d="M7.5 8.5l2.2-1.2" />
    <rect x="10" y="2.3" width="11" height="7.4" rx="0.6" />
    <path d="M13.2 6.2v2.5" />
    <path d="M15.3 5.2v3.5" />
    <path d="M17.8 6.8v2.0" />
    <circle cx="6.2" cy="16.5" r="1" />
    <circle cx="10.5" cy="16.5" r="1" />
    <circle cx="14.8" cy="16.5" r="1" />
    <path d="M5.2 18.2c0 .6.8 1.1 1.6 1.1h.8c.8 0 1.6-.5 1.6-1.1" />
    <path d="M9.5 18.2c0 .6.8 1.1 1.6 1.1h.8c.8 0 1.6-.5 1.6-1.1" />
    <path d="M13.8 18.2c0 .6.8 1.1 1.6 1.1h.8c.8 0 1.6-.5 1.6-1.1" />
  </svg>
);

const Sidebar = ({ userRole, collapsed, setCollapsed }: SidebarProps) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  // Close mobile menu when route changes
  useEffect(() => {
    if (isMobile) {
      setMobileOpen(false);
    }
  }, [navigate, isMobile]);

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    localStorage.removeItem("username");
    navigate("/");
  };

  const adminLinks = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/schedule-builder", label: "Schedule Builder", icon: Calendar },
    { to: "/admin/administrators", label: "Manage Administrators", icon: UserCircle },
    { to: "/admin/teachers", label: "Manage Teachers", icon: Users },
    { to: "/admin/sections", label: "Manage Sections", icon: TeachingIcon as any },
    { to: "/admin/subjects", label: "Manage Subjects", icon: BookOpen },
    { to: "/admin/rooms", label: "Manage Rooms", icon: School },
    { to: "/admin/viewschedules", label: "View Schedule", icon: CalendarCheck },
    { to: "/admin/reports", label: "Reports", icon: BarChart },
  ];

  const teacherLinks = [
    { to: "/teacher/schedule", label: "My Schedule", icon: Calendar },
    { to: "/teacher/advisory", label: "Advisory Class", icon: Users },
  ];

  const studentLinks = [
    { to: "/student/schedule", label: "Class Schedule", icon: Calendar },
  ];

  const links =
    userRole === "admin" ? adminLinks :
    userRole === "teacher" ? teacherLinks :
    studentLinks;

  return (
    <>
      {/* Mobile Menu Button */}
      {isMobile && !mobileOpen && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setMobileOpen(true)}
          className="fixed top-4 left-4 z-60 lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Overlay for mobile */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={cn(
          // fixed so it does not move when the page scrolls
          "fixed top-0 left-0 h-screen bg-sidebar border-r border-sidebar-border transition-all duration-300 flex flex-col z-40",
          // width controlled by collapsed state (w-16 = 4rem, w-64 = 16rem)
          collapsed && !isMobile ? "w-16" : "w-64",
          // for mobile: slide offscreen when closed
          isMobile && !mobileOpen && "-translate-x-full"
        )}
      >
        <div className="p-4 flex items-center justify-between border-b border-sidebar-border">
          {(!collapsed || isMobile) && (
            <div className="flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg text-primary">ClassSched</span>
            </div>
          )}
          {isMobile ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
              className="h-8 w-8"
            >
              {collapsed ? <Menu className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          )}
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {links.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => isMobile && setMobileOpen(false)}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
                collapsed && !isMobile && "justify-center"
              )}
              activeClassName="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {(!collapsed || isMobile) && <span className="text-sm font-medium">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-sidebar-border space-y-1">
          <NavLink
            to="/profile"
            onClick={() => isMobile && setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sidebar-foreground hover:bg-sidebar-accent transition-colors",
              collapsed && !isMobile && "justify-center"
            )}
            activeClassName="bg-sidebar-accent"
          >
            <UserCircle className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="text-sm font-medium">Profile</span>}
          </NavLink>

          <Button
            variant="ghost"
            className={cn(
              "w-full justify-start gap-3 hover:bg-destructive/10 hover:text-destructive",
              collapsed && !isMobile && "justify-center px-0"
            )}
            onClick={handleLogout}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {(!collapsed || isMobile) && <span className="text-sm font-medium">Logout</span>}
          </Button>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;