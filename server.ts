import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API endpoints FIRST

  // Helper to extract a clean, user-friendly message from Gemini API errors
  const cleanGeminiError = (err: any): string => {
    let errMsg = "";
    if (err) {
      if (typeof err === 'string') {
        errMsg = err;
      } else if (err.message) {
        errMsg = err.message;
      } else {
        try {
          errMsg = JSON.stringify(err);
        } catch (e) {
          errMsg = String(err);
        }
      }
    }

    const lowerMsg = errMsg.toLowerCase();
    
    if (
      lowerMsg.includes("api key not valid") || 
      lowerMsg.includes("api_key_invalid") || 
      lowerMsg.includes("invalid_argument") ||
      lowerMsg.includes("key is invalid") ||
      lowerMsg.includes("invalid api key")
    ) {
      return "입력하신 Gemini API Key가 유효하지 않습니다. Google AI Studio(aistudio.google.com)에서 발급받은 올바른 API Key(AIzaSy로 시작하는 키)를 복사하여 입력해 주세요.";
    }
    
    if (lowerMsg.includes("quota") || lowerMsg.includes("limit") || lowerMsg.includes("exhausted") || lowerMsg.includes("429")) {
      return "API 호출 할당량을 초과했거나 요청 제한에 걸렸습니다. 잠시 후 다시 시도하시거나 다른 API Key를 사용해 주세요.";
    }
    
    if (lowerMsg.includes("model") && (lowerMsg.includes("not found") || lowerMsg.includes("not supported"))) {
      return "지정된 Gemini 모델을 사용할 수 없거나 해당 API Key로 접근할 수 없습니다.";
    }

    // Try parsing if errMsg is a JSON string
    try {
      const parsed = JSON.parse(errMsg);
      if (parsed?.error?.message) {
        return cleanGeminiError(new Error(parsed.error.message));
      }
    } catch (e) {}

    return "Gemini API 호출 및 인증 중 오류가 발생했습니다. 올바른 API Key인지 또는 인터넷 연결을 다시 확인해 주세요.";
  };

  // 1. Check if server has pre-configured key
  app.get("/api/has-key", (req, res) => {
    const hasKey = !!process.env.GEMINI_API_KEY && 
                   process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY" && 
                   process.env.GEMINI_API_KEY.trim() !== "";
    res.json({ hasKey });
  });

  // 2. Verify Key
  app.post("/api/verify-key", async (req, res) => {
    const { apiKey } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;

    if (!keyToUse || keyToUse === "MY_GEMINI_API_KEY" || keyToUse.trim() === "") {
      return res.json({ valid: false, error: "API Key가 설정되지 않았거나 유효하지 않은 기본값(자리표시자)입니다. 올바른 API Key를 입력해 주세요." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Quick generateContent call to test validity
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: "Hello, reply with OK if you are active.",
      });

      if (response && response.text) {
        return res.json({ valid: true });
      } else {
        return res.json({ valid: false, error: "Gemini로부터 응답을 받지 못했습니다. 키 설정을 확인해 주세요." });
      }
    } catch (err: any) {
      console.error("Verification error:", err);
      const friendlyMessage = cleanGeminiError(err);
      return res.json({ valid: false, error: friendlyMessage });
    }
  });

  // 3. Chat proxy with custom API key
  app.post("/api/chat", async (req, res) => {
    const { apiKey, messages, systemInstruction } = req.body;
    const keyToUse = apiKey || process.env.GEMINI_API_KEY;

    if (!keyToUse || keyToUse === "MY_GEMINI_API_KEY" || keyToUse.trim() === "") {
      return res.status(401).json({ error: "활성화된 Gemini API Key가 없습니다. 먼저 API Key를 인증 및 활성화해 주세요." });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: keyToUse,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Convert format to Google GenAI expectations
      // Format should be list of { role: 'user' | 'model', parts: [{ text: string }] }
      // And we filter out empty texts or unrecognized fields
      const formattedContents = messages
        .filter((msg: any) => msg.text && msg.text.trim())
        .map((msg: any) => ({
          role: msg.sender === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }]
        }));

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction || "You are a professional Digital and AI Competency Coach.",
        }
      });

      res.json({ text: response.text });
    } catch (err: any) {
      console.error("Chat proxy error:", err);
      const friendlyMessage = cleanGeminiError(err);
      res.status(500).json({ error: friendlyMessage });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
