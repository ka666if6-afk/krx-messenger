import React, { useEffect, useState } from 'react';
import { User } from '../types/types';

interface Props {
  isOpen: boolean;
  userId: number | null;
  onClose: () => void;
}

export const UserProfileSidebar: React.FC<Props> = ({ isOpen, userId, onClose }) => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) return;
    setLoading(true);
    setError(null);
    fetch(`http://localhost:5001/api/users/${userId}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to load profile');
        return res.json();
      })
      .then((data) => {
        setProfile({
          id: data.id,
          username: data.username,
          displayName: data.displayName || data.display_name || '',
          avatarUrl: data.avatarUrl || data.avatar_url || null,
          bio: data.bio || '',
          email: data.email || ''
        });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [isOpen, userId]);

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 right-0 w-80 h-full bg-white dark:bg-gray-800 shadow-lg transform transition-transform duration-300 ease-in-out z-50 border-l border-gray-200 dark:border-gray-700">
      {/* Header with close button */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold dark:text-white">User Profile</h2>
        <button
          onClick={onClose}
          className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Profile content */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center items-center h-40">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
          </div>
        ) : error ? (
          <div className="text-red-500 text-center">{error}</div>
        ) : profile ? (
          <div className="space-y-6">
            {/* Avatar */}
            <div className="flex justify-center">
              <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {profile.avatarUrl ? (
                  <img
                    src={`http://localhost:5001${profile.avatarUrl}`}
                    alt={profile.displayName || profile.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl font-semibold text-gray-500 dark:text-gray-400">
                    {(profile.displayName || profile.username)[0].toUpperCase()}
                  </div>
                )}
              </div>
            </div>

            {/* User info */}
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {profile.displayName || profile.username}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">@{profile.username}</p>
              </div>

              {profile.bio && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bio</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{profile.bio}</p>
                </div>
              )}

              {profile.email && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{profile.email}</p>
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};