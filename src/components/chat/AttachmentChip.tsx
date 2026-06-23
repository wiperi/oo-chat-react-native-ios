import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import { formatBytes } from '../../utils/format';
import type { FileAttachment } from '../../types';

export function AttachmentChip(props: { file: FileAttachment }) {
  return (
    <View style={styles.fileChip}>
      <Text style={styles.fileChipText}>{props.file.name} · {formatBytes(props.file.size)}</Text>
    </View>
  );
}
