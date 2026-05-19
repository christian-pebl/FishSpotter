import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Primitives/Chip",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

export const Idle: Story = {
  render: () => (
    <span className="pebl-chip inline-flex items-center rounded-full px-3 py-1 text-xs">
      Wrasse
    </span>
  ),
};

export const Active: Story = {
  render: () => (
    <span className="pebl-chip pebl-chip-active inline-flex items-center rounded-full px-3 py-1 text-xs">
      Wrasse
    </span>
  ),
};
