import Logo from "./Logo";

export default function Footer() {
  return (
    <footer className="bg-[#536b75]">
      <div className="mx-auto flex py-4 max-w-6xl items-center justify-between px-6">
        <Logo />
        <div className="flex gap-2 flex-col">
          <p className="text-sm font-medium text-white">
            <span className="text-[#FFFFFF80]">Phone</span> +39 3297927791
          </p>
          <p className="text-sm font-medium text-white">
            <span className="text-[#FFFFFF80]">E-mail</span>{" "}
            se2team1@mountain.it
          </p>
        </div>
        <div>
          <p className="text-sm font-medium text-[#FFFFFF80]">
            © 2026 Software Engineering 2 - Team 1
          </p>
        </div>
      </div>
    </footer>
  );
}
