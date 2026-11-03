import SectionTitle from "./SectionTitle";
import image1 from "../../../assets/images/refuge/image-1.png";
import image2 from "../../../assets/images/refuge/image-2.png";
import image3 from "../../../assets/images/refuge/image-3.png";
import image4 from "../../../assets/images/refuge/image-4.png";
import image5 from "../../../assets/images/refuge/image-5.png";

const gallery = [
  {src: image1, alt: "Hikers on a snowy ridge"},
  {src: image2, alt: "Alpine lake below the peaks"},
  {src: image3, alt: "The refuge buildings"},
  {src: image4, alt: "Rock formation on the trail"},
  {src: image5, alt: "Mountain lake in the valley"},
];

export default function AboutSection() {
  return (
    <section id="about" className="scroll-mt-4 bg-[#fdfde6] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle>About the refuge</SectionTitle>
        <p className="mt-6 leading-relaxed text-[#23404d]">
          Perched at 2,537 meters in the scenic Vallon des Fours, Refuge du Fond
          des Fours offers a genuine alpine pause for hikers exploring the
          Vanoise National Park. Rebuilt with modern eco-friendly timber
          architecture and fully powered by solar energy, our shelter combines
          environmental stewardship with the warmth of traditional mountain
          hospitality. Whether you are tackling a major trek like the GR5 or
          seeking a peaceful night under the stars above Val-d’Isère, you will
          find a warm welcome, a cozy communal dinner, and a safe refuge far
          from the daily rush.
        </p>
        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5 md:gap-6">
          {gallery.map((img) => (
            <img
              key={img.src}
              src={img.src}
              alt={img.alt}
              loading="lazy"
              className="aspect-square w-full rounded-xl object-cover shadow-md"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
