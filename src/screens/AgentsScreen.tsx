import React from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { styles } from '../styles/appStyles';
import { formatTime } from '../utils/format';
import type { Conversation } from '../types';

export function AgentsScreen(props: {
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
