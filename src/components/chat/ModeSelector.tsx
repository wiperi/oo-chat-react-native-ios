import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import type { ApprovalMode, Conversation } from '../../types';

const modeLabels: Array<{ mode: ApprovalMode; label: string }> = [
  { mode: 'safe', label: 'Safe' },
  { mode: 'plan', label: 'Plan' },
  { mode: 'accept_edits', label: 'Accept' },
  { mode: 'ulw', label: 'ULW' },
];

export function ModeSelector(props: { conversation: Conversation; onChange: (mode: ApprovalMode, options?: { turns?: number }) => void }) {
  return (
    <View style={styles.modeBar}>
      {modeLabels.map(item => (
        <Pressable
          key={item.mode}
          style={({ pressed }) => [
            styles.modeButton,
            props.conversation.mode === item.mode && styles.modeButtonActive,
            pressed && styles.pressablePressed,
          ]}
          onPress={() => props.onChange(
            item.mode,
            item.mode === 'ulw' && typeof props.conversation.ulwTurns === 'number'
              ? { turns: props.conversation.ulwTurns }
              : undefined,
          )}
        >
          <Text style={[styles.modeText, props.conversation.mode === item.mode && styles.modeTextActive]}>{item.label}</Text>
        </Pressable>
      ))}
      {props.conversation.mode === 'ulw' &&
      typeof props.conversation.ulwTurnsUsed === 'number' &&
      typeof props.conversation.ulwTurns === 'number' ? (
        <Text style={styles.modeCounter}>
          {props.conversation.ulwTurnsUsed}/{props.conversation.ulwTurns}
        </Text>
      ) : null}
    </View>
  );
}
