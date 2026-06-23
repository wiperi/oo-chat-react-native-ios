import React from 'react';
import { Text, View } from 'react-native';
import { styles } from '../../styles/appStyles';
import { shortAddress } from '../../utils/format';
import type { Conversation } from '../../types';

export function Header(props: { connectionState: string; identityAddress?: string; active: Conversation | null }) {
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
