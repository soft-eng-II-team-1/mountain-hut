import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-[#536b75]">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-6 px-6 py-6 text-center md:flex-row md:justify-between md:py-4 md:text-left">
        <Logo />
        <div className="flex flex-col gap-2">
          <p className="text-sm font-medium text-white">
            <span className="text-[#FFFFFF80]">Phone</span> +39 3297927791
          </p>
          <p className="text-sm font-medium text-white">
            <span className="text-[#FFFFFF80]">E-mail</span>{" "}
            se2team1@mountain.it
          </p>
        </div>
        <p className="text-sm font-medium text-[#FFFFFF80]">
          © 2026 Software Engineering 2 - Team 1
        </p>
      </div>
    </footer>
  );
}
