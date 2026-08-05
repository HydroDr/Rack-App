import { useEffect } from "react";
import { describe, expect, it } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { fromInches } from "@rack-app/rules-engine";
import type { Layout } from "@rack-app/state";
import { AppStoresProvider, useAppStores, type AppStores } from "../../app/stores.js";
import { SharePanel } from "../SharePanel.js";

const now = "2024-01-01T00:00:00.000Z";
const projectId = "project-1" as never;

const layoutA: Layout = { id: "layout-a" as never, projectId, name: "Aisle A", createdAt: now, updatedAt: now, schemaVersion: 1 };
const layoutB: Layout = { id: "layout-b" as never, projectId, name: "Aisle B", createdAt: now, updatedAt: now, schemaVersion: 1 };

function StoresCapture({ onReady }: { onReady: (stores: AppStores) => void }) {
  const stores = useAppStores();
  useEffect(() => {
    onReady(stores);
  }, [stores, onReady]);
  return null;
}

function renderPanel(databaseName: string = `test-share-panel-${Math.random()}`) {
  let stores: AppStores | undefined;
  const utils = render(
    <AppStoresProvider databaseName={databaseName}>
      <StoresCapture
        onReady={(s) => {
          stores = s;
        }}
      />
      <SharePanel projectId={projectId} layouts={[layoutA, layoutB]} onClose={() => {}} />
    </AppStoresProvider>,
  );
  return { ...utils, getStores: () => stores, databaseName };
}

describe("SharePanel — Spec §6.3a/§6.6b: share link creation/management + feedback viewer", () => {
  it("creates a share link for the checked layouts and displays its URL", async () => {
    renderPanel();

    await waitFor(() => expect(screen.getByText("Aisle A")).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("Aisle A"));
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));

    await waitFor(() => expect(screen.getByLabelText(/link created/i)).toBeInTheDocument());
    const urlInput = screen.getByLabelText(/link created/i) as HTMLInputElement;
    expect(urlInput.value).toMatch(/\/share\//);

    // The new link also shows up in the "Links & feedback" list, resolving the layout id back to its name.
    await waitFor(() => expect(screen.getAllByText(/Aisle A/).length).toBeGreaterThan(1));
  });

  it("refuses to create a link with no layouts selected, surfacing an error", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Aisle A")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /create link/i }));
    await waitFor(() => expect(screen.getByText(/pick at least one layout/i)).toBeInTheDocument());
  });

  it("revoke marks a link revoked and hides its Revoke button", async () => {
    renderPanel();
    await waitFor(() => expect(screen.getByText("Aisle A")).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText("Aisle A"));
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^revoke$/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^revoke$/i }));

    await waitFor(() => expect(screen.getByText(/revoked/i)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /^revoke$/i })).toBeNull();
  });

  it("displays existing feedback (thumbs-up, comment with position, general note) for a share link", async () => {
    const { getStores, databaseName, unmount: unmountFirst } = renderPanel();
    await waitFor(() => expect(getStores()).toBeDefined());
    const { repositories } = getStores()!;

    fireEvent.click(screen.getByLabelText("Aisle A"));
    fireEvent.click(screen.getByRole("button", { name: /create link/i }));
    await waitFor(() => expect(screen.getByLabelText(/link created/i)).toBeInTheDocument());

    const linksResult = await repositories.shareLinks.list();
    if (linksResult.kind === "error") throw new Error("unreachable");
    const link = linksResult.value[0]!;

    await act(async () => {
      await repositories.feedback.save({
        id: "fb-thumbsup" as never,
        layoutId: layoutA.id,
        shareLinkId: link.id,
        sessionId: "session-1",
        feedbackType: "thumbsUp",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await repositories.feedback.save({
        id: "fb-comment" as never,
        layoutId: layoutA.id,
        shareLinkId: link.id,
        sessionId: "session-1",
        feedbackType: "comment",
        positionXIn: fromInches(120),
        positionYIn: fromInches(60),
        text: "Move this bay over",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await repositories.feedback.save({
        id: "fb-note" as never,
        layoutId: layoutA.id,
        shareLinkId: link.id,
        sessionId: "session-1",
        feedbackType: "generalNote",
        text: "Looks great overall",
        createdAt: now,
        updatedAt: now,
        schemaVersion: 1,
      });
      await repositories.shareLinks.recordView(link.id);
    });
    unmountFirst();

    // Re-render (same database) to pick up the newly-saved feedback — the component loads feedback once on mount.
    const { unmount } = renderPanel(databaseName);
    await waitFor(() => expect(screen.getAllByText(/thumbs-up: 1/i).length).toBeGreaterThan(0));
    expect(screen.getAllByText(/move this bay over/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/looks great overall/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/views: 1/i).length).toBeGreaterThan(0);
    unmount();
  });
});
