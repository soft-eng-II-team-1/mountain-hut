import {Link} from "react-router";
import logo from "../../assets/logo.svg";

export default function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3 text-white">
      <img src={logo} alt="Logo" className="h-16 w-16 rounded-full" />
      <div className="leading-tight">
        <p className="text-lg font-semibold tracking-wide">FOND DES FOURS</p>
        <p className="text-sm font-medium tracking-wide">MOUNTAIN HUT</p>
      </div>
    </Link>
  );
}
