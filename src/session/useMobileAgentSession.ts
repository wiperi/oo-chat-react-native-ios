import { AppState } from 'react-native';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  deleteConversation,
  listConversations,
  loadActiveConversationId,
  saveActiveConversationId,
  saveConversation,
} from '../storage/sessionRepository';
import { loadOrCreateIdentity, signPayload } from '../storage/keyManager';
import { connectHostedAgent, sendPromptToHostedAgent } from './remoteAgentClient';
import type {
  ActiveGate,
  ApprovalMode,
  ChatItem,
  ConnectionState,
  Conversation,
  FileAttachment,
  SignedMessage,
  StoredIdentity,
} from '../types';

const DEFAULT_AGENT_ADDRESS = '';

function isHostedAgentAddress(address: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(address);
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function titleFromPrompt(prompt: string): string {
  const compact = prompt.trim().replace(/\s+/g, ' ');
  if (!compact) {
    return 'New conversation';
  }
  return compact.length > 38 ? `${compact.slice(0, 35)}...` : compact;
}

function titleFromAddress(address: string): string {
  if (address.length <= 18) {
    return address;
  }
  return `Agent ${address.slice(0, 8)}...${address.slice(-6)}`;
}

function starterConversation(agentAddress = DEFAULT_AGENT_ADDRESS): Conversation {
  const now = Date.now();
  return {
    id: makeId('session'),
    title: 'New mobile session',
    agentAddress,
    createdAt: now,
    updatedAt: now,
    mode: 'safe',
    ulwTurns: null,
    ulwTurnsUsed: null,
    ui: [
      {
        id: makeId('agent'),
        type: 'agent',
        content: 'ConnectOnion mobile session is ready.',
      },
    ],
  };
}

function removeRunningThinking(conversation: Conversation): Conversation {
  return {
    ...conversation,
    ui: conversation.ui.filter(item => !(item.type === 'thinking' && item.status === 'running')),
  };
}

function appendItems(conversation: Conversation, items: ChatItem[]): Conversation {
  return {
    ...conversation,
    updatedAt: Date.now(),
    ui: [...conversation.ui, ...items],
  };
}

function getActiveGate(ui: ChatItem[]): ActiveGate {
  for (let i = ui.length - 1; i >= 0; i -= 1) {
    const item = ui[i];
    if (item.type === 'ask_user' && !item.answered) {
      return {
        kind: 'ask_user',
        data: {
          id: item.id,
          question: item.text,
          options: item.options,
          multi_select: item.multi_select,
          input_type: item.input_type,
          fields: item.fields,
        },
      };
    }
    if (item.type === 'approval_needed' && !item.resolved) {
      return {
        kind: 'approval',
        data: {
          id: item.id,
          tool: item.tool,
          arguments: item.arguments,
          description: item.description,
          batch_remaining: item.batch_remaining,
        },
      };
    }
    if (item.type === 'onboard_required' && !item.resolved) {
      return {
        kind: 'onboard',
        data: {
          id: item.id,
          methods: item.methods,
          paymentAmount: item.paymentAmount,
        },
      };
    }
    if (item.type === 'plan_review' && !item.resolved) {
      return {
        kind: 'plan_review',
        data: {
          id: item.id,
          plan_content: item.plan_content,
        },
      };
    }
    if (item.type === 'ulw_turns_reached' && !item.resolved) {
      return {
        kind: 'ulw',
        data: {
          id: item.id,
          turns_used: item.turns_used,
          max_turns: item.max_turns,
        },
      };
    }
  }
  return null;
}

export function useMobileAgentSession() {
  const [identity, setIdentity] = useState<StoredIdentity | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOutbound, setLastOutbound] = useState<SignedMessage | Record<string, unknown> | null>(null);

  const activeConversation = useMemo(
    () => conversations.find(conversation => conversation.id === activeId) ?? conversations[0] ?? null,
    [activeId, conversations],
  );

  const activeGate = useMemo(
    () => getActiveGate(activeConversation?.ui ?? []),
    [activeConversation?.ui],
  );

  const upsertConversation = useCallback((next: Conversation) => {
    setConversations(current => {
      const without = current.filter(conversation => conversation.id !== next.id);
      return [next, ...without].sort((a, b) => b.updatedAt - a.updatedAt);
    });
    saveConversation(next).catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    let mounted = true;

    async function hydrate() {
      const [loadedIdentity, storedConversations, storedActiveId] = await Promise.all([
        loadOrCreateIdentity(),
        listConversations(),
        loadActiveConversationId(),
      ]);
      if (!mounted) {
        return;
      }

      const initial = storedConversations.length > 0 ? storedConversations : [starterConversation()];
      setIdentity(loadedIdentity);
      setConversations(initial);
      setActiveId(storedActiveId && initial.some(item => item.id === storedActiveId) ? storedActiveId : initial[0].id);
      if (storedConversations.length === 0) {
        await saveConversation(initial[0]);
        await saveActiveConversationId(initial[0].id);
      }
    }

    hydrate().catch(err => setError(err instanceof Error ? err.message : String(err)));
    return () => {
      mounted = false;
    };
  }, []);

  const selectConversation = useCallback((id: string) => {
    setActiveId(id);
    saveActiveConversationId(id).catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  const createConversation = useCallback((agentAddress?: string) => {
    const next = starterConversation(agentAddress || activeConversation?.agentAddress || DEFAULT_AGENT_ADDRESS);
    upsertConversation(next);
    selectConversation(next.id);
    setConnectionState('disconnected');
  }, [activeConversation?.agentAddress, selectConversation, upsertConversation]);

  const removeConversation = useCallback((id: string) => {
    setConversations(current => {
      const remaining = current.filter(conversation => conversation.id !== id);
      if (activeId === id) {
        const nextActive = remaining[0]?.id ?? null;
        setActiveId(nextActive);
        if (nextActive) {
          saveActiveConversationId(nextActive).catch(err => setError(err instanceof Error ? err.message : String(err)));
        }
      }
      return remaining;
    });
    deleteConversation(id).catch(err => setError(err instanceof Error ? err.message : String(err)));
  }, [activeId]);

  const setMode = useCallback((mode: ApprovalMode, options?: { turns?: number }) => {
    if (!activeConversation) {
      return;
    }
    const next: Conversation = {
      ...activeConversation,
      mode,
      ulwTurns: mode === 'ulw' ? options?.turns ?? activeConversation.ulwTurns ?? 5 : null,
      ulwTurnsUsed: mode === 'ulw' ? activeConversation.ulwTurnsUsed ?? 0 : null,
      updatedAt: Date.now(),
    };
    setLastOutbound({ type: 'mode_change', mode, ...(mode === 'ulw' ? { turns: next.ulwTurns } : {}) });
    upsertConversation(next);
  }, [activeConversation, upsertConversation]);

  const updateAgentAddress = useCallback((agentAddress: string) => {
    if (!activeConversation) {
      return;
    }
    upsertConversation({ ...activeConversation, agentAddress, updatedAt: Date.now() });
    setConnectionState('disconnected');
  }, [activeConversation, upsertConversation]);

  const connectToAgent = useCallback((agentAddress: string) => {
    const normalized = agentAddress.trim();
    if (!isHostedAgentAddress(normalized)) {
      setError('Enter a hosted agent address in 0x-prefixed Ed25519 format.');
      return;
    }

    setError(null);
    const existing = conversations.find(conversation => conversation.agentAddress === normalized);
    const target = existing ?? {
      ...starterConversation(normalized),
      title: titleFromAddress(normalized),
      ui: [
        {
          id: makeId('agent'),
          type: 'agent' as const,
          content: `Connected agent selected: ${titleFromAddress(normalized)}.`,
        },
      ],
    };

    upsertConversation(target);
    selectConversation(target.id);
    connectHostedAgent(normalized, target, {
      onConnectionState: setConnectionState,
      onOutbound: setLastOutbound,
    })
      .then(result => {
        upsertConversation({
          ...target,
          serverSession: result.serverSession ?? target.serverSession,
          updatedAt: Date.now(),
        });
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        upsertConversation(appendItems(target, [{ id: makeId('error'), type: 'error', message }]));
      });
  }, [conversations, selectConversation, upsertConversation]);

  const send = useCallback((prompt: string, files: FileAttachment[]) => {
    if (!activeConversation || isProcessing) {
      return;
    }
    const trimmed = prompt.trim();
    if (!trimmed) {
      return;
    }
    if (!isHostedAgentAddress(activeConversation.agentAddress)) {
      setError('Use a hosted agent address before sending a message.');
      return;
    }

    setError(null);
    setIsProcessing(true);
    const nextTurnsUsed = activeConversation.mode === 'ulw' ? (activeConversation.ulwTurnsUsed ?? 0) + 1 : activeConversation.ulwTurnsUsed;
    let latest = appendItems(
      {
        ...activeConversation,
        title: activeConversation.title === 'New mobile session' ? titleFromPrompt(trimmed) : activeConversation.title,
        ulwTurnsUsed: nextTurnsUsed,
      },
      [
        { id: makeId('user'), type: 'user', content: trimmed, files },
        { id: makeId('thinking'), type: 'thinking', status: 'running', model: 'co/o4-mini' },
      ],
    );
    upsertConversation(latest);
    setLastOutbound({ type: 'INPUT', session_id: latest.id, prompt: trimmed, files: files.map(file => ({ name: file.name, uri: file.uri })) });

    sendPromptToHostedAgent(activeConversation.agentAddress, latest, trimmed, files, {
      onConnectionState: setConnectionState,
      onOutbound: setLastOutbound,
      onStreamItems: items => {
        latest = appendItems(latest, items);
        upsertConversation(latest);
      },
    })
      .then(result => {
        latest = {
          ...latest,
          serverSession: result.serverSession ?? latest.serverSession,
          updatedAt: Date.now(),
        };
        const next = appendItems(removeRunningThinking(latest), result.items);
        upsertConversation(next);
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        const next = appendItems(removeRunningThinking(latest), [{ id: makeId('error'), type: 'error', message }]);
        upsertConversation(next);
      })
      .finally(() => {
        setIsProcessing(false);
      });
  }, [activeConversation, isProcessing, upsertConversation]);

  const respondToAskUser = useCallback((answer: string | string[]) => {
    if (!activeConversation || activeGate?.kind !== 'ask_user') {
      return;
    }
    const next = appendItems(
      {
        ...activeConversation,
        ui: activeConversation.ui.map(item => item.id === activeGate.data.id && item.type === 'ask_user'
          ? { ...item, answered: true, answer }
          : item),
      },
      [{ id: makeId('agent'), type: 'agent', content: `Noted: ${Array.isArray(answer) ? answer.join(', ') : answer}` }],
    );
    setLastOutbound({ type: 'ASK_USER_RESPONSE', answer, session_id: activeConversation.id });
    upsertConversation(next);
  }, [activeConversation, activeGate, upsertConversation]);

  const respondToApproval = useCallback((approved: boolean, scope: 'once' | 'session') => {
    if (!activeConversation || activeGate?.kind !== 'approval') {
      return;
    }
    const next = appendItems(
      {
        ...activeConversation,
        ui: activeConversation.ui.map(item => item.id === activeGate.data.id && item.type === 'approval_needed'
          ? { ...item, resolved: true }
          : item),
      },
      approved
        ? [
            { id: makeId('tool'), type: 'tool_call', name: activeGate.data.tool, status: 'done', result: `Approved for ${scope}` },
            { id: makeId('agent'), type: 'agent', content: 'Approval received. The tool action can continue.' },
          ]
        : [
            { id: makeId('blocked'), type: 'tool_blocked', tool: activeGate.data.tool, reason: 'rejected_by_user', message: 'The user rejected this tool request.' },
          ],
    );
    setLastOutbound({ type: 'APPROVAL_RESPONSE', approved, scope, session_id: activeConversation.id });
    upsertConversation(next);
  }, [activeConversation, activeGate, upsertConversation]);

  const submitOnboard = useCallback(async (options: { inviteCode?: string; payment?: number }) => {
    if (!activeConversation || activeGate?.kind !== 'onboard') {
      return;
    }
    const payload = {
      timestamp: Math.floor(Date.now() / 1000),
      ...(options.inviteCode ? { invite_code: options.inviteCode } : {}),
      ...(options.payment ? { payment: options.payment } : {}),
    };
    const signed = await signPayload('ONBOARD_SUBMIT', payload);
    const next = appendItems(
      {
        ...activeConversation,
        ui: activeConversation.ui.map(item => item.id === activeGate.data.id && item.type === 'onboard_required'
          ? { ...item, resolved: true }
          : item),
      },
      [{ id: makeId('onboard'), type: 'onboard_success', level: 'careful', message: 'Identity proof submitted from iOS Keychain-backed keys.' }],
    );
    setLastOutbound(signed);
    upsertConversation(next);
  }, [activeConversation, activeGate, upsertConversation]);

  const respondToPlanReview = useCallback((message: string) => {
    if (!activeConversation || activeGate?.kind !== 'plan_review') {
      return;
    }
    const next = appendItems(
      {
        ...activeConversation,
        ui: activeConversation.ui.map(item => item.id === activeGate.data.id && item.type === 'plan_review'
          ? { ...item, resolved: true, response: message }
          : item),
      },
      [{ id: makeId('agent'), type: 'agent', content: 'Plan review response sent to the agent.' }],
    );
    setLastOutbound({ type: 'PLAN_REVIEW_RESPONSE', message, session_id: activeConversation.id });
    upsertConversation(next);
  }, [activeConversation, activeGate, upsertConversation]);

  const respondToUlwTurnsReached = useCallback((action: 'continue' | 'switch_mode', options?: { turns?: number; mode?: ApprovalMode }) => {
    if (!activeConversation || activeGate?.kind !== 'ulw') {
      return;
    }
    const nextMode = action === 'switch_mode' ? options?.mode ?? 'safe' : 'ulw';
    const next = appendItems(
      {
        ...activeConversation,
        mode: nextMode,
        ulwTurns: nextMode === 'ulw' ? options?.turns ?? activeConversation.ulwTurns ?? activeGate.data.max_turns : null,
        ulwTurnsUsed: nextMode === 'ulw' ? 0 : null,
        ui: activeConversation.ui.map(item => item.id === activeGate.data.id && item.type === 'ulw_turns_reached'
          ? { ...item, resolved: true }
          : item),
      },
      [{ id: makeId('agent'), type: 'agent', content: action === 'continue' ? 'ULW turn budget refreshed.' : `Mode switched to ${nextMode}.` }],
    );
    setLastOutbound({ type: 'ULW_RESPONSE', action, ...options, session_id: activeConversation.id });
    upsertConversation(next);
  }, [activeConversation, activeGate, upsertConversation]);

  const reconnect = useCallback(() => {
    if (!activeConversation) {
      return;
    }
    if (!isHostedAgentAddress(activeConversation.agentAddress)) {
      return;
    }
    setError(null);
    connectHostedAgent(activeConversation.agentAddress, activeConversation, {
      onConnectionState: setConnectionState,
      onOutbound: setLastOutbound,
    })
      .then(result => {
        upsertConversation({
          ...activeConversation,
          serverSession: result.serverSession ?? activeConversation.serverSession,
          updatedAt: Date.now(),
        });
      })
      .catch(err => {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
      });
  }, [activeConversation, upsertConversation]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (!activeConversation) {
        return;
      }
      if (state === 'background' || state === 'inactive') {
        saveConversation(activeConversation).catch(err => setError(err instanceof Error ? err.message : String(err)));
      }
      if (state === 'active' && connectionState === 'disconnected' && isHostedAgentAddress(activeConversation.agentAddress)) {
        reconnect();
      }
    });

    return () => subscription.remove();
  }, [activeConversation, connectionState, reconnect]);

  return {
    identity,
    conversations,
    activeConversation,
    activeGate,
    connectionState,
    isProcessing,
    error,
    lastOutbound,
    selectConversation,
    createConversation,
    removeConversation,
    updateAgentAddress,
    connectToAgent,
    setMode,
    send,
    respondToAskUser,
    respondToApproval,
    submitOnboard,
    respondToPlanReview,
    respondToUlwTurnsReached,
    reconnect,
  };
}
