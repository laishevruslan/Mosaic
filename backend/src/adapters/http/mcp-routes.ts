import fp from 'fastify-plugin';
import { z } from 'zod';

import type { AuthService } from '../../application/auth-service.js';
import type { McpService } from '../../application/mcp-service.js';
import type { WorkspaceService } from '../../application/workspace-service.js';
import { errors } from '../../domain/errors.js';

const Rpc = z.object({
  jsonrpc: z.string().optional(),
  id: z.union([z.string(), z.number()]).optional(),
  method: z.string(),
  params: z.record(z.unknown()).optional(),
});

export const mcpRoutes = fp<{
  auth: AuthService;
  workspaces: WorkspaceService;
  mcp: McpService;
}>(
  async (app, opts) => {
    app.get('/api/workspaces/:id/mcp', async request => {
      const user = await opts.auth.requireUser(request.authSession);
      const { id } = request.params as { id: string };
      await opts.workspaces.requireMember(user, id);
      return opts.mcp.endpoint(id);
    });

    app.post('/api/workspaces/:id/mcp', async request => {
      const { id } = request.params as { id: string };
      const header = request.headers.authorization;
      const bearer =
        typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : undefined;
      const credential = await opts.mcp.authenticate(id, bearer);
      const body = Rpc.parse(request.body ?? {});
      const rpcId = body.id ?? 1;
      try {
        if (body.method === 'tools/list' || body.method === 'initialize') {
          const tools = await opts.mcp.listTools(credential);
          return { jsonrpc: '2.0', id: rpcId, result: { tools } };
        }
        if (body.method === 'tools/call') {
          const name =
            typeof body.params?.['name'] === 'string'
              ? body.params['name']
              : '';
          const args =
            body.params?.['arguments'] &&
            typeof body.params['arguments'] === 'object'
              ? (body.params['arguments'] as Record<string, unknown>)
              : {};
          const result = await opts.mcp.callTool(credential, name, args);
          return { jsonrpc: '2.0', id: rpcId, result };
        }
        throw errors.badRequest(`Unknown MCP method: ${body.method}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'MCP error';
        return {
          jsonrpc: '2.0',
          id: rpcId,
          error: { code: -32000, message },
        };
      }
    });
  }
);
