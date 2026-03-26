import Header from "@/components/Header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container">
      <Header />
      {children}
    </div>
  );
}
