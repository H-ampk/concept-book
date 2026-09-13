import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthProvider";
import { FakeAuthClient } from "./fakeAuthClient";
import { USER_FACING_AUTH_ERROR } from "./userFacingAuthError";

const Probe = () => {
  const { status, user, currentUser, error, configured, sendingMagicLink, magicLinkSent } = useAuth();
  return (
    <div>
      <p>status:{status}</p>
      <p>configured:{String(configured)}</p>
      <p>user:{user?.id ?? "none"}</p>
      <p>currentUser:{currentUser?.id ?? "none"}</p>
      <p>error:{error ?? "none"}</p>
      <p>sending:{String(sendingMagicLink)}</p>
      <p>sent:{String(magicLinkSent)}</p>
      <p>app-body</p>
    </div>
  );
};

describe("AuthProvider", () => {
  it("初期化完了までアプリ本体を loading screen で塞がない", () => {
    const client = new FakeAuthClient({ configured: true, emitInitial: false });
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText("status:loading")).toBeInTheDocument();
    expect(screen.getByText("app-body")).toBeInTheDocument();
  });

  it("anonymous / authenticated / error を扱える", async () => {
    const client = new FakeAuthClient({ status: "anonymous", configured: true });
    render(
      <AuthProvider client={client}>
        <Probe />
      </AuthProvider>
    );
    expect(screen.getByText("status:anonymous")).toBeInTheDocument();

    act(() => {
      client.authenticate({
        id: "stable-user",
        email: "a@example.com",
        createdAt: "2026-01-01T00:00:00.000Z"
      });
    });
    await waitFor(() => {
      expect(screen.getByText("status:authenticated")).toBeInTheDocument();
    });
    expect(screen.getByText("user:stable-user")).toBeInTheDocument();
    expect(screen.getByText("currentUser:stable-user")).toBeInTheDocument();

    act(() => {
      client.setState({
        status: "error",
        user: null,
        error: USER_FACING_AUTH_ERROR,
        configured: true
      });
    });
    await waitFor(() => {
      expect(screen.getByText(`error:${USER_FACING_AUTH_ERROR}`)).toBeInTheDocument();
    });
    expect(screen.getByText("app-body")).toBeInTheDocument();
  });

  it("Provider 無しでも crash せず unconfigured 相当になる", () => {
    render(<Probe />);
    expect(screen.getByText("status:anonymous")).toBeInTheDocument();
    expect(screen.getByText("configured:false")).toBeInTheDocument();
    expect(screen.getByText("app-body")).toBeInTheDocument();
  });

  it("signInWithEmail 失敗を error boundary へ投げない", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient({ status: "anonymous", configured: true });
    client.signInWithEmail = async () => {
      throw new Error("User not found");
    };

    const Controls = () => {
      const { signInWithEmail, error } = useAuth();
      return (
        <div>
          <button type="button" onClick={() => void signInWithEmail("a@example.com")}>
            send
          </button>
          <p>error:{error ?? "none"}</p>
          <p>app-body</p>
        </div>
      );
    };

    render(
      <AuthProvider client={client}>
        <Controls />
      </AuthProvider>
    );
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => {
      expect(screen.getByText(`error:${USER_FACING_AUTH_ERROR}`)).toBeInTheDocument();
    });
    expect(screen.getByText("app-body")).toBeInTheDocument();
  });
});
