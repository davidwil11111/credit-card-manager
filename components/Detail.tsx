import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction } from '../types';
import { ArrowLeft, Edit, Wallet, PlusCircle, Sliders, ChevronDown, CreditCard as CardIcon, Trash2 } from 'lucide-react';
import { generateBillingCycles, getBankTheme } from '../constants';
import { formatDate } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

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
  
  // Generate Cycles (Memoized based on billDay)
  const rawCycles = useMemo(() => generateBillingCycles(card.billDay), [card.billDay]);

  // Process cycles to rename labels dynamically based on Card Status
  const cycles = useMemo(() => {
      return rawCycles.map(c => {
          // If this is the "Last Statement" (cycle-0) and it has unpaid balance
          if (c.key === 'cycle-0' && card.currentUnpaid > 0) {
              return { ...c, label: `当期未还 (${c.label})` };
          }
          return c;
      });
  }, [rawCycles, card.currentUnpaid]);
  
  // Default Selection Logic: Always default to Unbilled (current billing cycle)
  const [selectedCycleKey, setSelectedCycleKey] = useState<string>('unbilled');

  // Available = Fixed - Unpaid - Unbilled
  const available = card.fixedLimit - card.currentUnpaid - card.currentUnbilled;
  const themeGradient = getBankTheme(card.bankName);

  // Find currently selected cycle object
  const currentCycle = cycles.find(c => c.key === selectedCycleKey) || cycles[0];
  const isUnbilled = currentCycle.key === 'unbilled';

  // Filter Transactions based on selected Cycle
  const filteredTransactions = useMemo(() => {
      return card.transactions.filter(tx => {
        const txDate = new Date(tx.date);
        txDate.setHours(0, 0, 0, 0); 
        
        // Check date range strictly
        if (txDate < currentCycle.start || txDate > currentCycle.end) return false;

        // Filter by Type
        if (filterType === 'all') return true;
        if (filterType === 'consumption') return tx.type === 'consumption';
        if (filterType === 'repayment') return tx.type === 'repayment';
        
        return true;
      });
  }, [card.transactions, currentCycle, filterType]);

  // --- Statistics for Current Cycle ---
  // Find unbilled cycle for top stats display
  const unbilledCycle = cycles.find(c => c.key === 'unbilled');
  
  const cycleStats = useMemo(() => {
      let totalConsumption = 0;
      let totalRepayment = 0;
      let actualReceipt = 0;
      let count = 0;

      // Use unbilled cycle for top stats display
      if (unbilledCycle) {
          card.transactions.forEach(tx => {
              const txDate = new Date(tx.date);
              txDate.setHours(0, 0, 0, 0);
              
              // Only count transactions in unbilled range
              if (txDate >= unbilledCycle.start && txDate <= unbilledCycle.end) {
                  if (tx.type === 'consumption') {
                      totalConsumption -= tx.amount;
                      actualReceipt += (tx.actualReceipt || 0);
                      count++;
                  } else if (tx.type === 'repayment') {
                      totalRepayment += Math.abs(tx.amount);
                  }
              }
          });
      }

      return { totalConsumption, totalRepayment, actualReceipt, count };
  }, [card.transactions, unbilledCycle]);


  // Calculate Overdue Info for the CURRENT UNPAID BILL (cycle-0)
  const repaymentInfo = useMemo(() => {
      if (card.currentUnpaid <= 0) return null;
      
      const today = new Date();
      today.setHours(0,0,0,0);
      const repaymentDate = new Date(card.repaymentDate);
      repaymentDate.setHours(0,0,0,0);
      
      const diffTime = repaymentDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      return {
          days: diffDays, // negative means overdue
          amount: card.currentUnpaid
      };
  }, [card.currentUnpaid, card.repaymentDate]);

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      {/* 1. Header (Fixed/Sticky) with Dynamic Gradient */}
      <div className={`bg-gradient-to-br ${themeGradient} sticky top-0 z-30 shadow-lg text-white safe-area-top`}>
         <div className="p-4 pb-4 rounded-b-[2rem] pointer-events-auto relative overflow-hidden transition-colors duration-500">
            
            {/* Background Watermark */}
            <div className="absolute -right-4 top-10 opacity-10 pointer-events-none select-none">
                 <span className="text-8xl font-black">{card.bankName.substring(0,2)}</span>
            </div>

            <div className="flex items-center justify-between mb-2 relative z-10">
               <button onClick={onBack} className="p-3 -ml-3 hover:bg-white/10 rounded-full transition backdrop-blur-sm">
                  <ArrowLeft size={24} />
               </button>
               <h1 className="font-bold text-lg opacity-90">{card.bankName} | {card.holderName}</h1>
               <div className="flex gap-1">
                  <button onClick={() => onEdit(card)} className="p-2 -mr-1 hover:bg-white/10 rounded-full transition text-sm flex items-center gap-1 backdrop-blur-sm">
                     <Edit size={16} /> 编辑
                  </button>
                  <button onClick={() => setShowDeleteConfirm('card')} className="p-2 hover:bg-white/10 rounded-full transition backdrop-blur-sm">
                     <Trash2 size={16} />
                  </button>
               </div>
            </div>

            {/* Main Header Stats (Refactored Layout) */}
            <div className="grid grid-cols-2 gap-4 mb-4 relative z-10 animate-in fade-in zoom-in-95 duration-300 px-2 mt-2">
               {/* Left: Current Unpaid */}
               <div className="flex flex-col relative">
                   <div className="flex items-center gap-2 mb-1">
                        <span className="text-white/70 text-xs">当期未还</span>
                        {repaymentInfo && (
                           <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold backdrop-blur-md border border-white/10 ${
                               repaymentInfo.days < 0 ? 'bg-red-500 text-white' : 'bg-white/20 text-white'
                           }`}>
                               {repaymentInfo.days < 0 ? `逾期${Math.abs(repaymentInfo.days)}天` : `剩${repaymentInfo.days}天`}
                           </span>
                        )}
                   </div>
                   <span className="text-3xl font-bold tracking-tight">{formatCurrency(card.currentUnpaid)}</span>
               </div>

               {/* Right: Available */}
               <div className="flex flex-col items-end relative">
                   <span className="text-white/70 text-xs mb-1">可用额度</span>
                   <span className="text-3xl font-bold tracking-tight">{formatCurrency(available)}</span>
               </div>
            </div>

            {/* Cycle Selector & Cycle Stats */}
            <div className="bg-white/10 backdrop-blur-md rounded-xl p-3 border border-white/10 relative z-10 animate-in slide-in-from-bottom-2 duration-500">
                <div className="grid grid-cols-4 gap-2 text-center">
                    <div>
                        <p className="text-[10px] text-white/60 mb-0.5">未出账单总额</p>
                        <p className="font-bold text-base">{formatCurrency(card.currentUnbilled)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-white/60 mb-0.5">本期消费</p>
                        <p className="font-bold text-base">{formatCurrency(cycleStats.totalConsumption)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-white/60 mb-0.5">本期还款</p>
                        <p className="font-bold text-base text-green-300">{formatCurrency(cycleStats.totalRepayment)}</p>
                    </div>
                    <div>
                        <p className="text-[10px] text-white/60 mb-0.5">实际到账</p>
                        <p className="font-bold text-base text-orange-200">{formatCurrency(cycleStats.actualReceipt)}</p>
                    </div>
                </div>
            </div>
         </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-10 scroll-container safe-area-bottom">
         
         {/* 2. Quick Actions */}
         <div className="mx-4 -mt-2 bg-white rounded-xl shadow-lg shadow-gray-200/50 p-4 relative z-20 mb-4 animate-in slide-in-from-bottom-4 duration-500 delay-100">
             <div className="grid grid-cols-3 gap-2 text-center">
                 <button onClick={() => onQuickAction('adjust_unpaid', card)} className="flex flex-col items-center gap-2 p-1 active:bg-gray-50 rounded-lg group">
                     <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center group-active:scale-90 transition"><Sliders size={18}/></div>
                     <span className="text-[10px] text-gray-600 font-medium">调剩余未还</span>
                 </button>
                 <button onClick={() => onQuickAction('adjust_limit', card)} className="flex flex-col items-center gap-2 p-1 active:bg-gray-50 rounded-lg group">
                     <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center group-active:scale-90 transition"><Edit size={18}/></div>
                     <span className="text-[10px] text-gray-600 font-medium">提升固定额</span>
                 </button>
                 <button onClick={() => onQuickAction('adjust_available', card)} className="flex flex-col items-center gap-2 p-1 active:bg-gray-50 rounded-lg group">
                     <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center group-active:scale-90 transition"><Wallet size={18}/></div>
                     <span className="text-[10px] text-gray-600 font-medium">调可用额度</span>
                 </button>
             </div>
         </div>
         
         {/* 3. Basic Info Cards */}
         <div className="mx-4 grid grid-cols-2 gap-3 mb-4 animate-in slide-in-from-bottom-4 duration-500 delay-150">
             <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-400 mb-1">固定额度</p>
                 <p className="font-bold text-gray-800">{formatCurrency(card.fixedLimit)}</p>
             </div>
             <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                 <p className="text-xs text-gray-400 mb-1">卡号后四位</p>
                 <p className="font-bold text-gray-800 font-mono">{card.cardNumber}</p>
             </div>
         </div>

         {/* 4. Transaction Records with Cycle Selector */}
         <div className="px-4 animate-in slide-in-from-bottom-4 duration-500 delay-200">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                    <button 
                        onClick={() => setFilterType('all')}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterType === 'all' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >全部</button>
                    <button 
                        onClick={() => setFilterType('consumption')}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterType === 'consumption' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >消费</button>
                    <button 
                        onClick={() => setFilterType('repayment')}
                        className={`text-xs px-3 py-1.5 rounded-md font-bold transition ${filterType === 'repayment' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                    >还款</button>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <select 
                            value={selectedCycleKey}
                            onChange={(e) => setSelectedCycleKey(e.target.value)}
                            className="appearance-none bg-white text-gray-700 text-xs font-bold pr-6 pl-3 py-2 rounded-lg outline-none cursor-pointer border border-gray-200 hover:border-blue-300 transition shadow-sm min-w-[120px]"
                        >
                            {cycles.map(c => (
                                <option key={c.key} value={c.key} className="text-gray-800">
                                    {c.label} {c.key === 'unbilled' ? '(未出)' : ''}
                                </option>
                            ))}
                        </select>
                        <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>
                    <button 
                        onClick={() => onAddTransaction(card)}
                        className="text-xs font-bold text-white bg-blue-600 px-4 py-2 rounded-full flex items-center gap-1 shadow-md hover:bg-blue-700 active:scale-95 transition"
                    >
                        <PlusCircle size={14}/> 记一笔
                    </button>
                </div>
            </div>
            
            <div className="space-y-3">
               {filteredTransactions.length === 0 ? (
                   <div className="text-center py-10 text-gray-400 text-xs bg-white rounded-xl border border-dashed">
                       <Wallet size={24} className="mx-auto mb-2 opacity-20"/>
                       {currentCycle.key === 'unbilled' ? '暂无未出账单记录' : '该账单周期无记录'}
                   </div>
               ) : (
                   filteredTransactions.map((tx) => (
                      <div key={tx.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-50 group hover:border-gray-200 transition">
                         <div className="flex justify-between items-start mb-2">
                            <div className="flex gap-3">
                               <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                   tx.type === 'consumption' ? 'bg-orange-50 text-orange-500' :
                                   'bg-green-50 text-green-500'
                               }`}>
                                   {tx.type === 'consumption' ? <CardIcon size={18}/> : <Wallet size={18}/>}
                               </div>
                               <div>
                                   <div className="flex items-center gap-2 mb-0.5">
                                      <span className="font-bold text-gray-800 text-sm">{tx.notes || tx.merchantType}</span>
                                   </div>
                                   <p className="text-xs text-gray-400 flex items-center gap-1">
                                      {formatDate(tx.date)} · {tx.channel}
                                   </p>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className={`font-bold text-base ${
                                  tx.type === 'repayment' ? 'text-green-600' : 'text-gray-900'
                               }`}>
                                  {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                               </p>
                               <span className={`text-[10px] px-1.5 py-0.5 rounded border inline-block mt-1 ${
                                     tx.type === 'consumption' ? 'border-orange-100 text-orange-400 bg-orange-50/50' : 
                                     'border-green-100 text-green-500 bg-green-50/50'
                                  }`}>
                                     {tx.merchantType}
                               </span>
                            </div>
                         </div>
                         
                         <div className="flex justify-between items-center mt-3 pt-2 border-t border-gray-50 text-[10px] text-gray-400">
                            <div className="flex gap-3">
                               {tx.cost > 0 && <span className="text-gray-500 font-medium">手续费: ¥{tx.cost}</span>}
                               {tx.actualReceipt !== 0 && <span className="text-orange-500 font-medium">到账: ¥{tx.actualReceipt}</span>}
                            </div>
                            <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => onEditTransaction(card, tx)} className="text-blue-500 flex items-center gap-0.5 hover:underline">
                                    修改
                                </button>
                                <button onClick={() => { setPendingDeleteTxId(tx.id); setShowDeleteConfirm('transaction'); }} className="text-red-500 flex items-center gap-0.5 hover:underline">
                                    删除
                                </button>
                            </div>
                         </div>
                      </div>
                   ))
               )}
            </div>
         </div>

         <div className="h-12"></div>
      </div>

      {/* 删除确认弹窗 */}
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
    </div>
  );
};