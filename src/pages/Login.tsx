import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Users, GraduationCap, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

type UserRole = "admin" | "teacher" | "student";

const Login = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Simple mock authentication - in production, this would validate against a backend
    if (username && password) {
      localStorage.setItem("userRole", selectedRole || "");
      localStorage.setItem("username", username);
      
      switch (selectedRole) {
        case "admin":
          navigate("/admin/dashboard");
          break;
        case "teacher":
          navigate("/teacher/schedule");
          break;
        case "student":
          navigate("/student/schedule");
          break;
      }
    }
  };

  const roleOptions = [
    {
      role: "admin" as UserRole,
      title: "Administrator",
      description: "Full system access",
      icon: Users,
    },
    {
      role: "teacher" as UserRole,
      title: "Teacher",
      description: "View your schedule",
      icon: GraduationCap,
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="rounded-full"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
      </div>

      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calendar className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold text-primary">ClassSched</h1>
          </div>
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>Smart Scheduling for Smarter Schools</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!selectedRole ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground text-center mb-4">
                Select your role to continue
              </p>
              {roleOptions.map(({ role, title, description, icon: Icon }) => (
                <Card
                  key={role}
                  className="cursor-pointer hover:shadow-md hover:border-primary transition-all duration-200"
                  onClick={() => setSelectedRole(role)}
                >
                  <CardContent className="flex items-center gap-4 p-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm text-muted-foreground">{description}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <Button
                type="button"
                variant="ghost"
                className="mb-4"
                onClick={() => setSelectedRole(null)}
              >
                ← Back to role selection
              </Button>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full">
                Sign In as {roleOptions.find(r => r.role === selectedRole)?.title}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Login;
