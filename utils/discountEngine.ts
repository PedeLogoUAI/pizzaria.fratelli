import { AppliedDiscount, CartItem, DiscountRule } from '../types';

/**
 * Motor de Descontos
 * Implementação robusta para calcular descontos baseados em regras de preço fixo (combos).
 */
export const calculateDiscounts = (
  items: CartItem[],
  rules: DiscountRule[]
): AppliedDiscount[] => {
  const appliedDiscounts: AppliedDiscount[] = [];
  
  // 1. PREPARAÇÃO: Clonar e ordenar itens (mais caros primeiro) para favorecer o cliente/regra
  let availableItems = [...items].sort((a, b) => b.price - a.price);
  
  // 2. ORDENAÇÃO DE REGRAS: Prioridade maior primeiro
  const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

  // 3. PROCESSAMENTO
  for (const rule of sortedRules) {
    let keepApplyingRule = true;

    while (keepApplyingRule) {
      const itemsToUseInThisCombo: CartItem[] = [];
      let canFormCombo = true;

      // Iterar sobre requisitos da regra (Ex: PIZZA: 2, DRINK: 1)
      for (const [categoryKey, quantityRequired] of Object.entries(rule.requirements)) {
        const qty = quantityRequired as number;
        const cat = String(categoryKey).toUpperCase();

        // Encontrar candidatos disponíveis desta categoria
        // Nota: item.category deve estar alinhado com as chaves (PIZZA/DRINK)
        const candidates = availableItems.filter(
          item => item.category.toUpperCase() === cat && !itemsToUseInThisCombo.includes(item)
        );

        if (candidates.length < qty) {
          canFormCombo = false;
          break; // Falta item para completar o combo
        }

        // Selecionar os N primeiros (mais caros) para este combo
        itemsToUseInThisCombo.push(...candidates.slice(0, qty));
      }

      if (canFormCombo && itemsToUseInThisCombo.length > 0) {
        // Calcular valores
        const originalPriceSum = itemsToUseInThisCombo.reduce((acc, item) => acc + item.price, 0);
        const discountValue = originalPriceSum - rule.setPrice;

        // Se o desconto for positivo (preço original > preço do combo), aplica.
        // Se for zero ou negativo (combo mais caro que avulso), ignora para não prejudicar cliente.
        if (discountValue > 0) {
          appliedDiscounts.push({
            ruleName: rule.name,
            amountSaved: discountValue,
            itemIds: itemsToUseInThisCombo.map(i => i.cartItemId)
          });

          // Remover itens usados da pool de disponíveis
          availableItems = availableItems.filter(item => !itemsToUseInThisCombo.includes(item));
        } else {
          // A regra bateu os requisitos, mas não valeu a pena financeiramente.
          // Encerra essa regra para não tentar aplicar indefinidamente.
          keepApplyingRule = false;
        }
      } else {
        // Não há itens suficientes para formar outro combo desta regra
        keepApplyingRule = false;
      }
    }
  }

  return appliedDiscounts;
};