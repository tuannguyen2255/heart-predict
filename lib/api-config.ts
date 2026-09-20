const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || process.env.NEXT_PUBLIC_API_LOCAL_URL || "http://127.0.0.1:8000";

export const API_ENDPOINTS = {
  login: `${API_BASE_URL}/login`,
  register: `${API_BASE_URL}/register`,
  resetPassword: `${API_BASE_URL}/reset-password`,
  predict: `${API_BASE_URL}/predict`,
  
  historyPredictions: `${API_BASE_URL}/prediction/history`,
  userInfo: `${API_BASE_URL}/information/me`,
  updateProfile: `${API_BASE_URL}/user/profile`,
  health: `${API_BASE_URL}/health`,
  
  chatbot:    `${API_BASE_URL}/chatbot`,
  CHATBOT:    `${API_BASE_URL}/chatbot`,      // alias cho HeartChatbot.tsx
  chatStream: `${API_BASE_URL}/chatbot`,

  chatStatus:  `${API_BASE_URL}/user/chat-status`,
  CHAT_STATUS: `${API_BASE_URL}/user/chat-status`, // alias cho HeartChatbot.tsx
  chatHistory: `${API_BASE_URL}/chatbot/history`,

  premiumUser: `${API_BASE_URL}/api/premium_user`,
  upgradeUser: `${API_BASE_URL}/api/user/upgrade`,
  generateQr:  `${API_BASE_URL}/api/payment/generate-qr`,
};
