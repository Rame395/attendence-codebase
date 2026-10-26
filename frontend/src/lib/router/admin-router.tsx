import Dashboard from "../../pages/admin/Dashboard";
import DepartmentList from "../../pages/departments/DepartmentList";
import Users from "../../pages/admin/Users";
import Employees from "../../pages/admin/Employees";
import Attendance from "../../pages/admin/Attendance";
import Leave from "../../pages/admin/Leave";
import Holidays from "../../pages/admin/Holidays";
import Events from "../../pages/admin/Events";
import Designations from "../../pages/admin/Designations";
import Branches from "../../pages/admin/Branches";
import Settings from "../../pages/admin/Settings";
import MyProfile from "../../pages/admin/MyProfile";
import MyCalendar from "../../pages/employee/MyCalendar";
import Reports from "../../pages/admin/Reports";
import Corrections from "../../pages/admin/Corrections";
import AuditLogs from "../../pages/admin/AuditLogs";
import Notifications from "../../pages/employee/Notifications";
import AdminLayout from "../../layouts/AdminLayout";
import ProtectedRoute from "../../components/auth/ProtectedRoute";

export const AdminRouter = [
  {
    // /admin super_admin/hr_admin/manager matra - employee lai /employee, platform_admin lai /PlatformAdmin pathaecha
    element: <ProtectedRoute allowedRoles={["platform_admin", "super_admin", "hr_admin", "manager"]} />,
    children: [
      {
        path: "/admin",
        Component: AdminLayout,
        children: [
          { index: true, element: <ProtectedRoute permission="dashboard"><Dashboard /></ProtectedRoute> },
          { path: "users", element: <ProtectedRoute permission="users" denyRoles={["manager"]}><Users /></ProtectedRoute> },
          { path: "employees", element: <ProtectedRoute permission="employees"><Employees /></ProtectedRoute> },
          { path: "attendance", element: <ProtectedRoute permission="attendance"><Attendance /></ProtectedRoute> },
          { path: "leave", element: <ProtectedRoute permission="leave"><Leave /></ProtectedRoute> },
          { path: "corrections", element: <ProtectedRoute permission="corrections"><Corrections /></ProtectedRoute> },
          { path: "holidays", element: <ProtectedRoute permission="holidays"><Holidays /></ProtectedRoute> },
          { path: "events", element: <ProtectedRoute permission="events"><Events /></ProtectedRoute> },
          { path: "designations", element: <ProtectedRoute permission="designations"><Designations /></ProtectedRoute> },
          { path: "branches", element: <ProtectedRoute permission="branches"><Branches /></ProtectedRoute> },
          { path: "settings", element: <ProtectedRoute permission="settings"><Settings /></ProtectedRoute> },
          { path: "departments", element: <ProtectedRoute permission="departments"><DepartmentList /></ProtectedRoute> },
          { path: "profile", Component: MyProfile },
          // personal calendar - super_admin lai "My Calendar" tick chahinxa, baki roles le sabai
          // employee lai /employee/calendar chhadei chha
          { path: "calendar", element: <ProtectedRoute permission="calendar"><MyCalendar /></ProtectedRoute> },
          { path: "reports", element: <ProtectedRoute permission="reports"><Reports /></ProtectedRoute> },
          { path: "audit-logs", element: <ProtectedRoute permission="audit-logs"><AuditLogs /></ProtectedRoute> },
          { path: "notifications", element: <ProtectedRoute permission="notifications" denyRoles={["platform_admin"]}><Notifications /></ProtectedRoute> },
          // (platform admin ko company management /PlatformAdmin ma - sidebar chhaina)
        ],
      },
    ],
  },
];
