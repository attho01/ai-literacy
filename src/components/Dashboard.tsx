import React, { useState, useEffect } from 'react';
import { AnswerState } from '../types';
import { CalculatedResult, calculateDiagnosticResult, getStarString } from '../utils';
import { RECOMMENDATIONS, PERSONAS, STAGES, QUESTIONS } from '../data';
import { ArrowRight, Award, BookOpen, CheckCircle, AlertTriangle, HelpCircle, BarChart3, Star, Compass, RefreshCw, Layers, ShieldCheck, Download, Users, TrendingUp } from 'lucide-react';

interface DashboardProps {
  answers: AnswerState;
  onRestart: () => void;
  personaName?: string;
}

export default function Dashboard({ answers, onRestart, personaName }: DashboardProps) {
  const result = calculateDiagnosticResult(answers);
  const { stageScores, comprehensiveScore, level, answeredCount, isPartial } = result;

  // Tabs for subnav
  const [activeTab, setActiveTab] = useState<'overview' | 'stage' | 'detail' | 'roadmap' | 'compare'>('overview');
  const [detailStageIdx, setDetailStageIdx] = useState<number>(0);
  const [animate, setAnimate] = useState<boolean>(false);

  // Trigger animation for progress bars when switching tabs
  useEffect(() => {
    setAnimate(false);
    const timer = setTimeout(() => setAnimate(true), 50);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Determine strengths, stable, and improvement stages
  const strengthStages = STAGES.filter(s => stageScores[s.idx] >= 65);
  const stableStages = STAGES.filter(s => stageScores[s.idx] >= 40 && stageScores[s.idx] < 65);
  const improvementStages = STAGES.filter(s => stageScores[s.idx] < 40);

  // Core Starting Stage
  // "즉시 시작할 단계: 점수가 가장 낮은 단계 중 난이도가 가장 낮은 단계"
  const getStartingStage = () => {
    let bestStage = STAGES[0];
    let minScore = stageScores[0];
    
    // Evaluate stages in order of difficulty (0 -> 5)
    for (let i = 0; i < 6; i++) {
      if (stageScores[i] < minScore) {
        minScore = stageScores[i];
        bestStage = STAGES[i];
      }
    }
    return bestStage;
  };

  const startingStage = getStartingStage();
  const targetStage = startingStage.idx < 5 ? STAGES[startingStage.idx + 1] : startingStage;

  // Calculate Radar Chart Coordinates
  const getRadarPolygonPoints = () => {
    const center = 150;
    const maxRadius = 100;
    const points: string[] = [];

    for (let i = 0; i < 6; i++) {
      const score = stageScores[i];
      const radius = (score / 100) * maxRadius;
      // Axis angles: 0, 60, 120, 180, 240, 300 degrees. (pointing up is 270)
      const angle = (i * 60 - 90) * (Math.PI / 180);
      const x = center + radius * Math.cos(angle);
      const y = center + radius * Math.sin(angle);
      points.push(`${x},${y}`);
    }
    return points.join(' ');
  };

  // Distribution chart counts
  const strengthCount = strengthStages.length;
  const stableCount = stableStages.length;
  const improvementCount = improvementStages.length;
  const totalCount = 6;

  // Donut chart stroke-dasharrays
  const donutRadius = 38;
  const circumference = 2 * Math.PI * donutRadius; // ~238.76
  const getDonutStroke = () => {
    const sShare = (strengthCount / totalCount) * circumference;
    const stShare = (stableCount / totalCount) * circumference;
    const iShare = (improvementCount / totalCount) * circumference;
    return { sShare, stShare, iShare };
  };
  const { sShare, stShare, iShare } = getDonutStroke();

  return (
    <div id="diagnose-dashboard" className="w-full max-w-6xl mx-auto bg-[#16191c] min-h-screen text-[#f1f5f9] font-sans pb-16 border-none shadow-none rounded-none">
      {/* Top sticky header */}
      <div className="sticky top-0 bg-[#1c2024] border-b border-[#2d333b] z-20 px-6 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#82c019] text-[#131518] rounded-none font-black">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-[#82c019]">
                AI 활용역량 종합 진단 리포트
              </h1>
              {isPartial && (
                <span className="text-[10px] bg-[#fef3c7]/10 text-amber-400 px-2 py-0.5 font-bold border border-amber-500/30 rounded-none">
                  일부 문항 미응답 ({answeredCount}/42 응답)
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              진단 대상: <span className="font-bold text-white">{personaName || '일반 사용자'}</span> | 진단 일시: {new Date().toLocaleDateString('ko-KR')} | 방식: 행동사건면접(BEI) 자가평가
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-[10px] text-slate-400 block font-mono font-bold">COMPREHENSIVE SCORE</span>
            <div className="flex items-baseline justify-end gap-1">
              <span className="text-2xl font-black text-[#82c019] tracking-tight">{comprehensiveScore}</span>
              <span className="text-[11px] text-slate-400 font-bold">/100점</span>
            </div>
          </div>
          <div className="h-10 w-[1px] bg-[#2d333b]"></div>
          <div className="px-3 py-1 bg-[#82c019]/15 border border-[#82c019]/30 text-center min-w-[70px] rounded-none">
            <span className="text-[9px] text-[#82c019] block font-black leading-none">LEVEL</span>
            <span className="text-sm font-black text-[#82c019] mt-0.5 block">{level}</span>
          </div>
          <button 
            onClick={onRestart}
            className="flex items-center gap-1.5 px-3 py-2 border border-[#82c019] text-xs font-bold bg-[#82c019] text-[#131518] hover:bg-[#72b626] transition-colors cursor-pointer rounded-none"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            재진단
          </button>
        </div>
      </div>

      {/* Sub navigation bar */}
      <div className="bg-[#1c2024] border-b border-[#2d333b] px-4 overflow-x-auto whitespace-nowrap sticky top-[73px] z-10">
        <div className="flex max-w-5xl mx-auto">
          {[
            { id: 'overview', label: '종합 개요 (Overview)', icon: BarChart3 },
            { id: 'stage', label: '단계별 분석 (Stage)', icon: Layers },
            { id: 'detail', label: '문항 상세 (Detail)', icon: Star },
            { id: 'roadmap', label: '학습 로드맵 (Roadmap)', icon: Compass },
            { id: 'compare', label: '역량 비교 (Compare)', icon: Users }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-6 py-3.5 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  isActive
                    ? 'border-[#82c019] text-[#82c019] bg-[#82c019]/15 font-black'
                    : 'border-transparent text-slate-400 hover:text-white hover:bg-[#82c019]/10'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dashboard main contents */}
      <div className="max-w-5xl mx-auto px-6 py-8">
        
        {/* ================== TAB 1: OVERVIEW ================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            
            {/* Top KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-[#24292e] border border-[#2d333b] p-4 flex flex-col justify-between rounded-none shadow-none">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">종합 점수</span>
                  <span className="text-3xl font-extrabold text-[#82c019] mt-1 block">{comprehensiveScore}<span className="text-sm font-normal text-slate-400"> / 100점</span></span>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>백분율 스케일</span>
                  <span className="font-bold text-[#82c019]">상위 약 {Math.max(1, Math.round(100 - (comprehensiveScore * 0.9)))}%</span>
                </div>
              </div>

              <div className="bg-[#24292e] border border-[#2d333b] p-4 flex flex-col justify-between rounded-none shadow-none">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">종합 진단 레벨</span>
                  <span className="text-2xl font-black text-amber-400 mt-2 block">{level} 활용자</span>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>진단 등급</span>
                  <span className="font-bold text-emerald-400">6단계 정밀 분석</span>
                </div>
              </div>

              <div className="bg-[#24292e] border border-[#2d333b] p-4 flex flex-col justify-between rounded-none shadow-none">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">핵심 강점 영역</span>
                  <span className="text-lg font-black text-[#82c019] mt-2 block truncate">
                    {strengthStages.length > 0 ? strengthStages[strengthStages.length - 1].name : STAGES[0].name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>강점 개수</span>
                  <span className="font-bold text-emerald-400">{strengthCount}개 단계</span>
                </div>
              </div>

              <div className="bg-[#24292e] border border-[#2d333b] p-4 flex flex-col justify-between rounded-none shadow-none">
                <div>
                  <span className="text-[11px] uppercase font-bold tracking-wider text-slate-400 block">우선 개선 로드맵</span>
                  <span className="text-lg font-black text-amber-400 mt-2 block truncate">
                    {startingStage.name}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                  <span>우선 과제</span>
                  <span className="font-bold text-amber-400">즉시 실습 권장</span>
                </div>
              </div>
            </div>

            {/* Profile summary card */}
            <div className="bg-[#24292e] border border-[#2d333b] p-5 rounded-none shadow-none">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-[#82c019]/15 text-[#82c019] border border-[#2d333b] rounded-none shrink-0 mt-0.5">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    💡 <strong>현재 분석:</strong> "{personaName || '진단자'} 님은 행동 경험 면접(BEI) 평가 결과 종합 점수 <strong>{comprehensiveScore}점</strong>으로, <strong>{level}</strong> 수준의 자격을 증명하셨습니다.
                    {strengthStages.length > 0 
                      ? ` 특히 ${strengthStages.map(s => s.name).join(', ')} 분야에서 탄탄한 실제 성공 경험을 보유하여 동료 대비 확실한 강점을 드러내고 있습니다.`
                      : ' 아직 디지털 전반의 대형 경험들이 많지 않으나, 기초를 차근차근 다져간다면 생산성 도약을 이뤄낼 수 있는 높은 성장 잠재력을 가지고 있습니다.'}
                  </p>
                  <p className="text-xs text-[#82c019] font-bold mt-3">
                    → 다음 단계: {startingStage.name}의 실무 적용과 연습 문제를 해결하는 것입니다.
                  </p>
                </div>
              </div>
            </div>

            {/* Radar Chart & Bar Chart Columns */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Radar Chart Card (7 cols) */}
              <div className="md:col-span-7 bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#1c2024] text-white text-[11px] font-bold tracking-wider uppercase py-2.5 px-4 border-b border-[#2d333b]">
                  종합 진단 역량 레이더 차트
                </div>
                <div className="p-6 flex flex-col items-center justify-center flex-1">
                  <div className="relative w-[300px] h-[300px]">
                    <svg className="w-full h-full" viewBox="0 0 300 300">
                      {/* Grid Hexagons */}
                      {[20, 40, 60, 80, 100].map((val, idx) => {
                        const r = (val / 100) * 100;
                        const points: string[] = [];
                        for (let i = 0; i < 6; i++) {
                          const angle = (i * 60 - 90) * (Math.PI / 180);
                          const x = 150 + r * Math.cos(angle);
                          const y = 150 + r * Math.sin(angle);
                          points.push(`${x},${y}`);
                        }
                        return (
                          <g key={val}>
                            <polygon
                              points={points.join(' ')}
                              fill="none"
                              stroke="#475569"
                              strokeWidth="0.5"
                              strokeDasharray={idx === 4 ? 'none' : '3,3'}
                            />
                            {/* Value Label */}
                            <text
                              x={150}
                              y={150 - r + 8}
                              fill="#94a3b8"
                              fontSize="8"
                              fontWeight="bold"
                              textAnchor="middle"
                            >
                              {val}
                            </text>
                          </g>
                        );
                      })}

                      {/* Axes */}
                      {STAGES.map((stage, i) => {
                        const angle = (i * 60 - 90) * (Math.PI / 180);
                        const x = 150 + 100 * Math.cos(angle);
                        const y = 150 + 100 * Math.sin(angle);
                        
                        // Label offset placement
                        let textAnchor = 'middle';
                        let dy = '0.35em';
                        const offset = 18;
                        const lx = 150 + (100 + offset) * Math.cos(angle);
                        const ly = 150 + (100 + offset) * Math.sin(angle);

                        if (Math.abs(lx - 150) < 10) {
                          textAnchor = 'middle';
                          dy = ly < 150 ? '-0.5em' : '1.2em';
                        } else if (lx > 150) {
                          textAnchor = 'start';
                        } else {
                          textAnchor = 'end';
                        }

                        return (
                          <g key={stage.idx}>
                            <line
                              x1="150"
                              y1="150"
                              x2={x}
                              y2={y}
                              stroke="#475569"
                              strokeWidth="1"
                            />
                            <text
                              x={lx}
                              y={ly}
                              dy={dy}
                              textAnchor={textAnchor}
                              fill="#f1f5f9"
                              fontSize="9"
                              fontWeight="bold"
                            >
                              {stage.idx}단계: {stage.name.split(' ')[0]}
                            </text>
                          </g>
                        );
                      })}

                      {/* Data Polygon */}
                      <polygon
                        points={getRadarPolygonPoints()}
                        fill="rgba(130, 192, 25, 0.22)"
                        stroke="#82c019"
                        strokeWidth="2.5"
                      />

                      {/* Data Dots */}
                      {STAGES.map((stage, i) => {
                        const score = stageScores[i];
                        const r = (score / 100) * 100;
                        const angle = (i * 60 - 90) * (Math.PI / 180);
                        const x = 150 + r * Math.cos(angle);
                        const y = 150 + r * Math.sin(angle);

                        return (
                          <g key={stage.idx} className="group cursor-pointer">
                            <circle
                              cx={x}
                              cy={y}
                              r="4.5"
                              fill="#82c019"
                              stroke="#16191c"
                              strokeWidth="1.5"
                            />
                            <text
                              x={x}
                              y={y - 8}
                              fill="#82c019"
                              fontSize="9"
                              fontWeight="bold"
                              textAnchor="middle"
                              className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#24292e] px-1 font-mono"
                            >
                              {score}점
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                  <span className="text-[11px] text-slate-400 text-center mt-2">
                    각 축은 각 역량 단계의 환산 점수(0~100) 분포를 의미합니다.
                  </span>
                </div>
              </div>

              {/* Bar Chart & Donut Card (5 cols) */}
              <div className="md:col-span-5 flex flex-col gap-6">
                
                {/* Horizontal Bar Chart */}
                <div className="bg-[#24292e] border border-[#2d333b] flex flex-col flex-1 rounded-none shadow-none">
                  <div className="bg-[#1c2024] text-white text-[11px] font-bold tracking-wider uppercase py-2.5 px-4 border-b border-[#2d333b]">
                    단계별 역량 지표 수준
                  </div>
                  <div className="p-5 space-y-4 flex-1 flex flex-col justify-center">
                    {STAGES.map((stage) => {
                      const score = stageScores[stage.idx];
                      
                      // Theme color depending on score
                      let barColor = 'bg-[#82c019]';
                      if (score >= 65) barColor = 'bg-[#82c019]';
                      else if (score >= 40) barColor = 'bg-[#f59e0b]';
                      else barColor = 'bg-[#ef4444]';

                      return (
                        <div key={stage.idx} className="space-y-1">
                          <div className="flex justify-between text-xs font-bold text-slate-200">
                            <span>{stage.idx}단계 · {stage.name}</span>
                            <span className="font-mono text-[#82c019]">{score}점</span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-800 border border-slate-700 overflow-hidden rounded-none">
                            <div
                              className={`h-full ${barColor} transition-all duration-1000 ease-out`}
                              style={{ width: animate ? `${score}%` : '0%' }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Donut Chart (Distribution) */}
                <div className="bg-[#24292e] border border-[#2d333b] p-4 flex items-center justify-between gap-4 rounded-none shadow-none">
                  <div className="relative w-24 h-24 shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r={donutRadius} fill="none" stroke="#2d333b" strokeWidth="12" />
                      {/* Strength Segment (Lime Green) */}
                      {strengthCount > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          fill="none"
                          stroke="#82c019"
                          strokeWidth="12"
                          strokeDasharray={`${sShare} ${circumference}`}
                        />
                      )}
                      {/* Stable Segment (Orange/Amber) */}
                      {stableCount > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          fill="none"
                          stroke="#f59e0b"
                          strokeWidth="12"
                          strokeDasharray={`${stShare} ${circumference}`}
                          strokeDashoffset={-sShare}
                        />
                      )}
                      {/* Improvement Segment (Red) */}
                      {improvementCount > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={donutRadius}
                          fill="none"
                          stroke="#ef4444"
                          strokeWidth="12"
                          strokeDasharray={`${iShare} ${circumference}`}
                          strokeDashoffset={-(sShare + stShare)}
                        />
                      )}
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-xs font-black text-white leading-none">{comprehensiveScore}</span>
                      <span className="text-[8px] text-slate-400 font-bold mt-0.5">평균</span>
                    </div>
                  </div>

                  <div className="flex-1 space-y-2">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">역량 분포 비율</div>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[#82c019]">
                          <span className="w-2.5 h-2.5 bg-[#82c019]"></span>
                          강점 영역 (≥65)
                        </div>
                        <span className="font-bold font-mono text-white">{strengthCount} / 6</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[#f59e0b]">
                          <span className="w-2.5 h-2.5 bg-[#f59e0b]"></span>
                          안정 영역 (40-64)
                        </div>
                        <span className="font-bold font-mono text-white">{stableCount} / 6</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-[#ef4444]">
                          <span className="w-2.5 h-2.5 bg-[#ef4444]"></span>
                          보완 영역 (&lt;40)
                        </div>
                        <span className="font-bold font-mono text-white">{improvementCount} / 6</span>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* 3-Column Detailed Analysis (Strengths, Stable, Improvement) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Strengths */}
              <div className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#82c019] text-[#131518] text-[11px] font-black tracking-wider uppercase py-2.5 px-4 flex items-center gap-1.5 border-b border-[#2d333b]">
                  <CheckCircle className="w-3.5 h-3.5" />
                  강점 역량 (STRENGTHS)
                </div>
                <div className="p-4 flex-1 space-y-3">
                  {strengthStages.length > 0 ? (
                    strengthStages.map(s => (
                      <div key={s.idx} className="border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                        <h4 className="text-xs font-bold text-[#82c019] flex items-center justify-between">
                          <span>{s.idx}단계. {s.name}</span>
                          <span className="font-mono text-xs font-bold">{stageScores[s.idx]}점</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {RECOMMENDATIONS[s.idx]?.strength || '탁월한 역량을 보여주고 있습니다.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <AlertTriangle className="w-8 h-8 text-[#f59e0b] mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-semibold text-slate-200">아직 확실히 진입된 강점이 없습니다.</p>
                      <p className="text-[10px] text-slate-400 mt-1">상위 단계 학습을 통해 확장할 수 있습니다.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Stable */}
              <div className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#f59e0b] text-[#131518] text-[11px] font-black tracking-wider uppercase py-2.5 px-4 flex items-center gap-1.5 border-b border-[#2d333b]">
                  <BookOpen className="w-3.5 h-3.5" />
                  안정 역량 (STABLE)
                </div>
                <div className="p-4 flex-1 space-y-3">
                  {stableStages.length > 0 ? (
                    stableStages.map(s => (
                      <div key={s.idx} className="border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                        <h4 className="text-xs font-bold text-[#f59e0b] flex items-center justify-between">
                          <span>{s.idx}단계. {s.name}</span>
                          <span className="font-mono text-xs font-bold">{stageScores[s.idx]}점</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {RECOMMENDATIONS[s.idx]?.stable || '어려움 없이 기본 수행이 가능한 중간 레벨의 안정적 영역입니다.'}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <HelpCircle className="w-8 h-8 text-slate-400 mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-semibold text-slate-200">안정 역량이 정의되지 않았습니다.</p>
                      <p className="text-[10px] text-slate-400 mt-1">점수가 전반적으로 낮거나 한쪽에 집중되어 있습니다.</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Needs Improvement */}
              <div className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#ef4444] text-white text-[11px] font-black tracking-wider uppercase py-2.5 px-4 flex items-center gap-1.5 border-b border-[#2d333b]">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  보완 필요 역량 (IMPROVEMENT)
                </div>
                <div className="p-4 flex-1 space-y-3">
                  {improvementStages.length > 0 ? (
                    improvementStages.map(s => (
                      <div key={s.idx} className="border-b border-slate-800 last:border-0 pb-2 last:pb-0">
                        <h4 className="text-xs font-bold text-[#ef4444] flex items-center justify-between">
                          <span>{s.idx}단계. {s.name}</span>
                          <span className="font-mono text-xs font-bold">{stageScores[s.idx]}점</span>
                        </h4>
                        <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                          {RECOMMENDATIONS[s.idx]?.warning || '지식 및 시도 빈도가 상대적으로 저조합니다.'}
                        </p>
                        <div className="mt-2 bg-[#ef4444]/10 p-2 border border-[#ef4444]/20 text-[10px] text-red-300 font-bold leading-normal rounded-none">
                          💡 <strong>추천 실습:</strong> {RECOMMENDATIONS[s.idx]?.firstStep}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-slate-400">
                      <CheckCircle className="w-8 h-8 text-[#82c019] mx-auto opacity-40 mb-2" />
                      <p className="text-xs font-bold text-[#82c019]">완벽한 포트폴리오!</p>
                      <p className="text-[10px] text-slate-300 mt-1">모든 역량이 40점 이상으로 균형이 잡혀 있습니다.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* ================== TAB 2: STAGE ANALYSIS ================== */}
        {activeTab === 'stage' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {STAGES.map((stage) => {
                const score = stageScores[stage.idx];
                const stageQuestions = QUESTIONS.filter(q => q.stageIdx === stage.idx);
                
                // Color mapping depending on difficulty
                let headerColor = 'bg-[#82c019] text-[#131518]'; // 초급 (Primary blue)
                if (stage.difficulty === '중급') headerColor = 'bg-[#f59e0b] text-[#131518]'; // (Orange)
                else if (stage.difficulty === '고급') headerColor = 'bg-[#ef4444] text-white'; // (Red)

                return (
                  <div key={stage.idx} className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none hover:border-[#82c019] transition-colors">
                    {/* Card Header */}
                    <div className={`${headerColor} p-4 flex items-center justify-between rounded-none`}>
                      <div>
                        <span className="text-[11px] uppercase tracking-wider font-bold opacity-90">{stage.difficulty} 단계</span>
                        <h3 className="text-sm font-extrabold tracking-tight mt-0.5">{stage.idx}단계. {stage.name}</h3>
                      </div>
                      <div className="text-right">
                        <span className="text-[9px] block opacity-85 font-mono font-bold">STAGE SCORE</span>
                        <span className="text-xl font-black font-mono">{score}점</span>
                      </div>
                    </div>

                    {/* Progress Track */}
                    <div className="h-2 w-full bg-slate-800 border-b border-[#2d333b]">
                      <div 
                        className={`h-full ${score >= 65 ? 'bg-[#82c019]' : score >= 40 ? 'bg-[#f59e0b]' : 'bg-[#ef4444]'} transition-all duration-1000`}
                        style={{ width: animate ? `${score}%` : '0%' }}
                      />
                    </div>

                    {/* Questions Stars list */}
                    <div className="p-4 flex-1 space-y-2.5">
                      <div className="text-[11px] font-bold text-slate-400 border-b border-slate-800 pb-1 uppercase tracking-wider">문항별 상세 점수 현황</div>
                      <div className="space-y-2">
                        {stageQuestions.map((q) => {
                          const rawScore = answers[q.id];
                          const hasScore = rawScore !== undefined;
                          const actualScore = hasScore ? rawScore : result.imputedAnswers[q.id];
                          const starInfo = getStarString(actualScore);

                          return (
                            <div key={q.id} className="flex items-start justify-between gap-4 text-xs">
                              <span className="text-slate-400 font-mono font-bold shrink-0">Q{q.questionIdx + 1}</span>
                              <p className="text-slate-200 font-semibold truncate flex-1 leading-normal" title={q.title}>
                                {q.title}
                              </p>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-mono text-[#f59e0b] tracking-tight">{starInfo.stars}</span>
                                <span className="font-mono font-bold text-slate-200 w-7 text-right">
                                  {actualScore.toFixed(0)}점
                                  {!hasScore && <span className="text-[8px] text-slate-400 block leading-none font-normal">대체</span>}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Recommendation block inside stage card */}
                      <div className="mt-4 pt-3 border-t border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">추천 성장 가이드라인</div>
                        <div className="bg-[#1c2024] border border-[#2d333b] p-3 space-y-2 rounded-none">
                          <div className="text-[11px] leading-relaxed text-slate-300">
                            <strong>첫걸음 실습:</strong> {RECOMMENDATIONS[stage.idx]?.firstStep}
                          </div>
                          <div className="text-[11px] leading-relaxed text-slate-300">
                            <strong>심화 단련법:</strong> {RECOMMENDATIONS[stage.idx]?.practice}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================== TAB 3: DETAILS TABLE ================== */}
        {activeTab === 'detail' && (
          <div className="space-y-6">
            
            {/* Stage Selector for detail table */}
            <div className="flex border border-[#2d333b] bg-[#1c2024] p-1 overflow-x-auto whitespace-nowrap rounded-none shadow-none">
              {STAGES.map((s) => (
                <button
                  key={s.idx}
                  onClick={() => setDetailStageIdx(s.idx)}
                  className={`flex-1 min-w-[120px] py-2 px-3 text-xs font-bold border cursor-pointer text-center rounded-none ${
                    detailStageIdx === s.idx
                      ? 'bg-[#82c019] text-[#131518] border-[#82c019]'
                      : 'bg-transparent text-slate-400 border-transparent hover:bg-[#82c019]/15 hover:text-white'
                  }`}
                >
                  {s.idx}단계 · {s.name.split(' ')[0]}
                </button>
              ))}
            </div>

            {/* Questions Table */}
            <div className="bg-[#24292e] border border-[#2d333b] overflow-hidden rounded-none shadow-none">
              <div className="bg-[#1c2024] text-[#82c019] text-[11px] font-bold tracking-wider uppercase py-3 px-4 border-b border-[#2d333b]">
                {detailStageIdx}단계. {STAGES[detailStageIdx].name} 상세 응답 평가 데이터
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#1c2024] border-b border-[#2d333b] text-[#82c019] font-bold">
                      <th className="py-3 px-4 w-12 font-mono text-center">번호</th>
                      <th className="py-3 px-4 w-1/2">진단 질문 내용 (BEI 행동 사건 기준)</th>
                      <th className="py-3 px-4 w-16 text-center">원점수</th>
                      <th className="py-3 px-4 w-32 text-center">성취 등급 별점</th>
                      <th className="py-3 px-4 w-28 text-center">경험 달성률</th>
                      <th className="py-3 px-4 text-center">비고 / 분석 의견</th>
                    </tr>
                  </thead>
                  <tbody>
                    {QUESTIONS.filter(q => q.stageIdx === detailStageIdx).map((q) => {
                      const rawScore = answers[q.id];
                      const hasScore = rawScore !== undefined;
                      const actualScore = hasScore ? rawScore : result.imputedAnswers[q.id];
                      const starInfo = getStarString(actualScore);
                      const percentage = ((actualScore - 1) / 4) * 100;

                      // Level comment
                      let remarks = '안정 수준';
                      let remarksColor = 'text-[#82c019]';
                      if (actualScore >= 4) {
                        remarks = '우수 (리드 가능)';
                        remarksColor = 'text-[#9ce024] font-bold';
                      } else if (actualScore < 2.5) {
                        remarks = '미흡 (체험 권장)';
                        remarksColor = 'text-[#ef4444] font-bold';
                      }

                      return (
                        <tr key={q.id} className="border-b border-slate-800/80 hover:bg-slate-800/30">
                          <td className="py-3.5 px-4 font-mono text-center font-bold text-slate-400">Q{q.questionIdx + 1}</td>
                          <td className="py-3.5 px-4 space-y-1">
                            <div className="font-bold text-slate-200 leading-snug">{q.title}</div>
                            <div className="text-[11px] text-[#82c019] flex items-center gap-1">
                              <span>🙂 <strong>쉽게 말하면:</strong> {q.easyExplain}</span>
                            </div>
                            <div className="text-[10px] text-slate-400">💡 예시: {q.example}</div>
                          </td>
                          <td className="py-3.5 px-4 text-center font-mono font-bold text-sm text-white">
                            {actualScore.toFixed(0)}점
                            {!hasScore && <span className="text-[9px] text-[#94a3b8] block font-normal">(대체)</span>}
                          </td>
                          <td className="py-3.5 px-4 text-center text-[#f59e0b] font-mono tracking-tight text-[11px]">
                            {starInfo.stars}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-full bg-slate-800 border border-slate-700 overflow-hidden">
                                <div className="h-full bg-[#82c019]" style={{ width: `${percentage}%` }} />
                              </div>
                              <span className="font-mono text-[10px] font-bold text-white shrink-0">{Math.round(percentage)}%</span>
                            </div>
                                   </td>
                          <td className={`py-3.5 px-4 text-center text-[11px] ${remarksColor}`}>
                            {remarks}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Aggregated Total Row */}
                    <tr className="bg-[#1c2024] font-black text-[#82c019] border-t border-[#82c019]">
                      <td colSpan={2} className="py-4 px-4 text-right text-xs uppercase tracking-wider">
                        {detailStageIdx}단계 원점수 합계 / 환산 백분율 총점
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-base">
                        {result.stageOriginalSums[detailStageIdx].toFixed(1)} / 35
                      </td>
                      <td className="py-4 px-4 text-center font-mono text-[11px]">
                        ★평균: {result.stageAverages[detailStageIdx].toFixed(1)}
                      </td>
                      <td colSpan={2} className="py-4 px-4 text-center font-mono text-base font-black">
                        환산 지수: {stageScores[detailStageIdx]}점 / 100점 만점
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ================== TAB 4: ROADMAP ================== */}
        {activeTab === 'roadmap' && (
          <div className="space-y-6">
            
            {/* Pathway Timeline visualization */}
            <div className="bg-[#24292e] border border-[#2d333b] p-6 rounded-none shadow-none">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-6">단계별 성취 경로 상황판</h3>
              
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative">
                {/* Horizontal connection line */}
                <div className="absolute top-[22px] left-8 right-8 h-[2px] bg-slate-700 hidden md:block z-0" />

                {STAGES.map((s, idx) => {
                  const score = stageScores[s.idx];
                  const isStarting = s.idx === startingStage.idx;
                  const isTarget = s.idx === targetStage.idx;
                  
                  // Status flag
                  let statusLabel = '예정 (TODO)';
                  let statusStyle = 'bg-slate-800/50 text-slate-400 border-slate-700/80';
                  
                  if (score >= 65) {
                    statusLabel = '안정 (DONE)';
                    statusStyle = 'bg-[#82c019]/15 text-[#82c019] border-[#82c019]/30 font-bold';
                  } else if (isStarting) {
                    statusLabel = '지금 출발 (NOW)';
                    statusStyle = 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30 font-bold scale-105 shadow-none ring-2 ring-[#f59e0b]/20';
                  } else if (isTarget) {
                    statusLabel = '다음 목표 (NEXT)';
                    statusStyle = 'bg-[#9ce024]/10 text-[#9ce024] border-[#9ce024]/30 font-bold';
                  }

                  return (
                    <div key={s.idx} className="flex-1 flex flex-col items-center text-center relative z-10">
                      {/* Step Circle */}
                      <div className={`w-12 h-12 flex items-center justify-center font-black text-sm border-2 rounded-none transition-all ${
                        score >= 65 
                          ? 'bg-[#82c019] border-[#82c019] text-[#131518]' 
                          : isStarting 
                            ? 'bg-[#82c019] border-[#82c019] text-[#131518] ring-4 ring-[#82c019]/25' 
                            : 'bg-[#1c2024] border-slate-700 text-slate-500'
                      }`}>
                        {idx}
                      </div>

                      <h4 className="text-xs font-bold text-slate-200 mt-2.5 tracking-tight">{s.name.split(' ')[0]}</h4>
                      <span className="font-mono text-[10px] text-slate-400 block mt-0.5">{score}점</span>

                      {/* Status badge */}
                      <span className={`text-[9px] px-2 py-0.5 border mt-2 rounded-none ${statusStyle}`}>
                        {statusLabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Monthly Plan Grid */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              
              {/* Timeline Card (8 cols) */}
              <div className="md:col-span-8 bg-[#24292e] border border-[#2d333b] overflow-hidden rounded-none shadow-none">
                <div className="bg-[#1c2024] text-white text-[11px] font-bold tracking-wider uppercase py-3 px-4 border-b border-[#2d333b]">
                  실행 행동 로드맵 (6개월 스펙 트랙킹 계획)
                </div>
                <div className="p-4">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#1c2024] border-b border-[#2d333b] font-bold text-[#82c019]">
                        <th className="py-2.5 px-3 w-16 text-center">목표 월</th>
                        <th className="py-2.5 px-3 w-32">집중 단계</th>
                        <th className="py-2.5 px-3">구체적 주차별 수행 행동</th>
                        <th className="py-2.5 px-3 w-28 text-center">기대 환산점수</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { month: '1개월차', stage: startingStage, action: `${startingStage.name} 추천 실습 즉시 이행: "${RECOMMENDATIONS[startingStage.idx]?.firstStep}" 성공하기`, score: Math.min(100, stageScores[startingStage.idx] + 20) },
                        { month: '2개월차', stage: startingStage, action: `${startingStage.name} 심화 반복 실무 투입: "${RECOMMENDATIONS[startingStage.idx]?.practice}" 주 2회 규칙화`, score: Math.min(100, stageScores[startingStage.idx] + 35) },
                        { month: '3개월차', stage: targetStage, action: `${targetStage.name} 기본 교재/무료 유튜브 채널 탐독 후, 실제 샘플 이메일이나 소형 지시문 견본 제작`, score: Math.min(100, stageScores[targetStage.idx] + 15) },
                        { month: '4개월차', stage: targetStage, action: `${targetStage.name} 맞춤 환경 설정 및 지인 공유를 통한 실 사용 피드백 3건 분석하여 지시문 개선`, score: Math.min(100, stageScores[targetStage.idx] + 30) },
                        { month: '5~6개월차', stage: STAGES[Math.min(5, targetStage.idx + 1)], stageLabel: STAGES[Math.min(5, targetStage.idx + 1)].name, action: `상위 비즈니스 데이터 구조와 API 연결 원리 숙지, 자동 수집 및 이종 앱 간 메일/메시지 동기화 설정 구동`, score: 70 }
                      ].map((p, i) => (
                        <tr key={i} className="border-b border-slate-800 last:border-0 hover:bg-[#82c019]/10">
                          <td className="py-3 px-3 text-center font-bold text-[#82c019]">{p.month}</td>
                          <td className="py-3 px-3 font-semibold text-white">
                            {p.stage.idx}단계. {p.stage.name.split(' ')[0]}
                          </td>
                          <td className="py-3 px-3 text-slate-300 leading-relaxed">
                            {p.action}
                          </td>
                          <td className="py-3 px-3 text-center font-mono font-bold text-[#82c019]">
                            현재 {stageScores[p.stage.idx]}점 ➜ <span className="text-sm font-black">{p.score}점</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tips list (4 cols) */}
              <div className="md:col-span-4 bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#1c2024] text-white text-[11px] font-bold tracking-wider uppercase py-3 px-4 border-b border-[#2d333b]">
                  추천 학습 자원 (리소스 채널)
                </div>
                <div className="p-4 flex-1 space-y-4">
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">1. 무료 고성능 유튜브 독학</span>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      "조코딩 JoCoding" 채널의 쉬운 생성형 AI 사용법, 혹은 "일잘러 장비글" 채널의 업무 자동화(Zapier/Airtable) 초보자 입문 영상 시청을 강하게 권장합니다.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">2. 베스트셀러 도구 도서</span>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      《된다! 하루 만에 끝내는 프롬프트 엔지니어링과 AI 실무 정복》 혹은 노코드 활용법 입문 도서를 도서관에서 대여하여 예제를 보며 가볍게 손 코딩해봅니다.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">3. 커뮤니티 네트외킹</span>
                    <p className="text-xs text-slate-300 font-medium leading-relaxed">
                      \'지피터스(GPTERS)\' AI 유저 커뮤니티에 가입하여 다른 사람들의 "실제 업무 자동화 성공 경험기"를 눈으로 읽는 것만으로도 내 경험을 확장하는 훌륭한 계기가 됩니다.
                    </p>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ================== TAB 5: COMPARE & SCENARIOS ================== */}
        {activeTab === 'compare' && (
          <div className="space-y-6">
            
            {/* National Benchmark Comparison Charts */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Chart 1: Average by Job Groups */}
              <div className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#1c2024] text-[#82c019] text-[11px] font-bold tracking-wider uppercase py-2.5 px-4 border-b border-[#2d333b]">
                  주요 직군 평균 점수 대비 본인 역량 비교
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: '50대 직업상담사 평균', score: 25 },
                    { label: '40대 스마트스토어 소상공인 평균', score: 32 },
                    { label: '본인 종합 진단 점수', score: comprehensiveScore, isUser: true },
                    { label: '20대 스타트업 마케터 평균', score: 55 },
                    { label: '30대 IT 기업 기획자 평균', score: 79 }
                  ].map((item, idx) => {
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className={item.isUser ? 'text-[#82c019] font-black' : 'text-slate-400'}>
                            {item.label} {item.isUser && '⭐'}
                          </span>
                          <span className="font-mono text-[#82c019]">{item.score}점</span>
                        </div>
                        <div className="h-4 w-full bg-slate-800 border border-slate-700 overflow-hidden rounded-none">
                          <div 
                            className={`h-full ${item.isUser ? 'bg-[#82c019]' : 'bg-slate-500/60'} transition-all duration-1000`}
                            style={{ width: animate ? `${item.score}%` : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Chart 2: National Average vs Self by Stage */}
              <div className="bg-[#24292e] border border-[#2d333b] flex flex-col rounded-none shadow-none">
                <div className="bg-[#1c2024] text-[#82c019] text-[11px] font-bold tracking-wider uppercase py-2.5 px-4 border-b border-[#2d333b]">
                  전국 연령대별 평균 점수 대비 본인 역량 비교
                </div>
                <div className="p-5 space-y-4">
                  {[
                    { label: '60대 이상 전국 평균', score: 18 },
                    { label: '50대 전국 평균', score: 28 },
                    { label: '본인 종합 진단 점수', score: comprehensiveScore, isUser: true },
                    { label: '40대 전국 평균', score: 40 },
                    { label: '30대 전국 평균', score: 58 },
                    { label: '20대 전국 평균', score: 64 }
                  ].map((item, idx) => {
                    return (
                      <div key={idx} className="space-y-1">
                        <div className="flex justify-between text-xs font-bold">
                          <span className={item.isUser ? 'text-[#82c019] font-black' : 'text-slate-400'}>
                            {item.label} {item.isUser && '⭐'}
                          </span>
                          <span className="font-mono text-[#82c019]">{item.score}점</span>
                        </div>
                        <div className="h-4 w-full bg-slate-800 border border-slate-700 overflow-hidden rounded-none">
                          <div 
                            className={`h-full ${item.isUser ? 'bg-[#82c019]' : 'bg-slate-500/60'} transition-all duration-1000`}
                            style={{ width: animate ? `${item.score}%` : '0%' }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Growth Potential Simulator Card */}
            <div className="bg-[#24292e] border border-[#2d333b] overflow-hidden rounded-none shadow-none">
              <div className="bg-[#1c2024] text-white text-[11px] font-bold tracking-wider uppercase py-3 px-4 border-b border-[#2d333b]">
                📈 미래 지향적 AI 역량 성장 가상 시나리오 분석
              </div>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
                  {/* Scenario 1: 3 months */}
                  <div className="border border-[#2d333b] p-4 bg-[#1c2024] space-y-2 rounded-none">
                    <div className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">시나리오 A: 3개월 단기 집중 법칙</div>
                    <h4 className="text-sm font-bold text-white">"디지털 자신감 회복 단계"</h4>
                    <p className="text-slate-300 font-medium leading-relaxed">
                      구글 클라우드 자동 동기화와 ChatGPT 프롬프트 예시 입력을 습관화하여 기초 및 생성형 AI 도구 이해 등 초중급 구간 2개 단계를 완전한 강점 영역으로 확장합니다.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-[#82c019]">
                      <span>예상 성취 점수</span>
                      <span className="font-extrabold text-[#82c019]">종합 {Math.min(100, comprehensiveScore + 12)}점</span>
                    </div>
                  </div>

                  {/* Scenario 2: 6 months */}
                  <div className="border border-[#2d333b] p-4 bg-[#1c2024] space-y-2 rounded-none">
                    <div className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">시나리오 B: 6개월 실무 적용 마일스톤</div>
                    <h4 className="text-sm font-bold text-white">"커스텀 챗봇 사내 도입 단계"</h4>
                    <p className="text-slate-300 font-medium leading-relaxed">
                      나만의 맞춤형 GPT 챗봇에 매뉴얼을 등록하고 동료들과 링크로 실사용합니다. 구글 설문 폼과 시트를 연동하여 현업 데이터를 고속 자동 취합하는 단계에 도달합니다.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-[#82c019]">
                      <span>예상 성취 점수</span>
                      <span className="font-extrabold text-[#82c019]">종합 {Math.min(100, comprehensiveScore + 25)}점</span>
                    </div>
                  </div>

                  {/* Scenario 3: 1 year */}
                  <div className="border border-[#2d333b] p-4 bg-[#1c2024] space-y-2 rounded-none">
                    <div className="text-[11px] font-extrabold text-[#82c019] uppercase tracking-wider block">시나리오 C: 1년 비즈니스 마스터 플랜</div>
                    <h4 className="text-sm font-bold text-white">"비즈니스 완전 자동화 선도"</h4>
                    <p className="text-slate-300 font-medium leading-relaxed">
                      Zapier/Make를 사용하여 두 가지 이상의 클라우드 웹 서비스를 완벽히 자동 연계시킵니다. 오류 원인 트래킹 및 파이썬 스크립트 수정 처리를 대행하는 최고 실무 기획자로 진화합니다.
                    </p>
                    <div className="pt-2 border-t border-slate-800 flex justify-between font-bold text-[#82c019]">
                      <span>예상 성취 점수</span>
                      <span className="font-extrabold text-[#82c019]">종합 {Math.min(100, comprehensiveScore + 40)}점</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        )}

      </div>
    </div>
  );
}
