
import React, { useMemo, useState } from 'react';
import { CreditCard, GlobalStats, RepaymentStatus } from '../types';
import { Trash2, CheckSquare, Square, X, Plus, Edit, Settings, PieChart, DollarSign } from 'lucide-react';
import { getBankTheme } from '../constants';
import { formatRepaymentDate, calculateRemainingDays } from '../utils/date';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface OverviewProps {
  onSelectCard: (card: CreditCard) => void;
  onAddCard: () => void;
  onEditCard: (card: CreditCard) => void;
  onDeleteCard: (id: string) => void;
  onBatchDelete: (ids: string[]) => void;
  onOpenSettings?: () => void;
  onOpenAnalysis?: () => void;
  onOpenFeeStats?: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
    onSelectCard,
    onAddCard,
    onEditCard,
    onDeleteCard,
    onBatchDelete,
    onOpenSettings,
    onOpenAnalysis,
    onOpenFeeStats
}) => {
  const cards = useAppStore(state => state.cards);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<'date' | 'limit' | 'unpaid'>('date');

  const stats: GlobalStats = useMemo(() => {
    let totalLimit = 0;
    let totalUnpaid = 0;
    let totalUnbilled = 0;
    let overdueCount = 0;

    cards.forEach(card => {
      totalLimit += card.fixedLimit;
      totalUnpaid += card.currentUnpaid;
      totalUnbilled += card.currentUnbilled;
      if (card.status === 'overdue') overdueCount++;
    });

    const totalAvailable = totalLimit - totalUnpaid - totalUnbilled; 
    const availableRatio = totalLimit > 0 ? (totalAvailable / totalLimit) * 100 : 0;

    return { totalAvailable, totalUnpaid, totalLimit, totalUnbilled, availableRatio, overdueCount };
  }, [cards]);

  const sortedCards = useMemo(() => {
      const sorted = [...cards];
      if (sortType === 'date') {
        sorted.sort((a, b) => {
          const aIsPaid = a.status === 'paid';
          const bIsPaid = b.status === 'paid';
          if (aIsPaid && !bIsPaid) return 1;
          if (!aIsPaid && bIsPaid) return -1;
          return new Date(a.repaymentDate).getTime() - new Date(b.repaymentDate).getTime();
        });
      }
      else if (sortType === 'limit') sorted.sort((a, b) => b.fixedLimit - a.fixedLimit);
      else if (sortType === 'unpaid') sorted.sort((a, b) => b.currentUnpaid - a.currentUnpaid);
      return sorted;
  }, [cards, sortType]);

  const getStatusColor = (status: RepaymentStatus) => {
    switch (status) {
      case 'pending': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'overdue': return 'text-red-500 bg-red-50 border-red-200';
      case 'paid': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50';
    }
  };
  
  const getStatusLabel = (status: RepaymentStatus) => {
      switch(status) {
          case 'pending': return '待还款';
          case 'paid': return '已还款';
          case 'overdue': return '逾期';
          default: return status;
      }
  };




  const toggleSelection = (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 relative">
      <div className="sticky top-0 z-20 bg-gradient-to-r from-blue-700 to-indigo-800 text-white shadow-lg rounded-b-3xl pb-6 pt-4 safe-area-top transition-all">
        <div className="px-6 py-4">
          <div className="flex justify-between items-start mb-4">
             <div className="flex flex-col">
                <p className="text-blue-200 text-sm">总可用额度 (元)</p>
                <h1 className="text-3xl font-bold mt-1">{formatCurrency(stats.totalAvailable)}</h1>
             </div>
             <div className="flex gap-2 items-center">
                 {isSelectionMode ? (
                     <>
                        <button onClick={() => { onBatchDelete(Array.from(selectedIds)); setIsSelectionMode(false); setSelectedIds(new Set()); }} disabled={selectedIds.size === 0} className={`px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 transition ${selectedIds.size > 0 ? 'bg-red-500 text-white shadow-md' : 'bg-white/20 text-white/50 cursor-not-allowed'}`}><Trash2 size={14}/> 删除({selectedIds.size})</button>
                        <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }} className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"><X size={20}/></button>
                     </>
                 ) : (
                     <>
                        <button onClick={onOpenAnalysis} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition" title="账单分析"><PieChart size={20} /></button>
                        <button onClick={onOpenFeeStats} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition" title="手续费统计"><DollarSign size={20} /></button>
                        <button onClick={onOpenSettings} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition" title="数据管理"><Settings size={20} /></button>
                         {cards.length > 0 && <button onClick={() => setIsSelectionMode(true)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 active:scale-95 transition"><Trash2 size={20} /></button>}
                         <button onClick={onAddCard} className="p-2 rounded-full bg-white text-blue-700 shadow-md hover:bg-blue-50 active:scale-95 transition"><Plus size={20} /></button>
                     </>
                 )}
             </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-2">
             <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                <div className="flex justify-between">
                    <p className="text-blue-100 text-xs mb-1">总未还金额</p>
                    {stats.overdueCount > 0 && <span className="text-[10px] bg-red-500 px-1.5 rounded-full flex items-center">{stats.overdueCount} 逾期</span>}
                </div>
                <p className="text-lg font-semibold">{formatCurrency(stats.totalUnpaid)}</p>
             </div>
             <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm">
                <p className="text-blue-100 text-xs mb-1">未出账单总额</p>
                <p className="text-lg font-semibold">{formatCurrency(stats.totalUnbilled)}</p>
             </div>
          </div>
          
          <div className="mt-4 flex flex-col gap-1">
               <div className="flex items-center justify-between text-xs text-blue-200 px-1">
                 <span>可用比例</span>
                 <span>{stats.availableRatio.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full bg-blue-900/40 rounded-full overflow-hidden">
                 <div className={`h-full rounded-full ${stats.availableRatio < 20 ? 'bg-red-400' : 'bg-green-400'}`} style={{ width: `${Math.min(stats.availableRatio, 100)}%` }}></div>
              </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 scroll-container safe-area-bottom">
        <div className="flex items-center justify-between px-2 mb-2">
            <span className="text-xs text-gray-400">共 {cards.length} 张卡片</span>
            <div className="flex bg-white rounded-lg p-1 shadow-sm border border-gray-100">
                <button onClick={() => setSortType('date')} className={`px-3 py-1 rounded-md text-xs font-medium transition ${sortType === 'date' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>还款日</button>
                <button onClick={() => setSortType('unpaid')} className={`px-3 py-1 rounded-md text-xs font-medium transition ${sortType === 'unpaid' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>欠款</button>
                <button onClick={() => setSortType('limit')} className={`px-3 py-1 rounded-md text-xs font-medium transition ${sortType === 'limit' ? 'bg-blue-50 text-blue-600' : 'text-gray-500'}`}>额度</button>
            </div>
        </div>

        {sortedCards.map((card, idx) => {
          const available = card.fixedLimit - card.currentUnpaid - card.currentUnbilled;
          const availablePercent = card.fixedLimit > 0 ? (available / card.fixedLimit) * 100 : 0;
          const remainingDays = calculateRemainingDays(card.repaymentDate);
          return (
            <div key={card.id} style={{ animationDelay: `${idx * 50}ms` }} onClick={(e) => isSelectionMode ? toggleSelection(card.id, e) : onSelectCard(card)} className={`bg-white rounded-2xl p-4 shadow-sm border transition-all duration-200 relative overflow-hidden group animate-in slide-in-from-bottom-4 fade-in fill-mode-backwards ${isSelectionMode && selectedIds.has(card.id) ? 'border-blue-500 bg-blue-50/30' : 'border-gray-100 active:scale-[0.98]'}`}>
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-3">
                  {isSelectionMode ? (
                      <div onClick={(e) => toggleSelection(card.id, e)} className="text-blue-600 cursor-pointer">{selectedIds.has(card.id) ? <CheckSquare size={24} /> : <Square size={24} />}</div>
                  ) : (
                      <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${getBankTheme(card.bankName)} text-white flex items-center justify-center font-bold text-lg shadow-md`}>{card.bankName.slice(0,1)}</div>
                  )}
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg">{card.bankName}</h3>
                    <p className="text-sm text-gray-500 font-medium">{card.holderName} | <span className="font-mono text-gray-400">{card.cardNumber}</span></p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className={`text-xs px-2 py-1 rounded-md border font-medium ${getStatusColor(card.status)}`}>{getStatusLabel(card.status)}</div>
                    {!isSelectionMode && (
                        <div className="flex gap-1 ml-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); onEditCard(card); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-full transition"><Edit size={16} /></button>
                            <button onClick={(e) => { e.stopPropagation(); onDeleteCard(card.id); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition"><Trash2 size={16} /></button>
                        </div>
                    )}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 py-3 border-t border-gray-50">
                <div className="flex flex-col"><span className="text-[10px] text-gray-400">可用额度</span><span className="text-sm font-bold text-green-600">{formatCurrency(available)}</span></div>
                <div className="flex flex-col text-right"><span className="text-[10px] text-gray-400">固定额度</span><span className="text-sm font-bold text-gray-700">{formatCurrency(card.fixedLimit)}</span></div>
                <div className="flex flex-col"><span className="text-[10px] text-gray-400">本期账单 (未还)</span><span className="text-sm font-bold text-gray-800">{formatCurrency(card.currentUnpaid)}</span></div>
                <div className="flex flex-col text-right"><span className="text-[10px] text-gray-400">还款日</span><span className={`text-sm font-bold ${remainingDays < 3 ? 'text-red-500' : 'text-blue-600'}`}>{formatRepaymentDate(card.repaymentDate)} ({remainingDays > 0 ? `${remainingDays}天` : '已过'})</span></div>
              </div>
              <div className="absolute bottom-0 left-0 h-1 bg-gray-100 w-full">
                 <div className={`h-full ${availablePercent < 10 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${Math.min(availablePercent, 100)}%`}}></div>
              </div>
            </div>
          );
        })}
        {cards.length === 0 && <div className="text-center py-10 text-gray-400"><p>暂无信用卡数据</p><p className="text-xs mt-2">点击右上方 + 号添加</p></div>}
        <div className="text-center py-6 text-gray-400 text-sm">{cards.length > 0 && "-- 没有更多卡片了 --"}</div>
      </div>
    </div>
  );
};
