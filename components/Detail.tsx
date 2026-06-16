import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction, InstallmentPlan } from '../types';
import { generateBillingCycles, getBankDetailGradient, isTempLimitValid } from '../constants';
import { formatDate, calculateRemainingDays, formatRepaymentDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';
import { InstallmentForm } from './InstallmentForm';
import { InstallmentPlanView } from './InstallmentPlanView';
import { EarlySettlementModal } from './EarlySettlementModal';

interface DetailProps {
  onBack: () => void;
  onEdit: (card: CreditCard) => void;
  onAddTransaction: (card: CreditCard) => void;
  onEditTransaction: (card: CreditCard, tx: Transaction) => void;
  onDeleteTransaction: (card: CreditCard, txId: string) => void;
  onQuickAction: (action: string, card: CreditCard) => void;
  onDeleteCard: (id: string) => void;
}

export const Detail: React.FC<DetailProps> = ({
    onBack,
    onEdit,
    onAddTransaction,
    onEditTransaction,
    onDeleteTransaction,
    onQuickAction,
    onDeleteCard
}) => {
  const card = useAppStore(state => state.selectedCard);
  if (!card) return null;

  const [filterType, setFilterType] = useState<'all' | 'consumption' | 'repayment'>('all');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'card' | 'transaction' | null>(null);
  const [pendingDeleteTxId, setPendingDeleteTxId] = useState<string | null>(null);
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<InstallmentPlan | null>(null);
  const [showUsageDetail, setShowUsageDetail] = useState(false);
  
  const rawCycles = useMemo(() => generateBillingCycles(card.billDay), [card.billDay]);

  const cycles = useMemo(() => {
      return rawCycles.map(c => {
          if (c.key === 'cycle-0' && card.currentUnpaid > 0) {
              return { ...c, label: `当期未还 (${c.label})` };
          }
          return c;
      });
  }, [rawCycles, card.currentUnpaid]);
  
  const [selectedCycleKey, setSelectedCycleKey] = useState<string>('unbilled');

  const available = card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0) - card.currentUnpaid - card.currentUnbilled;
  const currentCycle = cycles.find(c => c.key === selectedCycleKey) || cycles[0];
  const isUnbilled = currentCycle.key === 'unbilled';

  const billDateDisplay = useMemo(() => {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, '0')}/${String(card.billDay).padStart(2, '0')}`;
  }, [card.billDay]);

  const repaymentDays = calculateRemainingDays(card.repaymentDate);

  const filteredTransactions = useMemo(() => {
      return card.transactions.filter(tx => {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0); 
        if (txDate < currentCycle.start || txDate > currentCycle.end) return false;
        if (filterType === 'all') return true;
        if (filterType === 'consumption') return tx.type === 'consumption';
        if (filterType === 'repayment') return tx.type === 'repayment';
        return true;
      });
  }, [card.transactions, currentCycle, filterType]);

  // Cycle stats for bill overview card
  const unbilledCycle = cycles.find(c => c.key === 'unbilled');
  
  const cycleStats = useMemo(() => {
      let totalConsumption = 0;
      let totalRepayment = 0;
      let actualReceipt = 0;
      let fee = 0;

      if (unbilledCycle) {
          card.transactions.forEach(tx => {
              const txDate = new Date(tx.date);
              txDate.setHours(0, 0, 0, 0);
              
              if (txDate >= unbilledCycle.start && txDate <= unbilledCycle.end) {
                  if (tx.type === 'consumption') {
                      totalConsumption += Math.abs(tx.amount);
                      actualReceipt += tx.actualReceipt || 0;
                      fee += tx.cost || 0;
                  } else if (tx.type === 'repayment') {
                      totalRepayment += Math.abs(tx.amount);
                  }
              }
          });
      }

      return { totalConsumption, totalRepayment, actualReceipt, fee };
  }, [card.transactions, unbilledCycle]);

  const repaymentInfo = useMemo(() => {
      if (card.currentUnpaid <= 0) return null;
      return { days: repaymentDays, amount: card.currentUnpaid };
  }, [card.currentUnpaid, repaymentDays]);

  const usagePercent = card.fixedLimit > 0
    ? ((card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0) - available) / (card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0))) * 100
    : 0;

  const bankGradient = getBankDetailGradient(card.bankName);

  return (
    <div className="flex flex-col h-full font-manrope">
      {/* HEADER SECTION */}
      <header className="text-white px-5 pt-12 pb-24 relative rounded-b-[2rem]" style={{
        background: `linear-gradient(180deg, ${bankGradient.start} 0%, ${bankGradient.end} 100%)`
      }}>
        <div className="flex items-center justify-between mb-8">
          <button onClick={onBack} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full">
            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
          </button>
          <h1 className="text-lg font-hanken font-semibold">{card.bankName} | {card.holderName}</h1>
          <div className="flex gap-2">
            <button onClick={() => onEdit(card)} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full">
              <span className="material-symbols-outlined text-xl text-white">edit_square</span>
            </button>
            <button onClick={() => setShowDeleteConfirm('card')} className="w-10 h-10 flex items-center justify-center bg-white/10 rounded-full">
              <span className="material-symbols-outlined text-xl text-white">delete</span>
            </button>
          </div>
        </div>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[12px] opacity-70 mb-1 font-hanken">当前未还</p>
            <div className="flex items-baseline gap-1">
              <span className="text-4xl font-bold font-hanken tracking-tight">{formatCurrency(card.currentUnpaid)}</span>
            </div>
            {repaymentInfo ? (
              <div className={`mt-2 inline-flex items-center px-2.5 py-0.5 text-[11px] rounded-full ${
                repaymentInfo.days < 0 ? 'bg-red-400/30 text-red-200' : 'bg-white/20 text-white/80'
              }`}>
                {repaymentInfo.days < 0 ? `逾期${Math.abs(repaymentInfo.days)}天` : `剩${repaymentInfo.days}天`}
              </div>
            ) : (
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 bg-green-400/20 text-green-300 text-[11px] rounded-full border border-green-400/30">
                已还清
              </div>
            )}
          </div>
          <div className="text-right">
            <p className="text-[12px] opacity-70 mb-1 font-hanken">可用额度</p>
            <p className="text-4xl font-bold font-hanken tracking-tight">{formatCurrency(available)}</p>
            <button onClick={() => setShowUsageDetail(!showUsageDetail)} className="mt-2 text-[11px] opacity-80 flex items-center justify-end gap-1 w-full font-medium">
              额度使用率 {usagePercent.toFixed(1)}%
              <span className="material-symbols-outlined text-[12px]">chevron_right</span>
            </button>
          </div>
        </div>

        {/* Usage Detail Panel */}
        {showUsageDetail && (
          <div className="mt-4 mx-2 bg-white/10 rounded-xl p-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-white/60">固定额度</p>
              <p className="font-semibold">{formatCurrency(card.fixedLimit)}</p>
            </div>
            <div>
              <p className="text-white/60">临时额度</p>
              <p className="font-semibold">{formatCurrency(card.tempLimit)}</p>
              {card.tempLimit > 0 && card.tempLimitExpiry && (
                <p className="text-[10px] text-white/50 mt-0.5">至 {card.tempLimitExpiry}</p>
              )}
            </div>
            <div>
              <p className="text-white/60">已用额度</p>
              <p className="font-semibold">{formatCurrency(card.currentUnpaid + card.currentUnbilled)}</p>
            </div>
            <div>
              <p className="text-white/60">可用额度</p>
              <p className="font-semibold">{formatCurrency(available)}</p>
            </div>
          </div>
        )}
      </header>

      {/* MAIN CONTENT */}
      <main className="flex-1 -mt-14 px-4 pb-24 space-y-4 z-10">
        {/* BILL OVERVIEW CARD */}
        <section className="bg-white rounded-2xl shadow-sm p-5 space-y-6">
          <div className="flex justify-between items-stretch">
            <div className="flex flex-col justify-between py-1">
              <div className="space-y-0.5">
                <p className="text-[12px] text-outline font-hanken">本期账单</p>
                <p className="text-[42px] font-bold font-hanken tracking-tighter leading-tight">
                  {formatCurrency(card.statementAmount)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[11px] text-outline">手续费</p>
                <p className="text-[13px] font-bold font-hanken">{formatCurrency(cycleStats.fee)}</p>
              </div>
            </div>
            <div className="w-px bg-surface-container-highest self-stretch mx-4"></div>
            <div className="flex-1 space-y-4">
              <div className="flex justify-between gap-12">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-outline">未出账单</p>
                  <p className="text-[13px] font-bold font-hanken">{formatCurrency(card.currentUnbilled)}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[11px] text-outline">本期消费</p>
                  <p className="text-[13px] font-bold font-hanken">{formatCurrency(cycleStats.totalConsumption)}</p>
                </div>
              </div>
              <div className="flex justify-between gap-12">
                <div className="space-y-0.5">
                  <p className="text-[11px] text-outline">本期还款</p>
                  <p className="text-[13px] font-bold font-hanken text-green-600">{formatCurrency(cycleStats.totalRepayment)}</p>
                </div>
                <div className="space-y-0.5 text-right">
                  <p className="text-[11px] text-outline">实际到账</p>
                  <p className="text-[13px] font-bold font-hanken">{formatCurrency(cycleStats.actualReceipt)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-xl p-3 flex justify-between items-center text-white" style={{ background: `${bankGradient.start}cc` }}>
            <div className="flex-1 text-center">
              <p className="text-[10px] opacity-80 mb-0.5 font-hanken uppercase tracking-wider">账单日</p>
              <p className="text-[13px] font-semibold font-hanken">{billDateDisplay}</p>
            </div>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex-1 text-center px-2">
              <p className="text-[10px] opacity-80 mb-0.5 font-hanken uppercase tracking-wider">还款日</p>
              <p className="text-[13px] font-semibold font-hanken">
                {formatRepaymentDate(card.repaymentDate)}
                <span className="text-[10px] font-normal opacity-60 ml-0.5">
                  ({repaymentDays > 0 ? `${repaymentDays}天后` : '已逾期'})
                </span>
              </p>
            </div>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex-1 text-center">
              <p className="text-[10px] opacity-80 mb-0.5 font-hanken uppercase tracking-wider">固定额度</p>
              <p className="text-[13px] font-semibold font-hanken">{formatCurrency(card.fixedLimit)}</p>
            </div>
          </div>
        </section>

        {/* QUICK ACTIONS */}
        <section className="bg-white rounded-2xl p-5 grid grid-cols-5 gap-2">
          <button onClick={() => onQuickAction('adjust_unpaid', card)} className="flex flex-col items-center gap-2 active:opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-blue-500 text-2xl">tune</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">调剩余未还</span>
          </button>
          <button onClick={() => onQuickAction('adjust_limit', card)} className="flex flex-col items-center gap-2 active:opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-orange-500 text-2xl">edit_note</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">提升固定额</span>
          </button>
          <button onClick={() => onQuickAction('adjust_available', card)} className="flex flex-col items-center gap-2 active:opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-emerald-500 text-2xl">account_balance_wallet</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">调可用额度</span>
          </button>
          <button onClick={() => onQuickAction('adjust_temp_limit', card)} className="flex flex-col items-center gap-2 active:opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-amber-500 text-2xl">schedule</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">临时额度</span>
          </button>
          <button onClick={() => setShowInstallmentForm(true)} className="flex flex-col items-center gap-2 active:opacity-70">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 flex items-center justify-center">
              <span className="material-symbols-outlined text-purple-500 text-2xl">account_balance</span>
            </div>
            <span className="text-[11px] text-on-surface-variant font-medium">分期管理</span>
          </button>
        </section>

        {/* Installment Plans */}
        <div>
          <InstallmentPlanView cardId={card.id} onOpenSettlement={setSettlementTarget} />
        </div>

        {/* TABS */}
        <div className="flex items-center gap-6 px-2 overflow-x-auto no-scrollbar">
          <button onClick={() => setFilterType('all')} className={`flex-shrink-0 px-4 py-2 text-sm font-bold rounded-lg shadow-sm transition ${
            filterType === 'all' ? 'bg-white text-primary shadow-sm' : 'text-outline font-medium'
          }`}>
            全部
          </button>
          <button onClick={() => setFilterType('consumption')} className={`flex-shrink-0 text-sm transition ${
            filterType === 'consumption' ? 'px-4 py-2 bg-white rounded-lg shadow-sm font-bold text-primary' : 'text-outline font-medium'
          }`}>
            消费
          </button>
          <button onClick={() => setFilterType('repayment')} className={`flex-shrink-0 text-sm transition ${
            filterType === 'repayment' ? 'px-4 py-2 bg-white rounded-lg shadow-sm font-bold text-primary' : 'text-outline font-medium'
          }`}>
            还款
          </button>
        </div>

        {/* TRANSACTION LIST */}
        <section className="space-y-3">
          {/* Cycle Selector Accordion */}
          <div className="relative">
            <select
              value={selectedCycleKey}
              onChange={(e) => setSelectedCycleKey(e.target.value)}
              className="w-full bg-white rounded-2xl p-4 text-[13px] font-semibold text-[#1A1A1A] outline-none appearance-none cursor-pointer shadow-sm pr-10"
            >
              {cycles.map(c => (
                <option key={c.key} value={c.key}>
                  {c.label}{c.key === 'unbilled' ? ' (未出)' : ''}
                </option>
              ))}
            </select>
            <span className="material-symbols-outlined text-outline absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">expand_more</span>
          </div>

          {/* Transaction Items */}
          <div className="space-y-2">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-10 text-outline text-xs">
                {isUnbilled ? '暂无未出账单记录' : '该账单周期无记录'}
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isRepayment = tx.type === 'repayment';
                const isConsumption = tx.type === 'consumption';
                return (
                  <div key={tx.id} className="bg-white rounded-2xl p-4 flex items-center gap-4 shadow-sm group">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isRepayment ? 'bg-emerald-100' :
                      isConsumption ? 'bg-orange-100' : 'bg-blue-100'
                    }`}>
                      {isRepayment ? (
                        <span className="material-symbols-outlined text-emerald-600">trending_up</span>
                      ) : isConsumption ? (
                        <span className="material-symbols-outlined text-orange-600">credit_card</span>
                      ) : (
                        <span className="material-symbols-outlined text-blue-600">shopping_bag</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-[15px] font-bold truncate">
                          {tx.notes || (isRepayment ? '新增还款' : tx.merchantType || '消费')}
                        </span>
                        <span className={`text-[17px] font-bold font-hanken shrink-0 ml-2 ${
                          isRepayment ? 'text-emerald-600' : 'text-[#1A1A1A]'
                        }`}>
                          {isRepayment ? '+\u00A5' : '-\u00A5'}{formatCurrency(tx.amount).replace('¥', '').replace('-', '')}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[11px] text-outline font-hanken">
                          {formatDate(tx.date)} &middot; {tx.channel}
                        </span>
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-sm uppercase tracking-wider ${
                          isRepayment ? 'bg-emerald-50 text-emerald-600' :
                          isConsumption ? 'bg-orange-50 text-orange-600' : 'bg-surface-container-highest text-outline'
                        }`}>
                          {tx.merchantType || (isRepayment ? '还款' : '消费')}
                        </span>
                      </div>
                    </div>
                    {/* Edit/Delete hover actions */}
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 shrink-0">
                      <button onClick={() => onEditTransaction(card, tx)} className="text-[10px] text-blue-500 hover:underline">
                        修改
                      </button>
                      <button onClick={() => { setPendingDeleteTxId(tx.id); setShowDeleteConfirm('transaction'); }} className="text-[10px] text-red-500 hover:underline">
                        删除
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      {/* FLOATING ACTION BUTTON */}
      <div className="fixed bottom-8 right-6 flex flex-col items-center gap-1.5 z-50">
        <button
          onClick={() => onAddTransaction(card)}
          className="w-14 h-14 shadow-lg rounded-full flex items-center justify-center text-white active:scale-95 transition-all"
          style={{ backgroundColor: bankGradient.start, boxShadow: `0 4px 16px ${bankGradient.start}40` }}
        >
          <span className="material-symbols-outlined text-3xl font-bold">add</span>
        </button>
        <span className="text-[11px] font-bold" style={{ color: bankGradient.start }}>记一笔</span>
      </div>

      {/* SAFE AREA SPACER */}
      <div className="safe-area-bottom h-4"></div>

      {/* Delete Confirm Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">确认删除</h3>
              <button onClick={() => { setShowDeleteConfirm(null); setPendingDeleteTxId(null); }} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                <span className="text-xl">&times;</span>
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-6 text-sm">
                {showDeleteConfirm === 'card' ? '确定要删除这张信用卡吗？此操作不可恢复。' : '确定要删除这条交易记录吗？'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(null); setPendingDeleteTxId(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
                  取消
                </button>
                <button 
                  onClick={() => {
                    if (showDeleteConfirm === 'card') {
                      onDeleteCard(card.id);
                    } else if (pendingDeleteTxId) {
                      onDeleteTransaction(card, pendingDeleteTxId);
                    }
                    setShowDeleteConfirm(null);
                    setPendingDeleteTxId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-md"
                >
                  确认删除
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Installment Form Modal */}
      {showInstallmentForm && (
        <InstallmentForm card={card} onClose={() => setShowInstallmentForm(false)} />
      )}

      {/* Early Settlement Modal */}
      {settlementTarget && (
        <EarlySettlementModal plan={settlementTarget} onClose={() => setSettlementTarget(null)} />
      )}
    </div>
  );
};
