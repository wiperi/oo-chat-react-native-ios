import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';
import { compactJson } from '../utils/format';
import type { Conversation, StoredIdentity } from '../types';

export function SettingsScreen(props: {
  active: Conversation | null;
  identity: StoredIdentity | null;
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
