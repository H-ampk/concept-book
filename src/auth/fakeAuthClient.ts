import type { AuthClient, AuthState, AuthUnsubscribe, AuthUser } from "./types";

export type FakeAuthClientOptions = Partial<AuthState> & {
  emitInitial?: boolean;
};

/**
 * 自動テスト用。実ネットワーク / 実 Supabase に依存しない。
 */
export class FakeAuthClient implements AuthClient {
  readonly signInWithEmailCalls: string[] = [];
  signOutCalls = 0;
  private readonly listeners = new Set<(state: AuthState) => void>();
  private state: AuthState;
  private readonly emitInitial: boolean;

  constructor(options: FakeAuthClientOptions = {}) {
    const { emitInitial = true, ...state } = options;
    this.emitInitial = emitInitial;
    this.state = {
      status: state.status ?? "anonymous",
      user: state.user ?? null,
      error: state.error ?? null,
      configured: state.configured ?? true
    };
  }

  isConfigured(): boolean {
    return this.state.configured;
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    return this.state.user;
  }

  async signInWithEmail(email: string): Promise<void> {
    this.signInWithEmailCalls.push(email);
  }

  async signOut(): Promise<void> {
    this.signOutCalls += 1;
    this.setState({
      status: "anonymous",
      user: null,
      error: null,
      configured: this.state.configured
    });
  }

  subscribe(listener: (state: AuthState) => void): AuthUnsubscribe {
    this.listeners.add(listener);
    if (this.emitInitial) {
      listener(this.state);
    }
    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(next: AuthState): void {
    this.state = next;
    this.listeners.forEach((listener) => listener(next));
  }

  authenticate(user: AuthUser): void {
    this.setState({
      status: "authenticated",
      user,
      error: null,
      configured: true
    });
  }
}
