import React, { useState, useRef, useEffect } from 'react';
import { User } from '../types/types';

interface UserSearchProps {
  onUserSelect: (user: User) => void;
  currentUserId: number;
}

export const UserSearch: React.FC<UserSearchProps> = ({ onUserSelect, currentUserId }) => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Закрываем результаты при клике вне компонента
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchUsers = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setUsers([]);
      setShowResults(false);
      return;
    }

    setIsSearching(true);
    setShowResults(true);
    
    try {
      const response = await fetch(
        `http://localhost:5001/api/search-users?query=${encodeURIComponent(searchQuery)}&currentUserId=${currentUserId}`
      );
      
      if (response.ok) {
        const results = await response.json();
        setUsers(results);
      } else {
        setUsers([]);
      }
    } catch (error) {
      console.error('Search error:', error);
      setUsers([]);
    }
    
    setIsSearching(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    
    // Дебаунс поиска - ждем 300ms после последнего ввода
    const timeoutId = setTimeout(() => {
      searchUsers(value);
    }, 300);
    
    return () => clearTimeout(timeoutId);
  };

  const handleUserSelect = (user: User) => {
    onUserSelect(user);
    setQuery('');
    setUsers([]);
    setShowResults(false);
  };

  return (
    <div className="relative" ref={searchRef}>
      <input
        type="text"
        placeholder="Search users by username or name..."
        value={query}
        onChange={handleInputChange}
        onFocus={() => query.trim() && setShowResults(true)}
        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {/* Результаты поиска */}
      {showResults && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-[85vh] overflow-y-auto">
          {isSearching ? (
            <div className="p-3 text-gray-500 dark:text-gray-400 text-center">
              🔍 Searching...
            </div>
          ) : users.length > 0 ? (
            users.map(user => (
              <div
                key={user.id}
                onClick={() => handleUserSelect(user)}
                className="p-3 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer border-b border-gray-200 dark:border-gray-600 last:border-b-0 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                    {user.avatarUrl ? (
                      <img 
                        src={`http://localhost:5001${user.avatarUrl}`} 
                        alt="" 
                        className="w-10 h-10 rounded-full" 
                      />
                    ) : (
                      <span className="text-gray-600 dark:text-gray-300 font-medium">
                        {user.displayName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {user.displayName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      @{user.username}
                    </p>
                  </div>
                </div>
              </div>
            ))
          ) : query.trim() ? (
            <div className="p-3 text-gray-500 dark:text-gray-400 text-center">
              No users found for "{query}"
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
};