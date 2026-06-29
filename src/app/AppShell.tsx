import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Keyboard, KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TabBar } from '../components/layout/TabBar';
import { useAttachments } from '../hooks/useAttachments';
import { useMobileAgentSession } from '../session/useMobileAgentSession';
import { AddAgentScreen } from '../screens/AddAgentScreen';
import { AgentsScreen } from '../screens/AgentsScreen';
import { ChatScreen } from '../screens/ChatScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { WelcomeScreen } from '../screens/WelcomeScreen';
import { styles } from '../styles/appStyles';
import type { AppTab } from './tabs';

const WELCOME_SEEN_KEY = 'connectonion.mobile.welcome.seen';

export function AppShell() {
  const safeAreaInsets = useSafeAreaInsets();
  const session = useMobileAgentSession();
  const [tab, setTab] = useState<AppTab>('agents');
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [agentAddressDraft, setAgentAddressDraft] = useState('');
  const [agentTokenDraft, setAgentTokenDraft] = useState('');
  const [pendingAgentAddress, setPendingAgentAddress] = useState<string | null>(null);
  const [hasSeenWelcome, setHasSeenWelcome] = useState<boolean | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const { attachments, addImages, addFiles, removeAttachment, clearAttachments } = useAttachments();

  const active = session.activeConversation;
  const hasAgents = useMemo(
    () => session.conversations.some(conversation => conversation.agentAddress.trim().length > 0),
    [session.conversations],
  );
  const isFirstAgentGate = tab === 'agents' && !hasAgents && !isAddingAgent && !isChatOpen;
  const isSessionLoading = session.identity === null && session.error === null;
  const isWelcomeLoading = isFirstAgentGate && (hasSeenWelcome === null || isSessionLoading);
  const shouldShowWelcome = isFirstAgentGate && hasSeenWelcome === false;
  const isFirstAgentFlow = isFirstAgentGate && hasSeenWelcome === true;

  useEffect(() => {
    let mounted = true;

    AsyncStorage.getItem(WELCOME_SEEN_KEY)
      .then(value => {
        if (mounted) {
          setHasSeenWelcome(value === 'true');
        }
      })
      .catch(() => {
        if (mounted) {
          setHasSeenWelcome(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const showSubscription = Keyboard.addListener('keyboardWillShow', () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener('keyboardWillHide', () => setKeyboardVisible(false));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  useEffect(() => {
    setAgentAddressDraft(active?.agentAddress ?? '');
  }, [active?.agentAddress]);

  useEffect(() => {
    if (!pendingAgentAddress) {
      return;
    }

    const target = session.conversations.find(
      conversation => conversation.agentAddress.trim() === pendingAgentAddress,
    );
    if (!target) {
      if (session.error) {
        setPendingAgentAddress(null);
      }
      return;
    }
    if (active?.id !== target.id) {
      return;
    }

    setPendingAgentAddress(null);
    setIsAddingAgent(false);
    setIsChatOpen(true);
  }, [active?.id, pendingAgentAddress, session.conversations, session.error]);

  const sendPrompt = useCallback(() => {
    session.send(prompt, attachments);
    setPrompt('');
    clearAttachments();
  }, [attachments, clearAttachments, prompt, session]);

  const connectDraftAgent = useCallback(() => {
    const normalizedAddress = agentAddressDraft.trim();
    const token = agentTokenDraft.trim();
    setPendingAgentAddress(normalizedAddress);
    if (token) {
      session.saveAgentCredential(normalizedAddress, token).catch(() => undefined);
      setAgentTokenDraft('');
    }
    session.connectToAgent(normalizedAddress);
  }, [agentAddressDraft, agentTokenDraft, session]);

  const closeAddAgent = useCallback(() => {
    setPendingAgentAddress(null);
    setAgentTokenDraft('');
    setIsAddingAgent(false);
  }, []);

  const startFirstAgentFlow = useCallback(() => {
    setHasSeenWelcome(true);
    AsyncStorage.setItem(WELCOME_SEEN_KEY, 'true').catch(() => undefined);
  }, []);

  const changeTab = useCallback((nextTab: AppTab) => {
    setTab(nextTab);
    setPendingAgentAddress(null);
    setIsAddingAgent(false);
    setIsChatOpen(false);
  }, []);

  const content = useMemo(() => {
    if (isWelcomeLoading) {
      return null;
    }

    if (shouldShowWelcome) {
      return <WelcomeScreen onGetStarted={startFirstAgentFlow} />;
    }

    if (isAddingAgent || pendingAgentAddress !== null) {
      return (
        <AddAgentScreen
          draft={agentAddressDraft}
          tokenDraft={agentTokenDraft}
          onDraftChange={setAgentAddressDraft}
          onTokenDraftChange={setAgentTokenDraft}
          onConnect={connectDraftAgent}
          onBack={closeAddAgent}
          showBack={isAddingAgent}
        />
      );
    }

    if (isFirstAgentFlow) {
      return (
        <AddAgentScreen
          draft={agentAddressDraft}
          tokenDraft={agentTokenDraft}
          onDraftChange={setAgentAddressDraft}
          onTokenDraftChange={setAgentTokenDraft}
          onConnect={connectDraftAgent}
          onBack={closeAddAgent}
          showBack={false}
        />
      );
    }

    if (isChatOpen) {
      return (
        <ChatScreen
          active={active}
          gate={session.activeGate}
          isProcessing={session.isProcessing}
          prompt={prompt}
          attachments={attachments}
          connectionState={session.connectionState}
          bottomInset={safeAreaInsets.bottom}
          onBack={() => setIsChatOpen(false)}
          onPromptChange={setPrompt}
          onSend={sendPrompt}
          onAddImage={addImages}
          onAddFile={addFiles}
          onRemoveAttachment={removeAttachment}
          onModeChange={session.setMode}
          onCreate={() => session.createConversation(active.agentAddress || undefined)}
          onAskUser={session.respondToAskUser}
          onApproval={session.respondToApproval}
          onOnboard={session.submitOnboard}
          onPlanReview={session.respondToPlanReview}
          onUlw={session.respondToUlwTurnsReached}
        />
      );
    }

    if (tab === 'agents') {
      return (
        <AgentsScreen
          conversations={session.conversations}
          activeId={active?.id ?? null}
          connectionState={session.connectionState}
          onAddAgent={() => setIsAddingAgent(true)}
          onSelect={id => {
            session.selectConversation(id);
            setIsChatOpen(true);
          }}
        />
      );
    }

    if (tab === 'history') {
      return (
        <HistoryScreen
          conversations={session.conversations}
          onSelect={id => {
            session.selectConversation(id);
            setIsChatOpen(true);
          }}
          onDelete={session.removeConversation}
        />
      );
    }

    if (tab === 'settings') {
      return (
        <SettingsScreen
          active={active}
          conversations={session.conversations}
          identity={session.identity}
          activeAgentToken={session.activeAgentToken}
          connectionState={session.connectionState}
          lastOutbound={session.lastOutbound}
          onReconnect={session.reconnect}
          onBackupSeed={session.backupIdentitySeed}
          onImportSeed={session.restoreIdentitySeed}
          onResetIdentity={session.resetDeviceIdentity}
        />
      );
    }
  }, [
    active,
    addFiles,
    addImages,
    agentAddressDraft,
    agentTokenDraft,
    attachments,
    connectDraftAgent,
    closeAddAgent,
    isAddingAgent,
    isChatOpen,
    isFirstAgentFlow,
    isWelcomeLoading,
    pendingAgentAddress,
    prompt,
    removeAttachment,
    safeAreaInsets.bottom,
    sendPrompt,
    session,
    shouldShowWelcome,
    startFirstAgentFlow,
    tab,
  ]);

  return (
    <KeyboardAvoidingView
      style={[styles.shell, { paddingTop: safeAreaInsets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {isChatOpen ? (
        <View
          pointerEvents="none"
          style={[styles.chatBackdrop, { top: safeAreaInsets.top }]}
        />
      ) : null}
      {session.error && !shouldShowWelcome && !isWelcomeLoading ? (
        <Text style={styles.errorBanner}>{session.error}</Text>
      ) : null}
      <View style={styles.body}>{content}</View>
      {isAddingAgent || pendingAgentAddress !== null || isChatOpen || isFirstAgentFlow || isWelcomeLoading || shouldShowWelcome || keyboardVisible ? null : (
        <TabBar value={tab} bottomInset={safeAreaInsets.bottom} onChange={changeTab} />
      )}
    </KeyboardAvoidingView>
  );
}
