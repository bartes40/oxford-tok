import React, { useState } from 'react';
import { playTap } from '../utils/sound';

export default function SparkyMascot({ streak = 1, mood = 'happy', size = 80, className = '' }) {
  const [bounced, setBounced] = useState(false);

  const handleClick = () => {
    setBounced(true);
    playTap();
    setTimeout(() => setBounced(false), 600);
  };

  const isHotStreak = streak >= 3;

  return (
    <div
      onClick={handleClick}
      className={`cursor-pointer transition-transform duration-300 select-none ${
        bounced ? 'scale-125 rotate-6' : 'hover:scale-110 active:scale-95'
      } ${className}`}
      title="Sparky - Twój dopaminowy strażnik streaków! Kliknij mnie!"
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 100 120"
        className="w-full h-full filter drop-shadow-[0_4px_0_rgba(0,0,0,1)] animate-float"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Flame Body Outer */}
        <path
          d="M50 5C45 25 20 40 20 70C20 95 35 110 50 110C65 110 80 95 80 70C80 40 55 25 50 5Z"
          fill="#FF5500"
          stroke="#000000"
          strokeWidth="4"
          strokeLinejoin="round"
        />

        {/* Flame Body Inner Core */}
        <path
          d="M50 25C47 38 32 50 32 75C32 93 42 102 50 102C58 102 68 93 68 75C68 50 53 38 50 25Z"
          fill="#FFCC00"
        />

        {/* Cute Legs & Sneakers */}
        <g stroke="#000000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          {/* Left leg */}
          <path d="M38 105 L30 116 L22 116" />
          {/* Left shoe */}
          <rect x="18" y="112" width="16" height="6" rx="3" fill="#FFFFFF" />
          {/* Right leg */}
          <path d="M62 105 L70 116 L78 116" />
          {/* Right shoe */}
          <rect x="66" y="112" width="16" height="6" rx="3" fill="#FFFFFF" />
        </g>

        {/* Expressions */}
        {isHotStreak ? (
          /* Sunglasses on Hot Streak! */
          <g>
            <rect x="28" y="52" width="18" height="12" rx="2" fill="#000000" />
            <rect x="54" y="52" width="18" height="12" rx="2" fill="#000000" />
            <path d="M46 56 H54" stroke="#000000" strokeWidth="3" />
            {/* Sunglasses shine */}
            <path d="M30 55 L35 61" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            <path d="M56 55 L61 61" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
            {/* Smug Cool Smile */}
            <path d="M42 75 Q50 82 58 75" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
          </g>
        ) : (
          /* Big Expressive Cartoon Eyes from Image 1 */
          <g>
            {/* Left Eye */}
            <ellipse cx="38" cy="58" rx="6" ry="9" fill="#FFFFFF" stroke="#000000" strokeWidth="2.5" />
            <ellipse cx="39" cy="58" rx="3.5" ry="5.5" fill="#000000" />
            <circle cx="41" cy="55" r="1.5" fill="#FFFFFF" />

            {/* Right Eye */}
            <ellipse cx="62" cy="58" rx="6" ry="9" fill="#FFFFFF" stroke="#000000" strokeWidth="2.5" />
            <ellipse cx="61" cy="58" rx="3.5" ry="5.5" fill="#000000" />
            <circle cx="63" cy="55" r="1.5" fill="#FFFFFF" />

            {/* Mouth */}
            <path
              d="M44 75 Q50 84 56 75"
              fill="#990000"
              stroke="#000000"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            {/* Blush cheeks */}
            <circle cx="28" cy="68" r="4" fill="#FF2266" opacity="0.6" />
            <circle cx="72" cy="68" r="4" fill="#FF2266" opacity="0.6" />
          </g>
        )}

        {/* Little Cartoon Hands */}
        <path d="M19 65 Q12 60 16 55" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
        <path d="M81 65 Q88 60 84 55" stroke="#000000" strokeWidth="3" strokeLinecap="round" fill="none" />
      </svg>
    </div>
  );
}
