import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Pressable, StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { useState } from 'react';

import { useAppTheme } from '@/components/ThemeContext';

type AuthFormFieldProps = {
  label: string;
  children: React.ReactNode;
};

export function AuthFormField({ label, children }: AuthFormFieldProps) {
  return (
    <View className="gap-1.5">
      <Text className="text-[12px] font-black uppercase tracking-[0.8px] text-muted-text">
        {label}
      </Text>
      {children}
    </View>
  );
}

type AuthTextInputProps = Omit<TextInputProps, 'style'>;

export function AuthTextInput(props: AuthTextInputProps) {
  const { colors } = useAppTheme();
  return (
    <TextInput
      placeholderTextColor={colors.mutedText}
      style={[
        authFieldStyles.input,
        { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
      ]}
      {...props}
    />
  );
}

type AuthPasswordInputProps = Omit<AuthTextInputProps, 'secureTextEntry'>;

export function AuthPasswordInput(props: AuthPasswordInputProps) {
  const { colors } = useAppTheme();
  const [visible, setVisible] = useState(false);
  return (
    <View>
      <TextInput
        autoCapitalize="none"
        placeholderTextColor={colors.mutedText}
        secureTextEntry={!visible}
        style={[
          authFieldStyles.input,
          authFieldStyles.passwordInput,
          { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.text },
        ]}
        {...props}
      />
      <Pressable
        hitSlop={8}
        onPress={() => setVisible((v) => !v)}
        style={authFieldStyles.eyeToggle}>
        <FontAwesome6
          color={colors.mutedText}
          name={visible ? 'eye-slash' : 'eye'}
          size={15}
        />
      </Pressable>
    </View>
  );
}

export const authFieldStyles = StyleSheet.create({
  errorCard: {
    borderRadius: 14,
    marginTop: 14,
    padding: 14,
  },
  eyeToggle: {
    bottom: 0,
    justifyContent: 'center',
    paddingHorizontal: 16,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  passwordInput: {
    paddingRight: 50,
  },
});
