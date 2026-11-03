import heroImage from "../../../assets/images/refuge/home.png";

export default function HeroSection() {
  return (
    <section
      className="relative flex min-h-105 items-start bg-cover bg-center md:min-h-130"
      style={{backgroundImage: `url(${heroImage})`}}
    >
      <div className="mx-auto w-full max-w-6xl px-6 pt-16 md:pt-20">
        <h1 className="max-w-md text-5xl font-semibold leading-tight tracking-wide text-white drop-shadow-[0_4px_6px_rgba(0,0,0,0.6)] md:text-6xl">
          FOND DES FOURS
        </h1>
        <p className="mt-2 text-sm font-medium text-white drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]">
          High-altitude alpine shelter in Val-d’Isère
        </p>
      </div>
    </section>
  );
}
