import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import type { Shipment } from '../types';

interface ShipmentsState {
  items: Shipment[];
  isLoading: boolean;
  searchQuery: string;
  statusFilter: string;
}

const initialState: ShipmentsState = {
  items: [],
  isLoading: true,
  searchQuery: '',
  statusFilter: 'all',
};

const shipmentsSlice = createSlice({
  name: 'shipments',
  initialState,
  reducers: {
    setShipments: (state, action: PayloadAction<Shipment[]>) => {
      state.items = action.payload;
      state.isLoading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setSearchQuery: (state, action: PayloadAction<string>) => {
      state.searchQuery = action.payload;
    },
    setStatusFilter: (state, action: PayloadAction<string>) => {
      state.statusFilter = action.payload;
    },
  },
});

export const { setShipments, setLoading, setSearchQuery, setStatusFilter } =
  shipmentsSlice.actions;
export default shipmentsSlice.reducer;
