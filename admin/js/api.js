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
        const error = data && data.message ? data.message : `Ошибка ${response.status}`;
        throw new Error(error);
      }

      return data;
    } catch (err) {
      if (err.name === 'TypeError' && err.message.includes('fetch')) {
        throw new Error('Не удалось соединиться с сервером');
      }
      throw err;
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