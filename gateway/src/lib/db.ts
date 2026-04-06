/**
 * Database client placeholder — typed query helpers for gateway tables.
 *
 * Uses DATABASE_URL env var pointing to a PostgreSQL instance (Supabase).
 * This module provides the table type definitions and a placeholder client
 * that will be replaced with actual Supabase/Prisma queries once the
 * database is provisioned.
 */

// ---------------------------------------------------------------------------
// Table types
// ---------------------------------------------------------------------------

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  owner_id: string;
  plan: "free" | "pro" | "team";
  fly_machine_id: string | null;
  fly_volume_id: string | null;
  fly_region: string | null;
  fly_private_ip: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "viewer";
  invited_by: string | null;
  joined_at: Date;
}

export interface WorkspaceSecret {
  id: string;
  workspace_id: string;
  key: string;
  /** AES-256-GCM encrypted payload (JSON of EncryptedPayload) */
  encrypted_value: string;
  created_at: Date;
  updated_at: Date;
}

export interface WorkspaceEntitlement {
  id: string;
  workspace_id: string;
  plan: "free" | "pro" | "team";
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  current_period_end: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  description: string;
  author_id: string;
  category: "agent" | "tool" | "workflow" | "template";
  version: string;
  manifest_url: string;
  install_count: number;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
}

// ---------------------------------------------------------------------------
// Query result types
// ---------------------------------------------------------------------------

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

// ---------------------------------------------------------------------------
// Placeholder client
// ---------------------------------------------------------------------------

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL not configured. Set the DATABASE_URL environment variable to a PostgreSQL connection string.",
    );
  }
  return url;
}

/**
 * Placeholder database client.
 *
 * All methods verify that DATABASE_URL is set, then throw with a clear
 * message indicating the method is not yet implemented. Replace these
 * with actual Supabase client calls or raw SQL queries.
 */
export const db = {
  // -- Workspaces -----------------------------------------------------------

  async getWorkspace(id: string): Promise<Workspace | null> {
    getDatabaseUrl();
    console.log("[db] getWorkspace", { id });
    throw new Error("db.getWorkspace not implemented — connect Supabase client");
  },

  async getWorkspaceBySlug(slug: string): Promise<Workspace | null> {
    getDatabaseUrl();
    console.log("[db] getWorkspaceBySlug", { slug });
    throw new Error("db.getWorkspaceBySlug not implemented — connect Supabase client");
  },

  async createWorkspace(
    data: Omit<Workspace, "id" | "created_at" | "updated_at">,
  ): Promise<Workspace> {
    getDatabaseUrl();
    console.log("[db] createWorkspace", { name: data.name, slug: data.slug });
    throw new Error("db.createWorkspace not implemented — connect Supabase client");
  },

  async updateWorkspace(
    id: string,
    data: Partial<Omit<Workspace, "id" | "created_at" | "updated_at">>,
  ): Promise<Workspace> {
    getDatabaseUrl();
    console.log("[db] updateWorkspace", { id, fields: Object.keys(data) });
    throw new Error("db.updateWorkspace not implemented — connect Supabase client");
  },

  async deleteWorkspace(id: string): Promise<void> {
    getDatabaseUrl();
    console.log("[db] deleteWorkspace", { id });
    throw new Error("db.deleteWorkspace not implemented — connect Supabase client");
  },

  async listWorkspacesForUser(userId: string): Promise<Workspace[]> {
    getDatabaseUrl();
    console.log("[db] listWorkspacesForUser", { userId });
    throw new Error(
      "db.listWorkspacesForUser not implemented — connect Supabase client",
    );
  },

  // -- Members --------------------------------------------------------------

  async getMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    getDatabaseUrl();
    console.log("[db] getMembers", { workspaceId });
    throw new Error("db.getMembers not implemented — connect Supabase client");
  },

  async addMember(
    data: Omit<WorkspaceMember, "id" | "joined_at">,
  ): Promise<WorkspaceMember> {
    getDatabaseUrl();
    console.log("[db] addMember", {
      workspaceId: data.workspace_id,
      userId: data.user_id,
    });
    throw new Error("db.addMember not implemented — connect Supabase client");
  },

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    getDatabaseUrl();
    console.log("[db] removeMember", { workspaceId, userId });
    throw new Error("db.removeMember not implemented — connect Supabase client");
  },

  // -- Secrets --------------------------------------------------------------

  async getSecret(
    workspaceId: string,
    key: string,
  ): Promise<WorkspaceSecret | null> {
    getDatabaseUrl();
    console.log("[db] getSecret", { workspaceId, key });
    throw new Error("db.getSecret not implemented — connect Supabase client");
  },

  async setSecret(
    data: Omit<WorkspaceSecret, "id" | "created_at" | "updated_at">,
  ): Promise<WorkspaceSecret> {
    getDatabaseUrl();
    console.log("[db] setSecret", {
      workspaceId: data.workspace_id,
      key: data.key,
    });
    throw new Error("db.setSecret not implemented — connect Supabase client");
  },

  async deleteSecret(workspaceId: string, key: string): Promise<void> {
    getDatabaseUrl();
    console.log("[db] deleteSecret", { workspaceId, key });
    throw new Error("db.deleteSecret not implemented — connect Supabase client");
  },

  async listSecrets(workspaceId: string): Promise<WorkspaceSecret[]> {
    getDatabaseUrl();
    console.log("[db] listSecrets", { workspaceId });
    throw new Error("db.listSecrets not implemented — connect Supabase client");
  },

  // -- Entitlements ---------------------------------------------------------

  async getEntitlement(
    workspaceId: string,
  ): Promise<WorkspaceEntitlement | null> {
    getDatabaseUrl();
    console.log("[db] getEntitlement", { workspaceId });
    throw new Error("db.getEntitlement not implemented — connect Supabase client");
  },

  async setEntitlement(
    data: Omit<WorkspaceEntitlement, "id" | "created_at" | "updated_at">,
  ): Promise<WorkspaceEntitlement> {
    getDatabaseUrl();
    console.log("[db] setEntitlement", {
      workspaceId: data.workspace_id,
      plan: data.plan,
    });
    throw new Error("db.setEntitlement not implemented — connect Supabase client");
  },

  // -- Products (Marketplace) -----------------------------------------------

  async getProduct(id: string): Promise<Product | null> {
    getDatabaseUrl();
    console.log("[db] getProduct", { id });
    throw new Error("db.getProduct not implemented — connect Supabase client");
  },

  async listProducts(
    filters?: Partial<Pick<Product, "category" | "is_public" | "author_id">>,
  ): Promise<Product[]> {
    getDatabaseUrl();
    console.log("[db] listProducts", { filters });
    throw new Error("db.listProducts not implemented — connect Supabase client");
  },

  async createProduct(
    data: Omit<Product, "id" | "install_count" | "created_at" | "updated_at">,
  ): Promise<Product> {
    getDatabaseUrl();
    console.log("[db] createProduct", { slug: data.slug, name: data.name });
    throw new Error("db.createProduct not implemented — connect Supabase client");
  },

  async incrementInstallCount(productId: string): Promise<void> {
    getDatabaseUrl();
    console.log("[db] incrementInstallCount", { productId });
    throw new Error(
      "db.incrementInstallCount not implemented — connect Supabase client",
    );
  },
} as const;
