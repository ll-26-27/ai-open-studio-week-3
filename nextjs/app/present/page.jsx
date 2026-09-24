import { roles } from "../../lib/present.mjs";
import StudioHeader from "../components/StudioHeader.jsx";
import PresentClient from "./PresentClient.jsx";

export const dynamic = "force-dynamic";

export const metadata = { title: "Presentation helper" };

// Practice a short talk: slide and face on screen, a live transcript while you speak (Whisper on OpenRouter), and
// follow-up questions when you stop. Each take is saved to _media/present/<stamp>/.
export default function PresentPage() {
  return (
    <>
      <StudioHeader current="/present" />
      <main id="main" className="capture-main">
        <header className="page-heading">
          <p className="eyebrow">Studio / Present</p>
          <h1>Presentation helper</h1>
          <p className="lede">Give a short talk to your slide. The transcript fills in as you speak; when you stop, the whole take is transcribed again and you get the questions someone in the room would ask next.</p>
        </header>
        <PresentClient roles={Object.fromEntries(Object.entries(roles).map(([key, value]) => [key, value.label]))} />
      </main>
    </>
  );
}
