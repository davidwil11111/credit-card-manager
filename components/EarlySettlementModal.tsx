import React, { useMemo } from 'react';
import { InstallmentPlan } from '../types';
import { calculateEarlySettlement } from '../utils/installment';
import { formatCurrency } from '../utils/currency';
import { useAppStore } from '../store';

interface EarlySettlementModalProps {
  plan: InstallmentPlan;
  onClose: () => void;
}

export const EarlySettlementModal: React.FC<EarlySettlementModalProps> = ({ plan, onClose }) => {
  const handleSettle = useAppStore(s => s.handleSettleInstallmentPlan);
  const settlementDate = new Date().toISOString().split('T')[0];

  const settlement = useMemo(
    () => calculateEarlySettlement(plan, settlementDate),
    [plan, settlementDate]
  );

  const handleConfirm = async () => {
    await handleSettle(plan.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-bold text-gray-800">提前结清</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
            <span className="text-xl">×</span>
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">剩余本金</span>
              <span className="font-bold text-gray-800">{formatCurrency(settlement.remainingPrincipal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">逾期未还利息</span>
              <span className="font-bold text-red-600">{formatCurrency(settlement.overdueInterest)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">利息减免</span>
              <span className="font-bold text-green-600">-{formatCurrency(settlement.interestReduction)}</span>
            </div>
            <div className="border-t pt-2 flex justify-between text-sm">
              <span className="font-bold text-gray-700">结清总额</span>
              <span className="font-bold text-lg text-gray-900">{formatCurrency(settlement.settlementAmount)}</span>
            </div>
          </div>

          <p className="text-xs text-gray-400">结清后剩余期数将全部标记为已还，分期计划状态变更为"已结清"。</p>
        </div>

        <div className="p-4 border-t flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
            取消
          </button>
          <button onClick={handleConfirm} className="flex-1 py-2.5 rounded-xl bg-orange-500 text-white font-bold text-sm hover:bg-orange-600 shadow-md">
            确认结清
          </button>
        </div>
      </div>
    </div>
  );
};
