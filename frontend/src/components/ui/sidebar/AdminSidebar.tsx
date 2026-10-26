import { useEffect } from "react";
import { NavLink } from "react-router-dom";
import AllowAccess from "../../auth/AllowAccess";
import { useAppSelector } from "../../../lib/hooks/redux";
import Logo from "../../logo/Logo";
import {
  LayoutDashboard,
  Users,
  UserRound,
  CalendarCheck,
  Building2,
  BriefcaseBusiness,
  MapPin,
  ClipboardList,
  Wrench,
  Calendar,
  CalendarDays,
  PartyPopper,
  FileText,
  History,
  Settings,
  Home,
  Plane,
  Bell,
  X,
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Download,
} from "lucide-react";
import PWAInstallBanner from "../../pwa/PWAInstallBanner";
import { usePWAInstall } from "../../../lib/hooks/usePWAInstall";
import { toast } from "sonner";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

// role-gating AllowAccess wrapper le hunchha (redux based)
export const AdminSidebar = ({ open, onClose, collapsed, onToggleCollapse }: SidebarProps) => {
  const { settings } = useAppSelector((state) => state.companySetting);

  // Escape key closes drawer on mobile
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Prevent body scroll when drawer open on mobile
  useEffect(() => {
    if (open && window.innerWidth < 768) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
      collapsed ? "md:justify-center md:px-2.5" : "px-4"
    } ${
      isActive
        ? "bg-primary text-white shadow-sm shadow-primary/20"
        : "text-slate-600 hover:text-primary hover:bg-secondary/40"
    }`;

  // Close drawer when a nav link is clicked (mobile only - harmless on desktop)
  const handleNavClick = () => {
    if (window.innerWidth < 768) onClose();
  };

  // PWA install menu — employee-only, always visible when not installed (ignores dismissed banner)
  const pwa = usePWAInstall();
  const handlePwaInstallClick = async () => {
    handleNavClick();
    const ok = await pwa.promptInstall();
    if (!ok) {
      if (pwa.isIOS) {
        toast.info("Add to Home Screen", {
          description: "Tap Share → Add to Home Screen to install the app.",
          duration: 6000,
        });
      } else {
        toast.info("Install via browser menu", {
          description: "Open the browser menu (⋮) → Install app. Or look for the install icon in the address bar.",
          duration: 6000,
        });
      }
    } else {
      toast.success("Install started", { description: "Check the system prompt to confirm." });
    }
  };

  return (
    <>
      {/* Backdrop - mobile only */}
      <div
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`
          flex shrink-0 flex-col bg-white border-border shadow-xl md:shadow-sm
          fixed inset-y-0 left-0 z-40 h-dvh w-80 max-w-[85vw] rounded-r-2xl border-r
          md:sticky md:top-[56px] md:z-auto md:h-[calc(100dvh-56px-12px)] md:mt-3 md:rounded-xl md:border
          md:max-w-none
          transition-all duration-300 ease-in-out
          ${open ? "translate-x-0" : "-translate-x-full"}
          md:translate-x-0
          ${collapsed ? "md:w-[72px]" : "md:w-80"}
        `}
        aria-label="Sidebar"
      >
        {/* Mobile header - logo + close */}
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3 md:hidden shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <Logo className="size-8 shrink-0" />
            <span className="text-sm font-bold tracking-tight text-primary truncate">
              {settings.companyName || "Attendance Portal"}
            </span>
          </div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="inline-flex size-8 items-center justify-center rounded-xl hover:bg-secondary/50 text-slate-600 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable nav */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 md:p-4 scrollbar-thin">
          <ul className="space-y-1">
            {/* 1. Overview */}
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission={["dashboard", "reports", "audit-logs"]}>
              <div
                className={`${collapsed ? "hidden md:block" : ""} pt-1 pb-1.5 px-3 text-[10px] font-bold text-primary/60 uppercase tracking-widest md:block`}
              >
                <span className={`${collapsed ? "md:hidden" : ""}`}>Overview</span>
                {collapsed && <div className="hidden md:block mx-auto h-px w-8 bg-border" />}
              </div>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="dashboard">
              <li>
                <NavLink to="/admin" end className={navClass} onClick={handleNavClick} title={collapsed ? "Dashboard" : undefined}>
                  <LayoutDashboard className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Dashboard</span>
                </NavLink>
              </li>
            </AllowAccess>

            <AllowAccess role={["super_admin", "hr_admin"]} permission="reports">
              <li>
                <NavLink to="/admin/reports" className={navClass} onClick={handleNavClick} title={collapsed ? "Reports" : undefined}>
                  <FileText className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Reports</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin"]} permission="audit-logs">
              <li>
                <NavLink to="/admin/audit-logs" className={navClass} onClick={handleNavClick} title={collapsed ? "Audit History" : undefined}>
                  <History className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Audit History</span>
                </NavLink>
              </li>
            </AllowAccess>

            {/* 2. Staff Management */}
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission={["users", "employees", "departments", "designations", "branches"]}>
              <div className={`pt-4 pb-1.5 px-3 text-[10px] font-bold text-primary/60 uppercase tracking-widest ${collapsed ? "md:hidden" : ""}`}>
                Staff Management
              </div>
              {collapsed && <div className="hidden md:block pt-3 pb-1"><div className="mx-auto h-px w-8 bg-border" /></div>}
            </AllowAccess>

            <AllowAccess role={["super_admin", "hr_admin"]} permission="users">
              <li>
                <NavLink to="/admin/users" className={navClass} onClick={handleNavClick} title={collapsed ? "Users" : undefined}>
                  <Users className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Users</span>
                </NavLink>
              </li>
            </AllowAccess>

            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="employees">
              <li>
                <NavLink to="/admin/employees" className={navClass} onClick={handleNavClick} title={collapsed ? "Employees" : undefined}>
                  <UserRound className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Employees</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin"]} permission="departments">
              <li>
                <NavLink to="/admin/departments" className={navClass} onClick={handleNavClick} title={collapsed ? "Departments" : undefined}>
                  <Building2 className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Departments</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin"]} permission="designations">
              <li>
                <NavLink to="/admin/designations" className={navClass} onClick={handleNavClick} title={collapsed ? "Designations" : undefined}>
                  <BriefcaseBusiness className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Designations</span>
                </NavLink>
              </li>
            </AllowAccess>

            <AllowAccess role="super_admin" permission="branches">
              <li>
                <NavLink to="/admin/branches" className={navClass} onClick={handleNavClick} title={collapsed ? "Branches" : undefined}>
                  <MapPin className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Branches</span>
                </NavLink>
              </li>
            </AllowAccess>

            {/* 3. Operations */}
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission={["attendance", "notifications", "leave", "corrections", "holidays", "events", "calendar"]}>
              <div className={`pt-4 pb-1.5 px-3 text-[10px] font-bold text-primary/60 uppercase tracking-widest ${collapsed ? "md:hidden" : ""}`}>
                Operations
              </div>
              {collapsed && <div className="hidden md:block pt-3 pb-1"><div className="mx-auto h-px w-8 bg-border" /></div>}
            </AllowAccess>

            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="attendance">
              <li>
                <NavLink to="/admin/attendance" className={navClass} onClick={handleNavClick} title={collapsed ? "Attendance" : undefined}>
                  <CalendarCheck className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Attendance</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="notifications">
              <li>
                <NavLink to="/admin/notifications" className={navClass} onClick={handleNavClick} title={collapsed ? "Notifications" : undefined}>
                  <Bell className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Notifications</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="leave">
              <li>
                <NavLink to="/admin/leave" className={navClass} onClick={handleNavClick} title={collapsed ? "Leave Requests" : undefined}>
                  <ClipboardList className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Leave Requests</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="corrections">
              <li>
                <NavLink to="/admin/corrections" className={navClass} onClick={handleNavClick} title={collapsed ? "Corrections" : undefined}>
                  <Wrench className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Corrections</span>
                </NavLink>
              </li>
            </AllowAccess>
            {/* personal calendar - super_admin lai permission tick chahinxa, hr_admin/manager le sabai */}
            <AllowAccess role={["super_admin", "hr_admin", "manager"]} permission="calendar">
              <li>
                <NavLink to="/admin/calendar" className={navClass} onClick={handleNavClick} title={collapsed ? "My Calendar" : undefined}>
                  <Calendar className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>My Calendar</span>
                </NavLink>
              </li>
            </AllowAccess>

            <AllowAccess role={["super_admin", "hr_admin"]} permission="holidays">
              <li>
                <NavLink to="/admin/holidays" className={navClass} onClick={handleNavClick} title={collapsed ? "Holidays" : undefined}>
                  <CalendarDays className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Holidays</span>
                </NavLink>
              </li>
            </AllowAccess>
            <AllowAccess role={["super_admin", "hr_admin"]} permission="events">
              <li>
                <NavLink to="/admin/events" className={navClass} onClick={handleNavClick} title={collapsed ? "Events" : undefined}>
                  <PartyPopper className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Events</span>
                </NavLink>
              </li>
            </AllowAccess>

            {/* 4. Configuration */}
            <AllowAccess role="super_admin" permission={["settings"]}>
              <div className={`pt-4 pb-1.5 px-3 text-[10px] font-bold text-primary/60 uppercase tracking-widest ${collapsed ? "md:hidden" : ""}`}>
                Configuration
              </div>
              {collapsed && <div className="hidden md:block pt-3 pb-1"><div className="mx-auto h-px w-8 bg-border" /></div>}
            </AllowAccess>
            <AllowAccess role="super_admin" permission="settings">
              <li>
                <NavLink to="/admin/settings" className={navClass} onClick={handleNavClick} title={collapsed ? "Settings" : undefined}>
                  <Settings className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Settings</span>
                </NavLink>
              </li>
            </AllowAccess>

            {/* employee workspace */}
            <AllowAccess role="employee">
              <div className={`pt-1 pb-1.5 px-3 text-[10px] font-bold text-primary/60 uppercase tracking-widest ${collapsed ? "md:hidden" : ""}`}>
                My Workspace
              </div>
              {collapsed && <div className="hidden md:block pt-1 pb-1"><div className="mx-auto h-px w-8 bg-border" /></div>}
              <li>
                <NavLink to="/employee" end className={navClass} onClick={handleNavClick} title={collapsed ? "My Dashboard" : undefined}>
                  <Home className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>My Dashboard</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/employee/calendar" className={navClass} onClick={handleNavClick} title={collapsed ? "My Calendar" : undefined}>
                  <Calendar className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>My Calendar</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/employee/leaves" className={navClass} onClick={handleNavClick} title={collapsed ? "My Leaves" : undefined}>
                  <Plane className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>My Leaves</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/employee/events" className={navClass} onClick={handleNavClick} title={collapsed ? "Company Events" : undefined}>
                  <PartyPopper className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Company Events</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/employee/notifications" className={navClass} onClick={handleNavClick} title={collapsed ? "Notifications" : undefined}>
                  <Bell className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Notifications</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/employee/corrections" className={navClass} onClick={handleNavClick} title={collapsed ? "Request Correction" : undefined}>
                  <Wrench className="size-4 shrink-0" />
                  <span className={`${collapsed ? "md:hidden" : ""} truncate`}>Request Correction</span>
                </NavLink>
              </li>
            </AllowAccess>

            {/* Persistent Install App — employee-only, always visible when not installed */}
            <AllowAccess role="employee">
              {!pwa.isInstalled && (
                <li className="pt-3">
                  <button
                    type="button"
                    onClick={handlePwaInstallClick}
                    title={collapsed ? "Install App" : undefined}
                    className={`${navClass({ isActive: false })} w-full text-left border border-dashed border-primary/20 bg-secondary/30 hover:bg-secondary/50 hover:border-primary/30`}
                  >
                    <span className={`flex items-center justify-center rounded-lg bg-primary text-white ${collapsed ? "size-7" : "size-7"} shrink-0`}>
                      {pwa.canPrompt ? <Download size={14} /> : <Smartphone size={14} />}
                    </span>
                    <span className={`${collapsed ? "md:hidden" : ""} truncate flex-1 text-left`}>
                      {pwa.canPrompt ? "Install App" : "Get App"}
                    </span>
                    <span className={`${collapsed ? "md:hidden" : ""} text-[10px] font-bold text-primary/60`}>{pwa.canPrompt ? "Install" : "Guide"}</span>
                  </button>
                </li>
              )}
            </AllowAccess>
          </ul>
        </div>

        {/* PWA install — employee-only; hidden on desktop when collapsed, always in mobile drawer */}
        <div className={`shrink-0 border-t border-border p-3 ${collapsed ? "block md:hidden" : "block"}`}>
          <PWAInstallBanner variant="sidebar" />
        </div>
        {/* when collapsed on desktop show a tiny install icon hint */}
        {collapsed && (
          <div className="hidden md:flex shrink-0 justify-center border-t border-border p-2">
            <PWAInstallBanner variant="sidebar" />
          </div>
        )}

        {/* Collapse toggle - desktop only */}
        <div className="hidden md:flex shrink-0 items-center border-t border-border p-2">
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-secondary/40 hover:text-primary transition-colors"
            title={collapsed ? "Expand" : "Collapse"}
          >
            {collapsed ? <ChevronRight size={18} /> : <><ChevronLeft size={18} /><span className="text-xs">Collapse</span></>}
          </button>
        </div>
      </aside>
    </>
  );
};
