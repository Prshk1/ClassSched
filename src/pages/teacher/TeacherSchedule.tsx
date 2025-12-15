import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Download } from "lucide-react";
import { timeSlotsSHS, formatTimeSlot } from "@/lib/timeUtils";
import { useRef, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

const TeacherSchedule = () => {
  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const timeSlots = timeSlotsSHS;

  const mySchedule = {
    "Monday-8:30 AM": { subject: "Mathematics", class: "Grade 11 - STEM 1", room: "Room 201" },
    "Monday-10:00 AM": { subject: "Statistics", class: "Grade 12 - ABM 1", room: "Room 203" },
    "Tuesday-9:15 AM": { subject: "Mathematics", class: "Grade 11 - STEM 2", room: "Room 201" },
    "Wednesday-8:30 AM": { subject: "Calculus", class: "Grade 12 - STEM 1", room: "Room 204" },
    "Thursday-10:45 AM": { subject: "Mathematics", class: "Grade 11 - STEM 1", room: "Room 201" },
    "Friday-1:00 PM": { subject: "Statistics", class: "Grade 12 - ABM 2", room: "Room 203" },
  };

  // ref to the printable area
  const printableRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // view selection: "all" | "shs" | "tesda"
  const [view, setView] = useState<"all" | "shs" | "tesda">("all");

  // helper to detect SHS class by class string (simple heuristic)
  const isShsClass = (className?: string) => {
    if (!className) return false;
    return /\bGrade\s*\d+/i.test(className);
  };

  // produce a filtered map of schedule entries according to view
  const visibleSchedule = useMemo(() => {
    const map = new Map<string, { subject: string; class: string; room: string }>();
    for (const k of Object.keys(mySchedule)) {
      const ev = (mySchedule as any)[k] as { subject: string; class: string; room: string };
      if (view === "all") {
        map.set(k, ev);
      } else if (view === "shs") {
        if (isShsClass(ev.class)) map.set(k, ev);
      } else {
        // tesda view: include those that are not SHS by heuristic
        if (!isShsClass(ev.class)) map.set(k, ev);
      }
    }
    return map;
  }, [view, mySchedule]);

  // generate a PDF from the current schedule view (uses html2canvas + jspdf)
  const downloadPdf = async () => {
    if (typeof window === "undefined") {
      alert("PDF generation is only available in the browser.");
      return;
    }
    if (!printableRef.current) return;

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
        const imgWidth = pdfWidth;
        const imgHeight = renderedHeightPt;
        const x = 0;
        const y = 10;
        pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight);
      } else {
        let yOffsetPx = 0;
        let page = 0;
        while (yOffsetPx < imgHeightPx) {
          const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - yOffsetPx);

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidthPx;
          sliceCanvas.height = Math.floor(sliceHeightPx);

          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Unable to get canvas context for PDF slice.");

          ctx.drawImage(
            canvas,
            0,
            yOffsetPx,
            imgWidthPx,
            sliceCanvas.height,
            0,
            0,
            imgWidthPx,
            sliceCanvas.height
          );

          const sliceData = sliceCanvas.toDataURL("image/png");

          const drawWidth = pdfWidth;
          const drawHeight = sliceCanvas.height * ratio;
          const x = 0;
          const y = 10;

          if (page > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", x, y, drawWidth, drawHeight);

          yOffsetPx += sliceHeightPx;
          page += 1;
        }
      }

      const filename = `schedule-${view}-${new Date().toISOString().slice(0, 10)}.pdf`;
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
          <h1 className="text-3xl font-bold mb-2">My Schedule</h1>
          <p className="text-muted-foreground">View your teaching schedule</p>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView("all")}
              className={`px-3 py-2 rounded ${view === "all" ? "bg-primary text-white" : "bg-card border border-border"}`}
            >
              All Schedule
            </button>
            <button
              onClick={() => setView("shs")}
              className={`px-3 py-2 rounded ${view === "shs" ? "bg-primary text-white" : "bg-card border border-border"}`}
            >
              Senior High Schedule
            </button>
            <button
              onClick={() => setView("tesda")}
              className={`px-3 py-2 rounded ${view === "tesda" ? "bg-primary text-white" : "bg-card border border-border"}`}
            >
              TESDA-based Schedule
            </button>
          </div>

          <div>
            <Button onClick={downloadPdf} disabled={isGenerating} className="whitespace-nowrap">
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? "Generating..." : "Download PDF"}
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Weekly Teaching Schedule</CardTitle>
            <CardDescription>{view === "all" ? "All assigned classes" : view === "shs" ? "Senior High assigned classes" : "TESDA-based assigned classes"}</CardDescription>
          </CardHeader>

          <CardContent>
            {/* attach printableRef to the content we want in the PDF */}
            <div className="overflow-x-auto" ref={printableRef}>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="border border-border bg-muted p-3 text-left font-semibold min-w-[100px]">Time</th>
                    {weekDays.map((day) => (
                      <th key={day} className="border border-border bg-muted p-3 text-center font-semibold min-w-[150px]">
                        {day}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {timeSlots.slice(0, 9).map((timeSlot) => (
                    <tr key={timeSlot.start}>
                      <td className="border border-border p-3 font-medium bg-muted/50 text-sm">
                        {formatTimeSlot(timeSlot)}
                      </td>
                      {weekDays.map((day) => {
                        const slotKey = `${day}-${timeSlot.start}`;
                        const slot = visibleSchedule.get(slotKey);

                        return (
                          <td key={day} className="border border-border p-2 align-top">
                            {slot ? (
                              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 h-full">
                                <div className="font-semibold text-primary">{slot.subject}</div>
                                <div className="text-sm text-muted-foreground mt-1">{slot.class}</div>
                                <Badge variant="secondary" className="mt-2 text-xs">{slot.room}</Badge>
                              </div>
                            ) : (
                              <div className="h-full min-h-[80px] flex items-center justify-center text-muted-foreground text-sm">
                                Free Period
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
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default TeacherSchedule;