import React from 'react';
import { Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import type { FileAttachment } from '../../types';

export function Composer(props: {
  value: string;
  attachments: FileAttachment[];
  disabled: boolean;
  isProcessing: boolean;
  onChange: (value: string) => void;
  onSend: () => void;
  onAddImage: () => void;
  onAddFile: () => void;
  onRemoveAttachment: (id: string) => void;
}) {
  return (
    <View style={styles.composer}>
      {props.attachments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentStrip}>
          {props.attachments.map(file => (
            <View key={file.id} style={styles.attachmentPreview}>
              {file.kind === 'image' ? <Image source={{ uri: file.uri }} style={styles.attachmentImage} /> : null}
              <Text numberOfLines={1} style={styles.attachmentName}>{file.name}</Text>
              <Pressable onPress={() => props.onRemoveAttachment(file.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      <View style={styles.composerActions}>
        <Pressable style={styles.secondaryButton} onPress={props.onAddImage}>
          <Text style={styles.secondaryButtonText}>Image</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={props.onAddFile}>
          <Text style={styles.secondaryButtonText}>File</Text>
        </Pressable>
      </View>
      <View style={styles.inputRow}>
        <TextInput
          value={props.value}
          onChangeText={props.onChange}
          editable={!props.disabled}
          placeholder={props.disabled ? 'Waiting for current action' : 'Message the agent'}
          multiline
          style={[styles.composerInput, props.disabled && styles.inputDisabled]}
        />
        <Pressable
          disabled={props.disabled || props.value.trim().length === 0}
          style={[styles.sendButton, (props.disabled || props.value.trim().length === 0) && styles.sendButtonDisabled]}
          onPress={props.onSend}
        >
          <Text style={styles.sendButtonText}>{props.isProcessing ? '...' : 'Send'}</Text>
        </Pressable>
      </View>
    </View>
  );
}
