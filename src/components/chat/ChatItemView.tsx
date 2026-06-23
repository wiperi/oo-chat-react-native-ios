import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import { compactJson } from '../../utils/format';
import { AttachmentChip } from './AttachmentChip';
import type { ChatItem } from '../../types';

export function ChatItemView(props: { item: ChatItem }) {
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
