import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Button } from "@/components/ui/button";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useIsMobile } from "@/hooks/use-mobile";

interface DashboardLayoutProps {
  children: ReactNode;
  userRole: "admin" | "teacher" | "student";
}

const DashboardLayout = ({ children, userRole }: DashboardLayoutProps) => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [username, setUsername] = useState("");

  // Lifted collapsed state so the layout can add a matching left margin
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    const storedRole = localStorage.getItem("userRole");
    const storedUsername = localStorage.getItem("username");
    
    if (!storedRole) {
      navigate("/");
    } else if (storedRole !== userRole) {
      // Redirect to correct dashboard if role doesn't match
      navigate(`/${storedRole}/dashboard`);
    }

    setUsername(storedUsername || "User");
  }, [navigate, userRole]);

  // Sidebar widths: w-64 = 16rem, w-16 = 4rem
  const mainMarginClass = isMobile ? "ml-0" : (collapsed ? "ml-16" : "ml-64");

  return (
    <div className="flex w-full min-h-screen bg-background">
      <Sidebar userRole={userRole} collapsed={collapsed} setCollapsed={setCollapsed} />

      <div className={`flex-1 flex flex-col w-full lg:w-auto ${mainMarginClass} transition-all duration-300`}>
        <header className="h-16 border-b border-border bg-card flex items-center justify-between px-4 sm:px-6 lg:pl-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold">
              Welcome, {username}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground capitalize">
              {userRole} Dashboard
            </p>
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full"
          >
            {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;