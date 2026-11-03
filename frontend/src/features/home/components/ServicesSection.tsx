import SectionTitle from "./SectionTitle";

const services = [
  {name: "Hot Shower", description: "5-minute token", price: "€ 4 / token"},
  {
    name: "Overnight Stay",
    description: "Single bed (sheet liner required)",
    price: "€ 38 / night",
  },
  {
    name: "Single Dinner",
    description: "3-course local mountain dinner",
    price: "€ 28 / person",
  },
  {
    name: "Packed Lunch",
    description: "Trail sandwich, fruit + energy bar",
    price: "€ 13 / person",
  },
];

export default function ServicesSection() {
  return (
    <section id="services" className="scroll-mt-4 bg-white py-14">
      <div className="mx-auto max-w-6xl px-6">
        <SectionTitle>Services</SectionTitle>
        <div className="mx-auto mt-8 max-w-4xl overflow-x-auto">
          <table className="w-full border-separate border-spacing-x-1 border-spacing-y-2 text-sm text-[#23404d]">
            <thead className="sr-only">
              <tr>
                <th>Service</th>
                <th>Description</th>
                <th>Price</th>
              </tr>
            </thead>
            <tbody>
              {services.map((s) => (
                <tr key={s.name}>
                  <td className="w-1/5 bg-[#d9d9d9] px-3 py-3 whitespace-nowrap">
                    {s.name}
                  </td>
                  <td className="bg-[#d9d9d9] px-3 py-3">{s.description}</td>
                  <td className="w-1/5 bg-[#d9d9d9] px-3 py-3 whitespace-nowrap">
                    {s.price}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
