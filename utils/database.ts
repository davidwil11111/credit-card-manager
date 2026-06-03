import { CapacitorSQLite } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import type { CreditCard, POSMachine, InstallmentPlan } from '../types';
import { logger } from './logger';
import { importDataSchema, creditCardSchema, posMachineSchema, installmentPlanSchema, safeParseJson } from './validation';
import { z } from 'zod';

const DB_NAME = 'credit_card_manager';
const BACKUPS_TABLE = 'auto_backups';
const BACKUP_LIMIT = 5;

interface StoredCard {
  id: string;
  holder_name: string;
  bank_name: string;
  card_number: string;
  bill_day: number;
  repayment_config: string;
  repayment_date: string;
  last_statement_date: string;
  fixed_limit: number;
  temp_limit: number;
  temp_limit_expiry: string | null;
  current_unpaid: number;
  current_unbilled: number;
  status: string;
  transactions: string;
  index_col: number;
}

interface StoredPOS {
  id: string;
  name: string;
  rate: number;
  fixed_fee: number;
  channels: string | null;
}

interface StoredInstallmentPlan {
  id: string;
  card_id: string;
  start_date: string;
  principal: number;
  annual_rate: number;
  total_periods: number;
  monthly_payment: number;
  periods: string;
  status: string;
  settled_date: string | null;
  settled_amount: number | null;
  notes: string | null;
}

interface AutoBackup {
  timestamp: string;
  data: {
    cards: CreditCard[];
    posMachines: POSMachine[];
    installmentPlans: InstallmentPlan[];
    version: string;
    type: 'auto' | 'manual';
  };
}

const LS_CARDS = `${DB_NAME}_cards`;
const LS_POS = `${DB_NAME}_pos`;
const LS_INSTALLMENT = `${DB_NAME}_installment_plans`;
const LS_BACKUPS = `${DB_NAME}_backups`;

class Database {
  private dbName = DB_NAME;
  private initialized = false;
  private autoBackups: AutoBackup[] = [];
  private isNative = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    this.isNative = Capacitor.isNativePlatform();

