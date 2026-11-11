import type { StorybookConfig } from "@storybook/nextjs";

// Storybook 10: the old addon-essentials bundle (controls, actions, docs,
// viewport, backgrounds) is built into core, and autodocs is opted into per
// story with the "autodocs" tag rather than a global `docs.autodocs` setting.
const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-a11y"],
  framework: { name: "@storybook/nextjs", options: {} },
  staticDirs: ["../public"],
};

export default config;
