import { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { errorCodes, isErrorWithCode, pick, types as documentTypes } from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import type { FileAttachment } from '../types';

export function useAttachments() {
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const addImages = useCallback(async () => {
    const result = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: 4,
      includeBase64: true,
      quality: 0.8,
    });
    if (result.didCancel) {
      return;
    }
    if (result.errorMessage) {
      Alert.alert('Image picker', result.errorMessage);
      return;
    }
    const selected = (result.assets ?? []).map<FileAttachment>((asset, index) => ({
      id: `image_${Date.now()}_${index}`,
      kind: 'image',
      name: asset.fileName ?? `image-${index + 1}.jpg`,
      type: asset.type ?? 'image/jpeg',
      size: asset.fileSize ?? 0,
      uri: asset.uri ?? '',
      dataUrl: asset.base64 ? `data:${asset.type ?? 'image/jpeg'};base64,${asset.base64}` : undefined,
    })).filter(file => file.uri.length > 0);
    setAttachments(current => [...current, ...selected]);
  }, []);

  const addFiles = useCallback(async () => {
    try {
      const selected = await pick({
        type: [documentTypes.pdf, documentTypes.plainText, documentTypes.json, documentTypes.images],
        allowMultiSelection: true,
        mode: 'import',
      });
      setAttachments(current => [
        ...current,
        ...selected.map<FileAttachment>((file, index) => ({
          id: `file_${Date.now()}_${index}`,
          kind: file.type?.startsWith('image/') ? 'image' : 'file',
          name: file.name ?? `file-${index + 1}`,
          type: file.type ?? 'application/octet-stream',
          size: file.size ?? 0,
          uri: file.uri,
        })),
      ]);
    } catch (err) {
      if (isErrorWithCode(err) && err.code === errorCodes.OPERATION_CANCELED) {
        return;
      }
      Alert.alert('Document picker', err instanceof Error ? err.message : String(err));
    }
  }, []);

  const removeAttachment = useCallback((id: string) => {
    setAttachments(current => current.filter(file => file.id !== id));
  }, []);

  const clearAttachments = useCallback(() => {
    setAttachments([]);
  }, []);

  return {
    attachments,
    addImages,
    addFiles,
    removeAttachment,
    clearAttachments,
  };
}
