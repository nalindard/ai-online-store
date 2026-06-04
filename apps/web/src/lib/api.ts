const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  token?: string;
}

async function fetchApi<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { token, ...fetchOptions } = options;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...fetchOptions,
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'An error occurred');
  }

  return data;
}

// Auth API
export const authApi = {
  login: (email: string, password: string) =>
    fetchApi<{ success: boolean; data: { token: string; user: any } }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  register: (email: string, password: string, name: string) =>
    fetchApi<{ success: boolean; data: { token: string; user: any } }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, name }),
    }),
};

// Shop API
export const shopApi = {
  getProducts: (params?: { category?: string; search?: string; page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.category) searchParams.set('category', params.category);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', params.page.toString());
    
    return fetchApi<{ success: boolean; data: any }>(`/shop/products?${searchParams}`);
  },

  getProduct: (id: string) =>
    fetchApi<{ success: boolean; data: any }>(`/shop/products/${id}`),

  getCategories: () =>
    fetchApi<{ success: boolean; data: any[] }>('/shop/categories'),
};

// Cart API
export const cartApi = {
  getCart: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/cart', { token }),

  addToCart: (productId: number, quantity: number, token: string) =>
    fetchApi<{ success: boolean; data: any }>('/cart/add', {
      method: 'POST',
      body: JSON.stringify({ productId, quantity }),
      token,
    }),

  updateCartItem: (itemId: number, quantity: number, token: string) =>
    fetchApi<{ success: boolean; data: any }>(`/cart/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity }),
      token,
    }),

  removeCartItem: (itemId: number, token: string) =>
    fetchApi<{ success: boolean; data: any }>(`/cart/${itemId}`, {
      method: 'DELETE',
      token,
    }),

  clearCart: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/cart', {
      method: 'DELETE',
      token,
    }),
};

// Orders API
export const ordersApi = {
  getOrders: (token: string, params?: { status?: string; page?: number }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', params.page.toString());
    
    return fetchApi<{ success: boolean; data: any }>(`/orders?${searchParams}`, { token });
  },

  getOrder: (id: string, token: string) =>
    fetchApi<{ success: boolean; data: any }>(`/orders/${id}`, { token }),

  createOrder: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/orders', {
      method: 'POST',
      token,
    }),
};

// Admin API
export const adminApi = {
  getDashboard: (token: string) =>
    fetchApi<{ success: boolean; data: any }>('/admin/dashboard', { token }),

  getSalesAnalytics: (token: string, days = 30) =>
    fetchApi<{ success: boolean; data: any }>(`/admin/analytics/sales?days=${days}`, { token }),

  getTopProducts: (token: string, limit = 10) =>
    fetchApi<{ success: boolean; data: any }>(`/admin/analytics/top-products?limit=${limit}`, { token }),

  getInventory: (token: string, lowStock = false) =>
    fetchApi<{ success: boolean; data: any }>(`/admin/inventory?lowStock=${lowStock}`, { token }),

  updateStock: (productId: number, stock: number, token: string) =>
    fetchApi<{ success: boolean; data: any }>(`/admin/inventory/${productId}`, {
      method: 'PUT',
      body: JSON.stringify({ stock }),
      token,
    }),
};

// Chat API
export const chatApi = {
  // SSE streaming chat - returns EventSource
  streamMessage: (message: string, token: string): EventSource => {
    const eventSource = new EventSource(
      `${API_BASE}/chat/message?message=${encodeURIComponent(message)}&token=${token}`
    );
    return eventSource;
  },

  // POST-based streaming (for full control)
  sendMessage: async (
    message: string,
    token: string,
    onChunk: (data: { type: string; content?: string; name?: string; error?: string; chart?: unknown }) => void
  ): Promise<void> => {
    const response = await fetch(`${API_BASE}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      throw new Error('Failed to send message');
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('No response body');
    }

    let buffer = '';
    let currentEventType = 'message';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('event: ')) {
          currentEventType = line.slice(7).trim();
          continue;
        }
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            onChunk({ ...data, type: currentEventType });
          } catch (e) {
            // Ignore parse errors
          }
        }
      }
    }
  },

  // Simple non-streaming chat
  simpleMessage: (message: string, token: string) =>
    fetchApi<{ success: boolean; data: { message: string; messageId: string } }>('/chat/simple', {
      method: 'POST',
      body: JSON.stringify({ message }),
      token,
    }),

  // Get conversation history
  getHistory: (token: string) =>
    fetchApi<{ success: boolean; data: { messages: Array<{ id: string; role: string; content: string }> } }>('/chat/history', { token }),

  // Clear conversation history
  clearHistory: (token: string) =>
    fetchApi<{ success: boolean; data: { message: string } }>('/chat/history', {
      method: 'DELETE',
      token,
    }),
};

export default fetchApi;
