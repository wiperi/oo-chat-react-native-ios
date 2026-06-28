import React from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { styles } from '../styles/appStyles';

const logoIcon = require('../assets/icons/connectonion-logo.png');

export function WelcomeScreen(props: { onGetStarted: () => void }) {
  return (
    <View style={styles.welcomeScreen}>
      <View style={styles.welcomeContent}>
        <View style={styles.welcomeLogoTile}>
          <Image
            source={logoIcon}
            style={styles.welcomeLogoImage}
            resizeMode="contain"
            accessibilityLabel="ConnectOnion"
          />
        </View>
        <View style={styles.welcomeTextBlock}>
          <Text style={styles.welcomeTitle}>ConnectOnion</Text>
          <Text style={styles.welcomeBody}>Connect to hosted agents and chat from your iPhone.</Text>
        </View>
      </View>
      <View style={styles.welcomeActions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.fullWidthPrimaryButton, pressed && styles.pressablePressed]}
          onPress={props.onGetStarted}
        >
          <Text style={styles.fullWidthPrimaryButtonText}>Get Started</Text>
        </Pressable>
      </View>
    </View>
  );
}
