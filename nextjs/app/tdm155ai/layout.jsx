// The TDM 155AI week 3 site, one level down. Its pages keep their own title suffix.
export const metadata = {
  title: { default: "TDM155AI · Week 3", template: "%s · TDM155AI" },
  description: "Week 3: tools of the AV trade. Cameras, lenses, light, sound, and the live gallery.",
};

export default function TdmLayout({ children }) {
  return children;
}
