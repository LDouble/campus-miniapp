import React from 'react';
import { X, Check } from 'lucide-react';

interface BottomSheetPickerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  activeOption: string;
  onSelect: (option: string) => void;
}

export function BottomSheetPicker({ isOpen, onClose, title, options, activeOption, onSelect }: BottomSheetPickerProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="relative bg-white/95 backdrop-blur-xl w-full max-w-md mx-auto rounded-t-[32px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-white pb-12 animate-in slide-in-from-bottom-[100%] duration-300">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-6"></div>
        
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-800">{title}</h3>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col mt-2 max-h-[50vh] overflow-y-auto hide-scrollbar">
          {options.map((option, i) => (
            <button 
              key={i} 
              onClick={() => onSelect(option)}
              className="flex items-center justify-between py-4 border-b border-slate-50 last:border-0 group"
            >
              <span className={`text-[15px] font-medium transition-colors ${activeOption === option ? 'text-blue-500' : 'text-slate-600 group-hover:text-blue-500'}`}>
                {option}
              </span>
              {activeOption === option && <Check size={18} className="text-blue-500" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
