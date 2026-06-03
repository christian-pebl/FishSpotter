import type { Meta, StoryObj } from "@storybook/react";

const meta: Meta = {
  title: "Primitives/Card",
  parameters: { layout: "centered" },
};

export default meta;
type Story = StoryObj;

export const Surface: Story = {
  render: () => (
    <div className="pebl-surface rounded-card p-6 max-w-sm">
      <p className="pebl-eyebrow">Eyebrow</p>
      <h3 className="mt-2 font-brand text-h3 text-navy-900">Card title</h3>
      <p className="mt-2 text-sm text-navy-900/72">
        A pebl-surface block with the rounded-card corner and the canonical
        eyebrow tracking.
      </p>
    </div>
  ),
};
