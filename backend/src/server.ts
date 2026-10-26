import http from "http";
import { connectDB } from "./config/db.js";
import app from "./app.js";
import SuperAdminService from "./services/SuperAdminService.js";
import CompanyService from "./services/CompanyService.js";
import { refreshTenantCache } from "./config/tenant.js";
import AbsenceJob from "./jobs/AbsenceJob.js";

const PORT: number = Number(process.env.PORT) || 9005;


const server = http.createServer(app);

// MongoDB connect pachi Super Admin, default company + login directory boot seed, ani server
connectDB
  .then(() => SuperAdminService.createDefaultPlatformAdmin())
  .then(() => CompanyService.initCompaniesCollection())
  .then(() => refreshTenantCache())
  .then(() => {
    // start absence job
    AbsenceJob.start();

    server.listen(PORT, () => {
      console.log(
        `Server is running on http://localhost:${PORT}`
      );
    });
  })
  .catch((error) => {
    console.error("Server startup failed:", error);
    process.exit(1);
  });

// Server error handling
server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.error(
      `PORT ${PORT} already in use. Try with a different PORT.`
    );
  } else {
    console.error("Server Error:", err.message);
  }

  process.exit(1);
});