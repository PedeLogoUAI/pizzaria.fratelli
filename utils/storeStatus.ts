import { BUSINESS_HOURS } from '../constants';

export const isStoreOpen = (): boolean => {
  // Developer override check
  const override = localStorage.getItem('FORCE_STORE_STATUS');
  if (override === 'OPEN') return true;
  if (override === 'CLOSED') return false;

  if (!BUSINESS_HOURS.ENABLED) return true;

  const now = new Date();
  const currentHour = now.getHours();

  // Verifica se está entre o horário de abertura (inclusivo) e fechamento (exclusivo)
  // Ex: se fecha as 23h, funciona até 22:59:59
  return currentHour >= BUSINESS_HOURS.OPEN_HOUR && currentHour < BUSINESS_HOURS.CLOSE_HOUR;
};

export const getBusinessHoursText = (): string => {
  return `${BUSINESS_HOURS.OPEN_HOUR}h às ${BUSINESS_HOURS.CLOSE_HOUR}h`;
};