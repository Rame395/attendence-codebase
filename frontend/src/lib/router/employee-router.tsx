import AdminLayout from "../../layouts/AdminLayout";
import EmployeeDashboard from "../../pages/employee/EmployeeDashboard";
import MyCalendar from "../../pages/employee/MyCalendar";
import MyLeaves from "../../pages/employee/MyLeaves";
import Notifications from "../../pages/employee/Notifications";
import CompanyEvents from "../../pages/employee/CompanyEvents";
import RequestCorrection from "../../pages/employee/RequestCorrection";
import MyProfile from "../../pages/admin/MyProfile";
import ProtectedRoute from "../../components/auth/ProtectedRoute";

// employee workspace routes - common sidebar layout use garcha
export const EmployeeRouter = [
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: "/employee",
        Component: AdminLayout,
        children: [
          { index: true, Component: EmployeeDashboard },
          { path: "calendar", Component: MyCalendar },
          { path: "leaves", Component: MyLeaves },
          { path: "notifications", Component: Notifications },
          { path: "events", Component: CompanyEvents },
          { path: "corrections", Component: RequestCorrection },
          { path: "profile", Component: MyProfile },
        ],
      },
    ],
  },
];
