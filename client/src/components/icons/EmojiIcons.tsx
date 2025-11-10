import React from 'react';

interface EmojiIconProps {
  className?: string;
}

export const HappyEmoji: React.FC<EmojiIconProps> = ({ className = '' }) => (
  <svg 
    className={className}
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M8 14C8 14 9.5 16 12 16C14.5 16 16 14 16 14"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle cx="9" cy="9" r="1" fill="currentColor" />
    <circle cx="15" cy="9" r="1" fill="currentColor" />
  </svg>
);

export const LoveEmoji: React.FC<EmojiIconProps> = ({ className = '' }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"
      fill="currentColor"
    />
  </svg>
);

export const ThumbsUpEmoji: React.FC<EmojiIconProps> = ({ className = '' }) => (
  <svg 
    className={className} 
    viewBox="0 0 24 24" 
    fill="none" 
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export enum EmojiType {
  HAPPY = 'HAPPY',
  LOVE = 'LOVE',
  THUMBSUP = 'THUMBSUP'
}

export const EMOJI_MAP: Record<EmojiType, React.FC<EmojiIconProps>> = {
  [EmojiType.HAPPY]: HappyEmoji,
  [EmojiType.LOVE]: LoveEmoji,
  [EmojiType.THUMBSUP]: ThumbsUpEmoji,
};

export const EMOJI_TO_TYPE: Record<string, EmojiType> = {
  '😊': EmojiType.HAPPY,
  '❤️': EmojiType.LOVE,
  '👍': EmojiType.THUMBSUP,
};