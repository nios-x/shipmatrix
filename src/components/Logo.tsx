import React from 'react';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface LogoProps {
  size?: number;
  style?: any;
}

export function Logo({ size = 24, style }: LogoProps) {
  // Gradient ids must be unique per instance — SVG defs are document-scoped, so
  // two marks on one screen would otherwise share (and fight over) the same id.
  const uid = React.useId().replace(/[^a-zA-Z0-9]/g, '');
  const outerId = `sm-outer-${uid}`;
  const innerId = `sm-inner-${uid}`;

  return (
    <Svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      style={style}
    >
      <Defs>
        <LinearGradient id={outerId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#6D28D9" />
          <Stop offset="100%" stopColor="#8B5CF6" />
        </LinearGradient>
        <LinearGradient id={innerId} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0%" stopColor="#0891B2" />
          <Stop offset="100%" stopColor="#22D3EE" />
        </LinearGradient>
      </Defs>
      {/* Outer boundary for the play icon */}
      <Path
        d="M26 22C26 14 34 10 41 14L81 39C87 43 87 53 81 57L41 82C34 86 26 82 26 74V22Z"
        stroke={`url(#${outerId})`}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Inner Chevron */}
      <Path
        d="M45 35L62 48L45 61"
        stroke={`url(#${innerId})`}
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}
