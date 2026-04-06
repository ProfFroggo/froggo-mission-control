/**
 * Fly Machines API wrapper — manages per-user Fly Machine instances.
 *
 * Each workspace gets a dedicated Fly Machine with a persistent volume
 * for Mission Control data. Machines are created on-demand and stopped
 * when idle to minimize cost.
 *
 * Env vars: FLY_API_TOKEN, FLY_APP_NAME, ANTHROPIC_API_KEY, INTERNAL_API_TOKEN
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MachineConfig {
  region: string;
  image: string;
  size: string;
  memoryMb: number;
  env: Record<string, string>;
  mounts: MachineMount[];
}

export interface MachineMount {
  volume: string;
  path: string;
}

export interface FlyMachine {
  id: string;
  name: string;
  state: MachineState;
  region: string;
  instance_id: string;
  private_ip: string;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type MachineState =
  | "created"
  | "starting"
  | "started"
  | "stopping"
  | "stopped"
  | "replacing"
  | "destroying"
  | "destroyed";

export interface FlyVolume {
  id: string;
  name: string;
  state: string;
  size_gb: number;
  region: string;
  created_at: string;
}

export interface InstanceStatus {
  workspaceId: string;
  machineId: string | null;
  volumeId: string | null;
  state: MachineState | "not_found";
  region: string | null;
  privateIp: string | null;
}

export interface ProvisionResult {
  machineId: string;
  volumeId: string;
  privateIp: string;
  region: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FLY_API_BASE = "https://api.machines.dev/v1";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function flyHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${requireEnv("FLY_API_TOKEN")}`,
    "Content-Type": "application/json",
  };
}

function appName(): string {
  return requireEnv("FLY_APP_NAME");
}

function machineNameForWorkspace(workspaceId: string): string {
  return `mc-${workspaceId}`;
}

function volumeNameForWorkspace(workspaceId: string): string {
  return `mc_data_${workspaceId}`;
}

async function flyFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${FLY_API_BASE}/apps/${appName()}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...flyHeaders(),
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(
      `Fly API error ${response.status} ${response.statusText} — ${path}: ${body}`,
    );
  }

  // Some endpoints return 200 with empty body (e.g. stop, destroy)
  const text = await response.text();
  if (!text) return undefined as unknown as T;
  return JSON.parse(text) as T;
}

// ---------------------------------------------------------------------------
// Volume management
// ---------------------------------------------------------------------------

async function findVolume(workspaceId: string): Promise<FlyVolume | null> {
  const volumes = await flyFetch<FlyVolume[]>("/volumes");
  const name = volumeNameForWorkspace(workspaceId);
  return volumes.find((v) => v.name === name) ?? null;
}

async function createVolume(
  workspaceId: string,
  region: string,
): Promise<FlyVolume> {
  return flyFetch<FlyVolume>("/volumes", {
    method: "POST",
    body: JSON.stringify({
      name: volumeNameForWorkspace(workspaceId),
      region,
      size_gb: 1,
      encrypted: true,
    }),
  });
}

async function destroyVolume(volumeId: string): Promise<void> {
  await flyFetch<void>(`/volumes/${volumeId}`, { method: "DELETE" });
}

// ---------------------------------------------------------------------------
// Machine management
// ---------------------------------------------------------------------------

async function findMachine(workspaceId: string): Promise<FlyMachine | null> {
  const machines = await flyFetch<FlyMachine[]>("/machines");
  const name = machineNameForWorkspace(workspaceId);
  return machines.find((m) => m.name === name) ?? null;
}

function buildMachineConfig(
  workspaceId: string,
  volumeId: string,
  region: string,
): Record<string, unknown> {
  return {
    name: machineNameForWorkspace(workspaceId),
    region,
    config: {
      image: `registry.fly.io/${appName()}:latest`,
      guest: {
        cpu_kind: "shared",
        cpus: 1,
        memory_mb: 512,
      },
      env: {
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ?? "",
        INTERNAL_API_TOKEN: process.env.INTERNAL_API_TOKEN ?? "",
        MISSION_CONTROL_HOME: "/data/mission-control",
        WORKSPACE_ID: workspaceId,
      },
      mounts: [
        {
          volume: volumeId,
          path: "/data",
        },
      ],
      services: [
        {
          ports: [{ port: 8080, handlers: ["http"] }],
          protocol: "tcp",
          internal_port: 8080,
        },
      ],
      auto_destroy: false,
      restart: {
        policy: "on-failure",
        max_retries: 3,
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Health check polling
// ---------------------------------------------------------------------------

async function waitForState(
  machineId: string,
  targetState: MachineState,
  timeoutMs: number = 60_000,
  pollIntervalMs: number = 2_000,
): Promise<FlyMachine> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const machine = await flyFetch<FlyMachine>(`/machines/${machineId}`);
    if (machine.state === targetState) {
      return machine;
    }
    if (machine.state === "destroyed") {
      throw new Error(
        `Machine ${machineId} was destroyed while waiting for state "${targetState}"`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(
    `Timed out waiting for machine ${machineId} to reach state "${targetState}" after ${timeoutMs}ms`,
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a new Fly Machine + volume for a workspace.
 * Throws if the workspace already has a machine.
 */
