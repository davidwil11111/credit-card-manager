
import React, { useState, useEffect } from 'react';
import { Overview } from './components/Overview';
import { Detail } from './components/Detail';
import { Analysis } from './components/Analysis';
import { FeeStatistics } from './components/FeeStatistics';
import { CreditCardForm } from './components/CreditCardForm';
import { TransactionForm } from './components/TransactionForm';
import { SplashScreen } from './components/SplashScreen';
import { ConfirmModal, InputModal, SettingsModal, BackupManagementModal } from './components/ui/Modal';
import { LogViewer } from './components/LogViewer';
import { CreditCard, Transaction, POSMachine } from './types';
import { clampDayToMonth } from './constants';
import { database } from './utils/database';
import { logger } from './utils/logger';
import { useAppStore } from './store';
import { notifications } from './utils/notifications';
import { Capacitor } from '@capacitor/core';

const App: React.FC = () => {
  const [view, setView] = useState<'overview' | 'detail' | 'form' | 'analysis' | 'fee'>('overview');
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const [isTransactionFormOpen, setIsTransactionFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | undefined>(undefined);

  const [confirmDialog, setConfirmDialog] = useState<{isOpen: boolean, title: string, message: string, onConfirm: () => void}>({
      isOpen: false, title: '', message: '', onConfirm: () => {}
  });
  const [inputDialog, setInputDialog] = useState<{isOpen: boolean, title: string, label: string, defaultValue: string, onConfirm: (val: string) => void}>({
      isOpen: false, title: '', label: '', defaultValue: '', onConfirm: () => {}
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [backupManagementOpen, setBackupManagementOpen] = useState(false);
  const [logViewerOpen, setLogViewerOpen] = useState(false);

  const {
    cards, posMachines, selectedCard, notificationEnabled,
    setSelectedCard, loadFromDatabase, saveData,
    handleTransactionSubmit: storeHandleTransactionSubmit,
    handleDeleteTransaction: storeHandleDeleteTransaction, processBillingLogic,
    handleUpdatePOS: storeHandleUpdatePOS, handleToggleNotification: storeHandleToggleNotification,
  } = useAppStore();

  useEffect(() => {
    const initApp = async () => {
      try {
        logger.init();
        logger.info('=== App initialization started ===');

         if (Capacitor.isNativePlatform()) {
           const { StatusBar, Style } = await import('@capacitor/status-bar');
           await StatusBar.setStyle({ style: Style.Light });
          await StatusBar.setBackgroundColor({ color: '#1d4ed8' });
          await StatusBar.hide();
          await StatusBar.show();
          logger.info('Status bar configured');
        }

        await database.init();
        logger.info('Database initialized');

        await loadFromDatabase();
        setIsInitialized(true);
        logger.info('=== App initialization completed ===');
      } catch (error) {
        logger.error('=== Init failed ===');
        logger.error('Error details:', error);
        logger.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
        alert(`初始化失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    };

    initApp();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        processBillingLogic();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isInitialized]);

  const handleImportData = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const jsonString = e.target?.result as string;
        await database.importFromJson(jsonString);
        await loadFromDatabase();
        setSettingsOpen(false);
        alert('数据恢复成功！');
      } catch (err) { 
        logger.error('Import data failed:', err);
        alert('导入失败: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    if (!isInitialized) return;
    
    const interval = setInterval(() => {
      if (notificationEnabled) {
        notifications.checkAndNotify(cards);
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [isInitialized, notificationEnabled, cards]);

  const handleSelectCard = (card: CreditCard) => { setSelectedCard(card); setView('detail'); };
  const handleBackToOverview = () => { setSelectedCard(null); setView('overview'); };
  const handleOpenAnalysis = () => { setView('analysis'); };
  const handleOpenFeeStats = () => { setView('fee'); };
  const handleAddCard = () => { setEditingCard(null); setView('form'); };
  const handleEditCard = (card: CreditCard) => { setEditingCard(card); setView('form'); };

  const handleFormSubmit = async (cardData: CreditCard) => {
    const newCards = editingCard ? cards.map((c: CreditCard) => c.id === cardData.id ? cardData : c) : [...cards, cardData];
    await saveData(newCards);
    handleFormCancel();
  };

  const handleFormCancel = () => {
    setView('overview');
    setEditingCard(null);
  };

  const handleDeleteCard = (id: string) => {
    setConfirmDialog({ isOpen: true, title: '删除卡片', message: '确认删除？', onConfirm: async () => {
      const newCards = cards.filter(c => c.id !== id);
      await saveData(newCards);
      if (selectedCard?.id === id) { setSelectedCard(null); setView('overview'); }
      setConfirmDialog(p => ({ ...p, isOpen: false }));
    }});
  };

  const handleBatchDelete = (ids: string[]) => {
    setConfirmDialog({ isOpen: true, title: '批量删除', message: `确认删除 ${ids.length} 张卡片？`, onConfirm: async () => {
      const idSet = new Set(ids);
      const newCards = cards.filter(c => !idSet.has(c.id));
      await saveData(newCards);
      setConfirmDialog(p => ({ ...p, isOpen: false }));
    }});
  };

  const handleQuickAction = (action: string, card: CreditCard) => {
    let title = '', label = '', defaultValue = '', field: keyof CreditCard | 'available_logic' = 'currentUnpaid';
    if (action === 'adjust_unpaid') { title = '调整欠款'; label = '本期未还金额'; defaultValue = card.currentUnpaid.toString(); field = 'currentUnpaid'; }
    else if (action === 'adjust_limit') { title = '调整额度'; label = '固定额度'; defaultValue = card.fixedLimit.toString(); field = 'fixedLimit'; }
    else if (action === 'adjust_available') { title = '调整可用'; label = '可用额度'; defaultValue = (card.fixedLimit - card.currentUnpaid - card.currentUnbilled).toString(); field = 'available_logic'; }

    setInputDialog({ isOpen: true, title, label, defaultValue, onConfirm: async (val) => {
      const num = parseFloat(val); 
      if (isNaN(num)) return;
      let up = { ...card };
      if (field === 'currentUnpaid') up.currentUnpaid = num;
      else if (field === 'fixedLimit') up.fixedLimit = num;
      else if (field === 'available_logic') up.currentUnpaid = Math.max(0, up.fixedLimit - up.currentUnbilled - num);
      await saveData(cards.map(c => c.id === card.id ? up : c));
      setInputDialog(p => ({ ...p, isOpen: false }));
    }});
  };

  const handleTransactionSubmit = async (txPartial: Partial<Transaction>, cardId: string) => {
    await storeHandleTransactionSubmit(txPartial, cardId);
    setIsTransactionFormOpen(false);
  };

  const handleOpenTransactionForm = () => {
    if (cards.length === 0) {
      alert('请先添加信用卡');
      return;
    }
    if (cards.length === 1) {
      setSelectedCard(cards[0]);
      setEditingTransaction(undefined);
      setIsTransactionFormOpen(true);
    } else {
      alert('请先选择一张信用卡');
    }
  };

  const handleDeleteTransaction = async (card: CreditCard, txId: string) => {
    await storeHandleDeleteTransaction(card, txId);
  };

  const handleUpdatePOS = async (machines: POSMachine[]) => {
    await storeHandleUpdatePOS(machines);
  };

  const handleOpenBackupManagement = () => {
    setBackupManagementOpen(true);
    setSettingsOpen(false);
  };

  const handleOpenLogViewer = () => {
    setLogViewerOpen(true);
    setSettingsOpen(false);
  };

  const handleRestoreBackup = async (index: number) => {
    try {
      await database.restoreAutoBackup(index);
      await loadFromDatabase();
      setBackupManagementOpen(false);
      alert('备份恢复成功');
    } catch (error) {
      logger.error('Restore backup failed:', error);
      alert('备份恢复失败，请重试');
    }
  };

  const handleToggleNotification = (enabled: boolean) => {
    storeHandleToggleNotification(enabled);
  };

  const handleExportData = async () => {
    const fileName = `cc_manager_backup_${new Date().toISOString().split('T')[0]}`;
    const jsonStr = await database.exportToJson();

    if (Capacitor.isNativePlatform()) {
      try {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');

        const result = await Filesystem.writeFile({
          path: fileName + '.json',
          data: jsonStr,
          directory: Directory.Cache,
        });

        await Share.share({
          title: '信用卡管家备份数据',
          text: '信用卡管家数据备份（含完整交易流水）',
          url: result.uri,
        });
      } catch (error) {
        logger.error('Export share failed:', error);
        alert('导出失败，请重试');
      }
    } else {
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${fileName}.json`;
      document.body.appendChild(link);
      link.click();
      setTimeout(() => { document.body.removeChild(link); URL.revokeObjectURL(url); }, 200);
    }
  };

  if (showSplash) {
    return <SplashScreen onComplete={() => setShowSplash(false)} />;
  }

  if (!isInitialized) {
    return <div className="w-full h-screen flex items-center justify-center bg-gray-100">加载中...</div>;
  }

  return (
    <div className="w-full h-screen max-w-md mx-auto bg-gray-100 shadow-2xl overflow-hidden relative safe-area-bottom">
      {view === 'overview' && (
        <Overview
          onSelectCard={handleSelectCard}
          onAddCard={handleAddCard}
          onEditCard={handleEditCard}
          onDeleteCard={handleDeleteCard}
          onBatchDelete={handleBatchDelete}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenAnalysis={handleOpenAnalysis}
          onOpenFeeStats={handleOpenFeeStats}
        />
      )}
      {view === 'analysis' && (
        <Analysis onBack={handleBackToOverview} />
      )}
      {view === 'fee' && (
        <FeeStatistics onBack={handleBackToOverview} />
      )}
      {view === 'detail' && selectedCard && (
        <Detail
          onBack={handleBackToOverview}
          onEdit={handleEditCard}
          onAddTransaction={() => { setEditingTransaction(undefined); setIsTransactionFormOpen(true); }}
          onEditTransaction={(c, tx) => { setEditingTransaction(tx); setIsTransactionFormOpen(true); }}
          onDeleteTransaction={handleDeleteTransaction}
          onQuickAction={handleQuickAction}
          onDeleteCard={handleDeleteCard}
        />
      )}
      {view === 'form' && (
        <CreditCardForm 
          initialData={editingCard} 
          onSubmit={handleFormSubmit} 
          onCancel={handleFormCancel} 
        />
      )}
      {isTransactionFormOpen && selectedCard && (
        <TransactionForm
          card={selectedCard}
          initialData={editingTransaction}
          onClose={() => setIsTransactionFormOpen(false)}
          onSubmit={handleTransactionSubmit}
          onUpdatePOS={handleUpdatePOS}
        />
      )}
      
      <ConfirmModal 
        isOpen={confirmDialog.isOpen} 
        title={confirmDialog.title} 
        message={confirmDialog.message} 
        onConfirm={confirmDialog.onConfirm} 
        onClose={() => setConfirmDialog(p => ({ ...p, isOpen: false }))} 
      />
      <InputModal 
        isOpen={inputDialog.isOpen} 
        title={inputDialog.title} 
        label={inputDialog.label} 
        defaultValue={inputDialog.defaultValue} 
        onConfirm={inputDialog.onConfirm} 
        onClose={() => setInputDialog(p => ({ ...p, isOpen: false }))} 
      />
      <SettingsModal 
        isOpen={settingsOpen} 
        onClose={() => setSettingsOpen(false)} 
        onExport={handleExportData}
        onImport={handleImportData}
        onOpenBackupManagement={handleOpenBackupManagement}
        onOpenLogViewer={handleOpenLogViewer}
        notificationEnabled={notificationEnabled}
        onToggleNotification={handleToggleNotification}
      />
      <BackupManagementModal
        isOpen={backupManagementOpen}
        onClose={() => setBackupManagementOpen(false)}
        backups={database.getAutoBackups()}
        onRestoreBackup={handleRestoreBackup}
      />
      <LogViewer
        isOpen={logViewerOpen}
        onClose={() => setLogViewerOpen(false)}
      />
    </div>
  );
};

export default App;
