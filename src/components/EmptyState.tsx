import React, { ReactNode } from 'react';
import { Inbox, MessageSquare, CheckCircle, FolderOpen, Calendar, Bell, Bot, Code, FileText, Search } from 'lucide-react';

type EmptyStateType = 'inbox' | 'chat' | 'tasks' | 'files' | 'calendar' | 'notifications' | 'agents' | 'code' | 'search' | 'generic';

interface EmptyStateProps {
  type?: EmptyStateType;
  icon?: ReactNode;
  title?: string;
  description?: string;
  action?: ReactNode;
}

const illustrations: Record<EmptyStateType, {
  icon: any;
  title: string;
  description: string;
  gradient: string;
}> = {
  inbox: {
    icon: Inbox,
    title: "All caught up!",
    description: "No pending approvals. Enjoy the calm.",
    gradient: "from-green-500/20 to-emerald-500/10",
  },
  chat: {
    icon: MessageSquare,
    title: "Start a conversation",
    description: "Say hi to Froggo and get things done.",
    gradient: "from-blue-500/20 to-cyan-500/10",
  },
  tasks: {
    icon: CheckCircle,
    title: "No tasks yet",
    description: "Create your first task to get started.",
    gradient: "from-purple-500/20 to-pink-500/10",
  },
  files: {
    icon: FolderOpen,
    title: "Library is empty",
    description: "Drop files here to upload them.",
    gradient: "from-yellow-500/20 to-orange-500/10",
  },
  calendar: {
    icon: Calendar,
    title: "No events",
    description: "Your schedule is clear.",
    gradient: "from-indigo-500/20 to-blue-500/10",
  },
  notifications: {
    icon: Bell,
    title: "All clear!",
    description: "No notifications to show.",
    gradient: "from-rose-500/20 to-red-500/10",
  },
  agents: {
    icon: Bot,
    title: "No agents configured",
    description: "Set up your first AI agent.",
    gradient: "from-cyan-500/20 to-teal-500/10",
  },
  code: {
    icon: Code,
    title: "No activity",
    description: "Start a coding session to see progress.",
    gradient: "from-violet-500/20 to-purple-500/10",
  },
  search: {
    icon: Search,
    title: "No results",
    description: "Try a different search term.",
    gradient: "from-gray-500/20 to-slate-500/10",
  },
  generic: {
    icon: FileText,
    title: "Nothing here",
    description: "This space is empty.",
    gradient: "from-gray-500/20 to-gray-500/5",
  },
};

export default function EmptyState({ 
  type = 'generic', 
  icon: customIcon,
  title: customTitle, 
  description: customDescription,
  action 
}: EmptyStateProps) {
  const config = illustrations[type];
  const Icon = customIcon || config.icon;
  const title = customTitle || config.title;
  const description = customDescription || config.description;

  return (
    <div className="flex flex-col items-center justify-center h-full py-12 px-4">
      {/* Illustration */}
      <div className={`relative mb-6`}>
        {/* Background glow */}
        <div className={`absolute inset-0 bg-gradient-to-br ${config.gradient} rounded-full blur-3xl opacity-50 scale-150`} />
        
        {/* Icon container */}
        <div className={`relative w-24 h-24 rounded-3xl bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
          <div className="w-20 h-20 rounded-2xl bg-clawd-surface/80 flex items-center justify-center">
            {React.isValidElement(Icon) ? Icon : <Icon size={40} className="text-clawd-text-dim" />}
          </div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-clawd-accent/30 animate-pulse" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-clawd-accent/20 animate-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      {/* Text */}
      <h3 className="text-xl font-semibold text-clawd-text mb-2">{title}</h3>
      <p className="text-sm text-clawd-text-dim text-center max-w-xs">{description}</p>

      {/* Action */}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
}
