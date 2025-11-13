import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const AdvisoryClass = () => {
  return (
    <DashboardLayout userRole="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Advisory Class</h1>
          <p className="text-muted-foreground">Manage your advisory section</p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Advisory Information</CardTitle>
            <CardDescription>Grade 11 - STEM 1</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Advisory class details will be available here.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdvisoryClass;
