# SmartShop - AI-Powered E-Commerce Platform

> A comprehensive e-commerce platform showcasing MCP servers, RAG, Generative AI, and real-time streaming visualizations.

---

## 🎯 Project Overview

SmartShop is a modern e-commerce application with role-based AI assistants. The system integrates multiple advanced AI patterns to create an intelligent shopping and management experience.

### Core Concept
- **Customers** interact with AI to browse products, get recommendations, track orders, and analyze spending
- **Admins** use AI to view sales insights, manage inventory, and generate business reports
- **AI streams** interactive charts and data visualizations in real-time

---

## 👥 User Roles & Features

### Customer Features
| Feature | Description | AI Technology |
|---------|-------------|---------------|
| Product Search & Discovery | Natural language product search | RAG over product catalog |
| Personalized Recommendations | AI suggests products based on history | Embeddings + RAG |
| Order Tracking | Chat-based order status inquiries | MCP → Orders DB |
| Spending Analytics | Interactive spending charts streamed by AI | Streaming + Charts |
| Product Q&A | Ask questions about any product | RAG over product details |
| Cart Assistant | AI helps optimize cart, find deals | Function calling |

### Admin Features
| Feature | Description | AI Technology |
|---------|-------------|---------------|
| Sales Dashboard | Real-time sales metrics via chat | MCP → Analytics DB |
| Inventory Management | Stock alerts, reorder suggestions | MCP → Inventory service |
| Customer Insights | Analyze customer behavior patterns | RAG + Analytics |
| Revenue Reports | Generate visual revenue reports | Streaming charts |
| Product Management | AI-assisted product descriptions | Generative AI |
| Trend Analysis | Identify trending products/categories | RAG + Visualization |

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     React.js + Tailwind CSS                         │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │    │
│  │  │  Auth Pages  │  │  Shop Pages  │  │    AI Chat Interface     │   │    │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────┘   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │          Streaming Chart Components (Recharts/D3)            │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket/SSE
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                   Bun + Express.js Server                           │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────────┐   │    │
│  │  │ Auth API   │  │ Shop API   │  │ Chat API   │  │ Admin API    │   │    │
│  │  │ /auth/*    │  │ /shop/*    │  │ /chat/*    │  │ /admin/*     │   │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────────┘   │    │
│  │  ┌──────────────────────────────────────────────────────────────┐   │    │
│  │  │              JWT Middleware + Role-Based Access              │   │    │
│  │  └──────────────────────────────────────────────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                            AI ORCHESTRATION LAYER                           │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                      AI Chat Service                                │    │
│  │  ┌────────────────┐  ┌────────────────┐  ┌──────────────────────┐   │    │
│  │  │  Context       │  │  Tool Router   │  │  Response Streamer   │   │    │
│  │  │  Manager       │  │  (MCP Client)  │  │  (SSE/Charts)        │   │    │
│  │  └────────────────┘  └────────────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                      │                                      │
│         ┌────────────────────────────┼────────────────────────────┐         │
│         ▼                            ▼                            ▼         │
│  ┌──────────────┐           ┌──────────────┐           ┌──────────────┐     │
│  │   OpenAI /   │           │     RAG      │           │     MCP      │     │
│  │   Gemini     │           │   Engine     │           │   Gateway    │     │
│  │   Client     │           │              │           │              │     │
│  └──────────────┘           └──────────────┘           └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              MCP SERVERS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Products   │  │   Orders     │  │  Analytics   │  │  Inventory   │     │
│  │   MCP        │  │   MCP        │  │  MCP         │  │  MCP         │     │
│  │   Server     │  │   Server     │  │  Server      │  │  Server      │     │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘     │
│         │                 │                 │                 │             │
│         └─────────────────┴────────┬────────┴─────────────────┘             │
│                                    │                                        │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────┐    ┌─────────────────────────────┐         │
│  │         SQLite DB           │    │      Vector Store           │         │
│  │  ┌────────┐ ┌─────────┐     │    │      (SQLite-VSS or         │         │
│  │  │Users   │ │Orders   │     │    │       ChromaDB)             │         │
│  │  ├────────┤ ├─────────┤     │    │                             │         │
│  │  │Products│ │Cart     │     │    │  • Product embeddings       │         │
│  │  ├────────┤ ├─────────┤     │    │  • Description embeddings   │         │
│  │  │Reviews │ │Analytics│     │    │  • Review embeddings        │         │
│  │  └────────┘ └─────────┘     │    │                             │         │
│  └─────────────────────────────┘    └─────────────────────────────┘         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Service Breakdown

### 1. Frontend Service (React + Tailwind)
**Location:** `/apps/web`

| Component | Purpose |
|-----------|---------|
| `ChatInterface` | Main AI chat with streaming support |
| `ChartRenderer` | Dynamic chart rendering from AI responses |
| `ProductGrid` | Product listing and search |
| `CartManager` | Shopping cart functionality |
| `AdminDashboard` | Admin-only analytics views |
| `AuthProvider` | JWT token management |

### 2. API Gateway (Bun + Express)
**Location:** `/apps/api`

| Endpoint Group | Routes | Auth |
|----------------|--------|------|
| Auth | `POST /auth/login`, `POST /auth/register` | Public |
| Shop | `GET /shop/products`, `GET /shop/product/:id` | Public |
| Cart | `POST /cart/*` | Customer |
| Orders | `GET /orders/*`, `POST /orders/*` | Customer |
| Chat | `POST /chat/message` (SSE) | Authenticated |
| Admin | `GET /admin/*` | Admin only |

### 3. AI Chat Service
**Location:** `/apps/api/services/chat`

```
┌─────────────────────────────────────────────────────────┐
│                   Chat Service                          │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  User Message                                           │
│       │                                                 │
│       ▼                                                 │
│  ┌─────────────┐    ┌─────────────┐                     │
│  │  Context    │───▶│  Role       │                     │
│  │  Builder    │    │  Detector   │                     │
│  └─────────────┘    └──────┬──────┘                     │
│                            │                            │
│       ┌────────────────────┼────────────────────┐       │
│       ▼                    ▼                    ▼       │
│  ┌─────────┐         ┌─────────┐         ┌─────────┐    │
│  │Customer │         │ Admin   │         │ General │    │
│  │ Tools   │         │ Tools   │         │ Tools   │    │
│  └────┬────┘         └────┬────┘         └──────┬──┘    │
│       │                   │                     │       │
│       └───────────────────┴─────────────────────┘       │
│                           │                             │
│                           ▼                             │
│                   ┌──────────────┐                      │
│                   │  LLM Call    │                      │
│                   │  (Streaming) │                      │
│                   └──────┬───────┘                      │
│                          │                              │
│                          ▼                              │
│                   ┌──────────────┐                      │
│                   │  Response    │                      │
│                   │  Parser      │                      │
│                   └──────┬───────┘                      │
│                          │                              │
│           ┌──────────────┼──────────────┐               │
│           ▼              ▼              ▼               │
│      [Text SSE]    [Chart SSE]    [Action SSE]          │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 4. RAG Engine
**Location:** `/apps/api/services/rag`

| Component | Purpose |
|-----------|---------|
| `EmbeddingService` | Generate embeddings via OpenAI/Gemini |
| `VectorStore` | Store/query embeddings (SQLite-VSS) |
| `DocumentLoader` | Load products, reviews into vector store |
| `QueryEngine` | Semantic search over product catalog |
| `ContextBuilder` | Build relevant context for LLM |

### 5. MCP Servers
**Location:** `/apps/mcp-*`

#### 5.1 Products MCP Server
```typescript
Tools:
  - search_products(query, filters)
  - get_product_details(productId)
  - get_product_reviews(productId)
  - get_similar_products(productId)
```

#### 5.2 Orders MCP Server
```typescript
Tools:
  - get_customer_orders(customerId, status?)
  - get_order_details(orderId)
  - get_order_history(customerId, dateRange)
  - create_order(customerId, items)
```

#### 5.3 Analytics MCP Server
```typescript
Tools:
  - get_sales_summary(dateRange)
  - get_revenue_by_category(dateRange)
  - get_top_products(limit, dateRange)
  - get_customer_spending(customerId)
  - get_sales_trend(granularity, dateRange)
```

---

## 📊 Streaming Chart System

### Chart Types Supported
| Chart Type | Use Case | Triggered By |
|------------|----------|--------------|
| Line Chart | Sales trends, spending over time | Admin/Customer analytics |
| Bar Chart | Revenue by category, top products | Admin dashboard |
| Pie Chart | Category distribution, spending breakdown | Both roles |
| Area Chart | Cumulative sales, inventory levels | Admin analytics |

### Streaming Protocol
```typescript
// SSE Event Types
interface ChatEvent {
  type: 'text' | 'chart' | 'action' | 'done';
  data: TextChunk | ChartData | ActionData;
}

interface ChartData {
  chartType: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: Array<{ label: string; value: number; [key: string]: any }>;
  config?: ChartConfig;
}
```

---

## 🗄️ Database Schema

### Core Tables
```sql
-- Users & Authentication
users (id, email, password_hash, role, name, created_at)

-- Products
products (id, name, description, price, category_id, image_url, stock, created_at)
categories (id, name, description)
product_embeddings (id, product_id, embedding, chunk_text)

-- Orders
orders (id, user_id, status, total, created_at)
order_items (id, order_id, product_id, quantity, price)

-- Reviews
reviews (id, product_id, user_id, rating, comment, created_at)

-- Cart
cart_items (id, user_id, product_id, quantity)

-- Analytics (materialized/cached)
daily_sales (date, total_orders, total_revenue, avg_order_value)
```

---

## 📁 Project Structure

```
smartshop/
├── apps/
│   ├── web/                          # React Frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   ├── package.json
│   │   └── vite.config.ts
│   │
│   ├── api/                          # Bun + Express Backend
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── services/
│   │   │   │   ├── chat/
│   │   │   │   ├── rag/
│   │   │   │   └── mcp/
│   │   │   ├── middleware/
│   │   │   ├── db/
│   │   │   └── index.ts
│   │   ├── data/                     # SQLite databases
│   │   └── package.json
│   │
│   ├── mcp-analytics/                # Analytics MCP Server
│   ├── mcp-orders/                   # Orders MCP Server
│   └── mcp-products/                 # Products MCP Server
│
├── packages/
│   └── shared/                       # Shared types & utilities
│       └── src/
│
├── package.json                      # Monorepo root (workspaces)
├── turbo.json                        # Turborepo config
├── ARCHITECTURE.md
└── README.md
```

---

## 🔄 Data Flow Examples

### Customer: "Show me my spending this month"
```
1. User sends message via ChatInterface
2. API Gateway authenticates (JWT) → Customer role confirmed
3. Chat Service receives message
4. LLM decides to call: Analytics MCP → get_customer_spending()
5. MCP Server queries SQLite → Returns spending data
6. LLM formats response + chart data
7. Response Streamer sends:
   - SSE: { type: 'text', data: 'Here's your spending breakdown...' }
   - SSE: { type: 'chart', data: { chartType: 'pie', ... } }
   - SSE: { type: 'done' }
8. Frontend renders text + animated pie chart
```

### Admin: "What are the top selling products?"
```
1. Admin sends message via ChatInterface
2. API Gateway authenticates → Admin role confirmed
3. Chat Service receives message
4. LLM decides to call: Analytics MCP → get_top_products(10)
5. MCP Server queries SQLite → Returns top products data
6. LLM formats response + chart data
7. Response Streamer sends:
   - SSE: { type: 'text', data: 'Here are your top 10 products...' }
   - SSE: { type: 'chart', data: { chartType: 'bar', ... } }
   - SSE: { type: 'done' }
8. Frontend renders text + animated bar chart
```

### Customer: "Find wireless headphones under $100"
```
1. User sends message via ChatInterface
2. RAG Engine generates embedding for query
3. VectorStore performs semantic search on product_embeddings
4. Products MCP → search_products() for additional filtering
5. LLM receives context: relevant products + search results
6. LLM generates personalized recommendations
7. Response includes product cards (not charts)
```

---

## 🛠️ Technology Stack Summary

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | React 18 + Vite | UI framework |
| Styling | Tailwind CSS | Responsive design |
| Charts | Recharts | Streaming visualizations |
| Backend | Bun + Express | API server |
| Database | SQLite + better-sqlite3 | Relational data |
| Vector Store | SQLite-VSS | Embeddings storage |
| AI | OpenAI / Gemini SDK | LLM & Embeddings |
| MCP | @modelcontextprotocol/sdk | Tool servers |
| Auth | JWT (jsonwebtoken) | Authentication |
| Monorepo | Turborepo | Build orchestration |

