import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TextInput,
  TouchableOpacity,
  type LayoutChangeEvent,
} from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { toast } from '../lib/alert';
import { BAR_HEIGHT } from '../navigation/GlassTabBar';
import { onlyDecimal, LIMITS } from '../lib/inputs';

/**
 * Measures a parcel from a photo.
 *
 * There is no depth sensor to lean on, so the scale comes from an object of
 * known size that the user puts in the frame — a debit card, a sheet of A4.
 * Dragging a line across that object fixes how many centimetres a pixel is
 * worth; the same conversion then reads off the three edges of the box.
 *
 * Every point is held in normalised (0..1) image coordinates, so a layout
 * change — rotation, a keyboard opening — cannot shift a line relative to the
 * photo, and the reference and the edges always scale together.
 */

type Stage = 'capture' | 'measure';
type GuideId = 'ref' | 'length' | 'width' | 'height';
type EdgeId = 'length' | 'width' | 'height';

type Point = { x: number; y: number };
type Guide = { a: Point; b: Point };
type Photo = { uri: string; width: number; height: number };

/** A line shorter than this reads as a stray tap, not a measurement. */
const MIN_GUIDE_PX = 24;

const REFERENCES = [
  { id: 'card', label: 'Debit Card', hint: 'long edge', cm: 8.56 },
  { id: 'a4short', label: 'A4 Sheet', hint: 'short edge', cm: 21 },
  { id: 'a4long', label: 'A4 Sheet', hint: 'long edge', cm: 29.7 },
  { id: 'custom', label: 'Custom', hint: 'your own', cm: 0 },
] as const;

type ReferenceId = (typeof REFERENCES)[number]['id'];

const GUIDES: {
  id: GuideId;
  label: string;
  short: string;
  color: string;
}[] = [
  { id: 'ref', label: 'Reference', short: 'Ref', color: '#F59E0B' },
  { id: 'length', label: 'Length', short: 'L', color: '#7C3AED' },
  { id: 'width', label: 'Width', short: 'W', color: '#0284C7' },
  { id: 'height', label: 'Height', short: 'H', color: '#059669' },
];

/**
 * Starting positions, spread so no two lines land on top of each other and all
 * four are visible before the user touches anything.
 */
const INITIAL_GUIDES: Record<GuideId, Guide> = {
  ref: { a: { x: 0.12, y: 0.88 }, b: { x: 0.42, y: 0.88 } },
  length: { a: { x: 0.15, y: 0.28 }, b: { x: 0.78, y: 0.28 } },
  width: { a: { x: 0.22, y: 0.54 }, b: { x: 0.68, y: 0.66 } },
  height: { a: { x: 0.86, y: 0.22 }, b: { x: 0.86, y: 0.74 } },
};

const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max);

