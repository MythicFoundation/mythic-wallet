import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  children: React.ReactNode;
}

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  children,
  className = '',
  ...props
}: ButtonProps) {
  const base = 'font-display font-semibold rounded-none transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed';

  const variants = {
    primary: 'bg-[#FF2D78] text-white hover:bg-[#FF5C96] active:bg-[#CC2460]',
    secondary: 'border border-[rgba(255,255,255,0.1)] text-white hover:border-[#FF2D78] hover:text-[#FF5C96]',
    ghost: 'text-text-body hover:text-text-heading hover:bg-surface-hover',
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-5 py-2.5 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      className={`${base} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
