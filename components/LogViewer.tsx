import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';
import { Capacitor } from '@capacitor/core';

interface LogViewerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface LogEntry {
  timestamp: string;
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  data?: any;
}

export const LogViewer: React.FC<LogViewerProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'error' | 'warn' | 'info'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = () => {
    setLogs(logger.getLogs());
  };

  const handleClearLogs = () => {
    if (confirm('确认清空所有日志？')) {
      logger.clearLogs();
      setLogs([]);
    }
  };

  const handleExportLogs = async () => {
    const logData = logger.exportLogs();
    const fileName = `credit-card-logs-${new Date().toISOString().slice(0, 10)}.json`;
    
     try {
       if (Capacitor.isNativePlatform()) {
         const { Filesystem, FilesystemDirectory, FilesystemEncoding } = await import('@capacitor/filesystem');
         
         const result = await Filesystem.writeFile({
           path: fileName,
           data: logData,
           directory: FilesystemDirectory.Documents,
           encoding: FilesystemEncoding.UTF8
         });
        
        try {
          const { Share } = await import('@capacitor/share');
          await Share.share({
            title: '信用卡管理日志',
            text: '导出的应用日志',
            url: result.uri
          });
        } catch (shareError) {
          alert(`日志已保存到: ${result.uri}`);
        }
      } else {
        const blob = new Blob([logData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (error) {
      logger.error('Export failed:', error);
      alert('导出失败: ' + (error instanceof Error ? error.message : String(error)));
    }
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error': return '#ef4444';
      case 'warn': return '#f59e0b';
      case 'info': return '#3b82f6';
      default: return '#6b7280';
    }
  };

  const getLevelIcon = (level: string): string => {
    switch (level) {
      case 'error': return '❌';
      case 'warn': return '⚠️';
      case 'info': return 'ℹ️';
      default: return '📝';
    }
  };

  const formatTime = (timestamp: string): string => {
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const filteredLogs = logs.filter(log => {
    const matchesFilter = filter === 'all' || log.level === filter;
    const matchesSearch = !searchTerm || 
      log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.data && JSON.stringify(log.data).toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  const errorCount = logs.filter(l => l.level === 'error').length;
  const warnCount = logs.filter(l => l.level === 'warn').length;

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 'bold' }}>系统日志</h2>
            <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              共 {logs.length} 条日志
              {errorCount > 0 && <span style={{ color: '#ef4444', marginLeft: '8px' }}>❌ {errorCount} 错误</span>}
              {warnCount > 0 && <span style={{ color: '#f59e0b', marginLeft: '8px' }}>⚠️ {warnCount} 警告</span>}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: '#6b7280'
            }}
          >
            ×
          </button>
        </div>

        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap'
        }}>
          <input
            type="text"
            placeholder="搜索日志..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              minWidth: '200px',
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px'
            }}
          />
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as any)}
            style={{
              padding: '8px 12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'white'
            }}
          >
            <option value="all">全部</option>
            <option value="error">仅错误</option>
            <option value="warn">仅警告</option>
            <option value="info">仅信息</option>
          </select>

          <button
            onClick={loadLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            刷新
          </button>

          <button
            onClick={handleExportLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#10b981',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            导出
          </button>

          <button
            onClick={handleClearLogs}
            style={{
              padding: '8px 16px',
              backgroundColor: '#ef4444',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            清空
          </button>
        </div>

        <div style={{
          flex: 1,
          overflow: 'auto',
          padding: '16px',
          backgroundColor: '#f9fafb'
        }}>
          {filteredLogs.length === 0 ? (
            <div style={{
              textAlign: 'center',
              color: '#9ca3af',
              padding: '40px'
            }}>
              {logs.length === 0 ? '暂无日志' : '没有符合条件的日志'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredLogs.slice().reverse().map((log, index) => (
                <div
                  key={index}
                  style={{
                    backgroundColor: 'white',
                    padding: '12px',
                    borderRadius: '8px',
                    borderLeft: `4px solid ${getLevelColor(log.level)}`,
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '16px' }}>{getLevelIcon(log.level)}</span>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>{formatTime(log.timestamp)}</span>
                    <span style={{
                      fontSize: '11px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: getLevelColor(log.level),
                      color: 'white',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {log.level}
                    </span>
                  </div>
                  <div style={{ fontSize: '14px', marginTop: '8px', wordBreak: 'break-word' }}>
                    {log.message}
                  </div>
                  {log.data && (
                    <pre style={{
                      marginTop: '8px',
                      padding: '8px',
                      backgroundColor: '#f3f4f6',
                      borderRadius: '4px',
                      fontSize: '12px',
                      overflow: 'auto',
                      maxHeight: '200px',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : String(log.data)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
