
import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Download, MessageCircle, History, RotateCcw, Bell, FileText } from 'lucide-react';

interface BaseModalProps {
    isOpen: boolean;
    title: string;
    onClose: () => void;
    children: React.ReactNode;
}

const BaseModal: React.FC<BaseModalProps> = ({ isOpen, title, onClose, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200 safe-area-bottom">
                <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">{title}</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 max-h-[80vh] overflow-y-auto no-scrollbar scroll-container">
                    {children}
                </div>
            </div>
        </div>
    );
};

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onClose: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({ 
    isOpen, 
    title, 
    message, 
    onConfirm, 
    onClose,
    confirmText = "确认删除",
    cancelText = "取消",
    isDanger = true
}) => {
    return (
        <BaseModal isOpen={isOpen} title={title} onClose={onClose}>
            <p className="text-gray-600 mb-6 text-sm">{message}</p>
            <div className="flex gap-3">
                <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">
                    {cancelText}
                </button>
                <button 
                    onClick={() => { onConfirm(); onClose(); }} 
                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm text-white shadow-md transition ${
                        isDanger 
                        ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                        : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20'
                    }`}
                >
                    {confirmText}
                </button>
            </div>
        </BaseModal>
    );
};

interface InputModalProps {
    isOpen: boolean;
    title: string;
    label: string;
    defaultValue?: string;
    onConfirm: (value: string) => void;
    onClose: () => void;
}

export const InputModal: React.FC<InputModalProps> = ({ isOpen, title, label, defaultValue = '', onConfirm, onClose }) => {
    const [value, setValue] = React.useState(defaultValue);
    useEffect(() => { if (isOpen) setValue(defaultValue); }, [isOpen, defaultValue]);
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm(value);
        onClose();
    };
    return (
        <BaseModal isOpen={isOpen} title={title} onClose={onClose}>
            <form onSubmit={handleSubmit}>
                <label className="block text-xs font-bold text-gray-500 mb-2">{label}</label>
                <input autoFocus type="number" step="0.01" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none mb-6" value={value} onChange={(e) => setValue(e.target.value)} />
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-medium text-sm hover:bg-gray-50">取消</button>
                    <button type="submit" disabled={!value} className="flex-1 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 shadow-md shadow-blue-500/20 disabled:opacity-50">确认</button>
                </div>
            </form>
        </BaseModal>
    );
};

interface ExportChoiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExportToLocal: () => void;
    onExportShare: () => void;
}

export const ExportChoiceModal: React.FC<ExportChoiceModalProps> = ({
    isOpen,
    onClose,
    onExportToLocal,
    onExportShare
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95 duration-200 safe-area-bottom">
                <div className="px-4 py-3 border-b flex justify-between items-center bg-gray-50">
                    <h3 className="font-bold text-gray-800">选择导出方式</h3>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200 text-gray-500">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-4 space-y-3">
                    <button 
                        onClick={() => { onExportToLocal(); onClose(); }}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-blue-50 active:scale-95 transition group"
                    >
                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition">
                            <Download size={20} className="text-blue-600"/>
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-gray-800">保存到本地</p>
                            <p className="text-xs text-gray-500">保存到Download文件夹</p>
                        </div>
                    </button>
                    
                    <button 
                        onClick={() => { onExportShare(); onClose(); }}
                        className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:bg-green-50 active:scale-95 transition group"
                    >
                        <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center group-hover:bg-green-200 transition">
                            <MessageCircle size={20} className="text-green-600"/>
                        </div>
                        <div className="text-left flex-1">
                            <p className="text-sm font-bold text-gray-800">分享文件</p>
                            <p className="text-xs text-gray-500">通过其他应用分享</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExport: () => void;
    onImport: (file: File) => void;
    onOpenBackupManagement: () => void;
    onOpenLogViewer: () => void;
    notificationEnabled: boolean;
    onToggleNotification: (enabled: boolean) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, 
    onClose, 
    onExport,
    onImport,
    onOpenBackupManagement,
    onOpenLogViewer,
    notificationEnabled,
    onToggleNotification
}) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [requestingPermission, setRequestingPermission] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            onImport(e.target.files[0]);
            e.target.value = ''; 
        }
    };

    const handleToggleNotification = async () => {
        if (!notificationEnabled) {
            setRequestingPermission(true);
            const { notifications } = await import('../../utils/notifications');
            const granted = await notifications.requestPermission();
            setRequestingPermission(false);
            
            if (granted) {
                onToggleNotification(true);
            } else {
                alert('无法获取通知权限，请在浏览器设置中允许通知');
            }
        } else {
            onToggleNotification(false);
        }
    };

    return (
        <BaseModal isOpen={isOpen} title="数据备份" onClose={onClose}>
            <div className="space-y-5 pb-4">
                <div className="grid grid-cols-2 gap-3">
                    <button onClick={onExport} className="flex flex-col items-center gap-2 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition text-gray-700 font-bold">
                        <Download size={20} className="text-blue-600"/><span className="text-xs">导出备份</span>
                    </button>
                    <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 py-3 rounded-xl border border-gray-200 hover:bg-gray-50 active:scale-95 transition text-gray-700 font-bold">
                        <Upload size={20} className="text-green-600"/><span className="text-xs">导入备份</span>
                    </button>
                </div>
                
                <input type="file" ref={fileInputRef} accept=".json,.db" className="hidden" onChange={handleFileChange} />
                
                <button onClick={onOpenBackupManagement} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-blue-200 hover:bg-blue-50 active:scale-95 transition text-blue-700 font-bold">
                    <History size={20} /><span className="text-xs">自动备份管理</span>
                </button>

                <button onClick={onOpenLogViewer} className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-purple-200 hover:bg-purple-50 active:scale-95 transition text-purple-700 font-bold">
                    <FileText size={20} /><span className="text-xs">系统日志</span>
                </button>

                <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2">
                            <Bell size={16} className={notificationEnabled ? "text-blue-600" : "text-gray-400"} />
                            <div className="text-left">
                                <p className="text-xs font-bold text-gray-700">还款提醒</p>
                                <p className="text-[10px] text-gray-400">还款日前自动提醒</p>
                            </div>
                        </div>
                        <button 
                            onClick={handleToggleNotification}
                            disabled={requestingPermission}
                            className={`relative w-12 h-6 rounded-full transition-colors ${
                                notificationEnabled ? 'bg-blue-600' : 'bg-gray-300'
                            } ${requestingPermission ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                                notificationEnabled ? 'left-7' : 'left-1'
                            }`} />
                        </button>
                    </div>
                </div>
                
                <div className="pt-2 text-center">
                    <p className="text-[10px] text-gray-400 bg-gray-50 p-2 rounded-lg leading-loose">
                        导出JSON格式备份。点击"导出"后在分享界面选择"保存到文件"即可下载到本地。支持导入旧版本JSON备份。
                    </p>
                </div>

                <div className="pt-3 border-t border-gray-100">
                    <div className="flex items-center justify-center gap-2 text-gray-500">
                        <MessageCircle size={16} className="text-green-500" />
                        <span className="text-xs">联系作者：</span>
                        <span className="text-sm font-bold text-gray-700 select-all">unreach</span>
                    </div>
                    <p className="text-[10px] text-gray-400 text-center mt-1">如有问题或建议，欢迎添加微信反馈</p>
                </div>
            </div>
        </BaseModal>
    );
};

interface AutoBackup {
    timestamp: string;
    data: {
        cards: Array<{ id: string; index: number; holderName: string; bankName: string; cardNumber: string; billDay: number; repaymentConfig: unknown; fixedLimit: number; tempLimit: number; currentUnpaid: number; currentUnbilled: number; lastStatementDate?: string; repaymentDate?: string; status?: string; transactions: unknown[] }>;
        posMachines: Array<{ id: string; name: string; rate: number; fixedFee: number }>;
        version: string;
        type?: 'auto' | 'manual';
    };
}

interface BackupManagementModalProps {
    isOpen: boolean;
    onClose: () => void;
    backups: AutoBackup[];
    onRestoreBackup: (index: number) => void;
}

export const BackupManagementModal: React.FC<BackupManagementModalProps> = ({
    isOpen,
    onClose,
    backups,
    onRestoreBackup
}) => {
    const formatTime = (isoString: string) => {
        const date = new Date(isoString);
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        return `${month}-${day} ${hours}:${minutes}`;
    };

    const getBackupSize = (backup: AutoBackup) => {
        return Math.round(JSON.stringify(backup.data).length / 1024);
    };

    return (
        <BaseModal isOpen={isOpen} title="自动备份管理" onClose={onClose}>
            <div className="space-y-3 pb-4">
                {backups.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                        <p className="text-sm">暂无自动备份</p>
                        <p className="text-xs mt-2">每次操作时会自动创建备份</p>
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-gray-500 text-center">
                            已保存 {backups.length}/5 个自动备份
                        </p>
                        {backups.map((backup, index) => (
                            <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-bold text-gray-600">#{index + 1}</span>
                                        <span className="text-xs text-gray-500">{formatTime(backup.timestamp)}</span>
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {backup.data.cards?.length || 0} 张卡片 • {getBackupSize(backup)} KB
                                    </p>
                                </div>
                                <button 
                                    onClick={() => onRestoreBackup(index)}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded-lg hover:bg-blue-700 active:scale-95 transition"
                                >
                                    <RotateCcw size={12} />
                                    恢复
                                </button>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </BaseModal>
    );
};
