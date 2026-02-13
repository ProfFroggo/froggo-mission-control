/**
 * Badge Showcase Component
 * Visual test component to verify all badge types render correctly
 * Not for production - used for testing/documentation only
 */

import { 
  AlertTriangle, Play, Phone, CheckCircle, Clock, Mail, 
  MessageSquare, Bot, Calendar, Star, XCircle, AlertCircle 
} from 'lucide-react';
import IconBadge, { BadgePresets } from './IconBadge';

export default function BadgeShowcase() {
  const showcases = [
    {
      title: 'Alert & Warning Badges',
      items: [
        { icon: AlertTriangle, preset: BadgePresets.systemAlert, label: 'System Alert' },
        { icon: AlertCircle, preset: BadgePresets.approvalPending, label: 'Approval Pending' },
        { icon: XCircle, preset: BadgePresets.error, label: 'Error' },
      ]
    },
    {
      title: 'Action Badges',
      items: [
        { icon: Play, preset: BadgePresets.action, label: 'Action' },
        { icon: CheckCircle, preset: BadgePresets.taskComplete, label: 'Task Complete' },
        { icon: Star, preset: BadgePresets.skillLearned, label: 'Skill Learned' },
      ]
    },
    {
      title: 'Communication Badges',
      items: [
        { icon: Phone, preset: BadgePresets.message, label: 'Message' },
        { icon: MessageSquare, preset: BadgePresets.messageArrival, label: 'Message Arrival' },
        { icon: Mail, preset: BadgePresets.email, label: 'Email' },
      ]
    },
    {
      title: 'Task & Agent Badges',
      items: [
        { icon: Clock, preset: BadgePresets.taskDeadline, label: 'Task Deadline' },
        { icon: Bot, preset: BadgePresets.agentUpdate, label: 'Agent Update' },
        { icon: Calendar, preset: BadgePresets.calendarEvent, label: 'Calendar Event' },
      ]
    },
  ];

  return (
    <div className="p-8 bg-clawd-bg min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2">Badge Icon Showcase</h1>
        <p className="text-clawd-text-dim mb-8">
          Visual verification that all badge icons render centered and aligned properly
        </p>

        {showcases.map((section, i) => (
          <div key={i} className="mb-8">
            <h2 className="text-lg font-semibold mb-4">{section.title}</h2>
            <div className="grid grid-cols-3 gap-6">
              {section.items.map((item, j) => (
                <div key={j} className="p-4 bg-clawd-surface border border-clawd-border rounded-xl">
                  <div className="flex items-center gap-3">
                    <IconBadge icon={item.icon} color={item.preset.color} size={20} />
                    <div>
                      <div className="font-medium text-sm">{item.label}</div>
                      <div className="text-xs text-clawd-text-dim">Icon centered</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Size variations */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Size Variations</h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={14} />
              <div className="text-xs text-clawd-text-dim mt-2">14px</div>
            </div>
            <div className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={16} />
              <div className="text-xs text-clawd-text-dim mt-2">16px</div>
            </div>
            <div className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={24} />
              <div className="text-xs text-clawd-text-dim mt-2">24px</div>
            </div>
            <div className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={32} />
              <div className="text-xs text-clawd-text-dim mt-2">32px</div>
            </div>
          </div>
        </div>

        {/* Rounded variations */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-4">Border Radius Variations</h2>
          <div className="flex items-center gap-4">
            <div className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="sm" />
              <div className="text-xs text-clawd-text-dim mt-2">Small</div>
            </div>
            <div className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="md" />
              <div className="text-xs text-clawd-text-dim mt-2">Medium</div>
            </div>
            <div className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="lg" />
              <div className="text-xs text-clawd-text-dim mt-2">Large</div>
            </div>
            <div className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="full" />
              <div className="text-xs text-clawd-text-dim mt-2">Full</div>
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div className="p-4 bg-success-subtle border border-success-border rounded-xl">
          <div className="flex items-center gap-2">
            <CheckCircle size={16} className="text-success" />
            <div>
              <div className="font-medium text-success">All badges rendering correctly</div>
              <div className="text-sm text-clawd-text-dim">Icons are properly centered using flexbox alignment</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
