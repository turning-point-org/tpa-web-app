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
  status?: 'placeholder' | 'uploaded' | 'processed' | 'failed';
  title?: string;
}

export interface TenantUser {
  id: string;
  tenant_id: string;
  email: string;
  permission: 'Read' | 'Write';
  added_by: string;
  added_at: string;
  updated_by?: string;
  updated_at?: string;
  type: 'tenant_user';
}

export interface Tenant {
  id: string;
  tenant_id: string;
  name: string;
  slug: string;
  description: string;
  region: string;
  _rid?: string;
  _self?: string;
  _etag?: string;
  _attachments?: string;
  _ts?: number;
} 