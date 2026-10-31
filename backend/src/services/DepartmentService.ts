import DepartmentModel from "../model/DepartmentModel.js";

class DepartmentService {
    private static stripEmpty(data: Record<string, unknown>) {
        return Object.fromEntries(Object.entries(data).filter(([k, v]) => k === "description" || v !== ""));
    }

    static async getAllDepartments(branch?: string | null) {
        const filter: Record<string, unknown> = {};
        if (branch) filter.branch = branch;
        return await DepartmentModel.find(filter)
            .populate("branch", "name code")
            .sort({ createdAt: -1 });
    }

    static async getDepartmentById(id: string) {
        return await DepartmentModel.findById(id);
    }

    static async createDepartment(data: any) {
        return await DepartmentModel.create(this.stripEmpty(data));
    }

    static async updateDepartment(id: string, data: any) {
        return await DepartmentModel.findByIdAndUpdate(id, this.stripEmpty(data), {
            new: true,
            runValidators: true,
        });
    }

    static async deleteDepartment(id: string) {
        return await DepartmentModel.findByIdAndDelete(id);
    }
}

export default DepartmentService;
