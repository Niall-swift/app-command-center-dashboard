import { httpsCallable } from 'firebase/functions';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { functions, storage } from '@/config/firebase';
import { compressImage } from '@/utils/compressImage';
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
  photoUrl?: string;
  jobTitle?: string;
  syncToAttendants?: boolean;
}

export interface UpdatePanelUserInput {
  uid: string;
  name?: string;
  photoUrl?: string;
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

  async uploadAvatarPhoto(file: File, identifier: string): Promise<string> {
    const { file: compressedFile } = await compressImage(file, {
      maxWidth: 800,
      maxHeight: 800,
      quality: 0.9,
      mimeType: 'image/jpeg',
    });

    const safeKey =
      identifier
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, '_')
        .slice(0, 48) || 'operador';
    const storagePath = `panel_user_avatars/${safeKey}_${Date.now()}.jpg`;
    const storageRef = ref(storage, storagePath);

    return new Promise<string>((resolve, reject) => {
      const task = uploadBytesResumable(storageRef, compressedFile, {
        contentType: 'image/jpeg',
        cacheControl: 'public, max-age=31536000',
      });

      task.on(
        'state_changed',
        undefined,
        (err) => reject(err),
        async () => {
          try {
            const url = await getDownloadURL(task.snapshot.ref);
            resolve(url);
          } catch (err) {
            reject(err);
          }
        }
      );
    });
  },
};
