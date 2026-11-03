import SectionTitle from "./SectionTitle";
import bedIcon from "../../../assets/icons/bed.svg";
import mountainIcon from "../../../assets/icons/mountain.svg";
import showerIcon from "../../../assets/icons/shower.svg";
import sunIcon from "../../../assets/icons/sun.svg";
import panIcon from "../../../assets/icons/pan.svg";
import petIcon from "../../../assets/icons/pet.svg";

const features = [
  {icon: bedIcon, label: "42 beds"},
  {icon: mountainIcon, label: "2,537m"},
  {icon: showerIcon, label: "Hot shower"},
  {icon: sunIcon, label: "Solar power"},
  {icon: panIcon, label: "Local cuisine"},
  {icon: petIcon, label: "Pet friendly"},
];

export default function StructureSection() {
  return (
    <section id="structure" className="scroll-mt-4 bg-[#f3f6f9] py-14">
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-6 md:grid-cols-2">
        <div>
          <SectionTitle>The structure</SectionTitle>
          <p className="mt-6 max-w-md leading-relaxed text-[#23404d]">
            Immersive, peaceful high-altitude mountain hut in the heart of
            Val-d’Isère, nestled in the Alps.
          </p>
        </div>
        <ul className="mx-auto grid w-full max-w-md grid-cols-3 gap-x-6 gap-y-8 md:mx-0 md:justify-self-end">
          {features.map((f) => (
            <li
              key={f.label}
              className="flex aspect-6/5 flex-col items-center justify-center gap-3 rounded-lg border-2 border-[#23404d]/70 bg-white p-2 shadow-[2px_3px_4px_rgba(0,0,0,0.2)]"
            >
              <img src={f.icon} alt="" className="h-8 w-auto" />
              <span className="text-center text-xs font-medium text-black">
                {f.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
