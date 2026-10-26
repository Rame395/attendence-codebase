import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import axiosInstance from "../../config/ApiClient";


export interface IEmployee {

  _id: string;

  employeeId: string;

  name: string;

  email: string;

  phone: string;

  status: "active" | "inactive";

  createdAt: string;

  updatedAt: string;

}


interface IEmployeeState {

  employeeList:
    IEmployee[] | null;

  selectedEmployee:
    IEmployee | null;

  loading: boolean;

}


export const getEmployees =
  createAsyncThunk(
    "employee/getEmployees",

    async () => {

      const response =
        await axiosInstance.get(
          "/employees",
        );

      return response.data;

    },
  );


export const getEmployee =
  createAsyncThunk(
    "employee/getEmployee",

    async (id: string) => {

      const response =
        await axiosInstance.get(
          `/employees/${id}`,
        );

      return response.data;

    },
  );


export const updateEmployee =
  createAsyncThunk(
    "employee/updateEmployee",

    async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<IEmployee>;
    }) => {

      const response =
        await axiosInstance.put(
          `/employees/${id}`,
          data,
        );

      return response.data;

    },
  );


export const deleteEmployee =
  createAsyncThunk(
    "employee/deleteEmployee",

    async (id: string) => {

      await axiosInstance.delete(
        `/employees/${id}`,
      );

      return id;

    },
  );


const EmployeeSlice =
  createSlice({

    name: "employee",

    initialState: {

      employeeList: null,

      selectedEmployee: null,

      loading: false,

    } as IEmployeeState,


    reducers: {

      clearSelectedEmployee: (
        state,
      ) => {

        state.selectedEmployee = null;

      },

    },


    extraReducers: (builder) => {

      builder

        .addCase(
          getEmployees.pending,
          (state) => {

            state.loading = true;

          },
        )

        .addCase(
          getEmployees.fulfilled,
          (state, action) => {

            state.loading = false;

            state.employeeList =
              action.payload;

          },
        )

        .addCase(
          getEmployees.rejected,
          (state) => {

            state.loading = false;

            state.employeeList = [];

          },
        )


        .addCase(
          getEmployee.fulfilled,
          (state, action) => {

            state.selectedEmployee =
              action.payload;

          },
        )


        .addCase(
          updateEmployee.fulfilled,
          (state, action) => {

            if (
              state.employeeList
            ) {

              const index =
                state.employeeList.findIndex(
                  (employee) =>
                    employee._id ===
                    action.payload._id,
                );

              if (index !== -1) {

                state.employeeList[index] =
                  action.payload;

              }

            }

          },
        )


        .addCase(
          deleteEmployee.fulfilled,
          (state, action) => {

            if (
              state.employeeList
            ) {

              state.employeeList =
                state.employeeList.filter(
                  (employee) =>
                    employee._id !==
                    action.payload,
                );

            }

          },
        );

    },

  });


export const {
  clearSelectedEmployee,
} = EmployeeSlice.actions;


export default EmployeeSlice.reducer;