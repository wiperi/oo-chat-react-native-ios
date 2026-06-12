import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { launchImageLibrary } from 'react-native-image-picker';
import { errorCodes, isErrorWithCode, pick, types as documentTypes } from '@react-native-documents/picker';
import { useMobileAgentSession } from './src/session/useMobileAgentSession';
import type { ActiveGate, ApprovalMode, ChatItem, Conversation, FileAttachment } from './src/types';

type Tab = 'agents' | 'chat' | 'settings';

const modeLabels: Array<{ mode: ApprovalMode; label: string }> = [
  { mode: 'safe', label: 'Safe' },
  { mode: 'plan', label: 'Plan' },
  { mode: 'accept_edits', label: 'Accept' },
  { mode: 'ulw', label: 'ULW' },
];

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const session = useMobileAgentSession();
  const [tab, setTab] = useState<Tab>('chat');
  const [prompt, setPrompt] = useState('');
  const [agentAddressDraft, setAgentAddressDraft] = useState('');
  const [attachments, setAttachments] = useState<FileAttachment[]>([]);

  const active = session.activeConversation;

  useEffect(() => {
    setAgentAddressDraft(active?.agentAddress ?? '');
  }, [active?.agentAddress]);

  const sendPrompt = useCallback(() => {
    session.send(prompt, attachments);
    setPrompt('');
    setAttachments([]);
  }, [attachments, prompt, session]);

  const addImages = async () => {
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
  };

  const addFiles = async () => {
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
  };

  const removeAttachment = (id: string) => {
    setAttachments(current => current.filter(file => file.id !== id));
  };

  const content = useMemo(() => {
    if (tab === 'agents') {
      return (
        <AgentsScreen
          active={active}
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
    agentAddressDraft,
    attachments,
    prompt,
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

function Header(props: { connectionState: string; identityAddress?: string; active: Conversation | null }) {
  return (
    <View style={styles.header}>
      <View>
        <Text style={styles.brand}>ConnectOnion</Text>
        <Text style={styles.subtitle}>{props.active?.title ?? 'Mobile agent client'}</Text>
      </View>
      <View style={styles.headerMeta}>
        <Text style={[styles.badge, props.connectionState === 'connected' ? styles.badgeOk : styles.badgeWarn]}>
          {props.connectionState}
        </Text>
        <Text style={styles.addressText}>{shortAddress(props.identityAddress)}</Text>
      </View>
    </View>
  );
}

function TabBar(props: { value: Tab; onChange: (tab: Tab) => void }) {
  const tabs: Array<{ value: Tab; label: string }> = [
    { value: 'agents', label: 'Agents' },
    { value: 'chat', label: 'Chat' },
    { value: 'settings', label: 'Settings' },
  ];
  return (
    <View style={styles.tabBar}>
      {tabs.map(tab => (
        <Pressable
          key={tab.value}
          style={[styles.tabButton, props.value === tab.value && styles.tabButtonActive]}
          onPress={() => props.onChange(tab.value)}
        >
          <Text style={[styles.tabText, props.value === tab.value && styles.tabTextActive]}>{tab.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function AgentsScreen(props: {
  active: Conversation | null;
  conversations: Conversation[];
  draft: string;
  onDraftChange: (value: string) => void;
  onApplyAddress: () => void;
  onCreate: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.sectionTitle}>Agent</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Hosted agent address</Text>
        <TextInput
          value={props.draft}
          onChangeText={props.onDraftChange}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="0x..."
          style={styles.input}
        />
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={props.onApplyAddress}>
            <Text style={styles.primaryButtonText}>Use Address</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={props.onCreate}>
            <Text style={styles.secondaryButtonText}>New Chat</Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Conversations</Text>
      {props.conversations.map(conversation => (
        <View key={conversation.id} style={styles.listRow}>
          <Pressable style={styles.listMain} onPress={() => props.onSelect(conversation.id)}>
            <Text style={styles.listTitle}>{conversation.title}</Text>
            <Text style={styles.listMeta}>
              {conversation.mode} · {conversation.ui.length} items · {formatTime(conversation.updatedAt)}
            </Text>
          </Pressable>
          <Pressable style={styles.smallDangerButton} onPress={() => props.onDelete(conversation.id)}>
            <Text style={styles.smallDangerText}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function ChatScreen(props: {
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

function ModeSelector(props: { conversation: Conversation; onChange: (mode: ApprovalMode, options?: { turns?: number }) => void }) {
  return (
    <View style={styles.modeBar}>
      {modeLabels.map(item => (
        <Pressable
          key={item.mode}
          style={[styles.modeButton, props.conversation.mode === item.mode && styles.modeButtonActive]}
          onPress={() => props.onChange(item.mode, item.mode === 'ulw' ? { turns: props.conversation.ulwTurns ?? 5 } : undefined)}
        >
          <Text style={[styles.modeText, props.conversation.mode === item.mode && styles.modeTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
      {props.conversation.mode === 'ulw' ? (
        <Text style={styles.modeCounter}>
          {props.conversation.ulwTurnsUsed ?? 0}/{props.conversation.ulwTurns ?? 5}
        </Text>
      ) : null}
    </View>
  );
}

function ChatItemView(props: { item: ChatItem }) {
  const item = props.item;
  if (item.type === 'user') {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText}>{item.content}</Text>
        {item.files?.map(file => <AttachmentChip key={file.id} file={file} />)}
      </View>
    );
  }
  if (item.type === 'agent') {
    return (
      <View style={[styles.bubble, styles.agentBubble]}>
        <Text style={styles.agentText}>{item.content}</Text>
      </View>
    );
  }
  if (item.type === 'error') {
    return (
      <View style={[styles.activityRow, styles.warnPanel]}>
        <Text style={styles.activityTitle}>Error</Text>
        <Text style={styles.activityBody}>{item.message}</Text>
      </View>
    );
  }
  if (item.type === 'thinking') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Thinking · {item.status}</Text>
        <Text style={styles.activityMeta}>{item.model ?? 'model pending'} {item.duration_ms ? `· ${item.duration_ms} ms` : ''}</Text>
        {item.content ? <Text style={styles.activityBody}>{item.content}</Text> : null}
      </View>
    );
  }
  if (item.type === 'tool_call') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>{item.name} · {item.status}</Text>
        <Text style={styles.activityBody}>{item.result ?? compactJson(item.args)}</Text>
      </View>
    );
  }
  if (item.type === 'files_received') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Files received</Text>
        {item.files.map(file => <Text key={file.path} style={styles.activityBody}>{file.name}</Text>)}
      </View>
    );
  }
  if (item.type === 'intent') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Intent · {item.status}</Text>
        <Text style={styles.activityBody}>{item.ack ?? (item.is_build ? 'Build request detected' : 'Understanding request')}</Text>
      </View>
    );
  }
  if (item.type === 'eval') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Eval · {item.status}</Text>
        <Text style={styles.activityBody}>{item.summary ?? item.expected ?? 'Evaluation pending'}</Text>
      </View>
    );
  }
  if (item.type === 'compact') {
    return (
      <View style={styles.activityRow}>
        <Text style={styles.activityTitle}>Compact · {item.status}</Text>
        <Text style={styles.activityBody}>
          {item.message ?? item.error ?? `${item.context_before ?? item.context_percent ?? 0}% -> ${item.context_after ?? item.context_percent ?? 0}%`}
        </Text>
      </View>
    );
  }
  if (item.type === 'tool_blocked') {
    return (
      <View style={[styles.activityRow, styles.warnPanel]}>
        <Text style={styles.activityTitle}>{item.tool} blocked</Text>
        <Text style={styles.activityBody}>{item.message}</Text>
      </View>
    );
  }
  if (item.type === 'onboard_success') {
    return (
      <View style={[styles.activityRow, styles.successPanel]}>
        <Text style={styles.activityTitle}>Onboarded · {item.level}</Text>
        <Text style={styles.activityBody}>{item.message}</Text>
      </View>
    );
  }
  if (item.type === 'plan_review') {
    return <PendingSummary label="Plan review" resolved={item.resolved} />;
  }
  if (item.type === 'ask_user') {
    return <PendingSummary label="Question" resolved={item.answered} />;
  }
  if (item.type === 'approval_needed') {
    return <PendingSummary label={`Approval · ${item.tool}`} resolved={item.resolved} />;
  }
  if (item.type === 'onboard_required') {
    return <PendingSummary label="Onboarding required" resolved={item.resolved} />;
  }
  if (item.type === 'ulw_turns_reached') {
    return <PendingSummary label={`ULW paused at ${item.turns_used}/${item.max_turns}`} resolved={item.resolved} />;
  }
  return (
    <View style={styles.activityRow}>
      <Text style={styles.activityTitle}>Unknown item</Text>
    </View>
  );
}

function PendingSummary(props: { label: string; resolved?: boolean }) {
  return (
    <View style={[styles.activityRow, props.resolved ? styles.successPanel : styles.pendingPanel]}>
      <Text style={styles.activityTitle}>{props.label}</Text>
      <Text style={styles.activityMeta}>{props.resolved ? 'resolved' : 'waiting for human'}</Text>
    </View>
  );
}

function GatePanel(props: {
  gate: ActiveGate;
  onAskUser: (answer: string | string[]) => void;
  onApproval: (approved: boolean, scope: 'once' | 'session') => void;
  onOnboard: (options: { inviteCode?: string; payment?: number }) => void;
  onPlanReview: (message: string) => void;
  onUlw: (action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => void;
}) {
  const [text, setText] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  useEffect(() => {
    setText('');
    setSelected([]);
    setFieldValues({});
  }, [props.gate?.kind]);

  if (!props.gate) {
    return null;
  }

  if (props.gate.kind === 'ask_user') {
    const toggle = (option: string) => {
      setSelected(current => current.includes(option) ? current.filter(item => item !== option) : [...current, option]);
    };
    return (
      <View style={styles.gatePanel}>
        <Text style={styles.gateTitle}>{props.gate.data.question}</Text>
        <View style={styles.optionWrap}>
          {props.gate.data.options.map(option => (
            <Pressable
              key={option}
              style={[styles.optionButton, selected.includes(option) && styles.optionButtonActive]}
              onPress={() => props.gate?.kind === 'ask_user' && (props.gate.data.multi_select ? toggle(option) : setSelected([option]))}
            >
              <Text style={[styles.optionText, selected.includes(option) && styles.optionTextActive]}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={text} onChangeText={setText} placeholder="Custom answer" style={styles.input} />
        {props.gate.data.fields?.map(field => (
          <View key={field.name} style={styles.fieldBlock}>
            <Text style={styles.label}>{field.label}{field.required ? ' *' : ''}</Text>
            <TextInput
              value={fieldValues[field.name] ?? ''}
              onChangeText={value => setFieldValues(current => ({ ...current, [field.name]: value }))}
              placeholder={field.placeholder}
              secureTextEntry={field.type === 'password'}
              style={styles.input}
            />
          </View>
        ))}
        <Pressable
          style={styles.primaryButton}
          onPress={() => props.onAskUser(formatAskUserAnswer(selected.length > 0 ? selected : text, fieldValues))}
        >
          <Text style={styles.primaryButtonText}>Send Answer</Text>
        </Pressable>
      </View>
    );
  }

  if (props.gate.kind === 'approval') {
    return (
      <View style={styles.gatePanel}>
        <Text style={styles.gateTitle}>{props.gate.data.tool}</Text>
        <Text style={styles.gateBody}>{props.gate.data.description}</Text>
        <Text style={styles.codeText}>{compactJson(props.gate.data.arguments)}</Text>
        {props.gate.data.batch_remaining?.map(item => (
          <Text key={item.tool} style={styles.gateBody}>Next: {item.tool} {item.arguments}</Text>
        ))}
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={() => props.onApproval(true, 'once')}>
            <Text style={styles.primaryButtonText}>Approve Once</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => props.onApproval(true, 'session')}>
            <Text style={styles.secondaryButtonText}>Session</Text>
          </Pressable>
          <Pressable style={styles.dangerButton} onPress={() => props.onApproval(false, 'once')}>
            <Text style={styles.dangerButtonText}>Reject</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (props.gate.kind === 'onboard') {
    return (
      <View style={styles.gatePanel}>
        <Text style={styles.gateTitle}>Onboarding</Text>
        <Text style={styles.gateBody}>Methods: {props.gate.data.methods.join(', ')}</Text>
        <TextInput value={text} onChangeText={setText} placeholder="Invite code" autoCapitalize="characters" style={styles.input} />
        <View style={styles.row}>
          <Pressable style={styles.primaryButton} onPress={() => props.onOnboard({ inviteCode: text.trim() })}>
            <Text style={styles.primaryButtonText}>Submit Code</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={() => props.onOnboard({ payment: props.gate?.kind === 'onboard' ? props.gate.data.paymentAmount : 1 })}>
            <Text style={styles.secondaryButtonText}>Use Payment</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (props.gate.kind === 'plan_review') {
    return (
      <View style={styles.gatePanel}>
        <Text style={styles.gateTitle}>Plan Review</Text>
        <Text style={styles.codeText}>{props.gate.data.plan_content}</Text>
        <TextInput value={text} onChangeText={setText} placeholder="Feedback or approval" multiline style={[styles.input, styles.multiline]} />
        <Pressable style={styles.primaryButton} onPress={() => props.onPlanReview(text.trim() || 'approved')}>
          <Text style={styles.primaryButtonText}>Send Review</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.gatePanel}>
      <Text style={styles.gateTitle}>ULW paused</Text>
      <Text style={styles.gateBody}>
        {props.gate.data.turns_used} of {props.gate.data.max_turns} turns used.
      </Text>
      <View style={styles.row}>
        <Pressable style={styles.primaryButton} onPress={() => props.onUlw('continue', { turns: props.gate?.kind === 'ulw' ? props.gate.data.max_turns : 5 })}>
          <Text style={styles.primaryButtonText}>Continue</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => props.onUlw('switch_mode', { mode: 'safe' })}>
          <Text style={styles.secondaryButtonText}>Safe Mode</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Composer(props: {
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

function SettingsScreen(props: {
  active: Conversation | null;
  identity: { address: string; publicKeyHex: string; createdAt: number } | null;
  connectionState: string;
  lastOutbound: unknown;
  onReconnect: () => void;
}) {
  return (
    <ScrollView contentContainerStyle={styles.screenContent}>
      <Text style={styles.sectionTitle}>Identity</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Address</Text>
        <Text style={styles.codeText}>{props.identity?.address ?? 'Creating...'}</Text>
        <Text style={styles.label}>Public key</Text>
        <Text style={styles.codeText}>{props.identity?.publicKeyHex ?? 'Pending'}</Text>
      </View>
      <Text style={styles.sectionTitle}>Session</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Status</Text>
        <Text style={styles.valueText}>{props.connectionState}</Text>
        <Text style={styles.label}>Session ID</Text>
        <Text style={styles.codeText}>{props.active?.id ?? 'None'}</Text>
        <Pressable style={styles.primaryButton} onPress={props.onReconnect}>
          <Text style={styles.primaryButtonText}>Reconnect</Text>
        </Pressable>
      </View>
      <Text style={styles.sectionTitle}>Last outbound</Text>
      <View style={styles.panel}>
        <Text style={styles.codeText}>{compactJson(props.lastOutbound)}</Text>
      </View>
    </ScrollView>
  );
}

function AttachmentChip(props: { file: FileAttachment }) {
  return (
    <View style={styles.fileChip}>
      <Text style={styles.fileChipText}>{props.file.name} · {formatBytes(props.file.size)}</Text>
    </View>
  );
}

function formatAskUserAnswer(answer: string | string[], fields: Record<string, string>): string | string[] {
  const filledFields = Object.entries(fields).filter(([, value]) => value.trim().length > 0);
  if (filledFields.length === 0) {
    return answer;
  }
  return JSON.stringify({
    answer,
    fields: Object.fromEntries(filledFields),
  });
}

function shortAddress(address?: string): string {
  if (!address) {
    return 'No identity';
  }
  if (address.length <= 14) {
    return address;
  }
  return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function compactJson(value: unknown): string {
  if (!value) {
    return 'None';
  }
  return JSON.stringify(value, null, 2);
}

function formatBytes(bytes: number): string {
  if (!bytes) {
    return 'unknown size';
  }
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const colors = {
  ink: '#17202A',
  muted: '#61717F',
  line: '#D7DEE6',
  page: '#F6F8FA',
  panel: '#FFFFFF',
  teal: '#146C6C',
  tealSoft: '#D9F0EE',
  blue: '#295C9E',
  amber: '#8A5B12',
  amberSoft: '#FFF0CF',
  red: '#A33A35',
  redSoft: '#FCE1DF',
  green: '#2D7A46',
  greenSoft: '#DFF3E5',
};

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    backgroundColor: colors.page,
  },
  header: {
    minHeight: 72,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brand: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    marginTop: 2,
  },
  headerMeta: {
    alignItems: 'flex-end',
    gap: 6,
  },
  badge: {
    overflow: 'hidden',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '700',
  },
  badgeOk: {
    color: colors.green,
    backgroundColor: colors.greenSoft,
  },
  badgeWarn: {
    color: colors.amber,
    backgroundColor: colors.amberSoft,
  },
  addressText: {
    color: colors.muted,
    fontSize: 12,
  },
  errorBanner: {
    margin: 12,
    borderRadius: 8,
    padding: 10,
    color: colors.red,
    backgroundColor: colors.redSoft,
  },
  body: {
    flex: 1,
  },
  screenContent: {
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 10,
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  valueText: {
    color: colors.ink,
    fontSize: 16,
  },
  input: {
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FBFCFD',
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputDisabled: {
    color: colors.muted,
    backgroundColor: '#EEF2F4',
  },
  multiline: {
    minHeight: 86,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.teal,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '800',
  },
  dangerButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.red,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  smallDangerButton: {
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.redSoft,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallDangerText: {
    color: colors.red,
    fontWeight: '800',
    fontSize: 12,
  },
  listRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  listMain: {
    flex: 1,
    gap: 3,
  },
  listTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  listMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  chatLayout: {
    flex: 1,
  },
  modeBar: {
    minHeight: 54,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.panel,
  },
  modeButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: 64,
    alignItems: 'center',
  },
  modeButtonActive: {
    backgroundColor: colors.tealSoft,
    borderColor: colors.teal,
  },
  modeText: {
    color: colors.muted,
    fontWeight: '800',
    fontSize: 12,
  },
  modeTextActive: {
    color: colors.teal,
  },
  modeCounter: {
    marginLeft: 'auto',
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 14,
    gap: 10,
  },
  bubble: {
    maxWidth: '88%',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: colors.blue,
  },
  agentBubble: {
    alignSelf: 'flex-start',
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
  },
  userText: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 21,
  },
  agentText: {
    color: colors.ink,
    fontSize: 15,
    lineHeight: 21,
  },
  activityRow: {
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 11,
    gap: 4,
  },
  activityTitle: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '800',
  },
  activityMeta: {
    color: colors.muted,
    fontSize: 12,
  },
  activityBody: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
  },
  warnPanel: {
    backgroundColor: colors.amberSoft,
    borderColor: '#E0BF73',
  },
  successPanel: {
    backgroundColor: colors.greenSoft,
    borderColor: '#9DD3AE',
  },
  pendingPanel: {
    backgroundColor: '#EEF5FF',
    borderColor: '#B9CDE8',
  },
  gatePanel: {
    alignSelf: 'stretch',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#96BDBA',
    backgroundColor: colors.tealSoft,
    padding: 14,
    gap: 10,
  },
  gateTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  gateBody: {
    color: colors.ink,
    fontSize: 14,
    lineHeight: 20,
  },
  optionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#96BDBA',
    backgroundColor: colors.panel,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  optionButtonActive: {
    backgroundColor: colors.teal,
    borderColor: colors.teal,
  },
  optionText: {
    color: colors.ink,
    fontWeight: '700',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  fieldBlock: {
    gap: 6,
  },
  codeText: {
    color: colors.ink,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    fontSize: 12,
    lineHeight: 18,
  },
  composer: {
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
    padding: 10,
    gap: 8,
  },
  composerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  composerInput: {
    flex: 1,
    minHeight: 46,
    maxHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FBFCFD',
    color: colors.ink,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  sendButton: {
    minWidth: 68,
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.teal,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9AA8A8',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  attachmentStrip: {
    gap: 8,
  },
  attachmentPreview: {
    width: 118,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: '#FBFCFD',
    padding: 8,
    gap: 5,
  },
  attachmentImage: {
    width: '100%',
    height: 64,
    borderRadius: 6,
    backgroundColor: colors.line,
  },
  attachmentName: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  removeText: {
    color: colors.red,
    fontSize: 12,
    fontWeight: '800',
  },
  fileChip: {
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.18)',
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  fileChipText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    padding: 18,
  },
  tabBar: {
    minHeight: 68,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingBottom: 8,
  },
  tabButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  tabButtonActive: {
    backgroundColor: colors.tealSoft,
  },
  tabText: {
    color: colors.muted,
    fontWeight: '800',
  },
  tabTextActive: {
    color: colors.teal,
  },
});

export default App;
