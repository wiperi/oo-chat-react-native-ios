import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { ChatItemView } from '../components/chat/ChatItemView';
import { Composer } from '../components/chat/Composer';
import { GatePanel } from '../components/chat/GatePanel';
import { ModeSelector } from '../components/chat/ModeSelector';
import { styles } from '../styles/appStyles';
import type { ActiveGate, ApprovalMode, Conversation, FileAttachment } from '../types';

export function ChatScreen(props: {
  active: Conversation | null;
  gate: ActiveGate;
  isProcessing: boolean;
  prompt: string;
  attachments: FileAttachment[];
  onPromptChange: (value: string) => void;
  onSend: () => void;
  onAddImage: () => void;
  onAddFile: () => void;
  onRemoveAttachment: (id: string) => void;
  onModeChange: (mode: ApprovalMode, options?: { turns?: number }) => void;
  onAskUser: (answer: string | string[]) => void;
  onApproval: (approved: boolean, scope: 'once' | 'session') => void;
  onOnboard: (options: { inviteCode?: string; payment?: number }) => void;
  onPlanReview: (message: string) => void;
  onUlw: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void;
}) {
  if (!props.active) {
    return <Text style={styles.emptyText}>No conversation selected.</Text>;
  }

  return (
    <View style={styles.chatLayout}>
      <ModeSelector conversation={props.active} onChange={props.onModeChange} />
      <ScrollView style={styles.messages} contentContainerStyle={styles.messagesContent}>
        {props.active.ui.map(item => <ChatItemView key={item.id} item={item} />)}
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
        onChange={props.onPromptChange}
        onSend={props.onSend}
        onAddImage={props.onAddImage}
        onAddFile={props.onAddFile}
        onRemoveAttachment={props.onRemoveAttachment}
      />
    </View>
  );
}
