import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { timeSlotsSHS, formatTimeSlot } from "@/lib/timeUtils";
import { useMemo, useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

type SlotInfo = {
  subject: string;
  teacher?: string;
  room?: string;
};

// fullSchedule represents the complete class schedule (all subjects + assigned teachers for that class)
type AdvisorySection = {
  id: string;
  sectionName: string;
  adviserName?: string;
  // key: `${weekday}-${timeStart}`, e.g. "Monday-7:45 AM"
  fullSchedule: Record<string, SlotInfo>;
};

const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const timeSlots = timeSlotsSHS;

const sampleAdvisories: AdvisorySection[] = [
  {
    id: "adv-1",
    sectionName: "Grade 11 - ABM11",
    adviserName: "Christine Salve Demetillo",
    fullSchedule: {
      "Monday-7:45 AM": { subject: "Homeroom", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Monday-8:30 AM": { subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Monday-9:15 AM": { subject: "Physics", teacher: "Sergs Erl Fulay", room: "Lab 1" },
      "Monday-10:00 AM": { subject: "English", teacher: "Christian Jose Mendegorin", room: "Room 103" },
      "Monday-1:00 PM": { subject: "Chemistry", teacher: "Sergs Erl Fulay", room: "Lab 1" },
      "Tuesday-7:45 AM": { subject: "Computer Science", teacher: "Joy Siocon", room: "Computer Lab" },
      "Tuesday-8:30 AM": { subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Tuesday-9:15 AM": { subject: "History", teacher: "Christine Salve Demetillo", room: "Room 205" },
      "Tuesday-10:45 AM": { subject: "Biology", teacher: "Ligaya Chan", room: "Lab 2" },
      "Wednesday-7:45 AM": { subject: "Physical Education", teacher: "Carlito Alfredo", room: "Gym" },
      "Wednesday-8:30 AM": { subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Wednesday-1:45 PM": { subject: "Arts", teacher: "Joy Siocon", room: "Art Room" },
      "Thursday-8:30 AM": { subject: "English", teacher: "Christian Jose Mendegorin", room: "Room 103" },
      "Thursday-10:00 AM": { subject: "Science", teacher: "Sergs Erl Fulay", room: "Lab 1" },
      "Thursday-10:45 AM": { subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Thursday-1:00 PM": { subject: "Computer Science", teacher: "Joy Siocon", room: "Computer Lab" },
      "Friday-9:15 AM": { subject: "English", teacher: "Christian Jose Mendegorin", room: "Room 103" },
      "Friday-11:30 AM": { subject: "Filipino", teacher: "Christine Salve Demetillo", room: "Room 104" },
    },
  },
  {
    id: "adv-2",
    sectionName: "Grade 12 - ABM12",
    adviserName: "Carl Alfred Chan",
    fullSchedule: {
      "Monday-8:30 AM": { subject: "Accounting", teacher: "Joy Siocon", room: "Room 203" },
      "Monday-9:15 AM": { subject: "Business Math", teacher: "Joy Siocon", room: "Room 203" },
      "Monday-1:00 PM": { subject: "Marketing", teacher: "Sergs Erl Fulay", room: "Room 207" },
      "Tuesday-8:30 AM": { subject: "Economics", teacher: "Christian Jose Mendegorin", room: "Room 210" },
      "Tuesday-10:45 AM": { subject: "Statistics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Wednesday-9:15 AM": { subject: "Economics", teacher: "Christian Jose Mendegorin", room: "Room 210" },
      "Wednesday-1:45 PM": { subject: "Accounting Lab", teacher: "Joy Siocon", room: "Lab 3" },
      "Thursday-8:30 AM": { subject: "Business Ethics", teacher: "Joy Siocon", room: "Room 208" },
      "Friday-1:00 PM": { subject: "Statistics", teacher: "Joy Siocon", room: "Room 203" },
    },
  },
  {
    id: "adv-3",
    sectionName: "Grade 11 - ICT11",
    adviserName: "Joy Siocon",
    fullSchedule: {
      "Monday-8:30 AM": { subject: "ICT Fundamentals", teacher: "Joy Siocon", room: "Computer Lab" },
      "Tuesday-9:15 AM": { subject: "Programming", teacher: "Ligaya Chan", room: "Computer Lab" },
      "Wednesday-8:30 AM": { subject: "Networking", teacher: "Sergs Erl Fulay", room: "Lab 2" },
      "Thursday-10:45 AM": { subject: "Mathematics", teacher: "Carl Alfred Chan", room: "Room 201" },
      "Friday-11:30 AM": { subject: "Computer Lab", teacher: "Joy Siocon", room: "Computer Lab" },
    },
  },
];

const AdvisoryClass = () => {
  // set the "current teacher" here for the demo — replace with auth user when integrating
  const CURRENT_TEACHER = "Carl Alfred Chan";

  const advisories = useMemo<AdvisorySection[]>(() => sampleAdvisories, []);

  // only show advisories where the adviser is the current teacher
  const myAdvisories = useMemo(
    () => advisories.filter((a) => (a.adviserName ?? "").toLowerCase() === CURRENT_TEACHER.toLowerCase()),
    [advisories]
  );

  const [activeTab, setActiveTab] = useState<string>(myAdvisories.length ? myAdvisories[0].id : "");
  useEffect(() => {
    if (myAdvisories.length && !myAdvisories.some((a) => a.id === activeTab)) {
      setActiveTab(myAdvisories[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myAdvisories]);

  const printableRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadPdf = async () => {
    if (typeof window === "undefined") {
      alert("PDF generation is only available in the browser.");
      return;
    }
    if (!printableRef.current) {
      alert("Nothing to export.");
      return;
    }

    setIsGenerating(true);
    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = (html2canvasMod as any).default ?? html2canvasMod;

      const jspdfMod = await import("jspdf");
      const jsPDFClass = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default ?? jspdfMod;

      if (!html2canvas || !jsPDFClass) {
        throw new Error("Failed to load html2canvas or jsPDF");
      }

      const scale = 2;
      const canvas = await html2canvas(printableRef.current as HTMLElement, { scale, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDFClass({
        orientation: "landscape",
        unit: "pt",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const ratio = pdfWidth / imgWidthPx;
      const renderedHeightPt = imgHeightPx * ratio;
      const pageHeightPx = pdfHeight / ratio;

      if (imgHeightPx <= pageHeightPx + 1) {
        pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, renderedHeightPt);
      } else {
        let yOffsetPx = 0;
        let pageIdx = 0;
        while (yOffsetPx < imgHeightPx) {
          const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - yOffsetPx);

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidthPx;
          sliceCanvas.height = Math.floor(sliceHeightPx);
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Unable to get canvas context for PDF slice.");
          ctx.drawImage(canvas, 0, yOffsetPx, imgWidthPx, sliceCanvas.height, 0, 0, imgWidthPx, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL("image/png");
          const drawHeight = sliceCanvas.height * ratio;
          if (pageIdx > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", 0, 10, pdfWidth, drawHeight);
          yOffsetPx += sliceHeightPx;
          pageIdx += 1;
        }
      }

      const section = myAdvisories.find((a) => a.id === activeTab) ?? myAdvisories[0];
      const safeName = (section?.sectionName ?? "advisory").replace(/\s+/g, "-").toLowerCase();
      const filename = `advisory-${safeName}-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF generation error:", err);
      alert(`Failed to generate PDF: ${(err as Error).message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout userRole="teacher">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Advisory Class</h1>
          <p className="text-muted-foreground">
            View the full timetables (subjects and assigned teachers) for your advisory sections.
          </p>
        </div>

        {myAdvisories.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No advisory sections assigned</CardTitle>
              <CardDescription>You currently have no advisory sections assigned.</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Contact your administrator if this looks incorrect.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 w-full">
                <div>
                  <CardTitle>My Advisory Sections</CardTitle>
                  <CardDescription>Use the tabs to switch between your advisory sections</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button onClick={downloadPdf} disabled={isGenerating}>
                    <Download className="h-4 w-4 mr-2" />
                    {isGenerating ? "Generating..." : "Download PDF"}
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)}>
                <div className="flex items-start gap-4 mb-4 overflow-auto">
                  <TabsList>
                    {myAdvisories.map((adv) => (
                      <TabsTrigger key={adv.id} value={adv.id} className="whitespace-nowrap">
                        {adv.sectionName}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>

                {myAdvisories.map((adv) => (
                  <TabsContent key={adv.id} value={adv.id} className="pt-2">
                    <div className="mb-4 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">Adviser</div>
                        <div className="font-medium">{adv.adviserName ?? "—"}</div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Section: <span className="font-medium">{adv.sectionName}</span>
                      </div>
                    </div>

                    <div className="overflow-x-auto" ref={adv.id === activeTab ? printableRef : null}>
                      <table className="w-full border-collapse">
                        <thead>
                          <tr>
                            <th className="border border-border bg-muted p-3 text-left font-semibold min-w-[120px]">Time</th>
                            {weekDays.map((d) => (
                              <th key={d} className="border border-border bg-muted p-3 text-center font-semibold min-w-[140px]">
                                {d}
                              </th>
                            ))}
                          </tr>
                        </thead>

                        <tbody>
                          {timeSlots.slice(0, 9).map((ts) => (
                            <tr key={ts.start}>
                              <td className="border border-border p-3 font-medium bg-muted/50 text-sm">
                                {formatTimeSlot(ts)}
                              </td>

                              {weekDays.map((day) => {
                                const key = `${day}-${ts.start}`;
                                const slot = adv.fullSchedule[key as keyof typeof adv.fullSchedule];

                                return (
                                  <td key={day} className="border border-border p-2 align-top">
                                    {slot ? (
                                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 h-full">
                                        <div className="font-semibold text-primary text-sm">{slot.subject}</div>
                                        {slot.teacher && (
                                          <div className="text-xs text-muted-foreground mt-1">
                                            {slot.teacher}
                                          </div>
                                        )}
                                        {slot.room && (
                                          <Badge variant="secondary" className="mt-2 text-xs">
                                            {slot.room}
                                          </Badge>
                                        )}
                                      </div>
                                    ) : (
                                      <div className="h-full min-h-[72px] flex items-center justify-center text-muted-foreground text-xs">
                                        Free / No class
                                      </div>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdvisoryClass;