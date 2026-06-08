
import React, { useState, useEffect, useRef } from 'react';
import { CreditCard } from '../types';
import { MOCK_BANKS, calculateNextRepaymentDate, calculateCardStatus } from '../constants';
import { creditCardFormSchema } from '../utils/validation';
import { Save } from 'lucide-react';
import { ConfirmModal } from './ui/Modal';

interface CreditCardFormProps {
  initialData?: CreditCard | null;
  onSubmit: (card: CreditCard) => void;
  onCancel: () => void;
}

export const CreditCardForm: React.FC<CreditCardFormProps> = ({ initialData, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<Partial<CreditCard>>({
    holderName: '',
    bankName: '',
    cardNumber: '',
    billDay: 1,
    repaymentConfig: { type: 'days_after_bill', value: 20 },
    fixedLimit: 0,
    tempLimit: 0,
    tempLimitExpiry: '',
    currentUnpaid: 0,
    currentUnbilled: 0,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const lastGoodRef = useRef<Partial<CreditCard>>({});
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialData) {
      const d = { ...initialData };
      setFormData(d);
      lastGoodRef.current = d;
    }
  }, [initialData]);

  const handleChange = (field: keyof CreditCard, value: string | number) => {
    setFormData((prev: Partial<CreditCard>) => {
      const prevVal = prev[field];
      if (prevVal !== undefined && prevVal !== '' && prevVal !== 0 && (value === '' || value === undefined)) {
        return { ...prev };
      }
      const next = { ...prev, [field]: value } as Partial<CreditCard>;
      lastGoodRef.current = next;
      return next;
    });
    setIsDirty(true);
    if (errors[field]) {
      setErrors((prev): Record<string, string> => {
        const newErrors: Record<string, string> = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleRepaymentConfigChange = (type: 'fixed_day' | 'days_after_bill', value: number) => {
      setFormData((prev): Partial<CreditCard> => ({
        ...prev,
        repaymentConfig: { type, value } as CreditCard['repaymentConfig']
      }));
      setIsDirty(true);
  };

  const validate = () => {
    const result = creditCardFormSchema.safeParse({
      holderName: formData.holderName,
      bankName: formData.bankName,
      cardNumber: formData.cardNumber,
      billDay: formData.billDay,
    });
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const field = issue.path[0] as string;
        newErrors[field] = issue.message;
      });
      setErrors(newErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = () => {
    if (validate()) {
      const calculatedRepaymentDate = calculateNextRepaymentDate(
          formData.billDay || 1, 
          formData.repaymentConfig || { type: 'days_after_bill', value: 20 }
      );
      
      const calculatedStatus = calculateCardStatus(
          formData.currentUnpaid || 0,
          calculatedRepaymentDate
      );

      const safeNumber = (val: any) => {
          const num = parseFloat(val);
          return isNaN(num) ? 0 : num;
      };

      // --- CRITICAL FIX: Last Statement Date Logic ---
      let lastStatementDate = formData.lastStatementDate;
      if (!lastStatementDate) {
          const now = new Date();
          const billDay = formData.billDay || 1;
          
          // Determine if we should set last statement to "last month's bill day" 
          // to allow App.tsx logic to trigger an immediate update if today IS bill day.
          const lastMonthBill = new Date(now.getFullYear(), now.getMonth() - 1, billDay);
          lastMonthBill.setHours(0, 0, 0, 0);
          lastStatementDate = lastMonthBill.toISOString();
      }

      const submission = {
        ...formData,
        id: formData.id || `card-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        index: formData.index || 0, 
        transactions: formData.transactions || [],
        repaymentDate: calculatedRepaymentDate,
        status: calculatedStatus,
        lastStatementDate: lastStatementDate,
        fixedLimit: safeNumber(formData.fixedLimit),
        tempLimit: safeNumber(formData.tempLimit),
        currentUnpaid: safeNumber(formData.currentUnpaid),
        currentUnbilled: safeNumber(formData.currentUnbilled),
      } as CreditCard;
      
      onSubmit(submission);
    }
  };

  const handleCancelClick = () => {
      if (isDirty) setShowCancelModal(true);
      else onCancel();
  };

  return (
    <div className="flex flex-col h-full bg-gray-50">
      <div className="bg-white px-4 py-4 pt-14 shadow-sm flex items-center justify-between sticky top-0 z-30 safe-area-top">
        <button onClick={handleCancelClick} className="text-gray-500 font-medium">取消</button>
        <h2 className="text-lg font-bold">{initialData ? '编辑卡片' : '新增卡片'}</h2>
        <button onClick={handleSubmit} className="text-blue-600 font-bold flex items-center gap-1">
          <Save size={18} /> 保存
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-20">
        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
          <h3 className="text-sm font-bold text-gray-800 mb-4 border-l-4 border-blue-500 pl-2">基础信息</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">持卡人</label>
              <input 
                type="text"
                ref={nameInputRef}
                value={formData.holderName}
                onChange={(e) => handleChange('holderName', e.target.value)}
                className={`w-full p-2 rounded-lg border bg-gray-50 ${errors.holderName ? 'border-red-500' : 'border-gray-200'}`}
                placeholder="姓名"
              />
              {errors.holderName && <p className="text-xs text-red-500 mt-1">{errors.holderName}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">银行</label>
              <input list="bank-list" type="text" value={formData.bankName} onChange={(e) => handleChange('bankName', e.target.value)} className={`w-full p-2 rounded-lg border bg-gray-50 ${errors.bankName ? 'border-red-500' : 'border-gray-200'}`} placeholder="选择或输入" />
              <datalist id="bank-list">{MOCK_BANKS.map(bank => <option key={bank} value={bank} />)}</datalist>
              {errors.bankName && <p className="text-xs text-red-500 mt-1">{errors.bankName}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">卡号后4位</label>
              <input type="text" maxLength={4} value={formData.cardNumber} onChange={(e) => handleChange('cardNumber', e.target.value.replace(/\D/g, ''))} className={`w-full p-2 rounded-lg border bg-gray-50 font-mono ${errors.cardNumber ? 'border-red-500' : 'border-gray-200'}`} placeholder="8888" />
              {errors.cardNumber && <p className="text-xs text-red-500 mt-1">{errors.cardNumber}</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">账单日</label>
                    <select value={formData.billDay} onChange={(e) => handleChange('billDay', parseInt(e.target.value))} className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50">
                        {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>每月 {d} 日</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">固定额度</label>
                    <input type="number" step="0.01" value={formData.fixedLimit || ''} onChange={(e) => handleChange('fixedLimit', parseFloat(e.target.value))} className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50" placeholder="0.00" />
                </div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <label className="block text-xs text-gray-500 mb-2">还款日设置</label>
                <div className="flex flex-col gap-3">
                    <label className="flex items-center gap-2">
                        <input type="radio" checked={formData.repaymentConfig?.type === 'fixed_day'} onChange={() => handleRepaymentConfigChange('fixed_day', 10)} className="text-blue-600" />
                        <span className="text-sm">每月固定</span>
                        {formData.repaymentConfig?.type === 'fixed_day' && (
                             <select value={formData.repaymentConfig.value} onChange={(e) => handleRepaymentConfigChange('fixed_day', parseInt(e.target.value))} className="ml-auto text-sm p-1 border rounded">
                                 {Array.from({length: 31}, (_, i) => i + 1).map(d => <option key={d} value={d}>{d} 日</option>)}
                             </select>
                        )}
                    </label>
                    <label className="flex items-center gap-2">
                        <input type="radio" checked={formData.repaymentConfig?.type === 'days_after_bill'} onChange={() => handleRepaymentConfigChange('days_after_bill', 20)} className="text-blue-600" />
                        <span className="text-sm">账单日后 N 天</span>
                        {formData.repaymentConfig?.type === 'days_after_bill' && (
                            <div className="ml-auto flex items-center gap-1">
                                <input type="number" value={formData.repaymentConfig.value} onChange={(e) => handleRepaymentConfigChange('days_after_bill', parseInt(e.target.value))} className="w-12 p-1 text-sm border rounded text-center" />
                                <span className="text-xs">天</span>
                            </div>
                        )}
                    </label>
                </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
           <h3 className="text-sm font-bold text-gray-800 mb-4 border-l-4 border-orange-400 pl-2">初始账单 (选填)</h3>
           <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs text-gray-500 mb-1">本期已出未还</label>
                    <input type="number" step="0.01" value={formData.currentUnpaid || ''} onChange={(e) => handleChange('currentUnpaid', parseFloat(e.target.value))} className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50" placeholder="0.00" />
                </div>
                <div>
                    <label className="block text-xs text-gray-500 mb-1">未出账单总额</label>
                    <input type="number" step="0.01" value={formData.currentUnbilled || ''} onChange={(e) => handleChange('currentUnbilled', parseFloat(e.target.value))} className="w-full p-2 rounded-lg border border-gray-200 bg-gray-50" placeholder="0.00" />
                </div>
           </div>
        </section>
      </div>

      <ConfirmModal isOpen={showCancelModal} title="放弃修改" message="确认放弃当前的更改吗？" confirmText="放弃" cancelText="返回" isDanger={false} onConfirm={onCancel} onClose={() => setShowCancelModal(false)} />
    </div>
  );
};
