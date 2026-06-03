import React, { useState, useMemo } from 'react';
import { Transaction } from '../types';
import { ArrowLeft, Download, TrendingUp, CreditCard, DollarSign, Calendar } from 'lucide-react';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface FeeStatisticsProps {
  onBack: () => void;
}

type TimePreset = 'this_month' | 'last_3_months' | 'last_year' | 'custom';

export const FeeStatistics: React.FC<FeeStatisticsProps> = ({ onBack }) => {
  const cards = useAppStore(s => s.cards);
  const [timePreset, setTimePreset] = useState<TimePreset>('this_month');
  const [selectedCardIds, setSelectedCardIds] = useState<string[]>([]);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const allCardIds = cards.map(c => c.id);

  const effectiveCardIds = useMemo(() => {
    if (selectedCardIds.length === 0) return allCardIds;
    return selectedCardIds.filter(id => allCardIds.includes(id));
  }, [selectedCardIds, allCardIds]);

  const toggleCard = (id: string) => {
    setSelectedCardIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const dateRange = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let start: Date;
    let end: Date = new Date(today);
    end.setHours(23, 59, 59, 999);

    switch (timePreset) {
      case 'this_month':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'last_3_months':
        start = new Date(now.getFullYear(), now.getMonth() - 2, 1);
        break;
      case 'last_year':
        start = new Date(now.getFullYear() - 1, now.getMonth(), 1);
        break;
      case 'custom':
        start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
        end = customEnd ? new Date(customEnd) : new Date(today);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [timePreset, customStart, customEnd]);

  const feeTxs = useMemo(() => {
    const txs: (Transaction & { cardName: string; cardId: string })[] = [];
    cards.forEach(card => {
      if (!effectiveCardIds.includes(card.id)) return;
      card.transactions.forEach(tx => {
        if (tx.cost <= 0) return;
        const txDate = new Date(tx.date);
        if (txDate >= dateRange.start && txDate <= dateRange.end) {
          txs.push({ ...tx, cardName: card.bankName, cardId: card.id });
        }
      });
    });
    txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return txs;
  }, [cards, effectiveCardIds, dateRange]);

  const stats = useMemo(() => {
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
    return Object.entries(map)
      .map(([id, d]) => ({ cardId: id, ...d }))
      .sort((a, b) => b.total - a.total);
  }, [feeTxs]);

  const perMonthData = useMemo(() => {
    const map: Record<string, number> = {};
    feeTxs.forEach(tx => {
      const d = new Date(tx.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map[key] = (map[key] || 0) + tx.cost;
    });
    return Object.entries(map)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [feeTxs]);

  const perTypeData = useMemo(() => {
    const map: Record<string, number> = {};
    feeTxs.forEach(tx => {
      const key = tx.merchantType || '其他';
      map[key] = (map[key] || 0) + tx.cost;
    });
    return Object.entries(map)
      .map(([type, total]) => ({ type, total }))
      .sort((a, b) => b.total - a.total);
  }, [feeTxs]);

  const maxCardTotal = Math.max(1, ...perCardData.map(d => d.total));
  const maxMonthTotal = Math.max(1, ...perMonthData.map(d => d.total));
  const maxTypeTotal = Math.max(1, ...perTypeData.map(d => d.total));

  const groupedByDate = useMemo(() => {
    const groups: Record<string, typeof feeTxs> = {};
    feeTxs.forEach(tx => {
      const key = tx.date.split('T')[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(tx);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [feeTxs]);

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

  const timeOptions: { label: string; value: TimePreset }[] = [
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
          <h2 className="text-lg font-bold text-gray-800">手续费统计</h2>
          <button onClick={handleExportCSV} disabled={feeTxs.length === 0} className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition disabled:opacity-30" title="导出CSV">
            <Download size={20} />
          </button>
        </div>

        {/* Time Pills */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {timeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimePreset(opt.value)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                timePreset === opt.value
                  ? 'bg-gray-900 text-white shadow-md'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {timePreset === 'custom' && (
          <div className="flex gap-2 mt-2">
            <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="flex-1 p-2 bg-gray-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-gray-400 self-center text-xs">至</span>
            <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="flex-1 p-2 bg-gray-50 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        )}

        {/* Card Chips */}
        <div className="mt-2 flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
          <button
            onClick={() => setSelectedCardIds([])}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
              selectedCardIds.length === 0 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
            }`}
          >
            全部
          </button>
          {cards.map(c => (
            <button
              key={c.id}
              onClick={() => toggleCard(c.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition ${
                effectiveCardIds.includes(c.id) ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {c.bankName}
            </button>
          ))}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-10 space-y-6">
        {/* Summary Cards (2x2) */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
              <DollarSign size={12} /> 总手续费
            </p>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(stats.totalFees)}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
              <CreditCard size={12} /> 涉及卡片
            </p>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{stats.cardCount}张</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
              <TrendingUp size={12} /> 单笔最高
            </p>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(stats.maxSingle)}</h3>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
            <p className="text-xs text-gray-400 font-medium mb-1 flex items-center gap-1">
              <Calendar size={12} /> 月均手续费
            </p>
            <h3 className="text-xl font-bold text-gray-900 tracking-tight">{formatCurrency(stats.monthlyAvg)}</h3>
          </div>
        </div>

        {/* Per-Card Bar Chart */}
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

        {/* Per-Month Trend */}
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

        {/* Per-Type Breakdown */}
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

        {/* Transaction Detail List */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">手续费明细</h4>
          {groupedByDate.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed">
              <Calendar size={24} className="opacity-20 mb-2" />
              <p className="text-xs">暂无手续费数据</p>
            </div>
          ) : (
            groupedByDate.map(([dateKey, dayTxs]) => (
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
                      <div>
                        <div className="font-bold text-gray-800 text-sm">
                          {tx.merchantType || '未知商户'}
                        </div>
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

        {/* CSV Export Bottom Button */}
        {feeTxs.length > 0 && (
          <button
            onClick={handleExportCSV}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-md hover:bg-blue-700 transition"
          >
            <Download size={18} /> 导出CSV ({feeTxs.length}条记录)
          </button>
        )}
      </div>
    </div>
  );
};
