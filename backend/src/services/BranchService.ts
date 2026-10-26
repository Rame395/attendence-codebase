import BranchModel from "../model/BranchModel.js";

class BranchService {
    static async getAllBranches() {
        return await BranchModel.find().sort({ createdAt: -1 });
    }

    static async getBranchById(id: string) {
        return await BranchModel.findById(id);
    }

    static async createBranch(data: any) {
        return await BranchModel.create(data);
    }

    static async updateBranch(id: string, data: any) {
        return await BranchModel.findByIdAndUpdate(id, data, {
            new: true,
            runValidators: true,
        });
    }

    static async deleteBranch(id: string) {
        return await BranchModel.findByIdAndDelete(id);
    }
}

export default BranchService;
