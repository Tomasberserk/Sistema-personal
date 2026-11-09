// Outbox Queue Manager for Offline-First Transactional Idempotency (ADR-004)
import { executeAssistantTool } from '../api/assistantApi';

export type OutboxStatus =
  | 'LOCAL_DRAFT'
  | 'PENDING_SYNC'
  | 'SYNCING'
  | 'ACKNOWLEDGED'
  | 'CONFLICT'
  | 'FAILED_NEEDS_USER';

export interface OutboxItem {
  idempotency_key: string;
  tool_name: string;
  parameters: Record<string, unknown>;
  payload_hash: string;
  status: OutboxStatus;
  retry_count: number;
  lease_until: string | null;
  last_attempt_at: string | null;
  server_transaction_id: string | null;
  response_json: unknown;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

const STORAGE_KEY = 'jarvis_outbox_queue_v1';
const LEASE_DURATION_MS = 60_000; // 60s lease per ADR-004

async function sha256Canonical(obj: Record<string, unknown>): Promise<string> {
  const canonicalJson = JSON.stringify(obj, Object.keys(obj).sort());
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(canonicalJson);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Simple fallback hash if crypto.subtle unavailable
  let hash = 0;
  for (let i = 0; i < canonicalJson.length; i++) {
    hash = (hash << 5) - hash + canonicalJson.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

export class OutboxManager {
  private static loadItems(): OutboxItem[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as OutboxItem[]) : [];
    } catch {
      return [];
    }
  }

  private static saveItems(items: OutboxItem[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      console.error('[OutboxManager] Error guardando cola outbox:', e);
    }
  }

  static async enqueue(
    toolName: string,
    parameters: Record<string, unknown>,
  ): Promise<OutboxItem> {
    const idempotencyKey =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const payloadHash = await sha256Canonical(parameters);
    const nowIso = new Date().toISOString();

    const newItem: OutboxItem = {
      idempotency_key: idempotencyKey,
      tool_name: toolName,
      parameters,
      payload_hash: payloadHash,
      status: 'PENDING_SYNC',
      retry_count: 0,
      lease_until: null,
      last_attempt_at: null,
      server_transaction_id: null,
      response_json: null,
      last_error: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const items = this.loadItems();
    items.push(newItem);
    this.saveItems(items);
    return newItem;
  }

  static getPendingItems(): OutboxItem[] {
    const items = this.loadItems();
    const now = Date.now();

    return items.filter((item) => {
      if (item.status === 'PENDING_SYNC' || item.status === 'LOCAL_DRAFT') {
        return true;
      }
      // Reclamar items SYNCING cuyo lease haya expirado (crash o kill de app)
      if (item.status === 'SYNCING') {
        if (!item.lease_until || Date.parse(item.lease_until) < now) {
          return true;
        }
      }
      return false;
    });
  }

  static getProjectedFinancialDelta(): number {
    const pending = this.getPendingItems();
    let delta = 0;

    for (const item of pending) {
      const valor = Number(item.parameters.monto ?? item.parameters.valor ?? 0);
      if (isNaN(valor)) continue;

      if (item.tool_name === 'registrar_gasto') {
        delta -= valor;
      } else if (item.tool_name === 'registrar_ingreso') {
        delta += valor;
      }
    }
    return delta;
  }

  static async syncAllPending(onItemSynced?: (item: OutboxItem) => void): Promise<{
    succeeded: number;
    failed: number;
  }> {
    const items = this.loadItems();
    const now = Date.now();
    let succeeded = 0;
    let failed = 0;

    for (const item of items) {
      const shouldSync =
        item.status === 'PENDING_SYNC' ||
        item.status === 'LOCAL_DRAFT' ||
        (item.status === 'SYNCING' && item.lease_until && Date.parse(item.lease_until) < now);

      if (!shouldSync) continue;

      // 1. Reclamar lease de 60s
      item.status = 'SYNCING';
      item.lease_until = new Date(now + LEASE_DURATION_MS).toISOString();
      item.last_attempt_at = new Date().toISOString();
      this.saveItems(items);

      try {
        const response = await executeAssistantTool(
          item.tool_name,
          item.parameters,
          item.idempotency_key,
        );

        if (response.status === 'COMMITTED') {
          item.status = 'ACKNOWLEDGED';
          item.response_json = response.result;
          item.updated_at = new Date().toISOString();
          succeeded++;
          onItemSynced?.(item);
        } else {
          item.status = 'FAILED_NEEDS_USER';
          item.last_error = `Backend status: ${response.status}`;
          failed++;
        }
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        item.retry_count++;
        item.last_error = errorMessage;
        item.updated_at = new Date().toISOString();

        if (errorMessage.includes('409') || errorMessage.includes('CONFLICT')) {
          item.status = 'CONFLICT';
        } else {
          // Dejar en PENDING_SYNC para siguiente ronda si es error de red
          item.status = 'PENDING_SYNC';
        }
        failed++;
      }
    }

    // Limpiar items ACKNOWLEDGED antiguos conservando los últimos 20
    const acknowledged = items.filter((i) => i.status === 'ACKNOWLEDGED');
    if (acknowledged.length > 20) {
      const keepIds = new Set(acknowledged.slice(-20).map((i) => i.idempotency_key));
      const cleaned = items.filter(
        (i) => i.status !== 'ACKNOWLEDGED' || keepIds.has(i.idempotency_key),
      );
      this.saveItems(cleaned);
    } else {
      this.saveItems(items);
    }

    return { succeeded, failed };
  }
}
