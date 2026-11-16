// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ComponentType } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetLazyComponentsForTests, useLazyComponent } from "./useLazyComponent";

const Hello: ComponentType<{ name: string }> = ({ name }) => <p>{name}</p>;

beforeEach(() => resetLazyComponentsForTests());

describe("useLazyComponent", () => {
  it("is empty and fetches nothing until it is asked", () => {
    const load = vi.fn(async () => Hello);
    const { result } = renderHook(() => useLazyComponent(load));
    expect(result.current[0]).toBeNull();
    expect(load).not.toHaveBeenCalled();
  });

  it("hands back the component once its code has arrived", async () => {
    const load = vi.fn(async () => Hello);
    const { result } = renderHook(() => useLazyComponent(load));

    act(() => result.current[1]());
    await waitFor(() => expect(result.current[0]).toBe(Hello));
  });

  it("fetches once however often it is asked", async () => {
    const load = vi.fn(async () => Hello);
    const { result } = renderHook(() => useLazyComponent(load));

    act(() => {
      result.current[1]();
      result.current[1]();
      result.current[1]();
    });
    await waitFor(() => expect(result.current[0]).toBe(Hello));
    act(() => result.current[1]());
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("a component that mounts after the code arrived has it on its first render", async () => {
    // No empty beat on a remount: the Pebble pill must never flash as nothing.
    const load = vi.fn(async () => Hello);
    const first = renderHook(() => useLazyComponent(load));
    act(() => first.result.current[1]());
    await waitFor(() => expect(first.result.current[0]).toBe(Hello));

    const second = renderHook(() => useLazyComponent(load));
    expect(second.result.current[0]).toBe(Hello);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed fetch: the next ask tries again", async () => {
    const load = vi
      .fn<() => Promise<ComponentType<{ name: string }>>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(Hello);
    const { result } = renderHook(() => useLazyComponent(load));

    await act(async () => {
      result.current[1]();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(result.current[0]).toBeNull();
    expect(load).toHaveBeenCalledTimes(1);

    act(() => result.current[1]());
    await waitFor(() => expect(result.current[0]).toBe(Hello));
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not touch a component that has gone away while its code was on the way", async () => {
    let release!: (component: ComponentType<{ name: string }>) => void;
    const load = vi.fn(
      () =>
        new Promise<ComponentType<{ name: string }>>((resolve) => {
          release = resolve;
        }),
    );
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const { result, unmount } = renderHook(() => useLazyComponent(load));

    act(() => result.current[1]());
    unmount();
    await act(async () => {
      release(Hello);
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });
});
