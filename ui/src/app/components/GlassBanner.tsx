import React from 'react';
import { Sparkles, ArrowRight } from 'lucide-react';

export function GlassBanner() {
  return (
    <div className="px-6 mt-6">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-400/90 via-cyan-400/80 to-teal-300/90 p-5 shadow-[0_8px_24px_rgba(56,189,248,0.25)] border border-white/40">
        
        {/* Glass Reflection Effect */}
        <div className="absolute top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-white/20 to-transparent pointer-events-none"></div>
        
        {/* Decorative Circles */}
        <div className="absolute -right-6 -top-6 w-24 h-24 bg-white/20 rounded-full blur-xl pointer-events-none"></div>
        <div className="absolute right-12 -bottom-8 w-16 h-16 bg-blue-600/10 rounded-full blur-lg pointer-events-none"></div>

        <div className="relative z-10 flex flex-col items-start text-white">
          <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md rounded-full px-3 py-1 mb-3 border border-white/30 shadow-sm">
            <Sparkles size={12} className="text-yellow-200" />
            <span className="text-xs font-medium tracking-wide text-white/90">新生专区</span>
          </div>
          
          <h2 className="text-xl font-bold mb-1 drop-shadow-sm">2026秋季报到指南</h2>
          <p className="text-sm text-blue-50/90 mb-4 font-medium drop-shadow-sm">提前了解校园，开学不迷路</p>
          
          <button className="flex items-center gap-1 text-xs font-bold text-blue-500 bg-white shadow-lg rounded-full px-4 py-2 hover:scale-105 active:scale-95 transition-transform">
            立即查看
            <ArrowRight size={14} className="ml-1" />
          </button>
        </div>
      </div>
    </div>
  );
}
