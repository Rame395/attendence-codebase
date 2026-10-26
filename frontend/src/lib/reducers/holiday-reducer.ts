import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import axiosInstance from "../../config/ApiClient";

export interface IHoliday {
    _id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    appliesTo: "all" | "branch" | "department";
    branches?: ({ _id: string; name: string; code: string } | string)[];
    departments?: ({ _id: string; name: string } | string)[];
    gender: "both" | "male" | "female";
    createdAt: string;
    updatedAt: string;
}

interface IHolidayState {
    holidayList: IHoliday[] | null;
    upcomingHolidays: IHoliday[] | null;
    loading: boolean;
}

export const getHolidays = createAsyncThunk(
    "holiday/getHolidays",
    async () => {
        const response = await axiosInstance.get("/holidays");
        return response.data;
    },
);

export const getUpcomingHolidays = createAsyncThunk(
    "holiday/getUpcomingHolidays",
    async () => {
        const response = await axiosInstance.get("/holidays/upcoming");
        return response.data;
    },
);

export const createHoliday = createAsyncThunk(
    "holiday/createHoliday",
    async (data: {
        title: string;
        date: string;
        description?: string;
        isCompanyWide?: boolean;
    }) => {
        const response = await axiosInstance.post("/holidays", data);
        return response.data;
    },
);

export const updateHoliday = createAsyncThunk(
    "holiday/updateHoliday",
    async ({
        id,
        data,
    }: {
        id: string;
        data: Partial<IHoliday>;
    }) => {
        const response = await axiosInstance.put(`/holidays/${id}`, data);
        return response.data;
    },
);

export const deleteHoliday = createAsyncThunk(
    "holiday/deleteHoliday",
    async (id: string) => {
        await axiosInstance.delete(`/holidays/${id}`);
        return id;
    },
);

const HolidaySlice = createSlice({
    name: "holiday",
    initialState: {
        holidayList: null,
        upcomingHolidays: null,
        loading: false,
    } as IHolidayState,

    reducers: {},

    extraReducers: (builder) => {
        builder
            .addCase(getHolidays.pending, (state) => {
                state.loading = true;
            })
            .addCase(getHolidays.fulfilled, (state, action) => {
                state.loading = false;
                state.holidayList = action.payload;
            })
            .addCase(getHolidays.rejected, (state) => {
                state.loading = false;
                state.holidayList = [];
            })

            .addCase(getUpcomingHolidays.fulfilled, (state, action) => {
                state.upcomingHolidays = action.payload;
            })

            .addCase(createHoliday.fulfilled, (state, action) => {
                if (state.holidayList) {
                    state.holidayList.unshift(action.payload);
                }
            })

            .addCase(updateHoliday.fulfilled, (state, action) => {
                if (state.holidayList) {
                    const index = state.holidayList.findIndex(
                        (holiday) => holiday._id === action.payload._id
                    );
                    if (index !== -1) {
                        state.holidayList[index] = action.payload;
                    }
                }
            })

            .addCase(deleteHoliday.fulfilled, (state, action) => {
                if (state.holidayList) {
                    state.holidayList = state.holidayList.filter(
                        (holiday) => holiday._id !== action.payload
                    );
                }
            });
    },
});

export default HolidaySlice.reducer;
