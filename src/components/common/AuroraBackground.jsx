import React from 'react';

const AuroraBackground = () => {
  return (
    <div className="aurora-bg">
      <div className="aurora-blob aurora-1"></div>
      <div className="aurora-blob aurora-2"></div>
      <div className="aurora-blob aurora-3"></div>
      
      {/* Dynamic noise texture overlay for extra premium feel */}
      <div style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.02,
          pointerEvents: 'none',
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`
      }}></div>
    </div>
  );
};

export default AuroraBackground;