export async function createInstance(
  workspaceId: string,
  region: string = "iad",
): Promise<ProvisionResult> {
  const existing = await findMachine(workspaceId);
  if (existing) {
    throw new Error(
      `Machine already exists for workspace ${workspaceId}: ${existing.id} (state: ${existing.state})`,
    );
  }

  // Create volume first — machine needs it at boot
  const volume = await createVolume(workspaceId, region);

  // Create machine with volume attached
  const machinePayload = buildMachineConfig(workspaceId, volume.id, region);
  const machine = await flyFetch<FlyMachine>("/machines", {
    method: "POST",
    body: JSON.stringify(machinePayload),
  });

  // Wait for it to be running
  const started = await waitForState(machine.id, "started");

  return {
    machineId: started.id,
    volumeId: volume.id,
    privateIp: started.private_ip,
    region: started.region,
  };
}

/**
 * Ensure the workspace machine is running. Starts it if stopped, waits for healthy.
 * Creates a new instance if none exists.
 */
export async function ensureRunning(
  workspaceId: string,
  region: string = "iad",
): Promise<ProvisionResult> {
  const machine = await findMachine(workspaceId);

  if (!machine) {
    return createInstance(workspaceId, region);
  }

  if (machine.state === "started") {
    const volume = await findVolume(workspaceId);
    return {
      machineId: machine.id,
      volumeId: volume?.id ?? "",
      privateIp: machine.private_ip,
      region: machine.region,
    };
  }

  if (machine.state === "stopped" || machine.state === "created") {
    await flyFetch<void>(`/machines/${machine.id}/start`, { method: "POST" });
    const started = await waitForState(machine.id, "started");
    const volume = await findVolume(workspaceId);
    return {
      machineId: started.id,
      volumeId: volume?.id ?? "",
      privateIp: started.private_ip,
      region: started.region,
    };
  }

  // Machine exists in a transitional state — wait for it to settle
  if (machine.state === "starting") {
    const started = await waitForState(machine.id, "started");
    const volume = await findVolume(workspaceId);
    return {
      machineId: started.id,
      volumeId: volume?.id ?? "",
      privateIp: started.private_ip,
      region: started.region,
    };
  }

  throw new Error(
    `Machine for workspace ${workspaceId} is in unexpected state: ${machine.state}`,
  );
}

/**
 * Stop the workspace machine (preserves volume data).
 */
export async function stopInstance(workspaceId: string): Promise<void> {
  const machine = await findMachine(workspaceId);
  if (!machine) {
    throw new Error(`No machine found for workspace ${workspaceId}`);
  }

  if (machine.state === "stopped") {
    return; // Already stopped
  }

  await flyFetch<void>(`/machines/${machine.id}/stop`, { method: "POST" });
  await waitForState(machine.id, "stopped");
}

/**
 * Permanently destroy the workspace machine and its volume.
 */
export async function destroyInstance(workspaceId: string): Promise<void> {
  const machine = await findMachine(workspaceId);
  const volume = await findVolume(workspaceId);

  if (machine) {
    // Must stop before destroying
    if (machine.state === "started" || machine.state === "starting") {
      await flyFetch<void>(`/machines/${machine.id}/stop`, { method: "POST" });
      await waitForState(machine.id, "stopped");
    }

    await flyFetch<void>(`/machines/${machine.id}?force=true`, {
      method: "DELETE",
    });
  }

  if (volume) {
    await destroyVolume(volume.id);
  }
}

/**
 * Get current status of the workspace machine.
 */
export async function getInstanceStatus(
  workspaceId: string,
): Promise<InstanceStatus> {
  const machine = await findMachine(workspaceId);
  const volume = await findVolume(workspaceId);

  if (!machine) {
    return {
      workspaceId,
      machineId: null,
      volumeId: volume?.id ?? null,
      state: "not_found",
      region: null,
      privateIp: null,
    };
  }

  return {
    workspaceId,
    machineId: machine.id,
    volumeId: volume?.id ?? null,
    state: machine.state,
    region: machine.region,
    privateIp: machine.private_ip,
  };
}
