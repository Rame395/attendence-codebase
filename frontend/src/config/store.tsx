import { configureStore } from "@reduxjs/toolkit";
import authReducer from "../lib/reducers/auth-reducer";
import departmentReducer from "../lib/reducers/department-reducer";
import employeeReducer from "../lib/reducers/employee-reducer";
import leaveReducer from "../lib/reducers/leave-reducer";
import holidayReducer from "../lib/reducers/holiday-reducer";
import eventReducer from "../lib/reducers/event-reducer";
import companySettingReducer from "../lib/reducers/companySetting-reducer";

const store = configureStore({
  reducer: {
    auth: authReducer,
    department: departmentReducer,
    employee: employeeReducer,
    leave: leaveReducer,
    holiday: holidayReducer,
    event: eventReducer,
    companySetting: companySettingReducer,
  },
});

export type AppDispatch = typeof store.dispatch;
export type RootState = ReturnType<typeof store.getState>;
export default store;