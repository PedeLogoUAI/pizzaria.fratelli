import React, { useEffect, useState, useRef } from 'react';
import { X, Trash2, ShoppingBag, AlertCircle, CreditCard, Banknote, MapPin, Loader2, MessageSquare, Send } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency, generateOrderId } from '../utils/formatters';
import { PaymentMethod } from '../types';
import { WHATSAPP_NUMBER, API_URL } from '../constants';
import { isStoreOpen, getBusinessHoursText } from '../utils/storeStatus';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

// Interface for ViaCEP response
interface ViaCepAddress {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string; // Cidade
  uf: string; // Estado
}

const CartDrawer: React.FC<CartDrawerProps> = ({ isOpen, onClose }) => {
  const { 
    cartItems, 
    removeFromCart, 
    subtotal, 
    discounts, 
    totalDiscount, 
    total,
    userData,
    setUserData
  } = useCart();

  const [currentOrderId, setCurrentOrderId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CREDIT');
  const [storeOpen, setStoreOpen] = useState(true);
  
  // Address Auto-complete states
  const [suggestions, setSuggestions] = useState<ViaCepAddress[]>([]);
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sending state
  const [isSending, setIsSending] = useState(false);

  const deliveryFee = 5.00;
  const finalTotal = total + deliveryFee;

  useEffect(() => {
    if (isOpen) {
      setCurrentOrderId(generateOrderId());
      setStoreOpen(isStoreOpen());
    }
  }, [isOpen]);

  // Handle generic input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setUserData({
      ...userData,
      [e.target.name]: e.target.value
    });
  };

  // Handle Street Input with Debounce for API
  const handleStreetChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Update state immediately
    setUserData({ ...userData, street: value });

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Hide suggestions if empty
    if (value.length < 3) {
      setSuggestions([]);
      return;
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(async () => {
      setIsLoadingAddress(true);
      try {
        // Search scoped to MG/Esmeraldas as requested
        const cleanValue = encodeURIComponent(value);
        const response = await fetch(`https://viacep.com.br/ws/MG/Esmeraldas/${cleanValue}/json/`);
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setSuggestions(data);
        } else {
          setSuggestions([]);
        }
      } catch (error) {
        console.error("Erro ao buscar endereço:", error);
        setSuggestions([]);
      } finally {
        setIsLoadingAddress(false);
      }
    }, 500); // 500ms debounce
  };

  const selectAddress = (address: ViaCepAddress) => {
    setUserData({
      ...userData,
      street: address.logradouro,
      neighborhood: address.bairro,
      city: address.localidade,
      state: address.uf,
      zipcode: address.cep
    });
    setSuggestions([]); // Close dropdown
    // Optional: Focus on Number field (using ref would be cleaner, but this is simple)
    const numberInput = document.getElementById('input-number');
    if (numberInput) numberInput.focus();
  };

  const translatePayment = (method: PaymentMethod) => {
    switch (method) {
      case 'CREDIT': return 'Cartão de Crédito';
      case 'DEBIT': return 'Cartão de Débito';
      case 'CASH': return 'Dinheiro';
      case 'PIX': return 'PIX';
      default: return method;
    }
  };

  const getFriendlyCategoryName = (cat: string) => {
    if (cat === 'PIZZA') return 'Pizzas';
    if (cat === 'DRINK') return 'Bebidas';
    return cat;
  };

  const handleCheckout = async () => {
    if (!isStoreOpen()) {
      setStoreOpen(false);
      alert("A loja está fechada no momento.");
      return;
    }

    if (!userData.name || !userData.phone || !userData.street || !userData.number || !userData.neighborhood) {
      alert("Por favor, preencha todos os campos obrigatórios do endereço.");
      return;
    }

    if (cartItems.length === 0) {
        alert("Seu carrinho está vazio.");
        return;
    }

    setIsSending(true);

    const fullAddress = `${userData.street}, ${userData.number}
${userData.complement ? `Complemento: ${userData.complement}\n` : ''}Bairro: ${userData.neighborhood}
Cidade: ${userData.city}/${userData.state}
CEP: ${userData.zipcode}
${userData.reference ? `Ref: ${userData.reference}` : ''}`;

    const itemsList = cartItems.map(item => `• ${item.name} (${formatCurrency(item.price)})`).join('\n');
    const discountText = discounts.length > 0 
      ? `\n\n*Descontos Aplicados:*\n${discounts.map(d => `• ${d.ruleName}: -${formatCurrency(d.amountSaved)}`).join('\n')}` 
      : '';
    
    const obsText = userData.observations && userData.observations.trim().length > 0 
      ? `\n\n*Observações:*\n_${userData.observations}_` 
      : '';

    const message = `
*NOVO PEDIDO: #${currentOrderId}*

*Cliente:* ${userData.name}
*Telefone:* ${userData.phone}

*Endereço de Entrega:*
${fullAddress}

*Itens:*
${itemsList}${obsText}

*Resumo:*
Subtotal: ${formatCurrency(subtotal)}
Desconto: -${formatCurrency(totalDiscount)}${discountText}
Taxa de Entrega: ${formatCurrency(deliveryFee)}
*TOTAL: ${formatCurrency(finalTotal)}*

*Pagamento:* ${translatePayment(paymentMethod)}
    `.trim();

    // --- ENVIAR PARA PLANILHA GOOGLE ---
    const singleLineAddress = `${userData.street}, ${userData.number} - ${userData.neighborhood} ${userData.complement ? `(${userData.complement})` : ''}`;

    const payload = {
      orderId: currentOrderId,
      customer: {
        name: userData.name,
        phone: userData.phone,
        address: singleLineAddress
      },
      paymentMethod: translatePayment(paymentMethod),
      items: cartItems.map(item => ({
        id: item.id,
        name: item.name,
        price: item.price,
        cost: item.cost || 0 // Envia o custo ou 0 se não tiver
      })),
      financials: {
        discount: totalDiscount,
        delivery: deliveryFee,
        total: finalTotal
      }
    };

    try {
      // Usamos no-cors porque o Google Apps Script não retorna cabeçalhos CORS padrão facilmente em doPost sem redirecionamentos complexos
      // No entanto, para garantir que os dados cheguem, usamos fetch.
      // O ideal é usar 'Content-Type': 'text/plain;charset=utf-8' para evitar preflight OPTIONS que falha no GAS.
      await fetch(API_URL, {
        method: 'POST',
        mode: 'no-cors', // Importante para evitar erro de CORS bloqueando o request no browser
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload)
      });
      
      // Pequeno delay para garantir que o browser enviou
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (err) {
      console.error("Erro ao salvar na planilha (não impede o WhatsApp):", err);
    }

    // --- ABRIR WHATSAPP ---
    setIsSending(false);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodedMessage}`;
    
    localStorage.setItem('pizzaria_last_order', new Date().toISOString());
    window.open(url, '_blank');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={!isSending ? onClose : undefined}
      />

      {/* Drawer */}
      <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col animate-slide-in font-sans">
        
        {/* Header */}
        <div className={`p-5 text-white flex justify-between items-center shadow-md ${storeOpen ? 'bg-gradient-to-r from-green-700 to-green-600' : 'bg-gray-800'}`}>
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2 font-serif">
              <ShoppingBag size={24} /> Seu Pedido
            </h2>
            <p className="text-xs opacity-80 font-mono mt-1 tracking-wider">#{currentOrderId}</p>
          </div>
          <button onClick={onClose} disabled={isSending} className="p-2 hover:bg-white/20 rounded-full transition disabled:opacity-50">
            <X size={28} />
          </button>
        </div>

        {/* Content */}
        <div className={`flex-1 overflow-y-auto p-5 space-y-6 bg-gray-50 ${isSending ? 'opacity-50 pointer-events-none' : ''}`}>
          
          {!storeOpen && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-800 shadow-sm">
              <AlertCircle className="shrink-0 mt-0.5" size={20} />
              <div>
                <h3 className="font-bold text-sm">Loja Fechada</h3>
                <p className="text-sm mt-1">Estamos recebendo pedidos apenas das {getBusinessHoursText()}.</p>
              </div>
            </div>
          )}

          {/* Items */}
          <section>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="w-1 h-4 bg-red-600 rounded-full"></span> Itens do Pedido
            </h3>
            {cartItems.length === 0 ? (
              <div className="text-center py-8 bg-white rounded-xl border border-gray-100 border-dashed">
                <ShoppingBag className="mx-auto text-gray-300 mb-2" size={48} />
                <p className="text-gray-400">Seu carrinho está vazio.</p>
              </div>
            ) : (
              <>
                <ul className="space-y-3">
                  {cartItems.map((item) => (
                    <li key={item.cartItemId} className="flex justify-between items-start bg-white p-3 rounded-xl border border-gray-200 shadow-sm">
                      <div className="flex-1">
                        <p className="font-bold text-gray-800">{item.name}</p>
                        <p className="text-xs text-gray-500">{getFriendlyCategoryName(item.category)}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-green-700">{formatCurrency(item.price)}</span>
                        <button 
                          onClick={() => removeFromCart(item.cartItemId)}
                          className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>

                {/* Área de Observações */}
                <div className="mt-4 pt-4 border-t border-gray-100">
                   <label className="block text-xs font-bold text-gray-500 mb-2 uppercase flex items-center gap-1">
                     <span className="w-1 h-3 bg-yellow-400 rounded-full"></span> Observações
                   </label>
                   <textarea
                     name="observations"
                     value={userData.observations}
                     onChange={handleInputChange}
                     className="w-full bg-white border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm min-h-[80px]"
                     placeholder="Ex: Tirar a cebola, enviar maionese extra, troco para 50..."
                   />
                </div>
              </>
            )}
          </section>

          {/* Financials */}
          <section className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatCurrency(subtotal)}</span>
            </div>
            {discounts.map((disc, idx) => (
              <div key={idx} className="flex justify-between text-green-700 font-bold bg-green-50 px-2 py-1 rounded-md border border-green-100">
                <span>{disc.ruleName}</span>
                <span>-{formatCurrency(disc.amountSaved)}</span>
              </div>
            ))}
            <div className="flex justify-between text-gray-600">
              <span>Taxa de Entrega</span>
              <span>{formatCurrency(deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-gray-900 border-t border-dashed border-gray-300 pt-3 mt-2">
              <span>Total</span>
              <span className="text-red-600">{formatCurrency(finalTotal)}</span>
            </div>
          </section>

          {/* Personal Data Form */}
          <section>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="w-1 h-4 bg-green-600 rounded-full"></span> Seus Dados
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Nome Completo</label>
                <input 
                  type="text" 
                  name="name" 
                  value={userData.name} 
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  placeholder="Ex: João Silva"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Telefone (WhatsApp)</label>
                <input 
                  type="tel" 
                  name="phone" 
                  value={userData.phone} 
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          </section>

          {/* Address Form (API Integrated) */}
          <section className="relative">
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="w-1 h-4 bg-green-600 rounded-full"></span> Endereço de Entrega
            </h3>
            
            <div className="space-y-3">
              {/* Street with Autocomplete */}
              <div className="relative">
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Logradouro (Rua)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    name="street" 
                    value={userData.street} 
                    onChange={handleStreetChange}
                    autoComplete="off"
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 pr-10 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                    placeholder="Digite o nome da rua..."
                  />
                  {isLoadingAddress && (
                    <div className="absolute right-3 top-3 animate-spin text-green-600">
                      <Loader2 size={20} />
                    </div>
                  )}
                </div>

                {/* Suggestions Dropdown */}
                {suggestions.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    <ul>
                      {suggestions.map((addr, index) => (
                        <li 
                          key={index}
                          onClick={() => selectAddress(addr)}
                          className="p-3 hover:bg-green-50 cursor-pointer border-b border-gray-100 last:border-0 transition-colors flex flex-col"
                        >
                          <span className="font-bold text-gray-800">{addr.logradouro}</span>
                          <span className="text-xs text-gray-500">{addr.bairro} - {addr.localidade}/{addr.uf}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Number and Complement */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Número</label>
                  <input 
                    id="input-number"
                    type="text" 
                    name="number" 
                    value={userData.number} 
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                    placeholder="Nº"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Complemento</label>
                  <input 
                    type="text" 
                    name="complement" 
                    value={userData.complement} 
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                    placeholder="Apt, Bloco, Casa"
                  />
                </div>
              </div>

              {/* Neighborhood */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Bairro</label>
                <input 
                  type="text" 
                  name="neighborhood" 
                  value={userData.neighborhood} 
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  placeholder="Bairro"
                />
              </div>

              {/* City and State */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Cidade</label>
                  <input 
                    type="text" 
                    name="city" 
                    value={userData.city} 
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  />
                </div>
                <div className="col-span-1">
                  <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Estado</label>
                  <input 
                    type="text" 
                    name="state" 
                    value={userData.state} 
                    onChange={handleInputChange}
                    className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  />
                </div>
              </div>

              {/* Zipcode (CEP) */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">CEP</label>
                <input 
                  type="text" 
                  name="zipcode" 
                  value={userData.zipcode} 
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  placeholder="00000-000"
                />
              </div>

              {/* Reference */}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Ponto de Referência</label>
                <input 
                  type="text" 
                  name="reference" 
                  value={userData.reference} 
                  onChange={handleInputChange}
                  className="w-full bg-white border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition shadow-sm"
                  placeholder="Próximo a..."
                />
              </div>

            </div>
          </section>

          {/* Payment */}
          <section>
            <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm uppercase tracking-wide">
              <span className="w-1 h-4 bg-green-600 rounded-full"></span> Pagamento
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {(['CREDIT', 'DEBIT', 'CASH', 'PIX'] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  onClick={() => setPaymentMethod(method)}
                  className={`p-3 rounded-xl border text-sm font-bold transition flex items-center justify-center gap-2 ${
                    paymentMethod === method 
                      ? 'bg-green-600 text-white border-green-600 shadow-md transform scale-105' 
                      : 'bg-white text-gray-600 border-gray-300 hover:border-green-400 hover:bg-green-50'
                  }`}
                >
                  {method === 'CASH' && <Banknote size={16} />}
                  {(method === 'CREDIT' || method === 'DEBIT') && <CreditCard size={16} />}
                  {translatePayment(method)}
                </button>
              ))}
            </div>
          </section>

        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-200 bg-white">
          <button 
            onClick={handleCheckout}
            disabled={!storeOpen || isSending}
            className={`w-full py-4 rounded-xl font-extrabold text-lg transition shadow-xl flex justify-center items-center gap-2 transform active:scale-95 ${
              storeOpen && !isSending
                ? 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-500 hover:to-red-600' 
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {isSending ? (
                <>
                    <Loader2 className="animate-spin" size={24} />
                    <span>ENVIANDO...</span>
                </>
            ) : storeOpen ? (
              <>
                <Send size={24} />
                <span>ENVIAR PEDIDO</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-base font-medium">{formatCurrency(finalTotal)}</span>
              </>
            ) : (
              <span>LOJA FECHADA</span>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};

export default CartDrawer;