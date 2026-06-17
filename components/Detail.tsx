import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction, InstallmentPlan } from '../types';
import { generateBillingCycles, getBankDetailGradient, getBankColor, isTempLimitValid } from '../constants';
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

export const Detail: React.FC<DetailProps> = ({onBack,onEdit,onAddTransaction,onEditTransaction,onDeleteTransaction,onQuickAction,onDeleteCard}) => {
  const card = useAppStore(state => state.selectedCard);
  if (!card) return null;

  const [filterType, setFilterType] = useState<'all'|'consumption'|'repayment'>('all');
  const [selectedCycleKey, setSelectedCycleKey] = useState<string>('unbilled');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<'card'|'transaction'|null>(null);
  const [pendingDeleteTxId, setPendingDeleteTxId] = useState<string|null>(null);
  const [showInstallmentForm, setShowInstallmentForm] = useState(false);
  const [settlementTarget, setSettlementTarget] = useState<InstallmentPlan|null>(null);

  const rawCycles = useMemo(()=>generateBillingCycles(card.billDay),[card.billDay]);
  const cycles = useMemo(()=>rawCycles.map(c=>(c.key==='cycle-0'&&card.currentUnpaid>0?{...c,label:`当期未还 (${c.label})`}:c)),[rawCycles,card.currentUnpaid]);
  const currentCycle = cycles.find(c=>c.key===selectedCycleKey)||cycles[0];
  const available = card.fixedLimit+(isTempLimitValid(card)?card.tempLimit:0)-card.currentUnpaid-card.currentUnbilled;
  const bankGradient = getBankDetailGradient(card.bankName);
  const bankColor = getBankColor(card.bankName);
  const repaymentDays = calculateRemainingDays(card.repaymentDate);
  const usagePercent = card.fixedLimit>0?((card.fixedLimit+(isTempLimitValid(card)?card.tempLimit:0)-available)/(card.fixedLimit+(isTempLimitValid(card)?card.tempLimit:0)))*100:0;
  const billDateDisplay = useMemo(()=>{const n=new Date();return `${String(n.getMonth()+1).padStart(2,'0')}/${String(card.billDay).padStart(2,'0')}`},[card.billDay]);

  const filteredTransactions = useMemo(()=>card.transactions.filter(tx=>{
    const d=new Date(tx.date);d.setHours(0,0,0,0);
    if(d<currentCycle.start||d>currentCycle.end)return false;
    if(filterType==='all')return true;
    if(filterType==='consumption')return tx.type==='consumption';
    if(filterType==='repayment')return tx.type==='repayment';
    return true;
  }),[card.transactions,currentCycle,filterType]);

  const unbilledCycle = cycles.find(c=>c.key==='unbilled');
  const cycleStats = useMemo(()=>{let tc=0,tr=0,ar=0,fe=0;if(unbilledCycle){card.transactions.forEach(tx=>{const d=new Date(tx.date);d.setHours(0,0,0,0);if(d>=unbilledCycle.start&&d<=unbilledCycle.end){if(tx.type==='consumption'){tc+=Math.abs(tx.amount);ar+=tx.actualReceipt||0;fe+=tx.cost||0}else if(tx.type==='repayment')tr+=Math.abs(tx.amount)}})}return{totalConsumption:tc,totalRepayment:tr,actualReceipt:ar,fee:fe}},[card.transactions,unbilledCycle]);

  return (
    <div className="flex flex-col h-full bg-[#fdf7ff]">
      <header className="bg-white px-4 py-3 flex items-center justify-between sticky top-0 z-50 safe-area-top">
        <div className="flex items-center gap-4">
          <button onClick={onBack}><svg className="text-gray-700" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M15 18l-6-6 6-6"></path></svg></button>
          <h1 className="text-lg font-medium text-gray-900">{card.bankName} | 尾号 {card.cardNumber}</h1>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={()=>onEdit(card)}><svg className="text-gray-700" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22"><path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg></button>
          <button onClick={()=>setShowDeleteConfirm('card')}><svg className="text-gray-700" fill="none" height="22" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="22"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button>
        </div>
      </header>
      <main className="px-4 py-2 space-y-4 flex-1 overflow-y-auto pb-24 scroll-container safe-area-bottom">
        <section className="rounded-3xl p-6 text-white shadow-lg relative overflow-hidden" style={{background:`linear-gradient(135deg, ${bankGradient.start} 0%, ${bankGradient.end} 100%)`}}>
          <div className="flex items-center gap-2 mb-8"><div className="bg-white rounded-full p-1"><svg fill={bankColor} height="24" viewBox="0 0 24 24" width="24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div><div><p className="font-bold text-sm leading-tight">{card.bankName}</p><p className="text-[10px] opacity-80 uppercase tracking-tighter">{card.holderName}</p></div></div>
          <div className="grid grid-cols-2 gap-4 mb-6"><div><p className="text-[11px] opacity-80 mb-1">本期应还</p><p className="text-3xl font-bold">{formatCurrency(card.currentUnpaid)}</p>{card.status!=='paid'&&(<span className={`inline-block mt-3 px-3 py-1 rounded-full text-[10px] ${repaymentDays<=0?'bg-red-400/30':'bg-white/20'}`}>{repaymentDays<=0?`逾期${Math.abs(repaymentDays)}天`:`剩余 ${repaymentDays} 天`}</span>)}</div><div className="text-right"><p className="text-[11px] opacity-80 mb-1">可用额度</p><p className="text-3xl font-bold">{formatCurrency(available)}</p><p className="text-[10px] mt-3">额度使用率 {usagePercent.toFixed(1)}%</p><div className="w-full bg-white/20 h-1.5 rounded-full mt-1 overflow-hidden"><div className="bg-white h-full rounded-full" style={{width:`${Math.min(usagePercent,100)}%`}}></div></div></div></div>
        </section>
        <section className="bg-white rounded-2xl p-5 shadow-sm space-y-6">
          <div className="grid grid-cols-3 gap-y-6"><div><p className="text-xs text-gray-400 mb-1">本期账单</p><p className="text-lg font-semibold text-gray-800">{formatCurrency(card.statementAmount)}</p><p className="text-[10px] text-gray-400 mt-1">手续费 {formatCurrency(cycleStats.fee)}</p></div><div><p className="text-xs text-gray-400 mb-1">未出账单</p><p className="text-lg font-semibold text-gray-800">{formatCurrency(card.currentUnbilled)}</p><p className="text-xs text-gray-400 mt-1">本期还款</p><p className="text-sm font-medium text-emerald-500">{formatCurrency(cycleStats.totalRepayment)}</p></div><div className="text-right"><p className="text-xs text-gray-400 mb-1">本期消费</p><p className="text-lg font-semibold text-gray-800">{formatCurrency(cycleStats.totalConsumption)}</p><p className="text-xs text-gray-400 mt-1">实际到账</p><p className="text-sm font-medium text-gray-800">{formatCurrency(cycleStats.actualReceipt)}</p></div></div>
          <div className="rounded-xl p-4 flex justify-between text-center" style={{background:bankColor+'10',border:'1px solid '+bankColor+'20'}}><div className="flex-1"><p className="text-[11px] text-gray-500 mb-1">账单日</p><p className="text-sm font-medium text-gray-800">{billDateDisplay}</p></div><div className="w-px h-8 self-center" style={{background:bankColor+'20'}}></div><div className="flex-1"><p className="text-[11px] text-gray-500 mb-1">还款日</p><p className="text-sm font-medium text-gray-800">{formatRepaymentDate(card.repaymentDate)}<span className="text-[10px] text-gray-400 ml-1">({repaymentDays>0?`${repaymentDays}天后`:'已逾期'})</span></p></div><div className="w-px h-8 self-center" style={{background:bankColor+'20'}}></div><div className="flex-1"><p className="text-[11px] text-gray-500 mb-1">固定额度</p><p className="text-sm font-medium text-gray-800">{formatCurrency(card.fixedLimit)}</p></div></div>
        </section>
        <section className="bg-white rounded-2xl p-4 shadow-sm grid grid-cols-5 gap-2">
          <button onClick={()=>onQuickAction('adjust_unpaid',card)} className="flex flex-col items-center gap-2 active:opacity-70"><div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500"><svg fill="none" height="24" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"></path></svg></div><span className="text-[9px] text-gray-600 text-center leading-tight">调剩余未还</span></button>
          <button onClick={()=>onQuickAction('adjust_limit',card)} className="flex flex-col items-center gap-2 active:opacity-70"><div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-500"><svg fill="none" height="24" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M3 12h18M3 6h18M3 18h18"></path></svg></div><span className="text-[9px] text-gray-600 text-center leading-tight">提升固定额</span></button>
          <button onClick={()=>onQuickAction('adjust_available',card)} className="flex flex-col items-center gap-2 active:opacity-70"><div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500"><svg fill="none" height="24" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="24"><rect height="18" rx="2" width="18" x="3" y="3"></rect><path d="M9 12h6M12 9v6"></path></svg></div><span className="text-[9px] text-gray-600 text-center leading-tight">调可用额度</span></button>
          <button onClick={()=>onQuickAction('adjust_temp_limit',card)} className="flex flex-col items-center gap-2 active:opacity-70"><div className="w-10 h-10 bg-purple-50 rounded-lg flex items-center justify-center text-purple-500"><svg fill="none" height="24" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg></div><span className="text-[9px] text-gray-600 text-center leading-tight">临时额度</span></button>
          <button onClick={()=>setShowInstallmentForm(true)} className="flex flex-col items-center gap-2 active:opacity-70"><div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center text-orange-400"><svg fill="none" height="24" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="24"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div><span className="text-[9px] text-gray-600 text-center leading-tight">分期管理</span></button>
        </section>
        <InstallmentPlanView cardId={card.id} onOpenSettlement={setSettlementTarget} />
        <section className="bg-white rounded-2xl shadow-sm">
          <div className="flex items-center gap-8 px-5 py-4 border-b border-gray-50">
            {(['all','consumption','repayment'] as const).map(t=>(
              <button key={t} onClick={()=>setFilterType(t)} className={`relative text-sm ${filterType===t?'font-bold text-gray-900':'font-medium text-gray-500'}`}>
                {t==='all'?'全部':t==='consumption'?'消费':'还款'}
                {filterType===t&&<span className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-sm" style={{background:bankColor}}></span>}
              </button>
            ))}
          </div>
          <div className="p-5 space-y-4">
            <div className="relative"><select value={selectedCycleKey} onChange={e=>setSelectedCycleKey(e.target.value)} className="w-full bg-gray-50 rounded-lg p-2 px-3 text-sm font-medium text-gray-800 outline-none appearance-none cursor-pointer">{cycles.map(c=><option key={c.key} value={c.key}>{c.label}{c.key==='unbilled'?'（未出）':''}</option>)}</select><svg className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" fill="none" height="16" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="16"><path d="M6 9l6 6 6-6"></path></svg></div>
            {filteredTransactions.length===0?(<div className="text-center py-10 text-gray-400 text-xs">暂无记录</div>):(
              filteredTransactions.map(tx=>{
                const isConsumption=tx.type==='consumption';
                const isRepayment=tx.type==='repayment';
                return (
                  <div key={tx.id} className="flex items-center gap-4 group">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${isRepayment?'bg-blue-50 text-blue-500':isConsumption?'bg-orange-50 text-orange-500':'bg-purple-50 text-purple-500'}`}>
                      {isRepayment?<svg fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20"><rect height="16" rx="2" width="18" x="3" y="4"></rect><line x1="3" x2="21" y1="10" y2="10"></line><line x1="7" x2="12" y1="15" y2="15"></line></svg>:isConsumption?<svg fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20"><rect height="14" rx="2" width="20" x="2" y="5"></rect><line x1="2" x2="22" y1="10" y2="10"></line></svg>:<svg fill="none" height="20" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="20"><path d="M5 3h14v4l-4 4 4 4v4H5v-4l4-4-4-4V3z"></path></svg>}
                    </div>
                    <div className="flex-1 min-w-0"><div className="flex justify-between"><span className="text-sm font-medium text-gray-800 truncate">{tx.notes||(isRepayment?'还款':tx.merchantType||'消费')}</span><span className={`text-sm font-semibold shrink-0 ml-2 ${isRepayment?'text-emerald-500':'text-gray-900'}`}>{isRepayment?'+'+formatCurrency(tx.amount).replace('¥','').replace('-',''):'-'+formatCurrency(tx.amount).replace('¥','').replace('-','')}</span></div>
                    <div className="flex justify-between items-center mt-1"><span className="text-[11px] text-gray-400">{formatDate(tx.date)} {tx.channel}</span><span className={`text-[9px] px-1.5 py-0.5 rounded ml-2 ${isRepayment?'bg-emerald-50 text-emerald-500':isConsumption?'bg-orange-50 text-orange-500':'bg-rose-50 text-rose-500'}`}>{tx.merchantType||(isRepayment?'还款':'消费')}</span></div></div>
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 shrink-0"><button onClick={()=>onEditTransaction(card,tx)} className="text-[10px] text-blue-500 hover:underline">修改</button><button onClick={()=>{setPendingDeleteTxId(tx.id);setShowDeleteConfirm('transaction')}} className="text-[10px] text-red-500 hover:underline">删除</button></div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
      <div className="fixed bottom-10 right-6 flex flex-col items-center gap-1 z-50">
        <button onClick={()=>onAddTransaction(card)} className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform" style={{backgroundColor:bankColor,boxShadow:`0 4px 16px ${bankColor}40`}}><svg fill="none" height="32" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" viewBox="0 0 24 24" width="32"><line x1="12" x2="12" y1="5" y2="19"></line><line x1="5" x2="19" y1="12" y2="12"></line></svg></button>
        <span className="text-[10px] font-medium" style={{color:bankColor}}>记一笔</span>
      </div>
      {showDeleteConfirm&&(<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"><div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden"><div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50"><h3 className="font-bold text-gray-800">确认删除</h3><button onClick={()=>{setShowDeleteConfirm(null);setPendingDeleteTxId(null)}} className="p-1 rounded-full hover:bg-gray-200 text-gray-500"><span className="text-xl">&times;</span></button></div><div className="p-4"><p className="text-gray-600 mb-6 text-sm">{showDeleteConfirm==='card'?'确定要删除这张信用卡吗？此操作不可恢复。':'确定要删除这条交易记录吗？'}</p><div className="flex gap-3"><button onClick={()=>{setShowDeleteConfirm(null);setPendingDeleteTxId(null)}} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">取消</button><button onClick={()=>{if(showDeleteConfirm==='card'){onDeleteCard(card.id)}else if(pendingDeleteTxId){onDeleteTransaction(card,pendingDeleteTxId)}setShowDeleteConfirm(null);setPendingDeleteTxId(null)}} className="flex-1 py-2.5 rounded-xl bg-red-500 text-white font-bold text-sm hover:bg-red-600 shadow-md">确认删除</button></div></div></div></div>)}
      {showInstallmentForm&&<InstallmentForm card={card} onClose={()=>setShowInstallmentForm(false)}/>}
      {settlementTarget&&<EarlySettlementModal plan={settlementTarget} onClose={()=>setSettlementTarget(null)}/>}
    </div>
  );
};
