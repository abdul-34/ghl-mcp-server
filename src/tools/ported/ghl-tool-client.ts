export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface GHLToolConfig {
  accessToken?: string;
  baseUrl?: string;
  version?: string;
  locationId: string;
  companyId?: string;
}

export interface GHLToolRequestOptions {
  version?: string;
}

export interface GHLToolResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    details?: unknown;
  };
}

export interface GHLToolClient {
  getConfig(): Readonly<GHLToolConfig>;
  makeRequest<T = any>(
    method: HttpMethod,
    path: string,
    body?: Record<string, unknown>,
    options?: GHLToolRequestOptions
  ): Promise<GHLToolResponse<T>>;
}
