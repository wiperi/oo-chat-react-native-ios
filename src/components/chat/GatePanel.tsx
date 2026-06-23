import React, { useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import { compactJson } from '../../utils/format';
import type { ActiveGate, ApprovalMode } from '../../types';

export function GatePanel(props: {
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
