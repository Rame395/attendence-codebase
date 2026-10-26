import DesignationModel from "../model/DesignationModel.js";

class DesignationService {
    private static stripEmpty(data: Record<string, unknown>) {
        return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== ""));
    }

    static async getAllDesignations(department?: string | null, branch?: string | null) {
        const filter: Record<string, unknown> = {};
        if (department) filter.department = department;
        if (branch) filter.branch = branch;
        return await DesignationModel.find(filter)
            .populate("department", "name code")
            .populate("branch", "name code")
            .sort({ createdAt: -1 });
    }

    static async getDesignationById(id: string) {
        return await DesignationModel.findById(id);
    }

    static async createDesignation(data: any) {
        return await DesignationModel.create(this.stripEmpty(data));
    }

    static async updateDesignation(id: string, data: any) {
        return await DesignationModel.findByIdAndUpdate(id, this.stripEmpty(data), {
            new: true,
            runValidators: true,
        });
    }

    static async deleteDesignation(id: string) {
        return await DesignationModel.findByIdAndDelete(id);
    }
}

export default DesignationService;
