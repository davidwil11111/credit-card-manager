
import React, { useState, useEffect } from 'react';
import { CreditCard, Transaction, TransactionType, POSMachine } from '../types';
import { X, Save, Wallet, CreditCard as CardIcon, Settings, Trash2, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../store';
import { transactionSchema } from '../utils/validation';

interface TransactionFormProps {
    card: CreditCard;
    initialData?: Transaction;
    onClose: () => void;
    onSubmit: (transaction: Partial<Transaction>, cardId: string) => void;
    onUpdatePOS: (machines: POSMachine[]) => void;
}

export const TransactionForm: React.FC<TransactionFormProps> = ({
    card,
    initialData,
    onClose,
    onSubmit,
    onUpdatePOS
}) => {
    const posMachines = useAppStore(state => state.posMachines);
    // Mode: 'add_edit' or 'manage_pos'
    const [mode, setMode] = useState<'add_edit' | 'manage_pos'>('add_edit');
    
    // Form State
    const [type, setType] = useState<TransactionType>('consumption');
    const [amount, setAmount] = useState<number | string>('');
    
    const [posId, setPosId] = useState<string>('');
    const [selectedChannelId, setSelectedChannelId] = useState<string>('');
    const [isRealConsumption, setIsRealConsumption] = useState(false);
    const now = new Date();
    const [date, setDate] = useState<string>(now.toISOString().split('T')[0]);
    const [time, setTime] = useState<string>(
      `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    );
    
    useEffect(() => {
        if (initialData) {
            setType(initialData.type);
            setAmount(Math.abs(initialData.amount));
            const d = new Date(initialData.date);
            setDate(d.toISOString().split('T')[0]);
            setTime(
              `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
            );

            if (initialData.type === 'consumption') {
                 if (initialData.cost === 0 && initialData.merchantType === '真实消费') {
                     setIsRealConsumption(true);
                 } else {
                     const pid = initialData.posId || (posMachines.length > 0 ? posMachines[0].id : '');
                     setPosId(pid);
                 }
            }
        } else {
            // Default
            if (posMachines.length > 0) {
              const firstPos = posMachines[0];
              setPosId(firstPos.id);
              setSelectedChannelId(firstPos.channels?.[0]?.id || '');
            }
        }
    }, [initialData, posMachines]);

    // Reset channel when POS changes
    useEffect(() => {
      if (!initialData) {
        const pos = posMachines.find(p => p.id === posId);
        if (pos?.channels?.length) {
          setSelectedChannelId(pos.channels[0].id);
        } else {
          setSelectedChannelId('');
        }
      }
    }, [posId]);

    const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setAmount(e.target.value);
    };

    const handleSubmit = () => {
        const numAmount = parseFloat(amount.toString());
        if (!numAmount || numAmount <= 0) {
          alert('请输入有效金额');
          return;
        }
        const typeCheck = transactionSchema.shape.type.safeParse(type);
        if (!typeCheck.success) {
          alert('请选择有效交易类型');
          return;
        }

        let finalCost = 0;
        let finalActualReceipt = 0;
        let merchantType = '';
        let channel = '';
        let finalAmount = 0;
        let notes = '';

        if (type === 'consumption') {
            finalAmount = -numAmount;
            
            if (isRealConsumption) {
                finalCost = 0;
                finalActualReceipt = numAmount;
                merchantType = '真实消费';
                channel = '真实消费';
                notes = '新增真实消费';
            } else {
                const pos = posMachines.find(p => p.id === posId);
                if (pos) {
                    const ch = selectedChannelId ? pos.channels?.find(c => c.id === selectedChannelId) : undefined;
                    const effRate = ch?.rate ?? pos.rate;
                    const effFixedFee = ch?.fixedFee ?? pos.fixedFee;
                    finalCost = numAmount * effRate + effFixedFee;
                    finalActualReceipt = numAmount - finalCost;
                    merchantType = pos.name;
                    channel = ch?.name || pos.name;
                    notes = 'POS消费';
                } else {
                    finalActualReceipt = numAmount;
                }
            }
        } else if (type === 'repayment') {
            finalAmount = numAmount;
            merchantType = '还款';
            channel = '手机银行';
            notes = '新增还款';
        } 

        const transaction: Partial<Transaction> = {
            id: initialData?.id, 
            amount: finalAmount,
            type,
            date: new Date(`${date}T${time}:00`).toISOString(),
            merchantType,
            channel,
            cost: parseFloat(finalCost.toFixed(2)),
            actualReceipt: parseFloat(finalActualReceipt.toFixed(2)),
            notes: initialData?.notes || notes, 
            posId: (!isRealConsumption && type === 'consumption') ? posId : undefined
        };

        onSubmit(transaction, card.id);
    };

    // --- POS Management Logic ---
    const [newPOS, setNewPOS] = useState({ name: '', rate: 0.6, fixed: 0 });
    const handleAddPOS = () => {
        if (!newPOS.name) return;
        const machine: POSMachine = {
            id: `pos-${Date.now()}`,
            name: newPOS.name,
            rate: newPOS.rate / 100, // Convert percentage
            fixedFee: newPOS.fixed
        };
        onUpdatePOS([...posMachines, machine]);
        setNewPOS({ name: '', rate: 0.6, fixed: 0 });
    };
    
    const handleDeletePOS = (id: string) => {
        onUpdatePOS(posMachines.filter(p => p.id !== id));
    };
    
    const handleUpdatePOSRate = (id: string, newRatePercent: number) => {
         onUpdatePOS(posMachines.map(p => p.id === id ? { ...p, rate: newRatePercent / 100 } : p));
    };

    // Calculate preview values
    const numAmountPreview = parseFloat(amount.toString()) || 0;
    const selectedPos = posMachines.find(p => p.id === posId);
    const selectedChannel = selectedChannelId ? selectedPos?.channels?.find(c => c.id === selectedChannelId) : undefined;
    const effRate = selectedChannel?.rate ?? selectedPos?.rate ?? 0;
    const effFixedFee = selectedChannel?.fixedFee ?? selectedPos?.fixedFee ?? 0;
    const previewCost = (type === 'consumption' && !isRealConsumption && selectedPos)
        ? (numAmountPreview * effRate + effFixedFee)
        : 0;
    const previewReceipt = (type === 'consumption') ? numAmountPreview - previewCost : numAmountPreview;

    if (mode === 'manage_pos') {
        return (
            <div className="absolute inset-0 z-50 bg-white sm:rounded-2xl flex flex-col animate-in slide-in-from-right duration-200 safe-area-top safe-area-bottom">
                <div className="px-4 py-4 bg-gray-50 border-b flex items-center justify-center shrink-0">
                    <button onClick={() => setMode('add_edit')} className="absolute left-4 p-2 -ml-2 text-blue-600 font-medium text-sm flex items-center gap-1">
                        <ArrowLeft size={18} />
                        返回
                    </button>
                    <h3 className="font-bold text-gray-800">管理 POS 机</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4 scroll-container">
                     {/* Add New */}
                     <div className="bg-gray-50 p-3 rounded-xl border border-dashed border-gray-300">
                         <h4 className="text-xs font-bold text-gray-500 mb-2">新增设备</h4>
                         <div className="grid grid-cols-3 gap-2 mb-2">
                             <input 
                                className="p-2 rounded border text-sm col-span-3" 
                                placeholder="名称 (如: 小票机)"
                                value={newPOS.name}
                                onChange={e => setNewPOS({...newPOS, name: e.target.value})}
                             />
                             <div className="relative">
                                 <input 
                                    type="number" className="w-full p-2 rounded border text-sm" placeholder="费率"
                                    value={newPOS.rate} onChange={e => setNewPOS({...newPOS, rate: parseFloat(e.target.value)})}
                                 />
                                 <span className="absolute right-2 top-2 text-xs text-gray-400">%</span>
                             </div>
                             <div className="relative">
                                 <input 
                                    type="number" className="w-full p-2 rounded border text-sm" placeholder="单笔"
                                    value={newPOS.fixed} onChange={e => setNewPOS({...newPOS, fixed: parseFloat(e.target.value)})}
                                 />
                                 <span className="absolute right-2 top-2 text-xs text-gray-400">元</span>
                             </div>
                             <button onClick={handleAddPOS} className="bg-blue-600 text-white rounded p-2 text-sm font-bold flex items-center justify-center">添加</button>
                         </div>
                     </div>

                     {/* List */}
                     <div className="space-y-2">
                         {posMachines.map(pos => (
                             <div key={pos.id} className="flex items-center justify-between bg-white border p-3 rounded-lg shadow-sm">
                                 <div>
                                     <div className="font-bold text-sm text-gray-800">{pos.name}</div>
                                     <div className="text-xs text-gray-400">当前: {(pos.rate * 100).toFixed(2)}% + {pos.fixedFee}</div>
                                 </div>
                                 <div className="flex items-center gap-2">
                                     <input 
                                        type="number" 
                                        className="w-16 p-1 text-xs border rounded text-center bg-gray-50"
                                        value={(pos.rate * 100).toFixed(2)}
                                        onChange={(e) => handleUpdatePOSRate(pos.id, parseFloat(e.target.value))}
                                     />
                                     <span className="text-xs text-gray-400">%</span>
                                     <button onClick={() => handleDeletePOS(pos.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                                         <Trash2 size={16}/>
                                     </button>
                                 </div>
                             </div>
                         ))}
                     </div>
                </div>
            </div>
        );
    }

    return (
        <div className="absolute inset-0 z-50 bg-gray-900/50 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-200 flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-4 py-4 bg-gray-50 border-b flex justify-between items-center shrink-0 safe-area-inset-top">
                    <h3 className="font-bold text-gray-800">{initialData ? '编辑记录' : '记一笔'}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200">
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Main Scroller */}
                <div className="flex-1 overflow-y-auto">
                    {/* Type Tabs */}
                    <div className="p-4 grid grid-cols-2 gap-2">
                        <button 
                            onClick={() => setType('consumption')}
                            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition ${
                                type === 'consumption' 
                                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            <CardIcon size={16} />
                            消费
                        </button>
                        <button 
                            onClick={() => setType('repayment')}
                            className={`flex flex-col items-center justify-center gap-1 py-2 rounded-xl text-xs font-bold transition ${
                                type === 'repayment' 
                                ? 'bg-green-600 text-white shadow-lg shadow-green-500/30' 
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            <Wallet size={16} />
                            还款
                        </button>
                    </div>

                    <div className="px-6 pb-6 space-y-4">
                        
                        {/* Amount */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                金额
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-800 font-bold text-lg">¥</span>
                                <input 
                                    type="number" 
                                    value={amount}
                                    onChange={handleAmountChange}
                                    placeholder="0.00"
                                    autoFocus
                                    className="w-full pl-8 pr-4 py-3 text-2xl font-bold text-gray-800 bg-gray-50 border-none rounded-xl focus:ring-2 focus:ring-green-500 outline-none"
                                />
                            </div>
                            {type === 'repayment' && (
                                <div className="mt-2 flex justify-between items-center p-3 bg-green-50 rounded-lg border border-green-100">
                                    <span className="text-xs text-green-600">当期剩余未还</span>
                                    <span className="text-lg font-bold text-green-700">¥{card.currentUnpaid.toLocaleString()}</span>
                                </div>
                            )}
                        </div>

                        {/* Date & Time */}
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">日期 & 时间</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                                <input
                                    type="time"
                                    value={time}
                                    onChange={(e) => setTime(e.target.value)}
                                    className="p-3 bg-gray-50 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                />
                            </div>
                        </div>

                        {/* Logic for Consumption */}
                        {type === 'consumption' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-gray-500">类型选择</label>
                                    <div className="flex items-center gap-2">
                                         <label className="flex items-center gap-1 text-xs cursor-pointer">
                                             <input type="checkbox" checked={isRealConsumption} onChange={(e) => setIsRealConsumption(e.target.checked)} />
                                             真实消费 (0费率)
                                         </label>
                                    </div>
                                </div>

                                {!isRealConsumption && (
                                    <>
                                        <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-gray-600">选择 POS 机</span>
                                                <button onClick={() => setMode('manage_pos')} className="text-xs text-blue-600 flex items-center gap-1">
                                                    <Settings size={12}/> 管理/费率
                                                </button>
                                            </div>
                                            <select 
                                                value={posId} 
                                                onChange={(e) => setPosId(e.target.value)}
                                                className="w-full p-2 bg-white rounded-lg outline-none border border-gray-200 text-sm appearance-none"
                                            >
                                                {posMachines.map(pos => (
                                                    <option key={pos.id} value={pos.id}>
                                                        {pos.name} ({(pos.rate * 100).toFixed(2)}% + ¥{pos.fixedFee})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Channel Selector */}
                                        {selectedPos?.channels && selectedPos.channels.length > 0 && (
                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                                <span className="text-xs font-bold text-gray-600 block mb-2">支付通道</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {selectedPos.channels.map(ch => (
                                                        <button
                                                            key={ch.id}
                                                            type="button"
                                                            onClick={() => setSelectedChannelId(ch.id)}
                                                            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                                                                selectedChannelId === ch.id
                                                                    ? 'bg-blue-600 text-white shadow-sm'
                                                                    : 'bg-white text-gray-600 border border-gray-200 hover:border-blue-300'
                                                            }`}
                                                        >
                                                            {ch.name} ({(ch.rate * 100).toFixed(2)}%{ch.fixedFee > 0 ? ` + ¥${ch.fixedFee}` : ''})
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Fee Preview */}
                                        {numAmountPreview > 0 && (
                                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                                                <div className="grid grid-cols-3 gap-4">
                                                    <div className="text-center">
                                                        <p className="text-xs text-blue-600">消费金额</p>
                                                        <p className="text-sm font-bold text-blue-800">¥{numAmountPreview.toFixed(2)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-blue-600">手续费</p>
                                                        <p className="text-sm font-bold text-blue-800">¥{previewCost.toFixed(2)}</p>
                                                    </div>
                                                    <div className="text-center">
                                                        <p className="text-xs text-blue-600">实际到账</p>
                                                        <p className="text-sm font-bold text-blue-800">¥{previewReceipt.toFixed(2)}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                        
                        <button 
                            onClick={handleSubmit}
                            disabled={!numAmountPreview}
                            className={`w-full py-4 rounded-xl font-bold text-white shadow-xl mt-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:shadow-none ${
                                type === 'consumption' ? 'bg-blue-600 shadow-blue-500/30' : 
                                'bg-green-600 shadow-green-500/30'
                            }`}
                        >
                            <Save size={20} />
                            {initialData ? '保存修改' : '确认新增'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
