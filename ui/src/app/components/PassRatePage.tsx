import React, { useState } from 'react';
import { 
  ChevronLeft, 
  Share2, 
  Star, 
  BookOpen, 
  Trophy,
  AlertCircle,
  ChevronDown
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Mock Data
const trendData = [
  { term: '22秋', passRate: 75, avgScore: 72 },
  { term: '23春', passRate: 82, avgScore: 76 },
  { term: '23秋', passRate: 78, avgScore: 75 },
  { term: '24春', passRate: 85, avgScore: 79 },
  { term: '24秋', passRate: 88, avgScore: 81 },
];

const gradeDistributions: Record<string, { grade: string, percentage: number, color: string }[]> = {
  '综合历史': [
    { grade: '优秀 (90-100)', percentage: 15, color: 'bg-cyan-400' },
    { grade: '良好 (80-89)', percentage: 35, color: 'bg-blue-400' },
    { grade: '中等 (70-79)', percentage: 25, color: 'bg-indigo-400' },
    { grade: '及格 (60-69)', percentage: 15, color: 'bg-teal-400' },
    { grade: '不及格 (<60)', percentage: 10, color: 'bg-red-400' },
  ],
  '24秋 (最新)': [
    { grade: '优秀 (90-100)', percentage: 18, color: 'bg-cyan-400' },
    { grade: '良好 (80-89)', percentage: 40, color: 'bg-blue-400' },
    { grade: '中等 (70-79)', percentage: 25, color: 'bg-indigo-400' },
    { grade: '及格 (60-69)', percentage: 12, color: 'bg-teal-400' },
    { grade: '不及格 (<60)', percentage: 5, color: 'bg-red-400' },
  ],
  '24春': [
    { grade: '优秀 (90-100)', percentage: 12, color: 'bg-cyan-400' },
    { grade: '良好 (80-89)', percentage: 32, color: 'bg-blue-400' },
    { grade: '中等 (70-79)', percentage: 28, color: 'bg-indigo-400' },
    { grade: '及格 (60-69)', percentage: 18, color: 'bg-teal-400' },
    { grade: '不及格 (<60)', percentage: 10, color: 'bg-red-400' },
  ],
  '23秋': [
    { grade: '优秀 (90-100)', percentage: 10, color: 'bg-cyan-400' },
    { grade: '良好 (80-89)', percentage: 28, color: 'bg-blue-400' },
    { grade: '中等 (70-79)', percentage: 32, color: 'bg-indigo-400' },
    { grade: '及格 (60-69)', percentage: 20, color: 'bg-teal-400' },
    { grade: '不及格 (<60)', percentage: 10, color: 'bg-red-400' },
  ]
};

const terms = Object.keys(gradeDistributions);

export function PassRatePage({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'term' | 'year'>('term');
  const [selectedTerm, setSelectedTerm] = useState(terms[0]);
  const [isTermDropdownOpen, setIsTermDropdownOpen] = useState(false);

  const currentDistribution = gradeDistributions[selectedTerm];

  return (
    <div className="absolute inset-0 z-[150] bg-[#F0F5F9] flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* 顶部导航栏 (避开微信胶囊) */}
      <div className="sticky top-0 z-50 w-full bg-[#F0F5F9]/80 backdrop-blur-xl pt-12 pb-3 px-4 flex items-center justify-between border-b border-white/50">
        <button 
          onClick={onBack}
          className="w-10 h-10 rounded-full bg-white shadow-[2px_2px_8px_rgba(0,0,0,0.05),-2px_-2px_8px_rgba(255,255,255,1)] flex items-center justify-center text-slate-600 active:scale-95 transition-transform"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-slate-800 tracking-wide">课程数据详情</h1>
        <div className="w-10 h-10" /> {/* 占位 */}
      </div>

      <main className="flex-1 overflow-y-auto hide-scrollbar px-4 pt-4 pb-24 space-y-6">
        {/* 课程基本信息卡片 */}
        <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-400 to-blue-500 p-6 text-white shadow-[0_8px_20px_rgba(6,182,212,0.3)]">
          <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/20 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -left-10 -bottom-10 w-32 h-32 bg-cyan-200/20 rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-2xl font-bold mb-1">高等数学 (上)</h2>
                <p className="text-cyan-50 text-sm flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4" /> 必修课 · 4.0 学分
                </p>
              </div>
              <div className="bg-white/20 backdrop-blur-md px-3 py-1 rounded-full text-xs font-medium border border-white/30">
                理学院
              </div>
            </div>

            <div className="flex items-center gap-6 mt-6">
              <div>
                <p className="text-cyan-100 text-xs mb-1">历史综合通过率</p>
                <p className="text-3xl font-extrabold flex items-baseline gap-1">
                  88<span className="text-lg font-medium">%</span>
                </p>
              </div>
              <div className="w-px h-10 bg-white/30" />
              <div>
                <p className="text-cyan-100 text-xs mb-1">平均绩点 (GPA)</p>
                <p className="text-3xl font-extrabold flex items-baseline gap-1">
                  2.8<span className="text-lg font-medium">/4.0</span>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* 趋势图表卡片 */}
        <section className="bg-white rounded-3xl p-5 shadow-[4px_4px_12px_rgba(0,0,0,0.03),-4px_-4px_12px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-base font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-blue-500" />
              通过率趋势
            </h3>
            
            <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner">
              <button 
                onClick={() => setActiveTab('term')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                  activeTab === 'term' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                )}
              >
                按学期
              </button>
              <button 
                onClick={() => setActiveTab('year')}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-lg transition-all",
                  activeTab === 'year' ? "bg-white text-blue-600 shadow-sm" : "text-slate-500"
                )}
              >
                按学年
              </button>
            </div>
          </div>

          <div className="h-48 w-full -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPassRate" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="term" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} domain={['dataMin - 10', 'dataMax + 10']} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                  itemStyle={{ color: '#0ea5e9', fontWeight: 'bold' }}
                  labelStyle={{ color: '#64748b', marginBottom: '4px' }}
                />
                <Area type="monotone" dataKey="passRate" name="通过率 (%)" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorPassRate)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* 成绩分布卡片 - 支持按学期选择 */}
        <section className="bg-white rounded-3xl p-5 shadow-[4px_4px_12px_rgba(0,0,0,0.03),-4px_-4px_12px_rgba(255,255,255,1)]">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-base font-bold flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-cyan-500" />
              成绩分布
            </h3>
            
            {/* 学期选择下拉 */}
            <div className="relative">
              <button 
                onClick={() => setIsTermDropdownOpen(!isTermDropdownOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-slate-700 text-xs font-medium rounded-lg border border-slate-200 active:bg-slate-100"
              >
                {selectedTerm}
                <ChevronDown className={cn("w-3.5 h-3.5 transition-transform", isTermDropdownOpen && "rotate-180")} />
              </button>
              
              {isTermDropdownOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsTermDropdownOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-white rounded-xl shadow-lg border border-slate-100 overflow-hidden">
                    {terms.map((term) => (
                      <button
                        key={term}
                        onClick={() => {
                          setSelectedTerm(term);
                          setIsTermDropdownOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-4 py-2.5 text-xs font-medium transition-colors",
                          selectedTerm === term ? "bg-cyan-50 text-cyan-700" : "text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {term}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          
          <div className="space-y-4">
            {currentDistribution.map((item, index) => (
              <div key={index}>
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-slate-600 font-medium">{item.grade}</span>
                  <span className="text-slate-800 font-bold">{item.percentage}%</span>
                </div>
                <div className="h-2.5 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                  <div 
                    className={cn("h-full rounded-full transition-all duration-700 ease-out", item.color)}
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>

      {/* 底部固定操作栏 */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-white/70 backdrop-blur-xl border-t border-white/50 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] pb-safe-offset-4">
        <div className="flex gap-3 max-w-md mx-auto">
          <button className="flex-1 bg-white text-slate-700 font-semibold py-3.5 rounded-2xl shadow-[2px_2px_8px_rgba(0,0,0,0.04),-2px_-2px_8px_rgba(255,255,255,1)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            分享
          </button>
          <button className="flex-[2] bg-gradient-to-r from-cyan-400 to-blue-500 text-white font-bold py-3.5 rounded-2xl shadow-[0_4px_12px_rgba(6,182,212,0.3)] active:scale-[0.98] transition-transform flex items-center justify-center gap-2">
            <Star className="w-5 h-5" />
            特别关注
          </button>
        </div>
      </div>
    </div>
  );
}