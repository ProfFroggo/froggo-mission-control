import React from 'react';
import { MessageCircle } from 'lucide-react';

export const XRedditView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-mission-control-bg text-mission-control-text-dim">
      <MessageCircle size={48} className="mb-4 opacity-40" />
      <h2 className="text-lg font-semibold text-mission-control-text mb-2">Reddit Monitor</h2>
      <p className="text-sm text-center max-w-md">
        Coming Soon — Reddit API integration is not yet available.
        This feature will allow you to monitor subreddits for mentions and draft replies.
      </p>
    </div>
  );
};

export default XRedditView;
