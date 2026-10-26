import PlatformDashboard from "../../pages/admin/PlatformDashboard";
import PlatformAdminLayout from "../../layouts/PlatformAdminLayout";
import ProtectedRoute from "../../components/auth/ProtectedRoute";

// platform admin ko ek page - totals + company table
export const PlatformAdminRouter = [
  {
    element: <ProtectedRoute ownerOnly />,
    children: [
      {
        path: "/PlatformAdmin",
        Component: PlatformAdminLayout,
        children: [
          { index: true, Component: PlatformDashboard },
        ],
      },
    ],
  },
];
