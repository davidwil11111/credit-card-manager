import { useMemo } from 'react';
import { useAppStore } from '../store';
import { calculateGlobalStats } from '../services/statsService';

/**
 * 全局统计数据 Hook
 * 自动从 store 获取卡片数据并计算全局统计信息
 * @returns GlobalStats 全局统计信息
 */
export const useStats = () => {
  const cards = useAppStore(state => state.cards);

  const stats = useMemo(() => {
    return calculateGlobalStats(cards);
  }, [cards]);

  return stats;
};
