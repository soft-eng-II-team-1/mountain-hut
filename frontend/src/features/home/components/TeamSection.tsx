import SectionTitle from "./SectionTitle";
import image6 from "../../../assets/images/team/image-6.png";
import image7 from "../../../assets/images/team/image-7.png";
import image8 from "../../../assets/images/team/image-8.png";
import image9 from "../../../assets/images/team/image-9.png";

const members = [
  {name: "Jean-Luc Dupont", role: "Head Hut Warden"},
  {name: "Marie Laurent", role: "Head Chef / Kitchen Manager"},
  {name: "Thomas Bernard", role: "Assistant Warden & Operations"},
  {name: "Pierre Moreau", role: "Mountain and Safety Advisor"},
];

const photos = [image6, image7, image8, image9];

export default function TeamSection() {
  return (
    <section id="team" className="scroll-mt-4 bg-[#fdfde6] py-14">
      <div className="mx-auto grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
        <div>
          <SectionTitle>Our team</SectionTitle>
          <p className="mt-8 text-[#23404d]">
            Who’s welcoming you at 2,537 meters:
          </p>
          <ul className="mt-4 list-disc space-y-2 pl-6 text-[#23404d]">
            {members.map((m) => (
              <li key={m.name}>
                {m.name} — {m.role}
              </li>
            ))}
          </ul>
        </div>
        <div className="grid grid-cols-2 gap-3 md:justify-self-end">
          {photos.map((src, i) => (
            <img
              key={src}
              src={src}
              alt={`Our team at work ${i + 1}`}
              loading="lazy"
              className="aspect-3/2 w-full max-w-65 rounded-xl object-cover shadow-md"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
