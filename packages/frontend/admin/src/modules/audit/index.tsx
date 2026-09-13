import { Button } from '@affine/admin/components/ui/button';
import { Input } from '@affine/admin/components/ui/input';
import { ScrollArea } from '@affine/admin/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@affine/admin/components/ui/table';
import { useI18n } from '@affine/i18n';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { affineFetch } from '../../fetch-utils';
import { Header } from '../header';
import { adminGql } from '../gql';

interface AuditRow {
  id: string;
  action: string;
  actorId: string | null;
  workspaceId: string | null;
  targetType: string | null;
  targetId: string | null;
  createdAt: string;
}

export function AuditPage() {
  const t = useI18n();
  const [action, setAction] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [rows, setRows] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    const data = await adminGql<{ auditLogs: AuditRow[] }>(
      `query AuditLogs($workspaceId: String, $action: String) {
        auditLogs(workspaceId: $workspaceId, action: $action, take: 200) {
          id action actorId workspaceId targetType targetId createdAt
        }
      }`,
      {
        workspaceId: workspaceId || null,
        action: action || null,
      }
    );
    setRows(data.auditLogs);
  }, [action, workspaceId]);

  useEffect(() => {
    load().catch(error => toast.error((error as Error).message));
  }, [load]);

  const downloadCsv = async () => {
    const params = new URLSearchParams({ format: 'csv', take: '500' });
    if (action) {
      params.set('action', action);
    }
    if (workspaceId) {
      params.set('workspaceId', workspaceId);
    }
    const response = await affineFetch(`/api/admin/audit-logs?${params}`, {
      credentials: 'include',
    });
    if (!response.ok) {
      throw new Error(t.t('com.affine.admin.audit.csv.error'));
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'audit-logs.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex h-dvh flex-1 flex-col">
      <Header
        title={t.t('com.affine.admin.audit.title')}
        endFix={
          <Button
            variant="outline"
            onClick={() =>
              downloadCsv().catch(error => toast.error((error as Error).message))
            }
          >
            {t.t('com.affine.admin.audit.csv')}
          </Button>
        }
      />
      <div className="flex gap-2 px-6 py-3">
        <Input
          placeholder={t.t('com.affine.admin.audit.action')}
          value={action}
          onChange={event => setAction(event.target.value)}
        />
        <Input
          placeholder={t.t('com.affine.admin.audit.workspace')}
          value={workspaceId}
          onChange={event => setWorkspaceId(event.target.value)}
        />
      </div>
      <ScrollArea>
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-sm text-muted-foreground">
            {t.t('com.affine.admin.audit.empty')}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t.t('com.affine.admin.audit.time')}</TableHead>
                <TableHead>{t.t('com.affine.admin.audit.action')}</TableHead>
                <TableHead>{t.t('com.affine.admin.audit.actor')}</TableHead>
                <TableHead>{t.t('com.affine.admin.audit.target')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(row => (
                <TableRow key={row.id}>
                  <TableCell className="whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{row.action}</TableCell>
                  <TableCell>{row.actorId ?? '—'}</TableCell>
                  <TableCell>
                    {[row.targetType, row.targetId].filter(Boolean).join(' ') ||
                      '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ScrollArea>
    </div>
  );
}

export { AuditPage as Component };
