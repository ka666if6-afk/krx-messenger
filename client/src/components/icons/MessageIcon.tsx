import React from 'react';

interface MessageIconProps {
  className?: string;
}

export const MessageIcon: React.FC<MessageIconProps> = ({ className = "w-6 h-6" }) => {
  return (
    <svg 
      className={className} 
      viewBox="0 0 24 24" 
      fill="currentColor"
    >
      <path 
        fillRule="evenodd" 
        clipRule="evenodd" 
        d="M20 2H4C2.89543 2 2 2.89543 2 4V16C2 17.1046 2.89543 18 4 18H7V21C7 21.3905 7.22792 21.7453 7.57581 21.9085C7.92371 22.0717 8.33691 22.0134 8.62792 21.7574L13.1213 18H20C21.1046 18 22 17.1046 22 16V4C22 2.89543 21.1046 2 20 2ZM4 16V4H20V16H12.5787L9 19.1573V16H4Z"
      />
      <path 
        d="M11.2929 8.29289C11.6834 7.90237 12.3166 7.90237 12.7071 8.29289L15.7071 11.2929C16.0976 11.6834 16.0976 12.3166 15.7071 12.7071C15.3166 13.0976 14.6834 13.0976 14.2929 12.7071L12 10.4142L9.70711 12.7071C9.31658 13.0976 8.68342 13.0976 8.29289 12.7071C7.90237 12.3166 7.90237 11.6834 8.29289 11.2929L11.2929 8.29289Z"
      />
    </svg>
  );
};

export default MessageIcon;