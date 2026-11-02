import {Link} from "react-router";

export default function HomePage() {
  return (
    <section className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-28 text-center text-[#23404d]">
      <h1 className="text-5xl font-semibold">Welcome to Fond des Fours</h1>
      <p className="max-w-2xl text-xl">
        A cosy mountain hut high in the Alps. Book your overnight stay or reserve a table and enjoy the mountains with us.
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        <Link to="/signup" className="rounded-xl bg-[#24414f] px-8 py-3 text-xl font-semibold text-white transition hover:bg-[#1c3440]">
          Sign up
        </Link>
        <Link
          to="/login"
          className="rounded-xl border border-[#24414f] px-8 py-3 text-xl font-semibold text-[#24414f] transition hover:bg-[#24414f]/5"
        >
          Login
        </Link>
      </div>
    </section>
  );
}
