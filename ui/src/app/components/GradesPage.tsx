import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronDown, Award, TrendingUp, BookOpen, AlertCircle, Edit3, Check, Circle, CheckCircle2, RefreshCw } from 'lucide-react';
import { BottomSheetPicker } from './BottomSheetPicker';

const termData: Record<string, any[]> = {
  '2025-2026 秋季学期': [
    { id: 1, name: '高等数学 (上)', type: '必修', credit: 5.0, score: 92 },
    { id: 2, name: '大学物理', type: '必修', credit: 4.0, score: 85 },
    { id: 3, name: '计算机导论', type: '必修', credit: 3.0, score: 98 },
    { id: 4, name: '设计心理学', type: '选修', credit: 2.0, score: 88 },
    { id: 5, name: '英语口语交流', type: '必修', credit: 2.0, score: 75 },
  ],
  '2024-2025 春季学期': [
    { id: 11, name: '线性代数', type: '必修', credit: 4.0, score: 89 },
    { id: 12, name: 'C语言程序设计', type: '必修', credit: 3.5, score: 95 },
    { id: 13, name: '中国近代史', type: '必修', credit: 2.0, score: 82 },
    { id: 14, name: '大学生心理健康', type: '选修', credit: 2.0, score: 91 },
  ],
  '2024-2025 秋季学期': [
    { id: 21, name: '微积分基础', type: '必修', credit: 4.0, score: 78 },
    { id: 22, name: '大学英语 (一)', type: '必修', credit: 2.0, score: 85 },
    { id: 23, name: '体育 (一)', type: '必修', credit: 1.0, score: 90 },
  ]
};

const termList = Object.keys(termData);

// 简单的 GPA 计算规则 (模拟4.0体系)
const calculateGPA = (score: number) => {
  if (score >= 90) return 4.0;
  if (score >= 85) return 3.7;
  if (score >= 82) return 3.3;
  if (score >= 78) return 3.0;
  if (score >= 75) return 2.7;
  if (score >= 72) return 2.3;
  if (score >= 68) return 2.0;
  if (score >= 64) return 1.5;
  if (score >= 60) return 1.0;
  return 0.0;
};

