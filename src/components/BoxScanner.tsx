import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Accelerometer } from 'expo-sensors';
import Svg, { Circle, Line, Path, Polygon, Rect } from 'react-native-svg';

import { Text } from './ui/Text';
import {
  CAMERA_HEIGHT_RANGE,
  analysePhoto,
  loadCameraHeight,
  saveCameraHeight,
  type ScanPhoto,
} from '../lib/parcelScan';
import {
  DEFAULT_CAMERA_HEIGHT_CM,
  roundCm,
  solveParcel,
  type FaceReading,
  type Point,
  type SideReading,
} from '../lib/parcelVision';
import { LIMITS } from '../lib/inputs';

/**
 * Measures a box with the camera, right where the dimensions are typed.
 *
 * No reference object: the scale comes from the phone. Two photos, each
 * guarded by a level in the viewfinder that only lets the shutter fire once
 * the phone is held right:
 *
 * - **Top view** — phone flat over the box at chest height. With the lens and
 *   that height, a small on-device vision model (`lib/parcelVision`) turns the
 *   box's outline into length and width in centimetres.
 * - **Side view** — crouching, phone upright and level, facing the box's long
 *   side, with the line across the viewfinder crossing the box. The front face
 *   then keeps its true proportions, which gives the height from the length.
 *
 * Each photo comes back with what the model saw drawn on it, so a misread is
 * obvious before the numbers are used.
 */

export interface MeasuredSize {
  length: string;
  width: string;
  height?: string;
}

type StepId = 'top' | 'side';

type Step<R> =
  | { status: 'idle' }
  | { status: 'working'; uri: string }
  | { status: 'done'; reading: R; photo: ScanPhoto }
  | { status: 'error'; message: string; photo?: ScanPhoto };

type Steps = { top: Step<FaceReading>; side: Step<SideReading> };

const STEP_COPY: Record<StepId, { title: string; hint: string; aim: string }> = {
  top: {
    title: 'Top view',
    hint: 'Phone flat above',
    aim: 'Stand over the box and hold the phone flat at chest height.',
  },
  side: {
    title: 'Side view',
    hint: 'Crouch, face the long side',
    aim: 'Crouch, hold the phone upright facing the long side, and keep the line across the box.',
  },
};

/** The shutter unlocks within this many degrees of flat (top) or upright (side). */
const LEVEL_TOLERANCE_DEG = 5;

const toField = (cm: number) =>
  String(Math.min(LIMITS.dimensionCm.max, Math.max(LIMITS.dimensionCm.min, roundCm(cm))));

