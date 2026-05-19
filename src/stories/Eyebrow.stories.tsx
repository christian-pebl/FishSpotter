import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Primitives/Eyebrow",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

export const Default: Story = {
  render: () => <p className="pebl-eyebrow">Community Pulse</p>,
};