export default function ParcelSizerScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const returnTo: string | undefined = route.params?.returnTo;

  const [stage, setStage] = useState<Stage>('capture');
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [busy, setBusy] = useState(false);

  const [referenceId, setReferenceId] = useState<ReferenceId>('card');
  const [customCm, setCustomCm] = useState('');
  const [guides, setGuides] = useState<Record<GuideId, Guide>>(INITIAL_GUIDES);
  const [activeGuide, setActiveGuide] = useState<GuideId>('ref');

  // Area the layout hands to the photo; the photo is letterboxed inside it so
  // its aspect ratio survives and the overlay stays glued to what is visible.
  const [area, setArea] = useState<{ w: number; h: number } | null>(null);

  const referenceCm = useMemo(() => {
    if (referenceId === 'custom') return parseFloat(customCm) || 0;
    return REFERENCES.find((r) => r.id === referenceId)?.cm ?? 0;
  }, [referenceId, customCm]);

  const frame = useMemo(() => {
    if (!area || !photo || !photo.width || !photo.height) return null;
    const aspect = photo.width / photo.height;
    let w = area.w;
    let h = w / aspect;
    if (h > area.h) {
      h = area.h;
      w = h * aspect;
    }
    return { w, h };
  }, [area, photo]);

  const measurements = useMemo(() => {
    const empty = { calibrated: false, length: 0, width: 0, height: 0 };
    if (!frame) return empty;

    const lengthOf = (guide: Guide) =>
      Math.hypot((guide.b.x - guide.a.x) * frame.w, (guide.b.y - guide.a.y) * frame.h);

    const refPixels = lengthOf(guides.ref);
    if (referenceCm <= 0 || refPixels < MIN_GUIDE_PX) return empty;

    const cmPerPixel = referenceCm / refPixels;
    const read = (id: EdgeId) => {
      const px = lengthOf(guides[id]);
      return px < MIN_GUIDE_PX ? 0 : px * cmPerPixel;
    };

    return {
      calibrated: true,
      length: read('length'),
      width: read('width'),
      height: read('height'),
    };
  }, [frame, guides, referenceCm]);

  const { calibrated } = measurements;
  const complete = measurements.length > 0 && measurements.width > 0 && measurements.height > 0;

  const volumetric = complete
    ? Number(((measurements.length * measurements.width * measurements.height) / 5000).toFixed(2))
    : 0;

  const outOfRange =
    complete &&
    [measurements.length, measurements.width, measurements.height].some(
      (v) => v < LIMITS.dimensionCm.min || v > LIMITS.dimensionCm.max
    );

  // ─── Capture ──────────────────────────────────────────

  const adoptPhoto = (asset: ImagePicker.ImagePickerAsset) => {
    setPhoto({ uri: asset.uri, width: asset.width || 1, height: asset.height || 1 });
    setGuides(INITIAL_GUIDES);
    setActiveGuide('ref');
    setStage('measure');
  };

  const openCamera = async () => {
    if (referenceId === 'custom' && !(parseFloat(customCm) > 0)) {
      toast.warning('Reference size needed', 'Enter the real size of your reference object first.');
      return;
    }
    setBusy(true);
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        toast.error(
          'Camera blocked',
          'Allow camera access for ShipMatrix in your device settings to measure a parcel.'
        );
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) adoptPhoto(result.assets[0]);
    } catch {
      toast.error('Camera unavailable', 'The camera could not be opened on this device.');
    } finally {
      setBusy(false);
    }
  };

  const openGallery = async () => {
    setBusy(true);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        toast.error('Photos blocked', 'Allow photo access for ShipMatrix in your device settings.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsEditing: false,
      });
      if (!result.canceled && result.assets?.[0]) adoptPhoto(result.assets[0]);
    } catch {
      toast.error('Picker unavailable', 'Your photo library could not be opened.');
    } finally {
      setBusy(false);
    }
  };

  // ─── Result ───────────────────────────────────────────

  /**
   * Hands the measurement to the booking form. When the sizer was opened from
   * Create Shipment that screen is still below us in the stack, so navigating
   * to it by name pops back rather than pushing a second copy — and `merge`
   * keeps whatever the user had already typed there.
   */
  const applyToShipment = () => {
    if (!complete) {
      toast.warning('Not measured yet', 'Drag all three edge lines before using these dimensions.');
      return;
    }
    if (outOfRange) {
      toast.error(
        'Dimensions look wrong',
        `Each side must be between ${LIMITS.dimensionCm.min} and ${LIMITS.dimensionCm.max} cm. Re-check the reference line.`
      );
      return;
    }

    const params = {
      length: measurements.length.toFixed(1),
      breadth: measurements.width.toFixed(1),
      height: measurements.height.toFixed(1),
    };

    if (returnTo === 'CreateShipment') {
      navigation.navigate({ name: 'CreateShipment', params, merge: true });
    } else {
      navigation.getParent()?.navigate('OrdersTab', {
        screen: 'CreateShipment',
        params,
        initial: false,
      });
    }
    toast.success(
      'Dimensions applied',
      `${params.length} × ${params.breadth} × ${params.height} cm`
    );
  };

  const retake = () => {
    setPhoto(null);
    setGuides(INITIAL_GUIDES);
    setStage('capture');
  };

  // A layout pass reporting the same box must not churn `frame` — a new object
  // would move every handle by a rounding error mid-drag.
  const onAreaLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea((prev) =>
      prev && Math.abs(prev.w - width) < 1 && Math.abs(prev.h - height) < 1
        ? prev
        : { w: width, h: height }
    );
  };

  const activeColor = GUIDES.find((g) => g.id === activeGuide)!.color;

  return (
    <View className="flex-1 bg-[#F8FAFC]" style={{ paddingTop: insets.top }}>
      {/* Top App Bar */}
      <View className="flex-row items-center justify-between border-b border-slate-100 bg-white px-5 pb-3.5 pt-4">
        <View className="flex-1 flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => (stage === 'measure' ? retake() : navigation.goBack())}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
            <Feather name="arrow-left" size={20} color="#334155" />
          </TouchableOpacity>

          <View className="flex-1">
            <Text className="font-raleway-black text-xl tracking-tight text-slate-900">
              Parcel Sizer
            </Text>
            <Text className="mt-0.5 font-raleway-medium text-xs text-slate-500">
              {stage === 'capture'
                ? 'Measure L × W × H from a photo'
                : calibrated
                  ? 'Drag the handles onto each edge'
                  : 'Start with the orange reference line'}
            </Text>
          </View>
        </View>

        {stage === 'measure' && (
          <TouchableOpacity
            onPress={retake}
            activeOpacity={0.7}
            className="h-10 w-10 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
            <Feather name="refresh-cw" size={16} color="#7C3AED" />
          </TouchableOpacity>
        )}
      </View>

      {stage === 'capture' ? (
        <CaptureStage
          bottomInset={insets.bottom}
          busy={busy}
          referenceId={referenceId}
          setReferenceId={setReferenceId}
          customCm={customCm}
          setCustomCm={setCustomCm}
          onCamera={openCamera}
          onGallery={openGallery}
        />
      ) : (
        <>
          {/* Guide selector — one line at a time is editable, so handles never
              overlap and a drag can never grab the wrong endpoint. */}
          <View className="flex-row gap-2 border-b border-slate-100 bg-white px-4 py-3">
            {GUIDES.map((g) => {
              const isActive = g.id === activeGuide;
              const cm = g.id === 'ref' ? referenceCm : measurements[g.id as EdgeId];
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => setActiveGuide(g.id)}
                  activeOpacity={0.8}
                  className="flex-1 items-center rounded-xl border py-2"
                  style={{
                    backgroundColor: isActive ? g.color : '#FFFFFF',
                    borderColor: isActive ? g.color : '#E2E8F0',
                  }}>
                  <Text
                    className="font-raleway-black text-[10px] uppercase tracking-wider"
                    style={{ color: isActive ? '#FFFFFF' : '#64748B' }}>
                    {g.short}
                  </Text>
                  <Text
                    className="mt-0.5 font-raleway-bold text-[11px]"
                    style={{ color: isActive ? '#FFFFFF' : '#0F172A' }}>
                    {cm > 0 ? `${cm.toFixed(1)} cm` : '— cm'}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Reference size picker, shown only while calibrating */}
          {activeGuide === 'ref' && (
            <View className="border-b border-amber-100 bg-amber-50 px-4 py-2.5">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled">
                <View className="flex-row items-center gap-2">
                  {REFERENCES.map((r) => {
                    const isActive = r.id === referenceId;
                    return (
                      <TouchableOpacity
                        key={r.id}
                        onPress={() => setReferenceId(r.id)}
                        activeOpacity={0.8}
                        className="rounded-full border px-3 py-1.5"
                        style={{
                          backgroundColor: isActive ? '#B45309' : '#FFFFFF',
                          borderColor: isActive ? '#B45309' : '#FDE68A',
                        }}>
                        <Text
                          className="font-raleway-bold text-[10px]"
                          style={{ color: isActive ? '#FFFFFF' : '#92400E' }}>
                          {r.label}
                          {r.cm > 0 ? ` · ${r.cm} cm` : ''}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}

                  {referenceId === 'custom' && (
                    <View className="flex-row items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1">
                      <TextInput
                        value={customCm}
                        onChangeText={(v) => setCustomCm(onlyDecimal(v, 3, 1))}
                        placeholder="0.0"
                        placeholderTextColor="#D1A054"
                        keyboardType="decimal-pad"
                        maxLength={5}
                        className="min-w-[42px] p-0 font-raleway-bold text-[11px] text-amber-900"
                      />
                      <Text className="font-raleway-bold text-[10px] text-amber-700">cm</Text>
                    </View>
                  )}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Photo + overlay */}
          <View className="flex-1 items-center justify-center px-3 py-3" onLayout={onAreaLayout}>
            {photo && frame && (
              <View
                style={{ width: frame.w, height: frame.h }}
                className="overflow-hidden rounded-2xl bg-slate-900">
                <Image
                  source={{ uri: photo.uri }}
                  style={{ width: frame.w, height: frame.h }}
                  resizeMode="cover"
                />

                {/* Lines sit under the handles and never take touches. */}
                <View
                  pointerEvents="none"
                  style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
                  <Svg width={frame.w} height={frame.h}>
                    {GUIDES.map((g) => {
                      const guide = guides[g.id];
                      const isActive = g.id === activeGuide;
                      const coords = {
                        x1: guide.a.x * frame.w,
                        y1: guide.a.y * frame.h,
                        x2: guide.b.x * frame.w,
                        y2: guide.b.y * frame.h,
                      };
                      return (
                        <React.Fragment key={g.id}>
                          {/* A dark underlay keeps every line readable on a
                              light-coloured box or a bright background. */}
                          <Line
                            {...coords}
                            stroke="#0F172A"
                            strokeOpacity={isActive ? 0.35 : 0.15}
                            strokeWidth={isActive ? 6 : 4}
                            strokeLinecap="round"
                          />
                          <Line
                            {...coords}
                            stroke={g.color}
                            strokeOpacity={isActive ? 1 : 0.5}
                            strokeWidth={isActive ? 2.5 : 1.5}
                            strokeDasharray={isActive ? undefined : '5 4'}
                            strokeLinecap="round"
                          />
                        </React.Fragment>
                      );
                    })}
                  </Svg>
                </View>

                {/* Value pills */}
                {GUIDES.map((g) => {
                  const guide = guides[g.id];
                  const cm = g.id === 'ref' ? referenceCm : measurements[g.id as EdgeId];
                  const isActive = g.id === activeGuide;
                  if (!isActive && cm <= 0) return null;
                  const midX = ((guide.a.x + guide.b.x) / 2) * frame.w;
                  const midY = ((guide.a.y + guide.b.y) / 2) * frame.h;
                  return (
                    <View
                      key={g.id}
                      pointerEvents="none"
                      style={{
                        position: 'absolute',
                        left: clamp(midX - 36, 2, Math.max(2, frame.w - 74)),
                        top: clamp(midY - 32, 2, Math.max(2, frame.h - 24)),
                        backgroundColor: g.color,
                        opacity: isActive ? 1 : 0.75,
                        borderRadius: 999,
                        paddingHorizontal: 8,
                        paddingVertical: 3,
                        minWidth: 72,
                        alignItems: 'center',
                      }}>
                      <Text className="font-raleway-black text-[10px] text-white">
                        {g.short} {cm > 0 ? `${cm.toFixed(1)} cm` : '—'}
                      </Text>
                    </View>
                  );
                })}

                {(['a', 'b'] as const).map((end) => (
                  <DragHandle
                    key={end}
                    point={guides[activeGuide][end]}
                    frame={frame}
                    color={activeColor}
                    onChange={(next) =>
                      setGuides((prev) => ({
                        ...prev,
                        [activeGuide]: { ...prev[activeGuide], [end]: next },
                      }))
                    }
                  />
                ))}
              </View>
            )}
          </View>

          {/* Results */}
          <View
            className="border-t border-slate-100 bg-white px-4 pt-3"
            style={{ paddingBottom: insets.bottom + BAR_HEIGHT + 12 }}>
            {!calibrated ? (
              <View className="mb-3 flex-row items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 px-3 py-2.5">
                <Feather name="info" size={14} color="#B45309" />
                <Text className="flex-1 font-raleway text-[11px] leading-4 text-amber-800">
                  {referenceCm > 0
                    ? 'Drag the orange handles so the line spans your reference object exactly, end to end.'
                    : 'Pick a reference object above, or enter its real size, to set the scale.'}
                </Text>
              </View>
            ) : (
              <View className="mb-3 flex-row items-center justify-between">
                <View className="flex-row items-baseline gap-1.5">
                  <Text className="font-raleway-black text-2xl tracking-tight text-slate-900">
                    {complete
                      ? `${measurements.length.toFixed(1)} × ${measurements.width.toFixed(1)} × ${measurements.height.toFixed(1)}`
                      : '— × — × —'}
                  </Text>
                  <Text className="font-raleway-bold text-xs text-slate-400">cm</Text>
                </View>

                {complete && (
                  <View className="rounded-lg border border-violet-100 bg-violet-50 px-2.5 py-1">
                    <Text className="font-raleway-black text-[10px] text-violet-700">
                      VOL {volumetric} kg
                    </Text>
                  </View>
                )}
              </View>
            )}

            {outOfRange && (
              <View className="mb-3 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2">
                <Text className="font-raleway text-[11px] leading-4 text-rose-700">
                  A side falls outside the {LIMITS.dimensionCm.min}–{LIMITS.dimensionCm.max} cm
                  range couriers accept — the reference line is most likely the wrong length.
                </Text>
              </View>
            )}

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={retake}
                activeOpacity={0.8}
                className="items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3.5">
                <Feather name="camera" size={16} color="#334155" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={applyToShipment}
                activeOpacity={0.8}
                disabled={!complete}
                className="flex-1 flex-row items-center justify-center gap-2 rounded-full bg-violet-700 py-3.5"
                style={{ elevation: 4, opacity: complete ? 1 : 0.5 }}>
                <Text className="font-raleway-bold text-sm text-white">Use in Shipment</Text>
                <Feather name="arrow-right" size={15} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </>
      )}
    </View>
  );
}

// ─── Capture stage ──────────────────────────────────────

const STEPS = [
  {
    icon: 'credit-card' as const,
    title: 'Put a reference beside the parcel',
    body: 'Lay a debit card or a sheet of A4 flat against the front face — it is what tells the app how big a pixel is.',
  },
  {
    icon: 'camera' as const,
    title: 'Shoot the box straight on',
    body: 'Stand back a little and keep the phone square to the parcel. A slanted angle stretches the edges and inflates the size.',
  },
  {
    icon: 'move' as const,
    title: 'Drag a line onto each edge',
    body: 'Four lines: one across the reference, then length, width and height. The centimetres update as you drag.',
  },
];

function CaptureStage({
  bottomInset,
  busy,
  referenceId,
  setReferenceId,
  customCm,
  setCustomCm,
  onCamera,
  onGallery,
}: {
  bottomInset: number;
  busy: boolean;
  referenceId: ReferenceId;
  setReferenceId: (id: ReferenceId) => void;
  customCm: string;
  setCustomCm: (v: string) => void;
  onCamera: () => void;
  onGallery: () => void;
}) {
  return (
    <ScrollView
      className="flex-1 px-4"
      contentContainerStyle={{ paddingTop: 16, paddingBottom: bottomInset + BAR_HEIGHT + 24 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled">
      <LinearGradient
        colors={['#4F46E5', '#7C3AED', '#9333EA']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ borderRadius: 24, overflow: 'hidden', marginBottom: 24 }}>
        <View className="p-5">
          <View className="mb-3 flex-row items-center gap-1.5 self-start rounded-full bg-white/20 px-3 py-1.5">
            <Feather name="maximize-2" size={11} color="#FFFFFF" />
            <Text className="font-raleway-black text-[10px] uppercase tracking-wider text-white">
              Camera Measure
            </Text>
          </View>

          <Text className="font-raleway-black text-xl leading-6 tracking-tight text-white">
            Size a parcel without a tape
          </Text>
          <Text className="mt-1.5 font-raleway-medium text-xs leading-5 text-white/85">
            Photograph the box next to something of a known size, read its length, width and height
            straight off the picture, then send them into a booking.
          </Text>
        </View>
      </LinearGradient>

      <Text className="mb-2.5 font-raleway-bold text-xs uppercase tracking-wider text-gray-400">
        How it works
      </Text>
      <View className="mb-6 gap-4 rounded-2xl border border-gray-100/90 bg-white p-4">
        {STEPS.map((s, i) => (
          <View key={s.title} className="flex-row gap-3">
            <View className="h-9 w-9 items-center justify-center rounded-xl border border-violet-100 bg-violet-50">
              <Feather name={s.icon} size={16} color="#7C3AED" />
            </View>
            <View className="flex-1">
              <Text className="font-raleway-bold text-[13px] text-slate-900">
                {i + 1}. {s.title}
              </Text>
              <Text className="mt-0.5 font-raleway text-[11px] leading-4 text-slate-500">
                {s.body}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text className="mb-2.5 font-raleway-bold text-xs uppercase tracking-wider text-gray-400">
        Reference Object
      </Text>
      <View className="mb-6 rounded-2xl border border-gray-100/90 bg-white p-4">
        <View className="flex-row flex-wrap gap-2">
          {REFERENCES.map((r) => {
            const isActive = r.id === referenceId;
            return (
              <TouchableOpacity
                key={r.id}
                onPress={() => setReferenceId(r.id)}
                activeOpacity={0.8}
                className="rounded-xl border px-3.5 py-2.5"
                style={{
                  backgroundColor: isActive ? '#7C3AED' : '#FFFFFF',
                  borderColor: isActive ? '#6D28D9' : '#E2E8F0',
                }}>
                <Text
                  className="font-raleway-bold text-[12px]"
                  style={{ color: isActive ? '#FFFFFF' : '#0F172A' }}>
                  {r.label}
                </Text>
                <Text
                  className="mt-0.5 font-raleway text-[10px]"
                  style={{ color: isActive ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>
                  {r.cm > 0 ? `${r.hint} · ${r.cm} cm` : r.hint}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {referenceId === 'custom' && (
          <View className="mt-3.5">
            <Text className="mb-1 font-raleway-bold text-xs text-gray-700">
              Reference length (cm)
            </Text>
            <TextInput
              value={customCm}
              onChangeText={(v) => setCustomCm(onlyDecimal(v, 3, 1))}
              placeholder="e.g. 15"
              placeholderTextColor="#9ca3af"
              keyboardType="decimal-pad"
              maxLength={5}
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-3 font-raleway text-sm text-gray-900"
            />
            <Text className="mt-1.5 font-raleway text-[10px] text-slate-400">
              Measure the object once with a ruler — every reading after that is derived from it.
            </Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        onPress={onCamera}
        disabled={busy}
        activeOpacity={0.8}
        className="mb-3 flex-row items-center justify-center gap-2 rounded-full bg-violet-700 py-4 shadow-md shadow-purple-900/20"
        style={{ elevation: 4, opacity: busy ? 0.7 : 1 }}>
        <Feather name="camera" size={17} color="#FFFFFF" />
        <Text className="font-raleway-bold text-sm text-white">
          {busy ? 'Opening…' : 'Open Camera'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={onGallery}
        disabled={busy}
        activeOpacity={0.8}
        className="mb-4 flex-row items-center justify-center gap-2 rounded-full border border-slate-200 bg-white py-4"
        style={{ opacity: busy ? 0.7 : 1 }}>
        <Feather name="image" size={16} color="#334155" />
        <Text className="font-raleway-bold text-sm text-slate-800">Choose an existing photo</Text>
      </TouchableOpacity>

      <View className="flex-row items-start gap-2 px-1">
        <Feather name="info" size={13} color="#94A3B8" />
        <Text className="flex-1 font-raleway text-[10px] leading-4 text-slate-400">
          A photo measurement is an estimate. Couriers bill on their own scan, so treat the result
          as a close guide rather than the final charged size.
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Drag handle ────────────────────────────────────────

const HANDLE = 40;

/**
 * A draggable line endpoint.
 *
 * The touch responder props are read straight off this render, so `point`,
 * `frame` and `onChange` are never stale — and the drag is tracked from the
 * screen coordinate the finger landed on, so the rounding on every state write
 * cannot make the handle creep away from the finger over a long drag.
 */
function DragHandle({
  point,
  frame,
  color,
  onChange,
}: {
  point: Point;
  frame: { w: number; h: number };
  color: string;
  onChange: (p: Point) => void;
}) {
  // Written and read only from touch handlers, never during render.
  const drag = useRef<{ origin: Point; pageX: number; pageY: number } | null>(null);

  return (
    <View
      onStartShouldSetResponder={() => true}
      onMoveShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e) => {
        drag.current = {
          origin: point,
          pageX: e.nativeEvent.pageX,
          pageY: e.nativeEvent.pageY,
        };
      }}
      onResponderMove={(e) => {
        const from = drag.current;
        if (!from) return;
        onChange({
          x: clamp(from.origin.x + (e.nativeEvent.pageX - from.pageX) / frame.w, 0, 1),
          y: clamp(from.origin.y + (e.nativeEvent.pageY - from.pageY) / frame.h, 0, 1),
        });
      }}
      onResponderRelease={() => {
        drag.current = null;
      }}
      style={{
        position: 'absolute',
        left: point.x * frame.w - HANDLE / 2,
        top: point.y * frame.h - HANDLE / 2,
        width: HANDLE,
        height: HANDLE,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        style={{
          width: 26,
          height: 26,
          borderRadius: 13,
          borderWidth: 3,
          borderColor: color,
          backgroundColor: 'rgba(255,255,255,0.55)',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      </View>
    </View>
  );
}
