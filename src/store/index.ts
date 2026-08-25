import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import shipmentsReducer from './shipmentsSlice';
import walletReducer from './walletSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    shipments: shipmentsReducer,
    wallet: walletReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Firebase Timestamps are not serializable
        ignoredPaths: ['auth.user.createdAt', 'shipments.items', 'wallet.transactions'],
        ignoredActions: ['auth/setUser', 'shipments/setShipments', 'wallet/setTransactions'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
