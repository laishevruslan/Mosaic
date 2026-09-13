import { adminTypeDefs } from './graphql-admin.js';
import { adminConfigTypeDefs } from './graphql-admin-config.js';
import { blobTypeDefs } from './graphql-blobs.js';
import { calendarTypeDefs } from './graphql-calendar.js';
import { commentsTypeDefs } from './graphql-comments.js';
import { copilotTypeDefs } from './graphql-copilot.js';
import { membersTypeDefs } from './graphql-members.js';
import { mcpTypeDefs } from './graphql-mcp.js';
import { notifyTypeDefs } from './graphql-notify.js';
import { coreTypeDefs } from './graphql-plugin.js';
import { platformTypeDefs } from './graphql-platform.js';
import { shareTypeDefs } from './graphql-share.js';

export const mosaicGraphqlSdl = [
  coreTypeDefs,
  blobTypeDefs,
  membersTypeDefs,
  shareTypeDefs,
  commentsTypeDefs,
  platformTypeDefs,
  copilotTypeDefs,
  mcpTypeDefs,
  calendarTypeDefs,
  notifyTypeDefs,
  adminConfigTypeDefs,
  adminTypeDefs,
].join('\n');
