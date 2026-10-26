import UserModel from "../model/UserModel.js";
import EmployeeModel from "../model/EmployeeModel.js";

// Branch-scoped hr_admin le aafno branch matra herna/add pauxa; manager team-scoped ho; aru roles null = sabai
export async function getRequesterBranchId(loggedInUser: any): Promise<string | null> {
  try {
    if (!loggedInUser) return null;
    if (loggedInUser.role !== "hr_admin") return null;
    const user: any = await UserModel.findById(loggedInUser._id).select("employee").lean();
    const empId = user?.employee;
    if (!empId) return null;
    const emp: any = await EmployeeModel.findById(empId).select("branch").lean();
    const b: any = emp?.branch;
    if (!b) return null;
    return typeof b === "string" ? b : b.toString();
  } catch {
    // lookup fail bhaye open (existing behavior) - request lai block nagarne
    return null;
  }
}

// manager ko aafnai employee _id (team identify garna); natra null
export async function getRequesterEmployeeId(loggedInUser: any): Promise<string | null> {
  try {
    if (!loggedInUser || loggedInUser.role !== "manager") return null;
    const user: any = await UserModel.findById(loggedInUser._id).select("employee").lean();
    if (!user?.employee) return null;
    return user.employee.toString();
  } catch {
    // lookup fail bhaye open (existing behavior) - request lai block nagarne
    return null;
  }
}

// manager ko direct reports ko employee _id haru - manager hoina bhane null
export async function getDirectReportIds(loggedInUser: any): Promise<string[] | null> {
  const mgrEmpId = await getRequesterEmployeeId(loggedInUser);
  if (!mgrEmpId) return null;
  const reports: any[] = await EmployeeModel.find({ manager: mgrEmpId }).select("_id").lean();
  return reports.map((r: any) => r._id.toString());
}

// record ko employee aafno team ko ho ki - populated object ({_id}) wa raw ObjectId/string duitai
export async function assertEmployeeInTeam(
  recordEmployee: any,
  loggedInUser: any,
  message = "Access denied: this employee is not in your team",
) {
  const mgrEmpId = await getRequesterEmployeeId(loggedInUser);
  if (!mgrEmpId) return;
  const empId = !recordEmployee
    ? ""
    : typeof recordEmployee === "string"
      ? recordEmployee
      : (recordEmployee._id?.toString?.() || recordEmployee.toString());
  if (!empId) throw { code: 403, message };
  const isReport = await EmployeeModel.exists({ _id: empId, manager: mgrEmpId });
  if (!isReport) throw { code: 403, message };
}

// record branch scope vitra chha - bahira 403
export function assertInScope(recordBranch: any, scopeBranchId: string | null, message = "Access denied for this branch") {
  if (!scopeBranchId) return;
  const rb = !recordBranch
    ? null
    : typeof recordBranch === "string"
      ? recordBranch
      : (recordBranch._id?.toString?.() || recordBranch.toString());
  if (rb !== scopeBranchId) throw { code: 403, message };
}
