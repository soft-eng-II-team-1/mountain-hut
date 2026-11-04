type PageHeaderProps = {
  title: string;
  subtitle?: string;
};

export default function PageHeader({title, subtitle}: PageHeaderProps) {
  return (
    <div className="mb-6">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {subtitle && <p className="text-sm">{subtitle}</p>}
    </div>
  );
}
