// (c) 2026 Froggo.pro. Licensed under the Apache License, Version 2.0.
// src/types/projects.ts
// TypeScript interfaces for the Projects module.

export type ProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export interface Project {
  id: string;
  name: string;
  description?: string;
  emoji: string;
  color: string;
  goal?: string;
  status: ProjectStatus;
  createdBy?: string;
  createdAt: number;
  updatedAt: number;
  // Computed — joined from project_members
  members?: ProjectMember[];
  // Computed — from tasks count query
  taskCounts?: { todo: number; inProgress: number; done: number; total: number };
  // Computed — last task activity
  lastActivity?: number;
}

export interface ProjectMember {
  projectId: string;
  agentId: string;
  role: 'lead' | 'member';
  addedAt: number;
  // Joined from agents table
  agentName?: string;
  agentEmoji?: string;
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  emoji?: string;
  color?: string;
  goal?: string;
  memberAgentIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  emoji?: string;
  color?: string;
  goal?: string;
  status?: ProjectStatus;
}

export interface ProjectFile {
  name: string;
  path: string;
  size: number;
  type: string;
  modifiedAt: number;
}

export interface ProjectDispatchInput {
  agentId: string;
  title: string;
  description: string;
  priority?: 'p0' | 'p1' | 'p2' | 'p3';
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  dueDate?: number;
  completed: number;  // 0 | 1
  completedAt?: number;
  createdAt: number;
}

export interface CreateMilestoneInput {
  title: string;
  dueDate?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  dueDate?: number;
  completed?: boolean;
}
