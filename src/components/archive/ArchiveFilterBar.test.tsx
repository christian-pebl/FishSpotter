import { fireEvent, render, screen } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push }),
}));

import { ArchiveFilterBar } from "./ArchiveFilterBar";

const SITE = "Dale Bay, Pembrokeshire, Wales, UK";
const SPECIES = [
  { slug: "cancer-pagurus", scientificName: "Cancer pagurus", commonName: "Edible Crab", clips: 1 },
  { slug: "pagurus-bernhardus", scientificName: "Pagurus bernhardus", commonName: "Hermit Crab", clips: 8 },
];
const SITES = [
  { site: SITE, clips: 7 },
  { site: "Pabay, Inner Sound, Isle of Skye, Scotland, UK", clips: 12 },
];

beforeEach(() => push.mockClear());

describe("ArchiveFilterBar", () => {
  it("applies a location the moment it is chosen, with no blank params in the URL", () => {
    render(<ArchiveFilterBar filter={{}} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    fireEvent.change(screen.getByLabelText("Filter by location"), { target: { value: SITE } });
    expect(push).toHaveBeenCalledWith("/feed/browse?site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK");
    expect(push.mock.calls[0][0]).not.toMatch(/species=|sort=/);
  });

  it("keeps the other filter when one changes", () => {
    render(
      <ArchiveFilterBar
        filter={{ species: "pagurus-bernhardus" }}
        sort="oldest"
        speciesOptions={SPECIES}
        siteOptions={SITES}
      />,
    );
    fireEvent.change(screen.getByLabelText("Filter by location"), { target: { value: SITE } });
    expect(push).toHaveBeenCalledWith(
      "/feed/browse?species=pagurus-bernhardus&site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK&sort=oldest",
    );
  });

  it("choosing 'All locations' drops the site rather than sending site=", () => {
    render(<ArchiveFilterBar filter={{ site: SITE }} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    fireEvent.change(screen.getByLabelText("Filter by location"), { target: { value: "" } });
    expect(push).toHaveBeenCalledWith("/feed/browse");
  });

  it("re-sorting keeps the selection", () => {
    render(<ArchiveFilterBar filter={{ site: SITE }} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    fireEvent.change(screen.getByLabelText("Sort clips"), { target: { value: "site" } });
    expect(push).toHaveBeenCalledWith(
      "/feed/browse?site=Dale+Bay%2C+Pembrokeshire%2C+Wales%2C+UK&sort=site",
    );
  });

  it("carries a /farms deep-link (q) through a dropdown change and offers to remove it", () => {
    render(
      <ArchiveFilterBar filter={{ q: "Ramsey Sound Farm" }} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />,
    );
    expect(screen.getByText(/Matching/)).toHaveTextContent("Ramsey Sound Farm");
    expect(screen.getByLabelText('Remove the "Ramsey Sound Farm" filter')).toHaveAttribute("href", "/feed/browse");
    fireEvent.change(screen.getByLabelText("Filter by species"), { target: { value: "cancer-pagurus" } });
    expect(push).toHaveBeenCalledWith("/feed/browse?species=cancer-pagurus&q=Ramsey+Sound+Farm");
  });

  it("shows the URL's selection in the controls, with the counts, and a Reset", () => {
    render(
      <ArchiveFilterBar
        filter={{ site: SITE, species: "cancer-pagurus" }}
        sort="newest"
        speciesOptions={SPECIES}
        siteOptions={SITES}
      />,
    );
    expect(screen.getByLabelText("Filter by location")).toHaveValue(SITE);
    expect(screen.getByLabelText("Filter by species")).toHaveValue("cancer-pagurus");
    expect(screen.getByRole("option", { name: `${SITE} (7)` })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Hermit Crab (8)" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Reset" })).toHaveAttribute("href", "/feed/browse");
  });

  it("offers no Reset on the default view", () => {
    render(<ArchiveFilterBar filter={{}} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    expect(screen.queryByRole("link", { name: "Reset" })).toBeNull();
  });

  it("is a GET form to the archive, so it still works without JavaScript", () => {
    render(<ArchiveFilterBar filter={{}} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    const form = screen.getByRole("form", { name: "Filter clips" });
    expect(form).toHaveAttribute("method", "get");
    expect(form).toHaveAttribute("action", "/feed/browse");
  });

  it("offers Apply in the server markup and drops it once hydrated", () => {
    // What a reader without JavaScript, or one who is quicker than the script,
    // gets: a submit button and no hydrated marker.
    const html = renderToString(
      <ArchiveFilterBar filter={{}} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />,
    );
    expect(html).toContain(">Apply<");
    expect(html).not.toContain("data-hydrated");

    // After hydration the dropdowns apply themselves, so the button goes and
    // the form says so (the e2e suite waits on this before changing a control).
    render(<ArchiveFilterBar filter={{}} sort="newest" speciesOptions={SPECIES} siteOptions={SITES} />);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    expect(screen.getByRole("form", { name: "Filter clips" })).toHaveAttribute("data-hydrated");
  });
});
