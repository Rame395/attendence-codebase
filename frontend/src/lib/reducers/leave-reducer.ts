import {
    createAsyncThunk,
    createSlice,
} from "@reduxjs/toolkit";

import axiosInstance from "../../config/ApiClient";

export interface ILeaveRequest {
    _id: string;
    employee:
        | string
        | {
            _id: string;
            name: string;
            email: string;
            employeeId: string;
        };
    leaveType: string;
    startDate: string;
    endDate: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    updatedAt: string;
}

interface ILeaveState {
    leaveList: ILeaveRequest[] | null;
    myLeaves: ILeaveRequest[] | null;
    loading: boolean;
}

export const getLeaves = createAsyncThunk(
    "leave/getLeaves",
    async () => {
        const response = await axiosInstance.get("/leaves");
        return response.data;
    },
);

export const getMyLeaves = createAsyncThunk(
    "leave/getMyLeaves",
    async () => {
        const response = await axiosInstance.get("/leaves/my");
        return response.data;
    },
);

export const createLeave = createAsyncThunk(
    "leave/createLeave",
    async (data: {
        leaveType: string;
        startDate: string;
        endDate: string;
        reason: string;
    }) => {
        const response = await axiosInstance.post("/leaves", data);
        return response.data;
    },
);

export const approveLeave = createAsyncThunk(
    "leave/approveLeave",
    async ({
        id,
        status,
    }: {
        id: string;
        status: "approved" | "rejected";
    }) => {
        const response = await axiosInstance.put(`/leaves/${id}/approve`, {
            status,
        });
        return response.data;
    },
);

export const deleteLeave = createAsyncThunk(
    "leave/deleteLeave",
    async (id: string) => {
        await axiosInstance.delete(`/leaves/${id}`);
        return id;
    },
);

const LeaveSlice = createSlice({
    name: "leave",
    initialState: {
        leaveList: null,
        myLeaves: null,
        loading: false,
    } as ILeaveState,

    reducers: {},

    extraReducers: (builder) => {
        builder
            .addCase(getLeaves.pending, (state) => {
                state.loading = true;
            })
            .addCase(getLeaves.fulfilled, (state, action) => {
                state.loading = false;
                state.leaveList = action.payload;
            })
            .addCase(getLeaves.rejected, (state) => {
                state.loading = false;
                state.leaveList = [];
            })

            .addCase(getMyLeaves.pending, (state) => {
                state.loading = true;
            })
            .addCase(getMyLeaves.fulfilled, (state, action) => {
                state.loading = false;
                state.myLeaves = action.payload;
            })
            .addCase(getMyLeaves.rejected, (state) => {
                state.loading = false;
                state.myLeaves = [];
            })

            .addCase(createLeave.fulfilled, (state, action) => {
                if (state.myLeaves) {
                    state.myLeaves.unshift(action.payload);
                }
            })

            .addCase(approveLeave.fulfilled, (state, action) => {
                if (state.leaveList) {
                    const index = state.leaveList.findIndex(
                        (leave) => leave._id === action.payload._id
                    );
                    if (index !== -1) {
                        state.leaveList[index] = action.payload;
                    }
                }
            })

            .addCase(deleteLeave.fulfilled, (state, action) => {
                if (state.myLeaves) {
                    state.myLeaves = state.myLeaves.filter(
                        (leave) => leave._id !== action.payload
                    );
                }
            });
    },
});

export default LeaveSlice.reducer;
