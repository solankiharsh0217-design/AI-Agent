import { Logger } from './logger';

const logger = new Logger({ service: 'AuditLogger' });

export interface AuditContext {
  tenantId: string;
  userId?: string;
  ipAddress?: string;
}

export interface AuditEntry {
  action: 'create' | 'update' | 'delete' | 'publish' | 'archive' | 'assign' | 'release' | 'upload';
  resource: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
}

export interface AuditLogWriter {
  create(data: {
    tenantId: string;
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    oldValues?: Record<string, unknown>;
    newValues?: Record<string, unknown>;
    ipAddress?: string;
  }): Promise<unknown>;
}

export class AuditLogger {
  private writer: AuditLogWriter;

  constructor(writer: AuditLogWriter) {
    this.writer = writer;
  }

  async log(context: AuditContext, entry: AuditEntry): Promise<void> {
    try {
      await this.writer.create({
        tenantId: context.tenantId,
        userId: context.userId,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId,
        oldValues: entry.oldValues,
        newValues: entry.newValues,
        ipAddress: context.ipAddress,
      });
    } catch (error) {
      // Audit log failures should not break the request
      logger.error('Failed to write audit log', { error: (error as Error).message, entry });
    }
  }

  async logCreate(context: AuditContext, resource: string, resourceId: string, data: Record<string, unknown>) {
    return this.log(context, { action: 'create', resource, resourceId, newValues: data });
  }

  async logUpdate(context: AuditContext, resource: string, resourceId: string, oldData: Record<string, unknown>, newData: Record<string, unknown>) {
    return this.log(context, { action: 'update', resource, resourceId, oldValues: oldData, newValues: newData });
  }

  async logDelete(context: AuditContext, resource: string, resourceId: string) {
    return this.log(context, { action: 'delete', resource, resourceId });
  }
}
