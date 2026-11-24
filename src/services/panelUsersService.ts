import { httpsCallable } from 'firebase/functions';
import { functions } from '@/config/firebase';
import type { PanelUserProfile, PanelUserRole } from '@/config/permissions';

interface SyncSelfResponse {
  success: boolean;
  authorized: boolean;
  profile: PanelUserProfile | null;
}

interface ListUsersResponse {
  success: boolean;
  users: PanelUserProfile[];
}

interface MutateUserResponse {
  success: boolean;
  user: PanelUserProfile;
}

interface DeleteUserResponse {
  success: boolean;
  deletedUid: string;
}

export interface CreatePanelUserInput {
  name: string;
  email: string;
  password: string;
  role: Exclude<PanelUserRole, 'creator'>;
  active?: boolean;
  allowedRoutes: string[];
  jobTitle?: string;
  syncToAttendants?: boolean;
}

export interface UpdatePanelUserInput {
  uid: string;
  name?: string;
  jobTitle?: string;
  role?: Exclude<PanelUserRole, 'creator'>;
  active?: boolean;
  allowedRoutes?: string[];
  password?: string;
}

const managePanelUsersCallable = httpsCallable<Record<string, unknown>, unknown>(
  functions,
  'managePanelUsers'
);

export const panelUsersService = {
  async syncSelf(): Promise<SyncSelfResponse> {
    const res = await managePanelUsersCallable({ action: 'syncSelf' });
    return res.data as SyncSelfResponse;
  },

  async listUsers(): Promise<PanelUserProfile[]> {
    const res = await managePanelUsersCallable({ action: 'list' });
    const data = res.data as ListUsersResponse;
    return Array.isArray(data?.users) ? data.users : [];
  },

  async createUser(input: CreatePanelUserInput): Promise<PanelUserProfile> {
    const res = await managePanelUsersCallable({
      action: 'create',
      ...input,
    });
    const data = res.data as MutateUserResponse;
    return data.user;
  },

  async updateUser(input: UpdatePanelUserInput): Promise<PanelUserProfile> {
    const res = await managePanelUsersCallable({
      action: 'update',
      ...input,
    });
    const data = res.data as MutateUserResponse;
    return data.user;
  },

  async deleteUser(uid: string): Promise<string> {
    const res = await managePanelUsersCallable({
      action: 'delete',
      uid,
    });
    const data = res.data as DeleteUserResponse;
    return data.deletedUid;
  },
};
