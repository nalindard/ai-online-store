import { Link } from 'react-router-dom';
import { ShoppingCart, Star } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCart } from '../../context/CartContext';

interface ProductCardProps {
  product: {
    id: number;
    name: string;
    description: string;
    price: number;
    imageUrl: string | null;
    stock: number;
    category?: {
      name: string;
    };
  };
}

export default function ProductCard({ product }: ProductCardProps) {
  const { user } = useAuth();
  const { addToCart } = useCart();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!user) {
      // Could redirect to login or show a toast
      return;
    }

    try {
      await addToCart(product.id, 1);
    } catch (error) {
      console.error('Failed to add to cart:', error);
    }
  };

  return (
    <Link to={`/products/${product.id}`} className="card group hover:shadow-md transition-shadow">
      {/* Image */}
      <div className="aspect-square bg-gray-100 rounded-t-xl overflow-hidden">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            <ShoppingCart className="w-12 h-12" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        {product.category && (
          <p className="text-xs text-primary-600 font-medium mb-1">
            {product.category.name}
          </p>
        )}
        
        <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors line-clamp-1">
          {product.name}
        </h3>
        
        <p className="text-sm text-gray-500 mt-1 line-clamp-2">
          {product.description}
        </p>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-lg font-bold text-gray-900">
            ${product.price.toFixed(2)}
          </span>
          
          {product.stock > 0 ? (
            <button
              onClick={handleAddToCart}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              disabled={!user}
              title={user ? 'Add to cart' : 'Login to add to cart'}
            >
              <ShoppingCart className="w-4 h-4" />
            </button>
          ) : (
            <span className="text-sm text-red-500 font-medium">Out of stock</span>
          )}
        </div>

        {product.stock > 0 && product.stock < 10 && (
          <p className="text-xs text-amber-600 mt-2">Only {product.stock} left!</p>
        )}
      </div>
    </Link>
  );
}
