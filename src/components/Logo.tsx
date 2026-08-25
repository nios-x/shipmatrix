import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
  style?: any;
}

export function Logo({ size = 24, style }: LogoProps) {
  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={style}
    >
      <Defs>
        <LinearGradient id="outerBlue" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#1d4ed8" />
          <Stop offset="100%" stopColor="#3b82f6" />
        </LinearGradient>
        <LinearGradient id="innerTeal" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0f766e" />
          <Stop offset="100%" stopColor="#06b6d4" />
        </LinearGradient>
      </Defs>
      {/* Outer boundary for the play icon */}
      <Path
        d="M26 22C26 14 34 10 41 14L81 39C87 43 87 53 81 57L41 82C34 86 26 82 26 74V22Z"
        stroke="url(#outerBlue)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Chevron */}
      <Path
        d="M45 35L62 48L45 61"
        stroke="url(#innerTeal)"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
