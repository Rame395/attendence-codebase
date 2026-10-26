import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";

import {
  PublicRouter,
} from "../lib/router/public-router";

import {
  AdminRouter,
} from "../lib/router/admin-router";

import {
  EmployeeRouter,
} from "../lib/router/employee-router";

import {
  PlatformAdminRouter,
} from "../lib/router/platform-router";

import NotFound
  from "../pages/error/NotFound";

import { setNavigate } from "./ApiClient";

const routerData = createBrowserRouter([

  ...PublicRouter,

  ...AdminRouter,

  ...EmployeeRouter,

  ...PlatformAdminRouter,

  // Design a 404 not found page
  { path: "*", Component: NotFound },

]);

setNavigate(routerData.navigate);


export default function RouterConfig() {
  return (
    <RouterProvider router={routerData} />
  );
}
