// Types for the Study Consultant API

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  documents?: { type: string; content: string; id: string; country?: string }[]
}

export interface ChatRequest {
  user_id: string
  message: string
}

export interface ChatResponse {
  question: string
  is_complete: boolean
  progress: number
  user_id: string
  documents?: { type: string; content: string; id: string; country?: string }[]
}

export interface SessionData {
  user_id: string
  chat_history: ChatMessage[]
  profile_data: Record<string, string>
  is_complete: boolean
}

export interface SessionListItem {
  user_id: string
  is_complete: boolean
  created_at: string
}