export function GradesPage({ onBack }: { onBack: () => void }) {
  const [activeTerm, setActiveTerm] = useState(termList[0]);
  const [isTermPickerOpen, setIsTermPickerOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [courses, setCourses] = useState(termData[termList[0]]);
  const [selectedIds, setSelectedIds] = useState<number[]>(termData[termList[0]].map((c: any) => c.id));

  // 计算选中的课程的动态数据
  const stats = useMemo(() => {
    const selectedCourses = courses.filter(c => selectedIds.includes(c.id));
    const totalCredit = selectedCourses.reduce((sum, c) => sum + c.credit, 0);
    const totalGPAPoints = selectedCourses.reduce((sum, c) => sum + calculateGPA(c.score) * c.credit, 0);
    const avgGPA = totalCredit > 0 ? (totalGPAPoints / totalCredit).toFixed(2) : '0.00';
    
    return {
      gpa: avgGPA,
      credits: totalCredit.toFixed(1),
      count: selectedCourses.length
    };
  }, [courses, selectedIds]);

  const handleScoreChange = (id: number, newScoreStr: string) => {
    const val = parseInt(newScoreStr, 10);
    const newScore = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
    setCourses(prev => prev.map(c => c.id === id ? { ...c, score: newScore } : c));
  };

  const toggleSelection = (id: number) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === courses.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(courses.map(c => c.id));
    }
  };

  const resetData = () => {
    setCourses(termData[activeTerm]);
    setSelectedIds(termData[activeTerm].map((c: any) => c.id));
  };

  const handleTermSelect = (term: string) => {
    setActiveTerm(term);
    setCourses(termData[term]);
    setSelectedIds(termData[term].map((c: any) => c.id));
    setIsEditing(false);
    setIsTermPickerOpen(false);
  };

  return (
    <div className="absolute inset-0 z-[150] bg-[#f4f7fb] flex flex-col animate-in slide-in-from-right-full duration-300">
      {/* Header */}
      <header className="px-4 pt-12 pb-3 flex items-center justify-between bg-white/80 backdrop-blur-xl border-b border-white shadow-[0_2px_10px_rgba(0,0,0,0.02)] sticky top-0 z-20">
        <button onClick={onBack} className="p-1.5 -ml-1.5 rounded-full text-slate-500 hover:bg-slate-100 transition-colors">
          <ChevronLeft size={24} />
        </button>
        <h2 className="text-[16px] font-bold text-slate-800 absolute left-1/2 -translate-x-1/2">成绩查询</h2>
        <div className="w-8"></div> {/* Spacer for centering to avoid native capsule */}
      </header>

      <main className="flex-1 overflow-y-auto hide-scrollbar pb-24">
        {/* GPA Overview Card - Neumorphic + Glassmorphism */}
        <div className="px-4 mt-5 mb-6 transition-all duration-300">
          <div className={`relative overflow-hidden rounded-[24px] p-6 shadow-[0_8px_24px_rgba(59,130,246,0.3)] border border-white/40 transition-colors duration-500 ${isEditing ? 'bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-400' : 'bg-gradient-to-br from-blue-500 via-blue-400 to-cyan-400'}`}>
            {/* Glass decoration */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/20 rounded-full blur-xl translate-y-1/2 -translate-x-1/4"></div>

            <div className="relative z-10">
              <div className="flex items-center justify-between text-white/90 mb-1">
                <div className="flex items-center gap-1.5">
                  <Award size={16} />
                  <span className="text-[13px] font-medium">{isEditing ? '模拟预测 GPA' : '总平均学分绩点 (GPA)'}</span>
                </div>
                {isEditing && (
                  <button onClick={resetData} className="flex items-center gap-1 text-[11px] bg-white/20 hover:bg-white/30 px-2 py-1 rounded-full backdrop-blur-md transition-colors">
                    <RefreshCw size={10} /> 重置
                  </button>
                )}
              </div>
              
              <div className="flex items-baseline gap-2 mb-6 transition-all">
                <span className="text-[40px] font-extrabold text-white tracking-tight leading-none drop-shadow-sm">{stats.gpa}</span>
                <span className="text-[14px] text-white/80 font-medium">/ 4.0</span>
              </div>

              <div className="flex items-center justify-between bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/20">
                <div className="flex flex-col">
                  <span className="text-[11px] text-white/80 mb-0.5">纳入计算学分</span>
                  <span className="text-[15px] font-bold text-white">{stats.credits}</span>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-white/80 mb-0.5">{isEditing ? '选中课程数' : '专业排名'}</span>
                  <span className="text-[15px] font-bold text-white">{isEditing ? `${stats.count} 门` : '12 / 150'}</span>
                </div>
                <div className="w-px h-8 bg-white/20"></div>
                <div className="flex flex-col">
                  <span className="text-[11px] text-white/80 mb-0.5">综合评级</span>
                  <span className="text-[15px] font-bold text-white">{parseFloat(stats.gpa) >= 3.5 ? '优秀' : parseFloat(stats.gpa) >= 2.5 ? '良好' : '一般'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Term Selector & Stats */}
        <div className="px-4 mb-4 flex items-center justify-between">
          <button 
            onClick={() => setIsTermPickerOpen(true)}
            className="flex items-center gap-1.5 bg-white px-4 py-2 rounded-full shadow-[0_2px_8px_rgba(0,0,0,0.02)] border border-slate-50 text-[13px] font-bold text-slate-700 active:scale-95 transition-transform"
          >
            {activeTerm}
            <ChevronDown size={14} className="text-slate-400" />
          </button>
          
          <button 
            onClick={() => setIsEditing(!isEditing)} 
            className={`flex items-center gap-1.5 text-[12px] font-bold px-3 py-1.5 rounded-full transition-colors ${isEditing ? 'bg-blue-500 text-white shadow-[0_2px_8px_rgba(59,130,246,0.3)]' : 'bg-white text-blue-500 border border-slate-50 shadow-[0_2px_8px_rgba(0,0,0,0.02)]'}`}
          >
            {isEditing ? <Check size={14} /> : <Edit3 size={14} />}
            {isEditing ? '完成模拟' : '模拟算分'}
          </button>
        </div>

        {/* Editing Toolbar */}
        {isEditing && (
          <div className="px-4 mb-3 flex items-center justify-between animate-in fade-in duration-200">
            <span className="text-[12px] text-slate-500 font-medium">点击分数可直接修改</span>
            <button onClick={selectAll} className="text-[12px] font-bold text-slate-600 hover:text-blue-500 flex items-center gap-1 bg-white px-3 py-1.5 rounded-full shadow-sm">
              {selectedIds.length === courses.length ? <CheckCircle2 size={14} className="text-blue-500"/> : <Circle size={14} />} 
              全选课程
            </button>
          </div>
        )}

        {/* Score List */}
        <div className="flex flex-col gap-3 px-4">
          {courses.map(course => {
            const isSelected = selectedIds.includes(course.id);
            const courseGpa = calculateGPA(course.score);
            const isExcellent = course.score >= 90;
            
            return (
              <div 
                key={course.id} 
                onClick={() => isEditing && toggleSelection(course.id)}
                className={`bg-white rounded-2xl p-4 shadow-[0_2px_12px_rgba(0,0,0,0.02)] border transition-all duration-200 flex items-center gap-3 relative overflow-hidden group ${isEditing && !isSelected ? 'opacity-50 border-transparent grayscale-[30%]' : 'border-slate-50'} ${isEditing ? 'cursor-pointer active:scale-[0.98]' : ''}`}
              >
                {/* Checkbox for Editing Mode */}
                {isEditing && (
                  <div className="flex-shrink-0">
                    {isSelected ? (
                      <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center shadow-sm">
                        <Check size={12} className="text-white" strokeWidth={3} />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-slate-300"></div>
                    )}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[15px] font-bold text-slate-800">{course.name}</h4>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${course.type === '必修' ? 'bg-blue-50 text-blue-500' : 'bg-slate-100 text-slate-500'}`}>
                      {course.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-slate-400 font-medium">
                    <span className="flex items-center gap-1"><BookOpen size={12} /> {course.credit} 学分</span>
                    <span className="flex items-center gap-1"><AlertCircle size={12} /> 绩点 {courseGpa.toFixed(1)}</span>
                  </div>
                </div>

                {/* Score / Edit Input */}
                <div className="flex flex-col items-end justify-center w-16">
                  {isEditing ? (
                    <div className="flex items-center border-b-2 border-slate-200 focus-within:border-blue-500 transition-colors" onClick={e => e.stopPropagation()}>
                      <input 
                        type="number" 
                        value={course.score || ''}
                        onChange={(e) => handleScoreChange(course.id, e.target.value)}
                        className="w-12 text-center text-[20px] font-extrabold text-slate-800 outline-none bg-transparent"
                      />
                    </div>
                  ) : (
                    <>
                      <span className={`text-[22px] font-extrabold tracking-tight ${course.score >= 90 ? 'text-emerald-500' : course.score >= 80 ? 'text-blue-500' : course.score >= 60 ? 'text-slate-700' : 'text-rose-500'}`}>
                        {course.score}
                      </span>
                      {isExcellent && <span className="text-[10px] font-bold text-amber-500 bg-amber-50 px-1.5 rounded uppercase mt-0.5">Excellent</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        
        {/* Bottom indicator */}
        <div className="mt-6 text-center text-[11px] text-slate-400 font-medium">
          {isEditing ? '模拟分数仅供参考，不代表最终成绩' : '- 到底了 -'}
        </div>
      </main>

      {/* Editing Floating Action Bar */}
      {isEditing && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-[340px] bg-slate-900/95 backdrop-blur-2xl text-white p-2 pl-5 rounded-3xl shadow-[0_12px_40px_rgba(0,0,0,0.2)] flex items-center justify-between border border-slate-700/50 animate-in slide-in-from-bottom-10 z-30">
          <div className="flex flex-col py-1">
            <div className="flex items-center gap-1.5 mb-0.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]"></div>
              <span className="text-[11px] font-medium text-slate-300 tracking-wide">已选 {selectedIds.length} 门课程</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[13px] text-slate-400 font-medium">预测 GPA</span>
              <span className="text-[20px] font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 to-cyan-300 tracking-tight">{stats.gpa}</span>
            </div>
          </div>
          <button 
            onClick={() => setIsEditing(false)} 
            className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-400 hover:to-indigo-400 text-white text-[13px] font-bold px-6 py-3.5 rounded-[20px] shadow-[0_4px_12px_rgba(59,130,246,0.3)] active:scale-[0.97] transition-all"
          >
            完成预测
          </button>
        </div>
      )}

      <BottomSheetPicker 
        isOpen={isTermPickerOpen}
        onClose={() => setIsTermPickerOpen(false)}
        title="选择学期"
        options={termList}
        activeOption={activeTerm}
        onSelect={handleTermSelect}
      />
    </div>
  );
}
