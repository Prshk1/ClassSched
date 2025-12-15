import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Printer, Download, FileSpreadsheet } from "lucide-react";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { timeSlotsSHS, formatTimeSlot } from "@/lib/timeUtils";

const ViewSchedules = () => {
  const [scheduleType, setScheduleType] = useState("class");
  const [selectedFilter, setSelectedFilter] = useState("");

  const weekDays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

  // Sample data for different schedule types (keep these small; replace with real data from API/store)
  const classScheduleData = {
    "Monday-7:45 AM": { subject: "Homeroom", teacher: "Carl Alfred Chan", room: "Room 201" },
    "Monday-8:30 AM": { subject: "Mathematics", teacher: "Sergs Erl Fulay", room: "Room 201" },
    "Tuesday-9:15 AM": { subject: "English", teacher: "Christian Jose Mendegorin", room: "Room 103" },
    "Wednesday-10:00 AM": { subject: "Science", teacher: "Joy Siocon", room: "Lab 1" },
  };

  // ref to the schedule area we want to print/export
  const printableRef = useRef<HTMLDivElement | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  // Option 1: iframe-based print (avoids popup blocking). Writes the printable HTML into a hidden iframe and calls print().
  const handlePrint = () => {
    if (!printableRef.current) {
      alert("Nothing to print.");
      return;
    }

    // create a hidden iframe
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    iframe.setAttribute("aria-hidden", "true");
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document;
    if (!doc) {
      document.body.removeChild(iframe);
      alert("Unable to open print frame.");
      return;
    }

    // minimal print styles. If you want full app styles, inject a <link> to your compiled CSS here.
    const styles = `
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial; color: #111827; margin: 20px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #e6e6e6; padding: 8px; vertical-align: top; }
        th { background: #f3f4f6; font-weight: 600; text-align: center; }
        .badge { display:inline-block; padding:2px 6px; background:#efefef; border-radius:4px; font-size:11px; }
        .subject { font-weight: 600; color: #0f172a; font-size: 13px; }
        .meta { font-size: 11px; color: #6b7280; margin-top: 4px; }
        @media print {
          body { margin: 10mm; }
        }
      </style>
    `;

    // build the HTML document for iframe
    doc.open();
    doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Schedule</title>${styles}</head><body>${printableRef.current.innerHTML}</body></html>`);
    doc.close();

    const win = iframe.contentWindow;
    if (!win) {
      document.body.removeChild(iframe);
      alert("Unable to open print frame.");
      return;
    }

    // slight delay to allow styles/resources to load in iframe, then print and cleanup
    win.focus();
    setTimeout(() => {
      try {
        win.print();
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error("Print error:", err);
        alert("Print failed.");
      } finally {
        // remove iframe after a short delay to ensure print dialog opened
        setTimeout(() => {
          try {
            document.body.removeChild(iframe);
          } catch {}
        }, 500);
      }
    }, 250);
  };

  // PDF: html2canvas + jspdf with multi-page slicing.
  const handleDownloadPDF = async () => {
    if (!printableRef.current) {
      alert("Nothing to export.");
      return;
    }
    if (typeof window === "undefined") return;

    setIsGenerating(true);
    try {
      const html2canvasMod = await import("html2canvas");
      const html2canvas = (html2canvasMod as any).default ?? html2canvasMod;

      const jspdfMod = await import("jspdf");
      const jsPDFClass = (jspdfMod as any).jsPDF ?? (jspdfMod as any).default ?? jspdfMod;

      if (!html2canvas || !jsPDFClass) throw new Error("Missing html2canvas or jsPDF");

      // render at reasonable scale for crisp output; increase with caution (memory)
      const scale = 2;
      const node = printableRef.current as HTMLElement;

      // Temporarily set a white background for consistent PDF output
      const origBackground = node.style.background;
      if (!origBackground) node.style.background = "#ffffff";

      const canvas = await html2canvas(node, { scale, useCORS: true });
      // restore original background
      node.style.background = origBackground;

      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDFClass({ orientation: "landscape", unit: "pt", format: "a4" });
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();

      const imgWidthPx = canvas.width;
      const imgHeightPx = canvas.height;
      const pxToPtRatio = pdfWidth / imgWidthPx; // points per canvas px
      const renderedHeightPt = imgHeightPx * pxToPtRatio;
      const pageHeightPx = pdfHeight / pxToPtRatio;

      if (imgHeightPx <= pageHeightPx + 1) {
        // single page
        pdf.addImage(imgData, "PNG", 0, 10, pdfWidth, renderedHeightPt);
      } else {
        // multi-page: slice canvas vertically
        let yOffsetPx = 0;
        let pageIndex = 0;
        while (yOffsetPx < imgHeightPx) {
          const sliceHeightPx = Math.min(pageHeightPx, imgHeightPx - yOffsetPx);
          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = imgWidthPx;
          sliceCanvas.height = Math.floor(sliceHeightPx);
          const ctx = sliceCanvas.getContext("2d");
          if (!ctx) throw new Error("Unable to get canvas context for PDF slice");

          ctx.drawImage(canvas, 0, yOffsetPx, imgWidthPx, sliceCanvas.height, 0, 0, imgWidthPx, sliceCanvas.height);
          const sliceData = sliceCanvas.toDataURL("image/png");

          const drawHeightPt = sliceCanvas.height * pxToPtRatio;
          if (pageIndex > 0) pdf.addPage();
          pdf.addImage(sliceData, "PNG", 0, 10, pdfWidth, drawHeightPt);

          yOffsetPx += sliceHeightPx;
          pageIndex += 1;
        }
      }

      const filename = `schedule-${new Date().toISOString().slice(0, 10)}.pdf`;
      pdf.save(filename);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("PDF generation error:", err);
      alert(`Failed to generate PDF: ${(err as Error).message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Excel: try to convert the DOM table to a worksheet, otherwise fallback to building rows
  const handleDownloadExcel = async () => {
    if (!printableRef.current) {
      alert("Nothing to export.");
      return;
    }
    setIsGenerating(true);
    try {
      const mod = await import("xlsx");
      const XLSX: any = (mod as any).default ?? mod;

      const table = printableRef.current.querySelector("table") as HTMLTableElement | null;
      let wb;
      if (table) {
        const ws = XLSX.utils.table_to_sheet(table, { raw: true });
        wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Schedule");
      } else {
        // fallback: build an AOA (array of arrays)
        const header = ["Time", ...weekDays];
        const rows: any[] = [header];
        timeSlotsSHS.slice(0, 8).forEach((ts) => {
          const row: any[] = [formatTimeSlot(ts)];
          weekDays.forEach((day) => {
            const key = `${day}-${ts.start}`;
            const slot = (classScheduleData as any)[key];
            if (slot) row.push(`${slot.subject}\n${slot.teacher}\n${slot.room}`);
            else row.push("");
          });
          rows.push(row);
        });
        const ws = XLSX.utils.aoa_to_sheet(rows);
        wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Schedule");
      }

      const wbout = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const blob = new Blob([wbout], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `schedule-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Excel export error:", err);
      alert(`Failed to generate Excel file: ${(err as Error).message ?? err}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <DashboardLayout userRole="admin">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">View Schedules</h1>
            <p className="text-muted-foreground">View and export schedules</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={handlePrint} disabled={!selectedFilter || isGenerating}>
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button variant="outline" onClick={handleDownloadPDF} disabled={!selectedFilter || isGenerating}>
              <Download className="h-4 w-4 mr-2" />
              {isGenerating ? "Generating..." : "PDF"}
            </Button>
            <Button variant="outline" onClick={handleDownloadExcel} disabled={!selectedFilter || isGenerating}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Schedule Viewing Configuration</CardTitle>
            <CardDescription>Select the type of schedule to generate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Schedule Type</label>
                <Select value={scheduleType} onValueChange={setScheduleType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="class">By Class/Section</SelectItem>
                    <SelectItem value="teacher">By Teacher</SelectItem>
                    <SelectItem value="room">By Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {scheduleType === "class" && "Select Class"}
                  {scheduleType === "teacher" && "Select Teacher"}
                  {scheduleType === "room" && "Select Room"}
                </label>
                <Select value={selectedFilter} onValueChange={setSelectedFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose..." />
                  </SelectTrigger>
                  <SelectContent>
                    {scheduleType === "class" && (
                      <>
                        <SelectItem value="grade11-stem1">Grade 11 - ABM11</SelectItem>
                        <SelectItem value="grade11-stem2">Grade 11 - HUMSS11</SelectItem>
                        <SelectItem value="grade12-abm1">Grade 12 - ABM12</SelectItem>
                      </>
                    )}
                    {scheduleType === "teacher" && (
                      <>
                        <SelectItem value="carl-chan">Carl Alfred Chan</SelectItem>
                        <SelectItem value="sergs-fulay">Sergs Erl Fulay</SelectItem>
                        <SelectItem value="christian-mendegorin">Christian Jose Mendegorin</SelectItem>
                        <SelectItem value="joy-siocon">Joy Siocon</SelectItem>
                      </>
                    )}
                    {scheduleType === "room" && (
                      <>
                        <SelectItem value="room201">Room 201</SelectItem>
                        <SelectItem value="room103">Room 103</SelectItem>
                        <SelectItem value="lab1">Computer Lab 1</SelectItem>
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {selectedFilter && (
          <Card>
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Schedule View
                </div>
              </CardTitle>
              <CardDescription>
                {scheduleType === "class" && "Class Schedule: Grade 11 - ABM1"}
                {scheduleType === "teacher" && "Teacher Schedule: Carl Alfred Chan"}
                {scheduleType === "room" && "Room Schedule: Room 201"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Attach printableRef here so print/pdf/excel target this card content */}
              <div className="overflow-x-auto" ref={printableRef}>
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border border-border bg-muted p-3 text-left font-semibold min-w-[120px]">
                        Time
                      </th>
                      {weekDays.map((day) => (
                        <th key={day} className="border border-border bg-muted p-3 text-center font-semibold min-w-[150px]">
                          {day}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {timeSlotsSHS.slice(0, 8).map((timeSlot) => (
                      <tr key={timeSlot.start}>
                        <td className="border border-border p-3 font-medium bg-muted/50 text-sm">
                          {formatTimeSlot(timeSlot)}
                        </td>
                        {weekDays.map((day) => {
                          const slotKey = `${day}-${timeSlot.start}`;
                          const slot = (classScheduleData as any)[slotKey as keyof typeof classScheduleData];

                          return (
                            <td key={day} className="border border-border p-2">
                              {slot ? (
                                <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 h-full">
                                  <div className="font-semibold text-primary text-sm">
                                    {slot.subject}
                                  </div>
                                  <div className="text-xs text-muted-foreground mt-1">
                                    {slot.teacher}
                                  </div>
                                  <Badge variant="secondary" className="mt-2 text-xs">
                                    {slot.room}
                                  </Badge>
                                </div>
                              ) : (
                                <div className="h-full min-h-[80px] flex items-center justify-center text-muted-foreground text-xs">
                                  —
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
        )}
      </div>
    </DashboardLayout>
  );
};

export default ViewSchedules;