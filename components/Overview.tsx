
import React, { useMemo, useState } from 'react';
import { CreditCard, GlobalStats } from '../types';
import { CheckSquare, Square } from 'lucide-react';
import { getBankColor, getBankAvatarOuter, getMonthlySpend, isTempLimitValid } from '../constants';
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
  onOpenStatistics?: () => void;
}

export const Overview: React.FC<OverviewProps> = ({
    onSelectCard,
    onAddCard,
    onEditCard,
    onDeleteCard,
    onBatchDelete,
    onOpenSettings,
    onOpenStatistics
}) => {
  const cards = useAppStore(state => state.cards);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<'date' | 'limit' | 'unpaid'>('date');
  const [showManageMenu, setShowManageMenu] = useState(false);

  const stats: GlobalStats = useMemo(() => {
    let totalLimit = 0;
    let totalUnpaid = 0;
    let totalUnbilled = 0;
    let overdueCount = 0;

    cards.forEach(card => {
      totalLimit += card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0);
      totalUnpaid += card.currentUnpaid;
      totalUnbilled += card.currentUnbilled;
      if (card.status === 'overdue') overdueCount++;
    });

    const totalAvailable = totalLimit - totalUnpaid - totalUnbilled; 
    const availableRatio = totalLimit > 0 ? (totalAvailable / totalLimit) * 100 : 0;

    return { totalAvailable, totalUnpaid, totalLimit, totalUnbilled, availableRatio, overdueCount };
  }, [cards]);

  const monthlySpend = useMemo(() => getMonthlySpend(cards), [cards]);
  const spendChangePercent = monthlySpend.previous > 0
    ? ((monthlySpend.current - monthlySpend.previous) / monthlySpend.previous) * 100
    : null;

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

  const nearestRepaymentCard = useMemo(() => {
    const unpaidCards = cards.filter(c => c.status !== 'paid');
    if (unpaidCards.length === 0) return null;
    return unpaidCards.reduce((nearest, card) => {
      const d1 = calculateRemainingDays(card.repaymentDate);
      const d2 = calculateRemainingDays(nearest.repaymentDate);
      return d1 < d2 ? card : nearest;
    });
  }, [cards]);

  const reminders = useMemo(() => {
    const unpaidCards = cards
      .filter(c => c.status !== 'paid')
      .map(c => ({
        card: c,
        remainingDays: calculateRemainingDays(c.repaymentDate),
      }))
      .sort((a, b) => a.remainingDays - b.remainingDays);
    
    const paidCount = cards.filter(c => c.status === 'paid').length;
    return { unpaidCards, paidCount };
  }, [cards]);

  const nearestDays = nearestRepaymentCard
    ? calculateRemainingDays(nearestRepaymentCard.repaymentDate)
    : null;

  const toggleSelection = (id: string, e?: React.MouseEvent) => {
      if (e) e.stopPropagation();
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  return (
    <div className="flex flex-col h-full bg-[#F7F8FA] relative font-inter">
      {/* Main Header */}
      <header className="flex items-center justify-between px-5 pt-12 pb-4 bg-[#F7F8FA] sticky top-0 z-50 safe-area-top">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">首页</h1>
        <div className="flex items-center text-[#333] space-x-3">
          {isSelectionMode ? (
            <button onClick={() => {
              if (selectedIds.size > 0) {
                onBatchDelete(Array.from(selectedIds));
                exitSelectionMode();
              }
            }} className="flex items-center justify-center text-red-500">
              <span className="material-symbols-outlined text-[24px]">delete</span>
            </button>
          ) : (
            <>
              <button onClick={onOpenStatistics} className="flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">trending_up</span>
              </button>
              <button onClick={onOpenSettings} className="flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">settings</span>
              </button>
              <button onClick={() => setIsSelectionMode(true)} className="flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">checklist</span>
              </button>
              <button onClick={onAddCard} className="flex items-center justify-center">
                <span className="material-symbols-outlined text-[24px]">add_card</span>
              </button>
            </>
          )}
          {isSelectionMode && (
            <button onClick={exitSelectionMode} className="flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">close</span>
            </button>
          )}
        </div>
      </header>

      <main className="px-4 space-y-4 flex-1 overflow-y-auto pb-24 scroll-container safe-area-bottom">
        {/* Hero Card */}
        <section className="gradient-blue rounded-[20px] p-5 text-white shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-center">
            <div className="space-y-1">
              <p className="text-xs opacity-80">本期待还 (总未还)</p>
              <h2 className="text-[34px] font-bold leading-tight">{formatCurrency(stats.totalUnpaid)}</h2>
            </div>
            <div className="text-right">
              <p className="text-xs opacity-80">最近还款日</p>
              {nearestRepaymentCard ? (
                <>
                  <p className="text-sm font-medium">{nearestRepaymentCard.bankName} ({nearestRepaymentCard.cardNumber})</p>
                  <div className="flex items-baseline justify-end space-x-1 mt-1">
                    <span className="text-2xl font-bold">{formatRepaymentDate(nearestRepaymentCard.repaymentDate)}</span>
                    <span className="text-[10px] opacity-80">
                      ({nearestDays !== null && nearestDays > 0 ? `${nearestDays}天后` : '已逾期'})
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-sm font-medium opacity-70 mt-1">暂无待还款</p>
              )}
            </div>
          </div>
        </section>

        {/* Metrics Summary */}
        <section className="bg-white rounded-[20px] p-5 shadow-soft grid grid-cols-3 divide-x divide-gray-100">
          <div className="pr-3">
            <p className="text-[11px] text-[#999] mb-1">总可用额度</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{formatCurrency(stats.totalAvailable)}</p>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-[#999] mb-1">
                <span>可用比例</span>
                <span>{stats.availableRatio.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="bg-[#3A7CFE] h-full" style={{ width: `${Math.min(stats.availableRatio, 100)}%` }}></div>
              </div>
            </div>
          </div>
          <div className="px-3">
            <p className="text-[11px] text-[#999] mb-1">未出账金额</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{formatCurrency(stats.totalUnbilled)}</p>
            <div className="mt-2">
              <div className="flex justify-between text-[10px] text-[#999] mb-1">
                <span>占总额度</span>
                <span>{stats.totalLimit > 0 ? ((stats.totalUnbilled / stats.totalLimit) * 100).toFixed(1) : '0.0'}%</span>
              </div>
              <div className="w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                <div className="bg-[#3A7CFE] h-full" style={{ width: `${Math.min(stats.totalLimit > 0 ? (stats.totalUnbilled / stats.totalLimit) * 100 : 0, 100)}%` }}></div>
              </div>
            </div>
          </div>
          <div className="pl-3">
            <p className="text-[11px] text-[#999] mb-1">本月支出</p>
            <p className="text-lg font-bold text-[#1A1A1A]">{formatCurrency(monthlySpend.current)}</p>
            <div className="mt-2">
              {spendChangePercent !== null ? (
                <div className="flex items-center text-[10px] text-red-500">
                  <span>较上月 {spendChangePercent > 0 ? '+' : ''}{spendChangePercent.toFixed(1)}%</span>
                  <svg className="w-2 h-2 ml-1" fill="currentColor" viewBox="0 0 20 20">
                    <path clipRule="evenodd" d={spendChangePercent > 0 ? "M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" : "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"} fillRule="evenodd"></path>
                  </svg>
                </div>
              ) : (
                <span className="text-[10px] text-[#999]">--</span>
              )}
            </div>
          </div>
        </section>

        {/* Repayment Reminders */}
        <section>
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-[#1A1A1A]">还款提醒</h3>
          </div>
          <div className="space-y-2">
            {reminders.unpaidCards.slice(0, 2).map(({ card, remainingDays }) => {
              const isOverdue = remainingDays <= 0;
              const isUrgent = !isOverdue && remainingDays <= 3;
              return (
                <div key={card.id}
                  className={`rounded-xl p-3 flex items-center justify-between cursor-pointer active:opacity-70 transition ${
                    isOverdue ? 'warning-bg-light' : isUrgent ? 'warning-bg-light' : 'warning-bg-orange'
                  }`}
                  onClick={() => onSelectCard(card)}
                >
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path clipRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" fillRule="evenodd"></path>
                    </svg>
                    <span className={`text-xs font-medium ${isOverdue ? '' : ''}`}>
                      {isOverdue ? `已逾期${Math.abs(remainingDays)}天！` : `${remainingDays}天后需还款`}
                      <span className="font-bold"> {formatCurrency(card.currentUnpaid)}</span> ({card.bankName}{card.cardNumber})
                    </span>
                  </div>
                  <span className="text-xs font-bold opacity-80">{formatRepaymentDate(card.repaymentDate)}</span>
                </div>
              );
            })}
            {reminders.paidCount > 0 && (
              <div className="success-bg-light rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path clipRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" fillRule="evenodd"></path>
                  </svg>
                  <span className="text-xs font-medium">{reminders.paidCount}张卡已还清</span>
                </div>
                <button className="text-xs font-bold text-[#52C41A]">去查看</button>
              </div>
            )}
          </div>
        </section>

        {/* My Cards Section */}
        <section className="mt-6">
          <div className="flex justify-between items-center mb-3">
            <div className="flex items-center">
              <h3 className="text-lg font-bold text-[#1A1A1A]">我的信用卡</h3>
              <span className="text-xs text-[#999] ml-1 font-normal">({cards.length}张)</span>
            </div>
            <div className="relative flex items-center space-x-3 text-[#999]">
              <button onClick={() => setShowManageMenu(!showManageMenu)} className="text-xs">排序方式</button>
              {showManageMenu && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowManageMenu(false)}></div>
                  <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border border-gray-100 py-1 min-w-[120px]">
                    <button onClick={() => { setSortType('date'); setShowManageMenu(false); }} className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${sortType === 'date' ? 'font-bold' : ''}`}>按还款日排序</button>
                    <button onClick={() => { setSortType('unpaid'); setShowManageMenu(false); }} className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${sortType === 'unpaid' ? 'font-bold' : ''}`}>按欠款额排序</button>
                    <button onClick={() => { setSortType('limit'); setShowManageMenu(false); }} className={`block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 ${sortType === 'limit' ? 'font-bold' : ''}`}>按额度排序</button>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {sortedCards.map((card) => {
              const available = card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0) - card.currentUnpaid - card.currentUnbilled;
              const availablePercent = card.fixedLimit > 0 ? (available / card.fixedLimit) * 100 : 0;
              const remainingDays = calculateRemainingDays(card.repaymentDate);
              const isSelected = isSelectionMode && selectedIds.has(card.id);
              const isPaid = card.status === 'paid';
              const isOverdue = card.status === 'overdue';
              const statusColor = isPaid ? '#52C41A' : isOverdue ? '#F5222D' : '#3A7CFE';
              const statusBadgeClass = isPaid ? 'status-badge-done' : isOverdue ? 'status-badge-overdue' : 'status-badge-pending';
              
              return (
                <article key={card.id}
                  onClick={(e) => isSelectionMode ? toggleSelection(card.id, e) : onSelectCard(card)}
                  className={`bg-white rounded-[20px] p-5 shadow-soft border-b-2 transition-all relative cursor-pointer active:scale-[0.98] ${
                    isSelected ? 'border-[#3A7CFE]' : 'border-transparent hover:border-[#3A7CFE]'
                  }`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center">
                      {isSelectionMode && (
                        <div onClick={(e) => toggleSelection(card.id, e)} className="cursor-pointer mr-3">
                          {isSelected ? <CheckSquare size={20} className="text-blue-500" /> : <Square size={20} className="text-gray-400" />}
                        </div>
                      )}
                      <div className={`w-10 h-10 rounded-full ${getBankAvatarOuter(card.bankName)} flex items-center justify-center ${isSelectionMode ? '' : 'mr-3'}`}>
                        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: getBankColor(card.bankName) }}>
                          <span className="text-white text-[10px] font-bold">{card.bankName.slice(0, 1)}</span>
                        </div>
                      </div>
                      {!isSelectionMode && (
                        <div>
                          <h4 className="font-bold text-[#1A1A1A]">{card.bankName}</h4>
                          <p className="text-[10px] text-[#999]">尾号 {card.cardNumber}</p>
                        </div>
                      )}
                    </div>
                    <div className="text-right">
                      <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${statusBadgeClass}`}>
                        {isPaid ? '已还清' : isOverdue ? '逾期' : '待还款'}
                      </span>
                      <div className={`mt-1 flex items-center justify-end`} style={{ color: statusColor }}>
                        <span className="text-sm font-bold">{formatRepaymentDate(card.repaymentDate)}</span>
                        {!isPaid && (
                          <span className="text-[10px] ml-1">({remainingDays > 0 ? `${remainingDays}天后` : '已逾期'})</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 items-end">
                    <div className="text-left">
                      <p className="text-[10px] text-[#999] mb-1">本期应还</p>
                      <p className={`text-sm font-bold`} style={{ color: statusColor }}>
                        {formatCurrency(card.currentUnpaid)}
                      </p>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-[#999] mb-1">可用额度</p>
                      <div className="flex items-baseline space-x-1">
                        <span className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(available)}</span>
                        <span className="text-[9px] text-[#999]">({availablePercent.toFixed(1)}%)</span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-[10px] text-[#999] mb-1">固定额度</p>
                      <p className="text-sm font-bold text-[#1A1A1A]">{formatCurrency(card.fixedLimit)}</p>
                    </div>
                  </div>
                  <div className="mt-3 w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                    <div className="h-full" style={{ backgroundColor: statusColor, width: `${Math.min(availablePercent, 100)}%` }}></div>
                  </div>
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#CCC]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path>
                    </svg>
                  </div>
                </article>
              );
            })}
          </div>
          {cards.length === 0 && (
            <div className="text-center py-10 text-[#999]">
              <p className="text-sm">暂无信用卡数据</p>
              <p className="text-xs mt-2">点击右上方 + 号添加</p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};
