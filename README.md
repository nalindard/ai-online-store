# SmartShop AI - E-commerce Platform with AI Assistants

<div align="center">
  <!-- Interactive Dashboard & Chat Interface -->
  <img src="images/1.png" alt="Realtime Sales Dashboard" width="45%" style="margin: 5px;" />
  <img src="images/2.png" alt="Interactive Chart Streaming" width="45%" style="margin: 5px;" />
  <br/>
  <!-- AI-Powered Analytics & Search -->
  <img src="images/3.png" alt="AI Analytics" width="45%" style="margin: 5px;" />
  <img src="images/4.png" alt="Semantic Search" width="45%" style="margin: 5px;" />
</div>

<div align="center">
  <h3>🚀 Real-time Data Streaming & Interactive AI Charts</h3>
  <p>
    Experience the next generation of e-commerce admin interfaces. 
    <b>Ask questions in plain English</b> and watch as complex data transforms into 
    <b>live, interactive charts</b> right before your eyes.
  </p>
</div>

> **Note:** This project is a Proof of Concept (POC) demonstrating advanced AI integration patterns. It serves as a reference implementation for MCP servers, RAG, and streaming UI components. While fully functional, it uses simplified infrastructure (e.g., SQLite) and is not intended for production deployment as-is.

A modern e-commerce platform demonstrating cutting-edge AI technologies:

- 📊 **Interactive Charts Streaming** - Watch datasets render into visualization in real-time
- ⚡ **Real-time Data** - Live inventory and sales tracking via SSE (Server-Sent Events)
- 🤖 **LLM Integration** (Gemini/OpenAI) with streaming responses
- 🔧 **Tool Calling** for real-time data access
- 🔍 **RAG (Retrieval Augmented Generation)** for semantic product search
- 🔌 **MCP Servers** (Model Context Protocol) for modular AI tools

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         SmartShop AI                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐       │
│  │   Frontend   │───▶│   API        │───▶│   Database   │       │
│  │   (React)    │    │   (Express)  │    │   (SQLite)   │       │
│  └──────────────┘    └──────┬───────┘    └──────────────┘       │
│                             │                                   │
│                    ┌────────┴────────┐                          │
│                    │                 │                          │
│              ┌─────▼─────┐    ┌──────▼──────┐                   │
│              │   LLM     │    │   RAG       │                   │
│              │ (Gemini)  │    │ (Embeddings)│                   │
│              └───────────┘    └─────────────┘                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    MCP Servers                           │   │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────────────┐     │   │
│  │  │ Products  │  │  Orders   │  │    Analytics      │     │   │
│  │  └───────────┘  └───────────┘  └───────────────────┘     │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

```
┌─────────────────┐     ┌──────────────────┐
│  React Frontend │◄───►│   Vite Proxy     │
│   (port 5173)   │     │   /api → :3001   │
└─────────────────┘     └────────┬─────────┘
                                 │
                        ┌────────▼─────────┐
                        │    Express API   │
                        │   (port 3001)    │
                        │   - Auth/Shop    │
                        │   - Cart/Orders  │
                        │   - Chat (AI)    │
                        └────────┬─────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
    ┌─────────▼──────┐ ┌────────▼───────┐ ┌───────▼────────┐
    │ MCP Products   │ │  MCP Orders    │ │  MCP Analytics │
    │  (port 3010)   │ │  (port 3011)   │ │   (port 3012)  │
    │  HTTP + SSE    │ │  HTTP + SSE    │ │   HTTP + SSE   │
    └────────────────┘ └────────────────┘ └────────────────┘
              │                  │                  │
              └──────────────────┼──────────────────┘
                                 │
                        ┌────────▼─────────┐
                        │   SQLite DBs     │
                        │  smartshop.db    │
                        │  vectors.db      │
                        └──────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Bun 1.3+ |
| **Monorepo** | Turborepo |
| **Frontend** | React 18 + Vite 6 + Tailwind CSS |
| **Backend** | Express.js |
| **Database** | SQLite (bun:sqlite) |
| **LLM** | Gemini 2.5 Flash / OpenAI GPT-4 |
| **Embeddings** | Gemini Embedding-001 (768 dimensions) |
| **MCP** | @modelcontextprotocol/sdk |
| **Charts** | Recharts |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) 1.3 or later
- Gemini API Key (free at [Google AI Studio](https://aistudio.google.com/))

### Installation

```bash
# Install dependencies
bun install

# Set up environment
cp apps/api/.env.example apps/api/.env
# Add your GEMINI_API_KEY to .env
```

### Environment Variables

Create `apps/api/.env` by copying the example:

```bash
cp apps/api/.env.example apps/api/.env
```

Then edit `.env` with your API keys:

```env
GEMINI_API_KEY=your-gemini-api-key
# OR
OPENAI_API_KEY=your-openai-api-key

JWT_SECRET=your-jwt-secret
PORT=3001
```

### Running

```bash
bun run dev

# Frontend: http://localhost:5173
# API: http://localhost:3001
```

### Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@smartshop.com | admin123 |
| Customer | john@example.com | customer123 |

## Features

### AI Chat Assistant
- Streaming responses via SSE
- Role-based tools (customer vs admin)
- Conversation history

### RAG Semantic Search
```bash
# Initialize (admin only)
curl -X POST http://localhost:3001/admin/rag/init -H "Authorization: Bearer <token>"

# Search
curl "http://localhost:3001/shop/semantic-search?q=something+for+gaming"
```

### Streaming Charts (Admin)
- "Show me revenue by category" → Pie chart
- "Sales trend for the last 30 days" → Line chart
- "Top 5 selling products" → Bar chart

### MCP Servers
| Server | Tools |
|--------|-------|
| Products | search_products, get_product_details, get_reviews |
| Orders | get_orders, get_order_details, get_spending |
| Analytics | get_dashboard, get_top_products, get_revenue |

## Project Structure

```
ai-online-store/
├── apps/
│   ├── api/                 # Express API
│   │   └── src/
│   │       ├── services/
│   │       │   ├── chat/    # Chat + tools
│   │       │   ├── llm/     # Gemini/OpenAI
│   │       │   └── rag/     # Embeddings + Vector store
│   │       └── routes/      # API endpoints
│   ├── mcp-analytics/       # Analytics MCP Server
│   ├── mcp-orders/          # Orders MCP Server
│   ├── mcp-products/        # Products MCP Server
│   └── web/                 # React frontend
└── packages/shared/         # Shared types
```

## Implementation Status

- [x] Foundation (monorepo, database, API)
- [x] Core Shop Features (products, cart, orders)
- [x] AI Chat Infrastructure (LLM, tools, streaming)
- [x] MCP Servers Integration
- [x] RAG System (embeddings, semantic search)
- [x] Streaming Charts & Visualizations

## Scripts

```bash
bun run dev      # Start all services
bun run build    # Build for production
bun run clean    # Clean build artifacts
```

## License

MIT
