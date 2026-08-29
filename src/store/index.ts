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
        // These hold Firestore documents verbatim, and Firestore Timestamps are
        // class instances rather than plain data. Naming individual fields turned
        // into whack-a-mole (createdAt was listed, updatedAt was not), so the whole
        // subtree is exempt. Nothing here is persisted or time-travelled, which is
        // what this check exists to protect.
        ignoredPaths: ['auth.user', 'shipments.items', 'wallet.transactions'],
        ignoredActions: ['auth/setUser', 'shipments/setShipments', 'wallet/setTransactions'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
