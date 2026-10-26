import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import axiosInstance from "../../config/ApiClient";

interface IDepartment {
    _id: string;
    name: string;
    code: string;
    description?: string;
    status: "active" | "inactive";
    createdAt?: string;
    updatedAt?: string;
}

interface IDepartmentState {
    departmentList: IDepartment[];
    selectedDepartment: IDepartment | null;
    loading: boolean;
}

const initialState: IDepartmentState = {
    departmentList: [],
    selectedDepartment: null,
    loading: false,
};

export const getDepartments = createAsyncThunk(
    "department/getDepartments",
    async () => {
        const response = await axiosInstance.get("/departments");
        return response.data;
    },
);

export const getDepartment = createAsyncThunk(
    "department/getDepartment",
    async (id: string) => {
        const response = await axiosInstance.get(`/departments/${id}`);
        return response.data;
    },
);

export const createDepartment = createAsyncThunk(
    "department/createDepartment",
    async (data: Partial<IDepartment>) => {
        const response = await axiosInstance.post("/departments", data);
        return response.data;
    },
);

export const updateDepartment = createAsyncThunk(
    "department/updateDepartment",
    async ({ id, data }: { id: string; data: Partial<IDepartment> }) => {
        const response = await axiosInstance.put(`/departments/${id}`, data);
        return response.data;
    },
);

export const deleteDepartment = createAsyncThunk(
    "department/deleteDepartment",
    async (id: string) => {
        await axiosInstance.delete(`/departments/${id}`);
        return id;
    },
);

const DepartmentSlice = createSlice({
    name: "department",
    initialState,
    reducers: {
        clearSelectedDepartment: (state) => {
            state.selectedDepartment = null;
        },
    },
    extraReducers: (builder) => {
        builder
            .addCase(getDepartments.pending, (state) => {
                state.loading = true;
            })
            .addCase(getDepartments.fulfilled, (state, action) => {
                state.loading = false;
                state.departmentList = action.payload;
            })
            .addCase(getDepartments.rejected, (state) => {
                state.loading = false;
            })
            .addCase(createDepartment.fulfilled, (state, action) => {
                state.departmentList.unshift(action.payload);
            })
            .addCase(deleteDepartment.fulfilled, (state, action) => {
                state.departmentList = state.departmentList.filter(
                    (department) => department._id !== action.payload,
                );
            });
    },
});

export const { clearSelectedDepartment } = DepartmentSlice.actions;
export default DepartmentSlice.reducer;
