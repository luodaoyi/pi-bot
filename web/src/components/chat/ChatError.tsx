import React from 'react';
import { Link } from 'react-router-dom';
import { hintForChatError } from '@/stores/chat-events';

export const ChatError: React.FC<{ error: string }> = ({ error }) => {
  const hint = hintForChatError(error);
  return (
    <div data-testid="chat-error" className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-200 space-y-1">
      <p>{error}</p>
      {hint && (
        <p>
          {hint.href ? (
            <Link to={hint.href} className="underline font-medium">
              {hint.text}
            </Link>
          ) : (
            hint.text
          )}
        </p>
      )}
    </div>
  );
};
