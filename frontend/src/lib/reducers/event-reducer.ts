import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import axiosInstance from "../../config/ApiClient";

export interface IEvent {
    _id: string;
    title: string;
    description?: string;
    startDate: string;
    endDate: string;
    location?: string;
    isCompanyWide: boolean;
    createdAt: string;
    updatedAt: string;
}

interface IEventState {
    eventList: IEvent[] | null;
    upcomingEvents: IEvent[] | null;
    loading: boolean;
}

export const getEvents = createAsyncThunk(
    "event/getEvents",
    async () => {
        const response = await axiosInstance.get("/events");
        return response.data;
    },
);

export const getUpcomingEvents = createAsyncThunk(
    "event/getUpcomingEvents",
    async () => {
        const response = await axiosInstance.get("/events/upcoming");
        return response.data;
    },
);

export const createEvent = createAsyncThunk(
    "event/createEvent",
    async (data: {
        title: string;
        startDate: string;
        endDate: string;
        description?: string;
        location?: string;
        isCompanyWide?: boolean;
    }) => {
        const response = await axiosInstance.post("/events", data);
        return response.data;
    },
);

export const updateEvent = createAsyncThunk(
    "event/updateEvent",
    async ({
        id,
        data,
    }: {
        id: string;
        data: Partial<IEvent>;
    }) => {
        const response = await axiosInstance.put(`/events/${id}`, data);
        return response.data;
    },
);

export const deleteEvent = createAsyncThunk(
    "event/deleteEvent",
    async (id: string) => {
        await axiosInstance.delete(`/events/${id}`);
        return id;
    },
);

const EventSlice = createSlice({
    name: "event",
    initialState: {
        eventList: null,
        upcomingEvents: null,
        loading: false,
    } as IEventState,

    reducers: {},

    extraReducers: (builder) => {
        builder
            .addCase(getEvents.pending, (state) => {
                state.loading = true;
            })
            .addCase(getEvents.fulfilled, (state, action) => {
                state.loading = false;
                state.eventList = action.payload;
            })
            .addCase(getEvents.rejected, (state) => {
                state.loading = false;
                state.eventList = [];
            })

            .addCase(getUpcomingEvents.fulfilled, (state, action) => {
                state.upcomingEvents = action.payload;
            })

            .addCase(createEvent.fulfilled, (state, action) => {
                if (state.eventList) {
                    state.eventList.unshift(action.payload);
                }
            })

            .addCase(updateEvent.fulfilled, (state, action) => {
                if (state.eventList) {
                    const index = state.eventList.findIndex(
                        (event) => event._id === action.payload._id
                    );
                    if (index !== -1) {
                        state.eventList[index] = action.payload;
                    }
                }
            })

            .addCase(deleteEvent.fulfilled, (state, action) => {
                if (state.eventList) {
                    state.eventList = state.eventList.filter(
                        (event) => event._id !== action.payload
                    );
                }
            });
    },
});

export default EventSlice.reducer;
