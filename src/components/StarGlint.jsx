import React from 'react';

function StarGlintComponent({ className = 'w-4 h-4 text-white', style = {} }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={`pointer-events-none ${className}`}
      style={style}
    >
      <path d="M12 0C12 7 17 12 24 12C17 12 12 17 12 24C12 17 7 12 0 12C7 12 12 7 12 0Z" />
    </svg>
  );
}

const StarGlint = React.memo(StarGlintComponent);
export default StarGlint;