import {Link, NavLink} from "react-router";
import logo from "../../assets/logo.svg";

export type SidebarItem = {
  to: string;
  label: string;
  // only active on this exact path, not on its sub-pages
  end?: boolean;
};

type SidebarProps = {
  items: SidebarItem[];
  // small grey label above the links
  sectionLabel?: string;
  open: boolean;
  onClose: () => void;
};

const isMobile = () => !window.matchMedia("(min-width: 768px)").matches;

// Dark side menu shared by the staff dashboard and the user profile.
// Slides over the page on mobile, sits next to it from md up.
export default function Sidebar({
  items,
  sectionLabel,
  open,
  onClose,
}: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-56 shrink-0 flex-col bg-[#536b75] text-white transition-transform md:static md:transition-none ${
          open ? "translate-x-0" : "-translate-x-full md:hidden"
        }`}
      >
        <Link
          to="/"
          className="flex flex-col items-center gap-1 px-4 pt-5 pb-6 text-center"
        >
          <img src={logo} alt="Logo" className="h-14 w-14" />
          <p className="text-sm font-semibold tracking-wide">FOND DES FOURS</p>
          <p className="text-[0.625rem] font-medium tracking-wide">
            MOUNTAIN HUT
          </p>
        </Link>

        {sectionLabel && (
          <p className="px-4 pb-2 text-sm text-white/60">{sectionLabel}</p>
        )}
        <nav className="flex flex-col">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => isMobile() && onClose()}
              className={({isActive}) =>
                `px-4 py-3 text-sm font-semibold transition ${
                  isActive ? "bg-white/15" : "hover:bg-white/10"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
