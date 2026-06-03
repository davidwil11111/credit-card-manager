import React, { useState, useMemo } from 'react';
import { CreditCard } from '../types';
import { X, Save, Calculator } from 'lucide-react';
import { VALID_PERIODS, calculateInstallmentPlan } from '../utils/installment';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface InstallmentFormProps {
  card: CreditCard;
  onClose: () => void;
}

export const InstallmentForm: React.FC<InstallmentFormProps> = ({ card, onClose }) => {
  const handleCreateInstallmentPlan = useAppStore(s => s.handleCreateInstallmentPlan);
  const available = card.fixedLimit - card.currentUnpaid - card.currentUnbilled;

  const [principal, setPrincipal] = useState<number | ''>('');
  const [rate, setRate] = useState<number | ''>(7.2);
  const [periods, setPeriods] = useState<number>(12);
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  const preview = useMemo(() => {
    if (!principal || principal <= 0) return null;
    try {
      return calculateInstallmentPlan(principal, rate === '' ? 0 : rate / 100, periods, startDate, card.billDay);
    } catch {
      return null;
    }
  }, [principal, rate, periods, startDate, card.billDay]);

  const handleSubmit = () => {
    const numPrincipal = Number(principal);
    if (!numPrincipal || numPrincipal <= 0) { alert('请输入有效分期金额'); return; }
    if (numPrincipal > available) { alert('分期金额不能超过可用额度'); return; }
    const numRate = rate === '' ? 0 : Number(rate);
    if (numRate < 0 || numRate > 36) { alert('年化利率需在0-36%之间'); return; }
    if (!VALID_PERIODS.includes(periods)) { alert('请选择有效期数'); return; }

    handleCreateInstallmentPlan(card.id, numPrincipal, numRate / 100, periods, startDate);
    onClose();
  };

  return (
    <div className="absolute inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[90vh]">
        <div className="px-4 py-4 bg-gray-50 border-b flex justify-between items-center shrink-0">
          <h3 className="font-bold text-gray-800">办理分期</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Principal */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">分期金额</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-gray-800 font-bold text-lg">¥</span>
              <input
                type="number" value={principal} onChange={e => setPrincipal(e.target.value ? parseFloat(e.target.value) : '')}
                placeholder="0.00" autoFocus
                className="w-full pl-8 pr-4 py-3 text-2xl font-bold text-gray-800 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">可用额度: {formatCurrency(available)}</p>
          </div>

          {/* Annual Rate */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">年化利率 (%)</label>
            <div className="relative">
              <input
                type="number" value={rate} onChange={e => setRate(e.target.value ? parseFloat(e.target.value) : '')}
                min={0} max={36} step={0.1}
                className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm font-bold"
              />
              <span className="absolute right-3 top-3 text-gray-400 text-sm">%</span>
            </div>
          </div>

          {/* Periods */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">分期期数</label>
            <div className="flex flex-wrap gap-2">
              {VALID_PERIODS.map(n => (
                <button
                  key={n} type="button"
                  onClick={() => setPeriods(n)}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition ${
                    periods === n ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >{n}期</button>
              ))}
            </div>
          </div>

          {/* Start Date */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">起始日期</label>
            <input
              type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-sm"
            />
          </div>

          {/* Preview */}
          {preview && (
            <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
              <div className="flex items-center gap-2 mb-3">
                <Calculator size={16} className="text-purple-600" />
                <span className="text-sm font-bold text-purple-800">还款预览</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-purple-600">月供金额</span>
                <span className="font-bold text-purple-800">{formatCurrency(preview.monthlyPayment)}</span>
              </div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-purple-600">总还款额</span>
                <span className="font-bold text-purple-800">{formatCurrency(preview.monthlyPayment * preview.totalPeriods)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-purple-600">总利息</span>
                <span className="font-bold text-purple-800">
                  {formatCurrency(preview.monthlyPayment * preview.totalPeriods - preview.principal)}
                </span>
              </div>

              {/* Period table */}
              <details className="mt-3">
                <summary className="text-xs text-purple-500 cursor-pointer font-medium">查看每期明细</summary>
                <div className="mt-2 max-h-48 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-purple-500 border-b border-purple-200">
                        <th className="py-1 text-left">期</th>
                        <th className="py-1 text-right">还款日</th>
                        <th className="py-1 text-right">本金</th>
                        <th className="py-1 text-right">利息</th>
                        <th className="py-1 text-right">剩余</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.periods.map(p => (
                        <tr key={p.period} className="border-b border-purple-100 text-gray-700">
                          <td className="py-1">{p.period}</td>
                          <td className="py-1 text-right">{p.dueDate.slice(5)}</td>
                          <td className="py-1 text-right">{p.principal.toFixed(2)}</td>
                          <td className="py-1 text-right">{p.interest.toFixed(2)}</td>
                          <td className="py-1 text-right">{p.remainingPrincipal.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
        </div>

        <div className="p-4 border-t">
          <button
            onClick={handleSubmit}
            disabled={!principal || !preview}
            className="w-full py-4 rounded-xl font-bold text-white bg-purple-600 shadow-lg shadow-purple-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none"
          >
            <Save size={20} /> 确认办理
          </button>
        </div>
      </div>
    </div>
  );
};
