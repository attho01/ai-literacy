import { AnswerState, Question } from './types';
import { RECOMMENDATIONS, STAGES, QUESTIONS } from './data';

export interface CalculatedResult {
  isPartial: boolean;
  answeredCount: number;
  stageScores: { [stageIdx: number]: number }; // 0-100 scale score
  stageOriginalSums: { [stageIdx: number]: number }; // raw sum (could be imputed)
  stageAverages: { [stageIdx: number]: number }; // 1-5 scale (could be imputed)
  isImputed: { [stageIdx: number]: boolean };
  hasNoResponsesInStage: { [stageIdx: number]: boolean };
  comprehensiveScore: number;
  level: '초급' | '중급' | '고급';
  imputedAnswers: AnswerState; // holds raw + imputed scores for all 42 questions
}

export function calculateDiagnosticResult(answers: AnswerState): CalculatedResult {
  const answeredCount = Object.keys(answers).length;
  const isPartial = answeredCount < 42;

  const imputedAnswers: AnswerState = { ...answers };
  const stageScores: { [stageIdx: number]: number } = {};
  const stageOriginalSums: { [stageIdx: number]: number } = {};
  const stageAverages: { [stageIdx: number]: number } = {};
  const isImputed: { [stageIdx: number]: boolean } = {};
  const hasNoResponsesInStage: { [stageIdx: number]: boolean } = {};

  // For each of the 6 stages (0 to 5)
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const stageQuestions = QUESTIONS.filter(q => q.stageIdx === sIdx);
    const answeredInStage = stageQuestions.filter(q => q.id in answers);
    
    let avg = 1.0;
    let noResponse = false;
    let imputedFlag = false;

    if (answeredInStage.length > 0) {
      const sum = answeredInStage.reduce((acc, q) => acc + (answers[q.id] || 1), 0);
      avg = sum / answeredInStage.length;
      if (answeredInStage.length < 7) {
        imputedFlag = true;
      }
    } else {
      avg = 1.0;
      noResponse = true;
      if (isPartial) {
        imputedFlag = true;
      }
    }

    hasNoResponsesInStage[sIdx] = noResponse;
    isImputed[sIdx] = imputedFlag;

    // Fill missing questions in this stage
    stageQuestions.forEach(q => {
      if (!(q.id in answers)) {
        imputedAnswers[q.id] = Math.round(avg * 10) / 10; // keep one decimal for internal representation
      }
    });

    // Re-calculate sum with imputed values (clamped to 1-5 for calculation)
    const totalStageSum = stageQuestions.reduce((acc, q) => {
      const val = imputedAnswers[q.id] || 1;
      return acc + val;
    }, 0);

    stageOriginalSums[sIdx] = Math.round(totalStageSum * 10) / 10;
    stageAverages[sIdx] = Math.round((totalStageSum / 7) * 10) / 10;

    // Stage score = (sum / 35) * 100 -> round to integer
    const rawStageScore = (totalStageSum / 35) * 100;
    stageScores[sIdx] = Math.round(rawStageScore);
  }

  // Comprehensive score = average of 6 stage scores -> round to integer
  const sumOfStageScores = Object.values(stageScores).reduce((acc, s) => acc + s, 0);
  const comprehensiveScore = Math.round(sumOfStageScores / 6);

  // Level determination:
  // 종합 0~39점 -> 초급
  // 종합 40~64점 -> 중급
  // 종합 65~100점 -> 고급
  let level: '초급' | '중급' | '고급' = '초급';
  if (comprehensiveScore >= 65) {
    level = '고급';
  } else if (comprehensiveScore >= 40) {
    level = '중급';
  }

  return {
    isPartial,
    answeredCount,
    stageScores,
    stageOriginalSums,
    stageAverages,
    isImputed,
    hasNoResponsesInStage,
    comprehensiveScore,
    level,
    imputedAnswers
  };
}

export function getStarString(score: number): { stars: string; scoreStr: string } {
  const filledCount = Math.min(5, Math.max(0, Math.round(score)));
  const stars = '★'.repeat(filledCount) + '☆'.repeat(Math.max(0, 5 - filledCount));
  return {
    stars,
    scoreStr: score.toFixed(1)
  };
}

