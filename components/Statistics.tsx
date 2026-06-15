import React, { useState, useMemo, useRef, useEffect } from 'react';
import { CreditCard, Transaction } from '../types';
import { ArrowLeft, Download, TrendingUp, CreditCard as CardIcon, DollarSign, Calendar, ChevronDown, PieChart, Wallet, Layers, BarChart3 } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface StatisticsProps {
  onBack: () => void;
}

type TabType = 'analysis' | 'fee';
type TimePreset = 'this_month' | 'last_3_months' | 'last_year' | 'custom';
type AnalysisTimeRange = 'day' | 'week' | 'month' | 'year' | 'all';

export const Statistics: React.FC<StatisticsProps> = ({ onBack }) => {
  const cards = useAppStore(s => s.cards);
  const [activeTab, setActiveTab] = useState<TabType>('analysis');

  // ---- Analysis State ----
  const [analysisTimeRange, setAnalysisTimeRange] = useState<AnalysisTimeRange>('month');
  const [analysisCardId, setAnalysisCardId] = useState<string>('all');

  // ---- Fee State ----
  const [feeTimePreset, setFeeTimePreset] = useState<TimePreset>('this_month');
  const [feeSelectedCardIds, setFeeSelectedCardIds] = useState<string[]>([]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ========== Analysis Calculations ==========
  const analysisData = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let txs: (Transaction & { cardName: string })[] = [];

    cards.forEach(card => {
      if (analysisCardId === 'all' || card.id === analysisCardId) {
        card.transactions.forEach(tx => {
          txs.push({ ...tx, cardName: card.bankName });
        });
      }
    });

    txs = txs.filter(tx => {
      const txDate = new Date(tx.date);
      const txDay = new Date(txDate.getFullYear(), txDate.getMonth(), txDate.getDate());
      if (analysisTimeRange === 'all') return true;
      if (analysisTimeRange === 'year') return txDate.getFullYear() === now.getFullYear();
      if (analysisTimeRange === 'month') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      if (analysisTimeRange === 'week') {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return txDay >= sevenDaysAgo;
      }
      if (analysisTimeRange === 'day') return txDay.getTime() === today.getTime();
      return true;
    });

    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    let totalExpenditure = 0;
    let totalRepayment = 0;
    let normalConsumption = 0;
    let billInstallmentAmt = 0;
    let cashLoanAmt = 0;
    let newPrincipal = 0;

    txs.forEach(tx => {
      const absAmount = Math.abs(tx.amount);
      if (tx.type === 'consumption') {
        normalConsumption += absAmount;
        totalExpenditure += absAmount;
      } else if (tx.type === 'loan_bill') {
        if (tx.merchantType === '账单分期') billInstallmentAmt += absAmount;
        else cashLoanAmt += absAmount;
        totalExpenditure += absAmount;
      } else if (tx.type === 'repayment') {
        totalRepayment += absAmount;
      } else if (tx.type === 'installment_start') {
        newPrincipal += absAmount;
      }
    });

    return { txs, totalExpenditure, totalRepayment, normalConsumption, billInstallmentAmt, cashLoanAmt, newPrincipal };
  }, [cards, analysisTimeRange, analysisCardId]);

  const groupedAnalysisTxs = useMemo(() => {
    const groups: Record<string, typeof analysisData.txs> = {};
    analysisData.txs.forEach(tx => {
      const dayKey = tx.date.split('T')[0];
      if (!groups[dayKey]) groups[dayKey] = [];
      groups[dayKey].push(tx);
    });
    return Object.entries(groups).sort((a, b) => new Date(b[0]).getTime() - new Date(a[0]).getTime());
  }, [analysisData.txs]);

  const totalExp = analysisData.totalExpenditure || 1;
  const pctNormal = (analysisData.normalConsumption / totalExp) * 100;
  const pctBill = (analysisData.billInstallmentAmt / totalExp) * 100;
  const pctLoan = (analysisData.cashLoanAmt / totalExp) * 100;

  // ========== Fee Calculations ==========
  const allCardIds = cards.map(c => c.id);

  const effectiveCardIds = useMemo(() => {
    if (feeSelectedCardIds.length === 0) return allCardIds;
    return feeSelectedCardIds.filter(id => allCardIds.includes(id));
  }, [feeSelectedCardIds, allCardIds]);

  const feeDateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today);
    end.setHours(23, 59, 59, 999);
    switch (feeTimePreset) {
      case 'this_month': start = new Date(now.getFullYear(), now.getMonth(), 1); break;
      case 'last_3_months': start = new Date(now.getFullYear(), now.getMonth() - 2, 1); break;
      case 'last_year': start = new Date(now.getFullYear() - 1, now.getMonth(), 1); break;
      case 'custom':
        start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = customEnd ? new Date(customEnd) : new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      default: start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [feeTimePreset, customStart, customEnd]);

  const feeTxs = useMemo(() => {
    const txs: (Transaction & { cardName: string; cardId: string })[] = [];
    cards.forEach(card => {
      if (!effectiveCardIds.includes(card.id)) return;
      card.transactions.forEach(tx => {
        if (tx.cost <= 0) return;
        const txDate = new Date(tx.date);
        if (txDate >= feeDateRange.start && txDate <= feeDateRange.end) {
          txs.push({ ...tx, cardName: card.bankName, cardId: card.id });
        }
      });
    });
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return txs;
  }, [cards, effectiveCardIds, feeDateRange]);

  const feeStats = useMemo(() => {
    const totalFees = feeTxs.reduce((sum, t) => sum + t.cost, 0);
    const cardSet = new Set(feeTxs.map(t => t.cardId));
    const maxSingle = feeTxs.reduce((max, t) => Math.max(max, t.cost), 0);
    let monthlyAvg = 0;
    if (feeTxs.length > 0) {
      const months = new Set(feeTxs.map(t => {
        const d = new Date(t.date);
        return `${d.getFullYear()}-${d.getMonth()}`;
      }));
      monthlyAvg = months.size > 0 ? totalFees / months.size : totalFees;
    }
    return { totalFees, cardCount: cardSet.size, maxSingle, monthlyAvg };
  }, [feeTxs]);

  const perCardData = useMemo(() => {
    const map: Record<string, { cardName: string; total: number }> = {};
    feeTxs.forEach(tx => {
      if (!map[tx.cardId]) map[tx.cardId] = { cardName: tx.cardName, total: 0 };
      map[tx.cardId].total += tx.cost;
    });
    return Object.entries(map).map(([id, d]) => ({ cardId: id, ...d })).sort((a, b) => b.total - a.total);
  }, [feeTxs]);

  const perMonthData = useMemo(() => {
    const map: Record<string, number> = {};
    feeTxs.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + tx.cost;
    });
    return Object.entries(map).map(([month, total]) => ({ month, total })).sort((a, b) => a.month.localeCompare(b.month));
  }, [feeTxs]);

  const perTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    feeTxs.forEach(tx => {
      const key = tx.merchantType || '其他';
      map[key] = (map[key] || 0) + tx.cost;
    });
    return Object.entries(map).map(([type, total]) => ({ type, total })).sort((a, b) => b.total - a.total);
  }, [feeTxs]);

  const maxCardTotal = Math.max(1, ...perCardData.map(d => d.total));
  const maxMonthTotal = Math.max(1, ...perMonthData.map(d => d.total));
  const maxTypeTotal = Math.max(1, ...perTypeData.map(d => d.total));

  const groupedFeeTxs = useMemo(() => {
    const groups: Record<string, typeof feeTxs> = {};
    feeTxs.forEach(tx => {
      const key = tx.date.split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [feeTxs]);

  // ========== Fee Multi-Select ==========
  const toggleFeeCard = (id: string) => {
    setFeeSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const feeSelectedLabel = useMemo(() => {
    if (feeSelectedCardIds.length === 0 || feeSelectedCardIds.length === cards.length) return '全部卡片';
    if (feeSelectedCardIds.length === 1) {
      const c = cards.find(x => x.id === feeSelectedCardIds[0]);
      return c ? `${c.bankName} · ${c.holderName}` : '全部卡片';
    }
    return `已选 ${feeSelectedCardIds.length} 张`;
  }, [feeSelectedCardIds, cards]);

  // ========== Helpers ==========
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

  const handleExportCSV = () => {
    const BOM = '﻿';
    const headers = ['日期', '卡片', '类型', '商户', '交易金额', '手续费', '实际到账', '备注'];
    const rows = feeTxs.map(tx => [
      tx.date.split('T')[0],
      tx.cardName,
      tx.type === 'consumption' ? '消费' : tx.type === 'loan_bill' ? '贷款还款' : tx.type === 'installment_start' ? '分期本金' : '还款',
      tx.merchantType || '',
      tx.amount.toFixed(2),
      tx.cost.toFixed(2),
      tx.actualReceipt.toFixed(2),
      tx.notes || '',
    ]);
    const csv = BOM + [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `手续费统计_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
  };

  const timeOptions: { label: string; value: AnalysisTimeRange }[] = [
    { label: '今天', value: 'day' },
    { label: '近7天', value: 'week' },
    { label: '本月', value: 'month' },
    { label: '本年', value: 'year' },
    { label: '全部', value: 'all' },
  ];

  const feeTimeOptions: { label: string; value: TimePreset }[] = [
    { label: '本月', value: 'this_month' },
    { label: '近3月', value: 'last_3_months' },
    { label: '近1年', value: 'last_year' },
    { label: '自定义', value: 'custom' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f5f9]">
      {/* Sticky Header */}
      <div className="bg-white pt-12 pb-2 px-4 sticky top-0 z-30 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <button onClick={onBack} className="p-2 -ml-2 text-gray-700 hover:bg-gray-100 rounded-full transition">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-lg font-bold text-gray-800">统计分析</h2>
          <div className="w-8">
            {activeTab === 'fee' && (
              <button onClick={handleExportCSV} disabled={feeTxs.length === 0} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-30" title="导出CSV">
                <Download size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Tab Bar */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-3">
          <button
            onClick={() => setActiveTab('analysis')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${
              activeTab === 'analysis' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >账单分析</button>
          <button
            onClick={() => setActiveTab('fee')}
            className={`flex-1 py-2 rounded-md text-sm font-bold transition ${
              activeTab === 'fee' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'
            }`}
          >手续费统计</button>
        </div>

        {/* ===== Analysis Filters ===== */}
        {activeTab === 'analysis' && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {timeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setAnalysisTimeRange(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    analysisTimeRange === opt.value
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            <div className="mt-2 relative">
              <select
                value={analysisCardId}
                onChange={e => setAnalysisCardId(e.target.value)}
                className="w-full appearance-none bg-gray-50 border border-gray-100 text-sm font-bold text-gray-700 py-2 pl-3 pr-8 rounded-lg outline-none"
              >
                <option value="all">所有卡片</option>
                {cards.map(c => (
                  <option key={c.id} value={c.id}>{c.bankName} · {c.holderName} · ****{c.cardNumber.slice(-4)}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
            </div>
          </>
        )}

        {/* ===== Fee Filters ===== */}
        {activeTab === 'fee' && (
          <>
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {feeTimeOptions.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setFeeTimePreset(opt.value)}
                  className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                    feeTimePreset === opt.value
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >{opt.label}</button>
              ))}
            </div>
            {feeTimePreset === 'custom' && (
              <div className="flex gap-2 mt-2">
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 p-2 bg-gray-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
                <span className="text-gray-400 self-center text-xs">至</span>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 p-2 bg-gray-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            )}
            <div className="mt-2 relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="w-full flex items-center justify-between p-2.5 bg-gray-50 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className={feeSelectedCardIds.length === 0 ? 'text-gray-800' : 'text-blue-600 font-medium'}>{feeSelectedLabel}</span>
                <ChevronDown size={16} className={`text-gray-400 transition ${dropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              {dropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 z-50 max-h-60 overflow-y-auto py-1">
                  <label className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer border-b border-gray-50">
                    <input type="checkbox" checked={feeSelectedCardIds.length === 0} onChange={() => setFeeSelectedCardIds([])} className="w-4 h-4 rounded accent-blue-600" />
                    <span className="text-sm text-gray-700">全部卡片</span>
                  </label>
                  {cards.map(c => (
                    <label key={c.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 cursor-pointer">
                      <input type="checkbox" checked={feeSelectedCardIds.includes(c.id)} onChange={() => toggleFeeCard(c.id)} className="w-4 h-4 rounded accent-blue-600" />
                      <span className="text-sm text-gray-700">{c.bankName} · {c.holderName} · ****{c.cardNumber.slice(-4)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===== Scrollable Content ===== */}
      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-6">

        {/* ==================== ANALYSIS TAB ==================== */}
        {activeTab === 'analysis' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                  <TrendingUp size={12} /> 总支出 (含还贷)
                </p>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(analysisData.totalExpenditure)}</h3>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
                  <Wallet size={12} /> 信用卡还款
                </p>
                <h3 className="text-xl font-bold text-green-600 tracking-tight">{formatCurrency(analysisData.totalRepayment)}</h3>
              </div>
            </div>

            {analysisData.totalExpenditure > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <PieChart size={16} className="text-blue-600" /> 消费构成分析
                </h4>
                <div className="h-4 w-full bg-gray-100 rounded-full overflow-hidden flex mb-4">
                  <div className="h-full bg-orange-400" style={{ width: `${pctNormal}%` }} />
                  <div className="h-full bg-purple-500" style={{ width: `${pctBill}%` }} />
                  <div className="h-full bg-blue-500" style={{ width: `${pctLoan}%` }} />
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-orange-400" /><span className="text-gray-600">日常消费</span></div>
                    <span className="font-bold text-gray-800">{formatCurrency(analysisData.normalConsumption)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-purple-500" /><span className="text-gray-600">账单分期 (月供)</span></div>
                    <span className="font-bold text-gray-800">{formatCurrency(analysisData.billInstallmentAmt)}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-blue-500" /><span className="text-gray-600">现金贷款 (月供)</span></div>
                    <span className="font-bold text-gray-800">{formatCurrency(analysisData.cashLoanAmt)}</span>
                  </div>
                </div>
              </div>
            )}

            {analysisData.newPrincipal > 0 && (
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-2xl p-4 border border-blue-100 flex items-center justify-between">
                <div>
                  <p className="text-xs text-blue-500 font-bold mb-1 flex items-center gap-1"><Layers size={12} /> 新增负债 (本金)</p>
                  <p className="text-[10px] text-blue-400">本期新办理的分期/贷款总额</p>
                </div>
                <p className="text-xl font-bold text-blue-700">{formatCurrency(analysisData.newPrincipal)}</p>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">交易明细</h4>
              {groupedAnalysisTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">
                  <Calendar size={24} className="opacity-20 mb-2" />
                  <p className="text-xs">暂无数据</p>
                </div>
              ) : (
                groupedAnalysisTxs.map(([dateKey, dayTxs]) => (
                  <div key={dateKey}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h4 className="text-sm font-bold text-gray-500">{getDayLabel(dateKey)}</h4>
                      <span className="text-xs text-gray-300 font-medium">{dateKey}</span>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                      {dayTxs.map((tx, idx) => (
                        <div key={tx.id} className={`p-4 flex justify-between items-center ${idx !== dayTxs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                              tx.type === 'consumption' ? 'bg-orange-50 text-orange-500'
                              : tx.type === 'loan_bill' ? 'bg-blue-50 text-blue-500'
                              : tx.type === 'installment_start' ? 'bg-purple-50 text-purple-500'
                              : 'bg-green-50 text-green-500'
                            }`}>
                              {tx.type === 'consumption' ? <CardIcon size={18} />
                              : tx.type === 'loan_bill' ? <DollarSign size={18} />
                              : tx.type === 'installment_start' ? <Layers size={18} />
                              : <Wallet size={18} />}
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
                              tx.type === 'repayment' || tx.type === 'installment_start' ? 'text-green-600' : 'text-gray-900'
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
          </>
        )}

        {/* ==================== FEE TAB ==================== */}
        {activeTab === 'fee' && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1"><DollarSign size={12} /> 总手续费</p>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(feeStats.totalFees)}</h3>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1"><CardIcon size={12} /> 涉及卡片</p>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">{feeStats.cardCount}张</h3>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1"><TrendingUp size={12} /> 单笔最高</p>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(feeStats.maxSingle)}</h3>
              </div>
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1"><Calendar size={12} /> 月均手续费</p>
                <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(feeStats.monthlyAvg)}</h3>
              </div>
            </div>

            {perCardData.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-4">按卡片</h4>
                <div className="space-y-3">
                  {perCardData.map(d => (
                    <div key={d.cardId}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.cardName}</span>
                        <span className="font-bold text-gray-800">{formatCurrency(d.total)}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(d.total / maxCardTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {perMonthData.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-4">按月趋势</h4>
                <div className="space-y-3">
                  {perMonthData.map(d => (
                    <div key={d.month}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.month}</span>
                        <span className="font-bold text-gray-800">{formatCurrency(d.total)}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-purple-500 rounded-full" style={{ width: `${(d.total / maxMonthTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {perTypeData.length > 0 && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <h4 className="text-sm font-bold text-gray-800 mb-4">按手续费类型</h4>
                <div className="space-y-3">
                  {perTypeData.map(d => (
                    <div key={d.type}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-600">{d.type}</span>
                        <span className="font-bold text-gray-800">{formatCurrency(d.total)}</span>
                      </div>
                      <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-orange-500 rounded-full" style={{ width: `${(d.total / maxTypeTotal) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 pt-2">
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">手续费明细</h4>
              {groupedFeeTxs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">
                  <Calendar size={24} className="opacity-20 mb-2" />
                  <p className="text-xs">暂无手续费数据</p>
                </div>
              ) : (
                groupedFeeTxs.map(([dateKey, dayTxs]) => (
                  <div key={dateKey}>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <h4 className="text-sm font-bold text-gray-500">{getDayLabel(dateKey)}</h4>
                      <span className="text-xs text-gray-300 font-medium">{dateKey}</span>
                    </div>
                    <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-gray-100">
                      {dayTxs.map((tx, idx) => (
                        <div key={tx.id} className={`p-4 flex justify-between items-center ${idx !== dayTxs.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <div>
                            <div className="font-bold text-gray-800 text-sm">{tx.merchantType || '未知商户'}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              <span className="bg-gray-50 px-1 rounded text-[10px]">{tx.cardName}</span>
                              <span className="ml-1">
                                {tx.type === 'consumption' ? '消费' : tx.type === 'loan_bill' ? '贷款还款' : '还款'}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs text-gray-500">交易: {formatCurrency(Math.abs(tx.amount))}</p>
                            <p className="font-bold text-orange-600 text-sm">手续费: {formatCurrency(tx.cost)}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            {feeTxs.length > 0 && (
              <button onClick={handleExportCSV} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition">
                <Download size={18} /> 导出CSV ({feeTxs.length}条记录)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
