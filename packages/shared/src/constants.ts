// API Constants
export const API_VERSION = 'v1';
export const DEFAULT_PAGE_SIZE = 20;

// User Roles
export const USER_ROLES = {
  CUSTOMER: 'customer',
  ADMIN: 'admin',
} as const;

// Order Statuses
export const ORDER_STATUSES = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
} as const;

// Chart Colors (Tailwind-inspired)
export const CHART_COLORS = {
  primary: '#3B82F6',    // blue-500
  secondary: '#8B5CF6',  // violet-500
  success: '#22C55E',    // green-500
  warning: '#F59E0B',    // amber-500
  danger: '#EF4444',     // red-500
  info: '#06B6D4',       // cyan-500
  palette: [
    '#3B82F6', // blue
    '#8B5CF6', // violet
    '#EC4899', // pink
    '#F59E0B', // amber
    '#22C55E', // green
    '#06B6D4', // cyan
    '#EF4444', // red
    '#6366F1', // indigo
  ],
} as const;

// AI System Prompts
export const SYSTEM_PROMPTS = {
  CUSTOMER: `You are a helpful shopping assistant for SmartShop. You help customers:
- Find and discover products
- Get personalized recommendations
- Track their orders
- Analyze their spending patterns
- Answer questions about products

When providing data that can be visualized, include a chart in your response.
Be friendly, helpful, and concise. Focus on providing value to the customer.`,

  ADMIN: `You are a business intelligence assistant for SmartShop administrators. You help admins:
- View sales analytics and trends
- Monitor inventory levels
- Analyze customer behavior
- Generate revenue reports
- Identify top-performing products

When providing analytics data, include appropriate charts for visualization.
Be professional and data-driven. Provide actionable insights.`,
} as const;

// Error Messages
export const ERROR_MESSAGES = {
  UNAUTHORIZED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  INVALID_CREDENTIALS: 'Invalid email or password',
  USER_EXISTS: 'User already exists',
  INVALID_TOKEN: 'Invalid or expired token',
  INTERNAL_ERROR: 'An internal error occurred',
} as const;
