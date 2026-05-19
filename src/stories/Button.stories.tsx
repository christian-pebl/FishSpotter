import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Primitives/Button",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

export const Primary: Story = {
  render: () => (
    <button className="pebl-button-primary px-6 py-3">Primary</button>
  ),
};

export const PrimaryDisabled: Story = {
  render: () => (
    <button className="pebl-button-primary px-6 py-3" disabled>
      Disabled
    </button>
  ),
};

export const Secondary: Story = {
  render: () => (
    <button className="pebl-button-secondary px-6 py-3">Secondary</button>
  ),
};
