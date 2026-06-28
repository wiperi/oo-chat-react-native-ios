import React, { useRef } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ChatItemView } from '../components/chat/ChatItemView';
import { Composer } from '../components/chat/Composer';
import { GatePanel } from '../components/chat/GatePanel';
import { ModeSelector } from '../components/chat/ModeSelector';
import { BackChevron } from '../components/layout/BackChevron';
import { styles } from '../styles/appStyles';
import type { ActiveGate, ApprovalMode, Conversation, FileAttachment } from '../types';

export function ChatScreen(props: {
  active: Conversation | null;
  gate: ActiveGate;
  isProcessing: boolean;
  prompt: string;
  attachments: FileAttachment[];
  connectionState: string;
  bottomInset: number;
  onBack: () => void;
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onAddImage: () => void;
  onAddFile: () => void;
  onRemoveAttachment: (id: string) => void;
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void;
  onCreate: () => void;
  onAskUser: (answer: string | string[]) => void;
  onApproval: (approved: boolean, scope: 'once' | 'session') => void;
  onOnboard: (options: { inviteCode?: string; payment?: number }) => void;
  onPlanReview: (message: string) => void;
  onUlw: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void;
}) {
  const scrollViewRef = useRef<ScrollView>(null);

  if (!props.active) {
    return (
      <View style={styles.fullScreen}>
        <View style={styles.chatHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back"
            style={({ pressed }) => [styles.backButton, pressed && styles.pressablePressed]}
            onPress={props.onBack}
          >
            <BackChevron />
          </Pressable>
          <Text style={styles.contextTitle}>Chat</Text>
          <View style={styles.headerSpacer} />
        </View>
        <Text style={styles.emptyText}>No conversation selected.</Text>
      </View>
    );
  }

  const active = props.active;

  return (
    <View style={styles.chatLayout}>
      <View style={styles.chatHeader}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [styles.backButton, pressed && styles.pressablePressed]}
          onPress={props.onBack}
        >
          <BackChevron />
        </Pressable>
        <View style={styles.chatHeaderTitleBlock}>
          <Text numberOfLines={1} style={styles.chatTitle}>{active.title}</Text>
          <View style={styles.chatStatusRow}>
            <View style={[styles.chatStatusDot, props.connectionState === 'connected' ? styles.statusDotLive : styles.statusDotSaved]} />
            <Text style={props.connectionState === 'connected' ? styles.chatStatusTextLive : styles.chatStatusTextSaved}>
              {connectionLabel(props.connectionState)}
            </Text>
          </View>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="New chat"
          style={({ pressed }) => [styles.chatHeaderAction, pressed && styles.pressablePressed]}
          onPress={props.onCreate}
        >
          <Text style={styles.chatHeaderActionText}>New</Text>
        </Pressable>
      </View>
      <ModeSelector conversation={active} onChange={props.onModeChange} />
      <ScrollView
        ref={scrollViewRef}
        style={styles.messages}
        contentContainerStyle={styles.messagesContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {active.ui.map(item => (
          <ChatItemView
            key={item.id}
            item={item}
          />
        ))}
        <GatePanel
          gate={props.gate}
          onAskUser={props.onAskUser}
          onApproval={props.onApproval}
          onOnboard={props.onOnboard}
          onPlanReview={props.onPlanReview}
          onUlw={props.onUlw}
        />
      </ScrollView>
      <Composer
        value={props.prompt}
        attachments={props.attachments}
        disabled={props.isProcessing || props.gate !== null}
        isProcessing={props.isProcessing}
        bottomInset={props.bottomInset}
        onChange={props.onPromptChange}
        onSend={props.onSend}
        onAddImage={props.onAddImage}
        onAddFile={props.onAddFile}
        onRemoveAttachment={props.onRemoveAttachment}
      />
    </View>
  );
}

function connectionLabel(connectionState: string): string {
  if (connectionState === 'connected') {
    return 'Connected';
  }
  if (connectionState === 'reconnecting') {
    return 'Connecting';
  }
  return 'Disconnected';
}
