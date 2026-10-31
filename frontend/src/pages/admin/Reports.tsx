import { useEffect, useState } from "react";
import {
  Calendar,
  Building2,
  Users,
  ClipboardList,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import axiosInstance from "../../config/ApiClient";
import { toLocalDateInput, parseLocalDate } from "../../lib/nepali-date";
import BSCalendarRange from "../../components/ui/BSCalendarRange";

type ReportType = "attendance" | "employee" | "leave";

interface IOption {
  _id: string;
  name: string;
}

export default function Reports() {
  const [activeReport, setActiveReport] = useState<ReportType>("attendance");
  const [downloading, setDownloading] = useState(false);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // cascading filters: branch → department → designation
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");

  const [branches, setBranches] = useState<IOption[]>([]);
  const [departments, setDepartments] = useState<IOption[]>([]);
  const [designations, setDesignations] = useState<IOption[]>([]);

  // branches fetch on mount
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = (await axiosInstance.get("/branches")) as { data: IOption[] };
        if (active) setBranches(res.data || []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, []);

  // departments: branch select bhaye related matra, navae sabai (default All)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params: Record<string, string> = {};
        if (branchId) params.branch = branchId;
        const res = (await axiosInstance.get("/departments", { params })) as { data: IOption[] };
        if (active) setDepartments(res.data || []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [branchId]);

  // designations: branch/department anusar related, navaye sabai (default All)
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params: Record<string, string> = {};
        if (branchId) params.branch = branchId;
        if (departmentId) params.department = departmentId;
        const res = (await axiosInstance.get("/designations", { params })) as { data: IOption[] };
        if (active) setDesignations(res.data || []);
      } catch { /* silently fail */ }
    })();
    return () => { active = false; };
  }, [branchId, departmentId]);

  const handleBranchChange = (id: string) => {
    setBranchId(id);
    setDepartmentId("");
    setDesignationId("");
  };

  const handleDepartmentChange = (id: string) => {
    setDepartmentId(id);
    setDesignationId("");
  };

  const buildParams = (): Record<string, string> => {
    const params: Record<string, string> = {};
    if (activeReport !== "employee") {
      if (startDate && endDate) {
        params.startDate = startDate;
        params.endDate = endDate;
      } else if (startDate) {
        params.startDate = startDate;
        params.endDate = startDate;
      } else if (endDate) {
        params.startDate = endDate;
        params.endDate = endDate;
      }
    }
    if (branchId) params.branchId = branchId;
    if (departmentId) params.departmentId = departmentId;
    if (designationId) params.designationId = designationId;
    if (activeReport === "leave" && statusFilter) params.status = statusFilter;
    return params;
  };

  const getReportConfig = (type: ReportType) => {
    const today = toLocalDateInput(new Date());
    const dateSuffix =
      startDate && endDate && startDate !== endDate
        ? `${startDate}_to_${endDate}`
        : startDate || endDate || today;
    if (type === "attendance") {
      return { endpoint: "/reports/attendance", filename: `attendance_${dateSuffix}` };
    }
    if (type === "employee") return { endpoint: "/reports/employees", filename: `employees_${today}` };
    return { endpoint: "/reports/leaves", filename: `leaves_${dateSuffix}` };
  };

  const handleDownloadPDF = async () => {
    try {
      // sabai filter optional - khali chhodyo bhane All (company-wide) report download huncha
      setDownloading(true);
      const config = getReportConfig(activeReport);
      const res = await axiosInstance.get(config.endpoint, { params: buildParams() });
      const data = res.data || [];

      if (data.length === 0) {
        toast.error("No data found for the selected filters");
        return;
      }

      // removed (soft deleted) employees ko row PDF ma highlight garna
      const isRemovedRow = (row: Record<string, any>) =>
        activeReport === "employee" ? row.status === "Removed" : row.employeeStatus === "Removed";
      const removedCount = (data as Record<string, any>[]).filter(isRemovedRow).length;

      const titleMap: Record<string, string> = {
        attendance: "Attendance Report",
        employee: "Employee Report",
        leave: "Leave Report",
      };

      const title = titleMap[activeReport];
      const filename = `${config.filename}.pdf`;
      const dateRange = activeReport !== "employee"
        ? startDate && endDate && startDate !== endDate
          ? `${startDate} to ${endDate}`
          : startDate || endDate || "All"
        : "All";

      // selected filter haru ko name - PDF header ma dekhauna
      const branchName = branchId ? branches.find((b) => b._id === branchId)?.name || "Selected" : "All";
      const deptName = departmentId ? departments.find((d) => d._id === departmentId)?.name || "Selected" : "All";
      const desigName = designationId ? designations.find((d) => d._id === designationId)?.name || "Selected" : "All";
      const filterLines = [
        `Branch: ${branchName}  |  Department: ${deptName}  |  Designation: ${desigName}`,
        ...(activeReport === "leave" ? [`Status: ${statusFilter || "All"}`] : []),
        ...(removedCount > 0 ? [`Red highlighted rows = removed employees (${removedCount})`] : []),
      ];

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFillColor(40, 70, 158);
      doc.rect(0, 0, pageWidth, 24, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(title, 14, 16);

      doc.setTextColor(60, 72, 88);
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 32);
      doc.text(`Date Range: ${dateRange}`, 14, 38);
      filterLines.forEach((line, i) => doc.text(line, 14, 44 + i * 6));
      doc.text(
        removedCount > 0 ? `Records: ${data.length} (${removedCount} removed)` : `Records: ${data.length}`,
        pageWidth - 14, 32, { align: "right" }
      );

      const headers = Object.keys(data[0] as Record<string, any>);
      const head = headers.map((h: string) =>
        h.replace(/([A-Z])/g, " $1").replace(/^./, (s: string) => s.toUpperCase())
      );
      const body = data.map((row: Record<string, any>) =>
        headers.map((h: string) => (row[h] ?? "-") as string)
      );

      autoTable(doc, {
        head: [head],
        body,
        startY: 44 + filterLines.length * 6 + 2,
        didParseCell: (d) => {
          if (d.section === "body" && isRemovedRow(data[d.row.index] as Record<string, any>)) {
            d.cell.styles.fillColor = [254, 226, 226];
            d.cell.styles.textColor = [153, 27, 27];
            d.cell.styles.fontStyle = "bold";
          }
        },
        styles: { fontSize: 8, cellPadding: 2.5 },
        headStyles: { fillColor: [238, 246, 246], textColor: [40, 70, 158], fontStyle: "bold" },
        alternateRowStyles: { fillColor: [244, 248, 248] },
        margin: { left: 14, right: 14 },
      });

      doc.save(filename);
      toast.success("PDF downloaded successfully");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Failed to generate report");
    } finally {
      setDownloading(false);
    }
  };

  const reportTypes: { key: ReportType; label: string; icon: any; color: string; bg: string; desc: string }[] = [
    { key: "attendance", label: "Attendance", icon: Calendar, color: "text-primary", bg: "bg-secondary", desc: "Daily attendance records" },
    { key: "employee", label: "Employees", icon: Users, color: "text-primary", bg: "bg-secondary", desc: "All employee details" },
    { key: "leave", label: "Leaves", icon: ClipboardList, color: "text-primary", bg: "bg-secondary", desc: "Leave applications" },
  ];

  const showDateRange = activeReport === "attendance" || activeReport === "leave";
  const showStatus = activeReport === "leave";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
        <p className="mt-1 text-slate-500">Generate and download system reports as PDF</p>
      </div>

      {/* Report type selector */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {reportTypes.map((rt) => {
          const Icon = rt.icon;
          return (
            <button
              key={rt.key}
              onClick={() => setActiveReport(rt.key)}
              className={`p-5 rounded-2xl border-2 text-left transition-all ${
                activeReport === rt.key
                  ? "border-primary bg-secondary shadow-md shadow-primary/10"
                  : "border-border hover:border-border hover:shadow-md bg-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${
                activeReport === rt.key ? "bg-primary text-white" : `${rt.bg} ${rt.color}`
              }`}>
                <Icon size={20} />
              </div>
              <p className="font-bold text-slate-800">{rt.label}</p>
              <p className="text-xs text-slate-500 mt-1">{rt.desc}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Building2 size={20} className="text-slate-600" />
          <h3 className="font-bold text-slate-800">Filters</h3>
        </div>

        {/* Date range - only for attendance & leave */}
        {showDateRange && (
          <div className="mb-4">
            <BSCalendarRange
              startDate={startDate ? parseLocalDate(startDate) : null}
              endDate={endDate ? parseLocalDate(endDate) : null}
              startLabel="Start / Single Date"
              allowSameDay={true}
              onChange={(start, end) => {
                setStartDate(start ? toLocalDateInput(start) : "");
                setEndDate(end ? toLocalDateInput(end) : "");
              }}
            />
          </div>
        )}

        {/* Cascading: Branch → Department → Designation */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label htmlFor="report-branch-select" className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
            <select
              id="report-branch-select"
              value={branchId}
              onChange={(e) => handleBranchChange(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">All Branches</option>
              {branches.map((b) => (
                <option key={b._id} value={b._id}>{b.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-dept-select" className="block text-sm font-medium text-slate-700 mb-1">Department</label>
            <select
              id="report-dept-select"
              value={departmentId}
              onChange={(e) => handleDepartmentChange(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">All Departments{branchId ? " (this branch)" : ""}</option>
              {departments.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="report-desig-select" className="block text-sm font-medium text-slate-700 mb-1">Designation</label>
            <select
              id="report-desig-select"
              value={designationId}
              onChange={(e) => setDesignationId(e.target.value)}
              className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
            >
              <option value="">All Designations{branchId || departmentId ? " (filtered)" : ""}</option>
              {designations.map((d) => (
                <option key={d._id} value={d._id}>{d.name}</option>
              ))}
            </select>
          </div>
          {showStatus && (
            <div>
              <label htmlFor="report-status-select" className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select
                id="report-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full border border-border rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary bg-white"
              >
                <option value="">All Status</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Download PDF button */}
      <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-bold text-slate-800">Download Report</h3>
            <p className="text-sm text-slate-500 mt-1">
              Leave everything as All for the full {activeReport} report, or narrow it down with dates, branch, department, designation{showStatus ? " and status" : ""}
            </p>
          </div>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-medium disabled:opacity-50 hover:bg-primary-hover transition-colors flex-shrink-0"
          >
            <FileText size={16} />
            {downloading ? "Generating..." : "Download PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
