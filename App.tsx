import React, { useState, useEffect } from 'react';
import { CartProvider, useCart } from './context/CartContext';
import { ProductCategory, Product, DiscountRule } from './types';
import { API_URL, DEFAULT_DISCOUNT_RULES } from './constants';
import { formatCurrency } from './utils/formatters';
import { Pizza, Coffee, Plus, ShoppingCart, Clock, MapPin, Phone, Instagram, Facebook, CreditCard, Banknote, Smartphone, Loader2, AlertTriangle, Tag } from 'lucide-react';
import CartDrawer from './components/CartDrawer';
import { isStoreOpen, getBusinessHoursText } from './utils/storeStatus';

// Helper ultra-robusto: ignora Case, Espaços, Underlines, Pontos, Hífens e Acentos
const getValue = (obj: any, keys: string[]) => {
  if (!obj) return undefined;
  
  const objKeys = Object.keys(obj);
  
  // Função de normalização agressiva
  const normalize = (str: string) => {
    return str
      .toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Remove acentos
      .replace(/[\s\u00A0_.\-]/g, ''); // Remove espaços, NBSP, underline, ponto, hífen
  };

  // Cria um mapa de chaves normalizadas
  const normalizedMap: Record<string, string> = {};
  objKeys.forEach(k => {
    normalizedMap[normalize(k)] = k;
  });

  for (const key of keys) {
    const searchKey = normalize(key);
    const realKey = normalizedMap[searchKey];
    if (realKey) {
      return obj[realKey];
    }
  }
  return undefined;
};

// Helper para converter qualquer coisa em número
const parseNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (!val) return 0;
    const str = String(val).trim();
    if (!str) return 0;
    
    // Suporte a moeda BR (vírgula decimal) e remove símbolos de moeda
    let clean = str;
    if (str.includes(',') && !str.includes('.')) { 
        // Formato brasileiro puro: 1.000,00 ou 80,00
        clean = str.replace(/\./g, '').replace(',', '.');
    } else if (str.includes(',') && str.includes('.')) {
        // Formato misto (ignorar pontos de milhar, trocar virgula por ponto)
        clean = str.replace(/\./g, '').replace(',', '.');
    }
    
    // Remove tudo que não for dígito ou ponto
    clean = clean.replace(/[^\d.]/g, '');
    
    const num = parseFloat(clean);
    return isNaN(num) ? 0 : num;
};

