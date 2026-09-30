import { Pressable, type PressableProps } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

const SPRING = { damping: 18, stiffness: 400 };

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  // Function styles aren't supported -- the animated style would clobber them.
  style?: PressableProps['style'] extends (...args: never[]) => unknown
    ? never
    : PressableProps['style'];
  /** How much to shrink on press. 1 = no shrink. */
  scaleTo?: number;
};

/**
 * A drop-in Pressable that compresses slightly on touch and springs back on
 * release -- basic tactile feedback the app otherwise has none of (every
 * button here previously only visually changed for a *disabled* state, never
 * for an ordinary press). Swap in wherever a screen's primary/destructive
 * action button is, first.
 */
export function AnimatedPressable({ scaleTo = 0.96, onPressIn, onPressOut, style, ...rest }: Props) {
  const scale = useSharedValue(1);
  // .get()/.set(), not .value -- React Compiler's immutability analysis
  // (app.json has experiments.reactCompiler on) doesn't know Reanimated's
  // direct-mutation model is intentional, and flags plain `.value =` writes
  // as illegal mutation. get()/set() are Reanimated's own
  // React-Compiler-compliant alternative, doing the same thing.
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  return (
    <AnimatedPressableBase
      style={[animatedStyle, style]}
      onPressIn={(event) => {
        scale.set(withSpring(scaleTo, SPRING));
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        scale.set(withSpring(1, SPRING));
        onPressOut?.(event);
      }}
      {...rest}
    />
  );
}
