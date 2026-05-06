import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction } from '../types';
import { ArrowLeft, ChevronDown, Calendar, CreditCard as CardIcon, Wallet, PieChart, TrendingUp, Layers, DollarSign } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface AnalysisProps {
  onBack: () => void;
}

export const Analysis: React.FC<AnalysisProps> = ({ onBack }) => {
  const cards = useAppStore(state => state.cards);
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year' | 'all'>('month');
  const [selectedCardId, setSelectedCardId] = useState<string>('all');
  
  // Filter Transactions & Calculate Statistics
  const filteredData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let txs: (Transaction & { cardName: string })[] = [];

    // 1. Gather all transactions
    cards.forEach(card => {
        if (selectedCardId === 'all' || card.id === selectedCardId) {
            card.transactions.forEach(tx => {
                txs.push({ ...tx, cardName: card.bankName });
            });
        }
    });

    // 2. Filter by Time
    txs = txs.filter(tx => {
        const txDate = new Date(tx.date);
        const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());

        if (timeRange === 'all') return true;
        if (timeRange === 'year') return txDate.getFullYear() === now.getFullYear();
        if (timeRange === 'month') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
        if (timeRange === 'week') {
            const sevenDaysAgo = new Date(today);
            sevenDaysAgo.setDate(today.getDate() - 7);
            return txDay >= sevenDaysAgo;
        }
        if (timeRange === 'day') {
            return txDay.getTime() === today.getTime();
        }
        return true;
    });

    // 3. Sort
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    // 4. Calculate Breakdown
    let totalExpenditure = 0; // Total Outflow (Consumption + Bill Installments + Loan Repayments)
    let totalRepayment = 0;   // Total Inflow (Credit Card Repayments)
    
    // Breakdown of Expenditure
    let normalConsumption = 0;
    let billInstallmentAmt = 0; // MerchantType '账单分期'
    let cashLoanAmt = 0;        // Other Loan Bills
    
    // New Liabilities (Principal taken)
    let newPrincipal = 0;

    txs.forEach(tx => {
        const absAmount = Math.abs(tx.amount);

        if (tx.type === 'consumption') {
            normalConsumption += absAmount;
            totalExpenditure += absAmount;
        } else if (tx.type === 'loan_bill') {
            if (tx.merchantType === '账单分期') {
                billInstallmentAmt += absAmount;
            } else {
                cashLoanAmt += absAmount;
            }
            totalExpenditure += absAmount;
        } else if (tx.type === 'repayment') {
            totalRepayment += absAmount;
        } else if (tx.type === 'installment_start') {
            // This is principal taken, not expenditure, but tracked as New Debt
            newPrincipal += absAmount;
        }
    });

    return {
        txs,
        totalExpenditure,
        totalRepayment,
        normalConsumption,
        billInstallmentAmt,
        cashLoanAmt,
        newPrincipal
    };
  }, [cards, timeRange, selectedCardId]);

  const getDayLabel = (dateStr: string) => {
      const d = new Date(dateStr);
      const now = new Date();
      const isToday = d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      const isYesterday = d.getDate() === yesterday.getDate() && d.getMonth() === yesterday.getMonth() && d.getFullYear() === yesterday.getFullYear();

      if (isToday) return '今天';
      if (isYesterday) return '昨天';
      return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  // Group transactions by Date
  const groupedTransactions = useMemo(() => {
      const groups: Record<string, typeof filteredData.txs> = {};
      filteredData.txs.forEach(tx => {
          const dayKey = tx.date.split('T')[0]; // YYYY-MM-DD
          if (!groups[dayKey]) groups[dayKey] = [];
          groups[dayKey].push(tx);
      });
      return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [filteredData.txs]);

  // Percentages for Expenditure Breakdown
  const totalExp = filteredData.totalExpenditure || 1; // Avoid div by 0
  const pctNormal = (filteredData.normalConsumption / totalExp) * 100;
  const pctBill = (filteredData.billInstallmentAmt / totalExp) * 100;
  const pctLoan = (filteredData.cashLoanAmt / totalExp) * 100;
  
  const timeOptions: { label: string, value: typeof timeRange }[] = [
      { label: '今天', value: 'day' },
      { label: '近7天', value: 'week' },
      { label: '本月', value: 'month' },
      { label: '本年', value: 'year' },
      { label: '全部', value: 'all' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f5f9]">
        {/* Sticky Header */}
        <div className="bg-white pt-12 pb-2 px-4 sticky top-0 z-30 shadow-sm">
            <div className="flex items-center justify-between mb-4">
                <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition">
                    <ArrowLeft size={24} />
                </button>
                <h2 className="text-lg font-bold text-gray-800">账单分析</h2>
                <div className="w-8"></div>
            </div>

            {/* Modern Pill Selectors (Horizontal Scroll) */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                 {timeOptions.map(opt => (
                     <button
                        key={opt.value}
                        onClick={() => setTimeRange(opt.value)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                            timeRange === opt.value 
                            ? 'bg-gray-900 text-white shadow-md' 
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                     >
                         {opt.label}
                     </button>
                 ))}
            </div>

            {/* Card Filter */}
            <div className="mt-2 relative">
                 <select 
                    value={selectedCardId} 
                    onChange={(e) => setSelectedCardId(e.target.value)}
                    className="w-full appearance-none bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700 py-2 pl-3 pr-8 rounded-lg outline-none"
                >
                    <option value="all">所有卡片</option>
                    {cards.map(c => (
                        <option key={c.id} value={c.id}>
                            {c.bankName} - {c.holderName} ({c.cardNumber})
                        </option>
                    ))}
                </select>
                <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none"/>
            </div>
        </div>
        
        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-6">
            
            {/* 1. Total Overview Card */}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                        <TrendingUp size={12}/> 总支出 (含还贷)
                    </p>
                    <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(filteredData.totalExpenditure)}</h3>
                </div>
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                    <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                        <Wallet size={12}/> 信用卡还款
                    </p>
                    <h3 className="text-xl font-bold text-green-600 tracking-tight">{formatCurrency(filteredData.totalRepayment)}</h3>
                </div>
            </div>

            {/* 2. Expenditure Composition Analysis (New Feature) */}
            {filteredData.totalExpenditure > 0 && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                    <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <PieChart size={16} className="text-blue-600"/> 消费构成分析
                    </h4>

                    {/* Stacked Bar Chart */}
                    <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4">
                        <div className="h-full bg-orange-400" style={{ width: `${pctNormal}%` }} />
                        <div className="h-full bg-purple-500" style={{ width: `${pctBill}%` }} />
                        <div className="h-full bg-blue-500" style={{ width: `${pctLoan}%` }} />
                    </div>

                    {/* Legend & Amounts */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-orange-400 shadow-sm" />
                                <span className="text-gray-600">日常消费</span>
                            </div>
                            <span className="font-bold text-gray-800">{formatCurrency(filteredData.normalConsumption)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-purple-500 shadow-sm" />
                                <span className="text-gray-600">账单分期 (月供)</span>
                            </div>
                            <span className="font-bold text-gray-800">{formatCurrency(filteredData.billInstallmentAmt)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm" />
                                <span className="text-gray-600">现金贷款 (月供)</span>
                            </div>
                            <span className="font-bold text-gray-800">{formatCurrency(filteredData.cashLoanAmt)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 3. New Principal / Liabilities (If any) */}
            {filteredData.newPrincipal > 0 && (
                <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
                     <div>
                         <p className="text-xs text-blue-500 font-bold mb-1 flex items-center gap-1">
                             <Layers size={12}/> 新增负债 (本金)
                         </p>
                         <p className="text-[10px] text-blue-400">本期新办理的分期/贷款总额</p>
                     </div>
                     <p className="text-xl font-bold text-blue-700">{formatCurrency(filteredData.newPrincipal)}</p>
                </div>
            )}

            {/* 4. Transactions List Grouped by Date */}
            <div className="space-y-4 pt-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">交易明细</h4>
                {groupedTransactions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">
                        <Calendar size={24} className="opacity-20 mb-2"/>
                        <p className="text-xs">暂无数据</p>
                    </div>
                ) : (
                    groupedTransactions.map(([dateKey, dayTxs]) => (
                        <div key={dateKey}>
                            <div className="flex items-center justify-between mb-2 px-1">
                                <h4 className="text-sm font-bold text-gray-500">{getDayLabel(dateKey)}</h4>
                                <span className="text-xs text-gray-300 font-medium">{dateKey}</span>
                            </div>
                            <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                                {dayTxs.map((tx, idx) => (
                                    <div 
                                        key={tx.id} 
                                        className={`p-4 flex justify-between items-center ${idx !== dayTxs.length - 1 ? 'border-b border-gray-50' : ''}`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                                                tx.type === 'consumption'
                                                ? 'bg-orange-50 text-orange-500'
                                                : tx.type === 'loan_bill'
                                                ? 'bg-blue-50 text-blue-500'
                                                : tx.type === 'installment_start'
                                                ? 'bg-purple-50 text-purple-500'
                                                : 'bg-green-50 text-green-500'
                                            }`}>
                                                {tx.type === 'consumption' ? <CardIcon size={18}/> 
                                                : tx.type === 'loan_bill' ? <DollarSign size={18}/>
                                                : tx.type === 'installment_start' ? <Layers size={18}/>
                                                : <Wallet size={18}/>}
                                            </div>
                                            <div>
                                                <div className="font-bold text-gray-800 text-sm flex items-center gap-1">
                                                    {tx.merchantType || '未知商户'}
                                                    {tx.type === 'loan_bill' && (
                                                        <span className={`text-[9px] px-1 rounded-sm ${tx.merchantType === '账单分期' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'}`}>
                                                            {tx.merchantType === '账单分期' ? '分期' : '贷款'}
                                                        </span>
                                                    )}
                                                    {tx.type === 'installment_start' && <span className="text-[9px] bg-purple-100 text-purple-600 px-1 rounded-sm">新增本金</span>}
                                                </div>
                                                <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                    <span className="bg-gray-50 px-1 rounded text-[10px]">{tx.cardName}</span>
                                                    <span>{tx.notes || tx.channel}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`font-bold text-base ${
                                                tx.type === 'repayment' || tx.type === 'installment_start' 
                                                ? 'text-green-600' 
                                                : 'text-gray-900'
                                            }`}>
                                                {tx.type === 'repayment' || tx.type === 'installment_start' ? '+' : ''}
                                                {formatCurrency(tx.amount)}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
  );
};