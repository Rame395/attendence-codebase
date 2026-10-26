import {
  createAsyncThunk,
  createSlice,
} from "@reduxjs/toolkit";

import Cookies from "js-cookie";
import axiosInstance from "../../config/ApiClient";
import { getErrorMessage } from "../getErrorMessage";
import { resetBrandColor } from "../hooks/useBrandTheme";

import type {
  ICredentials,
  ILoginResponse,
  IUserDetail,
} from "../../components/auth/Auth.contract";

interface IAuthState {
  authUser: IUserDetail | null;
  user: IUserDetail | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loading: boolean;
  error: string | null;
}

// cookie bata user data parse garxa
const getStoredUser = (): IUserDetail | null => {
  const token = Cookies.get("access_token");

  if (!token) {
    return null;
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name || null,
      role: payload.role,
      status: "active",
      mustChangePassword: payload.mustChangePassword || false,
      companyId: payload.company || null,
      companyDb: payload.companyDb || null,
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    } as IUserDetail;
  } catch {
    return null;
  }
};

const storedAuthUser = getStoredUser();
const storedToken = Cookies.get("access_token") || null;

const initialState: IAuthState = {
  authUser: storedAuthUser,
  user: storedAuthUser,
  accessToken: storedToken,
  isAuthenticated: !!storedToken,
  isLoading: false,
  loading: false,
  error: null,
};

export const loginUser = createAsyncThunk(
  "auth/loginUser",
  async (credentials: ICredentials, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/auth/login", credentials);
      return response.data as ILoginResponse;
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, "Login failed"),
      );
    }
  },
);

export const registerUser = createAsyncThunk(
  "auth/registerUser",
  async (data: Record<string, unknown>, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/auth/register", data);
      return response.data;
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, "Registration failed"),
      );
    }
  },
);

export const changeFirstPassword = createAsyncThunk(
  "auth/changeFirstPassword",
  async (newPassword: string, { rejectWithValue }) => {
    try {
      const response = await axiosInstance.post("/auth/change-first-password", {
        newPassword,
      });
      return response.data as ILoginResponse;
    } catch (error) {
      return rejectWithValue(
        getErrorMessage(error, "Failed to change password"),
      );
    }
  },
);

const AuthReducer = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      Cookies.remove("access_token");
      resetBrandColor(); // default blue ma farkaune (arko login samma)
      state.authUser = null;
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.loading = false;
      state.error = null;
    },

    clearAuthError: (state) => {
      state.error = null;
    },

    loadAuthFromStorage: (state) => {
      const token = Cookies.get("access_token") || null;
      const user = getStoredUser();
      state.accessToken = token;
      state.authUser = user;
      state.user = user;
      state.isAuthenticated = !!token;
    },

    // /auth/me bata fresh profile (permissions/company sahit) sync garne
    refreshAuthUser: (state, action: { payload: Partial<IUserDetail> }) => {
      if (!state.authUser) return;
      state.authUser = { ...state.authUser, ...action.payload };
      state.user = state.authUser;
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(loginUser.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.authUser = action.payload.user;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        // cookie ma token save garxa - 1 din ko lagi
        Cookies.set("access_token", action.payload.accessToken, {
          expires: 1,
          sameSite: "lax",
          secure: window.location.protocol === "https:",
        });
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.error = (action.payload as string) || "Login failed";
        state.isAuthenticated = false;
      })
      .addCase(registerUser.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(registerUser.fulfilled, (state) => {
        state.isLoading = false;
        state.loading = false;
      })
      .addCase(registerUser.rejected, (state) => {
        state.isLoading = false;
        state.loading = false;
      })
      .addCase(changeFirstPassword.pending, (state) => {
        state.isLoading = true;
        state.loading = true;
      })
      .addCase(changeFirstPassword.fulfilled, (state, action) => {
        state.isLoading = false;
        state.loading = false;
        state.accessToken = action.payload.accessToken;
        state.authUser = action.payload.user;
        state.user = action.payload.user;
        state.isAuthenticated = true;
        Cookies.set("access_token", action.payload.accessToken, {
          expires: 1,
          sameSite: "lax",
          secure: window.location.protocol === "https:",
        });
      })
      .addCase(changeFirstPassword.rejected, (state) => {
        state.isLoading = false;
        state.loading = false;
      });
  },
});

export const { logout, clearAuthError, loadAuthFromStorage, refreshAuthUser } = AuthReducer.actions;

export default AuthReducer.reducer;
