import React, { useState, useEffect, useRef } from 'react';
import { AnswerState, ChatMessage, Question, Persona } from './types';
import { STAGES, QUESTIONS, PERSONAS, STEP_0_WELCOME, RECOMMENDATIONS } from './data';
import { calculateDiagnosticResult, generateTextReport } from './utils';
import Dashboard from './components/Dashboard';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, BarChart3, Send, RefreshCw, HelpCircle, GraduationCap, XCircle, ChevronRight, User, Sparkles, AlertCircle, ShieldCheck, Layers, Briefcase, Compass, Award, BookOpen } from 'lucide-react';

export default function App() {
  // Navigation Tabs
  const [activeMainTab, setActiveMainTab] = useState<'assessment' | 'dashboard'>('assessment');
  const [dashboardUnlocked, setDashboardUnlocked] = useState<boolean>(false);

  // Diagnostic State
  const [appState, setAppState] = useState<'welcome' | 'diagnosing' | 'result'>('welcome');
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<AnswerState>({});
  const [personaName, setPersonaName] = useState<string>('');

  // Gemini Key Authorization State
  const [isAuthorized, setIsAuthorized] = useState<boolean>(false);
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [showKey, setShowKey] = useState<boolean>(false);
  const [isCheckingKey, setIsCheckingKey] = useState<boolean>(false);
  const [keyError, setKeyError] = useState<string>('');
  const [serverHasKey, setServerHasKey] = useState<boolean>(false);

  // Chat History
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_msg_id',
      sender: 'coach',
      text: STEP_0_WELCOME,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState<string>('');

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Check key authorization on mount
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    if (savedKey) {
      setIsAuthorized(true);
    }

    fetch('/api/has-key')
      .then(res => res.json())
      .then(data => {
         if (data.hasKey) {
           setServerHasKey(true);
         }
      })
      .catch(err => console.error('Error checking server key:', err));
  }, []);

  // Verify and save key
  const handleVerifyKey = async (customKey?: string) => {
    // If user clicks "Activate with Server Key", customKey will be passed as 'use_server_key'
    const keyToVerify = customKey !== undefined ? customKey : apiKeyInput.trim();
    if (!keyToVerify) {
      setKeyError('Gemini API Key를 입력해 주세요.');
      return;
    }

    setIsCheckingKey(true);
    setKeyError('');

    const keyToSend = keyToVerify === 'use_server_key' ? '' : keyToVerify;

    try {
      const response = await fetch('/api/verify-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: keyToSend }),
      });

      const data = await response.json();
      if (data.valid) {
        localStorage.setItem('gemini_api_key', keyToVerify);
        setIsAuthorized(true);
      } else {
        setKeyError(data.error || '유효하지 않은 API Key입니다. 다시 확인해 주세요.');
      }
    } catch (err: any) {
      setKeyError('인증 중 서버 통신 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsCheckingKey(false);
    }
  };

  const handleDeauthorize = () => {
    localStorage.removeItem('gemini_api_key');
    setIsAuthorized(false);
    setApiKeyInput('');
    handleRestart();
  };

  // Securely call server proxy for Gemini chat
  const getGeminiResponse = async (history: any[], systemInstruction?: string): Promise<string> => {
    try {
      let savedKey = localStorage.getItem('gemini_api_key') || '';
      if (savedKey === 'use_server_key') {
        savedKey = '';
      }
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          apiKey: savedKey,
          messages: history.map(m => ({ sender: m.sender, text: m.text })),
          systemInstruction,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Server error');
      }

      const data = await response.json();
      return data.text;
    } catch (err: any) {
      console.error('Gemini call failed:', err);
      throw err;
    }
  };

  // Auto Scroll Chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle Text/Manual Commands
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: Math.random().toString(),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');

    // Process input
    const cleanText = text.trim();

    // 1. Check for Virtual Persona request first
    // "가상으로 [페르소나 설명] 기준으로 모든 답변"
    if (cleanText.includes('가상') || cleanText.includes('페르소나') || PERSONAS.some(p => cleanText.includes(p.name) || cleanText.includes(p.job))) {
      // Find matching persona or pick the first one as default
      let matchedPersona = PERSONAS[0];
      for (const p of PERSONAS) {
        if (cleanText.includes(p.name) || cleanText.includes(p.job) || cleanText.includes(p.age)) {
          matchedPersona = p;
          break;
        }
      }
      triggerPersonaDiagnostic(matchedPersona);
      return;
    }

    // 2. Terminology questions ("뭐예요", "모르겠어요", "무슨 뜻") or help request
    if (cleanText.includes('뭐예요') || cleanText.includes('모르겠') || cleanText.includes('무슨 뜻') || cleanText.includes('무슨 의미') || cleanText === '?' || cleanText.includes('도와줘') || cleanText.includes('설명해')) {
      handleTerminologyInquiry(cleanText);
      return;
    }

    // 3. Stop command ("그만", "중단", "결과 보여줘")
    if (cleanText === '그만' || cleanText === '중단' || cleanText.includes('결과 보여줘') || cleanText.includes('결과보기')) {
      triggerEarlyResults();
      return;
    }

    // 4. Reset command ("재진단", "다시", "처음")
    if (cleanText === '재진단' || cleanText === '재학습' || cleanText === '다시 시작') {
      handleRestart();
      return;
    }

    // 5. If welcome state and they input "시작" or "1"
    if (appState === 'welcome') {
      if (cleanText === '시작' || cleanText === '1' || cleanText.includes('시작하기')) {
        startDiagnostic();
      } else {
        addCoachMessage("이 도구는 AI 역량 진단 전용입니다. 진단을 시작하려면 '시작'을 입력해 주세요. 😊");
      }
      return;
    }

    // 6. If result state, check for post-diagnosis commands
    if (appState === 'result') {
      handlePostDiagnosisChat(cleanText);
      return;
    }

    // 7. Diagnosing State: Parse numerical score (1-5)
    if (appState === 'diagnosing') {
      parseScoreInput(cleanText);
    }
  };

  // Helper to append coach message
  const addCoachMessage = (text: string) => {
    setMessages(prev => [...prev, {
      id: Math.random().toString(),
      sender: 'coach',
      text,
      timestamp: new Date()
    }]);
  };

  // Start Diagnostic Flow
  const startDiagnostic = () => {
    setAppState('diagnosing');
    setCurrentIdx(0);
    setAnswers({});
    setPersonaName('');
    
    const firstQ = QUESTIONS[0];
    const stage = STAGES[firstQ.stageIdx];
    
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: `좋습니다! 지금부터 AI 활용역량 자가진단을 시작하겠습니다. 한 번에 하나씩, 실제 해보신 경험을 떠올리며 솔직하게 답변해 주세요. 😊\n\n첫 번째 문항입니다.`,
        timestamp: new Date()
      },
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: formatQuestionText(firstQ),
        timestamp: new Date(),
        questionObj: firstQ
      }
    ]);
  };

  // Format Question into Coach Response Text
  const formatQuestionText = (q: Question) => {
    const stage = STAGES[q.stageIdx];
    return `─────────────────────────────────
[${stage.idx}단계 · ${stage.name} | 전체진행 ${q.questionIdx + 1}/42]

📌 ${q.title}

🙂 쉽게 말하면: ${q.easyExplain}

💡 예시: ${q.example}

1️⃣ 안 해봤어요   2️⃣ 한두 번 시도   3️⃣ 몇 번 해봄   4️⃣ 여러 번 잘함   5️⃣ 자주 함

점수를 입력해 주세요 (1~5) · 모르는 용어가 있으면 "이게 뭐예요?"라고 물어보셔도 돼요:
─────────────────────────────────`;
  };

  // Submit score for a question
  const submitScore = (score: number) => {
    if (appState !== 'diagnosing') return;

    const currentQ = QUESTIONS[currentIdx];
    
    // Save answer
    const updatedAnswers = { ...answers, [currentQ.id]: score };
    setAnswers(updatedAnswers);

    // Mark previous question message as answered in chat history
    setMessages(prev => prev.map(msg => {
      if (msg.questionObj && msg.questionObj.id === currentQ.id) {
        return { ...msg, answeredScore: score };
      }
      return msg;
    }));

    // Next step
    const nextIdx = currentIdx + 1;
    
    if (nextIdx < 42) {
      const nextQ = QUESTIONS[nextIdx];
      
      // If stage is changing, print a stage completion message
      let transitionMsg = '';
      if (nextQ.stageIdx !== currentQ.stageIdx) {
        const currentStage = STAGES[currentQ.stageIdx];
        const nextStage = STAGES[nextQ.stageIdx];
        transitionMsg = `\n\n✅ **${currentStage.idx}단계 [${currentStage.name}] 완료!**\n다음은 **${nextStage.idx}단계 [${nextStage.name}]** 문항으로 이어집니다. 화이팅이에요! 🚀`;
      }

      setCurrentIdx(nextIdx);
      
      setMessages(prev => [
        ...prev,
        {
          id: Math.random().toString(),
          sender: 'coach',
          text: `Q${currentQ.questionIdx + 1}번에 대해 **${score}점**으로 평가하셨습니다.${transitionMsg}`,
          timestamp: new Date()
        },
        {
          id: Math.random().toString(),
          sender: 'coach',
          text: formatQuestionText(nextQ),
          timestamp: new Date(),
          questionObj: nextQ
        }
      ]);
    } else {
      // Completed all 42 questions!
      finishDiagnostic(updatedAnswers);
    }
  };

  // Terminology inquiry while diagnosing or generally (Async Gemini with local fallbacks)
  const handleTerminologyInquiry = async (inputText: string) => {
    // 1. Get fallback content ready
    let fallbackExplain = '';
    let currentQObj: any = null;

    if (appState === 'diagnosing') {
      const q = QUESTIONS[currentIdx];
      currentQObj = q;
      if (q.id.startsWith('Q0')) {
        fallbackExplain = '💻 **운영체제(OS)**는 컴퓨터를 켜고 스마트폰을 움직이게 하는 가장 기초적인 관리 프로그램(윈도우, 맥, 안드로이드 등)을 뜻해요. 마치 건물의 "기반 토대"와 같아요!';
      } else if (q.id.startsWith('Q1')) {
        fallbackExplain = '🤖 **생성형 AI**는 ChatGPT나 Claude처럼 사람의 질문을 듣고 순식간에 새로운 글, 그림, 음악을 만들어내서 답해주는 똑똑한 인공지능 비서를 말해요.';
      } else if (q.id.startsWith('Q2')) {
        fallbackExplain = '📝 **프롬프트**는 AI에게 일이나 질문을 시킬 때 쓰는 지시문(질문 글)을 뜻해요. AI를 내 부하 직원처럼 대하며 상세히 규칙을 적어주는 양식이라고 생각하면 쉬워요!';
      } else if (q.id.startsWith('Q3')) {
        fallbackExplain = '🛠️ **커스텀 AI(맞춤 GPT)**는 기성 AI가 아니라, 처음부터 "너는 우리 회사 전용 상담사야"라고 지정하고 관련 비밀 문서나 말투 가이드를 미리 넣어 나만 쓸 수 있게 개조한 맞춤형 AI 챗봇이에요.';
      } else if (q.id.startsWith('Q4')) {
        fallbackExplain = '🔌 **API와 웹훅**은 복잡해 보이지만 쉬워요! **API**는 "식당 종업원"처럼 앱과 앱 사이를 오가며 주문 정보를 전송해주는 다리고, **웹훅**은 "주문벨"처럼 일이 발생했을 때 자동으로 휴대폰에 띠링~ 신호를 보내주는 신호 알리미예요.';
      } else if (q.id.startsWith('Q5')) {
        fallbackExplain = '⚙️ **자동화 도구(Zapier, Make 등)**는 내가 매번 메일을 켜서 구글 시트에 복사하는 수작업을, 컴퓨터가 24시간 알아서 "메일 오면 자동으로 저장해라!" 하고 서로 연결해주는 무인 공장 시스템이에요.';
      }
    } else {
      fallbackExplain = '디지털 AI 분야에는 어려운 용어가 많죠! 궁금하신 용어가 있으면 "웹훅이 뭐예요?" 혹은 "API가 무엇인가요?" 형태로 자유롭게 물어봐 주시면 초등학생 눈높이로 비유해서 상세히 알려 드릴게요. 😊';
    }

    // 2. Setup loading state
    const thinkingId = Math.random().toString();
    setMessages(prev => [
      ...prev,
      {
        id: thinkingId,
        sender: 'coach',
        text: '🔄 AI 디지털 코치에게 정밀 풀이를 확인하고 있습니다. 잠시만 기다려 주세요...',
        timestamp: new Date()
      }
    ]);

    // 3. Perform real Gemini API call
    try {
      let prompt = '';
      if (appState === 'diagnosing' && currentQObj) {
        prompt = `현재 사용자는 디지털/AI 자가진단 42문항 중 [${STAGES[currentQObj.stageIdx].name}] 단계의 다음 질문에 답하려 합니다:\n질문: "${currentQObj.title}" (쉬운 설명: ${currentQObj.easyExplain}, 예시: ${currentQObj.example})\n\n사용자의 질문: "${inputText || '이 문항의 용어가 무엇을 뜻하는지 설명해줘'}"\n\n지침:\n1. 사용자가 질문한 용어 혹은 현재 질문의 핵심 개념을 "초등학생도 이해할 수 있는 아주 친절하고 직관적인 비유"로 알기 쉽게 설명해 주세요.\n2. 설명은 마크다운 형식을 사용하여 깔끔하고 가독성 있게 작성해 주세요 (이모지 활용).\n3. 끝부분에는 "혹시 이런 도구 사용이나 관련 행동 경험이 한두 번이라도 있으셨다면 그에 맞는 점수(1~5)를, 전혀 모르시거나 경험이 없으시다면 1점을 클릭해 주세요! 😊" 라는 취지의 따뜻한 코칭 가이드를 꼭 붙이세요.\n4. 반드시 한국어로 정중하고 다정하게 작성하세요.`;
      } else {
        prompt = `사용자가 물어본 디지털 또는 AI 용어: "${inputText || '디지털 역량'}"\n\n지침:\n1. 이 용어가 무엇인지 일상생활 속 비유를 활용해 초보자 눈높이로 쉽고 명쾌하게 설명해 주세요.\n2. 마크다운으로 가독성 좋게 적어주세요.\n3. 끝부분에는 다른 디지털 궁금증도 자유롭게 편하게 질문하라는 격려 코칭 멘트를 덧붙여주세요.\n4. 반드시 한국어로 답변하세요.`;
      }

      const responseText = await getGeminiResponse([
        { id: 'prompt_req', sender: 'user', text: prompt, timestamp: new Date() }
      ], "You are an encouraging and warm expert Digital & AI Competency Coach. You excel at explaining complicated tech terms using simple everyday analogies.");

      // Replace loading message with real response
      setMessages(prev => {
        const withRealResponse = prev.map(msg => {
          if (msg.id === thinkingId) {
            return {
              ...msg,
              text: `💡 **AI 코치의 친절한 개념 풀이**\n\n${responseText}`
            };
          }
          return msg;
        });

        // If diagnosing, also repeat the question board underneath so the flow isn't disrupted
        if (appState === 'diagnosing' && currentQObj) {
          return [
            ...withRealResponse,
            {
              id: Math.random().toString(),
              sender: 'coach',
              text: formatQuestionText(currentQObj),
              timestamp: new Date(),
              questionObj: currentQObj
            }
          ];
        }
        return withRealResponse;
      });

    } catch (err: any) {
      console.warn("Gemini terminology query failed, reverting to local fallback.", err);
      // Fallback
      setMessages(prev => {
        const withFallback = prev.map(msg => {
          if (msg.id === thinkingId) {
            return {
              ...msg,
              text: `💡 **질문하신 용어 설명해 드릴게요!** (오프라인 모드)\n\n${fallbackExplain}\n\n혹시 이런 비슷한 업무나 도구 사용 경험이 조금이라도 있으셨다면 그에 맞는 점수를(1~5), 해본 적 없거나 전혀 모르시겠다면 솔직하게 **1점**을 입력해 주세요! 모르는 것은 전혀 부끄러운 일이 아니랍니다 😊`
            };
          }
          return msg;
        });

        if (appState === 'diagnosing' && currentQObj) {
          return [
            ...withFallback,
            {
              id: Math.random().toString(),
              sender: 'coach',
              text: formatQuestionText(currentQObj),
              timestamp: new Date(),
              questionObj: currentQObj
            }
          ];
        }
        return withFallback;
      });
    }
  };

  // Parse Score Inputs (1 to 5)
  const parseScoreInput = (text: string) => {
    // Look for numbers 1 to 5. Match patterns like "3", "3점", "3점이요", "3."
    const match = text.match(/([1-5])/);
    
    if (!match) {
      // Not a valid 1-5 score, prompt error
      addCoachMessage("1~5 사이 숫자로 입력해 주세요 😊\n(잘 몰라서 못 해봤거나 경험이 없는 것은 솔직히 1점을 주시는 것이 가장 정확한 진단입니다!)");
      return;
    }

    const score = parseInt(match[1]);
    submitScore(score);
  };

  // Complete diagnostic
  const finishDiagnostic = (finalAnswers: AnswerState, customName?: string) => {
    setAppState('result');
    setDashboardUnlocked(true);
    if (customName) setPersonaName(customName);

    const report = generateTextReport(finalAnswers, customName || personaName);
    
    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: `🎉 축하합니다! 42개 전 문항에 성실히 응답해 주셨습니다. 종합 분석 결과 보고서를 생성했습니다.\n\n아래의 분석 결과를 검토하시고, 상단 탭에서 **📊 마이 대시보드**를 클릭하시면 훨씬 입체적이고 세분화된 금융 리포트 스타일의 시각화 진단서와 맞춤 로드맵을 확인하실 수 있어요!`,
        timestamp: new Date()
      },
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: report,
        timestamp: new Date()
      }
    ]);

    // Automatically transition active view to Dashboard
    setTimeout(() => {
      setActiveMainTab('dashboard');
    }, 1200);
  };

  // Trigger Early Stop results ("그만" 등)
  const triggerEarlyResults = () => {
    if (appState !== 'diagnosing') {
      addCoachMessage("현재 진행 중인 진단이 없습니다. '시작'을 누르면 새로 진단을 진행할 수 있어요.");
      return;
    }

    if (Object.keys(answers).length === 0) {
      addCoachMessage("아직 응답하신 문항이 하나도 없어서 결과를 계산할 수 없어요. 최소 1문항 이상 답변해 주시거나 '재진단'을 입력해 주세요.");
      return;
    }

    setAppState('result');
    setDashboardUnlocked(true);

    const report = generateTextReport(answers, personaName);

    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: `⏹️ 사용자의 중단 요청에 따라 지금까지 작성하신 응답(${Object.keys(answers).length}/42개)을 기준으로 결과를 산출해 드립니다.\n미작성된 항목은 기준 규칙(같은 단계 평균 혹은 1점)으로 자동 대체되었습니다.`,
        timestamp: new Date()
      },
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: report,
        timestamp: new Date()
      }
    ]);

    // Automatically transition to Dashboard
    setTimeout(() => {
      setActiveMainTab('dashboard');
    }, 1200);
  };

  // Persona Automated Diagnostic Mode
  const triggerPersonaDiagnostic = (persona: Persona) => {
    const pAnswers: AnswerState = {};
    
    // Fill all 42 answers based on the persona profile
    QUESTIONS.forEach(q => {
      const scores = persona.scoreProfile[q.stageIdx];
      pAnswers[q.id] = scores[q.questionIdx] || 1;
    });

    setAnswers(pAnswers);
    setPersonaName(`${persona.name} 님 (${persona.age} ${persona.job})`);
    setAppState('result');
    setDashboardUnlocked(true);

    const report = generateTextReport(pAnswers, `${persona.name} 님 (${persona.age} ${persona.job})`);

    setMessages(prev => [
      ...prev,
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: `🤖 **[가상 페르소나 모드 구동]**\n\n**${persona.name} 님 (${persona.age} ${persona.job})**의 디지털 인프라 수준과 실제 직무 활용 행동 사건을 대리 계산하여 42개 전체 점수 테이블을 확정했습니다.\n\n*페르소나 환경 설명: ${persona.description}*`,
        timestamp: new Date()
      },
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: report,
        timestamp: new Date()
      }
    ]);

    // Move to Dashboard immediately
    setTimeout(() => {
      setActiveMainTab('dashboard');
    }, 1000);
  };

  // Restart diagnostic
  const handleRestart = () => {
    setAppState('welcome');
    setAnswers({});
    setCurrentIdx(0);
    setPersonaName('');
    setDashboardUnlocked(false);
    setActiveMainTab('assessment');
    setMessages([
      {
        id: Math.random().toString(),
        sender: 'coach',
        text: `🔄 자가진단을 전면 초기화하고 처음 단계로 재진입했습니다.\n\n${STEP_0_WELCOME}`,
        timestamp: new Date()
      }
    ]);
  };

  // Handle post-diagnosis chats (Async Gemini with local fallbacks)
  const handlePostDiagnosisChat = async (inputText: string) => {
    const cleanText = inputText.replace(/\s+/g, '');
    
    // Check if it fits basic static matches first for instant responses
    // 1. "X단계 학습법 알려줘"
    const stageMatch = cleanText.match(/([0-5])단계학습법/);
    if (stageMatch) {
      const stageIdx = parseInt(stageMatch[1]);
      const stage = STAGES[stageIdx];
      const rec = RECOMMENDATIONS[stageIdx];
      
      addCoachMessage(`📘 **${stageIdx}단계 [${stage.name}] 세부 코칭 학습법**\n\n초보자 눈높이에서 당장 내일 실천할 수 있는 가벼운 요령들을 제안합니다.\n\n1️⃣ **추천 첫걸음 행동 (비용 0원, 10분 소요):**\n   ➜ "${rec.firstStep}"\n   - 처음에는 결과를 내는 데 연연하지 마시고, 그냥 가입하고 한 번 마우스로 눌러보는 정도로만 시작해보세요.\n\n2️⃣ **주간 정밀 단련 계획:**\n   ➜ "${rec.practice}"\n   - 무리한 스펙 경쟁보다 내 본업에 일주일에 한 번씩 가상의 이메일 요약이나 자료 분류를 의뢰해보며 성공률을 높여갑니다.\n\n3️⃣ **추천 독학 로드맵:**\n   - 유튜브에서 해당 단어(예: ${stage.name.split(' ')[0]})를 치시고 "초보 입문"으로 분류된 가장 짧은 10분 내외의 영상 딱 3개만 끝까지 시청해보세요. 눈이 번쩍 트이실 거예요! 😊`);
      return;
    }

    // 2. "대시보드 보여줘"
    if (inputText.includes('대시보드') || inputText.includes('시각화') || inputText.includes('HTML')) {
      addCoachMessage("네! 상세 시각화 페이지로 화면을 즉시 전환해 드릴게요. 📊");
      setActiveMainTab('dashboard');
      return;
    }

    // 3. Set up Gemini loading indicator
    const thinkingId = Math.random().toString();
    setMessages(prev => [
      ...prev,
      {
        id: thinkingId,
        sender: 'coach',
        text: '🔄 AI 디지털 코치가 귀하의 진단 결과 데이터 및 강점을 분석하여 일대일 맞춤 로드맵 피드백을 수립하고 있습니다...',
        timestamp: new Date()
      }
    ]);

    // 4. Calculate diagnostic result context for Gemini
    const result = calculateDiagnosticResult(answers);
    const resultContext = `
[진단자 상세 결과 리포트]
- 진단자명: ${personaName || '진단자'}
- 종합 판정 레벨: [${result.level}] 등급 (종합 점수: ${result.comprehensiveScore}/100점)
- 6대 하위 역량 단계별 점수:
  * 0단계(디지털 기초 역량): ${result.stageScores[0]}점 / 100점
  * 1단계(생성형 AI 도구 이해): ${result.stageScores[1]}점 / 100점
  * 2단계(프롬프트 엔지니어링): ${result.stageScores[2]}점 / 100점
  * 3단계(커스텀 AI 설계): ${result.stageScores[3]}점 / 100점
  * 4단계(웹앱·도구 제작): ${result.stageScores[4]}점 / 100점
  * 5단계(AI 활용 자동화): ${result.stageScores[5]}점 / 100점
`;

    // 5. Query Gemini
    try {
      const systemInstruction = `You are a warm, highly encouraging, and world-class Digital & AI Competency Coach.
The user has completed a 42-question diagnostic test based on actual behavioral experience (BEI 기법).
You are consulting the user on their next learning steps. Use the given "[진단자 상세 결과 리포트]" context to tailor your advice.
Be concrete, give zero-cost practical suggestions, and recommend actionable small habits.
Always respond in supportive and professional Korean. Format using beautiful markdown tables, bold highlights, and friendly emojis.`;

      const chatHistory = [
        { id: 'diag_context', sender: 'coach', text: `귀하의 진단 결과 컨텍스트:\n${resultContext}`, timestamp: new Date() },
        ...messages.slice(-6).filter(m => m.id !== 'welcome_msg_id'), // send last 6 messages
        { id: 'user_msg', sender: 'user', text: inputText, timestamp: new Date() }
      ];

      const responseText = await getGeminiResponse(chatHistory, systemInstruction);

      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
          return {
            ...msg,
            text: responseText
          };
        }
        return msg;
      }));

    } catch (err: any) {
      console.warn("Gemini post-diagnosis chat failed, reverting to static fallback.", err);
      
      // Fallback logic
      let fallbackText = '';
      if (inputText.includes('이 뭐예요') || inputText.includes('가 뭐예요') || inputText.includes('무슨 뜻')) {
        // We will explain using general terminology fallback or forward to terminology handler
        fallbackText = '디지털 AI 분야에는 어려운 용어가 많죠! 궁금하신 용어가 있으면 "웹훅이 뭐예요?" 혹은 "API가 무엇인가요?" 형태로 자유롭게 물어봐 주시면 초등학생 눈높이로 비유해서 상세히 알려 드릴게요. 😊';
      } else if (inputText.includes('요약해') || inputText.includes('요약 받기')) {
        const res = calculateDiagnosticResult(answers);
        fallbackText = `📋 **내 디지털 역량 핵심 3줄 요약** (오프라인 모드)\n\n1️⃣ **종합 등급**: 현재 종합 점수 **${res.comprehensiveScore}점**으로, **[${res.level}]** 등급에 안정적으로 위치하고 계십니다.\n2️⃣ **핵심 강점**: 현재 점수가 가장 높고 추진력이 강한 영역은 **[${STAGES[Object.keys(res.stageScores).reduce((a, b) => res.stageScores[parseInt(a)] > res.stageScores[parseInt(b)] ? a : b) as any].name}]**입니다.\n3️⃣ **우선 실습 제언**: 가장 점수가 낮아 보강이 급선무인 **[${STAGES[0].name}]**의 쉬운 클라우드 파일 정리부터 시작해 보세요!`;
      } else if (inputText.includes('강의') || inputText.includes('학습 자료') || inputText.includes('공부')) {
        fallbackText = `🎓 **초보자를 위한 핵심 추천 인강 및 학습 자료 가이드**\n\n무료이지만 유료 강의보다 압도적인 품질을 내는 공인 리소스를 엄선했습니다.\n\n💻 **유튜브 베스트**: \n- '조코딩 JoCoding'의 생성형 AI 완전 초보 로드맵 (초급)\n- '일잘러 장비글'의 Airtable 및 Zapier 연동 자동화 (중고급)\n\n📚 **커뮤니티 연계**: \n- '지피터스 GPTERS'의 실무 적용 사례 게시판 필독 (무료 가입, 매일 업데이트되는 성공 전략)\n\n📖 **도서 추천**:\n- 소장 가치가 높은 프롬프트 실무 바이블 또는 엑셀에서 AI로 갈아타는 노코드 안내서 (가까운 동네 도서관에서 편하게 대여해보세요!)`;
      } else {
        fallbackText = "이 도구는 AI 활용역량 진단 전용입니다. 다른 진단을 진행하시려면 '재진단'을 입력하시거나, 'X단계 학습법 알려줘', 'API가 뭐예요?' 등의 명령어로 AI 활용역량에 대해 자유롭게 질문해 주세요! 😊";
      }

      setMessages(prev => prev.map(msg => {
        if (msg.id === thinkingId) {
          return {
            ...msg,
            text: fallbackText
          };
        }
        return msg;
      }));
    }
  };

  const renderQuestionMessageCard = (msg: ChatMessage) => {
    const q = msg.questionObj!;
    const stage = STAGES[q.stageIdx];
    const isAnswered = msg.answeredScore !== undefined;

    if (isAnswered) {
      const scoreLabels: { [key: number]: string } = {
        1: '1점 · 전혀 안 해봄',
        2: '2점 · 시도해 봄',
        3: '3점 · 직접 해봄',
        4: '4점 · 여러 번 잘 해냄',
        5: '5점 · 완벽히 가르침'
      };
      return (
        <div className="bg-[#24292e] border border-[#2d333b] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm w-full rounded-none">
          <div className="space-y-1">
            <span className="text-[10px] font-black text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/25 px-2.5 py-0.5 inline-block mr-2 rounded-none">
              {stage.idx}단계 · {stage.name}
            </span>
            <span className="font-extrabold text-slate-300">
              Q{q.questionIdx + 1}. {q.title}
            </span>
          </div>
          <div className="text-right shrink-0">
            <span className="font-black text-[#82c019] bg-[#82c019]/10 border border-[#82c019]/20 px-3 py-1.5 text-xs inline-block rounded-none">
              👉 {scoreLabels[msg.answeredScore!] || `${msg.answeredScore}점`} 선택 완료
            </span>
          </div>
        </div>
      );
    }

    // Active (Unanswered) state card
    return (
      <div className="bg-[#24292e] border border-[#2d333b] p-6 md:p-8 shadow-none space-y-5 md:space-y-6 max-w-full relative rounded-none">
        <div className="absolute -top-3.5 left-5 bg-[#82c019] text-[#131518] font-black text-xs uppercase tracking-widest px-3 py-1 shadow-none">
          현재 답변 대기 중 문항
        </div>

        {/* Stage Badge & Progress */}
        <div className="flex flex-wrap items-center justify-between border-b border-[#2d333b] pb-3 md:pb-4 pt-1 gap-2">
          <span className="text-xs md:text-sm font-black text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/25 px-3 py-1.5 rounded-none">
            🚀 {stage.idx}단계 · {stage.name}
          </span>
          <span className="text-xs md:text-sm font-black text-slate-400 bg-[#1c2024] px-3 py-1.5 rounded-none border border-[#2d333b]">
            전체 진행 <strong className="text-[#82c019]">{q.questionIdx + 1}</strong> / 42 문항
          </span>
        </div>

        {/* Question Title - Large & High Contrast */}
        <div className="space-y-1">
          <span className="text-xs md:text-sm font-black text-[#82c019] tracking-wider block">QUESTION</span>
          <h2 className="text-base md:text-lg lg:text-xl font-extrabold text-white leading-relaxed tracking-tight">
            📌 Q{q.questionIdx + 1}. {q.title}
          </h2>
        </div>

        {/* Easy Explain - Beautifulized & Spacious */}
        <div className="bg-[#82c019]/5 border-l-4 border-[#82c019] p-4.5 rounded-none space-y-1.5 shadow-none">
          <div className="flex items-center gap-2 text-[#82c019] font-extrabold text-xs md:text-sm">
            <span>🙂</span>
            <span>쉽게 풀어쓴 질문 내용</span>
          </div>
          <p className="text-sm md:text-[15px] font-bold text-slate-200 leading-relaxed">
            {q.easyExplain}
          </p>
        </div>

        {/* Examples - Beautifulized & Spacious */}
        <div className="bg-[#1c2024] border-l-4 border-[#82c019] p-4.5 rounded-none space-y-1.5 shadow-none border border-[#2d333b] border-l-[#82c019]">
          <div className="flex items-center gap-2 text-[#82c019] font-extrabold text-xs md:text-sm">
            <span>💡</span>
            <span>실무 구체적 사례 예시</span>
          </div>
          <p className="text-sm md:text-[15px] font-bold text-slate-300 leading-relaxed">
            {q.example}
          </p>
        </div>

        {/* Real-time Click Board Guideline notice */}
        <div className="pt-3 border-t border-[#2d333b] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs md:text-sm">
          <div className="flex items-center gap-2 text-[#82c019] font-extrabold">
            <span className="flex h-2.5 w-2.5 relative shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#82c019] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#82c019]"></span>
            </span>
            <span>👉 답변은 <strong className="text-[#82c019]">화면 최하단 '실시간 클릭 답변 보드'</strong>에서 선택해 주세요!</span>
          </div>
          <span className="text-[11px] md:text-xs text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/25 px-2.5 py-1 font-bold shrink-0 rounded-none">
            🖱️ 마우스 즉시 클릭 연동
          </span>
        </div>
      </div>
    );
  };

  const renderDesktopQuestionBoard = () => {
    const q = QUESTIONS[currentIdx];
    const progressPercent = Math.round(((currentIdx) / 42) * 100);

    // Calculate real-time stats for each stage
    const stageStats = STAGES.map(stage => {
      const stageQuestions = QUESTIONS.filter(ques => ques.stageIdx === stage.idx);
      const completed = stageQuestions.filter(ques => answers[ques.id] !== undefined).length;
      return {
        ...stage,
        completed,
        total: stageQuestions.length,
        isCurrent: q.stageIdx === stage.idx,
        isDone: stageQuestions.every(ques => answers[ques.id] !== undefined)
      };
    });

    const answeredCount = Object.keys(answers).length;
    const averageScore = answeredCount > 0 
      ? ((Object.values(answers) as number[]).reduce((sum: number, val: number) => sum + val, 0) / answeredCount).toFixed(1)
      : '0.0';

    return (
      <div id="desktop-question-board" className="flex flex-col h-full bg-[#1c2024]">
        {/* Title Banner */}
        <div className="bg-[#16191c] text-white p-5 shrink-0 border-b border-[#2d333b]">
          <h2 className="text-base md:text-lg font-black tracking-tight flex items-center gap-2 text-[#82c019]">
            📊 실시간 진단 상태 대시보드
          </h2>
          <p className="text-xs text-slate-400 mt-1 font-semibold">
            문항 답변에 따라 아래 지표들이 실시간으로 자동 갱신됩니다.
          </p>
        </div>

        {/* Global Progress */}
        <div className="p-5 border-b border-[#2d333b] bg-[#24292e] shrink-0 space-y-3">
          <div className="flex items-center justify-between text-xs md:text-sm font-black text-slate-300">
            <span>전체 자가진단 진행도</span>
            <span className="font-mono text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/25 px-2.5 py-1 font-extrabold text-xs md:text-sm rounded-none">
              {answeredCount} / 42 문항 완료 ({progressPercent}%)
            </span>
          </div>
          
          <div className="h-3 w-full bg-[#16191c] overflow-hidden border border-[#2d333b]">
            <div 
              className="h-full bg-[#82c019] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] font-bold text-slate-400">실시간 자가진단 누적 평균 점수:</span>
            <span className="text-sm font-black text-[#82c019] bg-[#82c019]/10 px-2 py-0.5 border border-[#82c019]/20">
              ⭐ {averageScore} / 5.0점
            </span>
          </div>
        </div>

        {/* Stage Trackers */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <span className="text-xs font-black text-[#82c019] uppercase tracking-wider block">
            6단계 역량 그룹별 달성 현황
          </span>

          <div className="space-y-3">
            {stageStats.map(st => {
              const pct = Math.round((st.completed / st.total) * 100);
              return (
                <div 
                  key={st.idx} 
                  className={`p-3.5 border rounded-none transition-all ${
                    st.isCurrent 
                      ? 'border-[#82c019] bg-[#82c019]/10' 
                      : st.isDone 
                        ? 'border-[#2d333b] bg-[#24292e]/60' 
                        : 'border-[#2d333b]/40 bg-[#24292e]/20 opacity-70'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      {st.isDone ? (
                        <span className="text-[#82c019] font-bold text-xs">✅</span>
                      ) : st.isCurrent ? (
                        <span className="text-[#82c019] font-black text-xs animate-pulse">👉</span>
                      ) : (
                        <span className="text-slate-600 font-bold text-xs">⚫</span>
                      )}
                      <span className={`text-xs md:text-sm font-black ${st.isCurrent ? 'text-[#82c019]' : 'text-slate-300'}`}>
                        {st.idx}단계 · {st.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-mono font-black text-slate-400">
                      {st.completed}/{st.total} ({pct}%)
                    </span>
                  </div>

                  <div className="h-1.5 w-full bg-[#16191c] overflow-hidden border border-[#2d333b]/30">
                    <div 
                      className={`h-full transition-all duration-300 ${st.isDone ? 'bg-[#82c019]' : 'bg-[#82c019]/60'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="h-[1px] bg-[#2d333b] my-4"></div>

          {/* Quick Score Cheat-sheet */}
          <div className="bg-[#24292e] border border-[#2d333b] p-4 space-y-2.5">
            <span className="text-[11px] font-black text-[#82c019] uppercase tracking-wider block">
              💡 나의 역량 수준별 자가평가 가이드
            </span>
            <div className="space-y-1.5 text-[11px] text-slate-300 leading-relaxed font-bold">
              <p><strong>1점 (안 해봄)</strong>: 경험 전혀 없음 / 다뤄보지 못했음</p>
              <p><strong>2점 (시도해봄)</strong>: 한두 번 경험, 타인의 전폭적 가이드 필요</p>
              <p><strong>3점 (직접해봄)</strong>: 서툴지만 혼자서 직접 완수 가능</p>
              <p><strong>4점 (잘 해냄)</strong>: 완결성 있고 매끄럽게 여러 번 해결함</p>
              <p><strong>5점 (가르침)</strong>: 자유자재로 쓰며 남에게 설명·코칭 가능</p>
            </div>
          </div>
        </div>

        {/* Aux Control bottom buttons */}
        <div className="p-4 bg-[#16191c] border-t border-[#2d333b] flex items-center justify-between text-xs md:text-sm font-bold shrink-0">
          <button
            type="button"
            onClick={() => handleTerminologyInquiry('')}
            className="text-[#82c019] hover:underline flex items-center gap-1 cursor-pointer"
          >
            <HelpCircle className="w-4 h-4" />
            용어 설명 듣기
          </button>
          <button
            type="button"
            onClick={triggerEarlyResults}
            className="text-[#ef4444] hover:underline flex items-center gap-1.5 cursor-pointer"
          >
            <XCircle className="w-4 h-4" />
            중단하고 결과 보기
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#16191c] flex flex-col font-sans text-[#f1f5f9]">
      {/* Header Bar */}
      <header className="bg-[#1c2024] border-b border-[#2d333b] px-6 py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
        <div 
          onClick={(isAuthorized || appState !== 'welcome') ? handleRestart : undefined}
          className={`flex items-center gap-2.5 transition-all duration-200 ${(isAuthorized || appState !== 'welcome') ? 'cursor-pointer hover:opacity-80 active:scale-[0.99]' : 'cursor-default'}`}
          title={(isAuthorized || appState !== 'welcome') ? "초기 랜딩페이지(처음 화면)로 이동 및 초기화" : undefined}
        >
          <div className="w-9 h-9 bg-[#82c019] flex items-center justify-center font-black text-[#131518] text-sm">
            AI
          </div>
          <div>
            <h1 className="text-base md:text-lg font-black tracking-tight text-[#82c019] flex items-center gap-2">
              📋 AI 활용역량 자가진단 시스템
              <span className="text-[10px] font-black px-2 py-0.5 bg-[#82c019]/15 text-[#82c019] border border-[#82c019]/30 leading-none">
                BEI 기법 탑재
              </span>
            </h1>
            <p className="text-[10px] md:text-xs text-[#94a3b8] font-bold">
              행동사건면접(Behavioral Event Interview) 기반 실무 역량 정밀 검증 모델
            </p>
          </div>
        </div>

        {/* Top Tab Navigator & Auth status */}
        <div className="flex items-center gap-3">
          {(isAuthorized || dashboardUnlocked) && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveMainTab('assessment')}
                className={`px-4 py-2 text-xs md:text-sm font-black tracking-tight cursor-pointer border rounded-none transition-colors ${
                  activeMainTab === 'assessment'
                    ? 'bg-[#82c019] text-[#131518] border-[#82c019]'
                    : 'bg-[#24292e] text-slate-300 border-[#2d333b] hover:bg-[#1c2024]'
                }`}
              >
                💬 실무 자가진단 토크룸
              </button>
              <button
                onClick={() => setActiveMainTab('dashboard')}
                className={`px-4 py-2 text-xs md:text-sm font-black tracking-tight cursor-pointer border rounded-none transition-colors ${
                  activeMainTab === 'dashboard'
                    ? 'bg-[#82c019] text-[#131518] border-[#82c019]'
                    : 'bg-[#24292e] text-slate-300 border-[#2d333b] hover:bg-[#1c2024]'
                }`}
              >
                📊 정밀 분석 대시보드
              </button>
            </div>
          )}

          {isAuthorized ? (
            <button
              onClick={handleDeauthorize}
              className="px-3 py-2 text-xs bg-[#24292e] text-red-400 border border-red-950/50 hover:bg-red-950/20 rounded-none font-bold cursor-pointer transition-colors"
              title="인증된 API Key를 해제하고 초기 상태로 돌아갑니다."
            >
              🔑 API 해제
            </button>
          ) : (
            <span className="text-xs font-black text-amber-500 bg-amber-500/10 border border-amber-500/25 px-3 py-1.5 rounded-none flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping"></span>
              🔑 Gemini API 미인증 {dashboardUnlocked && "(체험 데모 모드)"}
            </span>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {activeMainTab === 'assessment' ? (
            <motion.div
              key="assessment-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full flex flex-col md:flex-row overflow-hidden"
            >
              {/* Left Column */}
              <div className={`flex-1 flex flex-col overflow-hidden bg-[#16191c] ${appState === 'welcome' ? 'w-full' : 'md:w-[60%] border-r border-[#2d333b]'}`}>
                {/* Scrollable messages area */}
                {appState === 'welcome' ? (
                  <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 bg-[#16191c]">
                    <div className="max-w-3xl mx-auto space-y-8">
                      
                      {/* Premium Hero Banner Card */}
                      <div className="bg-[#24292e] text-white p-7 md:p-9 relative overflow-hidden border border-[#2d333b] rounded-none shadow-none">
                        <div className="absolute top-0 right-0 transform translate-x-12 -translate-y-12 w-48 h-48 bg-[#82c019]/10 rounded-full blur-2xl"></div>
                        <div className="absolute -bottom-8 -left-8 w-40 h-40 bg-[#82c019]/5 rounded-full blur-2xl"></div>
                        
                        <div className="relative z-10 space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[10px] md:text-xs font-black text-[#131518] bg-[#82c019] px-3 py-1 uppercase tracking-widest rounded-none shadow-inner">
                              ★ BEI METHODOLOGY INSPIRED
                            </span>
                            <span className="text-[10px] md:text-xs font-black text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/30 px-3 py-1 uppercase tracking-wider rounded-none">
                              AI 진단 공학 탑재
                            </span>
                          </div>
                          
                          <div className="space-y-2">
                            <h2 className="text-2xl md:text-3xl font-extrabold leading-tight tracking-tight text-white">
                              당신의 <span className="text-[#82c019]">진짜 AI 리터러시 역량</span>을 검증해 드립니다
                            </h2>
                            <p className="text-xs md:text-sm text-slate-300 font-bold leading-relaxed max-w-2xl">
                              단순히 "할 줄 안다"는 주관적 느낌을 넘어, 실제 과거 실무 행동 사건(Behavioral Event Interview)을 정교하게 추적하는 고도화 설계입니다. 거품 없는 6대 디지털 전문 역량을 단 10분 만에 정밀 진단받으세요.
                            </p>
                          </div>

                          <div className="pt-3">
                            {isAuthorized ? (
                              <>
                                <button
                                  onClick={startDiagnostic}
                                  className="w-full sm:w-auto py-4 px-8 bg-[#82c019] hover:bg-[#9ce024] text-[#131518] font-black text-sm md:text-base shadow-none cursor-pointer flex items-center justify-center gap-3 transition-all active:scale-98 animate-pulse border-none rounded-none"
                                >
                                  📋 내 실무 경험으로 자가진단 시작하기 (무료)
                                  <ChevronRight className="w-5 h-5 animate-bounce" />
                                </button>
                                <p className="text-[10px] text-slate-400 mt-2 font-bold text-center sm:text-left">
                                  * 별도의 회원가입이나 개인정보 입력 없이 즉시 진단 및 리포트가 완성됩니다.
                                </p>
                              </>
                            ) : (
                              <div id="api-key-input-section" className="bg-[#1c2024] border border-[#2d333b] p-5 md:p-6 space-y-4 relative mt-2">
                                <div className="absolute top-0 left-0 h-1 w-full bg-[#82c019]"></div>
                                
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm">🔑</span>
                                    <h4 className="text-xs md:text-sm font-extrabold text-white tracking-tight">
                                      Gemini API 키 인증 및 서비스 활성화
                                    </h4>
                                  </div>
                                  <p className="text-[11px] md:text-xs text-slate-300 font-medium leading-relaxed">
                                    본 플랫폼은 실시간 행동 사건 분석 및 맞춤형 코칭 가이드를 제공하기 위해 <strong>Google Gemini API</strong>를 활용합니다. API 키를 승인하시면 자가진단 및 모든 자동화 코칭 기능을 즉시 이용하실 수 있습니다.
                                  </p>
                                </div>

                                <div className="space-y-2">
                                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                                    Google Gemini API Key 입력
                                  </label>
                                  <div className="relative">
                                    <input
                                      id="api-key-input-field"
                                      type={showKey ? "text" : "password"}
                                      value={apiKeyInput}
                                      onChange={(e) => setApiKeyInput(e.target.value)}
                                      placeholder="AIzaSy..."
                                      className="w-full bg-[#24292e] border border-[#2d333b] text-white px-3.5 py-3 pr-12 text-xs font-mono focus:outline-none focus:border-[#82c019] transition-colors rounded-none placeholder:text-slate-600"
                                      disabled={isCheckingKey}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setShowKey(!showKey)}
                                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-[11px] font-bold focus:outline-none"
                                    >
                                      {showKey ? "숨기기" : "보기"}
                                    </button>
                                  </div>
                                </div>

                                {keyError && (
                                  <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 text-[11px] font-bold leading-relaxed">
                                    ❌ {keyError}
                                  </div>
                                )}

                                <div className="flex flex-col sm:flex-row gap-2.5 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => handleVerifyKey()}
                                    disabled={isCheckingKey}
                                    className="flex-1 py-3 px-5 bg-[#82c019] hover:bg-[#9ce024] disabled:bg-slate-700 text-[#131518] font-black text-xs tracking-tight cursor-pointer flex items-center justify-center gap-1.5 transition-all rounded-none border-none"
                                  >
                                    {isCheckingKey ? (
                                      <span className="flex items-center gap-1.5">
                                        <span className="w-3.5 h-3.5 border-2 border-[#131518] border-t-transparent animate-spin rounded-full"></span>
                                        인증 중...
                                      </span>
                                    ) : (
                                      "인증 및 서비스 활성화"
                                    )}
                                  </button>

                                  {serverHasKey && (
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyKey('use_server_key')}
                                      disabled={isCheckingKey}
                                      className="py-3 px-5 bg-[#24292e] hover:bg-[#1c2024] border border-[#2d333b] text-slate-300 font-bold text-xs tracking-tight cursor-pointer flex items-center justify-center gap-1.5 transition-all rounded-none"
                                    >
                                      ⚡ 서버 내장 키로 활성화
                                    </button>
                                  )}
                                </div>

                                <div className="bg-[#24292e] border border-[#2d333b] p-3.5 space-y-2 text-[10px] leading-relaxed font-semibold">
                                  <span className="font-black text-[#82c019] block">💡 Gemini API Key가 없으신가요?</span>
                                  <p className="text-slate-400">
                                    Google AI Studio (<a href="https://aistudio.google.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-[#82c019] underline font-bold">aistudio.google.com/api-keys</a>) 로그인 후 <strong>"Get API key"</strong> → <strong>"Create API key"</strong>를 차례대로 클릭해 발급된 키를 붙여넣어 주세요.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4 Key Unique Strengths Grid */}
                      <div className="space-y-4">
                        <h3 className="text-sm md:text-base font-extrabold text-[#82c019] uppercase tracking-wider flex items-center gap-2">
                          <Award className="w-5 h-5 text-[#82c019]" />
                          💡 본 자가진단 시스템만의 4대 차별화 강점
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Strength 1 */}
                          <div className="bg-[#24292e] border border-[#2d333b] p-5 flex gap-4">
                            <div className="w-10 h-10 bg-[#82c019]/15 text-[#82c019] border border-[#2d333b] flex items-center justify-center shrink-0">
                              <ShieldCheck className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs md:text-sm font-extrabold text-[#f1f5f9]">행동사건(BEI) 기반 역량 과학</h4>
                              <p className="text-[11px] md:text-xs text-slate-300 font-bold leading-relaxed">
                                주관적인 주장을 배제하고, "실제 해결하고 수행해 본 적이 있는가"의 행동 성취 목록을 집요하게 검증하여 정확한 점수를 도출합니다.
                              </p>
                            </div>
                          </div>

                          {/* Strength 2 */}
                          <div className="bg-[#24292e] border border-[#2d333b] p-5 flex gap-4">
                            <div className="w-10 h-10 bg-[#82c019]/15 text-[#82c019] border border-[#2d333b] flex items-center justify-center shrink-0">
                              <BarChart3 className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs md:text-sm font-extrabold text-[#f1f5f9]">입체적 6차원 분석 대시보드</h4>
                              <p className="text-[11px] md:text-xs text-slate-300 font-bold leading-relaxed">
                                진단이 완료되는 즉시, 데이터분석, 디지털커뮤니케이션, 정보안전, 혁신도구, 문제해결, 지속성장 등의 역량 레이더 차트를 입출력합니다.
                              </p>
                            </div>
                          </div>

                          {/* Strength 3 */}
                          <div className="bg-[#24292e] border border-[#2d333b] p-5 flex gap-4">
                            <div className="w-10 h-10 bg-[#82c019]/15 text-[#82c019] border border-[#2d333b] flex items-center justify-center shrink-0">
                              <Sparkles className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs md:text-sm font-extrabold text-[#f1f5f9]">실시간 100% 클릭 연동 보드</h4>
                              <p className="text-[11px] md:text-xs text-slate-300 font-bold leading-relaxed">
                                키보드 타이핑 피로도가 0%에 수렴합니다! 최하단 마우스 클릭 응답 패널을 통해 직관적이고 경쾌하게 문항을 척도 선택할 수 있습니다.
                              </p>
                            </div>
                          </div>

                          {/* Strength 4 */}
                          <div className="bg-[#24292e] border border-[#2d333b] p-5 flex gap-4">
                            <div className="w-10 h-10 bg-[#82c019]/15 text-[#82c019] border border-[#2d333b] flex items-center justify-center shrink-0">
                              <HelpCircle className="w-5 h-5" />
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-xs md:text-sm font-extrabold text-[#f1f5f9]">용어 클리닉 및 쉬운 일상어 설명</h4>
                              <p className="text-[11px] md:text-xs text-slate-300 font-bold leading-relaxed">
                                복잡한 IT/AI 신기술 용어마다 친근한 일상 풀이와 구체적인 실무 예시가 함께 제공되어, 상식과 역량을 동시에 채워갑니다.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 6 Core Competencies Guide Banner */}
                      <div className="bg-[#24292e] border border-[#2d333b] p-6 rounded-none space-y-4">
                        <h3 className="text-sm md:text-base font-extrabold text-[#82c019] uppercase tracking-wider flex items-center gap-2 pb-2.5 border-b border-[#2d333b]">
                          <Layers className="w-5 h-5 text-[#82c019]" />
                          📊 자가진단하는 6대 핵심 역량 도메인
                        </h3>
                        
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          {[
                            { name: "데이터 분석 & 활용", desc: "데이터 가치 추출 및 분석력" },
                            { name: "디지털 협업", desc: "원격 도구 기반 실시간 비대면 협업" },
                            { name: "혁신 도구 활용", desc: "신기술/생성형 AI 적재적소 도입" },
                            { name: "보안 & 디지털 윤리", desc: "정보 유출 차단 및 윤리 준수" },
                            { name: "비판적 문제해결", desc: "디지털 문제에 대한 원인 분석" },
                            { name: "지속 가능한 성장", desc: "스스로 디지털 트렌드 학습 지속" }
                          ].map((comp, idx) => (
                            <div key={idx} className="p-3 bg-[#1c2024] border border-[#2d333b] rounded-none">
                              <span className="text-[10px] font-black text-[#82c019] bg-[#82c019]/15 border border-[#82c019]/25 px-1.5 py-0.5 rounded-none block w-fit mb-1">
                                {idx + 1}단계
                              </span>
                              <h4 className="text-xs font-extrabold text-[#f1f5f9]">{comp.name}</h4>
                              <p className="text-[10px] text-slate-400 font-bold mt-0.5">{comp.desc}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Interactive Demo Zone with Persona Cards */}
                      <div className="bg-[#24292e] border border-[#2d333b] p-6 space-y-4 rounded-none">
                        <div className="space-y-1">
                          <h3 className="text-xs md:text-sm font-extrabold text-[#82c019] uppercase tracking-widest flex items-center gap-1.5">
                            <Sparkles className="w-4 h-4 text-amber-500" />
                            ⚡ 1초만에 역량 대시보드 리포트 가상체험 (페르소나 프리셋)
                          </h3>
                          <p className="text-xs text-slate-300 font-bold leading-relaxed">
                            42개 전 문항에 직접 응답하기 전, 실제 결과가 어떻게 시각화되는지 엿볼 수 있습니다. 아래 직군별 가상 페르소나 카드 중 하나를 선택하면, 1초 만에 최적화 설계된 가상 진단서와 완벽한 방사형 레이더 차트가 잠금 해제됩니다!
                          </p>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                          {PERSONAS.map(p => (
                            <button
                              key={p.id}
                              onClick={() => {
                                triggerPersonaDiagnostic(p);
                              }}
                              className="group p-4 bg-[#1c2024] border border-[#2d333b] hover:border-[#82c019] hover:bg-[#82c019]/5 transition-all text-left flex flex-col justify-between h-36 cursor-pointer rounded-none"
                              title={`${p.name} 페르소나로 대시보드 리포트 즉시 열기`}
                            >
                              <div className="space-y-1.5">
                                <div className="flex items-center gap-2">
                                  <span className="text-xl group-hover:scale-115 transition-transform">{p.avatar}</span>
                                  <div>
                                    <h4 className="text-xs md:text-sm font-extrabold text-[#f1f5f9] group-hover:text-[#82c019] transition-colors">{p.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold">{p.job} ({p.age}세)</p>
                                  </div>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium leading-normal line-clamp-2">
                                  {p.description}
                                </p>
                              </div>
                              
                              <div className="text-[10px] font-black text-[#82c019] flex items-center gap-1 border-t border-[#2d333b] pt-1.5 mt-2 justify-between">
                                <span>가상 대시보드 체험하기</span>
                                <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-[#16191c]">
                    {messages.map((msg) => {
                      const isCoach = msg.sender === 'coach';
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-3 max-w-[85%] ${
                            isCoach ? 'mr-auto' : 'ml-auto flex-row-reverse'
                          }`}
                        >
                          {/* Avatar */}
                          <div className={`w-10 h-10 flex items-center justify-center text-sm shrink-0 border ${
                            isCoach 
                              ? 'bg-[#82c019] text-[#131518] border-[#82c019]' 
                              : 'bg-[#24292e] text-[#f1f5f9] border-[#2d333b]'
                          }`}>
                            {isCoach ? '🎓' : <User className="w-5 h-5" />}
                          </div>

                          {/* Speech Bubble */}
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className={`text-xs md:text-sm font-extrabold text-[#94a3b8] ${!isCoach && 'text-right'}`}>
                              {isCoach ? '디지털 AI 자가진단 전문코치' : personaName || '나의 이름'}
                            </div>
                            
                            {msg.questionObj ? (
                              renderQuestionMessageCard(msg)
                            ) : (
                              <div className={`p-4.5 text-sm md:text-base leading-relaxed whitespace-pre-wrap rounded-none ${
                                isCoach
                                  ? 'bg-[#24292e] text-[#f1f5f9] border border-[#2d333b]'
                                  : 'bg-[#82c019] text-[#131518] font-black'
                              }`}>
                                {msg.text}
                              </div>
                            )}

                            <span className={`text-[11px] md:text-xs text-[#94a3b8] block ${!isCoach && 'text-right'}`}>
                              {msg.timestamp.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                )}

                {/* Interactive Action Control Pad depending on App State */}
                {appState !== 'welcome' && (
                  <div className="bg-[#16191c] border-t border-[#2d333b] p-5 shrink-0">
                    {/* DIAGNOSING STATE OPTIONS */}
                    {appState === 'diagnosing' && (
                      <div className="space-y-3 max-w-2xl mx-auto w-full">
                        {/* Interactive Score Controller Panel for both mobile & desktop */}
                        <div className="bg-[#24292e] border border-[#2d333b] p-4 md:p-5">
                          <div className="flex items-center justify-between text-xs md:text-sm font-black text-[#82c019] uppercase tracking-wider mb-3">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-[#82c019]" />
                              실시간 클릭 답변 보드 (Q{currentIdx + 1} 문항)
                            </span>
                            <span className="font-mono text-[10px] md:text-xs text-[#82c019] bg-[#82c019]/15 px-2 py-0.5 border border-[#82c019]/25 rounded-none">
                              마우스 즉시 클릭 지원
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-5 gap-1.5 md:gap-3">
                            {[
                              { v: 1, l: '안 해봄', d: '경험이 전혀 없음 / 들어보지 못함' },
                              { v: 2, l: '시도해봄', d: '1~2회 시도해봄, 타인 도움 필요' },
                              { v: 3, l: '직접해봄', d: '혼자 해봤으나 아직 서툴고 불완전함' },
                              { v: 4, l: '잘 해냄', d: '여러 번 성공적으로 매끄럽게 수행함' },
                              { v: 5, l: '가르침', d: '자유자재로 다루며 남에게 코칭 가능' }
                            ].map(opt => (
                              <button
                                type="button"
                                key={opt.v}
                                onClick={() => submitScore(opt.v)}
                                className="py-3 px-1 border border-[#2d333b] hover:border-[#82c019] bg-[#1c2024] hover:bg-[#82c019]/10 transition-all cursor-pointer text-center group relative active:bg-[#82c019]/20 rounded-none"
                              >
                                <span className="text-base md:text-xl font-black text-[#82c019] block group-hover:scale-110 transition-transform">{opt.v}점</span>
                                <span className="text-[10px] md:text-xs font-black text-slate-300 block mt-1">{opt.l}</span>
                                {/* Hover Tooltip description */}
                                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-[#1c2024] text-[#f1f5f9] text-[11px] p-2.5 border border-[#2d333b] w-48 z-30 leading-snug font-bold rounded-none">
                                  {opt.d}
                                </span>
                              </button>
                            ))}
                          </div>

                          {/* Helper utility triggers */}
                          <div className="flex items-center justify-between text-xs md:text-sm font-black mt-3.5 pt-3 border-t border-[#2d333b]">
                            <button
                              type="button"
                              onClick={() => handleTerminologyInquiry('')}
                              className="text-[#82c019] hover:underline flex items-center gap-1.5 cursor-pointer"
                            >
                              <HelpCircle className="w-4 h-4" />
                              ❓ 무슨 단어인지 모르겠어요 (용어 설명)
                            </button>
                            <button
                              type="button"
                              onClick={triggerEarlyResults}
                              className="text-[#ef4444] hover:underline flex items-center gap-1.5 cursor-pointer"
                            >
                              <XCircle className="w-4 h-4" />
                              ⏹️ 여기서 중단하고 결과 보기
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* RESULT STATE OPTIONS */}
                    {appState === 'result' && (
                      <div className="max-w-2xl mx-auto flex items-center gap-3">
                        <button
                          onClick={() => setActiveMainTab('dashboard')}
                          className="flex-1 py-4 px-5 bg-[#82c019] hover:bg-[#9ce024] text-sm md:text-base font-black tracking-tight text-center cursor-pointer flex items-center justify-center gap-2 transition-colors text-[#131518]"
                        >
                          📊 정밀 분석 대시보드 화면으로 이동
                        </button>
                        <button
                          onClick={handleRestart}
                          className="py-4 px-5 bg-[#24292e] text-slate-300 border border-[#2d333b] hover:bg-[#1c2024] text-sm md:text-base font-black transition-colors cursor-pointer rounded-none"
                        >
                          재진단
                        </button>
                      </div>
                    )}

                    {/* Standard Text Chat Input */}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleSendMessage(inputText);
                      }}
                      className="flex items-center gap-2 max-w-2xl mx-auto border border-[#2d333b] bg-[#24292e] p-2 shadow-none mt-4 rounded-none"
                    >
                      <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder={
                          appState === 'diagnosing'
                            ? "1~5 사이 숫자나 '이게 뭐야?', '그만' 등을 입력할 수 있어요..."
                            : "0~5단계 학습법 알려줘, 혹은 궁금한 용어를 자유롭게 물어보세요..."
                        }
                        className="flex-1 px-4 py-2.5 text-sm md:text-base bg-transparent outline-none text-[#f1f5f9] font-bold"
                      />
                      <button
                        type="submit"
                        className="p-3 bg-[#82c019] text-[#131518] hover:bg-[#9ce024] transition-colors cursor-pointer"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </form>
                  </div>
                )}
              </div>

              {/* Right Column: Mini Info rail or Active Questionnaire on desktop (40%) */}
              {appState !== 'welcome' && (
                <div className="w-full md:w-[40%] bg-[#1c2024] flex flex-col border-l border-[#2d333b] overflow-y-auto shrink-0 text-[#f1f5f9]">
                  {appState === 'diagnosing' ? (
                    renderDesktopQuestionBoard()
                  ) : (
                    <div className="p-6 flex flex-col gap-6">
                      <div className="space-y-2">
                        <span className="text-xs font-black text-[#82c019] uppercase tracking-wider block">진단 가이드라인</span>
                        <h3 className="text-sm md:text-base font-black text-white">행동사건면접(BEI)이란?</h3>
                        <p className="text-xs md:text-sm text-slate-300 leading-relaxed font-bold">
                          단순히 "~를 할 줄 안다"가 아니라, <strong>"과거에 실제로 이를 직접 행하거나 해결한 경험이 있는지"</strong>를 성취 경험 목록으로 집요하게 검증하는 정밀 면접 기법입니다.
                        </p>
                      </div>

                      <div className="h-[1px] bg-[#2d333b]"></div>

                      <div className="space-y-3">
                        <span className="text-xs font-black text-[#82c019] uppercase tracking-wider block">6단계 진단 스케일 구조</span>
                        <div className="space-y-2 text-xs md:text-sm font-bold">
                          {[
                            { idx: '0단계', name: '디지털 기초 역량', diff: '초급' },
                            { idx: '1단계', name: '생성형 AI 도구 이해', diff: '초급' },
                            { idx: '2단계', name: '프롬프트 엔지니어링', diff: '중급' },
                            { idx: '3단계', name: '커스텀 AI 설계', diff: '중급' },
                            { idx: '4단계', name: '웹앱·도구 제작', diff: '고급' },
                            { idx: '5단계', name: 'AI 활용 자동화', diff: '고급' }
                          ].map(st => (
                            <div key={st.idx} className="flex items-center justify-between">
                              <span>{st.idx} · {st.name}</span>
                              <span className="text-[10px] md:text-xs font-black px-1.5 py-0.5 text-[#82c019] bg-[#82c019]/10 border border-[#82c019]/20">
                                {st.diff}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="h-[1px] bg-[#2d333b]"></div>

                      {/* Core rule info badge */}
                      <div className="bg-[#24292e] border border-[#2d333b] p-4 space-y-3">
                        <span className="text-xs font-black text-[#82c019] block uppercase tracking-wider">자가진단 핵심 점수 기준</span>
                        <div className="space-y-2 text-xs md:text-sm text-slate-300 leading-relaxed font-bold">
                          <p><strong>1점</strong> - 전혀 시도해보지 않았음 / 잘 모름</p>
                          <p><strong>2점</strong> - 시도해 봤지만 남의 전폭적 도움 필요</p>
                          <p><strong>3점</strong> - 혼자 했지만 불완전하고 서투름</p>
                          <p><strong>4점</strong> - 혼자서 여러 번 완결성 있게 완수</p>
                          <p><strong>5점</strong> - 마스터하여 남에게 작동법 코칭 가능</p>
                        </div>
                      </div>

                      {/* Helpful tips */}
                      <div className="mt-auto pt-4 border-t border-[#2d333b] flex items-start gap-2.5 bg-[#16191c] p-3 text-xs md:text-sm text-slate-400 font-bold leading-relaxed">
                        <AlertCircle className="w-5 h-5 text-[#82c019] shrink-0 mt-0.5" />
                        <span>진단 중 오류나 다른 용어를 물어보셔도 대화 맥락이 절대 손실되지 않고 정상 복귀됩니다.</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

            </motion.div>
          ) : (
            <motion.div
              key="dashboard-view"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full overflow-y-auto"
            >
              <Dashboard
                answers={answers}
                onRestart={handleRestart}
                personaName={personaName}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
