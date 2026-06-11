import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction, InstallmentPlan } from '../types';
import { ArrowLeft, Edit, Wallet, PlusCircle, Sliders, ChevronDown, CreditCard as CardIcon, Trash2, Landmark, TrendingDown, TrendingUp } from 'lucide-react';
import { generateBillingCycles, getBankTheme } from '../constants';
import { formatDate } from '../utils/date';
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

  const available = card.fixedLimit - card.currentUnpaid - card.currentUnbilled;
  const themeGradient = getBankTheme(card.bankName);
  const themeColor = useMemo(() => {
    // Extract the first color class from the gradient for the theme
    if (themeGradient.includes('red')) return '#dc2626';
    if (themeGradient.includes('blue')) return '#2563eb';
    if (themeGradient.includes('emerald')) return '#059669';
    if (themeGradient.includes('orange')) return '#ea580c';
    if (themeGradient.includes('indigo')) return '#4f46e5';
    if (themeGradient.includes('cyan')) return '#0891b2';
    if (themeGradient.includes('yellow')) return '#ca8a04';
    if (themeGradient.includes('pink')) return '#db2777';
    if (themeGradient.includes('green')) return '#16a34a';
    return '#1d4ed8';
  }, [themeGradient]);

  const currentCycle = cycles.find(c => c.key === selectedCycleKey) || cycles[0];

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

  const unbilledCycle = cycles.find(c => c.key === 'unbilled');
  const cycleStats = useMemo(() => {
      let totalConsumption = 0;
      let totalRepayment = 0;
      let actualReceipt = 0;
      if (unbilledCycle) {
          card.transactions.forEach(tx => {
              const txDate = new Date(tx.date);
              txDate.setHours(0, 0, 0, 0);
              if (txDate >= unbilledCycle.start && txDate <= unbilledCycle.end) {
                  if (tx.type === 'consumption') {
                      totalConsumption += Math.abs(tx.amount);
                      actualReceipt += (tx.actualReceipt || 0);
                  } else if (tx.type === 'repayment') {
                      totalRepayment += Math.abs(tx.amount);
                  }
              }
          });
      }
      return { totalConsumption, totalRepayment, actualReceipt };
  }, [card.transactions, unbilledCycle]);

  const repaymentInfo = useMemo(() => {
      if (card.currentUnpaid <= 0) return null;
      const today = new Date();
      today.setHours(0,0,0,0);
      const repaymentDate = new Date(card.repaymentDate);
      repaymentDate.setHours(0,0,0,0);
      const diffTime = repaymentDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return { days: diffDays, amount: card.currentUnpaid };
  }, [card.currentUnpaid, card.repaymentDate]);

  const billDay = `每月 ${card.billDay} 日`;
  const repaymentDay = (() => {
    if (card.repaymentConfig.type === 'fixed_day') return `每月 ${card.repaymentConfig.value} 日`;
    return `账单日后 ${card.repaymentConfig.value} 天`;
  })();

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* ===== HEADER SECTION ===== */}
      <div className={`bg-gradient-to-br ${themeGradient} sticky top-0 z-30 shadow-lg text-white safe-area-top`}>
        <div className="pt-3 pb-1 px-5 relative overflow-hidden">
          {/* Background Watermark */}
          <div className="absolute right-[-20px] top-8 opacity-10 text-8xl font-bold select-none pointer-events-none">
            {card.bankName.substring(0, 2)}
          </div>

          {/* Top Bar: Back, Title, Edit/Delete */}
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center space-x-3">
              <button onClick={onBack} className="hover:bg-white/10 rounded-full transition p-1">
                <ArrowLeft size={20} />
              </button>
              <h1 className="text-lg font-medium">{card.bankName} | {card.holderName}</h1>
            </div>
            <div className="flex space-x-4 items-center">
              <button onClick={() => onEdit(card)} className="flex items-center space-x-1 text-xs opacity-90 hover:opacity-100 transition">
                <Edit size={14} />
                <span>编辑</span>
              </button>
              <button onClick={() => setShowDeleteConfirm('card')} className="opacity-90 hover:opacity-100 transition">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          {/* Main Balances */}
          <div className="grid grid-cols-2 gap-4 mb-3">
            <div>
              <div className="flex items-center space-x-2 text-xs opacity-80 mb-1">
                <span>当期未还</span>
                {repaymentInfo && (
                  <span className={`bg-white bg-opacity-20 px-1.5 py-0.5 rounded ${repaymentInfo.days < 0 ? 'bg-red-500' : ''} text-white font-bold`} style={{fontSize: '9px'}}>
                    {repaymentInfo.days < 0 ? `逾期${Math.abs(repaymentInfo.days)}天` : `剩${repaymentInfo.days}天`}
                  </span>
                )}
              </div>
              <div className="text-3xl font-bold tracking-tight">{formatCurrency(card.currentUnpaid)}</div>
            </div>
            <div className="text-right">
              <div className="text-xs opacity-80 mb-1">可用额度</div>
              <div className="text-3xl font-bold tracking-tight">{formatCurrency(available)}</div>
            </div>
          </div>

          {/* Current Bill + Data Grid */}
          <div className="mb-4 space-y-4">
            <div className="flex justify-between items-end border-b border-white border-opacity-20 pb-3">
              <span className="text-sm font-semibold opacity-90">当期账单</span>
              <span className="text-xl font-bold tracking-wide">{formatCurrency(card.currentUnpaid)}</span>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs">
              <div className="flex justify-between items-center">
                <span className="opacity-70 font-medium">未出账单总额</span>
                <span className="font-semibold">{formatCurrency(card.currentUnbilled)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 font-medium">本期消费</span>
                <span className="font-semibold">-{formatCurrency(cycleStats.totalConsumption)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 font-medium">本期还款</span>
                <span className="font-semibold text-green-300">+{formatCurrency(cycleStats.totalRepayment)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="opacity-70 font-medium">实际到账</span>
                <span className="font-semibold">{formatCurrency(cycleStats.actualReceipt)}</span>
              </div>
            </div>
          </div>

          {/* Bill / Repayment Info Bar */}
          <div className="flex justify-between items-center bg-black bg-opacity-10 rounded-lg px-4 py-2.5 mb-2" style={{fontSize: '10px'}}>
            <div className="flex space-x-5 opacity-90">
              <span>账单日 <span className="font-bold ml-1">{billDay}</span></span>
              <span>还款日 <span className="font-bold ml-1">{repaymentDay}</span></span>
            </div>
            <span>最低还款额 <span className="font-bold ml-1 text-sm">{formatCurrency(Math.round(card.currentUnpaid * 0.1))}</span></span>
          </div>
        </div>
      </div>

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 overflow-y-auto px-4 pb-24 scroll-container safe-area-bottom -mt-1 relative z-10 space-y-3">

        {/* Quick Action Grid */}
        <div className="bg-white rounded-xl shadow-sm p-4 grid grid-cols-4 gap-2 border border-gray-100">
          <button onClick={() => onQuickAction('adjust_unpaid', card)} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mb-2 text-blue-500 active:scale-90 transition">
              <Sliders size={22} />
            </div>
            <span className="text-[10px] text-gray-600 font-medium">调剩余未还</span>
          </button>
          <button onClick={() => onQuickAction('adjust_limit', card)} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-orange-50 flex items-center justify-center mb-2 text-orange-500 active:scale-90 transition">
              <Edit size={22} />
            </div>
            <span className="text-[10px] text-gray-600 font-medium">提升固定额</span>
          </button>
          <button onClick={() => onQuickAction('adjust_available', card)} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-green-50 flex items-center justify-center mb-2 text-green-500 active:scale-90 transition">
              <Wallet size={22} />
            </div>
            <span className="text-[10px] text-gray-600 font-medium">调可用额度</span>
          </button>
          <button onClick={() => setShowInstallmentForm(true)} className="flex flex-col items-center">
            <div className="w-12 h-12 rounded-full bg-purple-50 flex items-center justify-center mb-2 text-purple-500 active:scale-90 transition">
              <Landmark size={22} />
            </div>
            <span className="text-[10px] text-gray-600 font-medium">分期管理</span>
          </button>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">固定额度</p>
            <p className="text-lg font-bold text-gray-800">{formatCurrency(card.fixedLimit)}</p>
          </div>
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 mb-1">卡号后四位</p>
            <p className="text-lg font-bold text-gray-800 font-mono">{card.cardNumber || '----'}</p>
          </div>
        </div>

        {/* Installment Plans */}
        <InstallmentPlanView cardId={card.id} onOpenSettlement={setSettlementTarget} />

        {/* Transaction Controls */}
        <div className="flex items-center space-x-2">
          <div className="flex bg-gray-200 bg-opacity-50 p-1 rounded-lg flex-shrink-0">
            <button
              onClick={() => setFilterType('all')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex-shrink-0 transition ${filterType === 'all' ? 'bg-white shadow-sm' : 'text-gray-500 font-medium'}`}
            >全部</button>
            <button
              onClick={() => setFilterType('consumption')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex-shrink-0 transition ${filterType === 'consumption' ? 'bg-white shadow-sm' : 'text-gray-500 font-medium'}`}
            >消费</button>
            <button
              onClick={() => setFilterType('repayment')}
              className={`px-4 py-1.5 rounded-md text-xs font-semibold flex-shrink-0 transition ${filterType === 'repayment' ? 'bg-white shadow-sm' : 'text-gray-500 font-medium'}`}
            >还款</button>
          </div>
        </div>

        <div className="relative">
          <select
            value={selectedCycleKey}
            onChange={(e) => setSelectedCycleKey(e.target.value)}
            className="w-full bg-white border-none rounded-xl py-3 px-4 text-sm font-semibold shadow-sm appearance-none focus:ring-0"
          >
            {cycles.map(c => (
              <option key={c.key} value={c.key}>{c.label} {c.key === 'unbilled' ? '(未出)' : ''}</option>
            ))}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <ChevronDown size={16} className="text-gray-400" />
          </div>
        </div>

        {/* Transaction List */}
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-12 text-gray-400 text-xs bg-white rounded-xl border border-dashed">
            <Wallet size={32} className="mx-auto mb-3 opacity-15" />
            <p className="font-medium text-gray-500">{selectedCycleKey === 'unbilled' ? '暂无未出账单记录' : '该账单周期无记录'}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTransactions.map((tx) => (
              <div key={tx.id} className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 group">
                <div className="flex items-start justify-between">
                  <div className="flex space-x-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                      tx.type === 'repayment' ? 'bg-green-50 text-green-400' :
                      tx.type === 'loan_bill' || tx.type === 'installment_start' ? 'bg-yellow-50 text-yellow-500' :
                      'bg-orange-50 text-orange-400'
                    }`}>
                      {tx.type === 'repayment' ? <TrendingUp size={24} /> :
                       tx.type === 'loan_bill' || tx.type === 'installment_start' ? <Landmark size={24} /> :
                       <CardIcon size={24} />}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-800 text-base leading-tight">{tx.notes || tx.merchantType || '消费'}</h3>
                      <p className="text-xs text-gray-400 mt-0.5">{formatDate(tx.date)} · {tx.channel}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${tx.amount > 0 ? 'text-green-500' : 'text-gray-900'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                    </p>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded border font-medium ${tx.type === 'repayment' ? 'bg-green-50 text-green-400 border-green-100' : 'bg-orange-50 text-orange-400 border-orange-100'}`} style={{fontSize: '10px'}}>
                      {tx.merchantType || tx.channel}
                    </span>
                  </div>
                </div>

                {(tx.cost > 0 || tx.actualReceipt !== 0) && (
                  <div className="mt-4 pt-4 border-t border-gray-50 flex space-x-4">
                    {tx.cost > 0 && <p className="text-xs text-gray-400">手续费: {formatCurrency(tx.cost)}</p>}
                    {tx.actualReceipt !== 0 && <p className="text-xs text-orange-400 font-semibold" style={{color: themeColor}}>到账: {formatCurrency(tx.actualReceipt)}</p>}
                  </div>
                )}

                <div className="flex justify-end gap-3 mt-3 pt-2 border-t border-gray-50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => onEditTransaction(card, tx)} className="text-xs text-blue-500 flex items-center gap-0.5 hover:underline">修改</button>
                  <button onClick={() => { setPendingDeleteTxId(tx.id); setShowDeleteConfirm('transaction'); }} className="text-xs text-red-500 flex items-center gap-0.5 hover:underline">删除</button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="h-12"></div>
      </div>

      {/* Delete Confirm Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-800">确认删除</h3>
              <button onClick={() => { setShowDeleteConfirm(null); setPendingDeleteTxId(null); }} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                <span className="text-xl">×</span>
              </button>
            </div>
            <div className="p-4">
              <p className="text-gray-600 mb-6 text-sm">
                {showDeleteConfirm === 'card' ? '确定要删除这张信用卡吗？此操作不可恢复。' : '确定要删除这条交易记录吗？'}
              </p>
              <div className="flex gap-3">
                <button onClick={() => { setShowDeleteConfirm(null); setPendingDeleteTxId(null); }} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">取消</button>
                <button
                  onClick={() => {
                    if (showDeleteConfirm === 'card') onDeleteCard(card.id);
                    else if (pendingDeleteTxId) onDeleteTransaction(card, pendingDeleteTxId);
                    setShowDeleteConfirm(null); setPendingDeleteTxId(null);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-md"
                >确认删除</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showInstallmentForm && <InstallmentForm card={card} onClose={() => setShowInstallmentForm(false)} />}
      {settlementTarget && <EarlySettlementModal plan={settlementTarget} onClose={() => setSettlementTarget(null)} />}

      {/* Floating Action Button */}
      <button
        onClick={() => onAddTransaction(card)}
        className="fixed bottom-6 right-4 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg shadow-blue-600/30 flex items-center justify-center active:scale-90 transition z-50"
      >
        <PlusCircle size={28} />
      </button>
    </div>
  );
};
