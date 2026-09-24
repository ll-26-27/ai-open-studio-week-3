import CaptureClient from "../components/CaptureClient.jsx";
import StudioHeader from "../components/StudioHeader.jsx";

export const dynamic = "force-dynamic";

export const metadata = { title: "Writing" };

// Capture a still of paper, cards, sticky notes, or a whiteboard; a vision model describes each surface and
// transcribes its text. Same pipeline as the class capture page (lib/capture.mjs), station "writing".
export default function WritingPage() {
  return (
    <>
      <StudioHeader current="/writing" />
      <main id="main" className="capture-main">
        <header className="page-heading">
          <p className="eyebrow">Studio / Writing</p>
          <h1>Notes from paper</h1>
          <p className="lede">Put the cards, pages, or sticky notes under the camera and press Capture (or the space bar). Each piece of paper comes back as a heading that describes it, with its text transcribed underneath. Check it against the paper.</p>
        </header>
        <CaptureClient stations={{ writing: "Writing" }} initialStation="writing" documents />
      </main>
    </>
  );
}
