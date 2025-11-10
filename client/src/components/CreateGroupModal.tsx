import React, { useState, useEffect } from 'react';
import { User } from '../types/types';
import { UserSearch } from './UserSearch';

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  // mode: 'group' or 'channel' — when 'channel' the modal will show channel-specific fields
  mode?: 'group' | 'channel';
  // onCreateGroup receives raw object; for channels it may include channelId
  onCreateGroup: (groupData: { name: string; description?: string; members: number[]; channelId?: string }) => void;
  currentUser: User;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  isOpen,
  onClose,
  mode = 'group',
  onCreateGroup,
  currentUser
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [channelId, setChannelId] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<User[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<{name?: string; channelId?: string}>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [shouldAutoUpdateChannelId, setShouldAutoUpdateChannelId] = useState(true);

  // Генерация валидного Channel ID из текста
  const generateValidChannelId = (text: string): string => {
    return text
      .toLowerCase() // в нижний регистр
      .trim() // убираем пробелы по краям
      .replace(/[^a-z0-9-]+/g, '-') // заменяем все кроме букв, цифр и дефиса на дефис
      .replace(/^-+|-+$/g, '') // убираем дефисы в начале и конце
      .substring(0, 32); // ограничиваем длину
  };

  // Автоматическое обновление Channel ID при изменении имени
  useEffect(() => {
    if (mode === 'channel' && shouldAutoUpdateChannelId && !channelId) {
      const generatedId = generateValidChannelId(name);
      setChannelId(generatedId);
    }
  }, [name, mode, shouldAutoUpdateChannelId]);

  const handleUserSelect = (user: User) => {
    if (!selectedMembers.find(m => m.id === user.id)) {
      setSelectedMembers(prev => [...prev, user]);
    }
  };

  const removeMember = (userId: number) => {
    setSelectedMembers(prev => prev.filter(m => m.id !== userId));
  };

  // Для каналов проверяем Channel ID
  const validateChannelId = (id: string): string | undefined => {
    if (!id) return undefined; // пустой ID разрешен - сгенерируем при создании
    if (id.length > 32) return 'Channel ID не может быть длиннее 32 символов';
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(id)) {
      return 'Channel ID может содержать только латинские буквы, цифры и дефис. Дефис не может быть в начале или конце.';
    }
    return undefined;
  };

  const validateForm = () => {
    const newErrors: {name?: string; channelId?: string} = {};
    
    if (!name.trim()) {
      newErrors.name = 'Group name is required';
    } else if (name.trim().length < 2) {
      newErrors.name = 'Group name must be at least 2 characters';
    }

    // Проверяем Channel ID для каналов
    if (mode === 'channel') {
      const idError = validateChannelId(channelId);
      if (idError) newErrors.channelId = idError;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsCreating(true);
    setServerError(null);

    try {
      await onCreateGroup({
        name: name.trim(),
        description: description.trim(),
        members: selectedMembers.map(m => m.id),
        channelId: channelId.trim() || undefined
      });

      // Сбрасываем форму после успешного создания
      setName('');
      setDescription('');
      setSelectedMembers([]);
      setErrors({});
      setServerError(null);
    } catch (err: any) {
      console.error('Error creating group/channel:', err);
      setServerError(err?.message || 'Failed to create');
    } finally {
      setIsCreating(false);
    }
  };

  const handleClose = () => {
    if (!isCreating) {
      setName('');
      setDescription('');
      setSelectedMembers([]);
      setErrors({});
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{mode === 'channel' ? 'Create New Channel' : 'Create New Group'}</h2>
            <button
              onClick={handleClose}
              disabled={isCreating}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 p-1 rounded-lg transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {mode === 'channel' ? 'Create a channel — admins will publish posts, others can subscribe and comment (if enabled).' : 'Create a group chat with multiple people'}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-4">
            {/* Group Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {mode === 'channel' ? 'Channel Name *' : 'Group Name *'}
              </label>
              <input
                type="text"
                placeholder="Enter group name..."
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (errors.name) setErrors({...errors, name: undefined});
                }}
                className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 transition-colors ${
                  errors.name 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                }`}
                disabled={isCreating}
              />
              {errors.name && (
                <p className="text-red-500 text-sm mt-1 flex items-center">
                  <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {errors.name}
                </p>
              )}
            </div>
            
            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description <span className="text-gray-400 text-xs">(optional)</span>
              </label>
              <textarea
                placeholder="What's this group about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors"
                rows={3}
                disabled={isCreating}
              />
            </div>
            
            {/* Add Members */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Add Members {selectedMembers.length > 0 && `(${selectedMembers.length})`}
              </label>
              <UserSearch 
                onUserSelect={handleUserSelect} 
                currentUserId={currentUser.id}
              />
              
              {/* Selected Members */}
              {selectedMembers.length > 0 && (
                <div className="mt-3 border border-gray-200 dark:border-gray-600 rounded-lg p-3 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Selected Members
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {selectedMembers.length} member{selectedMembers.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {selectedMembers.map(member => (
                      <div 
                        key={member.id} 
                        className="flex items-center justify-between p-2 bg-white dark:bg-gray-600 rounded-lg border border-gray-200 dark:border-gray-500"
                      >
                        <div className="flex items-center space-x-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-500 rounded-full flex items-center justify-center flex-shrink-0">
                            {member.avatarUrl ? (
                              <img 
                                src={`http://localhost:5001${member.avatarUrl}`} 
                                alt="" 
                                className="w-8 h-8 rounded-full" 
                              />
                            ) : (
                              <span className="text-sm text-gray-600 dark:text-gray-300 font-medium">
                                {member.displayName[0].toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {member.displayName}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              @{member.username}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeMember(member.id)}
                          disabled={isCreating}
                          className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded transition-colors disabled:opacity-50"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Hint */}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                💡 You'll be automatically added as the group admin
              </p>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex space-x-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isCreating}
              className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              // For channels we allow creating without adding other members; groups require at least one member
              disabled={isCreating || !name.trim() || (mode === 'group' && selectedMembers.length === 0)}
              className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white py-3 px-4 rounded-lg font-medium transition-colors disabled:cursor-not-allowed flex items-center justify-center"
            >
              {isCreating ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                `${mode === 'channel' ? 'Create Channel' : 'Create Group'} (${selectedMembers.length + 1})`
              )}
            </button>
          </div>
          
        {/* Group/Channel Info Summary */}
          {(name.trim() || selectedMembers.length > 0) && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center text-blue-800 dark:text-blue-300 mb-1">
                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span className="text-sm font-medium">{mode === 'channel' ? 'Channel Preview' : 'Group Preview'}</span>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-400 space-y-1">
                {name.trim() && <p><strong>Name:</strong> {name}</p>}
                {description.trim() && <p><strong>Description:</strong> {description}</p>}
                <p>
                  <strong>Members:</strong> You + {selectedMembers.length} other{selectedMembers.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
          )}

          {/* Server error area */}
          {serverError && (
            <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{serverError}</p>
            </div>
          )}

              {/* Channel ID field when creating channel */}
              {mode === 'channel' && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Channel ID <span className="text-xs text-gray-400">(unique)</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setShouldAutoUpdateChannelId(!shouldAutoUpdateChannelId);
                        if (!shouldAutoUpdateChannelId && name) {
                          setChannelId(generateValidChannelId(name));
                        }
                      }}
                      className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {shouldAutoUpdateChannelId ? 'Отключить автообновление' : 'Сгенерировать из имени'}
                    </button>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. my-channel"
                    value={channelId}
                    onChange={(e) => {
                      const val = e.target.value.toLowerCase(); // разрешаем только нижний регистр
                      setChannelId(val);
                      setShouldAutoUpdateChannelId(false); // отключаем автообновление при ручном вводе
                    }}
                    className={`w-full p-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white ${
                      errors.channelId 
                        ? 'border-red-500 focus:ring-red-500' 
                        : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    disabled={isCreating}
                  />
                  {errors.channelId && (
                    <p className="text-red-500 text-sm mt-1 flex items-center">
                      <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {errors.channelId}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Только строчные латинские буквы, цифры и дефис. Дефис не может быть в начале или конце.</p>
                </div>
              )}
        </div>
      </div>
    </div>
  );
};