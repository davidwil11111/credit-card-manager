import { create } from 'zustand';
import { CreditCard, Transaction, POSMachine } from './types';
import { calculateCardStatus, getStatementRange, getTxLastBillDate, calculateRepaymentDateForBill, DEFAULT_POS_MACHINES, generateMockCards, clampDayToMonth } from './constants';
import { database } from './utils/database';
import { logger } from './utils/logger';
import { notifications } from './utils/notifications';

interface AppState {
  cards: CreditCard[];
  posMachines: POSMachine[];
  selectedCard: CreditCard | null;
  notificationEnabled: boolean;

  setCards: (cards: CreditCard[]) => void;
  setSelectedCard: (card: CreditCard | null) => void;
  setNotificationEnabled: (enabled: boolean) => void;
  loadFromDatabase: () => Promise<void>;
  saveData: (newCards: CreditCard[]) => Promise<void>;
  handleTransactionSubmit: (txPartial: Partial<Transaction>, cardId: string) => Promise<void>;
  handleDeleteTransaction: (card: CreditCard, txId: string) => Promise<void>;
  processBillingLogic: () => Promise<void>;
  handleUpdatePOS: (machines: POSMachine[]) => Promise<void>;
  handleToggleNotification: (enabled: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: [],
  posMachines: [],
  selectedCard: null,
  notificationEnabled: false,

  setCards: (cards) => set({ cards }),
  setSelectedCard: (selectedCard) => set({ selectedCard }),
  setNotificationEnabled: (notificationEnabled) => set({ notificationEnabled }),

  loadFromDatabase: async () => {
    const savedPos = await database.getAllPosMachines();
    if (savedPos && savedPos.length > 0) {
      set({ posMachines: savedPos });
    } else {
      set({ posMachines: DEFAULT_POS_MACHINES });
      await database.savePosMachines(DEFAULT_POS_MACHINES);
    }

    const savedCards = await database.getAllCards();
    if (savedCards && savedCards.length > 0) {
      set({ cards: savedCards });
      get().processBillingLogic();
    } else {
      const data = generateMockCards(2);
      set({ cards: data });
      await get().saveData(data);
    }

    const config = notifications.getConfig();
    set({ notificationEnabled: config.enabled });
  },

  saveData: async (newCards) => {
    const updatedCards = newCards.map(c => ({
      ...c,
      status: calculateCardStatus(c.currentUnpaid, c.repaymentDate),
    }));
    set({ cards: updatedCards });
    try {
      await database.saveCards(updatedCards);
    } catch (error) {
      logger.error('Save failed:', error);
      alert('保存失败，请重试');
    }

    const { selectedCard } = get();
    if (selectedCard) {
      const current = updatedCards.find(c => c.id === selectedCard.id);
      if (current) set({ selectedCard: current });
    }
  },

  processBillingLogic: async () => {
    try {
      const currentCards = await database.getAllCards();
      if (currentCards.length === 0) return;

      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let hasChanges = false;
      const updatedCards = currentCards.map(card => {
        const currentMonthBillDate = new Date(now.getFullYear(), now.getMonth(), clampDayToMonth(now.getFullYear(), now.getMonth(), card.billDay));
        currentMonthBillDate.setHours(0, 0, 0, 0);

        let latestRelevantBillDate: Date;
        if (now.getDate() >= card.billDay) {
          latestRelevantBillDate = currentMonthBillDate;
        } else {
          latestRelevantBillDate = new Date(currentMonthBillDate);
          latestRelevantBillDate.setMonth(latestRelevantBillDate.getMonth() - 1);
        }

        const lastStatementTimestamp = card.lastStatementDate ? new Date(card.lastStatementDate).getTime() : 0;
        if (latestRelevantBillDate.getTime() > lastStatementTimestamp) {
          hasChanges = true;
          return {
            ...card,
            currentUnpaid: card.currentUnpaid + card.currentUnbilled,
            currentUnbilled: 0,
            lastStatementDate: latestRelevantBillDate.toISOString(),
            repaymentDate: calculateRepaymentDateForBill(latestRelevantBillDate, card.repaymentConfig),
          };
        }
        return card;
      });

      if (hasChanges) {
        await get().saveData(updatedCards);
      }
    } catch (error) {
      logger.error('Process billing logic failed:', error);
    }
  },

  handleTransactionSubmit: async (txPartial, cardId) => {
    const { cards } = get();

    const newCards = cards.map(c => {
      if (c.id !== cardId) return c;
      const up = { ...c };

      if (txPartial.id) {
        const oldTxIndex = up.transactions.findIndex(t => t.id === txPartial.id);
        if (oldTxIndex !== -1) {
          const oldTx = up.transactions[oldTxIndex];

          if (oldTx.type === 'consumption') {
            const txLastBill = getTxLastBillDate(oldTx.date, up.billDay);
            if (new Date(oldTx.date) > txLastBill) up.currentUnbilled -= Math.abs(oldTx.amount);
            else up.currentUnpaid -= Math.abs(oldTx.amount);
          } else if (oldTx.type === 'repayment') {
            up.currentUnpaid += Math.abs(oldTx.amount);
          }

          const newTx = { ...oldTx, ...txPartial, amount: txPartial.amount || oldTx.amount } as Transaction;

          if (newTx.type === 'consumption') {
            const { lastBillDateObj } = getStatementRange(up.billDay);
            if (new Date(newTx.date) > lastBillDateObj) up.currentUnbilled += Math.abs(newTx.amount);
            else up.currentUnpaid += Math.abs(newTx.amount);
          } else if (newTx.type === 'repayment') {
            up.currentUnpaid = Math.max(0, up.currentUnpaid - Math.abs(newTx.amount));
          }

          up.transactions = [...up.transactions];
          up.transactions[oldTxIndex] = newTx;
        }
      } else {
        const tx = { ...txPartial, id: `tx-${Date.now()}`, date: txPartial.date || new Date().toISOString() } as Transaction;

        if (tx.type === 'consumption') {
          const { lastBillDateObj } = getStatementRange(up.billDay);
          if (new Date(tx.date) > lastBillDateObj) up.currentUnbilled += Math.abs(tx.amount);
          else up.currentUnpaid += Math.abs(tx.amount);
        } else if (tx.type === 'repayment') up.currentUnpaid = Math.max(0, up.currentUnpaid - Math.abs(tx.amount));
        up.transactions = [tx, ...up.transactions];
      }

      return up;
    });

    await get().saveData(newCards);
  },

  handleDeleteTransaction: async (card, txId) => {
    const { cards } = get();
    const tx = card.transactions.find(t => t.id === txId);
    if (!tx) return;

    const newCards = cards.map(c => {
      if (c.id !== card.id) return c;
      const up = { ...c, transactions: c.transactions.filter(t => t.id !== txId) };

      if (tx.type === 'consumption') {
        const txLastBill = getTxLastBillDate(tx.date, up.billDay);
        if (new Date(tx.date) > txLastBill) up.currentUnbilled = Math.max(0, up.currentUnbilled - Math.abs(tx.amount));
        else up.currentUnpaid = Math.max(0, up.currentUnpaid - Math.abs(tx.amount));
      } else if (tx.type === 'repayment') {
        up.currentUnpaid += Math.abs(tx.amount);
      }

      return up;
    });
    await get().saveData(newCards);
  },

  handleUpdatePOS: async (machines) => {
    set({ posMachines: machines });
    try {
      await database.savePosMachines(machines);
    } catch (error) {
      logger.error('Update POS failed:', error);
    }
  },

  handleToggleNotification: (enabled) => {
    set({ notificationEnabled: enabled });
    notifications.saveConfig({ enabled });
    if (enabled) {
      notifications.checkAndNotify(get().cards);
    }
  },
}));
