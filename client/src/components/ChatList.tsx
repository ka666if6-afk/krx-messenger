import React from 'react';
import { Chat } from '../types/types';
import { useApp } from '../contexts/AppContext';

interface ChatListProps {
  chats: Chat[];
  onChatSelect: (chat: Chat) => void;
  currentChat: Chat | null;
}

export const ChatList: React.FC<ChatListProps> = ({ chats, onChatSelect, currentChat }) => {
  const { user, toggleMute } = useApp();

  // ФИКС: Безопасное получение первой буквы
  const getFirstLetter = (name: string | undefined) => {
    return name ? name[0].toUpperCase() : '?';
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  const getChatDisplayInfo = (chat: Chat) => {
    if (chat.type === 'direct' && chat.otherUser) {
      return {
        name: chat.otherUser.displayName || 'Unknown User',
        avatar: chat.otherUser.avatarUrl,
        status: chat.otherUser.isOnline ? 'online' : 'offline'
      };
    } else {
      return {
        name: chat.name || 'Unnamed Group',
        avatar: chat.avatarUrl,
        status: 'group'
      };
    }
  };

  if (chats.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 text-center text-gray-500 dark:text-gray-400">
          <div className="text-4xl mb-4">💬</div>
          <p className="text-lg font-medium mb-2">No conversations yet</p>
          <p className="text-sm">Start a new chat to see your conversations here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {chats.map(chat => {
        const chatInfo = getChatDisplayInfo(chat);
        const isSelected = currentChat?.id === chat.id;
        
        return (
          <div
            key={chat.id}
            onClick={() => onChatSelect(chat)}
            className={`p-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer transition-colors ${
              isSelected 
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800' 
                : 'hover:bg-gray-50 dark:hover:bg-gray-800'
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Аватар */}
              <div className="relative flex-shrink-0">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  chat.type === 'direct' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-500'
                }`}>
                  {chatInfo.avatar ? (
                    <img 
                      src={`http://localhost:5001${chatInfo.avatar}`} 
                      alt={chatInfo.name}
                      className="w-12 h-12 rounded-full"
                    />
                  ) : (
                    <span className={`font-medium ${
                      chat.type === 'direct' 
                        ? 'text-gray-600 dark:text-gray-300' 
                        : 'text-white'
                    }`}>
                      {/* ФИКС: Безопасное получение первой буквы */}
                      {getFirstLetter(chatInfo.name)}
                    </span>
                  )}
                </div>
                
                {/* Индикатор онлайн статуса */}
                {chat.type === 'direct' && chatInfo.status === 'online' && (
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white dark:border-gray-800 rounded-full"></div>
                )}
              </div>

              {/* Информация чата */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                    {chatInfo.name}
                  </h3>
                  {chat.lastMessageTime && (
                    <span className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 ml-2">
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  )}
                </div>
                
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600 dark:text-gray-300 truncate flex-1 mr-2">
                    {chat.lastMessageSender && (
                      <span className="font-medium text-gray-700 dark:text-gray-200">
                        {chat.lastMessageSender === user?.displayName ? 'You' : chat.lastMessageSender}:
                      </span>
                    )}
                    {' '}{chat.lastMessage || 'No messages yet'}
                  </p>
                  
                  {chat.unreadCount > 0 && (
                    <div className="bg-blue-500 text-white text-xs rounded-full min-w-[20px] h-5 flex items-center justify-center px-1 flex-shrink-0">
                      {chat.unreadCount > 99 ? '99+' : chat.unreadCount}
                    </div>
                  )}
                </div>
                
                {/* Дополнительная информация */}
                <div className="flex items-center mt-1">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {chat.type === 'direct' ? (
                      chatInfo.status === 'online' ? 'Online' : 'Offline'
                    ) : (
                      'Group'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};