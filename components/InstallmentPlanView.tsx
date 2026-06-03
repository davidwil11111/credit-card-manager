import React, { useState } from 'react';
import { InstallmentPlan } from '../types';
import { formatCurrency } from '../utils/currency';
import { ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { useAppStore } from '../store';

interface InstallmentPlanViewProps {
  cardId: string;
  onOpenSettlement: (plan: InstallmentPlan) => void;
}

export const InstallmentPlanView: React.FC<InstallmentPlanViewProps> = ({ cardId, onOpenSettlement }) => {
  const allPlans = useAppStore(s => s.installmentPlans);
  const plans = allPlans.filter(p => p.cardId === cardId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (plans.length === 0) return null;

  return (
    <div className="space-y-3">
      <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">分期管理</h4>
      {plans.map(plan => (
        <div key={plan.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
          {/* Summary */}
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  plan.status === 'active' ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'
                }`}>
                  {plan.status === 'active' ? '还款中' : '已结清'}
                </span>
                <span className="text-xs text-gray-400">{plan.totalPeriods}期</span>
              </div>
              <p className="font-bold text-gray-800 mt-1">本金 {formatCurrency(plan.principal)}</p>
              <p className="text-xs text-gray-400">
                月供 {formatCurrency(plan.monthlyPayment)} · 年利率 {(plan.annualRate * 100).toFixed(1)}%
              </p>
            </div>
            {plan.status === 'active' && (
              <button
                onClick={() => onOpenSettlement(plan)}
                className="text-xs px-3 py-1.5 rounded-full bg-orange-50 text-orange-600 font-bold hover:bg-orange-100 transition"
              >
                提前结清
              </button>
            )}
            {plan.status === 'settled' && plan.settledDate && (
              <p className="text-xs text-gray-400">结清于 {plan.settledDate}</p>
            )}
          </div>

          {/* Progress */}
          {plan.status === 'active' && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-gray-400 mb-1">
                <span>已还 {plan.periods.filter(p => p.status === 'paid').length}/{plan.totalPeriods} 期</span>
                <span>{plan.periods.filter(p => p.status === 'overdue').length > 0 && `${plan.periods.filter(p => p.status === 'overdue').length}期逾期`}</span>
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${plan.periods.filter(p => p.status === 'overdue').length > 0 ? 'bg-red-400' : 'bg-purple-500'}`}
                  style={{ width: `${(plan.periods.filter(p => p.status !== 'pending').length / plan.totalPeriods) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Expand toggle */}
          <button
            onClick={() => setExpandedId(expandedId === plan.id ? null : plan.id)}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
          >
            {expandedId === plan.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            期次明细
          </button>

          {/* Period table */}
          {expandedId === plan.id && (
            <div className="mt-3 max-h-64 overflow-y-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-100">
                    <th className="py-2 text-left">期号</th>
                    <th className="py-2 text-right">还款日</th>
                    <th className="py-2 text-right">月供</th>
                    <th className="py-2 text-right">本金</th>
                    <th className="py-2 text-right">利息</th>
                    <th className="py-2 text-right">剩余</th>
                    <th className="py-2 text-center">状态</th>
                  </tr>
                </thead>
                <tbody>
                  {plan.periods.map(p => (
                    <tr key={p.period} className="border-b border-gray-50">
                      <td className="py-2 font-medium text-gray-700">{p.period}</td>
                      <td className="py-2 text-right text-gray-600">{p.dueDate.slice(5)}</td>
                      <td className="py-2 text-right text-gray-600">{p.monthlyPayment.toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-700">{p.principal.toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-500">{p.interest.toFixed(2)}</td>
                      <td className="py-2 text-right text-gray-500">{p.remainingPrincipal.toFixed(2)}</td>
                      <td className="py-2 text-center">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                          p.status === 'paid' ? 'bg-green-100 text-green-600' :
                          p.status === 'overdue' ? 'bg-red-100 text-red-600' :
                          'bg-gray-100 text-gray-400'
                        }`}>
                          {p.status === 'paid' ? '已还' : p.status === 'overdue' ? '逾期' : '待还'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  );
};
