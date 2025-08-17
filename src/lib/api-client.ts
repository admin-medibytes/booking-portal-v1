interface ApiRequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = "") {
    this.baseUrl = baseUrl;
  }

  private async request<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const { params, ...requestOptions } = options;

    // Build URL with query parameters
    const url = new URL(endpoint, window.location.origin);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined) {
          url.searchParams.append(key, String(value));
        }
      });
    }

    const response = await fetch(url.toString(), {
      ...requestOptions,
      credentials: "include", // Include cookies for session
      headers: {
        "Content-Type": "application/json",
        ...requestOptions.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = "Request failed";
      try {
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          const error = await response.json();
          errorMessage = error.error || error.message || errorMessage;
        } else {
          // If response is not JSON (like HTML), use status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
      } catch {
        errorMessage = `${response.status} ${response.statusText}`;
      }
      const error = new Error(errorMessage) as Error & { status: number };
      error.status = response.status;
      throw error;
    }

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      throw new Error("Invalid response format: expected JSON");
    }

    return response.json();
  }

  get<T>(endpoint: string, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  put<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  patch<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  delete<T>(endpoint: string, options?: ApiRequestOptions) {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient("/api");
