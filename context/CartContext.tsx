import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { AppliedDiscount, CartItem, DiscountRule, Product, UserData } from '../types';
import { calculateDiscounts } from '../utils/discountEngine';
import { DEFAULT_DISCOUNT_RULES } from '../constants';

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  removeFromCart: (cartItemId: string) => void;
  clearCart: () => void;
  discounts: AppliedDiscount[];
  subtotal: number;
  totalDiscount: number;
  total: number;
  userData: UserData;
  setUserData: (data: UserData) => void;
  orderId: string;
  regenerateOrderId: () => void;
  discountRules: DiscountRule[];
  setDiscountRules: (rules: DiscountRule[]) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  // Initialize with DEFAULT RULES immediately
  const [discountRules, setDiscountRules] = useState<DiscountRule[]>(DEFAULT_DISCOUNT_RULES);
  const [orderId, setOrderId] = useState<string>('');
  const [userData, setUserDataState] = useState<UserData>({
    name: '',
    phone: '',
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: 'Esmeraldas',
    state: 'MG',
    zipcode: '',
    reference: '',
    observations: '' // Inicializa vazio
  });

  // Load user data from local storage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('pizzaria_user_data');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        // Ensure structure compatibility if local storage has old data
        setUserDataState(prev => ({ ...prev, ...parsed }));
      } catch (e) {
        console.error("Failed to parse user data", e);
      }
    }
  }, []);

  const setUserData = (data: UserData) => {
    setUserDataState(data);
    localStorage.setItem('pizzaria_user_data', JSON.stringify(data));
  };

  const addToCart = (product: Product) => {
    const newItem: CartItem = {
      ...product,
      cartItemId: Math.random().toString(36).substring(2, 9) + Date.now().toString(36)
    };
    setCartItems(prev => [...prev, newItem]);
  };

  const removeFromCart = (cartItemId: string) => {
    setCartItems(prev => prev.filter(item => item.cartItemId !== cartItemId));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const regenerateOrderId = () => {
     // Managed by the Drawer usually, but state held here is fine
  };

  // Derived State: Discounts & Totals
  const { discounts, subtotal, totalDiscount, total } = useMemo(() => {
    const sub = cartItems.reduce((acc, item) => acc + item.price, 0);
    // Use dynamic discountRules instead of static constant
    const calculatedDiscounts = calculateDiscounts(cartItems, discountRules);
    const discTotal = calculatedDiscounts.reduce((acc, d) => acc + d.amountSaved, 0);

    return {
      discounts: calculatedDiscounts,
      subtotal: sub,
      totalDiscount: discTotal,
      total: Math.max(0, sub - discTotal)
    };
  }, [cartItems, discountRules]);

  return (
    <CartContext.Provider value={{
      cartItems,
      addToCart,
      removeFromCart,
      clearCart,
      discounts,
      subtotal,
      totalDiscount,
      total,
      userData,
      setUserData,
      orderId,
      regenerateOrderId,
      setOrderId: (id: string) => setOrderId(id), // internal use
      discountRules,
      setDiscountRules
    } as any}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};