import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Header } from '../components/layout/Header';
import { TabBar } from '../components/layout/TabBar';
import { useAttachments } from '../hooks/useAttachments';
import { useMobileAgentSession } from '../session/useMobileAgentSession';
import { AgentsScreen } from '../screens/AgentsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { styles } from '../styles/appStyles';
import type { AppTab } from './tabs';

export function AppShell() {
  const safeAreaInsets = useSafeAreaInsets();
  const session = useMobileAgentSession();
  const [tab, setTab] = useState<AppTab>('chat');
  const [prompt, setPrompt] = useState('');
  const [agentAddressDraft, setAgentAddressDraft] = useState('');
  const { attachments, addImages, addFiles, removeAttachment, clearAttachments } = useAttachments();

  const active = session.activeConversation;

  useEffect(() => {
    setAgentAddressDraft(active?.agentAddress ?? '');
  }, [active?.agentAddress]);

  const sendPrompt = useCallback(() => {
    session.send(prompt, attachments);
    setPrompt('');
    clearAttachments();
  }, [attachments, clearAttachments, prompt, session]);

  const content = useMemo(() => {
    if (tab === 'agents') {
      return (
        <AgentsScreen
          conversations={session.conversations}
          draft={agentAddressDraft}
          onDraftChange={setAgentAddressDraft}
          onApplyAddress={() => {
            session.connectToAgent(agentAddressDraft.trim());
            setTab('chat');
          }}
          onCreate={() => {
            session.createConversation(agentAddressDraft.trim() || undefined);
            setTab('chat');
          }}
          onSelect={id => {
            session.selectConversation(id);
            setTab('chat');
          }}
          onDelete={session.removeConversation}
        />
      );
    }

    if (tab === 'settings') {
      return (
        <SettingsScreen
          active={active}
          identity={session.identity}
          connectionState={session.connectionState}
          lastOutbound={session.lastOutbound}
          onReconnect={session.reconnect}
        />
      );
    }

    return (
      <ChatScreen
        active={active}
        gate={session.activeGate}
        isProcessing={session.isProcessing}
        prompt={prompt}
        attachments={attachments}
        onPromptChange={setPrompt}
        onSend={sendPrompt}
        onAddImage={addImages}
        onAddFile={addFiles}
        onRemoveAttachment={removeAttachment}
        onModeChange={session.setMode}
        onAskUser={session.respondToAskUser}
        onApproval={session.respondToApproval}
        onOnboard={session.submitOnboard}
        onPlanReview={session.respondToPlanReview}
        onUlw={session.respondToUlwTurnsReached}
      />
    );
  }, [
    active,
    addFiles,
    addImages,
    agentAddressDraft,
    attachments,
    prompt,
    removeAttachment,
    sendPrompt,
    session,
    tab,
  ]);

  return (
    <KeyboardAvoidingView
      style={[styles.shell, { paddingTop: safeAreaInsets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Header
        connectionState={session.connectionState}
        identityAddress={session.identity?.address}
        active={active}
      />
      {session.error ? <Text style={styles.errorBanner}>{session.error}</Text> : null}
      <View style={styles.body}>{content}</View>
      <TabBar value={tab} onChange={setTab} />
    </KeyboardAvoidingView>
  );
}
