// User types
export type UserRole = 'customer' | 'admin';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
}

export interface UserWithPassword extends User {
  passwordHash: string;
}

// Product types
export interface Category {
  id: number;
  name: string;
  description: string | null;
}

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  categoryId: number;
  imageUrl: string | null;
  stock: number;
  createdAt: Date;
}

export interface ProductWithCategory extends Product {
  category: Category;
}

// Order types
export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';

export interface Order {
  id: number;
  userId: number;
  status: OrderStatus;
  total: number;
  createdAt: Date;
}

export interface OrderItem {
  id: number;
  orderId: number;
  productId: number;
  quantity: number;
  price: number;
}

export interface OrderWithItems extends Order {
  items: (OrderItem & { product: Product })[];
}

// Cart types
export interface CartItem {
  id: number;
  userId: number;
  productId: number;
  quantity: number;
}

export interface CartItemWithProduct extends CartItem {
  product: Product;
}

// Review types
export interface Review {
  id: number;
  productId: number;
  userId: number;
  rating: number;
  comment: string | null;
  createdAt: Date;
}

// Analytics types
export interface DailySales {
  date: string;
  totalOrders: number;
  totalRevenue: number;
  avgOrderValue: number;
}

export interface SpendingBreakdown {
  category: string;
  amount: number;
  percentage: number;
}

export interface TopProduct {
  productId: number;
  productName: string;
  totalSold: number;
  revenue: number;
}

// Chat types
export type ChatEventType = 'text' | 'chart' | 'action' | 'error' | 'done';
export type ChartType = 'line' | 'bar' | 'pie' | 'area';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  charts?: ChartData[];
  timestamp: Date;
}

export interface ChartDataPoint {
  label: string;
  value: number;
  [key: string]: string | number;
}

export interface ChartData {
  chartType: ChartType;
  title: string;
  data: ChartDataPoint[];
  xKey?: string;
  yKey?: string;
  config?: {
    colors?: string[];
    showLegend?: boolean;
    showGrid?: boolean;
  };
}

export interface ChatEvent {
  type: ChatEventType;
  data: string | ChartData | { action: string; payload: unknown };
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface JwtPayload {
  userId: number;
  email: string;
  role: UserRole;
}
