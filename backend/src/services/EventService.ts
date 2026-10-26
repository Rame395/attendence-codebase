import EventModel from "../model/EventModel.js";
import { removeStoredFile } from "../utils/fileStorage.js";

class EventService {
    static async getAllEvents(filter: any = {}) {
        return await EventModel.find(filter)
            .populate("branch", "name code")
            .populate("department", "name code")
            .populate("employee", "name")
            .populate("createdBy", "email")
            .sort({ date: 1 });
    }

    static async getEventById(id: string) {
        return await EventModel.findById(id)
            .populate("branch", "name code")
            .populate("department", "name code")
            .populate("employee", "name")
            .populate("createdBy", "email");
    }

    static async createEvent(data: any) {
        return await EventModel.create(data);
    }

    static async updateEvent(id: string, data: any) {
        return await EventModel.findByIdAndUpdate(id, data, { new: true })
            .populate("branch", "name code")
            .populate("department", "name code")
            .populate("employee", "name")
            .populate("createdBy", "email");
    }

    static async deleteEvent(id: string) {
        const event = await EventModel.findById(id);
        if (!event) return null;

        // attachment file cha bhane disk bata hataune
        if (event.attachment) {
            await removeStoredFile(event.attachment);
        }

        return await EventModel.findByIdAndDelete(id);
    }

    // aaja dekhi aagaadi ka events
    static async getUpcomingEvents(days: number = 30) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const future = new Date(today.getTime() + days * 24 * 60 * 60 * 1000);

        return await EventModel.find({
            date: { $gte: today, $lte: future },
        })
            .populate("branch", "name code")
            .sort({ date: 1 });
    }
}

export default EventService;
