import React from "react";

function LogoMark({ size = 34 }) {
  return (
    <div
      className="relative grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10 shadow-lg shadow-cyan-500/20"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-400 via-blue-500 to-fuchsia-500" />
      <div className="absolute inset-[2px] rounded-full bg-black/90" />
      <span className="relative text-[0.68rem] font-black tracking-[0.3em] text-transparent bg-gradient-to-r from-cyan-300 via-blue-200 to-fuchsia-200 bg-clip-text">
        CM
      </span>
    </div>
  );
}

export default function BrandLogo({ compact = false, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`.trim()}>
      <LogoMark size={compact ? 38 : 46} />
      {!compact ? (
        <div className="leading-none">
          <div className="text-sm font-black tracking-tight text-transparent bg-gradient-to-r from-cyan-300 via-blue-500 to-fuchsia-400 bg-clip-text">
            Crypto
          </div>
          <div className="text-sm font-black tracking-tight text-transparent bg-gradient-to-r from-blue-300 via-cyan-300 to-sky-200 bg-clip-text">
            Market
          </div>
        </div>
      ) : null}
    </div>
  );
}