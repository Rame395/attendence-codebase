import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance from "../../config/ApiClient";

export interface ICompanySettings {
  companyName: string;
  workingStartTime: string;
  workingEndTime: string;
  lateGracePeriodMinutes: number;
  minimumWorkingMinutes: number;
  leaveCountsTowardAttendance: boolean;
  weeklyHolidays: string[];
  brandColor: string;
}

interface ICompanySettingState {
  settings: ICompanySettings;
  loading: boolean;
}

const defaults: ICompanySettings = {
  companyName: "",
  workingStartTime: "10:00",
  workingEndTime: "18:00",
  lateGracePeriodMinutes: 15,
  minimumWorkingMinutes: 240,
  leaveCountsTowardAttendance: true,
  weeklyHolidays: ["saturday"],
  brandColor: "#28469E",
};

const initialState: ICompanySettingState = {
  settings: defaults,
  loading: true,
};

export const fetchCompanySettings = createAsyncThunk(
  "companySetting/fetch",
  async (_, { rejectWithValue }) => {
    try {
      const res = (await axiosInstance.get("/company-settings")) as unknown as { data: Partial<ICompanySettings> | null };
      const d = res.data;
      if (!d) return defaults;
      return {
        companyName: d.companyName || "",
        workingStartTime: d.workingStartTime || "10:00",
        workingEndTime: d.workingEndTime || "18:00",
        lateGracePeriodMinutes: d.lateGracePeriodMinutes ?? 15,
        minimumWorkingMinutes: d.minimumWorkingMinutes ?? 240,
        leaveCountsTowardAttendance: d.leaveCountsTowardAttendance ?? true,
        weeklyHolidays: d.weeklyHolidays || ["saturday"],
        brandColor: d.brandColor || "#28469E",
      } as ICompanySettings;
    } catch {
      return rejectWithValue("Failed to fetch settings");
    }
  },
);

const CompanySettingReducer = createSlice({
  name: "companySetting",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCompanySettings.pending, (state) => {
        state.loading = true;
      })
      .addCase(fetchCompanySettings.fulfilled, (state, action) => {
        state.settings = action.payload;
        state.loading = false;
      })
      .addCase(fetchCompanySettings.rejected, (state) => {
        state.loading = false;
      });
  },
});

export default CompanySettingReducer.reducer;