    try {
      if (this.isNative) {
        await CapacitorSQLite.createConnection({ database: this.dbName });
        await CapacitorSQLite.open({ database: this.dbName });
        await this.createTables();
        await this.migrateIfNeeded();
      } else {
        await CapacitorSQLite.initWebStore();
      }
      this.loadAutoBackups();
      this.initialized = true;
    } catch (error) {
      logger.error('Database init failed:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    if (!this.isNative) return;
    await CapacitorSQLite.execute({
      database: this.dbName,
      statements: `
        CREATE TABLE IF NOT EXISTS cards (
          id TEXT PRIMARY KEY,
          holder_name TEXT NOT NULL DEFAULT '',
          bank_name TEXT NOT NULL DEFAULT '',
          card_number TEXT NOT NULL DEFAULT '',
          bill_day INTEGER NOT NULL DEFAULT 1,
          repayment_config TEXT NOT NULL DEFAULT '{"type":"days_after_bill","value":20}',
          repayment_date TEXT NOT NULL DEFAULT '',
          last_statement_date TEXT NOT NULL DEFAULT '',
          fixed_limit REAL NOT NULL DEFAULT 0,
          temp_limit REAL NOT NULL DEFAULT 0,
          temp_limit_expiry TEXT,
          current_unpaid REAL NOT NULL DEFAULT 0,
          current_unbilled REAL NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'pending',
          transactions TEXT NOT NULL DEFAULT '[]',
          index_col INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS pos_machines (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          rate REAL NOT NULL DEFAULT 0,
          fixed_fee REAL NOT NULL DEFAULT 0,
          channels TEXT
        );

        CREATE TABLE IF NOT EXISTS ${BACKUPS_TABLE} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          data TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS installment_plans (
          id TEXT PRIMARY KEY,
          card_id TEXT NOT NULL,
          start_date TEXT NOT NULL,
          principal REAL NOT NULL,
          annual_rate REAL NOT NULL,
          total_periods INTEGER NOT NULL,
          monthly_payment REAL NOT NULL,
          periods TEXT NOT NULL DEFAULT '[]',
          status TEXT NOT NULL DEFAULT 'active',
          settled_date TEXT,
          settled_amount REAL,
          notes TEXT
        );
      `,
    });
  }

  private async migrateIfNeeded(): Promise<void> {
    if (!this.isNative) return;

    try {
      // Migration 1: Add channels column to pos_machines
      const mcResult = await CapacitorSQLite.query({
        database: this.dbName,
        statement: "PRAGMA table_info(pos_machines);",
        values: [],
      });
      const mcColumns = (mcResult.values || []).map((r: any) => r.name);
      if (!mcColumns.includes('channels')) {
        await CapacitorSQLite.execute({
          database: this.dbName,
          statements: 'ALTER TABLE pos_machines ADD COLUMN channels TEXT;',
        });
        logger.info('Migration: added channels column to pos_machines');
      }
    } catch (error) {
      logger.error('Migration pos_machines failed:', error);
    }

    try {
      // Migration 2: Create installment_plans table if not exists
      const ipResult = await CapacitorSQLite.query({
        database: this.dbName,
        statement: "SELECT name FROM sqlite_master WHERE type='table' AND name='installment_plans';",
        values: [],
      });
      if ((ipResult.values || []).length === 0) {
        await CapacitorSQLite.execute({
          database: this.dbName,
          statements: `CREATE TABLE IF NOT EXISTS installment_plans (
            id TEXT PRIMARY KEY,
            card_id TEXT NOT NULL,
            start_date TEXT NOT NULL,
            principal REAL NOT NULL,
            annual_rate REAL NOT NULL,
            total_periods INTEGER NOT NULL,
            monthly_payment REAL NOT NULL,
            periods TEXT NOT NULL DEFAULT '[]',
            status TEXT NOT NULL DEFAULT 'active',
            settled_date TEXT,
            settled_amount REAL,
            notes TEXT
          );`,
        });
        logger.info('Migration: created installment_plans table');
      }
    } catch (error) {
      logger.error('Migration installment_plans failed:', error);
    }
  }

  // --- Card CRUD ---

  async getAllCards(): Promise<CreditCard[]> {
    if (this.isNative) {
      const result = await CapacitorSQLite.query({
        database: this.dbName,
        statement: 'SELECT * FROM cards ORDER BY index_col ASC',
        values: [],
      });
      if (!result.values || result.values.length === 0) return [];
      return result.values.map((row: StoredCard) => this.mapCard(row));
    }

    try {
      const raw = localStorage.getItem(LS_CARDS);
      return safeParseJson(raw, z.array(creditCardSchema), []);
    } catch {
      return [];
    }
  }

  async saveCards(cards: CreditCard[]): Promise<void> {
    await this.createAutoBackup(cards);

    if (this.isNative) {
      await CapacitorSQLite.execute({
        database: this.dbName,
        statements: 'DELETE FROM cards;',
      });

      if (cards.length === 0) return;

      const insertSQL = `INSERT INTO cards (id, holder_name, bank_name, card_number, bill_day, repayment_config, repayment_date, last_statement_date, fixed_limit, temp_limit, temp_limit_expiry, current_unpaid, current_unbilled, status, transactions, index_col)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

      const set = cards.map((card, idx) => ({
        statement: insertSQL,
        values: [
          card.id,
          card.holderName,
          card.bankName,
          card.cardNumber,
          card.billDay,
          JSON.stringify(card.repaymentConfig),
          card.repaymentDate,
          card.lastStatementDate,
          card.fixedLimit,
          card.tempLimit,
          card.tempLimitExpiry || null,
          card.currentUnpaid,
          card.currentUnbilled,
          card.status,
          JSON.stringify(card.transactions),
          idx,
        ],
      }));

      await CapacitorSQLite.executeSet({
        database: this.dbName,
        set,
      });
    } else {
      localStorage.setItem(LS_CARDS, JSON.stringify(cards));
    }
  }

  async getCardById(id: string): Promise<CreditCard | null> {
    if (this.isNative) {
      const result = await CapacitorSQLite.query({
        database: this.dbName,
        statement: 'SELECT * FROM cards WHERE id = ?',
        values: [id],
      });
      if (!result.values || result.values.length === 0) return null;
      return this.mapCard(result.values[0] as StoredCard);
    }

    const cards = await this.getAllCards();
    return cards.find(c => c.id === id) || null;
  }

  // --- POS Machines ---

  async getAllPosMachines(): Promise<POSMachine[]> {
    if (this.isNative) {
      const result = await CapacitorSQLite.query({
        database: this.dbName,
        statement: 'SELECT * FROM pos_machines',
        values: [],
      });
      if (!result.values || result.values.length === 0) return [];
      return result.values.map((row: StoredPOS) => {
        let channels: POSMachine['channels'] = undefined;
        if (row.channels) {
          try { channels = JSON.parse(row.channels); } catch {}
        }
        return {
          id: row.id,
          name: row.name,
          rate: row.rate,
          fixedFee: row.fixed_fee,
          ...(channels ? { channels } : {}),
        };
      });
    }

    try {
      const raw = localStorage.getItem(LS_POS);
      return safeParseJson(raw, z.array(posMachineSchema), []);
    } catch {
      return [];
    }
  }

  async savePosMachines(machines: POSMachine[]): Promise<void> {
    if (this.isNative) {
      await CapacitorSQLite.execute({
        database: this.dbName,
        statements: 'DELETE FROM pos_machines;',
      });

      if (machines.length === 0) return;

      const insertSQL = `INSERT INTO pos_machines (id, name, rate, fixed_fee, channels) VALUES (?, ?, ?, ?, ?);`;

      const set = machines.map((m) => ({
        statement: insertSQL,
        values: [m.id, m.name, m.rate, m.fixedFee, m.channels ? JSON.stringify(m.channels) : null],
      }));

      await CapacitorSQLite.executeSet({
        database: this.dbName,
        set,
      });
    } else {
      localStorage.setItem(LS_POS, JSON.stringify(machines));
    }
  }

  // --- Installment Plans ---

  async getAllInstallmentPlans(): Promise<InstallmentPlan[]> {
    if (this.isNative) {
      const result = await CapacitorSQLite.query({
        database: this.dbName,
        statement: 'SELECT * FROM installment_plans',
        values: [],
      });
      if (!result.values || result.values.length === 0) return [];
      return result.values.map((row: StoredInstallmentPlan) => this.mapInstallmentPlan(row));
    }

    try {
      const raw = localStorage.getItem(LS_INSTALLMENT);
      return safeParseJson(raw, z.array(installmentPlanSchema), []);
    } catch {
      return [];
    }
  }

  async saveInstallmentPlans(plans: InstallmentPlan[]): Promise<void> {
    if (this.isNative) {
      await CapacitorSQLite.execute({
        database: this.dbName,
        statements: 'DELETE FROM installment_plans;',
      });

      if (plans.length === 0) return;

      const insertSQL = `INSERT INTO installment_plans (id, card_id, start_date, principal, annual_rate, total_periods, monthly_payment, periods, status, settled_date, settled_amount, notes)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`;

      const set = plans.map((p) => ({
        statement: insertSQL,
        values: [
          p.id, p.cardId, p.startDate, p.principal, p.annualRate,
          p.totalPeriods, p.monthlyPayment, JSON.stringify(p.periods), p.status,
          p.settledDate || null, p.settledAmount ?? null, p.notes || null,
        ],
      }));

      await CapacitorSQLite.executeSet({ database: this.dbName, set });
    } else {
      localStorage.setItem(LS_INSTALLMENT, JSON.stringify(plans));
    }
  }

  async saveInstallmentPlan(plan: InstallmentPlan): Promise<void> {
    const plans = await this.getAllInstallmentPlans();
    const idx = plans.findIndex(p => p.id === plan.id);
    if (idx >= 0) plans[idx] = plan;
    else plans.push(plan);
    await this.saveInstallmentPlans(plans);
  }

  async deleteInstallmentPlan(id: string): Promise<void> {
    const plans = await this.getAllInstallmentPlans();
    await this.saveInstallmentPlans(plans.filter(p => p.id !== id));
  }

  private mapInstallmentPlan(row: StoredInstallmentPlan): InstallmentPlan {
    let periods = [];
    try { periods = JSON.parse(row.periods); } catch { periods = []; }

    return {
      id: row.id,
      cardId: row.card_id,
      startDate: row.start_date,
      principal: row.principal,
      annualRate: row.annual_rate,
      totalPeriods: row.total_periods,
      monthlyPayment: row.monthly_payment,
      periods,
      status: row.status as InstallmentPlan['status'],
      settledDate: row.settled_date || undefined,
      settledAmount: row.settled_amount ?? undefined,
      notes: row.notes || undefined,
    };
  }

  // --- Backup Management ---

  getAutoBackups(): AutoBackup[] {
    return this.autoBackups;
  }

  async restoreAutoBackup(index: number): Promise<void> {
    if (index < 0 || index >= this.autoBackups.length) {
      throw new Error('Backup index out of range');
    }

    const backup = this.autoBackups[index];
    await this.saveCards(backup.data.cards);
    await this.savePosMachines(backup.data.posMachines);
    if (backup.data.installmentPlans) {
      await this.saveInstallmentPlans(backup.data.installmentPlans);
    }
    this.loadAutoBackups();
  }

  async createAutoBackup(cards: CreditCard[]): Promise<void> {
    try {
      const posMachines = await this.getAllPosMachines();
      const installmentPlans = await this.getAllInstallmentPlans();

      const backup: AutoBackup = {
        timestamp: new Date().toISOString(),
        data: {
          cards: JSON.parse(JSON.stringify(cards)),
          posMachines,
          installmentPlans,
          version: '1.0',
          type: 'auto',
        },
      };

      this.autoBackups.unshift(backup);
      if (this.autoBackups.length > BACKUP_LIMIT) {
        this.autoBackups = this.autoBackups.slice(0, BACKUP_LIMIT);
      }

      this.persistAutoBackups();
    } catch (error) {
      logger.error('Auto backup failed:', error);
    }
  }

  private loadAutoBackups(): void {
    try {
      const stored = localStorage.getItem(LS_BACKUPS);
      if (stored) {
        this.autoBackups = JSON.parse(stored);
      }
    } catch {
      this.autoBackups = [];
    }
  }

  private persistAutoBackups(): void {
    try {
      localStorage.setItem(LS_BACKUPS, JSON.stringify(this.autoBackups));
    } catch {
      // localStorage might be full — silently skip
    }
  }

  // --- Import / Export ---

  async exportToJson(): Promise<string> {
    const cards = await this.getAllCards();
    const posMachines = await this.getAllPosMachines();
    const installmentPlans = await this.getAllInstallmentPlans();

    return JSON.stringify(
      {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        cards,
        posMachines,
        installmentPlans,
      },
      null,
      2
    );
  }

  async importFromJson(jsonString: string): Promise<void> {
    let raw: unknown;
    try {
      raw = JSON.parse(jsonString);
    } catch {
      throw new Error('JSON格式无效');
    }

    const result = importDataSchema.safeParse(raw);
    if (!result.success) {
      const errors = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`数据格式无效: ${errors}`);
    }

    const { cards, posMachines, installmentPlans } = result.data;
    await this.saveCards(cards);
    await this.savePosMachines(posMachines);
    if (installmentPlans) {
      await this.saveInstallmentPlans(installmentPlans);
    }
  }

  async exportDatabase(): Promise<{ uri: string } | null> {
    if (!this.isNative) return null;

    try {
      const result = await CapacitorSQLite.getUrl({
        database: this.dbName,
      });
      return { uri: result.url || '' };
    } catch (error) {
      logger.error('Export database failed:', error);
      return null;
    }
  }

  // --- Helpers ---

  private mapCard(row: StoredCard): CreditCard {
    let transactions = [];
    try {
      transactions = JSON.parse(row.transactions);
    } catch {
      transactions = [];
    }

    let repaymentConfig = { type: 'days_after_bill' as const, value: 20 };
    try {
      repaymentConfig = JSON.parse(row.repayment_config);
    } catch {
      // use default
    }

    return {
      id: row.id,
      index: row.index_col,
      holderName: row.holder_name,
      bankName: row.bank_name,
      cardNumber: row.card_number,
      billDay: row.bill_day,
      repaymentConfig,
      repaymentDate: row.repayment_date,
      lastStatementDate: row.last_statement_date,
      fixedLimit: row.fixed_limit,
      tempLimit: row.temp_limit,
      tempLimitExpiry: row.temp_limit_expiry || undefined,
      currentUnpaid: row.current_unpaid,
      currentUnbilled: row.current_unbilled,
      status: row.status as CreditCard['status'],
      transactions,
    };
  }
}

export const database = new Database();
