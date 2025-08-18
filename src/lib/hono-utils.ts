export class ApiError extends Error {
  constructor(
    message: string,
    public status?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function handleApiResponse<T>(response: Promise<Response>): Promise<T> {
  const res = await response;
  
  if (!res.ok) {
    const errorText = await res.text();
    throw new ApiError(errorText || 'Request failed', res.status);
  }
  
  const data = await res.json();
  
  // Handle response format from API routes
  if ('success' in data && 'data' in data) {
    return data.data as T;
  }
  
  // Handle response format with direct data
  return data as T;
}