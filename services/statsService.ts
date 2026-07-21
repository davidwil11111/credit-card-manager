import { CreditCard, GlobalStats } from '../types';
import { isTempLimitValid } from '../constants';

/**
 * 计算全局统计数据（总额度、未还金额、可用额度、可用比例、逾期数量）
 * @param cards 信用卡数组
 * @returns GlobalStats 全局统计信息
 */
export const calculateGlobalStats = (cards: CreditCard[]): GlobalStats => {
  let totalLimit = 0;
  let totalUnpaid = 0;
  let totalUnbilled = 0;
  let overdueCount = 0;

  cards.forEach(card => {
    // 计算总额度：固定额度 + 有效的临时额度
    totalLimit += card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0);

    // 累加未还金额和未出账金额
    totalUnpaid += card.currentUnpaid;
    totalUnbilled += card.currentUnbilled;

    // 统计逾期卡片数量
    if (card.status === 'overdue') {
      overdueCount++;
    }
  });

  // 计算可用额度和可用比例
  const totalAvailable = totalLimit - totalUnpaid - totalUnbilled;
  const availableRatio = totalLimit > 0 ? (totalAvailable / totalLimit) * 100 : 0;

  return {
    totalAvailable,
    totalUnpaid,
    totalLimit,
    totalUnbilled,
    availableRatio,
    overdueCount,
  };
};

/**
 * 计算单张卡片的可用额度
 * @param card 信用卡对象
 * @returns 可用额度
 */
export const calculateCardAvailable = (card: CreditCard): number => {
  const totalLimit = card.fixedLimit + (isTempLimitValid(card) ? card.tempLimit : 0);
  return totalLimit - card.currentUnpaid - card.currentUnbilled;
};

/**
 * 计算单张卡片的可用比例（相对于固定额度）
 * @param card 信用卡对象
 * @returns 可用比例（百分比）
 */
export const calculateCardAvailableRatio = (card: CreditCard): number => {
  const available = calculateCardAvailable(card);
  return card.fixedLimit > 0 ? (available / card.fixedLimit) * 100 : 0;
};
