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

      // Handle specific status codes
      if (response.status === 401) {
        errorMessage = "Authentication required. Please log in.";
      } else if (response.status === 403) {
        errorMessage = "You don't have permission to access this resource.";
      } else {
        try {
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const error = await response.json();
            errorMessage = error.error || error.message || errorMessage;
          } else {
            // If response is not JSON (like HTML), provide a clear message
            errorMessage = `Server returned ${response.status} ${response.statusText}. Expected JSON response but received ${contentType || "unknown content type"}.`;
          }
        } catch {
          errorMessage = `Server returned ${response.status} ${response.statusText}`;
        }
      }

      const error = new Error(errorMessage) as Error & { status: number };
      error.status = response.status;
      throw error;
    }
    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // For successful responses, we still expect JSON
      throw new Error(
        `Invalid response format: expected JSON but received ${contentType || "unknown content type"}`
      );
    }

    const json = await response.json();

    console.log("content type", contentType);
    console.log("response", json);

    return json;
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
