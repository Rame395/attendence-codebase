import HolidayModel from "../model/HolidayModel.js";

class HolidayService {
    static async getAllHolidays(filter: any = {}) {
        return await HolidayModel.find(filter)
            .populate("branches", "name code")
            .populate("departments", "name")
            .populate("createdBy", "email")
            .sort({ startDate: 1 });
    }

    static async getHolidayById(id: string) {
        return await HolidayModel.findById(id)
            .populate("branches", "name code")
            .populate("departments", "name")
            .populate("createdBy", "email");
    }

    static async createHoliday(data: any) {
        // end date start bhanda agadi huna mildaina
        if (new Date(data.endDate) < new Date(data.startDate)) {
            throw { code: 422, message: "End date must be after or equal to start date" };
        }
        return await HolidayModel.create(data);
    }

    static async updateHoliday(id: string, data: any) {
        if (data.startDate && data.endDate && new Date(data.endDate) < new Date(data.startDate)) {
            throw { code: 422, message: "End date must be after or equal to start date" };
        }
        return await HolidayModel.findByIdAndUpdate(id, data, { new: true })
            .populate("branches", "name code")
            .populate("departments", "name")
            .populate("createdBy", "email");
    }

    static async deleteHoliday(id: string) {
        return await HolidayModel.findByIdAndDelete(id);
    }

    static async getUpcomingHolidays(days: number = 30) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const future = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

        // holiday ko kunai pani din aaja - future window bhitra parne
        return await HolidayModel.find({
            startDate: { $lte: future },
            endDate: { $gte: today },
        })
            .populate("branches", "name code")
            .populate("departments", "name")
            .sort({ startDate: 1 });
    }
}

export default HolidayService;
