import type { Request, Response, NextFunction } from "express";
import CompanySettingModel from "../model/CompanySettingModel.js";
import AuditLogService from "../services/AuditLogService.js";

// yo controller le company settings manage garxa
class CompanySettingController {

  // settings get garxa
  getSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = await CompanySettingModel.findOne().sort({ createdAt: -1 }).lean();

      // legacy/khalli 0 values lai sane default ma fallback garne (0 hunu sakaina)
      if (settings) {
        if (!settings.lateGracePeriodMinutes || settings.lateGracePeriodMinutes <= 0) {
          settings.lateGracePeriodMinutes = 15;
        }
        if (!settings.minimumWorkingMinutes || settings.minimumWorkingMinutes <= 0) {
          settings.minimumWorkingMinutes = 240;
        }
      }

      res.json({
        data: settings || null,
        message: "Settings fetched successfully",
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };

  // settings create ya update garxa
  updateSettings = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        companyName,
        workingStartTime,
        workingEndTime,
        lateGracePeriodMinutes,
        minimumWorkingMinutes,
        leaveCountsTowardAttendance,
        weeklyHolidays,
        brandColor,
      } = req.body;

      const userId = req.loggedInUser?._id;

      const oldSettings = await CompanySettingModel.findOne().sort({ createdAt: -1 }).lean();

      // ---- validation ----
      // company name limit: 60 characters
      if (companyName !== undefined && typeof companyName === "string" && companyName.trim().length > 60) {
        throw { code: 422, message: "Company name cannot be longer than 60 characters." };
      }
      // office start/end time: euta matra update garda pani aru khali nahos ra sama nahos
      const startTime = workingStartTime ?? (oldSettings as any)?.workingStartTime;
      const endTime = workingEndTime ?? (oldSettings as any)?.workingEndTime;
      const timeRe = /^([01]?\d|2[0-3]):[0-5]\d$/;

      if (workingStartTime !== undefined || workingEndTime !== undefined) {
        const startEmpty = typeof workingStartTime === "string" && workingStartTime.trim() === "";
        const endEmpty = typeof workingEndTime === "string" && workingEndTime.trim() === "";
        if (startEmpty || endEmpty) {
          throw { code: 422, message: "Office start time and end time are required." };
        }
        if (
          typeof startTime !== "string" || !timeRe.test(startTime) ||
          typeof endTime !== "string" || !timeRe.test(endTime)
        ) {
          throw { code: 422, message: "Office start and end time must be in HH:mm format (e.g. 09:30)." };
        }
        if (String(startTime).trim() === String(endTime).trim()) {
          throw {
            code: 422,
            message: "Office start time and end time cannot be the same. Choose different hours (overnight shifts like 22:00 – 06:00 are fine).",
          };
        }
      }

      // grace period + minimum working time: khali bhanda required, zero/negative impossible
      if (lateGracePeriodMinutes !== undefined) {
        const graceNum = Number(lateGracePeriodMinutes);
        if (String(lateGracePeriodMinutes).trim() === "" || graceNum === 0) {
          throw { code: 422, message: "Late grace period is required." };
        }
        if (!Number.isFinite(graceNum) || graceNum < 0) {
          throw { code: 422, message: "Late grace period must be greater than 0 minutes." };
        }
      }
      if (minimumWorkingMinutes !== undefined) {
        const minNum = Number(minimumWorkingMinutes);
        if (String(minimumWorkingMinutes).trim() === "" || minNum === 0) {
          throw { code: 422, message: "Minimum working minutes is required." };
        }
        if (!Number.isFinite(minNum) || minNum < 0) {
          throw { code: 422, message: "Minimum working time must be greater than 0 minutes." };
        }
      }
      // ---- validation end ----

      // existing settings chaina bhane create, cha bhane update ($set/$setOnInsert eutai field naupaos)
      const settings = await CompanySettingModel.findOneAndUpdate(
        {},
        {
          $set: {
            ...(companyName && { companyName }),
            ...(workingStartTime && { workingStartTime }),
            ...(workingEndTime && { workingEndTime }),
            ...(lateGracePeriodMinutes !== undefined && { lateGracePeriodMinutes }),
            ...(minimumWorkingMinutes !== undefined && { minimumWorkingMinutes }),
            ...(leaveCountsTowardAttendance !== undefined && { leaveCountsTowardAttendance }),
            ...(weeklyHolidays && { weeklyHolidays }),
            ...(brandColor && { brandColor: String(brandColor).toUpperCase() }),
            updatedBy: userId,
          },
          $setOnInsert: {
            // insert bela matra chahiyo, ra $set ma companyName cha bhane duplicate hudaina
            ...(companyName ? {} : { companyName: "My Company" }),
            createdBy: userId,
          },
        },
        {
          returnDocument: "after",
          upsert: true,
          runValidators: true,
        },
      );

      // audit log - settings changed
      await AuditLogService.logAction(
        userId?.toString(),
        "Settings Updated",
        "settings",
        {
          targetId: (settings as any)?._id?.toString(),
          oldData: oldSettings
            ? {
                workingStartTime: (oldSettings as any).workingStartTime,
                workingEndTime: (oldSettings as any).workingEndTime,
                lateGracePeriodMinutes: (oldSettings as any).lateGracePeriodMinutes,
                minimumWorkingMinutes: (oldSettings as any).minimumWorkingMinutes,
                weeklyHolidays: (oldSettings as any).weeklyHolidays,
                brandColor: (oldSettings as any).brandColor,
              }
            : null,
          newData: {
            companyName,
            workingStartTime,
            workingEndTime,
            lateGracePeriodMinutes,
            minimumWorkingMinutes,
            leaveCountsTowardAttendance,
            weeklyHolidays,
            brandColor,
          },
          ipAddress: req.ip,
        },
      );

      res.json({
        data: settings,
        message: "Settings saved successfully",
        meta: null,
      });
    } catch (error) {
      next(error);
    }
  };
}

export default CompanySettingController;
