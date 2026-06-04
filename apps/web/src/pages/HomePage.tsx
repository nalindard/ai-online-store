import { Link } from 'react-router-dom';
import { ArrowRight, MessageSquare, BarChart3, ShoppingBag } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function HomePage() {
  const { user } = useAuth();

  return (
    <div className="animate-fade-in">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Shop Smarter with AI
            </h1>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto mb-8">
              Experience the future of e-commerce with our AI-powered shopping assistant. 
              Get personalized recommendations, track orders, and analyze your spending with ease.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link to="/products" className="btn bg-white text-primary-600 hover:bg-gray-100 px-8 py-3 text-lg">
                Browse Products
              </Link>
              {user ? (
                <Link to="/chat" className="btn bg-primary-500 hover:bg-primary-400 px-8 py-3 text-lg flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Chat with AI
                </Link>
              ) : (
                <Link to="/register" className="btn bg-primary-500 hover:bg-primary-400 px-8 py-3 text-lg">
                  Get Started
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Powered by Modern AI
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              SmartShop uses cutting-edge AI technologies to provide you with an intelligent shopping experience.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <MessageSquare className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">AI Chat Assistant</h3>
              <p className="text-gray-600">
                Ask questions about products, get recommendations, and track orders through natural conversation.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <BarChart3 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Streaming Analytics</h3>
              <p className="text-gray-600">
                Get real-time visualizations of your spending patterns and shopping insights.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="card p-8 text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <ShoppingBag className="w-8 h-8 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Smart Recommendations</h3>
              <p className="text-gray-600">
                RAG-powered product search that understands what you're looking for.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">
              Built With Modern Tech
            </h2>
            <p className="text-gray-600">
              This demo showcases integration of cutting-edge AI technologies.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[
              { name: 'MCP Servers', desc: 'Model Context Protocol for safe data access' },
              { name: 'RAG', desc: 'Retrieval-Augmented Generation for search' },
              { name: 'OpenAI / Gemini', desc: 'LLM for intelligent conversations' },
              { name: 'Streaming SSE', desc: 'Real-time chart visualization' },
            ].map((tech) => (
              <div key={tech.name} className="card p-6">
                <h4 className="font-semibold text-gray-900 mb-2">{tech.name}</h4>
                <p className="text-sm text-gray-600">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Ready to Experience AI Shopping?
          </h2>
          <p className="text-gray-600 mb-8">
            {user 
              ? "Start chatting with your AI assistant now."
              : "Create an account to access all features including the AI assistant."
            }
          </p>
          {user ? (
            <Link to="/chat" className="btn btn-primary px-8 py-3 text-lg inline-flex items-center gap-2">
              Open AI Chat
              <ArrowRight className="w-5 h-5" />
            </Link>
          ) : (
            <Link to="/register" className="btn btn-primary px-8 py-3 text-lg inline-flex items-center gap-2">
              Create Account
              <ArrowRight className="w-5 h-5" />
            </Link>
          )}
        </div>
      </section>
    </div>
  );
}
