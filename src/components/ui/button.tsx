import * as React from "react";
import { TouchableOpacity, Text, StyleSheet, View, ViewStyle, TextStyle } from "react-native";

export interface ButtonProps {
  onPress?: () => void;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link" | "hero" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
  disabled?: boolean;
}

const Button = ({ 
  onPress, 
  variant = "default", 
  size = "default", 
  children, 
  style, 
  textStyle,
  disabled 
}: ButtonProps) => {
  const buttonStyle = [
    styles.base,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const contentTextStyle = [
    styles.textBase,
    styles[`${variant}Text` as keyof typeof styles],
    styles[`${size}Text` as keyof typeof styles],
    textStyle,
  ];

  return (
    <TouchableOpacity 
      onPress={onPress} 
      style={buttonStyle as unknown as ViewStyle}
      disabled={disabled}
      activeOpacity={0.7}
    >
      {typeof children === "string" ? (
        <Text style={contentTextStyle as unknown as TextStyle}>{children}</Text>
      ) : (
        children
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    gap: 8,
  },
  textBase: {
    fontSize: 14,
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  
  // Variants
  default: {
    backgroundColor: "#0F172A",
  },
  defaultText: {
    color: "#FFFFFF",
  },
  destructive: {
    backgroundColor: "#EF4444",
  },
  destructiveText: {
    color: "#FFFFFF",
  },
  outline: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "transparent",
  },
  outlineText: {
    color: "#0F172A",
  },
  secondary: {
    backgroundColor: "#F1F5F9",
  },
  secondaryText: {
    color: "#0F172A",
  },
  ghost: {
    backgroundColor: "transparent",
  },
  ghostText: {
    color: "#0F172A",
  },
  link: {
    backgroundColor: "transparent",
  },
  linkText: {
    color: "#0EA5E9",
    textDecorationLine: "underline",
  },
  hero: {
    backgroundColor: "#0EA5E9",
    shadowColor: "#0EA5E9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  heroText: {
    color: "#FFFFFF",
  },
  glass: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  glassText: {
    color: "#FFFFFF",
  },

  // Sizes
  defaultSize: {
    height: 40,
    paddingHorizontal: 16,
  },
  sm: {
    height: 36,
    paddingHorizontal: 12,
  },
  smText: {
    fontSize: 12,
  },
  lg: {
    height: 48,
    paddingHorizontal: 24,
    borderRadius: 14,
  },
  lgText: {
    fontSize: 16,
  },
  icon: {
    width: 40,
    height: 40,
    padding: 0,
  }
});

export { Button };