export function getAsciiBarChart(score: number): string {
  // █ 1개 = 10점. 막대 개수 = round(단계점수 ÷ 10), 최대 10개. 나머지 칸은 ░로 채워 총 12칸 폭
  const blocksCount = Math.min(10, Math.max(0, Math.round(score / 10)));
  const emptyCount = 12 - blocksCount;
  return '█'.repeat(blocksCount) + '░'.repeat(emptyCount);
}

export function getGeneralFeedback(level: '초급' | '중급' | '고급', score: number): string {
  if (level === '고급') {
    return '축하합니다! AI 기술과 데이터 자동화 환경을 주도하며 새로운 가치를 직접 창출하는 최고 수준의 AI 테크 인재이십니다.';
  } else if (level === '중급') {
    return '훌륭합니다! 일상과 실무에 생성형 AI를 유용하게 투입하고, 지침에 맞게 유용한 챗봇을 설계해내는 우수한 중급 활용자이십니다.';
  } else {
    return '도약의 준비가 되셨습니다! 디지털 기본 조작에 적응하고 AI 도구를 흥미롭게 탐색해보는 든든한 출발선에 서 계십니다.';
  }
}

export function generateTextReport(answers: AnswerState, name?: string): string {
  const res = calculateDiagnosticResult(answers);
  const { stageScores, comprehensiveScore, level, answeredCount, isPartial, imputedAnswers } = res;

  let report = '';
  
  // Header
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `🎯 AI 활용역량 진단 결과\n`;
  if (isPartial) {
    report += `(일부 문항 미응답 — ${answeredCount}/42 응답 기준)\n`;
  }
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // ① 종합 레벨 판정
  report += `종합 수준: [${level}]\n`;
  report += `종합 점수: ${comprehensiveScore}점 / 100점\n\n`;
  report += `[한 줄 총평 — ${name || '진단자'}님은 ${getGeneralFeedback(level, comprehensiveScore)}]\n\n`;

  // ② 단계별 점수표
  report += `📊 단계별 역량 점수\n`;
  report += `──────────────────────────────────────────\n`;
  STAGES.forEach(s => {
    const score = stageScores[s.idx];
    const bar = getAsciiBarChart(score);
    report += `${s.idx}단계 · ${s.name.padEnd(10, ' ')} ${bar}  ${score}점  [${s.difficulty}]\n`;
  });
  report += `──────────────────────────────────────────\n`;
  report += `(█ 1개 = 10점 · [ ] 안은 단계 난이도)\n\n`;

  // ③ 문항별 응답 요약
  report += `📋 문항별 응답 내역\n\n`;
  for (let sIdx = 0; sIdx < 6; sIdx++) {
    const s = STAGES[sIdx];
    report += `[${s.idx}단계 — ${s.name}]\n`;
    const stageQuestions = QUESTIONS.filter(q => q.stageIdx === sIdx);
    stageQuestions.forEach(q => {
      const isImputed = !(q.id in answers);
      const score = imputedAnswers[q.id];
      const star = getStarString(score).stars;
      const cleanTitle = q.title.length > 20 ? q.title.slice(0, 18) + '...' : q.title;
      const label = `  Q${q.questionIdx + 1}. ${cleanTitle.padEnd(23, ' ')}`;
      const imputationLabel = isImputed ? ' (미응답·대체)' : '';
      report += `${label} ${star}  ${score.toFixed(0)}점${imputationLabel}\n`;
    });
    report += `\n`;
  }

  // ④ 강점 / 보완 포인트 분석
  const strengthStages = STAGES.filter(s => stageScores[s.idx] >= 65);
  const stableStages = STAGES.filter(s => stageScores[s.idx] >= 40 && stageScores[s.idx] < 65);
  const improvementStages = STAGES.filter(s => stageScores[s.idx] < 40);

  report += `💪 강점 역량 (65점 이상)\n`;
  if (strengthStages.length > 0) {
    strengthStages.forEach(s => {
      report += `  ✅ [${s.name}]: ${RECOMMENDATIONS[s.idx]?.strength}\n`;
    });
  } else {
    // 강점이 없으면 가장 높은 단계를 짚어 출발점으로 제시
    let highestStage = STAGES[0];
    let maxS = stageScores[0];
    for (let i = 1; i < 6; i++) {
      if (stageScores[i] > maxS) {
        maxS = stageScores[i];
        highestStage = STAGES[i];
      }
    }
    report += `  ✅ [${highestStage.name}]: 가장 높은 역량 점수(${maxS}점)를 보여주고 있어 성장의 주요 돌파구로 활약할 가능성이 큽니다.\n`;
  }
  report += `\n`;

  if (stableStages.length > 0) {
    report += `➖ 안정 역량 (40~64점)\n`;
    stableStages.forEach(s => {
      report += `  ◽ [${s.name}]: ${RECOMMENDATIONS[s.idx]?.stable}\n`;
    });
    report += `\n`;
  }

  report += `⚠️ 보완 필요 역량 (40점 미만)\n`;
  if (improvementStages.length > 0) {
    improvementStages.forEach(s => {
      report += `  🔸 [${s.name}]: ${RECOMMENDATIONS[s.idx]?.warning}\n`;
      report += `     → 추천 첫 실습: [${RECOMMENDATIONS[s.idx]?.firstStep}]\n`;
    });
  } else {
    report += `  🔸 전 분야 고루 우수함: 눈에 띄는 취약 단계 없이 전체적으로 40점 이상의 안정적 밸런스를 달성하셨습니다.\n`;
  }
  report += `  (낮은 단계에는 격려를 드립니다: "아직 안 해봤을 뿐이에요. 지금부터 하나씩 해보면 충분해요!")\n\n`;

  // ⑤ 맞춤 학습 경로
  // "즉시 시작할 단계: 점수가 가장 낮은 단계 중 난이도가 가장 낮은 단계"
  let startingStage = STAGES[0];
  let minScore = stageScores[0];
  for (let i = 0; i < 6; i++) {
    if (stageScores[i] < minScore) {
      minScore = stageScores[i];
      startingStage = STAGES[i];
    }
  }
  const targetStage = startingStage.idx < 5 ? STAGES[startingStage.idx + 1] : startingStage;

  let directionText = '';
  if (level === '고급') {
    directionText = '고급 워크플로우를 완벽히 통제하고 데이터와 AI 협업을 선도하는 비즈니스 자동화 전문가로 진화해보세요.';
  } else if (level === '중급') {
    directionText = '내가 만든 AI 챗봇의 배포와 더불어, 실무 데이터를 연계하는 노코드 대시보드 실습에 즉시 돌입해보세요.';
  } else {
    directionText = '컴퓨터 환경 설정과 클라우드 연동을 손에 익히고, 대화형 AI 도구에 간단한 메일 쓰기부터 가볍게 시작해 보세요.';
  }

  report += `🗺️ 권장 학습 경로\n\n`;
  report += `[레벨별 맞춤 방향]: ${directionText}\n\n`;
  report += `→ 즉시 시작할 단계: ${startingStage.idx}단계 (${startingStage.name})\n`;
  report += `→ 목표 완성 단계:   ${targetStage.idx}단계 (${targetStage.name})\n\n`;

  report += `📌 단계별 추천 첫 실습 (초보도 바로 따라 할 수 있는 쉬운 행동으로)\n`;
  STAGES.forEach(s => {
    report += `  ${s.idx}단계: [${RECOMMENDATIONS[s.idx]?.firstStep}]\n`;
  });
  report += `\n`;

  // ⑥ 마무리
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  report += `진단을 완료했습니다! 🎉\n\n`;
  report += `특정 단계 학습법이 궁금하면 "X단계 학습법 알려줘" (예: 2단계 학습법 알려줘)\n`;
  report += `모르는 용어가 있으면 "OOO이 뭐예요?" (예: API가 뭐예요?)\n`;
  report += `다시 진단하려면 "재학습" 또는 "재진단"\n`;
  report += `HTML 대시보드로 보려면 "대시보드 보여줘"를 입력해 주세요.\n`;
  report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  return report;
}

