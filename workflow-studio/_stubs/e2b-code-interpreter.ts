/** @e2b/code-interpreter stub — sandbox execution not used in local mode. */
export class Sandbox {
  static async create(_opts?: any): Promise<Sandbox> {
    return new Sandbox()
  }
  async runCode(_code: string, _opts?: any): Promise<any> {
    return { logs: { stdout: [], stderr: [] }, error: null, results: [] }
  }
  async close(): Promise<void> {}
}
