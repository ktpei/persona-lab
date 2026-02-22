import Docker from "dockerode";

const IMAGE_NAME = "persona-browser";
const CONTAINER_CDP_PORT = 9222;
const CDP_READY_TIMEOUT_MS = 15_000;
const CDP_POLL_INTERVAL_MS = 500;

export class BrowserContainer {
  private docker: Docker;
  private containerId: string | null = null;
  private hostPort: number | null = null;

  constructor() {
    this.docker = new Docker();
  }

  async start(): Promise<void> {
    const t0 = Date.now();
    console.log(`[container] Creating Docker container from image ${IMAGE_NAME}...`);
    const container = await this.docker.createContainer({
      Image: IMAGE_NAME,
      ExposedPorts: { [`${CONTAINER_CDP_PORT}/tcp`]: {} },
      HostConfig: {
        // Random host port mapped to 9222 inside the container
        PortBindings: {
          [`${CONTAINER_CDP_PORT}/tcp`]: [{ HostPort: "0" }],
        },
        // Limit resources per container
        Memory: 512 * 1024 * 1024, // 512MB
        NanoCpus: 1_000_000_000,   // 1 CPU
        ShmSize: 256 * 1024 * 1024, // 256MB shared memory for Chromium
        AutoRemove: true,
      },
    });

    this.containerId = container.id;
    await container.start();

    // Get the assigned host port
    const info = await container.inspect();
    const portBindings = info.NetworkSettings.Ports[`${CONTAINER_CDP_PORT}/tcp`];
    if (!portBindings || portBindings.length === 0) {
      await this.stop();
      throw new Error("No port binding found for CDP port");
    }
    this.hostPort = parseInt(portBindings[0].HostPort, 10);

    // Wait for CDP to be ready
    console.log(`[container] Container ${this.containerId?.slice(0, 12)} started on port ${this.hostPort}, waiting for CDP...`);
    await this.waitForCDP();
    console.log(`[container] CDP ready in ${Date.now() - t0}ms`);
  }

  getEndpoint(): string {
    if (!this.hostPort) throw new Error("Container not started");
    return `http://127.0.0.1:${this.hostPort}`;
  }

  async stop(): Promise<void> {
    if (!this.containerId) return;
    console.log(`[container] Stopping container ${this.containerId.slice(0, 12)}...`);
    try {
      const container = this.docker.getContainer(this.containerId);
      await container.stop({ t: 5 }).catch(() => {});
      // AutoRemove handles cleanup, but try remove as fallback
      await container.remove({ force: true }).catch(() => {});
    } catch {
      // Container may already be gone
    }
    this.containerId = null;
    this.hostPort = null;
  }

  private async waitForCDP(): Promise<void> {
    const endpoint = this.getEndpoint();
    const deadline = Date.now() + CDP_READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
      try {
        const res = await fetch(`${endpoint}/json/version`);
        if (res.ok) return;
      } catch {
        // Not ready yet
      }
      await new Promise((r) => setTimeout(r, CDP_POLL_INTERVAL_MS));
    }

    await this.stop();
    throw new Error(`CDP not ready after ${CDP_READY_TIMEOUT_MS}ms`);
  }
}
