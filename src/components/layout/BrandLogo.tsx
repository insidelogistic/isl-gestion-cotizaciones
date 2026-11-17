'use client';

import React, { useState } from 'react';

interface BrandLogoProps {
  variant?: 'full' | 'compact' | 'icon';
  heightClass?: string;
  className?: string;
}

export function BrandLogo({
  variant = 'full',
  heightClass = 'h-8',
  className = '',
}: BrandLogoProps) {
  const [imgError, setImgError] = useState(false);

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {!imgError ? (
        <img
          src="/images/logo.png"
          alt="IN SIDE LOGISTIC"
          className={`${heightClass} w-auto object-contain shrink-0`}
          onError={() => setImgError(true)}
        />
      ) : (
        <div className="px-2.5 py-1 rounded-md bg-[#0F2747] text-white font-titulos font-black text-xs tracking-wider uppercase">
          IN SIDE LOGISTIC
        </div>
      )}

      {variant === 'compact' && (
        <div className="leading-none border-l border-slate-200 pl-2.5 hidden sm:block">
          <span className="text-[11px] text-[#0F2747] font-black tracking-widest block uppercase font-titulos">
            IN SIDE LOGISTIC
          </span>
          <span className="text-[10px] text-[#C72106] font-bold tracking-wider block uppercase font-titulos mt-0.5">
            GESTIÓN DE COTIZACIONES
          </span>
        </div>
      )}
    </div>
  );
}
