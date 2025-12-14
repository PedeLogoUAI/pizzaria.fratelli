import { DiscountRule, Product, ProductCategory } from './types';

export const WHATSAPP_NUMBER = '5531995536361';
export const API_URL = "https://script.google.com/macros/s/AKfycbyZ2mHmymDOGxBFZZLVtRzEPWqLO9vZbopRbdgNUZJs666gtA_UzFkn0DlHL3kZSy1oQA/exec";

export const BUSINESS_HOURS = {
  ENABLED: true, // Define se o sistema de horário está ativo
  OPEN_HOUR: 18, // 18h
  CLOSE_HOUR: 23 // 23h
};

// Regras Padrão: Vazia.
// O sistema agora depende exclusivamente das regras carregadas da planilha.
// Se a API falhar, nenhuma regra de desconto será aplicada indevidamente.
export const DEFAULT_DISCOUNT_RULES: DiscountRule[] = [];