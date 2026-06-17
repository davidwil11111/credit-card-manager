import React, { useMemo, useState } from 'react';
import { CreditCard, GlobalStats } from '../types';
import { CheckSquare, Square } from 'lucide-react';
import { getBankColor, getBankIcon, getMonthlySpend, isTempLimitValid } from '../constants';
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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return '上午好 \u{1F44B}';
  if (h < 18) return '下午好 \u{1F44B}';
  return '晚上好 \u{1F44B}';
}

export const Overview: React.FC<OverviewProps> = ({
    onSelectCard, onAddCard, onEditCard, onDeleteCard, onBatchDelete,
    onOpenSettings, onOpenStatistics
}) => {
  const cards = useAppStore(state => state.cards);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortType, setSortType] = useState<'date' | 'limit' | 'unpaid'>('date');
  const [showSortMenu, setShowSortMenu] = useState(false);

  const stats: GlobalStats = useMemo(() => {
    let totalLimit = 0, totalUnpaid = 0, totalUnbilled = 0, overdueCount = 0;
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
  const spendChangePercent = monthlySpend.previous > 0 ? ((monthlySpend.current - monthlySpend.previous) / monthlySpend.previous) * 100 : null;
  const spendIsUp = spendChangePercent !== null && spendChangePercent > 0;

  const sortedCards = useMemo(() => {
    const sorted = [...cards];
    if (sortType === 'date') {
      sorted.sort((a, b) => {
        if (a.status === 'paid' && b.status !== 'paid') return 1;
        if (a.status !== 'paid' && b.status === 'paid') return -1;
        return new Date(a.repaymentDate).getTime() - new Date(b.repaymentDate).getTime();
      });
    } else if (sortType === 'limit') sorted.sort((a, b) => b.fixedLimit - a.fixedLimit);
    else if (sortType === 'unpaid') sorted.sort((a, b) => b.currentUnpaid - a.currentUnpaid);
    return sorted;
  }, [cards, sortType]);

  const nearestCard = useMemo(() => {
    const unpaid = cards.filter(c => c.status !== 'paid');
    if (unpaid.length === 0) return null;
    return unpaid.reduce((n, c) => calculateRemainingDays(c.repaymentDate) < calculateRemainingDays(n.repaymentDate) ? c : n);
  }, [cards]);

  const reminders = useMemo(() => {
    const unpaid = cards.filter(c => c.status !== 'paid').map(c => ({ card: c, days: calculateRemainingDays(c.repaymentDate) })).sort((a, b) => a.days - b.days);
    const paidCount = cards.filter(c => c.status === 'paid').length;
    return { unpaid, paidCount };
  }, [cards]);

  const nearestDays = nearestCard ? calculateRemainingDays(nearestCard.repaymentDate) : null;
  const toggleSelection = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const ns = new Set(selectedIds); ns.has(id) ? ns.delete(id) : ns.add(id); setSelectedIds(ns);
  };
  const exitSelectionMode = () => { setIsSelectionMode(false); setSelectedIds(new Set()); };

  return (
    <div className="flex flex-col h-full bg-[#fdf7ff] font-inter">
      <header className="px-6 pt-12 pb-4 flex justify-between items-center safe-area-top">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">{getGreeting()}</h1>
          <p className="text-slate-500 text-xs mt-1">继续保持良好的还款习惯</p>
        </div>
        <div className="flex items-center gap-5">
          {isSelectionMode ? (
            <>
              <button onClick={() => { if (selectedIds.size > 0) { onBatchDelete(Array.from(selectedIds)); exitSelectionMode(); }}}
                className="p-1 hover:bg-black/5 rounded-lg transition-colors text-red-500"><span className="material-symbols-outlined text-2xl">delete</span></button>
              <button onClick={exitSelectionMode} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-600 text-2xl">close</span></button>
            </>
          ) : (
            <>
              <button onClick={onOpenStatistics} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-600 text-2xl">analytics</span></button>
              <button onClick={onOpenSettings} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-600 text-2xl">settings</span></button>
              <button onClick={() => setIsSelectionMode(true)} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-600 text-2xl">grid_view</span></button>
              <button onClick={onAddCard} className="p-1 hover:bg-black/5 rounded-lg transition-colors"><span className="material-symbols-outlined text-slate-600 text-2xl">add</span></button>
            </>
          )}
        </div>
      </header>
      <main className="px-5 space-y-6 flex-1 overflow-y-auto pb-24 scroll-container safe-area-bottom">
        <section>
          <div className="main-card-gradient rounded-3xl p-6 shadow-xl relative overflow-hidden">
            <div className="absolute right-0 top-0 h-full w-1/2 pointer-events-none">
              <svg className="absolute -right-10 -top-10 w-48 h-48 opacity-40" viewBox="0 0 200 200"><circle cx="100" cy="100" fill="none" r="80" stroke="white" strokeOpacity="0.1" strokeWidth="40"></circle><circle cx="100" cy="100" fill="none" r="60" stroke="white" strokeOpacity="0.05" strokeWidth="20"></circle></svg>
              <div className="absolute right-0 bottom-0 w-32 h-32 bg-blue-400/20 rounded-full blur-3xl"></div>
            </div>
            <div className="flex items-center gap-2 text-white/90 text-sm"><span>本期待还（总未还）</span><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></div>
            <div className="flex justify-between items-end mt-2 text-white"><div><div className="text-4xl font-bold tracking-tight">{formatCurrency(stats.totalUnpaid)}</div>{nearestCard && <div className="text-xs text-white/80 mt-4">{nearestCard.bankName} | {nearestCard.holderName} ({nearestCard.cardNumber})</div>}</div><div className="text-right"><div className="text-xs text-white/80">最近还款日</div>{nearestCard ? (<><div className="text-xl font-bold">{formatRepaymentDate(nearestCard.repaymentDate)}</div><div className="text-[10px] text-white/70">({nearestDays != null && nearestDays > 0 ? nearestDays + '天后' : nearestDays != null && nearestDays <= 0 && nearestCard?.status !== 'paid' ? '已逾期' : '--'})</div></>) : (<div className="text-xl font-bold text-white/50">--</div>)}</div></div>
          </div>
          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="flex flex-col"><span className="text-[10px] text-slate-500 mb-1">总可用额度</span><span className="text-lg font-semibold text-slate-900">{formatCurrency(stats.totalAvailable)}</span><div className="mt-2 text-[10px] flex justify-between text-slate-500"><span>可用比例</span><span>{stats.availableRatio.toFixed(1)}%</span></div><div className="w-full bg-slate-200 h-1 rounded-full mt-1"><div className="bg-purple-600 h-1 rounded-full" style={{width:Math.min(stats.availableRatio,100)+'%'}}></div></div></div>
            <div className="flex flex-col"><span className="text-[10px] text-slate-500 mb-1">未出账金额</span><span className="text-lg font-semibold text-slate-900">{formatCurrency(stats.totalUnbilled)}</span><div className="mt-2 text-[10px] flex justify-between text-slate-500"><span>占总额度</span><span>{stats.totalLimit>0?((stats.totalUnbilled/stats.totalLimit)*100).toFixed(1):'0.0'}%</span></div><div className="w-full bg-slate-200 h-1 rounded-full mt-1"><div className="bg-blue-600 h-1 rounded-full" style={{width:Math.min(stats.totalLimit>0?(stats.totalUnbilled/stats.totalLimit)*100:0,100)+'%'}}></div></div></div>
            <div className="flex flex-col"><span className="text-[10px] text-slate-500 mb-1">本月支出</span><span className="text-lg font-semibold text-slate-900">{formatCurrency(monthlySpend.current)}</span><div className="mt-2 text-[10px] flex items-center font-semibold" style={{color:spendIsUp?'#ef4444':spendChangePercent!==null?'#059669':'#999'}}>{spendChangePercent!==null?('较上月 '+(spendIsUp?'+':'')+spendChangePercent.toFixed(1)+'%'):'--'}{spendChangePercent!==null&&(<svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20"><path clipRule="evenodd" d={spendIsUp?"M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z":"M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"} fillRule="evenodd"></path></svg>)}</div></div>
          </div>
        </section>
        <section className="space-y-3">
          <div className="flex justify-between items-center mb-1"><h2 className="text-lg font-semibold text-slate-900">还款提醒</h2><span className="text-xs text-slate-500 flex items-center gap-1 px-2 py-1 rounded-lg font-medium">全部 <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></span></div>
          {reminders.unpaid.slice(0, 2).map(({ card, days }) => {
            const isUrgent = days <= 3;
            const bg = isUrgent ? 'rgba(255,120,0,0.08)' : 'rgba(255,191,0,0.08)';
            const textColor = isUrgent ? 'text-orange-700' : 'text-amber-700';
            const iconBg = isUrgent ? 'bg-orange-500/20 text-orange-600' : 'bg-amber-500/20 text-amber-600';
            return (
              <div key={card.id} className="rounded-2xl p-4 flex items-center justify-between border shadow-sm cursor-pointer active:opacity-70" style={{ backgroundColor: bg, borderColor: isUrgent ? '#fed7aa' : '#fde68a' }} onClick={() => onSelectCard(card)}>
                <div className="flex items-center gap-4"><div className={'w-10 h-10 rounded-full flex items-center justify-center '+iconBg}><svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z"></path></svg></div><div><div className={textColor+' text-sm font-semibold'}>{days>0?days+'天后需还款':'逾期'+Math.abs(days)+'天'} <span className="font-bold">{formatCurrency(card.currentUnpaid)}</span></div><div className="text-xs text-slate-500 mt-0.5">{card.bankName} | {card.holderName} ({card.cardNumber})</div></div></div>
                <div className="text-right"><div className={textColor+'/80 text-sm font-bold'}>{formatRepaymentDate(card.repaymentDate)}</div><div className="text-[10px] text-slate-500">({days>0?days+'天后':'已逾期'})</div></div>
              </div>
            );
          })}
          {reminders.paidCount > 0 && (
            <div className="rounded-2xl p-4 flex items-center justify-between border border-emerald-100 shadow-sm bg-emerald-50/50">
              <div className="flex items-center gap-4"><div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-600"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></div><div className="text-emerald-700 text-sm font-semibold">{reminders.paidCount}张卡已还清</div></div>
              
            </div>
          )}
        </section>
        <section className="space-y-4"><div className="flex justify-between items-center pt-2"><h2 className="text-lg font-semibold text-slate-900">我的信用卡 <span className="text-slate-400 text-xs font-normal">({cards.length}张)</span></h2><div className="relative"><button onClick={()=>setShowSortMenu(!showSortMenu)} className="text-xs text-slate-500 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-black/5 transition-colors font-medium">排列顺序<svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"></path></svg></button>{showSortMenu&&(<><div className="fixed inset-0 z-10" onClick={()=>setShowSortMenu(false)}></div><div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-xl border py-1 min-w-[120px]"><button onClick={()=>{setSortType('date');setShowSortMenu(false);}} className={'block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 '+(sortType==='date'?'font-bold':'')}>按还款日排序</button><button onClick={()=>{setSortType('unpaid');setShowSortMenu(false);}} className={'block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 '+(sortType==='unpaid'?'font-bold':'')}>按欠款额排序</button><button onClick={()=>{setSortType('limit');setShowSortMenu(false);}} className={'block w-full text-left px-4 py-2 text-xs hover:bg-gray-50 '+(sortType==='limit'?'font-bold':'')}>按额度排序</button></div></>)}</div></div>
          {sortedCards.map(card => {
            const available = card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0) - card.currentUnpaid - card.currentUnbilled;
            const availablePercent = card.fixedLimit > 0 ? (available / card.fixedLimit) * 100 : 0;
            const days = calculateRemainingDays(card.repaymentDate);
            const isPaid = card.status === 'paid';
            const isUrgent = !isPaid && days <= 3;
            const isSelected = isSelectionMode && selectedIds.has(card.id);
            const statusColor = isPaid ? '#52C41A' : isUrgent ? '#ef4444' : '#3A7CFE';
            const statusBg = isPaid ? 'bg-green-50 text-green-600' : isUrgent ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600';
            const progressClass = isPaid ? 'bg-emerald-600' : isUrgent ? 'progress-red' : 'progress-blue-gradient';
            return (
              <div key={card.id} onClick={e=>isSelectionMode?toggleSelection(card.id,e):onSelectCard(card)}
                className={'rounded-3xl p-5 border relative overflow-hidden cursor-pointer active:scale-[0.98] transition-all '+(isSelected?'border-blue-500':'border-slate-100')}
                style={{background:'linear-gradient(135deg, #ffffff 0%, '+getBankColor(card.bankName)+'08 50%, '+getBankColor(card.bankName)+'18 100%)',boxShadow:'0 4px 6px -1px rgba(0,0,0,0.05),0 2px 4px -1px rgba(0,0,0,0.03)'}}>
                <div className="flex justify-between items-start mb-6"><div className="flex items-center gap-3">{isSelectionMode&&(<div onClick={e=>toggleSelection(card.id,e)} className="cursor-pointer">{isSelected?<CheckSquare size={20} className="text-blue-500"/>:<Square size={20} className="text-gray-400"/>}</div>)}<div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-md" style={{backgroundColor:getBankColor(card.bankName),boxShadow:'0 2px 8px '+getBankColor(card.bankName)+'40'}}><span className="material-symbols-outlined text-white text-xl">{getBankIcon(card.bankName)}</span></div><div><div className="font-bold text-sm text-slate-900">{card.bankName} | {card.holderName}</div><div className="text-[10px] text-slate-500">尾号 {card.cardNumber}</div></div></div>
                <div className="text-right"><div className={'text-[10px] font-bold px-2 py-0.5 rounded-full inline-block '+statusBg}>{isPaid?'已还清':card.status==='overdue'?'逾期':'待还款'}</div><div className="text-xs mt-1"><span className="font-bold" style={{color:statusColor}}>{formatRepaymentDate(card.repaymentDate)}</span><span className="text-slate-400"> ({isPaid?'已还清':days>0?days+'天后':'已逾期'})</span></div></div></div>
                <div className="grid grid-cols-3 gap-2"><div><div className="text-[10px] text-slate-500 uppercase tracking-wide">本期应还</div><div className="text-sm font-bold mt-1" style={{color:statusColor}}>{formatCurrency(card.currentUnpaid)}</div></div><div><div className="text-[10px] text-slate-500 uppercase tracking-wide">可用额度</div><div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(available)} <span className="text-[9px] font-normal text-slate-400">({availablePercent.toFixed(1)}%)</span></div></div><div className="text-right"><div className="text-[10px] text-slate-500 uppercase tracking-wide">固定额度</div><div className="text-sm font-bold text-slate-900 mt-1">{formatCurrency(card.fixedLimit)}</div></div></div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-4"><div className={progressClass+' h-1.5 rounded-full'} style={{width:Math.min(availablePercent,100)+'%'}}></div></div>
              </div>
            );
          })}
          {cards.length===0&&(<div className="text-center py-10 text-slate-400"><p>暂无信用卡数据</p><p className="text-xs mt-2">点击右上角 + 号添加</p></div>)}
        </section>
      </main>
      <div className="fixed bottom-1 left-1/2 -translate-x-1/2 w-32 h-1 bg-slate-300 rounded-full"></div>
    </div>
  );
};
