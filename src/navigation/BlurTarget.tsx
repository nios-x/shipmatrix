import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BlurTargetView } from 'expo-blur';
import { useIsFocused } from '@react-navigation/native';

/**
 * expo-blur on Android does not blur "whatever happens to be behind the view".
 * It re-draws a designated subtree — the *blur target* — into an offscreen
 * buffer and blurs that. A <BlurView> given no `blurTarget` silently degrades
 * to `blurMethod: 'none'`, i.e. a flat translucent rectangle, which is exactly
 * what the tab bar looked like.
 *
 * The target has to wrap the screens and *exclude* the tab bar: the underlying
 * library forbids a BlurView from living inside the target it samples, because
 * the target records its whole child subtree every frame and the blur would
 * then feed on its own output. So each tab screen gets its own target via
 * `screenLayout`, the focused one claims the slot, and the tab bar — a sibling
 * of the screen container, outside every target — samples whichever screen is
 * currently on top.
 *
 * On iOS and web BlurTargetView is a plain View and the handle is ignored;
 * those platforms blur the real backdrop.
 */

type Claim = (routeKey: string, node: View | null) => void;
type Release = (routeKey: string) => void;

const BlurTargetContext = createContext<React.RefObject<View | null> | null>(null);
const BlurTargetClaimContext = createContext<{ claim: Claim; release: Release } | null>(null);

/** The view the tab bar's BlurView should sample, or null if there isn't one yet. */
export function useBlurTarget() {
  return useContext(BlurTargetContext);
}

export function BlurTargetProvider({ children }: { children: React.ReactNode }) {
  // Deliberately state rather than a plain ref. BlurView only re-reads its
  // target when the identity of `blurTarget.current` changes between renders,
  // so a stable ref object mutated in place would never wake it up — the
  // screen's host view attaches long after the tab bar has mounted.
  const [owner, setOwner] = useState<{ routeKey: string; node: View | null } | null>(null);

  const claim = useCallback<Claim>((routeKey, node) => setOwner({ routeKey, node }), []);

  const release = useCallback<Release>(
    (routeKey) => setOwner((prev) => (prev?.routeKey === routeKey ? null : prev)),
    []
  );

  const target = useMemo(() => ({ current: owner?.node ?? null }), [owner]);
  const registry = useMemo(() => ({ claim, release }), [claim, release]);

  return (
    <BlurTargetClaimContext.Provider value={registry}>
      <BlurTargetContext.Provider value={target}>{children}</BlurTargetContext.Provider>
    </BlurTargetClaimContext.Provider>
  );
}

/**
 * Wraps one screen's content so it can be blurred. Mount via the navigator's
 * `screenLayout` so every tab gets one and the tab bar gets none.
 */
export function ScreenBlurTarget({
  routeKey,
  children,
}: {
  routeKey: string;
  children: React.ReactNode;
}) {
  const registry = useContext(BlurTargetClaimContext);
  const focused = useIsFocused();
  const [node, setNode] = useState<View | null>(null);

  useEffect(() => {
    if (!registry || !focused) return;
    registry.claim(routeKey, node);
    // Only give the slot back if it is still ours — the incoming screen claims
    // it before this runs on a tab switch, and clearing then would blank the
    // blur for a frame.
    return () => registry.release(routeKey);
  }, [registry, focused, routeKey, node]);

  return (
    <BlurTargetView
      // Typed as a RefObject upstream, but the native view takes any ref; a
      // callback is what lets attachment drive a render.
      ref={setNode as unknown as React.RefObject<View | null>}
      style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