export function BoxScanner({
  onMeasured,
  onClose,
}: {
  onMeasured: (size: MeasuredSize) => void;
  onClose: () => void;
}) {
  const [steps, setStepsState] = useState<Steps>({
    top: { status: 'idle' },
    side: { status: 'idle' },
  });
  // Mirrors `steps` so async photo reads build on the newest state rather than
  // the render they started in.
  const stepsRef = useRef(steps);
  const setSteps = (next: Steps) => {
    stepsRef.current = next;
    setStepsState(next);
    return next;
  };
  // A retake while a photo is still being read must not let the older photo
  // land afterwards and overwrite the newer one.
  const latest = useRef<Record<StepId, number>>({ top: 0, side: 0 });

  const [capturing, setCapturing] = useState<StepId | null>('top');
  const [cameraHeight, setCameraHeight] = useState(DEFAULT_CAMERA_HEIGHT_CM);
  const heightRef = useRef(cameraHeight);

  useEffect(() => {
    let alive = true;
    loadCameraHeight().then((cm) => {
      if (!alive) return;
      heightRef.current = cm;
      setCameraHeight(cm);
    });
    return () => {
      alive = false;
    };
  }, []);

  const top = steps.top.status === 'done' ? steps.top.reading : null;
  const side = steps.side.status === 'done' ? steps.side.reading : null;
  const size = top ? solveParcel(top, side ?? undefined) : null;
  const complete = !!(top && side && size?.height);

  /** Pushes the newest numbers into the form. */
  const report = (current: Steps) => {
    if (current.top.status !== 'done') return;
    const solved = solveParcel(
      current.top.reading,
      current.side.status === 'done' ? current.side.reading : undefined
    );
    onMeasured({
      length: toField(solved.length),
      width: toField(solved.width),
      ...(solved.height ? { height: toField(solved.height) } : {}),
    });
  };

  const onCaptured = async (
    id: StepId,
    photo: { uri: string; width: number; height: number; exif?: any }
  ) => {
    setCapturing(null);
    const request = ++latest.current[id];
    setSteps({ ...stepsRef.current, [id]: { status: 'working', uri: photo.uri } });

    if (id === 'top') {
      const result = await analysePhoto(photo, {
        view: 'top',
        cameraHeightCm: heightRef.current,
      });
      if (request !== latest.current.top) return;
      report(
        setSteps({
          ...stepsRef.current,
          top: result.ok
            ? { status: 'done', reading: result.reading, photo: result.photo }
            : { status: 'error', message: result.message, photo: result.photo },
        })
      );
    } else {
      const result = await analysePhoto(photo, { view: 'side' });
      if (request !== latest.current.side) return;
      report(
        setSteps({
          ...stepsRef.current,
          side: result.ok
            ? { status: 'done', reading: result.reading, photo: result.photo }
            : { status: 'error', message: result.message, photo: result.photo },
        })
      );
    }
  };

  /**
   * A changed height rescales the top view, whose centimetres depend on it —
   * the side view is a proportion and needs nothing — so no photo is retaken.
   */
  const changeHeight = (delta: number) => {
    const next = Math.min(
      CAMERA_HEIGHT_RANGE.max,
      Math.max(CAMERA_HEIGHT_RANGE.min, heightRef.current + delta)
    );
    if (next === heightRef.current) return;
    const scale = next / heightRef.current;
    heightRef.current = next;
    setCameraHeight(next);
    void saveCameraHeight(next);

    const top = stepsRef.current.top;
    if (top.status !== 'done') return;
    const { reading } = top;
    report(
      setSteps({
        ...stepsRef.current,
        top: {
          ...top,
          reading: {
            ...reading,
            cameraHeight: reading.cameraHeight * scale,
            outline: reading.outline.map((p) => ({ x: p.x * scale, y: p.y * scale })),
            nadir: { x: reading.nadir.x * scale, y: reading.nadir.y * scale },
          },
        },
      })
    );
  };

  const nextStep: StepId | null =
    steps.top.status !== 'done' ? 'top' : steps.side.status !== 'done' ? 'side' : null;
  const working = steps.top.status === 'working' || steps.side.status === 'working';

  return (
    <View className="mt-2 overflow-hidden rounded-2xl border border-violet-100 bg-violet-50/50">
      <View className="flex-row items-start p-3 pb-2.5">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-white">
          <Feather name="aperture" size={16} color="#6D28D9" />
        </View>
        <View className="ml-2.5 mr-2 flex-1">
          <Text className="font-semibold text-sm leading-5 text-slate-900">Scan the box</Text>
          <Text variant="meta" className="leading-4 text-slate-600">
            {capturing
              ? STEP_COPY[capturing].aim
              : 'One photo from above, one from the side. Nothing is uploaded.'}
          </Text>
        </View>
        <TouchableOpacity
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close scanner"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="h-8 w-8 items-center justify-center rounded-full">
          <Feather name="x" size={18} color="#64748B" />
        </TouchableOpacity>
      </View>

      <View className="px-3">
        {capturing ? (
          <LiveCamera
            view={capturing}
            stepIndex={capturing === 'top' ? 1 : 2}
            stepTitle={STEP_COPY[capturing].title}
            onCaptured={(photo) => onCaptured(capturing, photo)}
            onCancel={() => setCapturing(null)}
          />
        ) : (
          <View className="flex-row gap-2.5">
            {(['top', 'side'] as const).map((id, i) => (
              <StepTile
                key={id}
                index={i + 1}
                title={STEP_COPY[id].title}
                hint={STEP_COPY[id].hint}
                art={id}
                step={steps[id]}
                summary={
                  id === 'top'
                    ? top && size
                      ? `${toField(size.length)} × ${toField(size.width)} cm`
                      : null
                    : complete
                      ? `Height ${toField(size!.height!)} cm`
                      : side
                        ? 'Needs top view'
                        : null
                }
                onPress={() => setCapturing(id)}
                disabled={working}
              />
            ))}
          </View>
        )}
      </View>

      {!capturing && nextStep && !working && steps[nextStep].status !== 'error' && (
        <View className="px-3 pt-3">
          <TouchableOpacity
            onPress={() => setCapturing(nextStep)}
            activeOpacity={0.85}
            accessibilityRole="button"
            className="h-11 flex-row items-center justify-center gap-2 rounded-xl bg-violet-600">
            <Feather name="camera" size={16} color="#FFFFFF" />
            <Text variant="button" className="text-white">
              {nextStep === 'top' ? 'Take top view' : 'Next: side view'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {complete && !capturing && (
        <View className="mx-3 mt-3 flex-row items-center gap-2 rounded-xl bg-white px-3 py-2.5">
          <Feather name="check-circle" size={16} color="#059669" />
          <View className="flex-1">
            <Text className="font-semibold text-[13px] leading-5 text-slate-900">
              ≈ {toField(size!.length)} × {toField(size!.width)} × {toField(size!.height!)} cm
            </Text>
            <Text variant="meta" className="text-[11px] leading-4">
              Estimate, filled in below. Check it before booking.
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            accessibilityRole="button"
            className="h-9 justify-center rounded-lg bg-violet-600 px-3.5">
            <Text className="font-semibold text-[13px] text-white">Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* The scale behind every number: how high the phone was held. */}
      <View className="mt-3 flex-row items-center border-t border-violet-100 bg-white/60 px-3 py-2.5">
        <View className="mr-2 flex-1">
          <Text className="font-semibold text-[12px] leading-4 text-slate-800">Phone height</Text>
          <Text variant="meta" className="text-[11px] leading-4">
            Scan a box you know, then nudge this until it matches.
          </Text>
        </View>
        <Stepper
          value={cameraHeight}
          unit="cm"
          onStep={changeHeight}
          step={CAMERA_HEIGHT_RANGE.step}
        />
      </View>
    </View>
  );
}

/* ─── Live camera ────────────────────────────────────── */

/** Gravity in the phone's own axes, normalised: x across the screen, y along it, z out of it. */
type Gravity = { x: number; y: number; z: number };

/** Gravity direction, sampled while the viewfinder is open. */
function useGravity(): Gravity | null {
  const [gravity, setGravity] = useState<Gravity | null>(null);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    let alive = true;
    Accelerometer.isAvailableAsync()
      .then((available) => {
        if (!alive || !available) return;
        Accelerometer.setUpdateInterval(80);
        sub = Accelerometer.addListener(({ x, y, z }) => {
          const g = Math.hypot(x, y, z) || 1;
          setGravity({ x: x / g, y: y / g, z: z / g });
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
      sub?.remove();
    };
  }, []);
  return gravity;
}

const toDeg = (rad: number) => (rad * 180) / Math.PI;

/**
 * How far the phone is from the pose a view needs, in degrees, plus where to
 * draw the level's bubble. Flat for the top view: gravity straight through the
 * screen. Upright for the side view: gravity straight down the phone's long
 * edge, with no lean forward, back or sideways.
 */
function poseError(view: StepId, g: Gravity) {
  if (view === 'top') {
    return { deg: toDeg(Math.acos(Math.min(1, Math.abs(g.z)))), bx: g.x, by: g.y };
  }
  const lean = toDeg(Math.asin(Math.min(1, Math.abs(g.z))));
  const roll = toDeg(Math.atan2(Math.abs(g.x), Math.abs(g.y)));
  return { deg: Math.max(lean, roll), bx: g.x, by: g.z };
}

function LiveCamera({
  view,
  stepIndex,
  stepTitle,
  onCaptured,
  onCancel,
}: {
  view: StepId;
  stepIndex: number;
  stepTitle: string;
  onCaptured: (photo: { uri: string; width: number; height: number; exif?: any }) => void;
  onCancel: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const camera = useRef<CameraView>(null);
  const [ready, setReady] = useState(false);
  const [shooting, setShooting] = useState(false);
  const gravity = useGravity();
  const pose = gravity ? poseError(view, gravity) : null;

  // Phones without an accelerometer (and the web) cannot be checked, so the
  // shutter stays usable there rather than locking the seller out.
  const level = !pose || pose.deg <= LEVEL_TOLERANCE_DEG;

  const shoot = async () => {
    if (!camera.current || shooting || !ready || !level) return;
    setShooting(true);
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.85, exif: true });
      if (photo?.uri) onCaptured(photo);
    } catch {
      setShooting(false);
    }
  };

  if (!permission) {
    return <View className="aspect-[3/4] rounded-xl bg-slate-900" />;
  }

  if (!permission.granted) {
    return (
      <View className="aspect-[3/4] items-center justify-center rounded-xl bg-slate-900 px-6">
        <Feather name="camera-off" size={26} color="#CBD5E1" />
        <Text className="mt-3 text-center font-semibold text-sm text-white">
          Camera access needed
        </Text>
        <Text className="mt-1 text-center text-xs leading-4 text-slate-300">
          {permission.canAskAgain
            ? 'The box is measured on this phone. Photos are never uploaded.'
            : 'Allow camera access for ShipMatrix in your phone’s settings.'}
        </Text>
        {permission.canAskAgain && (
          <TouchableOpacity
            onPress={requestPermission}
            accessibilityRole="button"
            className="mt-4 h-10 justify-center rounded-xl bg-white px-4">
            <Text variant="button" className="text-slate-900">
              Allow camera
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onCancel} accessibilityRole="button" className="mt-3 p-2">
          <Text className="font-semibold text-[13px] text-slate-300">Not now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View className="aspect-[3/4] overflow-hidden rounded-xl bg-slate-900">
      <CameraView
        ref={camera}
        facing="back"
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
        onCameraReady={() => setReady(true)}
      />

      {view === 'top' ? (
        // Aim guide: the box goes in the middle, with floor around it.
        <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
          <View
            className={`h-[46%] w-[58%] rounded-2xl border-2 border-dashed ${
              level ? 'border-white/80' : 'border-white/35'
            }`}
          />
        </View>
      ) : (
        // Horizon: a level camera's own height runs across the middle of the
        // frame. Crossing the box with it keeps the lens below the box's top.
        <View pointerEvents="none" className="absolute inset-0 justify-center">
          <View className={`h-0.5 ${level ? 'bg-emerald-300' : 'bg-white/60'}`} />
          <View className="mt-1.5 items-center">
            <View className="rounded-full bg-slate-900/60 px-2.5 py-1">
              <Text className="font-semibold text-[11px] text-white">
                Keep this line across the box
              </Text>
            </View>
          </View>
        </View>
      )}

      <View pointerEvents="none" className="absolute inset-x-0 top-3 items-center">
        <View className="flex-row items-center gap-2 rounded-full bg-slate-900/70 px-3 py-1.5">
          <Text className="font-semibold text-[11px] text-white">
            {stepIndex} of 2 · {stepTitle}
          </Text>
        </View>
      </View>

      {pose && <LevelBubble pose={pose} level={level} view={view} />}

      <View className="absolute inset-x-0 bottom-4 flex-row items-center justify-center">
        <TouchableOpacity
          onPress={onCancel}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
          className="absolute left-5 h-10 justify-center rounded-full bg-slate-900/60 px-3.5">
          <Text className="font-semibold text-[13px] text-white">Cancel</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={shoot}
          disabled={!ready || !level || shooting}
          accessibilityRole="button"
          accessibilityLabel={
            level
              ? 'Take photo'
              : view === 'top'
                ? 'Hold the phone flat to take the photo'
                : 'Hold the phone upright to take the photo'
          }
          accessibilityState={{ disabled: !ready || !level || shooting }}
          className={`h-[68px] w-[68px] items-center justify-center rounded-full border-4 ${
            level ? 'border-white' : 'border-white/40'
          }`}>
          <View
            className={`h-[52px] w-[52px] rounded-full ${
              shooting ? 'bg-white/50' : level ? 'bg-violet-500' : 'bg-white/25'
            }`}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

/**
 * A spirit level: the bubble drifts with the phone's tilt and turns green
 * once it is flat enough to shoot.
 */
function LevelBubble({
  pose,
  level,
  view,
}: {
  pose: { deg: number; bx: number; by: number };
  level: boolean;
  view: StepId;
}) {
  const R = 22;
  // Android and iOS report gravity with opposite signs; mirroring on iOS keeps
  // the bubble floating uphill, like a real one, on both.
  const sign = Platform.OS === 'ios' ? -1 : 1;
  const dx = Math.max(-1, Math.min(1, sign * -pose.bx * 3)) * (R - 6);
  const dy = Math.max(-1, Math.min(1, sign * pose.by * 3)) * (R - 6);
  return (
    <View pointerEvents="none" className="absolute inset-x-0 top-12 items-center">
      <Svg width={R * 2 + 4} height={R * 2 + 4}>
        <Circle
          cx={R + 2}
          cy={R + 2}
          r={R}
          fill="rgba(15,23,42,0.45)"
          stroke={level ? '#34D399' : '#FFFFFF'}
          strokeWidth={2}
        />
        <Circle
          cx={R + 2}
          cy={R + 2}
          r={6}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1}
        />
        <Circle cx={R + 2 + dx} cy={R + 2 + dy} r={5} fill={level ? '#34D399' : '#FFFFFF'} />
      </Svg>
      <Text className="mt-1 font-semibold text-[11px] text-white">
        {level
          ? 'Level'
          : `Off by ${Math.round(pose.deg)}° — hold ${view === 'top' ? 'flat' : 'upright'}`}
      </Text>
    </View>
  );
}

/* ─── Step tile ──────────────────────────────────────── */

function StepTile({
  index,
  title,
  hint,
  art,
  step,
  summary,
  onPress,
  disabled,
}: {
  index: number;
  title: string;
  hint: string;
  art: StepId;
  step: Step<FaceReading> | Step<SideReading>;
  summary: string | null;
  onPress: () => void;
  disabled: boolean;
}) {
  const [frameHeight, setFrameHeight] = useState(0);
  const done = step.status === 'done';
  const failed = step.status === 'error';
  const working = step.status === 'working';
  const photoUri =
    step.status === 'done'
      ? step.photo.uri
      : step.status === 'working'
        ? step.uri
        : step.status === 'error'
          ? step.photo?.uri
          : undefined;

  return (
    <View className="flex-1">
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}: ${done || failed ? 'retake photo' : 'take photo'}`}
        onLayout={(e) => setFrameHeight(e.nativeEvent.layout.height)}
        className={`aspect-[3/4] overflow-hidden rounded-xl border bg-white ${
          done ? 'border-violet-300' : failed ? 'border-rose-300' : 'border-slate-200'
        }`}>
        {photoUri ? (
          <>
            <Image
              source={{ uri: photoUri }}
              resizeMode="cover"
              style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            />
            {step.status === 'done' && (
              <Outline
                width={step.photo.width}
                height={step.photo.height}
                parcel={step.reading.overlay.parcel}
              />
            )}
            {(working || failed) && (
              <View
                className={`absolute inset-0 ${working ? 'bg-slate-900/35' : 'bg-rose-900/30'}`}
              />
            )}
          </>
        ) : (
          <View className="flex-1 items-center justify-center bg-slate-50">
            <StepArt kind={art} />
          </View>
        )}

        {working && <ScanLine height={frameHeight} />}

        <View
          className={`absolute left-2 top-2 h-6 w-6 items-center justify-center rounded-full ${
            done ? 'bg-emerald-500' : failed ? 'bg-rose-500' : 'bg-white'
          }`}>
          {done ? (
            <Feather name="check" size={13} color="#FFFFFF" />
          ) : failed ? (
            <Feather name="x" size={13} color="#FFFFFF" />
          ) : (
            <Text className="font-bold text-[11px] text-slate-700">{index}</Text>
          )}
        </View>

        {(working || (done && summary)) && (
          <View className="absolute inset-x-2 bottom-2 items-center">
            <View className="rounded-full bg-slate-900/75 px-2.5 py-1">
              <Text className="font-semibold text-[11px] text-white" numberOfLines={1}>
                {working ? 'Measuring…' : summary}
              </Text>
            </View>
          </View>
        )}
      </TouchableOpacity>

      <Text className="mt-2 font-semibold text-[13px] leading-4 text-slate-900" numberOfLines={1}>
        {title}
      </Text>
      <Text
        variant="meta"
        className={`text-[11px] leading-4 ${failed ? 'text-rose-600' : ''}`}
        numberOfLines={failed ? 4 : 1}>
        {failed ? step.message : done ? 'Tap photo to retake' : hint}
      </Text>
    </View>
  );
}

/** What the model found, drawn over the photo it analysed. */
function Outline({ width, height, parcel }: { width: number; height: number; parcel: Point[] }) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', top: 0, left: 0 }}
      pointerEvents="none">
      <Polygon
        points={parcel.map((p) => `${p.x},${p.y}`).join(' ')}
        fill="rgba(124,58,237,0.22)"
        stroke="#7C3AED"
        strokeWidth={Math.max(2.5, width / 120)}
        strokeLinejoin="round"
      />
    </Svg>
  );
}

/** A slow sweep while the photo is read: the one motion outside the viewfinder. */
function ScanLine({ height }: { height: number }) {
  const [progress] = useState(() => new Animated.Value(0));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [progress]);

  if (!height) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        height: 2,
        backgroundColor: '#A78BFA',
        transform: [
          {
            translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, height - 2] }),
          },
        ],
      }}
    />
  );
}

function Stepper({
  value,
  unit,
  step,
  onStep,
}: {
  value: number;
  unit: string;
  step: number;
  onStep: (delta: number) => void;
}) {
  return (
    <View className="flex-row items-center rounded-full border border-slate-200 bg-white">
      <TouchableOpacity
        onPress={() => onStep(-step)}
        accessibilityRole="button"
        accessibilityLabel={`Lower phone height by ${step} ${unit}`}
        hitSlop={{ top: 6, bottom: 6 }}
        className="h-9 w-9 items-center justify-center">
        <Feather name="minus" size={15} color="#334155" />
      </TouchableOpacity>
      <Text className="min-w-[58px] text-center font-semibold text-[13px] text-slate-900">
        {value} {unit}
      </Text>
      <TouchableOpacity
        onPress={() => onStep(step)}
        accessibilityRole="button"
        accessibilityLabel={`Raise phone height by ${step} ${unit}`}
        hitSlop={{ top: 6, bottom: 6 }}
        className="h-9 w-9 items-center justify-center">
        <Feather name="plus" size={15} color="#334155" />
      </TouchableOpacity>
    </View>
  );
}

/** How to set up each photo, drawn rather than described. */
function StepArt({ kind }: { kind: StepId }) {
  if (kind === 'top') {
    return (
      <Svg width="78%" height="78%" viewBox="0 0 120 160">
        {/* Phone held flat above, looking down */}
        <Rect x={38} y={10} width={44} height={10} rx={4} fill="#7C3AED" />
        <Line
          x1={60}
          y1={24}
          x2={60}
          y2={62}
          stroke="#C4B5FD"
          strokeWidth={2}
          strokeDasharray="3 3"
        />
        <Path
          d="M54 56 L60 63 L66 56"
          fill="none"
          stroke="#C4B5FD"
          strokeWidth={2}
          strokeLinecap="round"
        />
        <Rect
          x={30}
          y={78}
          width={60}
          height={62}
          rx={3}
          fill="#E9C99D"
          stroke="#B7895A"
          strokeWidth={2}
        />
        <Line x1={60} y1={78} x2={60} y2={140} stroke="#D4A86F" strokeWidth={7} />
        <Line
          x1={10}
          y1={141}
          x2={110}
          y2={141}
          stroke="#CBD5E1"
          strokeWidth={2}
          strokeLinecap="round"
        />
      </Svg>
    );
  }
  return (
    <Svg width="78%" height="78%" viewBox="0 0 120 160">
      {/* Phone upright at the box's height, looking straight at its long side */}
      <Rect x={8} y={84} width={10} height={40} rx={3} fill="#7C3AED" />
      <Line
        x1={22}
        y1={104}
        x2={110}
        y2={104}
        stroke="#34D399"
        strokeWidth={2}
        strokeDasharray="4 3"
      />
      <Rect
        x={34}
        y={80}
        width={72}
        height={60}
        rx={3}
        fill="#E9C99D"
        stroke="#B7895A"
        strokeWidth={2}
      />
      <Line x1={70} y1={80} x2={70} y2={140} stroke="#D4A86F" strokeWidth={6} />
      {/* Floor line */}
      <Line
        x1={10}
        y1={141}
        x2={110}
        y2={141}
        stroke="#CBD5E1"
        strokeWidth={2}
        strokeLinecap="round"
      />
    </Svg>
  );
}
