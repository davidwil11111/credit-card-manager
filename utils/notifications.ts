import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import type { CreditCard } from '../types';

interface NotificationConfig {
  enabled: boolean;
}

const CONFIG_KEY = 'notification_config';
const NOTIFIED_KEY = 'notified_cards';

class Notifications {
  private config: NotificationConfig = { enabled: false };

  async init(): Promise<void> {
    this.loadConfig();
  }

  async requestPermission(): Promise<boolean> {
    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalNotifications.requestPermissions();
        return result.display === 'granted';
      } catch {
        return false;
      }
    }

    // Web
    if (!('Notification' in window)) return false;
    try {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    } catch {
      return false;
    }
  }

  getConfig(): NotificationConfig {
    return { ...this.config };
  }

  saveConfig(config: Partial<NotificationConfig>): void {
    this.config = { ...this.config, ...config };
    try {
      localStorage.setItem(CONFIG_KEY, JSON.stringify(this.config));
    } catch {
      // ignore
    }
  }

  async checkAndNotify(cards: CreditCard[]): Promise<void> {
    if (!this.config.enabled) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const twoDaysLater = new Date(today);
    twoDaysLater.setDate(twoDaysLater.getDate() + 2);

    const threeDaysLater = new Date(today);
    threeDaysLater.setDate(threeDaysLater.getDate() + 3);

    const notified: Set<string> = this.getNotifiedSet();

    for (const card of cards) {
      if (card.currentUnpaid <= 0) continue;

      const repaymentDate = new Date(card.repaymentDate);
      repaymentDate.setHours(0, 0, 0, 0);

      if (repaymentDate <= twoDaysLater && repaymentDate >= today) {
        // Card due today or within 2 days — always notify
        await this.sendNotification(card, repaymentDate);
      } else if (repaymentDate <= threeDaysLater && !notified.has(card.id)) {
        // Card due within 3 days, not yet notified for this cycle
        await this.sendNotification(card, repaymentDate);
        notified.add(card.id);
      }
    }

    this.saveNotifiedSet(notified);
  }

  private async sendNotification(
    card: CreditCard,
    repaymentDate: Date
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (repaymentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    let title: string;
    let body: string;

    if (diffDays < 0) {
      title = `${card.bankName} 已逾期`;
      body = `尾号${card.cardNumber} 未还 ¥${card.currentUnpaid.toLocaleString()}，已逾期${Math.abs(diffDays)}天`;
    } else if (diffDays === 0) {
      title = `${card.bankName} 今日还款`;
      body = `尾号${card.cardNumber} 未还 ¥${card.currentUnpaid.toLocaleString()}，今日是还款日`;
    } else {
      title = `${card.bankName} 即将还款`;
      body = `尾号${card.cardNumber} 未还 ¥${card.currentUnpaid.toLocaleString()}，${diffDays}天后还款`;
    }

    try {
      await LocalNotifications.schedule({
        notifications: [
          {
            id: parseInt(card.id.replace(/\D/g, '').slice(-8) || Date.now().toString().slice(-8), 10),
            title,
            body,
            schedule: { at: new Date(Date.now() + 1000) },
          },
        ],
      });
    } catch {
      // Notifications may not be available — ignore
    }
  }

  private getNotifiedSet(): Set<string> {
    try {
      const stored = localStorage.getItem(NOTIFIED_KEY);
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  }

  private saveNotifiedSet(set: Set<string>): void {
    try {
      localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set]));
    } catch {
      // ignore
    }
  }

  private loadConfig(): void {
    try {
      const stored = localStorage.getItem(CONFIG_KEY);
      if (stored) {
        this.config = JSON.parse(stored);
      }
    } catch {
      // use default
    }
  }
}

export const notifications = new Notifications();
