import React, { useCallback, useRef, useState } from 'react';
import { CustomAlertModal, type CustomAlertProps } from './CustomAlertModal';

export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Label for the affirmative button. Defaults to 'Confirm'. */
  confirmText?: string;
  cancelText?: string;
  type?: CustomAlertProps['type'];
  /** Paints the affirmative button red — use for anything money- or data-losing. */
  destructive?: boolean;
}

/**
 * Themed replacement for `Alert.alert` confirmations. Every irreversible action
 * (booking, returning, disconnecting, spending wallet balance) routes through
 * this so the prompt looks the same everywhere instead of falling back to the
 * bare OS dialog.
 *
 *   const { confirm, confirmDialog } = useConfirm();
 *   confirm({ title: 'Confirm Order', message: 'Are you sure...' }, () => book());
 *   ...
 *   {confirmDialog}
 */
export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // Held in a ref so a re-render between opening and pressing never swaps the
  // action out from under the visible dialog.
  const actionRef = useRef<(() => void) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions, onConfirm: () => void) => {
    actionRef.current = onConfirm;
    setOptions(opts);
  }, []);

  const close = useCallback(() => setOptions(null), []);

  const confirmDialog = (
    <CustomAlertModal
      visible={!!options}
      title={options?.title || ''}
      message={options?.message}
      type={options?.type || 'confirm'}
      buttons={[
        { text: options?.cancelText || 'Cancel', style: 'cancel' },
        {
          text: options?.confirmText || 'Confirm',
          style: options?.destructive ? 'destructive' : 'default',
          onPress: () => actionRef.current?.(),
        },
      ]}
      onClose={close}
    />
  );

  return { confirm, confirmDialog };
}
