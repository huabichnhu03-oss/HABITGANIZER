import {
  KeyboardAwareScrollView,
  KeyboardAwareScrollViewProps,
} from "react-native-keyboard-controller";
import { Platform, ScrollView, ScrollViewProps } from "react-native";

type Props = KeyboardAwareScrollViewProps & ScrollViewProps;

export function KeyboardAwareScrollViewCompat({
  children,
  keyboardShouldPersistTaps = "handled",
  alwaysBounceVertical = false,
  overScrollMode = "never",
  ...props
}: Props) {
  if (Platform.OS === "web") {
    return (
      <ScrollView
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        alwaysBounceVertical={alwaysBounceVertical}
        overScrollMode={overScrollMode}
        {...props}
      >
        {children}
      </ScrollView>
    );
  }
  return (
    <KeyboardAwareScrollView
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      alwaysBounceVertical={alwaysBounceVertical}
      overScrollMode={overScrollMode}
      {...props}
    >
      {children}
    </KeyboardAwareScrollView>
  );
}
