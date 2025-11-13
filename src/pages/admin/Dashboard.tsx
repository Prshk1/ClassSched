import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, School, BookOpen, AlertTriangle, Calendar, FileText, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Dashboard = () => {
  const navigate = useNavigate();

  const stats = [
    {
      title: "Total Teachers",
      value: "24",
      icon: Users,
      description: "Active teaching staff",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Total Rooms",
      value: "18",
      icon: School,
      description: "Available classrooms",
      color: "text-accent",
      bgColor: "bg-accent/10",
    },
    {
      title: "Total Classes",
      value: "12",
      icon: BookOpen,
      description: "Active sections",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      title: "Conflicts Detected",
      value: "3",
      icon: AlertTriangle,
      description: "Scheduling issues",
      color: "text-destructive",
      bgColor: "bg-destructive/10",
    },
  ];

  const quickActions = [
    {
      title: "Create Schedule",
      description: "Build a new class schedule",
      icon: Calendar,
      action: () => navigate("/admin/schedule-builder"),
      variant: "default" as const,
    },
    {
      title: "Manage Teachers",
      description: "Add or edit teacher information",
      icon: Users,
      action: () => navigate("/admin/teachers"),
      variant: "secondary" as const,
    },
    {
      title: "Manage Rooms",
      description: "Configure classroom details",
      icon: School,
      action: () => navigate("/admin/rooms"),
      variant: "secondary" as const,
    },
    {
      title: "View Reports",
      description: "Generate and export schedules",
      icon: FileText,
      action: () => navigate("/admin/reports"),
      variant: "secondary" as const,
    },
  ];

  const recentActivities = [
    { action: "Schedule updated", details: "Grade 11 - STEM 1", time: "2 hours ago" },
    { action: "New teacher added", details: "John Smith - Mathematics", time: "5 hours ago" },
    { action: "Room assigned", details: "Room 301 - Computer Laboratory", time: "1 day ago" },
    { action: "Schedule conflict resolved", details: "Grade 12 - ABM 2", time: "2 days ago" },
  ];

  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Dashboard</h1>
          <p className="text-muted-foreground">
            Overview of your school's scheduling system
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    {stat.title}
                  </CardTitle>
                  <div className={`h-10 w-10 rounded-full ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`h-5 w-5 ${stat.color}`} />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stat.description}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common tasks and operations</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <Button
                    key={action.title}
                    variant={action.variant}
                    className="w-full justify-start h-auto py-4"
                    onClick={action.action}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Icon className="h-5 w-5 mt-0.5 flex-shrink-0" />
                      <div className="text-left">
                        <div className="font-semibold">{action.title}</div>
                        <div className="text-xs opacity-80 font-normal">
                          {action.description}
                        </div>
                      </div>
                    </div>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>Latest system updates</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-start gap-3 pb-3 border-b last:border-0">
                    <div className="h-2 w-2 rounded-full bg-primary mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{activity.action}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {activity.details}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {activity.time}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
