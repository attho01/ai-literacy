export interface Question {
  id: string; // e.g., 'Q0-1'
  stageIdx: number; // 0 to 5
  questionIdx: number; // 0 to 6
  title: string; // 📌
  easyExplain: string; // 🙂
  example: string; // 💡
}

export interface Stage {
  idx: number;
  name: string;
  difficulty: '초급' | '중급' | '고급';
  questionCount: number;
}

export interface AnswerState {
  [questionId: string]: number; // 1 to 5 score
}

export interface ChatMessage {
  id: string;
  sender: 'coach' | 'user';
  text: string;
  timestamp: Date;
  isHtml?: boolean;
  questionObj?: Question;
  answeredScore?: number;
}

export interface Persona {
  id: string;
  name: string;
  age: string;
  job: string;
  description: string;
  avatar: string;
  scoreProfile: { [stageIdx: number]: number[] }; // 6 stages, each has 7 scores (1-5)
}
