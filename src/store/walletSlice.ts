import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Transaction } from '../types';

interface WalletState {
  balance: number;
  transactions: Transaction[];
  isLoading: boolean;
}

const initialState: WalletState = {
  balance: 0,
  transactions: [],
  isLoading: true,
};

const walletSlice = createSlice({
  name: 'wallet',
  initialState,
  reducers: {
    setBalance: (state, action: PayloadAction<number>) => {
      state.balance = action.payload;
    },
    setTransactions: (state, action: PayloadAction<Transaction[]>) => {
      state.transactions = action.payload;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
  },
});

export const { setBalance, setTransactions, setLoading } = walletSlice.actions;
export default walletSlice.reducer;
