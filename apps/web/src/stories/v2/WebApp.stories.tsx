import type { Meta, StoryObj } from "@storybook/react-vite";
import { createStorySeed, type StorySeedName } from "../../v2-mock/fixtures/storySeeds";
import { MockSessionProvider } from "../../v2-mock/runtime/MockSessionProvider";
import { LogueWebApp } from "../../v2-mock/web/LogueWebApp";
import type { V2PrimaryRoute } from "../../v2-mock/web/ProjectShell";

function WebAppStory({ route = "projects", seed = "canonical" }: { route?: V2PrimaryRoute; seed?: StorySeedName }) {
  return <MockSessionProvider initialState={createStorySeed(seed)}><LogueWebApp initialRoute={route} /></MockSessionProvider>;
}

const meta = {
  title: "V2 Product/Web App",
  component: WebAppStory,
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof WebAppStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ActiveProjectDocument: Story = { args: { route: "projects" } };
export const LibrarySavedContent: Story = { args: { route: "library" } };
export const LibraryAllActivity: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="library" initialLibraryView="activity" /></MockSessionProvider> };
export const LocalHostSettings: Story = { args: { route: "settings" } };
export const ProjectTranscriptionProfile: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="settings" initialSettingsSection="Voice" /></MockSessionProvider> };
export const SkillsConfiguration: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="settings" initialSettingsSection="Skills" /></MockSessionProvider> };
export const MySkillsManagement: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="settings" initialSettingsSection="Skills" initialSkillsView="My Skills" /></MockSessionProvider> };
export const GlobalSkillDefaults: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="settings" initialSettingsSection="Skills" initialSkillsView="Global defaults" /></MockSessionProvider> };
export const ProjectSkillInheritance: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="projects" initialProjectSkillsOpen /></MockSessionProvider> };
export const PrivacyAndModelBoundary: Story = { render: () => <MockSessionProvider><LogueWebApp initialRoute="settings" initialSettingsSection="Privacy" /></MockSessionProvider> };
export const ProviderNeedsAttention: Story = { args: { route: "settings", seed: "provider-needs-attention" } };