const MainContent: React.FC = () => {
  const [activeCategory, setActiveCategory] = useState<ProductCategory>(ProductCategory.PIZZA);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [statusClickCount, setStatusClickCount] = useState(0);
  
  // Data States
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { addToCart, cartItems, setDiscountRules, discountRules } = useCart();

  const filteredProducts = products.filter(p => p.category === activeCategory);

  useEffect(() => {
    const checkStatus = () => setStoreOpen(isStoreOpen());
    checkStatus();
    const interval = setInterval(checkStatus, 60000);
    return () => clearInterval(interval);
  }, []);

  // Fetch Data (Products AND Rules)
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log("Iniciando busca de dados na API:", API_URL);

        // 1. BUSCAR PRODUTOS
        const productResponse = await fetch(API_URL); 
        if (!productResponse.ok) throw new Error(`Erro HTTP Produtos: ${productResponse.status}`);
        
        const productText = await productResponse.text();
        let productData;
        try {
          productData = JSON.parse(productText);
        } catch (e) {
          throw new Error("A API retornou dados inválidos.");
        }

        const rawProducts = productData.produtos || productData.items || (Array.isArray(productData) ? productData : []);

        if (!Array.isArray(rawProducts)) {
          console.error("Dados de produtos inválidos:", productData);
          throw new Error("Formato de produtos inesperado da API.");
        }

        const mappedProducts: Product[] = rawProducts.map((item: any, index: number) => {
          const rawId = getValue(item, ['Id', 'id', 'codigo']);
          const rawName = getValue(item, ['Produto', 'name', 'nome']) || `Produto ${index}`;
          const rawDesc = getValue(item, ['Descricao', 'description']) || '';
          const rawPrice = getValue(item, ['Valor', 'price', 'preco']);
          // Captura o Custo para usar na planilha de pedidos
          const rawCost = getValue(item, ['Custo', 'cost', 'custo']);
          const rawImage = getValue(item, ['Imagem', 'image', 'foto']);
          const rawCategory = getValue(item, ['Categoria', 'category']);

          let category = ProductCategory.PIZZA;
          const catStr = String(rawCategory || '').toUpperCase();
          
          // Lógica expandida para capturar bebidas
          if (catStr.includes('BEBIDA') || catStr.includes('DRINK') || catStr.includes('REFRIGERANTE') || catStr.includes('SUCO')) {
            category = ProductCategory.DRINK;
          }

          return {
            id: String(rawId || index),
            name: rawName,
            description: rawDesc,
            price: parseNumber(rawPrice),
            cost: parseNumber(rawCost), // Mapeia o custo
            image: rawImage,
            category: category
          };
        });

        setProducts(mappedProducts);

        // 2. BUSCAR REGRAS DE DESCONTO
        try {
            console.log("Buscando regras na aba Regras_Desconto...");
            const rulesUrl = `${API_URL}?sheet=Regras_Desconto&t=${Date.now()}`;
            const rulesResponse = await fetch(rulesUrl);
            const rulesJson = await rulesResponse.json();
            
            // Suporte para retorno { regras: [...] } OU retorno direto [...]
            let rawRules = Array.isArray(rulesJson) 
                ? rulesJson 
                : (rulesJson.regras || rulesJson.data || []);
            
            // VERIFICAÇÃO CRÍTICA: Se o retorno parece ser de PRODUTOS (tem campo 'Imagem' ou 'Custo'), 
            // então a API ignorou o parâmetro sheet. Usamos o fallback.
            const sample = rawRules[0];
            if (sample && (getValue(sample, ['custo', 'imagem', 'image', 'cost']) !== undefined)) {
                console.warn("API retornou Produtos ao invés de Regras. Usando regras locais.");
                rawRules = []; // Força fallback
            }

            console.log("Dados brutos das regras recebidos:", rawRules);

            if (Array.isArray(rawRules) && rawRules.length > 0) {
                const mappedRules: DiscountRule[] = rawRules
                    .filter((r: any) => {
                        const val = getValue(r, ['ativo', 'active']);
                        if (val === true) return true;
                        if (val === undefined || val === null) return true; // Assume true se não tiver coluna ativo
                        const sVal = String(val).toUpperCase().trim();
                        return sVal === 'VERDADEIRO' || sVal === 'TRUE' || sVal === '1' || sVal === 'S';
                    }) 
                    .map((r: any, idx: number) => {
                        const id = String(getValue(r, ['eu ia', 'euia', 'id']) || `rule_${idx}`);
                        const name = String(getValue(r, ['nome', 'name']) || 'Promoção');
                        const priority = parseNumber(getValue(r, ['prioridade', 'priority']));
                        const setPrice = parseNumber(getValue(r, ['valor_do_desconto', 'valor', 'price', 'setPrice']));

                        const qtdPizza = parseNumber(getValue(r, ['qtd_pizza', 'pizzas', 'qtdpizza', 'qtd.pizza']));
                        const qtdDrink = parseNumber(getValue(r, [
                            'quantidade de bebida', 'quantidadedebebida', 'qtd_bebida', 'qtdbebida', 'qtd.bebida', 'bebidas', 'quantidade'
                        ]));

                        const reqs: {[key: string]: number} = {};
                        if (qtdPizza > 0) reqs['PIZZA'] = qtdPizza;
                        if (qtdDrink > 0) reqs['DRINK'] = qtdDrink;

                        return {
                            id,
                            name,
                            priority,
                            requirements: reqs, 
                            setPrice
                        };
                    });
                
                const validRules = mappedRules.filter(r => Object.keys(r.requirements).length > 0 && r.setPrice > 0);

                if (validRules.length > 0) {
                    console.log("Regras da API aplicadas:", validRules);
                    setDiscountRules(validRules);
                } else {
                    console.log("Regras da API inválidas ou vazias. Usando Padrão Local.");
                    setDiscountRules(DEFAULT_DISCOUNT_RULES);
                }
            } else {
              console.log("API não retornou regras. Usando Padrão Local.");
              setDiscountRules(DEFAULT_DISCOUNT_RULES);
            }
        } catch (ruleError) {
            console.error("Erro ao ler aba Regras_Desconto, usando padrão:", ruleError);
            setDiscountRules(DEFAULT_DISCOUNT_RULES); 
        }

      } catch (error: any) {
        console.error("Falha fatal:", error);
        setError(error.message || "Erro desconhecido ao carregar cardápio.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [setDiscountRules]);

  const handleStatusClick = () => {
    const newCount = statusClickCount + 1;
    setStatusClickCount(newCount);

    if (newCount >= 7) {
      const currentlyOpen = isStoreOpen();
      const newState = currentlyOpen ? 'CLOSED' : 'OPEN';
      localStorage.setItem('FORCE_STORE_STATUS', newState);
      setStoreOpen(!currentlyOpen);
      setStatusClickCount(0);
      alert(`[MODO DEV] Loja forçada para: ${newState === 'OPEN' ? 'ABERTA' : 'FECHADA'}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      
      <div className="flex-grow">
        <header className="bg-gradient-to-br from-green-800 via-green-700 to-red-700 text-white shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-green-600 via-white to-red-600 shadow-sm z-20"></div>
          
          <div className="max-w-4xl mx-auto relative z-10 px-6 py-8">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6 text-center md:text-left">
              
              <div className="shrink-0 bg-white p-1 rounded-full border-4 border-white/20 shadow-lg">
                 <img 
                   src="https://pedelogouai.github.io/pizzaria.fratelli/imagens/fratelli2.png" 
                   alt="Pizzaria Fratelli" 
                   className="w-32 h-32 md:w-40 md:h-40 object-contain"
                 />
              </div>

              <div className="flex-1 space-y-2">
                <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight drop-shadow-lg font-serif">
                  Pizzaria Fratelli
                </h1>
                <p className="text-yellow-300 font-serif italic text-xl font-medium drop-shadow-md">
                  Massa de longa fermentação
                </p>
                <p className="text-green-50 font-medium max-w-xl mx-auto md:mx-0 leading-relaxed text-sm md:text-base opacity-95">
                  Experiencie a autêntica pizza italiana em Esmeraldas. Ingredientes selecionados e queijos artesanais.
                </p>

                <div className="pt-4 flex flex-wrap justify-center md:justify-start gap-3">
                   <button 
                    onClick={handleStatusClick}
                    className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold border backdrop-blur-md shadow-sm transition-colors cursor-pointer hover:bg-white/10 active:scale-95 ${
                    storeOpen 
                      ? 'bg-green-600/30 border-green-300 text-white' 
                      : 'bg-red-600/30 border-red-300 text-red-100'
                  }`}>
                    <div className={`w-2 h-2 rounded-full ${storeOpen ? 'bg-green-400' : 'bg-red-400'} animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.5)]`} />
                    <span className="uppercase tracking-wider">{storeOpen ? 'Aberto Agora' : 'Fechado'}</span>
                  </button>

                  <div className="bg-black/20 px-3 py-1.5 rounded-full backdrop-blur-sm text-xs border border-white/10 inline-flex items-center gap-2 text-white/90">
                     <Clock size={14} />
                     <span>{getBusinessHoursText()}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 bg-white/10 p-4 rounded-xl backdrop-blur-md border border-white/20 shadow-inner">
              <p className="font-bold mb-2 text-yellow-300 text-sm flex items-center justify-center md:justify-start gap-2">
                <Tag size={18} /> Ofertas Ativas:
              </p>
              <div className="flex flex-wrap justify-center md:justify-start gap-x-6 gap-y-2 text-sm text-white font-medium">
                 {discountRules.length > 0 ? (
                    discountRules.map((rule) => (
                        <span key={rule.id} className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/10">
                            <span className={`w-1.5 h-1.5 rounded-full ${rule.priority > 1 ? 'bg-red-400' : 'bg-green-400'}`}></span> 
                            {rule.name}: {formatCurrency(rule.setPrice)}
                        </span>
                    ))
                 ) : (
                    <span className="text-white/60 italic">
                        {isLoading ? "Carregando promoções..." : "Nenhuma promoção no momento."}
                    </span>
                 )}
              </div>
            </div>

          </div>
        </header>

        {/* MUDANÇA AQUI: Ajuste para garantir sticky e visual */}
        <div className="sticky top-0 bg-white/95 backdrop-blur-md shadow-md z-40 overflow-x-auto border-b border-gray-200 transition-all duration-300">
          <div className="max-w-4xl mx-auto flex">
            <button
              onClick={() => setActiveCategory(ProductCategory.PIZZA)}
              className={`flex-1 py-4 text-center font-bold flex justify-center items-center gap-2 transition-all duration-300 ${
                activeCategory === ProductCategory.PIZZA 
                  ? 'text-green-700 border-b-4 border-green-600 bg-green-50/50' 
                  : 'text-gray-400 hover:text-green-600 hover:bg-gray-50'
              }`}
            >
              <Pizza size={20} className={activeCategory === ProductCategory.PIZZA ? "animate-bounce" : ""} /> 
              PIZZAS
            </button>
            <button
              onClick={() => setActiveCategory(ProductCategory.DRINK)}
              className={`flex-1 py-4 text-center font-bold flex justify-center items-center gap-2 transition-all duration-300 ${
                activeCategory === ProductCategory.DRINK 
                  ? 'text-red-700 border-b-4 border-red-600 bg-red-50/50' 
                  : 'text-gray-400 hover:text-red-600 hover:bg-gray-50'
              }`}
            >
              <Coffee size={20} className={activeCategory === ProductCategory.DRINK ? "animate-bounce" : ""} /> 
              BEBIDAS
            </button>
          </div>
        </div>

        <main className="max-w-4xl mx-auto p-4 py-8 pb-20">
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500 gap-4">
              <Loader2 className="animate-spin text-green-600" size={48} />
              <p className="font-medium animate-pulse">Carregando cardápio fresquinho...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="bg-red-100 p-4 rounded-full mb-4">
                <AlertTriangle className="text-red-600" size={40} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Ops! Algo deu errado.</h3>
              <p className="text-gray-600 max-w-md mb-6">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="bg-green-700 text-white px-6 py-2 rounded-lg font-bold hover:bg-green-800 transition"
              >
                Tentar Novamente
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-8">
              {filteredProducts.length > 0 ? (
                filteredProducts.map(product => (
                  <div key={product.id} className="bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-200 overflow-hidden flex flex-col group relative">
                    
                    <div className="h-52 overflow-hidden relative">
                      <img 
                        src={product.image || 'https://via.placeholder.com/400x300?text=Sem+Imagem'} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition transform group-hover:scale-110 duration-700"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=Imagem+Indisponível';
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-60"></div>
                      
                      <div className="absolute bottom-3 right-3 bg-red-600 text-white px-3 py-1.5 rounded-lg text-lg font-bold shadow-lg border-2 border-white transform rotate-1 group-hover:rotate-0 transition">
                        {formatCurrency(product.price)}
                      </div>
                    </div>

                    <div className="p-5 flex flex-col flex-1">
                      <h3 className="text-xl font-bold text-gray-800 mb-2 group-hover:text-green-700 transition-colors font-serif">{product.name}</h3>
                      <p className="text-gray-500 text-sm mb-6 flex-1 leading-relaxed">{product.description}</p>
                      
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full bg-white text-green-700 border-2 border-green-600 py-2.5 rounded-xl font-bold hover:bg-green-600 hover:text-white transition-all flex items-center justify-center gap-2 active:scale-95 shadow-sm group-hover:shadow-md"
                      >
                        <Plus size={20} strokeWidth={3} /> ADICIONAR
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500 bg-white rounded-xl border border-dashed border-gray-200">
                  <Pizza className="mx-auto text-gray-300 mb-3" size={48} />
                  <p className="font-medium">Nenhum produto encontrado nesta categoria.</p>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <footer className="bg-green-900 text-white/80 border-t-4 border-red-600">
        <div className="max-w-4xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            
            <div className="space-y-4">
              <h3 className="text-white font-serif text-xl font-bold">Pizzaria Fratelli</h3>
              <div className="space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <MapPin size={16} className="text-red-400" /> Esmeraldas, MG
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={16} className="text-green-400" /> (31) 9 7314-1755
                </p>
                <p className="flex items-center gap-2">
                  <Clock size={16} className="text-yellow-400" /> Qua-Dom: {getBusinessHoursText()}
                </p>
              </div>
              
              <div className="pt-2">
                <p className="text-xs font-bold uppercase tracking-wider mb-2 text-white/60">Siga-nos</p>
                <div className="flex gap-4">
                  <a href="#" className="hover:text-white hover:scale-110 transition"><Instagram size={24} /></a>
                  <a href="#" className="hover:text-white hover:scale-110 transition"><Facebook size={24} /></a>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-white font-serif text-xl font-bold">Formas de Pagamento</h3>
              <ul className="space-y-3 text-sm">
                <li className="flex items-center gap-2">
                   <div className="bg-white/10 p-1.5 rounded"><CreditCard size={18} /></div>
                   Cartão de Crédito/Débito
                </li>
                <li className="flex items-center gap-2">
                   <div className="bg-white/10 p-1.5 rounded"><Banknote size={18} /></div>
                   Dinheiro
                </li>
                <li className="flex items-center gap-2">
                   <div className="bg-white/10 p-1.5 rounded"><Smartphone size={18} /></div>
                   PIX
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/10 text-center text-xs text-white/40">
            <p>&copy; 2024 PedeLogoUAI. Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>

      {/* MUDANÇA AQUI: Z-Index 50 para ficar acima do menu sticky */}
      <button
        onClick={() => setIsCartOpen(true)}
        className="fixed bottom-6 right-6 bg-gradient-to-r from-green-600 to-green-700 text-white p-4 rounded-full shadow-2xl hover:shadow-green-500/30 hover:scale-105 transition-all z-50 group active:scale-90 border-4 border-white"
      >
        <div className="relative">
          <ShoppingCart size={28} />
          {cartItems.length > 0 && (
            <span className="absolute -top-3 -right-3 bg-red-600 text-white text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full border-2 border-white shadow-sm animate-bounce">
              {cartItems.length}
            </span>
          )}
        </div>
      </button>

      <CartDrawer isOpen={isCartOpen} onClose={() => setIsCartOpen(false)} />
    </div>
  );
};

const App: React.FC = () => {
  return (
    <CartProvider>
      <MainContent />
    </CartProvider>
  );
};

export default App;