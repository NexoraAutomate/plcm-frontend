import * as api from '@/lib/api';

export type PictureOwnerType =
  | 'system'
  | 'subsystem'
  | 'module'
  | 'unit'
  | 'component'
  | 'inventory';

export async function syncEntityPicture(
  ownerType: PictureOwnerType,
  entityId: number,
  formData: Record<string, unknown>
) {
  if (formData.remove_picture === true) {
    await api.pictures.remove(ownerType, entityId);
    return null;
  }

  const file = formData.picture_file;
  if (file instanceof File) {
    const res = await api.pictures.upload(ownerType, entityId, file);
    return res.data.picture_url;
  }

  return undefined;
}

/** @deprecated Use syncEntityPicture */
export async function uploadEntityPictureIfNeeded(
  ownerType: PictureOwnerType,
  entityId: number,
  formData: Record<string, unknown>
) {
  return syncEntityPicture(ownerType, entityId, formData);
}
