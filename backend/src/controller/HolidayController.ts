import type { Request, Response, NextFunction } from "express";
import HolidayService from "../services/HolidayService.js";

class HolidayController {
    getAll = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const holidays = await HolidayService.getAllHolidays();

            res.json({
                data: holidays,
                message: "Holidays fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getById = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid holiday ID" };
            }

            const holiday = await HolidayService.getHolidayById(id);

            if (!holiday) {
                throw { code: 404, message: "Holiday not found" };
            }

            res.json({
                data: holiday,
                message: "Holiday fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    create = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const holiday = await HolidayService.createHoliday({
                ...req.body,
                createdBy: req.loggedInUser?._id,
            });

            res.status(201).json({
                data: holiday,
                message: "Holiday created successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    update = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid holiday ID" };
            }

            const holiday = await HolidayService.updateHoliday(id, {
                ...req.body,
                updatedBy: req.loggedInUser?._id,
            });

            if (!holiday) {
                throw { code: 404, message: "Holiday not found" };
            }

            res.json({
                data: holiday,
                message: "Holiday updated successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    delete = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { id } = req.params;

            if (Array.isArray(id)) {
                throw { code: 400, message: "Invalid holiday ID" };
            }

            const holiday = await HolidayService.deleteHoliday(id);

            if (!holiday) {
                throw { code: 404, message: "Holiday not found" };
            }

            res.json({
                data: null,
                message: "Holiday deleted successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };

    getUpcoming = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const holidays = await HolidayService.getUpcomingHolidays(30);

            res.json({
                data: holidays,
                message: "Upcoming holidays fetched successfully",
                meta: null,
            });
        } catch (error) {
            next(error);
        }
    };
}

export default HolidayController;
