import React from 'react';
import { CalendarDays, ShoppingBag, Bike, Search, CreditCard, Award, FileEdit, Utensils, Library, Zap, BarChart3 } from 'lucide-react';

const features = [
  { name: '我的课表', icon: CalendarDays, color: 'text-blue-500' },
  { name: '二手市场', icon: ShoppingBag, color: 'text-purple-500' },
  { name: '校园跑腿', icon: Bike, color: 'text-orange-500' },
  { name: '失物招领', icon: Search, color: 'text-teal-500' },
  { name: '校园卡', icon: CreditCard, color: 'text-indigo-500' },
  { name: '查成绩', icon: Award, color: 'text-red-500' },
  { name: '通过率', icon: BarChart3, color: 'text-cyan-500' },
  { name: '考试安排', icon: FileEdit, color: 'text-rose-500' },
  { name: '查食堂', icon: Utensils, color: 'text-amber-500' },
  { name: '更多', icon: Zap, color: 'text-slate-400' },
];

export function FeatureGrid({ onFeatureClick }: { onFeatureClick?: (name: string) => void }) {
  return (
    <div className="grid grid-cols-5 gap-y-4 gap-x-2 px-4 mt-6">
      {features.map((item, index) => {
        const Icon = item.icon;
        return (
          <button 
            key={index}
            onClick={() => onFeatureClick && onFeatureClick(item.name)}
            className="flex flex-col items-center justify-center gap-1.5 group"
          >
            <div className="w-11 h-11 bg-[#f0f4f8] rounded-[14px] flex items-center justify-center shadow-[3px_3px_8px_rgba(0,0,0,0.05),-3px_-3px_8px_rgba(255,255,255,0.9)] group-active:shadow-[inset_3px_3px_8px_rgba(0,0,0,0.04),inset_-3px_-3px_8px_rgba(255,255,255,0.8)] transition-all duration-200">
              <Icon size={20} className={item.color} />
            </div>
            <span className="text-[10px] font-medium text-slate-600 whitespace-nowrap scale-95">{item.name}</span>
          </button>
        );
      })}
    </div>
  );
}
