export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface DocumentInfo {
  id: string;
  document_type: string;
  file_name: string;
  file_url: string;
  file_size: number;
  uploaded_at: string;
  file_type?: string;
  content_type?: string;
} 