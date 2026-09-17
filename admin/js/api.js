// API Helper
export class ApiClient {
  constructor(baseUrl = '') {
    this.baseUrl = baseUrl;
  }

  async _request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    // Add credentials for session cookies
    const config = {
      ...options,
      headers,
      credentials: 'include'
    };

    try {
      const response = await fetch(url, config);

      // Parse JSON if response has content
      let data = null;
      if (response.headers.get('content-type')?.includes('application/json')) {
        data = await response.json();
      }

      if (!response.ok) {
        const error = new Error(
          (data && data.message) || `Ошибка ${response.status}`
        );
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // Already an Error we created with status
      if (err instanceof Error && err.status) {
        throw err;
      }
      if (err.name === 'AbortError') {
        const error = new Error('Запрос отменён');
        error.status = 0;
        throw error;
      }
      if (err.name === 'TypeError') {
        const error = new Error('Не удалось соединиться с сервером');
        error.status = 0;
        throw error;
      }
      // Non-JSON response or unexpected error
      const error = new Error(err.message || 'Неожиданная ошибка');
      error.status = 0;
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const query = new URLSearchParams(params).toString();
    const url = query ? `${endpoint}?${query}` : endpoint;
    return this._request(url, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this._request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async patch(endpoint, data) {
    return this._request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this._request(endpoint, { method: 'DELETE' });
  }
}

// Export instance for convenience
export const api = new ApiClient();