import { ActivityIndicator, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type Variant = 'primary' | 'dangerOutline' | 'dangerText';

type Props = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: Variant;
  style?: StyleProp<ViewStyle>;
};

/**
 * The app's one button component: solid tint (the default, for every
 * primary action -- Log in, Save, Send reset link, Find gaps, ...) or a red
 * variant for destructive actions (outlined for a prominent-but-not-primary
 * action like "Delete Account", plain text for a quieter one like "Delete
 * item"). Centralizing this is what makes the tint/danger colors and the
 * tactile press feedback consistent app-wide instead of copy-pasted (and
 * drifting) per screen.
 */
export function PrimaryButton({ label, onPress, loading, disabled, variant = 'primary', style }: Props) {
  const theme = useTheme();
  const isDisabled = disabled || loading;

  const spinnerColor =
    variant === 'primary' ? theme.tintText : variant === 'dangerOutline' ? theme.danger : theme.danger;

  return (
    <AnimatedPressable
      onPress={onPress}
      disabled={isDisabled}
      style={[
        variant === 'primary' && [styles.solid, { backgroundColor: theme.tint }],
        variant === 'dangerOutline' && [styles.outline, { borderColor: theme.danger }],
        variant === 'dangerText' && styles.text,
        isDisabled && styles.disabled,
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={spinnerColor} />
      ) : (
        <ThemedText
          type={variant === 'dangerText' ? 'small' : 'default'}
          style={[
            styles.label,
            { color: variant === 'primary' ? theme.tintText : theme.danger },
          ]}>
          {label}
        </ThemedText>
      )}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  solid: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  outline: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    borderWidth: 1,
  },
  text: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
});
