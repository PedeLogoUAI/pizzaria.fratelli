export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

export const generateOrderId = (): string => {
  const now = new Date();
  const yy = now.getFullYear().toString().slice(-2);
  const mm = (now.getMonth() + 1).toString().padStart(2, '0');
  const dd = now.getDate().toString().padStart(2, '0');
  const hh = now.getHours().toString().padStart(2, '0');
  const min = now.getMinutes().toString().padStart(2, '0');
  const ss = now.getSeconds().toString().padStart(2, '0');
  const rr = Math.floor(Math.random() * 100).toString().padStart(2, '0');

  return `${yy}${mm}${dd}${hh}${min}${ss}${rr}`;
};

export const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('pt-BR').format(date);
};
