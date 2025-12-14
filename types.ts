
export enum ProductCategory {
  PIZZA = 'PIZZA',
  DRINK = 'DRINK'
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  cost?: number; // Custo do produto para relatórios
  image: string;
  category: ProductCategory;
}

export interface CartItem extends Product {
  cartItemId: string; // Unique ID for this specific instance in cart to handle rule grouping
}

export interface DiscountRule {
  id: string;
  name: string;
  priority: number; // Higher number = checked first
  // Requisitos dinâmicos: Chave é a categoria (PIZZA, DRINK), Valor é a quantidade
  requirements: {
    [key: string]: number; 
  };
  setPrice: number; // The fixed price for the bundle
}

export interface AppliedDiscount {
  ruleName: string;
  amountSaved: number;
  itemIds: string[];
}

export interface UserData {
  name: string;
  phone: string;
  // Address Fields
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zipcode: string;
  reference: string;
  observations: string; // Campo de observações do pedido
}

export type PaymentMethod = 'CREDIT' | 'DEBIT' | 'CASH' | 'PIX';