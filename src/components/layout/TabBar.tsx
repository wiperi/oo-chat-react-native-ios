import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import type { AppTab } from '../../app/tabs';

const tabs: Array<{ value: AppTab; label: string }> = [
  { value: 'agents', label: 'Agents' },
  { value: 'chat', label: 'Chat' },
  { value: 'settings', label: 'Settings' },
];

export function TabBar(props: { value: AppTab; onChange: (tab: AppTab) => void }) {
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
