import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  needsOnboarding: boolean;
}

const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  needsOnboarding: false,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<User | null>) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
      state.needsOnboarding = action.payload?.needsOnboarding ?? false;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setNeedsOnboarding: (state, action: PayloadAction<boolean>) => {
      state.needsOnboarding = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.needsOnboarding = false;
      state.isLoading = false;
    },
  },
});

export const { setUser, setLoading, setNeedsOnboarding, logout } = authSlice.actions;
export default authSlice.reducer;
