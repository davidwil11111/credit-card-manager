
import React, { useState, useEffect, useRef } from 'react';
import { Overview } from './components/Overview';
import { Detail } from './components/Detail';
import { Statistics } from './components/Statistics';
import { CreditCardForm } from './components/CreditCardForm';
import { TransactionForm } from './components/TransactionForm';
import { SplashScreen } from './components/SplashScreen';
import { ConfirmModal, InputModal, SettingsModal, BackupManagementModal, TempLimitModal } from './components/ui/Modal';
import { LogViewer } from './components/LogViewer';
import { CreditCard, Transaction, POSMachine } from './types';
import { clampDayToMonth } from './constants';
import { database } from './utils/database';
import { logger } from './utils/logger';
import { useAppStore } from './store';
import { notifications } from './utils/notifications';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';

const App: React.FC = () => {
  const [view, setView] = useState<'overview' | 'detail' | 'form' | 'statistics'>('overview');
  const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const isInitializedRef = useRef(false);

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
  const [tempLimitDialog, setTempLimitDialog] = useState<{isOpen: boolean; card: CreditCard | null}>({ isOpen: false, card: null });

  const [swipeOffset, setSwipeOffset] = useState(0);
  const swipeRef = useRef({ startX: 0, startY: 0, isTracking: false });
  const navStateRef = useRef({ view: 'overview' as string, isTransactionFormOpen: false, modalsOpen: false,
    confirmDialogOpen: false, inputDialogOpen: false, backupManagementOpen: false, logViewerOpen: false, settingsOpen: false });
  navStateRef.current = {
    view, isTransactionFormOpen,
    modalsOpen: confirmDialog.isOpen || settingsOpen || inputDialog.isOpen || backupManagementOpen || logViewerOpen,
    confirmDialogOpen: confirmDialog.isOpen, inputDialogOpen: inputDialog.isOpen,
    backupManagementOpen, logViewerOpen, settingsOpen,
  };

  const handleSwipeBack = () => {
    if (confirmDialog.isOpen) { setConfirmDialog(p => ({ ...p, isOpen: false })); }
    else if (inputDialog.isOpen) { setInputDialog(p => ({ ...p, isOpen: false })); }
    else if (backupManagementOpen) { setBackupManagementOpen(false); }
    else if (logViewerOpen) { setLogViewerOpen(false); }
    else if (settingsOpen) { setSettingsOpen(false); }
    else if (isTransactionFormOpen) { setIsTransactionFormOpen(false); }
    else if (view === 'form') { handleFormCancel(); }
    else if (view !== 'overview') { handleBackToOverview(); }
  };
  const handleSwipeBackRef = useRef(handleSwipeBack);
  handleSwipeBackRef.current = handleSwipeBack;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (view === 'overview' || isTransactionFormOpen && (confirmDialog.isOpen || settingsOpen || inputDialog.isOpen)) return;
    const touch = e.touches[0];
    if (touch.clientX < 30) {
      swipeRef.current = { startX: touch.clientX, startY: touch.clientY, isTracking: true };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeRef.current.isTracking) return;
    const touch = e.touches[0];
    const dx = touch.clientX - swipeRef.current.startX;
    const dy = Math.abs(touch.clientY - swipeRef.current.startY);
    if (dx > 10 && dx > dy * 0.5) {
      setSwipeOffset(Math.min(dx, 200));
    } else if (dy > dx) {
      swipeRef.current.isTracking = false;
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!swipeRef.current.isTracking) return;
    swipeRef.current.isTracking = false;
    const dx = e.changedTouches[0].clientX - swipeRef.current.startX;
    if (dx > 80) { handleSwipeBack(); }
    setSwipeOffset(0);
  };

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
        isInitializedRef.current = true;
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
      if (document.visibilityState === 'visible' && isInitializedRef.current) {
        processBillingLogic();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const handleImportData = async (file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const buf = e.target?.result as ArrayBuffer;
        if (!buf || buf.byteLength === 0) { alert('文件为空'); return; }
        const jsonString = new TextDecoder('utf-8').decode(buf);
        if (!jsonString.startsWith('{') && !jsonString.startsWith('[')) {
          alert('不是有效的JSON备份文件，请重新导出。');
          return;
        }
        await database.importFromJson(jsonString);
        await loadFromDatabase();
        setSettingsOpen(false);
        alert('数据恢复成功！');
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err || '');
        logger.error('Import failed:', msg);
        alert('导入失败: ' + (msg || '未知错误'));
      }
    };
    reader.readAsArrayBuffer(file);
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

  // Intercept Android back gesture via native onBackPressed → evaluateJavascript
  useEffect(() => {
    (window as any).__handleBackButton = () => {
      const s = navStateRef.current;
      if (s.view !== 'overview' || s.isTransactionFormOpen || s.modalsOpen) {
        handleSwipeBackRef.current();
      } else {
        CapacitorApp.exitApp();
      }
    };
    return () => { delete (window as any).__handleBackButton; };
  }, []);

  const handleSelectCard = (card: CreditCard) => { setSelectedCard(card); setView('detail'); };
  const handleBackToOverview = () => { setSelectedCard(null); setView('overview'); };
  const handleOpenStatistics = () => { setView('statistics'); };
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
    else if (action === 'adjust_temp_limit') {
      setTempLimitDialog({ isOpen: true, card });
      return;
    }

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

    // Debug: verify jsonStr content on JS side
    logger.info('handleExportData: jsonStr length =', jsonStr.length);
    logger.info('handleExportData: jsonStr starts with =', jsonStr.substring(0, 50));
    try {
      JSON.parse(jsonStr);
      logger.info('handleExportData: jsonStr is parseable JSON');
    } catch (e) {
      logger.error('handleExportData: jsonStr is NOT parseable JSON!', e);
    }

    if (Capacitor.isNativePlatform()) {
      try {
        // Write as base64 to avoid encoding issues with Capacitor Filesystem
        const bytes = new TextEncoder().encode(jsonStr);
        const parts: string[] = [];
        for (let i = 0; i < bytes.length; i += 4096) {
          parts.push(String.fromCharCode(...bytes.subarray(i, i + 4096)));
        }
        const base64Data = btoa(parts.join(''));
        const result = await Filesystem.writeFile({
          path: fileName + '.json',
          data: base64Data,
          directory: Directory.Documents,
        });
        const verify = await Filesystem.readFile({
          path: fileName + '.json',
          directory: Directory.Documents,
          encoding: Encoding.UTF8,
        });
        const vStr = typeof verify.data === 'string' ? verify.data : '';
        logger.info('handleExportData: read-back length =', vStr.length);
        logger.info('handleExportData: read-back first 50 chars =', vStr.substring(0, 50));
        if (vStr.startsWith('{')) {
          alert('备份已保存: Documents/' + fileName + '.json');
        } else {
          logger.error('handleExportData: read-back content mismatch!');
          alert('导出文件异常，请重试');
        }
      } catch (error: any) {
        logger.error('Export failed:', error);
        alert('导出失败：' + (error?.message || error?.toString?.() || '请重试'));
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

  if (showSplash || !isInitialized) {
    return <SplashScreen onComplete={() => setShowSplash(false)} isReady={isInitialized} />;
  }

  return (
    <div
      className="w-full h-screen max-w-md mx-auto bg-gray-100 shadow-2xl overflow-hidden relative safe-area-bottom"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {swipeOffset > 0 && (
        <div className="absolute inset-y-0 left-0 z-50 pointer-events-none flex items-center" style={{ width: swipeOffset }}>
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-transparent" />
          <div className="absolute left-3 w-8 h-8 rounded-full bg-blue-600/30 flex items-center justify-center" style={{ opacity: Math.min(swipeOffset / 80, 1) }}>
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </div>
        </div>
      )}
      {view === 'overview' && (
        <Overview
          onSelectCard={handleSelectCard}
          onAddCard={handleAddCard}
          onEditCard={handleEditCard}
          onDeleteCard={handleDeleteCard}
          onBatchDelete={handleBatchDelete}
          onOpenSettings={() => setSettingsOpen(true)}
          onOpenStatistics={handleOpenStatistics}
        />
      )}
      {view === 'statistics' && (
        <Statistics onBack={handleBackToOverview} />
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
      <TempLimitModal
        isOpen={tempLimitDialog.isOpen}
        defaultAmount={tempLimitDialog.card?.tempLimit || 0}
        defaultExpiry={tempLimitDialog.card?.tempLimitExpiry || ''}
        onConfirm={async (amount, expiry) => {
          if (!tempLimitDialog.card) return;
          const up = { ...tempLimitDialog.card, tempLimit: amount, tempLimitExpiry: expiry };
          await saveData(cards.map(c => c.id === up.id ? up : c));
        }}
        onClose={() => setTempLimitDialog({ isOpen: false, card: null })}
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
