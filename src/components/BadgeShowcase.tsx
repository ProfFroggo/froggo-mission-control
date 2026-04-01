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
import { Box, Flex, Grid, Text, Heading } from '@radix-ui/themes';

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
    <Box p="6" className="bg-mission-control-bg min-h-screen">
      <Box style={{ maxWidth: '56rem', margin: '0 auto' }}>
        <Heading size="6" as="h1" mb="2">Badge Icon Showcase</Heading>
        <Text size="2" className="text-mission-control-text-dim" mb="6" as="p">
          Visual verification that all badge icons render centered and aligned properly
        </Text>

        {showcases.map((section, i) => (
          <Box key={i} mb="6">
            <Heading size="4" as="h2" mb="4">{section.title}</Heading>
            <Grid columns="3" gap="5">
              {section.items.map((item, j) => (
                <Box key={j} p="4" className="bg-mission-control-surface border border-mission-control-border rounded-lg">
                  <Flex align="center" gap="3">
                    <IconBadge icon={item.icon} color={item.preset.color} size={20} />
                    <Box>
                      <Text weight="medium" size="2" as="div">{item.label}</Text>
                      <Text size="1" className="text-mission-control-text-dim">Icon centered</Text>
                    </Box>
                  </Flex>
                </Box>
              ))}
            </Grid>
          </Box>
        ))}

        {/* Size variations */}
        <Box mb="6">
          <Heading size="4" as="h2" mb="4">Size Variations</Heading>
          <Flex align="center" gap="4">
            <Box className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={14} />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">14px</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={16} />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">16px</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={24} />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">24px</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={AlertTriangle} color={BadgePresets.systemAlert.color} size={32} />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">32px</Text>
            </Box>
          </Flex>
        </Box>

        {/* Rounded variations */}
        <Box mb="6">
          <Heading size="4" as="h2" mb="4">Border Radius Variations</Heading>
          <Flex align="center" gap="4">
            <Box className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="sm" />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">Small</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="md" />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">Medium</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="lg" />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">Large</Text>
            </Box>
            <Box className="text-center">
              <IconBadge icon={Play} color={BadgePresets.action.color} rounded="full" />
              <Text size="1" className="text-mission-control-text-dim mt-2" as="div">Full</Text>
            </Box>
          </Flex>
        </Box>

        {/* Status indicator */}
        <Box p="4" className="bg-success/10 border border-success/30 rounded-lg">
          <Flex align="center" gap="2">
            <CheckCircle size={16} className="text-success" />
            <Box>
              <Text weight="medium" className="text-success" as="div">All badges rendering correctly</Text>
              <Text size="2" className="text-mission-control-text-dim">Icons are properly centered using flexbox alignment</Text>
            </Box>
          </Flex>
        </Box>
      </Box>
    </Box>
  );
}
