import React from 'react';
import { X, Edit3, ShoppingBag, Bike, Car, PackageSearch } from 'lucide-react';

const publishTypes = [
  { name: '发动态', desc: '分享校园生活', icon: Edit3, color: 'text-blue-500' },
  { name: '卖闲置', desc: '出二手回血', icon: ShoppingBag, color: 'text-purple-500' },
  { name: '发跑腿', desc: '花钱求帮忙', icon: Bike, color: 'text-orange-500' },
  { name: '找拼车', desc: '结伴出行', icon: Car, color: 'text-teal-500' },
  { name: '失物招领', desc: '寻找失主/物品', icon: PackageSearch, color: 'text-indigo-500' },
];

export function PublishActionSheet({ isOpen, onClose, onSelect }: { isOpen: boolean, onClose: () => void, onSelect: (type: string) => void }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col justify-end pointer-events-auto">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Sheet */}
      <div className="relative bg-white/90 backdrop-blur-2xl w-full max-w-md mx-auto rounded-t-[40px] p-6 shadow-[0_-10px_40px_rgba(0,0,0,0.1)] border-t border-white pb-10 animate-in slide-in-from-bottom-[100%] duration-300">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mb-8"></div>
        
        <div className="grid grid-cols-3 gap-y-8 gap-x-4 mb-10 px-2">
          {publishTypes.map((item, index) => {
            const Icon = item.icon;
            return (
              <button 
                key={index}
                className="flex flex-col items-center justify-center group"
                onClick={() => onSelect(item.name)}
              >
                <div className="w-16 h-16 bg-[#f4f7fb] rounded-[20px] flex items-center justify-center shadow-[4px_4px_12px_rgba(0,0,0,0.06),-4px_-4px_12px_rgba(255,255,255,0.9)] group-active:shadow-[inset_4px_4px_12px_rgba(0,0,0,0.05),inset_-4px_-4px_12px_rgba(255,255,255,0.8)] transition-all duration-200 mb-3 relative overflow-hidden">
                  {/* Subtle glare effect */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/60 to-transparent pointer-events-none"></div>
                  <Icon size={28} className={item.color} />
                </div>
                <span className="text-[13px] font-bold text-slate-700 mb-0.5">{item.name}</span>
                <span className="text-[10px] text-slate-400 font-medium scale-95">{item.desc}</span>
              </button>
            );
          })}
        </div>

        <button 
          onClick={onClose} 
          className="w-12 h-12 mx-auto bg-white rounded-full flex items-center justify-center text-slate-400 shadow-[2px_2px_10px_rgba(0,0,0,0.05)] border border-slate-100 hover:text-slate-600 transition-colors active:scale-95"
        >
          <X size={20} />
        </button>
      </div>
    </div>
  );
}
