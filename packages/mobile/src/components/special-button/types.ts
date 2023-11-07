import React from 'react';

export interface SpecialButtonProps {
  size?: 'extra-small' | 'small' | 'medium' | 'large';
  left?: React.ReactNode;
  width: number;
  text?: string;
  right?: React.ReactNode;
  disabled?: boolean;
  onPress?: () => void;
  isLoading?: boolean;
  textOverrideIcon?: React.ReactNode;
}