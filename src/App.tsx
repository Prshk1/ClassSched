import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import Login from "./pages/Login";
import Dashboard from "./pages/admin/Dashboard";
import ScheduleBuilder from "./pages/admin/ScheduleBuilder";
import ManageTeachers from "./pages/admin/ManageTeachers";
import ManageSubjects from "./pages/admin/ManageSubjects";
import ManageRooms from "./pages/admin/ManageRooms";
import ManageSections from "./pages/admin/ManageSections";
import Reports from "./pages/admin/Reports";
import TeacherSchedule from "./pages/teacher/TeacherSchedule";
import AdvisoryClass from "./pages/teacher/AdvisoryClass";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/admin/dashboard" element={<Dashboard />} />
            <Route path="/admin/schedule-builder" element={<ScheduleBuilder />} />
            <Route path="/admin/teachers" element={<ManageTeachers />} />
            <Route path="/admin/subjects" element={<ManageSubjects />} />
            <Route path="/admin/rooms" element={<ManageRooms />} />
            <Route path="/admin/sections" element={<ManageSections />} />
            <Route path="/admin/reports" element={<Reports />} />
            <Route path="/teacher/schedule" element={<TeacherSchedule />} />
            <Route path="/teacher/advisory" element={<AdvisoryClass />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;