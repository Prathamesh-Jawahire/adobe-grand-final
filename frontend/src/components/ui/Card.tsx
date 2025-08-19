import React from 'react';
import { clsx } from 'clsx';

// Extend div props for flexibility (including onClick, style, etc.)
interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  padding?: 'none' | 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Card: React.FC<CardProps> = ({
  children, 
  className,
  padding = 'md',
  ...rest // will include onClick if passed
}) => {
  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6'
  };

  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 shadow-sm',
        paddingClasses[padding],
        className
      )}
      {...rest} // Spread remaining props, including onClick
    >
      {children}
    </div>
  );
};

export default Card;
