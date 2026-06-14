import GarageDeleteButton from "./GarageDeleteButton";

export default function GarageLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <GarageDeleteButton />
    </>
  );
}
