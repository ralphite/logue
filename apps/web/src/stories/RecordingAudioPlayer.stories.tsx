import type { Meta, StoryObj } from "@storybook/react-vite";
import sampleAudioUrl from "../../../../fixtures/audio/logue-e2e.wav?url";
import { RecordingAudioPlayer } from "../components/RecordingAudioPlayer";

const meta = {
  title: "Components/Media/Recording Audio Player",
  component: RecordingAudioPlayer,
  args: { src: sampleAudioUrl, label: "Captured voice note" },
  decorators: [(Story) => <div className="w-[520px] rounded-lg border border-[#eeeeeb] bg-white p-5"><Story /></div>],
} satisfies Meta<typeof RecordingAudioPlayer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const MetadataProbe: Story = {};
export const UnavailableDuration: Story = { args: { src: "data:audio/wav;base64,invalid", label: "Unavailable recording" } };
