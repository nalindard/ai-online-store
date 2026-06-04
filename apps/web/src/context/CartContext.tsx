import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { cartApi } from '../lib/api';

interface CartItem {
  id: number;
  productId: number;
  quantity: number;
  product: {
    id: number;
    name: string;
    price: number;
    imageUrl: string | null;
  };
}

interface CartContextType {
  items: CartItem[];
  total: number;
  itemCount: number;
  isLoading: boolean;
  addToCart: (productId: number, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const { token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [total, setTotal] = useState(0);
  const [itemCount, setItemCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshCart = async () => {
    if (!token) {
      setItems([]);
      setTotal(0);
      setItemCount(0);
      return;
    }

    setIsLoading(true);
    try {
      const response = await cartApi.getCart(token);
      setItems(response.data.items);
      setTotal(response.data.total);
      setItemCount(response.data.itemCount);
    } catch (error) {
      console.error('Failed to fetch cart:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshCart();
  }, [token]);

  const addToCart = async (productId: number, quantity = 1) => {
    if (!token) throw new Error('Not authenticated');
    await cartApi.addToCart(productId, quantity, token);
    await refreshCart();
  };

  const updateQuantity = async (itemId: number, quantity: number) => {
    if (!token) throw new Error('Not authenticated');
    await cartApi.updateCartItem(itemId, quantity, token);
    await refreshCart();
  };

  const removeItem = async (itemId: number) => {
    if (!token) throw new Error('Not authenticated');
    await cartApi.removeCartItem(itemId, token);
    await refreshCart();
  };

  const clearCart = async () => {
    if (!token) throw new Error('Not authenticated');
    await cartApi.clearCart(token);
    await refreshCart();
  };

  return (
    <CartContext.Provider value={{
      items,
      total,
      itemCount,
      isLoading,
      addToCart,
      updateQuantity,
      removeItem,
      clearCart,
      refreshCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
