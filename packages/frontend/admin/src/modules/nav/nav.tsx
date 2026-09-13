import { cn } from '@affine/admin/utils';
import { ROUTES } from '@affine/routes';
import { AccountIcon, SelfhostIcon } from '@blocksuite/icons/rc';
import { useI18n } from '@affine/i18n';
import {
  BarChart3Icon,
  LayoutDashboardIcon,
  ScrollTextIcon,
  ShieldCheckIcon,
} from 'lucide-react';

import { NavItem } from './nav-item';
import { ServerVersion } from './server-version';
import { SettingsItem } from './settings-item';
import { UserDropdown } from './user-dropdown';

interface NavProps {
  isCollapsed?: boolean;
}

export function Nav({ isCollapsed = false }: NavProps) {
  const t = useI18n();
  return (
    <div
      className={cn(
        'flex h-full flex-grow flex-col justify-between gap-4 py-2',
        isCollapsed && 'overflow-visible'
      )}
    >
      <nav
        className={cn(
          'flex flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto px-2',
          isCollapsed && 'items-center px-0 gap-1 overflow-visible'
        )}
      >
        {environment.isSelfHosted ? null : (
          <NavItem
            to={ROUTES.admin.dashboard}
            icon={<BarChart3Icon size={18} />}
            label={t.t('com.affine.admin.nav.dashboard')}
            isCollapsed={isCollapsed}
          />
        )}
        <NavItem
          to={ROUTES.admin.accounts}
          icon={<AccountIcon fontSize={20} />}
          label={t.t('com.affine.admin.nav.accounts')}
          isCollapsed={isCollapsed}
        />
        <NavItem
          to={ROUTES.admin.workspaces}
          icon={<LayoutDashboardIcon size={18} />}
          label={t.t('com.affine.admin.nav.workspaces')}
          isCollapsed={isCollapsed}
        />
        <NavItem
          to={ROUTES.admin.security}
          icon={<ShieldCheckIcon size={18} />}
          label={t.t('com.affine.admin.nav.security')}
          isCollapsed={isCollapsed}
        />
        <NavItem
          to={ROUTES.admin.audit}
          icon={<ScrollTextIcon size={18} />}
          label={t.t('com.affine.admin.nav.audit')}
          isCollapsed={isCollapsed}
        />
        <SettingsItem isCollapsed={isCollapsed} />
        <NavItem
          to={ROUTES.admin.about}
          icon={<SelfhostIcon fontSize={20} />}
          label={t.t('com.affine.admin.nav.about')}
          isCollapsed={isCollapsed}
        />
      </nav>
      <div
        className={cn(
          'flex flex-col gap-2 overflow-hidden px-2',
          isCollapsed && 'items-center px-0 gap-1'
        )}
      >
        <UserDropdown isCollapsed={isCollapsed} />
        {isCollapsed ? null : <ServerVersion />}
      </div>
    </div>
  );
}
