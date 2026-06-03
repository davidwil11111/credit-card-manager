import { create } from 'zustand';
import { CreditCard, Transaction, POSMachine, InstallmentPlan } from './types';
import { calculateCardStatus, getStatementRange, getTxLastBillDate, calculateRepaymentDateForBill, DEFAULT_POS_MACHINES, generateMockCards, clampDayToMonth } from './constants';
import { calculateInstallmentPlan, generateInstallmentTransactions, calculateEarlySettlement } from './utils/installment';
import { database } from './utils/database';
import { logger } from './utils/logger';
import { notifications } from './utils/notifications';

interface AppState {
  cards: CreditCard[];
  posMachines: POSMachine[];
  installmentPlans: InstallmentPlan[];
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
  handleCreateInstallmentPlan: (cardId: string, principal: number, annualRate: number, totalPeriods: number, startDate: string, notes?: string) => Promise<void>;
  handleSettleInstallmentPlan: (planId: string) => Promise<void>;
  handleDeleteInstallmentPlan: (planId: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  cards: [],
  posMachines: [],
  installmentPlans: [],
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

    const savedPlans = await database.getAllInstallmentPlans();
    if (savedPlans && savedPlans.length > 0) {
      set({ installmentPlans: savedPlans });
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

  handleCreateInstallmentPlan: async (cardId, principal, annualRate, totalPeriods, startDate, notes) => {
    const { cards } = get();
    const card = cards.find(c => c.id === cardId);
    if (!card) {
      logger.error('Installment plan: card not found', cardId);
      return;
    }

    const plan = calculateInstallmentPlan(principal, annualRate, totalPeriods, startDate, card.billDay, notes);
    plan.cardId = cardId;

    const txs = generateInstallmentTransactions(plan);
    // Give each transaction a unique id by appending an index
    txs.forEach((tx, i) => { tx.id = `${tx.id}_${i}`; });

    const newCards = cards.map(c => {
      if (c.id !== cardId) return c;
      return { ...c, transactions: [...txs, ...c.transactions] };
    });

    await get().saveData(newCards);
    await database.saveInstallmentPlan(plan);
    set({ installmentPlans: [...get().installmentPlans, plan] });
    logger.info('Installment plan created:', plan.id);
  },

  handleSettleInstallmentPlan: async (planId) => {
    const { installmentPlans } = get();
    const plan = installmentPlans.find(p => p.id === planId);
    if (!plan) return;

    const settlementDate = new Date().toISOString().split('T')[0];
    const settlement = calculateEarlySettlement(plan, settlementDate);

    const updatedPlan: InstallmentPlan = {
      ...plan,
      status: 'settled',
      settledDate: settlementDate,
      settledAmount: settlement.settlementAmount,
      periods: plan.periods.map(p => ({
        ...p,
        status: p.status === 'pending' ? 'paid' : p.status,
      })),
    };

    const newPlans = installmentPlans.map(p => p.id === planId ? updatedPlan : p);
    await database.saveInstallmentPlans(newPlans);
    set({ installmentPlans: newPlans });
    logger.info('Installment plan settled:', planId);
  },

  handleDeleteInstallmentPlan: async (planId) => {
    const { installmentPlans } = get();
    const plan = installmentPlans.find(p => p.id === planId);
    if (!plan) return;

    const newPlans = installmentPlans.filter(p => p.id !== planId);
    await database.saveInstallmentPlans(newPlans);
    set({ installmentPlans: newPlans });
    logger.info('Installment plan deleted:', planId);
  },
}));
