import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import type { FileAttachment } from '../../types';

const sendArrowIcon = require('../../assets/icons/send-arrow.png');

export function Composer(props: {
  value: string;
  attachments: FileAttachment[];
  disabled: boolean;
  isProcessing: boolean;
  bottomInset: number;
  onChange: (value: string) => void;
  onSend: () => void;
  onAddImage: () => void;
  onAddFile: () => void;
  onRemoveAttachment: (id: string) => void;
}) {
  const inputRef = useRef<TextInput>(null);
  const [showAttachmentActions, setShowAttachmentActions] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const composerInsetStyle = useMemo(() => ({
    paddingBottom: keyboardVisible ? 10 : Math.max(10, props.bottomInset),
  }), [keyboardVisible, props.bottomInset]);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  function addImage() {
    setShowAttachmentActions(false);
    props.onAddImage();
  }

  function addFile() {
    setShowAttachmentActions(false);
    props.onAddFile();
  }

  return (
    <View style={[styles.composer, composerInsetStyle]}>
      {props.attachments.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentStrip}>
          {props.attachments.map(file => (
            <View key={file.id} style={styles.attachmentPreview}>
              {file.kind === 'image' ? <Image source={{ uri: file.uri }} style={styles.attachmentImage} /> : null}
              <Text numberOfLines={1} style={styles.attachmentName}>{file.name}</Text>
              <Pressable
                style={({ pressed }) => pressed && styles.pressablePressed}
                onPress={() => props.onRemoveAttachment(file.id)}
              >
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>
      ) : null}
      {showAttachmentActions ? (
        <View style={styles.attachmentActionTray}>
          <Pressable
            style={({ pressed }) => [styles.attachmentActionButton, pressed && styles.pressablePressed]}
            onPress={addImage}
          >
            <Text style={styles.attachmentActionText}>Image</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.attachmentActionButton, pressed && styles.pressablePressed]}
            onPress={addFile}
          >
            <Text style={styles.attachmentActionText}>File</Text>
          </Pressable>
        </View>
      ) : null}
      <View style={styles.inputRow}>
        <Pressable
          style={[styles.composerInputShell, props.disabled && styles.composerInputShellDisabled]}
          onPress={() => inputRef.current?.focus()}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Add attachment"
            disabled={props.disabled}
            style={({ pressed }) => [styles.attachButton, pressed && styles.pressablePressed]}
            onPress={() => setShowAttachmentActions(current => !current)}
          >
            <View style={styles.attachPlus}>
              <View style={styles.attachPlusHorizontal} />
              <View style={styles.attachPlusVertical} />
            </View>
          </Pressable>
          <TextInput
            ref={inputRef}
            value={props.value}
            onChangeText={props.onChange}
            editable={!props.disabled}
            placeholder={props.disabled ? 'Waiting for current action' : 'Message...'}
            placeholderTextColor="#C7C3CF"
            selectionColor="#6D28D9"
            multiline
            returnKeyType="default"
            style={[styles.composerInput, props.disabled && styles.inputDisabled]}
          />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={props.isProcessing ? 'Waiting for response' : 'Send message'}
          disabled={props.disabled || props.value.trim().length === 0}
          style={({ pressed }) => [
            styles.sendButton,
            (props.disabled || props.value.trim().length === 0) && styles.sendButtonDisabled,
            pressed && styles.pressablePressed,
          ]}
          onPress={props.onSend}
        >
          <SendIcon isProcessing={props.isProcessing} />
        </Pressable>
      </View>
    </View>
  );
}

function SendIcon(props: { isProcessing: boolean }) {
  if (props.isProcessing) {
    return <View style={styles.sendStopIcon} />;
  }

  return <Image source={sendArrowIcon} style={styles.sendArrowImage} resizeMode="contain" />;
}
